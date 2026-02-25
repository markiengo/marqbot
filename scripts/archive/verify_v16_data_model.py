"""
Verify v1.6.0 workbook data-model migration.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

import pandas as pd


DEFAULT_WORKBOOK = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "marquette_courses_full.xlsx",
)

TRACK_SUFFIX = "_TRACK"
EXPECTED_FIN_CORE = {"FINA 3001", "FINA 4001", "FINA 4011"}
SEMESTER_HEADER_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)
REQUIRED_POLICY_COLUMNS = {
    "program_id",
    "sub_bucket_id_a",
    "sub_bucket_id_b",
    "allow_double_count",
    "reason",
}


def _norm(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.strip().str.upper()


def _as_bool(value) -> bool:
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _fail(msg: str, failures: list[str]) -> None:
    failures.append(msg)
    print(f"[FAIL] {msg}")


def _ok(msg: str) -> None:
    print(f"[OK]   {msg}")


def verify_workbook(path: str) -> int:
    workbook = os.path.abspath(path)
    if not os.path.exists(workbook):
        print(f"[FAIL] Workbook not found: {workbook}")
        return 1

    xl = pd.ExcelFile(workbook)
    failures: list[str] = []

    required_sheets = {
        "programs",
        "buckets",
        "sub_buckets",
        "courses_all_buckets",
        "course_prereqs",
        "course_offerings",
        "course_equivalencies",
        "double_count_policy",
    }
    missing = sorted(required_sheets - set(xl.sheet_names))
    if missing:
        _fail(f"Missing required sheet(s): {missing}", failures)
        print(f"\nSummary: {len(failures)} failure(s).")
        return 1

    programs = xl.parse("programs")
    buckets = xl.parse("buckets")
    sub_buckets = xl.parse("sub_buckets")
    map_df = xl.parse("courses_all_buckets")
    prereqs = xl.parse("course_prereqs")
    offerings = xl.parse("course_offerings")
    equivalencies = xl.parse("course_equivalencies")
    policy = xl.parse("double_count_policy")

    # programs checks
    if "applies_to_all" not in programs.columns:
        _fail("programs.applies_to_all column missing", failures)
    else:
        _ok("programs.applies_to_all column exists")

    program_id = _norm(programs.get("program_id", pd.Series(dtype=str)))
    kind = programs.get("kind", "major").fillna("major").astype(str).str.strip().str.lower()
    is_track = kind == "track"
    bad_track_ids = sorted(
        {
            pid for pid in program_id[is_track].tolist()
            if pid and not pid.endswith(TRACK_SUFFIX)
        }
    )
    if bad_track_ids:
        _fail(f"Track program_id rows missing _TRACK suffix: {bad_track_ids}", failures)
    else:
        _ok("All track program_id values use *_TRACK suffix")

    bcc_core_rows = programs[program_id == "BCC_CORE"]
    if len(bcc_core_rows) != 1:
        _fail(f"Expected one BCC_CORE row in programs; found {len(bcc_core_rows)}", failures)
    else:
        applies = bcc_core_rows.iloc[0].get("applies_to_all", False)
        if not _as_bool(applies):
            _fail("BCC_CORE.applies_to_all is not TRUE", failures)
        else:
            _ok("BCC_CORE exists with applies_to_all=TRUE")

    # BCC ownership checks
    buckets_pid = _norm(buckets.get("program_id", pd.Series(dtype=str)))
    bucket_id = _norm(buckets.get("bucket_id", pd.Series(dtype=str)))
    bcc_bucket_rows = buckets[bucket_id == "BCC"]
    bad_bcc_bucket_programs = sorted(set(_norm(bcc_bucket_rows.get("program_id", pd.Series(dtype=str))).tolist()) - {"BCC_CORE"})
    if bad_bcc_bucket_programs:
        _fail(f"BCC bucket still owned by non-BCC_CORE programs: {bad_bcc_bucket_programs}", failures)
    else:
        _ok("BCC bucket ownership moved to BCC_CORE")

    sub_pid = _norm(sub_buckets.get("program_id", pd.Series(dtype=str)))
    sub_id = _norm(sub_buckets.get("sub_bucket_id", pd.Series(dtype=str)))
    bcc_sub_rows = sub_buckets[sub_id.str.startswith("BCC_")]
    bad_sub_programs = sorted(set(_norm(bcc_sub_rows.get("program_id", pd.Series(dtype=str))).tolist()) - {"BCC_CORE"})
    if bad_sub_programs:
        _fail(f"BCC sub-buckets still owned by non-BCC_CORE programs: {bad_sub_programs}", failures)
    else:
        _ok("BCC sub-buckets owned only by BCC_CORE")

    map_pid = _norm(map_df.get("program_id", pd.Series(dtype=str)))
    map_sub = _norm(map_df.get("sub_bucket_id", pd.Series(dtype=str)))
    bcc_map_rows = map_df[map_sub.str.startswith("BCC_")]
    bad_map_programs = sorted(set(_norm(bcc_map_rows.get("program_id", pd.Series(dtype=str))).tolist()) - {"BCC_CORE"})
    if bad_map_programs:
        _fail(f"BCC courses_all_buckets rows still owned by non-BCC_CORE programs: {bad_map_programs}", failures)
    else:
        _ok("BCC courses_all_buckets ownership moved to BCC_CORE")

    # Track-required references
    if "track_required" in buckets.columns:
        track_required_values = _norm(buckets["track_required"])
        bad_track_required = sorted(
            {
                v for v in track_required_values.tolist()
                if v and not v.endswith(TRACK_SUFFIX)
            }
        )
        if bad_track_required:
            _fail(f"buckets.track_required has non-*_TRACK values: {bad_track_required}", failures)
        else:
            _ok("buckets.track_required values are normalized to *_TRACK")

    # FIN_CORE composition
    map_course = _norm(map_df.get("course_code", pd.Series(dtype=str)))
    fin_core_rows = map_df[
        (map_pid == "FIN_MAJOR") & (map_sub == "FIN_CORE")
    ]
    fin_core_set = set(_norm(fin_core_rows.get("course_code", pd.Series(dtype=str))).tolist())
    if fin_core_set != EXPECTED_FIN_CORE:
        _fail(f"FIN_MAJOR::FIN_CORE mismatch: got {sorted(fin_core_set)}, expected {sorted(EXPECTED_FIN_CORE)}", failures)
    else:
        _ok("FIN_MAJOR::FIN_CORE has expected 3-course composition")

    # course_equivalencies checks
    if "course_name" not in equivalencies.columns:
        _fail("course_equivalencies.course_name column missing", failures)
    else:
        names = equivalencies["course_name"].fillna("").astype(str).str.strip()
        if (names == "").any():
            _fail("course_equivalencies.course_name has blank values", failures)
        else:
            _ok("course_equivalencies.course_name is populated")

    if "restriction_note" in equivalencies.columns:
        _fail("course_equivalencies.restriction_note should be removed after migration", failures)
    else:
        _ok("course_equivalencies.restriction_note removed")

    scope_vals = _norm(equivalencies.get("program_scope", pd.Series(dtype=str)))
    bad_scope = sorted({v for v in scope_vals.tolist() if v and v != "FIN_MAJOR"})
    if bad_scope:
        _fail(f"course_equivalencies.program_scope has non-FIN_MAJOR values: {bad_scope}", failures)
    else:
        _ok("course_equivalencies.program_scope scoped to FIN_MAJOR")

    # course_prereqs checks
    if "concurrent_with" in prereqs.columns:
        concurrent = prereqs["concurrent_with"].fillna("").astype(str).str.strip().str.lower()
        if (concurrent == "none").any():
            _fail("course_prereqs.concurrent_with still contains literal 'none'", failures)
        else:
            _ok("course_prereqs.concurrent_with normalized (no literal 'none')")

    # course_offerings checks
    if "term_code" in offerings.columns or "offered" in offerings.columns:
        _fail("course_offerings still uses legacy normalized columns (term_code/offered)", failures)
    else:
        _ok("course_offerings no longer uses normalized row-per-term schema")

    semester_cols = [c for c in offerings.columns if SEMESTER_HEADER_RE.match(str(c or "").strip())]
    if not semester_cols:
        _fail("course_offerings has no literal semester columns (e.g., 'Fall 2025')", failures)
    else:
        _ok(f"course_offerings has {len(semester_cols)} literal semester column(s)")
        bad_cells = 0
        for col in semester_cols:
            vals = offerings[col]
            bad_cells += sum(
                1
                for v in vals
                if not (
                    pd.isna(v)
                    or isinstance(v, bool)
                    or (isinstance(v, (int, float)) and v in (0, 1))
                    or str(v).strip().lower() in {"true", "false", "0", "1", ""}
                )
            )
        if bad_cells > 0:
            _fail(f"course_offerings contains {bad_cells} non-boolean semester payload value(s)", failures)
        else:
            _ok("course_offerings semester payload values are boolean-like")

    # double_count_policy checks
    actual_policy_cols = set(policy.columns)
    if actual_policy_cols != REQUIRED_POLICY_COLUMNS:
        _fail(
            "double_count_policy columns mismatch. "
            f"Expected {sorted(REQUIRED_POLICY_COLUMNS)}, got {sorted(actual_policy_cols)}",
            failures,
        )
    else:
        _ok("double_count_policy uses simplified sub-bucket pair schema")
        if len(policy) > 0:
            pid = _norm(policy["program_id"])
            a = _norm(policy["sub_bucket_id_a"])
            b = _norm(policy["sub_bucket_id_b"])
            if (pid == "").any() or (a == "").any() or (b == "").any():
                _fail("double_count_policy has blank program_id/sub_bucket_id values", failures)
            else:
                _ok("double_count_policy rows have non-empty IDs")

    if failures:
        print(f"\nSummary: {len(failures)} failure(s).")
        return 1
    print("\nSummary: PASS")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify v1.6 workbook migration.")
    parser.add_argument("--path", default=DEFAULT_WORKBOOK, help="Path to workbook.")
    args = parser.parse_args(argv)
    return verify_workbook(args.path)


if __name__ == "__main__":
    raise SystemExit(main())
