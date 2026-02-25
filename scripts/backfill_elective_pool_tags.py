"""
Backfill courses.elective_pool_tag in workbook.

Default behavior:
  - Set elective_pool_tag='biz_elective' for business-prefix course codes.
  - Leave other rows blank.
"""

import argparse
import os
import re
import sys

import pandas as pd
from workbook_io import backup_sibling, load_workbook_sheets, write_workbook


DEFAULT_WORKBOOK = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "marquette_courses_full.xlsx")
)

DEFAULT_TAG = "biz_elective"
BUSINESS_PREFIXES = {
    "ACCO",
    "ACCOI",
    "AIM",
    "BUAD",
    "BUAN",
    "BULA",
    "ECON",
    "ENTP",
    "FINA",
    "FINAI",
    "HURE",
    "INBUI",
    "INSY",
    "LEAD",
    "MANA",
    "MARK",
    "OSCM",
    "REAL",
}
_SUBJECT_RE = re.compile(r"^\s*([A-Za-z]+)")


def _subject_prefix(course_code: str) -> str:
    m = _SUBJECT_RE.match(str(course_code or ""))
    if not m:
        return ""
    return m.group(1).strip().upper()


def backfill(path: str, dry_run: bool = False, tag_value: str = DEFAULT_TAG) -> None:
    abs_path = os.path.abspath(path)
    if not os.path.exists(abs_path):
        sys.exit(f"[ERROR] Workbook not found: {abs_path}")

    order, sheets = load_workbook_sheets(abs_path)
    if "courses" not in sheets:
        sys.exit("[ERROR] Workbook must contain a 'courses' sheet.")

    courses = sheets["courses"].copy()
    if "course_code" not in courses.columns:
        sys.exit("[ERROR] 'courses' sheet must contain 'course_code'.")
    if "elective_pool_tag" not in courses.columns:
        courses["elective_pool_tag"] = ""

    courses["course_code"] = courses["course_code"].fillna("").astype(str).str.strip()
    courses["elective_pool_tag"] = courses["elective_pool_tag"].fillna("").astype(str).str.strip().str.lower()

    subject = courses["course_code"].apply(_subject_prefix)
    business_mask = subject.isin(BUSINESS_PREFIXES)
    courses.loc[business_mask, "elective_pool_tag"] = str(tag_value).strip().lower()
    courses.loc[~business_mask, "elective_pool_tag"] = ""

    tagged_count = int((courses["elective_pool_tag"] == str(tag_value).strip().lower()).sum())
    blank_count = int((courses["elective_pool_tag"] == "").sum())
    print(f"[INFO] Tagged courses: {tagged_count}")
    print(f"[INFO] Untagged courses: {blank_count}")

    if dry_run:
        print("[DRY RUN] No file changes were written.")
        return

    backup_path = backup_sibling(abs_path)
    print(f"[INFO] Backup created: {backup_path}")

    sheets["courses"] = courses
    write_workbook(abs_path, order, sheets)
    print(f"[DONE] Backfilled elective_pool_tag in: {abs_path}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Backfill courses.elective_pool_tag for dynamic elective pools."
    )
    parser.add_argument("--path", default=DEFAULT_WORKBOOK, help="Workbook path")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument(
        "--tag",
        default=DEFAULT_TAG,
        help=f"Tag value to write for business courses (default: {DEFAULT_TAG})",
    )
    args = parser.parse_args(argv)
    backfill(args.path, dry_run=args.dry_run, tag_value=args.tag)


if __name__ == "__main__":
    main()
