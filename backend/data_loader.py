import sys
import pandas as pd
from prereq_parser import parse_prereqs


_BOOL_TRUTHY = {"true", "1", "yes", "y"}


def _safe_bool_col(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """Normalize a boolean column to Python bool regardless of Excel format.

    Handles: Python bool, Excel int/float (1/0), and string variants
    (TRUE/FALSE, true/false, 1/0, yes/no, y/n). NaN → False.
    """
    def _coerce(x):
        if pd.isna(x):
            return False
        if isinstance(x, bool):
            return x
        if isinstance(x, (int, float)):
            return bool(x)
        return str(x).strip().lower() in _BOOL_TRUTHY

    if col in df.columns:
        df[col] = df[col].apply(_coerce)
    return df


def load_data(data_path: str) -> dict:
    """Load and parse the course data workbook. Raises on file/schema errors."""
    xl = pd.ExcelFile(data_path)
    sheet_names = xl.sheet_names

    courses_df = xl.parse("courses")
    equivalencies_df = xl.parse("equivalencies") if "equivalencies" in sheet_names else pd.DataFrame()
    buckets_df = xl.parse("buckets")

    # ── Bucket map: 4-level fallback chain ─────────────────────────────────
    if "course_bucket" in sheet_names:
        course_bucket_map_df = xl.parse("course_bucket")
        _map_source = "course_bucket"
    elif "bucket_course_map" in sheet_names:
        course_bucket_map_df = xl.parse("bucket_course_map")
        _map_source = "bucket_course_map"
    elif any("bucket" in s.lower() and "map" in s.lower() for s in sheet_names):
        sheet = next(s for s in sheet_names if "bucket" in s.lower() and "map" in s.lower())
        course_bucket_map_df = xl.parse(sheet)
        _map_source = sheet
    else:
        # Last resort: derive normalized rows from courses.bucket1..bucket4.
        # Read active track from tracks sheet; handle program_id→track_id rename.
        default_track = "FIN_MAJOR"
        if "tracks" in sheet_names:
            tracks_df = xl.parse("tracks")
            if "track_id" not in tracks_df.columns and "program_id" in tracks_df.columns:
                tracks_df = tracks_df.rename(columns={"program_id": "track_id"})
            if "active" in tracks_df.columns:
                active_rows = tracks_df[tracks_df["active"].apply(
                    lambda x: str(x).strip().lower() in _BOOL_TRUTHY if pd.notna(x) else False
                )]
                if len(active_rows) > 0:
                    default_track = str(active_rows.iloc[0]["track_id"])
        rows = []
        for _, row in courses_df.iterrows():
            for col in ["bucket1", "bucket2", "bucket3", "bucket4"]:
                val = row.get(col)
                if pd.notna(val) and str(val).strip():
                    rows.append({
                        "track_id": default_track,
                        "course_code": row["course_code"],
                        "bucket_id": str(val).strip(),
                    })
        course_bucket_map_df = pd.DataFrame(rows) if rows else pd.DataFrame(
            columns=["track_id", "course_code", "bucket_id"]
        )
        _map_source = f"derived:bucket1..bucket4 (track={default_track})"

    print(f"[INFO] Bucket map source: {_map_source}")

    # Backward/forward compatibility for workbook schema naming.
    if "track_id" not in buckets_df.columns and "program_id" in buckets_df.columns:
        buckets_df = buckets_df.rename(columns={"program_id": "track_id"})
    if "track_id" not in course_bucket_map_df.columns and "program_id" in course_bucket_map_df.columns:
        course_bucket_map_df = course_bucket_map_df.rename(columns={"program_id": "track_id"})

    # Normalize bool columns
    for col in ["offered_fall", "offered_spring", "offered_summer"]:
        courses_df = _safe_bool_col(courses_df, col)
    buckets_df = _safe_bool_col(buckets_df, "allow_double_count")

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
