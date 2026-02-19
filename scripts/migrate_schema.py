"""
One-time migration: add normalized `course_bucket` sheet to the workbook.

Reads bucket1..bucket4 columns from the `courses` sheet and writes a new
`course_bucket` sheet with schema: track_id | course_code | bucket_id

The active track is read from the `tracks` sheet (first row where active=1/true).
Falls back to FIN_MAJOR if tracks sheet is absent or has no active row.

Existing sheets are preserved. The old bucket1..bucket4 columns stay on `courses`
as deprecated — remove them manually after confirming the new sheet is correct.

Usage:
    python scripts/migrate_schema.py
    python scripts/migrate_schema.py --path path/to/other.xlsx
    python scripts/migrate_schema.py --dry-run
"""

import argparse
import os
import sys

try:
    import openpyxl
    import pandas as pd
except ImportError as e:
    sys.exit(f"Missing dependency: {e}. Run: pip install openpyxl pandas")


_BOOL_TRUTHY = {"true", "1", "yes", "y"}
DEFAULT_WORKBOOK = os.path.join(
    os.path.dirname(__file__), "..", "marquette_courses_full.xlsx"
)


def _coerce_bool(x) -> bool:
    if x is None:
        return False
    try:
        import math
        if isinstance(x, float) and math.isnan(x):
            return False
    except Exception:
        pass
    if isinstance(x, bool):
        return x
    if isinstance(x, (int, float)):
        return bool(x)
    return str(x).strip().lower() in _BOOL_TRUTHY


def resolve_active_track(wb: openpyxl.Workbook) -> str:
    """Return the track_id of the first active track, or 'FIN_MAJOR' as fallback."""
    if "tracks" not in wb.sheetnames:
        return "FIN_MAJOR"

    ws = wb["tracks"]
    headers = [str(c.value).strip() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]

    # Handle program_id → track_id rename
    track_col = None
    active_col = None
    for i, h in enumerate(headers):
        if h in ("track_id", "program_id"):
            track_col = i
        if h == "active":
            active_col = i

    if track_col is None:
        return "FIN_MAJOR"

    for row in ws.iter_rows(min_row=2, values_only=True):
        if active_col is not None and not _coerce_bool(row[active_col]):
            continue
        track_val = row[track_col]
        if track_val is not None:
            return str(track_val).strip()

    return "FIN_MAJOR"


def extract_bucket_rows(wb: openpyxl.Workbook, track_id: str) -> list[dict]:
    """Read courses sheet and extract normalized bucket rows from bucket1..bucket4."""
    if "courses" not in wb.sheetnames:
        sys.exit("[ERROR] No 'courses' sheet found in workbook.")

    ws = wb["courses"]
    headers = [str(c.value).strip() if c.value else "" for c in next(ws.iter_rows(min_row=1, max_row=1))]

    code_col = next((i for i, h in enumerate(headers) if h == "course_code"), None)
    if code_col is None:
        sys.exit("[ERROR] 'courses' sheet has no 'course_code' column.")

    bucket_cols = {col: i for i, col in enumerate(headers) if col in ("bucket1", "bucket2", "bucket3", "bucket4")}
    if not bucket_cols:
        print("[WARN] No bucket1..bucket4 columns found in courses sheet. Nothing to migrate.")
        return []

    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        code = row[code_col]
        if code is None:
            continue
        code = str(code).strip()
        for col_name in ["bucket1", "bucket2", "bucket3", "bucket4"]:
            if col_name not in bucket_cols:
                continue
            val = row[bucket_cols[col_name]]
            if val is not None and str(val).strip():
                rows.append({
                    "track_id": track_id,
                    "course_code": code,
                    "bucket_id": str(val).strip(),
                })
    return rows


def write_course_bucket_sheet(wb: openpyxl.Workbook, rows: list[dict], dry_run: bool) -> None:
    """Add (or replace) the course_bucket sheet in the workbook."""
    if "course_bucket" in wb.sheetnames:
        print(f"[INFO] Replacing existing 'course_bucket' sheet ({len(wb['course_bucket'].max_row - 1)} existing rows).")
        del wb["course_bucket"]

    ws = wb.create_sheet("course_bucket")
    ws.append(["track_id", "course_code", "bucket_id"])
    for r in rows:
        ws.append([r["track_id"], r["course_code"], r["bucket_id"]])

    print(f"[INFO] Written {len(rows)} rows to 'course_bucket' sheet.")


def main():
    parser = argparse.ArgumentParser(description="Migrate course bucket data to normalized sheet.")
    parser.add_argument("--path", default=DEFAULT_WORKBOOK, help="Path to the workbook")
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    args = parser.parse_args()

    path = os.path.abspath(args.path)
    if not os.path.exists(path):
        sys.exit(f"[ERROR] Workbook not found: {path}")

    print(f"[INFO] Opening: {path}")
    wb = openpyxl.load_workbook(path)
    print(f"[INFO] Sheets: {wb.sheetnames}")

    if "course_bucket" in wb.sheetnames and not args.dry_run:
        ans = input("'course_bucket' sheet already exists. Overwrite? [y/N] ").strip().lower()
        if ans not in ("y", "yes"):
            sys.exit("Aborted.")

    track_id = resolve_active_track(wb)
    print(f"[INFO] Active track: {track_id}")

    rows = extract_bucket_rows(wb, track_id)
    if not rows:
        print("[INFO] No rows to write. Exiting.")
        return

    # Preview
    print(f"\nSample rows (first 5):")
    for r in rows[:5]:
        print(f"  {r['track_id']} | {r['course_code']} | {r['bucket_id']}")
    if len(rows) > 5:
        print(f"  ... ({len(rows) - 5} more)")

    if args.dry_run:
        print(f"\n[DRY RUN] Would write {len(rows)} rows to 'course_bucket' sheet. No file saved.")
        return

    write_course_bucket_sheet(wb, rows, dry_run=False)
    wb.save(path)
    print(f"\n[DONE] Saved: {path}")
    print("[NOTE] The original bucket1..bucket4 columns in 'courses' are left as deprecated.")
    print("       Remove them manually after verifying the new sheet is correct.")


if __name__ == "__main__":
    main()
