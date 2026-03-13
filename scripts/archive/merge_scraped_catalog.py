"""One-time merge of scraped catalog artifacts into production CSVs.

Inputs:
- data/courses.csv
- data/course_hard_prereqs.csv
- data/course_soft_prereqs.csv
- data/webscrape_1/all_courses_raw.csv
- either:
  - data/webscrape_1/course_hard_prereqs_proposed.csv
  - data/webscrape_1/course_soft_prereqs_proposed.csv
- or legacy:
  - data/webscrape_1/course_prereqs_proposed.csv

Outputs:
- updated data/courses.csv
- updated data/course_hard_prereqs.csv
- updated data/course_soft_prereqs.csv
- backups:
  - data/courses.pre_merge_backup.csv
  - data/course_hard_prereqs.pre_merge_backup.csv
  - data/course_soft_prereqs.pre_merge_backup.csv
"""

from __future__ import annotations

import argparse
import csv
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from audit_full_catalog import (
    HARD_PREREQ_FIELDS,
    SOFT_PREREQ_FIELDS,
    build_soft_detail_columns,
    normalize_soft_tags,
)


BUSINESS_SUBJECTS = {
    "ACCO",
    "ACCOI",
    "AIM",
    "AIIM",
    "BUAD",
    "BUAN",
    "BULA",
    "ECON",
    "ECONI",
    "ENTP",
    "FINA",
    "FINAI",
    "HURE",
    "INBU",
    "INBUI",
    "INSY",
    "LEAD",
    "MANA",
    "MARK",
    "MARKI",
    "OSCM",
    "REAL",
    "SOWJ",
}

COURSES_FIELDNAMES = [
    "course_code",
    "course_name",
    "credits",
    "level",
    "active",
    "notes",
    "elective_pool_tag",
    "description",
]
HARD_PREREQS_FIELDNAMES = list(HARD_PREREQ_FIELDS)
SOFT_PREREQS_FIELDNAMES = list(SOFT_PREREQ_FIELDS)
SOFT_DETAIL_FIELDS = [
    field for field in SOFT_PREREQS_FIELDNAMES if field not in {"course_code", "soft_prereq", "notes"}
]


@dataclass
class CoursesMergeStats:
    existing_count: int = 0
    scraped_count: int = 0
    matched_count: int = 0
    unmatched_existing_count: int = 0
    new_count: int = 0
    descriptions_overwritten: int = 0
    notes_filled: int = 0
    course_name_filled: int = 0
    credits_filled: int = 0
    level_filled: int = 0
    active_filled: int = 0
    new_tagged_biz_elective: int = 0
    new_nonbusiness_empty_tag: int = 0


@dataclass
class PrereqsMergeStats:
    existing_count: int = 0
    scraped_count: int = 0
    appended_new_count: int = 0
    unchanged_existing_count: int = 0


def _norm(text: Any) -> str:
    return str(text or "").strip()


def _read_csv_rows(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        rows = [{k: (v if v is not None else "") for k, v in row.items()} for row in reader]
    return rows, fieldnames


def _write_csv_rows(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _course_subject(course_code: str) -> str:
    return _norm(course_code).split(" ")[0].upper() if _norm(course_code) else ""


def _is_blank(value: Any) -> bool:
    return _norm(value) == ""


def _validate_columns(actual: list[str], expected: list[str], label: str) -> None:
    missing = [col for col in expected if col not in actual]
    if missing:
        raise ValueError(f"{label} missing expected columns: {missing}")


def _backup_file(source: Path, backup: Path) -> None:
    shutil.copy2(source, backup)


def _normalize_hard_prereq_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    normalized_rows: list[dict[str, str]] = []
    for row in rows:
        code = _norm(row.get("course_code")).upper()
        if not code:
            continue
        normalized_rows.append(
            {
                "course_code": code,
                "hard_prereq": _norm(row.get("hard_prereq", row.get("prerequisites", "none"))) or "none",
                "concurrent_with": _norm(row.get("concurrent_with")),
                "min_standing": _norm(row.get("min_standing")) or "0.0",
            }
        )
    return normalized_rows


def _normalize_soft_prereq_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    normalized_rows: list[dict[str, str]] = []
    for row in rows:
        code = _norm(row.get("course_code")).upper()
        if not code:
            continue

        tags = normalize_soft_tags(row.get("soft_prereq", row.get("prereq_warnings", "")))
        catalog_raw = _norm(row.get("catalog_prereq_raw", row.get("notes")))
        inferred_details = build_soft_detail_columns(catalog_raw, tags) if catalog_raw else {
            field: "" for field in SOFT_DETAIL_FIELDS
        }

        normalized_row = {field: "" for field in SOFT_PREREQS_FIELDNAMES}
        normalized_row["course_code"] = code
        normalized_row["soft_prereq"] = ";".join(tags)
        normalized_row["notes"] = _norm(row.get("notes"))

        for field in SOFT_DETAIL_FIELDS:
            explicit = _norm(row.get(field))
            normalized_row[field] = explicit or _norm(inferred_details.get(field))

        if not normalized_row["catalog_prereq_raw"]:
            normalized_row["catalog_prereq_raw"] = catalog_raw
        if "complex_hard_prereq" in tags and not normalized_row["soft_prereq_complex_hard_prereq"]:
            normalized_row["soft_prereq_complex_hard_prereq"] = normalized_row["catalog_prereq_raw"]

        normalized_rows.append(normalized_row)
    return normalized_rows


def merge_courses(
    existing_rows: list[dict[str, str]],
    scraped_rows: list[dict[str, str]],
    fieldnames: list[str],
) -> tuple[list[dict[str, str]], CoursesMergeStats]:
    stats = CoursesMergeStats(existing_count=len(existing_rows), scraped_count=len(scraped_rows))

    existing_by_code: dict[str, dict[str, str]] = {}
    for row in existing_rows:
        code = _norm(row.get("course_code")).upper()
        if code:
            existing_by_code[code] = dict(row)

    scraped_by_code: dict[str, dict[str, str]] = {}
    for row in scraped_rows:
        code = _norm(row.get("course_code")).upper()
        if code:
            scraped_by_code[code] = row

    all_codes = sorted(set(existing_by_code) | set(scraped_by_code))
    merged: list[dict[str, str]] = []

    for code in all_codes:
        existing = existing_by_code.get(code)
        scraped = scraped_by_code.get(code)

        if existing and scraped:
            stats.matched_count += 1
            row = dict(existing)

            scraped_description = _norm(scraped.get("description"))
            if scraped_description:
                if _norm(row.get("description")) != scraped_description:
                    stats.descriptions_overwritten += 1
                row["description"] = scraped_description

            if _is_blank(row.get("notes")) and _norm(scraped.get("notes")):
                row["notes"] = _norm(scraped.get("notes"))
                stats.notes_filled += 1

            if _is_blank(row.get("course_name")) and _norm(scraped.get("course_name")):
                row["course_name"] = _norm(scraped.get("course_name"))
                stats.course_name_filled += 1

            if _is_blank(row.get("credits")) and _norm(scraped.get("credits")):
                row["credits"] = _norm(scraped.get("credits"))
                stats.credits_filled += 1

            if _is_blank(row.get("level")) and _norm(scraped.get("level")):
                row["level"] = _norm(scraped.get("level"))
                stats.level_filled += 1

            if _is_blank(row.get("active")) and _norm(scraped.get("active")):
                row["active"] = _norm(scraped.get("active"))
                stats.active_filled += 1

            merged.append({col: row.get(col, "") for col in fieldnames})
            continue

        if existing and not scraped:
            stats.unmatched_existing_count += 1
            merged.append({col: existing.get(col, "") for col in fieldnames})
            continue

        if scraped and not existing:
            stats.new_count += 1
            subject = _course_subject(code)
            elective_pool_tag = "biz_elective" if subject in BUSINESS_SUBJECTS else ""
            if elective_pool_tag:
                stats.new_tagged_biz_elective += 1
            else:
                stats.new_nonbusiness_empty_tag += 1

            new_row = {col: "" for col in fieldnames}
            new_row["course_code"] = _norm(scraped.get("course_code")).upper()
            new_row["course_name"] = _norm(scraped.get("course_name"))
            new_row["credits"] = _norm(scraped.get("credits"))
            new_row["level"] = _norm(scraped.get("level"))
            new_row["active"] = "True"
            new_row["notes"] = _norm(scraped.get("notes"))
            new_row["elective_pool_tag"] = elective_pool_tag
            new_row["description"] = _norm(scraped.get("description"))
            merged.append(new_row)

    merged.sort(key=lambda row: _norm(row.get("course_code")).upper())
    return merged, stats


def merge_prereq_rows(
    existing_rows: list[dict[str, str]],
    scraped_rows: list[dict[str, str]],
    fieldnames: list[str],
) -> tuple[list[dict[str, str]], PrereqsMergeStats]:
    stats = PrereqsMergeStats(existing_count=len(existing_rows), scraped_count=len(scraped_rows))

    existing_by_code: dict[str, dict[str, str]] = {}
    for row in existing_rows:
        code = _norm(row.get("course_code")).upper()
        if code:
            existing_by_code[code] = dict(row)

    for row in scraped_rows:
        code = _norm(row.get("course_code")).upper()
        if not code or code in existing_by_code:
            continue
        new_row = {col: _norm(row.get(col)) for col in fieldnames}
        new_row["course_code"] = code
        existing_by_code[code] = new_row
        stats.appended_new_count += 1

    stats.unchanged_existing_count = len(existing_rows)
    merged = [existing_by_code[code] for code in sorted(existing_by_code.keys())]
    return merged, stats


def verify_existing_rows_unchanged(
    old_rows: list[dict[str, str]],
    merged_rows: list[dict[str, str]],
    fieldnames: list[str],
) -> tuple[bool, list[str]]:
    old_by_code = {_norm(row.get("course_code")).upper(): row for row in old_rows if _norm(row.get("course_code"))}
    merged_by_code = {
        _norm(row.get("course_code")).upper(): row for row in merged_rows if _norm(row.get("course_code"))
    }

    changed_codes: list[str] = []
    for code, old_row in old_by_code.items():
        new_row = merged_by_code.get(code)
        if not new_row:
            changed_codes.append(code)
            continue
        for col in fieldnames:
            if _norm(old_row.get(col)) != _norm(new_row.get(col)):
                changed_codes.append(code)
                break
    return len(changed_codes) == 0, sorted(changed_codes)


def _load_scraped_prereq_rows(
    scraped_hard_path: Path,
    scraped_soft_path: Path,
    scraped_legacy_path: Path,
) -> tuple[list[dict[str, str]], list[dict[str, str]], str]:
    if scraped_hard_path.exists() and scraped_soft_path.exists():
        scraped_hard_rows, scraped_hard_fields = _read_csv_rows(scraped_hard_path)
        scraped_soft_rows, scraped_soft_fields = _read_csv_rows(scraped_soft_path)
        _validate_columns(
            scraped_hard_fields,
            HARD_PREREQS_FIELDNAMES,
            "scraped course_hard_prereqs_proposed.csv",
        )
        _validate_columns(
            scraped_soft_fields,
            SOFT_PREREQS_FIELDNAMES,
            "scraped course_soft_prereqs_proposed.csv",
        )
        return (
            _normalize_hard_prereq_rows(scraped_hard_rows),
            _normalize_soft_prereq_rows(scraped_soft_rows),
            "split",
        )

    if not scraped_legacy_path.exists():
        raise FileNotFoundError(
            "Missing scraped prerequisite inputs. Expected split proposed CSVs or legacy "
            f"{scraped_legacy_path}."
        )

    scraped_legacy_rows, _ = _read_csv_rows(scraped_legacy_path)
    return (
        _normalize_hard_prereq_rows(scraped_legacy_rows),
        _normalize_soft_prereq_rows(scraped_legacy_rows),
        "legacy_combined",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Merge scraped catalog CSVs into production data/*.csv")
    parser.add_argument("--courses", type=Path, default=Path("data/courses.csv"))
    parser.add_argument(
        "--course-hard-prereqs",
        type=Path,
        default=Path("data/course_hard_prereqs.csv"),
    )
    parser.add_argument(
        "--course-soft-prereqs",
        type=Path,
        default=Path("data/course_soft_prereqs.csv"),
    )
    parser.add_argument("--scraped-courses", type=Path, default=Path("data/webscrape_1/all_courses_raw.csv"))
    parser.add_argument(
        "--scraped-hard-prereqs",
        type=Path,
        default=Path("data/webscrape_1/course_hard_prereqs_proposed.csv"),
    )
    parser.add_argument(
        "--scraped-soft-prereqs",
        type=Path,
        default=Path("data/webscrape_1/course_soft_prereqs_proposed.csv"),
    )
    parser.add_argument(
        "--scraped-prereqs",
        type=Path,
        default=Path("data/webscrape_1/course_prereqs_proposed.csv"),
        help="Legacy combined scraped prereq CSV, used as a fallback when split proposed files are absent.",
    )
    parser.add_argument("--courses-backup", type=Path, default=Path("data/courses.pre_merge_backup.csv"))
    parser.add_argument(
        "--course-hard-prereqs-backup",
        type=Path,
        default=Path("data/course_hard_prereqs.pre_merge_backup.csv"),
    )
    parser.add_argument(
        "--course-soft-prereqs-backup",
        type=Path,
        default=Path("data/course_soft_prereqs.pre_merge_backup.csv"),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    for path in [args.courses, args.course_hard_prereqs, args.course_soft_prereqs, args.scraped_courses]:
        if not path.exists():
            raise FileNotFoundError(f"Missing required input file: {path}")

    existing_courses_rows, existing_courses_fields = _read_csv_rows(args.courses)
    existing_hard_rows, existing_hard_fields = _read_csv_rows(args.course_hard_prereqs)
    existing_soft_rows, existing_soft_fields = _read_csv_rows(args.course_soft_prereqs)
    scraped_courses_rows, scraped_courses_fields = _read_csv_rows(args.scraped_courses)
    scraped_hard_rows, scraped_soft_rows, scraped_mode = _load_scraped_prereq_rows(
        args.scraped_hard_prereqs,
        args.scraped_soft_prereqs,
        args.scraped_prereqs,
    )

    existing_hard_rows = _normalize_hard_prereq_rows(existing_hard_rows)
    existing_soft_rows = _normalize_soft_prereq_rows(existing_soft_rows)

    _validate_columns(existing_courses_fields, COURSES_FIELDNAMES, "data/courses.csv")
    _validate_columns(scraped_courses_fields, COURSES_FIELDNAMES, "scraped all_courses_raw.csv")
    _validate_columns(existing_hard_fields, HARD_PREREQS_FIELDNAMES, "data/course_hard_prereqs.csv")
    _validate_columns(existing_soft_fields, SOFT_PREREQS_FIELDNAMES, "data/course_soft_prereqs.csv")

    _backup_file(args.courses, args.courses_backup)
    _backup_file(args.course_hard_prereqs, args.course_hard_prereqs_backup)
    _backup_file(args.course_soft_prereqs, args.course_soft_prereqs_backup)

    merged_courses, courses_stats = merge_courses(
        existing_courses_rows,
        scraped_courses_rows,
        existing_courses_fields,
    )
    merged_hard, hard_stats = merge_prereq_rows(
        existing_hard_rows,
        scraped_hard_rows,
        existing_hard_fields,
    )
    merged_soft, soft_stats = merge_prereq_rows(
        existing_soft_rows,
        scraped_soft_rows,
        existing_soft_fields,
    )

    hard_unchanged_ok, hard_changed_codes = verify_existing_rows_unchanged(
        existing_hard_rows,
        merged_hard,
        existing_hard_fields,
    )
    if not hard_unchanged_ok:
        preview = hard_changed_codes[:20]
        raise RuntimeError(
            "Existing course_hard_prereqs rows changed unexpectedly for codes: "
            f"{preview}{'...' if len(hard_changed_codes) > 20 else ''}"
        )

    soft_unchanged_ok, soft_changed_codes = verify_existing_rows_unchanged(
        existing_soft_rows,
        merged_soft,
        existing_soft_fields,
    )
    if not soft_unchanged_ok:
        preview = soft_changed_codes[:20]
        raise RuntimeError(
            "Existing course_soft_prereqs rows changed unexpectedly for codes: "
            f"{preview}{'...' if len(soft_changed_codes) > 20 else ''}"
        )

    _write_csv_rows(args.courses, merged_courses, existing_courses_fields)
    _write_csv_rows(args.course_hard_prereqs, merged_hard, existing_hard_fields)
    _write_csv_rows(args.course_soft_prereqs, merged_soft, existing_soft_fields)

    print("Merge complete.")
    print(f"Scraped prereq mode: {scraped_mode}")
    print("Backups:")
    print(f"  {args.courses_backup}")
    print(f"  {args.course_hard_prereqs_backup}")
    print(f"  {args.course_soft_prereqs_backup}")
    print("courses.csv stats:")
    print(f"  existing_rows={courses_stats.existing_count}")
    print(f"  scraped_rows={courses_stats.scraped_count}")
    print(f"  matched_rows={courses_stats.matched_count}")
    print(f"  unmatched_existing_rows={courses_stats.unmatched_existing_count}")
    print(f"  new_rows_added={courses_stats.new_count}")
    print(f"  descriptions_overwritten_nonblank={courses_stats.descriptions_overwritten}")
    print(f"  notes_filled={courses_stats.notes_filled}")
    print(f"  course_name_filled={courses_stats.course_name_filled}")
    print(f"  credits_filled={courses_stats.credits_filled}")
    print(f"  level_filled={courses_stats.level_filled}")
    print(f"  active_filled={courses_stats.active_filled}")
    print(f"  new_biz_elective_tagged={courses_stats.new_tagged_biz_elective}")
    print(f"  new_nonbusiness_empty_tag={courses_stats.new_nonbusiness_empty_tag}")
    print("course_hard_prereqs.csv stats:")
    print(f"  existing_rows={hard_stats.existing_count}")
    print(f"  scraped_rows={hard_stats.scraped_count}")
    print(f"  appended_new_rows={hard_stats.appended_new_count}")
    print(f"  unchanged_existing_rows={hard_stats.unchanged_existing_count}")
    print("course_soft_prereqs.csv stats:")
    print(f"  existing_rows={soft_stats.existing_count}")
    print(f"  scraped_rows={soft_stats.scraped_count}")
    print(f"  appended_new_rows={soft_stats.appended_new_count}")
    print(f"  unchanged_existing_rows={soft_stats.unchanged_existing_count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
