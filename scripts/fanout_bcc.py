"""
Auto-fanout BCC structures from a source major to one or more target majors.

Copies:
  - buckets row for bucket_id='BCC'
  - all sub_buckets under parent bucket_id='BCC'
  - all courses_all_buckets mappings for copied BCC sub_buckets

Usage:
  python scripts/fanout_bcc.py --targets BUAN_MAJOR OSCM_MAJOR INSY_MAJOR
  python scripts/fanout_bcc.py --source FIN_MAJOR --targets ACCO_MAJOR --overwrite
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def _load(path: Path) -> dict[str, pd.DataFrame]:
    xl = pd.ExcelFile(path)
    map_sheet = "courses_all_buckets" if "courses_all_buckets" in xl.sheet_names else "course_sub_buckets"
    return {
        "programs": pd.read_excel(xl, "programs"),
        "buckets": pd.read_excel(xl, "buckets"),
        "sub_buckets": pd.read_excel(xl, "sub_buckets"),
        "courses_all_buckets": pd.read_excel(xl, map_sheet),
    }


def _save(path: Path, updates: dict[str, pd.DataFrame]) -> None:
    with pd.ExcelWriter(path, engine="openpyxl", mode="a", if_sheet_exists="replace") as writer:
        for sheet, df in updates.items():
            df.to_excel(writer, sheet_name=sheet, index=False)


def _norm(df: pd.DataFrame, col: str, upper: bool = False) -> pd.Series:
    s = df[col].fillna("").astype(str).str.strip()
    return s.str.upper() if upper else s


def fanout_bcc(
    workbook_path: Path,
    source_program_id: str,
    target_program_ids: list[str],
    overwrite: bool = False,
) -> None:
    data = _load(workbook_path)
    programs = data["programs"].copy()
    buckets = data["buckets"].copy()
    sub_buckets = data["sub_buckets"].copy()
    courses_all_buckets = data["courses_all_buckets"].copy()

    source = source_program_id.strip().upper()
    targets = [t.strip().upper() for t in target_program_ids if str(t).strip()]
    if not targets:
        raise ValueError("No targets provided.")

    programs["program_id"] = _norm(programs, "program_id", upper=True)
    buckets["program_id"] = _norm(buckets, "program_id", upper=True)
    buckets["bucket_id"] = _norm(buckets, "bucket_id")
    sub_buckets["program_id"] = _norm(sub_buckets, "program_id", upper=True)
    sub_buckets["bucket_id"] = _norm(sub_buckets, "bucket_id")
    sub_buckets["sub_bucket_id"] = _norm(sub_buckets, "sub_bucket_id")
    courses_all_buckets["program_id"] = _norm(courses_all_buckets, "program_id", upper=True)
    courses_all_buckets["sub_bucket_id"] = _norm(courses_all_buckets, "sub_bucket_id")
    courses_all_buckets["course_code"] = _norm(courses_all_buckets, "course_code")

    known_programs = set(programs["program_id"].tolist())
    missing_programs = [t for t in targets if t not in known_programs]
    if missing_programs:
        raise ValueError(
            f"Target program(s) not found in programs sheet: {missing_programs}. "
            "Add programs rows first."
        )

    source_bucket = buckets[
        (buckets["program_id"] == source) & (buckets["bucket_id"] == "BCC")
    ].copy()
    if len(source_bucket) == 0:
        raise ValueError(f"Source program '{source}' has no BCC bucket row.")
    source_bucket = source_bucket.iloc[[0]].copy()

    source_sub = sub_buckets[
        (sub_buckets["program_id"] == source) & (sub_buckets["bucket_id"] == "BCC")
    ].copy()
    if len(source_sub) == 0:
        raise ValueError(f"Source program '{source}' has no BCC sub_buckets.")
    source_sub_ids = set(source_sub["sub_bucket_id"].tolist())

    source_map = courses_all_buckets[
        (courses_all_buckets["program_id"] == source)
        & (courses_all_buckets["sub_bucket_id"].isin(source_sub_ids))
    ].copy()

    for target in targets:
        target_sub_ids = set(
            sub_buckets[
                (sub_buckets["program_id"] == target) & (sub_buckets["bucket_id"] == "BCC")
            ]["sub_bucket_id"].tolist()
        )

        if overwrite:
            buckets = buckets[
                ~((buckets["program_id"] == target) & (buckets["bucket_id"] == "BCC"))
            ].copy()
            if target_sub_ids:
                sub_buckets = sub_buckets[
                    ~(
                        (sub_buckets["program_id"] == target)
                        & (sub_buckets["sub_bucket_id"].isin(target_sub_ids))
                    )
                ].copy()
                courses_all_buckets = courses_all_buckets[
                    ~(
                        (courses_all_buckets["program_id"] == target)
                        & (courses_all_buckets["sub_bucket_id"].isin(target_sub_ids))
                    )
                ].copy()

        # Add bucket if missing.
        exists_bucket = (
            (buckets["program_id"] == target) & (buckets["bucket_id"] == "BCC")
        ).any()
        if not exists_bucket:
            new_bucket = source_bucket.copy()
            new_bucket["program_id"] = target
            buckets = pd.concat([buckets, new_bucket], ignore_index=True)

        # Add missing BCC sub_buckets.
        target_sub_now = set(
            sub_buckets[
                (sub_buckets["program_id"] == target) & (sub_buckets["bucket_id"] == "BCC")
            ]["sub_bucket_id"].tolist()
        )
        missing_sub = source_sub[~source_sub["sub_bucket_id"].isin(target_sub_now)].copy()
        if len(missing_sub) > 0:
            missing_sub["program_id"] = target
            sub_buckets = pd.concat([sub_buckets, missing_sub], ignore_index=True)

        # Add missing BCC mappings.
        target_map_keys = set(
            zip(
                courses_all_buckets[courses_all_buckets["program_id"] == target]["sub_bucket_id"].tolist(),
                courses_all_buckets[courses_all_buckets["program_id"] == target]["course_code"].tolist(),
            )
        )
        add_map = source_map.copy()
        add_map["program_id"] = target
        add_map = add_map[
            add_map.apply(
                lambda r: (str(r["sub_bucket_id"]), str(r["course_code"])) not in target_map_keys,
                axis=1,
            )
        ]
        if len(add_map) > 0:
            courses_all_buckets = pd.concat([courses_all_buckets, add_map], ignore_index=True)

    # Deduplicate canonical keys.
    buckets = buckets.drop_duplicates(subset=["program_id", "bucket_id"], keep="last")
    sub_buckets = sub_buckets.drop_duplicates(subset=["program_id", "sub_bucket_id"], keep="last")
    courses_all_buckets = courses_all_buckets.drop_duplicates(
        subset=["program_id", "sub_bucket_id", "course_code"], keep="last"
    )

    _save(
        workbook_path,
        {
            "buckets": buckets,
            "sub_buckets": sub_buckets,
            "courses_all_buckets": courses_all_buckets,
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Fan out BCC from source major to target majors.")
    parser.add_argument(
        "--path",
        type=str,
        default=str(Path(__file__).resolve().parent.parent / "marquette_courses_full.xlsx"),
        help="Workbook path.",
    )
    parser.add_argument("--source", type=str, default="FIN_MAJOR", help="Source program_id.")
    parser.add_argument("--targets", nargs="+", required=True, help="Target program_id(s).")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace target BCC rows before copying.",
    )
    args = parser.parse_args()

    fanout_bcc(
        workbook_path=Path(args.path),
        source_program_id=args.source,
        target_program_ids=args.targets,
        overwrite=args.overwrite,
    )
    print(
        "BCC fanout complete:",
        f"source={args.source.strip().upper()} targets={[t.strip().upper() for t in args.targets]}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
