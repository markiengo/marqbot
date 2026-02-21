"""
Publish gate validator for track onboarding.

Checks data-quality rules that must pass before a track can be activated
(active=1) in the workbook. Designed to be importable for tests and
runnable as a standalone CLI.

Usage:
    python scripts/validate_track.py --track FP_CONC
    python scripts/validate_track.py --track FP_CONC --path path/to/workbook.xlsx
    python scripts/validate_track.py --all
"""

import argparse
import os
import sys

try:
    import pandas as pd
except ImportError as e:
    sys.exit(f"Missing dependency: {e}. Run: pip install pandas")


# ── Validation result ─────────────────────────────────────────────────────────

class ValidationResult:
    """Collects errors and warnings for a single track validation run."""

    def __init__(self, track_id: str):
        self.track_id = track_id
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    @property
    def passed(self) -> bool:
        return len(self.errors) == 0

    def summary(self) -> str:
        status = "PASS" if self.passed else "FAIL"
        lines = [f"[{status}] Track '{self.track_id}'"]
        for e in self.errors:
            lines.append(f"  [ERROR] {e}")
        for w in self.warnings:
            lines.append(f"  [WARN]  {w}")
        if self.passed and not self.warnings:
            lines.append("  All checks passed.")
        return "\n".join(lines)


# ── Individual checks ─────────────────────────────────────────────────────────

def check_track_exists(track_id: str, tracks_df: pd.DataFrame, result: ValidationResult) -> None:
    """Track must exist in the tracks sheet."""
    if tracks_df is None or len(tracks_df) == 0:
        result.error("No tracks sheet found or tracks sheet is empty.")
        return
    track_ids = tracks_df["track_id"].astype(str).str.strip().str.upper().tolist()
    if track_id.upper() not in track_ids:
        result.error(f"Track '{track_id}' not found in tracks sheet.")


def check_track_parent_major_link(
    track_id: str,
    tracks_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """
    Phase 5 readiness check: if a row is kind='track', it should reference a
    parent major through parent_major_id.
    """
    if tracks_df is None or len(tracks_df) == 0:
        return
    if "kind" not in tracks_df.columns or "parent_major_id" not in tracks_df.columns:
        return

    normalized_ids = tracks_df["track_id"].astype(str).str.strip().str.upper()
    row = tracks_df[normalized_ids == track_id.upper()]
    if len(row) == 0:
        return

    record = row.iloc[0]
    kind = str(record.get("kind", "") or "").strip().lower()
    parent_major_id = str(record.get("parent_major_id", "") or "").strip().upper()

    kind_series = tracks_df["kind"].astype(str).str.strip().str.lower()
    major_ids = set(
        tracks_df[kind_series == "major"]["track_id"].astype(str).str.strip().str.upper().tolist()
    )

    if kind == "track":
        if not parent_major_id:
            result.warn(
                f"Track '{track_id}' has no parent_major_id. "
                "Phase 5 major+track declaration should set this explicitly."
            )
        elif parent_major_id not in major_ids:
            result.error(
                f"Track '{track_id}' references parent_major_id='{parent_major_id}', "
                "but no such major exists."
            )
    elif kind == "major" and parent_major_id:
        result.warn(
            f"Major '{track_id}' has parent_major_id='{parent_major_id}' set; value will be ignored."
        )


def check_buckets_exist(track_id: str, buckets_df: pd.DataFrame, result: ValidationResult) -> None:
    """Track must have at least one bucket defined."""
    rows = buckets_df[buckets_df["track_id"] == track_id]
    if len(rows) == 0:
        result.error(f"No buckets defined for track '{track_id}' in buckets sheet.")


def check_role_policy(
    track_id: str,
    buckets_df: pd.DataFrame,
    result: ValidationResult,
    *,
    strict_single_core: bool = True,
) -> None:
    """Role policy checks.

    Legacy track validation expects exactly one core.
    V2 program-level validation allows multiple core sub-buckets.
    """
    if "role" not in buckets_df.columns:
        result.error("Buckets sheet has no 'role' column.")
        return
    track_buckets = buckets_df[buckets_df["track_id"] == track_id]
    if len(track_buckets) == 0:
        return  # Already caught by check_buckets_exist

    core_count = len(track_buckets[track_buckets["role"] == "core"])
    elective_count = len(track_buckets[track_buckets["role"] == "elective"])

    if core_count == 0:
        result.error(f"No bucket with role='core' for track '{track_id}'.")
    elif strict_single_core and core_count > 1:
        result.error(
            f"Expected exactly 1 core bucket for track '{track_id}', found {core_count}: "
            f"{track_buckets[track_buckets['role'] == 'core']['bucket_id'].tolist()}"
        )
    elif not strict_single_core and core_count > 1:
        result.warn(
            f"Track '{track_id}' has {core_count} core buckets (allowed in V2 program-level validation)."
        )
    if elective_count == 0:
        result.warn(f"No bucket with role='elective' for track '{track_id}'. Blocking-warning feature will be disabled.")


def check_mappings_exist(track_id: str, course_bucket_map_df: pd.DataFrame, result: ValidationResult) -> None:
    """Track must have at least one course-to-bucket mapping row."""
    rows = course_bucket_map_df[course_bucket_map_df["track_id"] == track_id]
    if len(rows) == 0:
        result.error(f"No course_bucket mappings for track '{track_id}'.")


def check_no_orphan_courses(
    track_id: str,
    course_bucket_map_df: pd.DataFrame,
    catalog_codes: set[str],
    result: ValidationResult,
) -> None:
    """All course_codes in mappings must exist in the courses sheet."""
    rows = course_bucket_map_df[course_bucket_map_df["track_id"] == track_id]
    if len(rows) == 0:
        return
    map_codes = set(rows["course_code"].astype(str).str.strip().tolist())
    orphans = map_codes - catalog_codes
    if orphans:
        result.error(
            f"{len(orphans)} course(s) in mappings not found in courses sheet: {sorted(orphans)}"
        )


def check_no_orphan_buckets(
    track_id: str,
    course_bucket_map_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """All bucket_ids in mappings must exist in the buckets sheet for this track."""
    map_rows = course_bucket_map_df[course_bucket_map_df["track_id"] == track_id]
    if len(map_rows) == 0:
        return
    bucket_rows = buckets_df[buckets_df["track_id"] == track_id]
    defined_bucket_ids = set(bucket_rows["bucket_id"].astype(str).str.strip().tolist())
    map_bucket_ids = set(map_rows["bucket_id"].astype(str).str.strip().tolist())
    orphans = map_bucket_ids - defined_bucket_ids
    if orphans:
        result.error(
            f"{len(orphans)} bucket_id(s) in mappings not defined in buckets sheet: {sorted(orphans)}"
        )


def check_all_buckets_have_mappings(
    track_id: str,
    course_bucket_map_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Warn if any bucket for this track has zero course mappings."""
    bucket_rows = buckets_df[buckets_df["track_id"] == track_id]
    if len(bucket_rows) == 0:
        return
    map_rows = course_bucket_map_df[course_bucket_map_df["track_id"] == track_id]
    mapped_buckets = set(map_rows["bucket_id"].astype(str).str.strip().tolist()) if len(map_rows) > 0 else set()
    for _, brow in bucket_rows.iterrows():
        bid = str(brow["bucket_id"]).strip()
        if bid not in mapped_buckets:
            result.warn(f"Bucket '{bid}' has no course mappings.")


def check_needed_count_satisfiable(
    track_id: str,
    course_bucket_map_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Warn if a bucket's needed_count exceeds the number of mapped courses."""
    bucket_rows = buckets_df[buckets_df["track_id"] == track_id]
    map_rows = course_bucket_map_df[course_bucket_map_df["track_id"] == track_id]
    for _, brow in bucket_rows.iterrows():
        bid = str(brow["bucket_id"]).strip()
        needed = brow.get("needed_count")
        if pd.isna(needed) or needed is None:
            continue
        needed = int(needed)
        mapped_count = len(map_rows[map_rows["bucket_id"] == bid])
        if mapped_count < needed:
            result.warn(
                f"Bucket '{bid}' needs {needed} courses but only {mapped_count} mapped."
            )


def _v2_program_for_track(
    track_id: str,
    programs_df: pd.DataFrame | None,
    track_defs_df: pd.DataFrame | None,
) -> str | None:
    """Resolve program_id for a given track/major id in V2 tables."""
    if programs_df is None or len(programs_df) == 0:
        return None
    tid = str(track_id or "").strip().upper()
    majors = set(programs_df["program_id"].astype(str).str.strip().str.upper().tolist())
    if tid in majors:
        return tid
    if track_defs_df is None or len(track_defs_df) == 0:
        return None
    defs = track_defs_df.copy()
    defs["track_id"] = defs["track_id"].astype(str).str.strip().str.upper()
    defs["program_id"] = defs["program_id"].astype(str).str.strip().str.upper()
    rows = defs[defs["track_id"] == tid]
    if len(rows) == 0:
        return None
    return str(rows.iloc[0]["program_id"])


def check_v2_track_required_refs(
    program_id: str,
    buckets_v2_df: pd.DataFrame,
    track_defs_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Every non-null buckets.track_required must exist in track_definitions."""
    if buckets_v2_df is None or len(buckets_v2_df) == 0:
        return
    if track_defs_df is None:
        track_defs_df = pd.DataFrame()

    b = buckets_v2_df.copy()
    if "program_id" not in b.columns or "track_required" not in b.columns:
        return
    b["program_id"] = b["program_id"].astype(str).str.strip().str.upper()
    b["track_required"] = b["track_required"].fillna("").astype(str).str.strip().str.upper()
    b_prog = b[b["program_id"] == program_id]
    if len(b_prog) == 0:
        return

    valid_track_ids = set()
    if len(track_defs_df) > 0 and "program_id" in track_defs_df.columns and "track_id" in track_defs_df.columns:
        td = track_defs_df.copy()
        td["program_id"] = td["program_id"].astype(str).str.strip().str.upper()
        td["track_id"] = td["track_id"].astype(str).str.strip().str.upper()
        td = td[td["program_id"] == program_id]
        valid_track_ids = set(td["track_id"].tolist())

        duplicates = td["track_id"].value_counts()
        dup_ids = duplicates[duplicates > 1].index.tolist()
        if dup_ids:
            result.error(
                f"track_definitions has duplicate track_id(s) for program '{program_id}': {sorted(dup_ids)}"
            )

    bad = []
    for _, row in b_prog.iterrows():
        req = str(row.get("track_required", "")).strip().upper()
        if not req:
            continue
        if req not in valid_track_ids:
            bad.append((str(row.get("bucket_id", "")).strip(), req))
    if bad:
        result.error(
            "buckets.track_required values not found in track_definitions: "
            + str(sorted(bad))
        )


def check_v2_sub_bucket_parent_refs(
    program_id: str,
    sub_buckets_df: pd.DataFrame,
    buckets_v2_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Every sub_bucket must reference an existing parent bucket in same program."""
    if sub_buckets_df is None or len(sub_buckets_df) == 0:
        return
    if buckets_v2_df is None or len(buckets_v2_df) == 0:
        return
    if "program_id" not in sub_buckets_df.columns or "bucket_id" not in sub_buckets_df.columns:
        return
    if "program_id" not in buckets_v2_df.columns or "bucket_id" not in buckets_v2_df.columns:
        return

    sb = sub_buckets_df.copy()
    sb["program_id"] = sb["program_id"].astype(str).str.strip().str.upper()
    sb["bucket_id"] = sb["bucket_id"].astype(str).str.strip()
    sb = sb[sb["program_id"] == program_id]

    b = buckets_v2_df.copy()
    b["program_id"] = b["program_id"].astype(str).str.strip().str.upper()
    b["bucket_id"] = b["bucket_id"].astype(str).str.strip()
    valid = set(b[b["program_id"] == program_id]["bucket_id"].tolist())

    missing = sorted(set(sb["bucket_id"].tolist()) - valid)
    if missing:
        result.error(
            f"sub_buckets references unknown bucket_id(s) for program '{program_id}': {missing}"
        )


def check_v2_policy_node_refs(
    program_id: str,
    policy_df: pd.DataFrame,
    buckets_v2_df: pd.DataFrame,
    sub_buckets_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Policy node IDs must reference valid bucket/sub_bucket IDs in same program."""
    if policy_df is None or len(policy_df) == 0:
        return
    required_cols = {"program_id", "node_type_a", "node_id_a", "node_type_b", "node_id_b"}
    if not required_cols.issubset(set(policy_df.columns)):
        return

    b_valid = set()
    sb_valid = set()
    if buckets_v2_df is not None and len(buckets_v2_df) > 0 and {"program_id", "bucket_id"}.issubset(set(buckets_v2_df.columns)):
        bb = buckets_v2_df.copy()
        bb["program_id"] = bb["program_id"].astype(str).str.strip().str.upper()
        bb["bucket_id"] = bb["bucket_id"].astype(str).str.strip()
        b_valid = set(bb[bb["program_id"] == program_id]["bucket_id"].tolist())
    if sub_buckets_df is not None and len(sub_buckets_df) > 0 and {"program_id", "sub_bucket_id"}.issubset(set(sub_buckets_df.columns)):
        ss = sub_buckets_df.copy()
        ss["program_id"] = ss["program_id"].astype(str).str.strip().str.upper()
        ss["sub_bucket_id"] = ss["sub_bucket_id"].astype(str).str.strip()
        sb_valid = set(ss[ss["program_id"] == program_id]["sub_bucket_id"].tolist())

    pp = policy_df.copy()
    pp["program_id"] = pp["program_id"].astype(str).str.strip().str.upper()
    pp = pp[pp["program_id"] == program_id]

    bad_refs = []
    for _, row in pp.iterrows():
        for side in ("a", "b"):
            ntype = str(row.get(f"node_type_{side}", "")).strip().lower()
            nid = str(row.get(f"node_id_{side}", "")).strip()
            if not ntype or not nid:
                continue
            if ntype == "bucket" and nid not in b_valid:
                bad_refs.append((ntype, nid))
            if ntype == "sub_bucket" and nid not in sb_valid:
                bad_refs.append((ntype, nid))
            if ntype not in {"bucket", "sub_bucket"}:
                bad_refs.append((ntype, nid))

    if bad_refs:
        result.error(
            f"double_count_policy has invalid node reference(s) for program '{program_id}': {sorted(set(bad_refs))}"
        )


# ── Main validate function ────────────────────────────────────────────────────

def validate_track(
    track_id: str,
    tracks_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    catalog_codes: set[str],
    v2_programs_df: pd.DataFrame | None = None,
    v2_track_definitions_df: pd.DataFrame | None = None,
    v2_buckets_df: pd.DataFrame | None = None,
    v2_sub_buckets_df: pd.DataFrame | None = None,
    v2_double_count_policy_df: pd.DataFrame | None = None,
    strict_single_core: bool = True,
) -> ValidationResult:
    """Run all publish gate checks for a track. Returns a ValidationResult."""
    result = ValidationResult(track_id)

    check_track_exists(track_id, tracks_df, result)
    check_track_parent_major_link(track_id, tracks_df, result)
    check_buckets_exist(track_id, buckets_df, result)
    check_role_policy(track_id, buckets_df, result, strict_single_core=strict_single_core)
    check_mappings_exist(track_id, course_bucket_map_df, result)
    check_no_orphan_courses(track_id, course_bucket_map_df, catalog_codes, result)
    check_no_orphan_buckets(track_id, course_bucket_map_df, buckets_df, result)
    check_all_buckets_have_mappings(track_id, course_bucket_map_df, buckets_df, result)
    check_needed_count_satisfiable(track_id, course_bucket_map_df, buckets_df, result)

    # Commit 2A: optional V2 referential checks (non-breaking for legacy tests).
    program_id = _v2_program_for_track(track_id, v2_programs_df, v2_track_definitions_df)
    if program_id:
        check_v2_track_required_refs(program_id, v2_buckets_df, v2_track_definitions_df, result)
        check_v2_sub_bucket_parent_refs(program_id, v2_sub_buckets_df, v2_buckets_df, result)
        check_v2_policy_node_refs(
            program_id,
            v2_double_count_policy_df,
            v2_buckets_df,
            v2_sub_buckets_df,
            result,
        )

    return result


# ── CLI entry point ───────────────────────────────────────────────────────────

def main(args=None):
    parser = argparse.ArgumentParser(
        description="Validate track data before publishing (active=1).",
    )
    parser.add_argument("--track", type=str, help="Track ID to validate.")
    parser.add_argument("--all", action="store_true", help="Validate all tracks in the workbook.")
    parser.add_argument(
        "--path", type=str,
        default=os.path.join(os.path.dirname(__file__), "..", "marquette_courses_full.xlsx"),
        help="Path to the workbook file.",
    )
    opts = parser.parse_args(args)

    if not opts.track and not opts.all:
        parser.error("Provide --track TRACK_ID or --all.")

    # Import data_loader (add backend/ to path)
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
    sys.path.insert(0, backend_dir)
    from data_loader import load_data

    data = load_data(opts.path)

    v2_program_ids = []
    if data.get("v2_programs_df") is not None and len(data.get("v2_programs_df")) > 0:
        v2_program_ids = (
            data["v2_programs_df"]["program_id"]
            .astype(str).str.strip().str.upper().tolist()
        )

    if opts.all:
        if data.get("v2_detected") and v2_program_ids:
            # Strict V2: validate each major program scope once.
            track_ids = list(dict.fromkeys(v2_program_ids))
        else:
            track_ids = data["tracks_df"]["track_id"].tolist() if len(data["tracks_df"]) > 0 else []
        if not track_ids:
            print("[INFO] No tracks found in workbook.")
            return 0
    else:
        requested = opts.track.strip().upper()
        if data.get("v2_detected") and v2_program_ids:
            mapped_program = _v2_program_for_track(
                requested,
                data.get("v2_programs_df"),
                data.get("v2_track_definitions_df"),
            )
            track_ids = [mapped_program or requested]
        else:
            track_ids = [requested]

    all_passed = True
    for tid in track_ids:
        use_relaxed_core_policy = bool(data.get("v2_detected")) and tid in set(v2_program_ids)
        result = validate_track(
            tid,
            data["tracks_df"],
            data["buckets_df"],
            data["course_bucket_map_df"],
            data["catalog_codes"],
            v2_programs_df=data.get("v2_programs_df"),
            v2_track_definitions_df=data.get("v2_track_definitions_df"),
            v2_buckets_df=data.get("v2_buckets_df"),
            v2_sub_buckets_df=data.get("v2_sub_buckets_df"),
            v2_double_count_policy_df=data.get("v2_double_count_policy_df"),
            strict_single_core=not use_relaxed_core_policy,
        )
        print(result.summary())
        if not result.passed:
            all_passed = False

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
