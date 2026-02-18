import sys
import pandas as pd
from prereq_parser import parse_prereqs


def _safe_bool_col(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """Normalize a boolean column to Python bool regardless of Excel format."""
    if col in df.columns:
        df[col] = df[col].apply(
            lambda x: str(x).strip().upper() == "TRUE" if pd.notna(x) else False
        )
    return df


def load_data(data_path: str) -> dict:
    """Load and parse the course data workbook. Raises on file/schema errors."""
    xl = pd.ExcelFile(data_path)
    sheet_names = xl.sheet_names

    courses_df = xl.parse("courses")
    equivalencies_df = xl.parse("equivalencies") if "equivalencies" in sheet_names else pd.DataFrame()
    buckets_df = xl.parse("buckets")
    course_bucket_map_df = xl.parse(
        "bucket_course_map"
        if "bucket_course_map" in sheet_names
        else next(s for s in sheet_names if "bucket" in s.lower() and "map" in s.lower())
    )

    # Backward/forward compatibility for workbook schema naming.
    if "track_id" not in buckets_df.columns and "program_id" in buckets_df.columns:
        buckets_df = buckets_df.rename(columns={"program_id": "track_id"})
    if "track_id" not in course_bucket_map_df.columns and "program_id" in course_bucket_map_df.columns:
        course_bucket_map_df = course_bucket_map_df.rename(columns={"program_id": "track_id"})

    # Normalize bool columns
    for col in ["offered_fall", "offered_spring", "offered_summer"]:
        courses_df = _safe_bool_col(courses_df, col)
    for col in ["can_double_count", "is_required"]:
        course_bucket_map_df = _safe_bool_col(course_bucket_map_df, col)
    for col in ["allow_double_count"]:
        buckets_df = _safe_bool_col(buckets_df, col)

    # Ensure string columns are clean
    courses_df["course_code"] = courses_df["course_code"].astype(str).str.strip()
    courses_df["prereq_hard"] = courses_df.get("prereq_hard", pd.Series(dtype=str)).fillna("none")
    courses_df["prereq_soft"] = courses_df.get("prereq_soft", pd.Series(dtype=str)).fillna("")

    # Build course catalog set
    catalog_codes = set(courses_df["course_code"].tolist())

    # Build prereq map: course_code → parsed prereq dict
    prereq_map: dict = {}
    for _, row in courses_df.iterrows():
        code = row["course_code"]
        prereq_map[code] = parse_prereqs(row.get("prereq_hard", "none"))

    # ── Startup data integrity checks ──────────────────────────────────────
    map_codes = set(course_bucket_map_df["course_code"].astype(str).str.strip().tolist())
    orphaned = map_codes - catalog_codes
    if orphaned:
        print(f"[WARN] {len(orphaned)} course(s) in bucket_course_map not found in courses sheet: {sorted(orphaned)}")

    map_buckets = set(course_bucket_map_df["bucket_id"].astype(str).str.strip().tolist())
    defined_buckets = set(buckets_df["bucket_id"].astype(str).str.strip().tolist())
    orphaned_buckets = map_buckets - defined_buckets
    if orphaned_buckets:
        print(f"[WARN] {len(orphaned_buckets)} bucket_id(s) in map not found in buckets sheet: {sorted(orphaned_buckets)}")

    unsupported = [code for code, p in prereq_map.items() if p["type"] == "unsupported"]
    if unsupported:
        print(f"[WARN] {len(unsupported)} course(s) have unsupported prereq format (manual review required): {sorted(unsupported)}")

    return {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_bucket_map_df,
        "catalog_codes": catalog_codes,
        "prereq_map": prereq_map,
    }
