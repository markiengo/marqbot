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


def check_role_policy(track_id: str, buckets_df: pd.DataFrame, result: ValidationResult) -> None:
    """Exactly one core bucket and at least one elective bucket required."""
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
    elif core_count > 1:
        result.error(
            f"Expected exactly 1 core bucket for track '{track_id}', found {core_count}: "
            f"{track_buckets[track_buckets['role'] == 'core']['bucket_id'].tolist()}"
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


# ── Main validate function ────────────────────────────────────────────────────

def validate_track(
    track_id: str,
    tracks_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    catalog_codes: set[str],
) -> ValidationResult:
    """Run all publish gate checks for a track. Returns a ValidationResult."""
    result = ValidationResult(track_id)

    check_track_exists(track_id, tracks_df, result)
    check_track_parent_major_link(track_id, tracks_df, result)
    check_buckets_exist(track_id, buckets_df, result)
    check_role_policy(track_id, buckets_df, result)
    check_mappings_exist(track_id, course_bucket_map_df, result)
    check_no_orphan_courses(track_id, course_bucket_map_df, catalog_codes, result)
    check_no_orphan_buckets(track_id, course_bucket_map_df, buckets_df, result)
    check_all_buckets_have_mappings(track_id, course_bucket_map_df, buckets_df, result)
    check_needed_count_satisfiable(track_id, course_bucket_map_df, buckets_df, result)

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

    if opts.all:
        track_ids = data["tracks_df"]["track_id"].tolist() if len(data["tracks_df"]) > 0 else []
        if not track_ids:
            print("[INFO] No tracks found in workbook.")
            return 0
    else:
        track_ids = [opts.track.strip().upper()]

    all_passed = True
    for tid in track_ids:
        result = validate_track(
            tid,
            data["tracks_df"],
            data["buckets_df"],
            data["course_bucket_map_df"],
            data["catalog_codes"],
        )
        print(result.summary())
        if not result.passed:
            all_passed = False

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
