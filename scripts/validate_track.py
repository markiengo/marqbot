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


# ── V3.1 Governance checks ────────────────────────────────────────────────────

def check_v2_sub_bucket_courses_required_satisfiable(
    program_id: str,
    v2_sub_buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Warn if a V2 sub-bucket's courses_required exceeds the count of mapped courses.

    In V2 mode the runtime course_bucket_map_df uses sub_bucket_id as bucket_id
    with track_id equal to the parent program_id.
    """
    if v2_sub_buckets_df is None or len(v2_sub_buckets_df) == 0:
        return
    if "courses_required" not in v2_sub_buckets_df.columns:
        return

    sb = v2_sub_buckets_df.copy()
    sb["program_id"] = sb["program_id"].astype(str).str.strip().str.upper()
    sb = sb[sb["program_id"] == program_id]
    if len(sb) == 0:
        return

    cmap = course_bucket_map_df.copy()
    cmap["track_id"] = cmap["track_id"].astype(str).str.strip().str.upper()
    cmap["bucket_id"] = cmap["bucket_id"].astype(str).str.strip()
    program_map = cmap[cmap["track_id"] == program_id]

    for _, row in sb.iterrows():
        sbid = str(row.get("sub_bucket_id", "")).strip()
        cr = row.get("courses_required")
        if pd.isna(cr) or cr is None:
            continue
        required = int(cr)
        if required <= 0:
            continue
        mapped_count = len(program_map[program_map["bucket_id"] == sbid])
        if mapped_count < required:
            result.warn(
                f"sub_bucket '{sbid}' requires {required} courses "
                f"but only {mapped_count} are mapped in courses_all_buckets."
            )

def _canon_pair_validate(
    type_a: str, id_a: str, type_b: str, id_b: str
) -> tuple:
    """Return a canonically ordered pair for duplicate-row detection."""
    a = (str(type_a).strip().lower(), str(id_a).strip())
    b = (str(type_b).strip().lower(), str(id_b).strip())
    return (a, b) if a <= b else (b, a)


def check_v2_sub_bucket_null_requirements(
    program_id: str,
    sub_buckets_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Error when both courses_required and credits_required are null for a sub-bucket.

    A sub-bucket with no requirement definition can never be satisfied, making the
    program requirement structurally unsatisfiable.
    """
    if sub_buckets_df is None or len(sub_buckets_df) == 0:
        return
    if "program_id" not in sub_buckets_df.columns or "sub_bucket_id" not in sub_buckets_df.columns:
        return

    sb = sub_buckets_df.copy()
    sb["program_id"] = sb["program_id"].astype(str).str.strip().str.upper()
    sb = sb[sb["program_id"] == program_id]
    if len(sb) == 0:
        return

    has_cr = "courses_required" in sb.columns
    has_cd = "credits_required" in sb.columns

    for _, row in sb.iterrows():
        sbid = str(row.get("sub_bucket_id", "")).strip()
        cr_null = not has_cr or pd.isna(row.get("courses_required"))
        cd_null = not has_cd or pd.isna(row.get("credits_required"))
        if cr_null and cd_null:
            result.error(
                f"sub_bucket '{sbid}' in program '{program_id}' has both "
                "courses_required and credits_required as null. "
                "At least one must be set for the requirement to be satisfiable."
            )


def check_v2_policy_duplicate_pairs(
    program_id: str,
    policy_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Warn if duplicate canonical policy pairs exist after normalization.

    Duplicate policy rows create ambiguity — the last row wins silently, which
    can mask authoring mistakes.
    """
    if policy_df is None or len(policy_df) == 0:
        return
    required_cols = {"program_id", "node_type_a", "node_id_a", "node_type_b", "node_id_b"}
    if not required_cols.issubset(set(policy_df.columns)):
        return

    pp = policy_df.copy()
    pp["program_id"] = pp["program_id"].astype(str).str.strip().str.upper()
    pp = pp[pp["program_id"] == program_id]
    if len(pp) == 0:
        return

    seen: set = set()
    duplicates: list = []
    for _, row in pp.iterrows():
        key = _canon_pair_validate(
            str(row.get("node_type_a", "")),
            str(row.get("node_id_a", "")),
            str(row.get("node_type_b", "")),
            str(row.get("node_id_b", "")),
        )
        if key in seen:
            duplicates.append(key)
        seen.add(key)

    if duplicates:
        unique_dups = sorted(set(str(d) for d in duplicates))
        result.warn(
            f"double_count_policy has {len(set(duplicates))} duplicate canonical "
            f"pair(s) for program '{program_id}': {unique_dups}"
        )


def check_v2_equivalency_scope_integrity(
    program_id: str,
    equivalencies_df: pd.DataFrame,
    programs_v2_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Error if course_equivalencies references a scope_program_id that does not exist.

    Program-scoped equivalencies must reference an actual program so that the
    runtime can correctly apply the scope restriction.
    """
    if equivalencies_df is None or len(equivalencies_df) == 0:
        return
    if "scope_program_id" not in equivalencies_df.columns:
        return  # Global-only equivalencies — scope check not applicable.

    eq = equivalencies_df.copy()
    eq["scope_program_id"] = (
        eq["scope_program_id"].fillna("").astype(str).str.strip().str.upper()
    )
    scoped = eq[eq["scope_program_id"] != ""]
    if len(scoped) == 0:
        return

    valid_ids: set = set()
    if (
        programs_v2_df is not None
        and len(programs_v2_df) > 0
        and "program_id" in programs_v2_df.columns
    ):
        valid_ids = set(
            programs_v2_df["program_id"].astype(str).str.strip().str.upper().tolist()
        )

    bad = sorted(set(scoped["scope_program_id"].tolist()) - valid_ids)
    if bad:
        result.error(
            f"course_equivalencies has scope_program_id value(s) not in programs: {bad}"
        )


def _v2_program_for_track(
    track_id: str,
    programs_df: pd.DataFrame | None,
    _track_defs_df_unused: pd.DataFrame | None = None,
) -> str | None:
    """Resolve parent major program_id for a given major/track id in V2 programs."""
    if programs_df is None or len(programs_df) == 0:
        return None
    programs = programs_df.copy()
    if "program_id" not in programs.columns:
        return None
    programs["program_id"] = programs["program_id"].astype(str).str.strip().str.upper()
    if "kind" not in programs.columns:
        programs["kind"] = "major"
    programs["kind"] = programs["kind"].fillna("major").astype(str).str.strip().str.lower()
    if "parent_major_id" not in programs.columns:
        programs["parent_major_id"] = ""
    programs["parent_major_id"] = (
        programs["parent_major_id"].fillna("").astype(str).str.strip().str.upper()
    )

    tid = str(track_id or "").strip().upper()
    majors = set(programs[programs["kind"] == "major"]["program_id"].tolist())
    if tid in majors:
        return tid
    tracks = programs[programs["kind"] == "track"]
    rows = tracks[tracks["program_id"] == tid]
    if len(rows) == 0:
        return None
    return str(rows.iloc[0]["parent_major_id"] or "").strip().upper() or None


def check_v2_track_required_refs(
    program_id: str,
    buckets_v2_df: pd.DataFrame,
    programs_v2_df: pd.DataFrame,
    result: ValidationResult,
) -> None:
    """Every non-null buckets.track_required must exist as a track under this major."""
    if buckets_v2_df is None or len(buckets_v2_df) == 0:
        return
    if programs_v2_df is None:
        programs_v2_df = pd.DataFrame()

    b = buckets_v2_df.copy()
    if "program_id" not in b.columns or "track_required" not in b.columns:
        return
    b["program_id"] = b["program_id"].astype(str).str.strip().str.upper()
    b["track_required"] = b["track_required"].fillna("").astype(str).str.strip().str.upper()
    b_prog = b[b["program_id"] == program_id]
    if len(b_prog) == 0:
        return

    valid_track_ids = set()
    if len(programs_v2_df) > 0 and "program_id" in programs_v2_df.columns:
        p = programs_v2_df.copy()
        if "kind" not in p.columns:
            p["kind"] = "major"
        if "parent_major_id" not in p.columns:
            p["parent_major_id"] = ""
        p["program_id"] = p["program_id"].astype(str).str.strip().str.upper()
        p["kind"] = p["kind"].fillna("major").astype(str).str.strip().str.lower()
        p["parent_major_id"] = p["parent_major_id"].fillna("").astype(str).str.strip().str.upper()
        td = p[(p["kind"] == "track") & (p["parent_major_id"] == program_id)]
        valid_track_ids = set(td["program_id"].tolist())

        duplicates = td["program_id"].value_counts()
        dup_ids = duplicates[duplicates > 1].index.tolist()
        if dup_ids:
            result.error(
                f"programs has duplicate track IDs for major '{program_id}': {sorted(dup_ids)}"
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
            "buckets.track_required values not found in programs(kind=track): "
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


# ── Policy matrix printer ─────────────────────────────────────────────────────

def print_policy_matrix(
    program_id: str,
    v2_sub_buckets_df: "pd.DataFrame | None",
    v2_double_count_policy_df: "pd.DataFrame | None",
    backend_dir: str,
) -> None:
    """Print the effective double-count policy for every sub-bucket pair.

    Reuses resolver helpers from backend/requirements.py so the output always
    reflects what the allocator will actually do at runtime.

    Source labels:
      explicit sub_bucket     -- explicit row with node_type = sub_bucket
      explicit bucket         -- explicit row on the parent bucket pair
      hierarchy same-parent   -- default deny (two sub-buckets share a parent)
      hierarchy different-parent -- default allow (different parent buckets)
    """
    import sys as _sys
    if backend_dir not in _sys.path:
        _sys.path.insert(0, backend_dir)
    from requirements import _build_policy_lookup, _canon_node_pair  # type: ignore[import]

    policy_df = v2_double_count_policy_df if v2_double_count_policy_df is not None else pd.DataFrame()
    policy_lookup = _build_policy_lookup(policy_df, program_id)

    parent_map: dict[str, str] = {}
    if v2_sub_buckets_df is not None and len(v2_sub_buckets_df) > 0:
        sb = v2_sub_buckets_df.copy()
        sb["program_id"] = sb["program_id"].astype(str).str.strip().str.upper()
        sb = sb[sb["program_id"] == program_id]
        for _, row in sb.iterrows():
            sbid = str(row.get("sub_bucket_id", "")).strip()
            bid = str(row.get("bucket_id", "")).strip()
            if sbid and bid:
                parent_map[sbid] = bid

    sub_bucket_ids = sorted(parent_map.keys())
    if not sub_bucket_ids:
        print(f"  [INFO] No sub-buckets found for program '{program_id}'.")
        return

    n = len(sub_bucket_ids)
    total_pairs = n * (n - 1) // 2
    print(f"\nEffective double-count policy for {program_id} ({n} sub-buckets, {total_pairs} pairs):\n")

    w1, w2, w3 = 24, 24, 8
    print(f"  {'sub_bucket_a':<{w1}}  {'sub_bucket_b':<{w2}}  {'decision':<{w3}}  source")
    print(f"  {'─' * w1}  {'─' * w2}  {'─' * w3}  {'─' * 45}")

    for i in range(n):
        for j in range(i + 1, n):
            a = sub_bucket_ids[i]
            b = sub_bucket_ids[j]

            sub_key = _canon_node_pair("sub_bucket", a, "sub_bucket", b)
            if sub_key in policy_lookup:
                allowed = bool(policy_lookup[sub_key])
                source = "explicit sub_bucket"
            else:
                parent_a = parent_map.get(a)
                parent_b = parent_map.get(b)
                if parent_a and parent_b:
                    bucket_key = _canon_node_pair("bucket", parent_a, "bucket", parent_b)
                    if bucket_key in policy_lookup:
                        allowed = bool(policy_lookup[bucket_key])
                        source = "explicit bucket"
                    elif parent_a == parent_b:
                        allowed = False
                        source = f"hierarchy same-parent ({parent_a})"
                    else:
                        allowed = True
                        source = "hierarchy different-parent"
                else:
                    allowed = True
                    source = "hierarchy different-parent"

            decision = "ALLOW" if allowed else "DENY"
            print(f"  {a:<{w1}}  {b:<{w2}}  {decision:<{w3}}  {source}")
    print()


# ── Main validate function ────────────────────────────────────────────────────

def validate_track(
    track_id: str,
    tracks_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    catalog_codes: set[str],
    v2_programs_df: pd.DataFrame | None = None,
    v2_track_definitions_df: pd.DataFrame | None = None,  # kept for backward compatibility
    v2_buckets_df: pd.DataFrame | None = None,
    v2_sub_buckets_df: pd.DataFrame | None = None,
    v2_double_count_policy_df: pd.DataFrame | None = None,
    v2_equivalencies_df: pd.DataFrame | None = None,
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

    # V2 referential checks (non-breaking for legacy tests).
    program_id = _v2_program_for_track(track_id, v2_programs_df, v2_track_definitions_df)
    if program_id:
        check_v2_track_required_refs(program_id, v2_buckets_df, v2_programs_df, result)
        check_v2_sub_bucket_parent_refs(program_id, v2_sub_buckets_df, v2_buckets_df, result)
        check_v2_policy_node_refs(
            program_id,
            v2_double_count_policy_df,
            v2_buckets_df,
            v2_sub_buckets_df,
            result,
        )
        # V3.1 governance checks.
        check_v2_sub_bucket_null_requirements(program_id, v2_sub_buckets_df, result)
        check_v2_sub_bucket_courses_required_satisfiable(
            program_id, v2_sub_buckets_df, course_bucket_map_df, result
        )
        check_v2_policy_duplicate_pairs(program_id, v2_double_count_policy_df, result)
        check_v2_equivalency_scope_integrity(
            program_id, v2_equivalencies_df, v2_programs_df, result
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
    parser.add_argument(
        "--policy-matrix", action="store_true",
        help="Print effective double-count policy for every sub-bucket pair.",
    )
    opts = parser.parse_args(args)

    if not opts.track and not opts.all:
        parser.error("Provide --track TRACK_ID or --all.")

    # Import data_loader (add backend/ to path)
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
    backend_dir = os.path.normpath(backend_dir)
    sys.path.insert(0, backend_dir)
    from data_loader import load_data

    data = load_data(opts.path)

    v2_major_ids: list[str] = []
    if data.get("v2_programs_df") is not None and len(data.get("v2_programs_df")) > 0:
        progs = data["v2_programs_df"].copy()
        if "kind" not in progs.columns:
            progs["kind"] = "major"
        progs["kind"] = progs["kind"].fillna("major").astype(str).str.strip().str.lower()
        progs["program_id"] = progs["program_id"].astype(str).str.strip().str.upper()
        v2_major_ids = progs[progs["kind"] == "major"]["program_id"].tolist()

    if opts.all:
        if data.get("v2_detected") and v2_major_ids:
            # Strict V2: validate each major program scope once.
            track_ids = list(dict.fromkeys(v2_major_ids))
        else:
            track_ids = data["tracks_df"]["track_id"].tolist() if len(data["tracks_df"]) > 0 else []
        if not track_ids:
            print("[INFO] No tracks found in workbook.")
            return 0
    else:
        requested = opts.track.strip().upper()
        if data.get("v2_detected") and v2_major_ids:
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
        use_relaxed_core_policy = bool(data.get("v2_detected")) and tid in set(v2_major_ids)
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
            v2_equivalencies_df=data.get("equivalencies_df"),
            strict_single_core=not use_relaxed_core_policy,
        )
        print(result.summary())
        if not result.passed:
            all_passed = False

    if opts.policy_matrix:
        for tid in track_ids:
            print_policy_matrix(
                tid,
                data.get("v2_sub_buckets_df"),
                data.get("v2_double_count_policy_df"),
                backend_dir,
            )

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
