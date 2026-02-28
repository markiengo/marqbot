"""
Migrate marquette_courses_full.xlsx → data/ directory of CSV files.

Usage:
    python scripts/migrate_xlsx_to_csv.py [--src PATH] [--out DIR]

Defaults:
    --src  marquette_courses_full.xlsx (repo root)
    --out  data/                        (repo root)
"""

import argparse
import os
import sys

import pandas as pd


def migrate(src: str, out_dir: str) -> None:
    if not os.path.isfile(src):
        print(f"[FATAL] Source file not found: {src}")
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    xl = pd.ExcelFile(src)
    sheets = xl.sheet_names
    print(f"[INFO] Found {len(sheets)} sheets in '{src}'")

    for sheet in sheets:
        df = xl.parse(sheet)
        dest = os.path.join(out_dir, f"{sheet}.csv")
        df.to_csv(dest, index=False)
        print(f"[OK]   {sheet} → {dest}  ({len(df)} rows)")

    print(f"[INFO] Migration complete. {len(sheets)} CSVs written to '{out_dir}'")


if __name__ == "__main__":
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parser = argparse.ArgumentParser(description="Migrate xlsx workbook to CSV directory.")
    parser.add_argument(
        "--src",
        default=os.path.join(repo_root, "marquette_courses_full.xlsx"),
        help="Source xlsx file",
    )
    parser.add_argument(
        "--out",
        default=os.path.join(repo_root, "data"),
        help="Output directory for CSV files",
    )
    args = parser.parse_args()
    migrate(args.src, args.out)
