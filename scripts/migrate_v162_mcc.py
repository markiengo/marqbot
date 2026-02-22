"""
v1.6.2 workbook migration (data-model first): inject MCC universal overlay.

Applies workbook-only changes:
1) Add MCC_CORE program as applies_to_all major.
2) Add MCC bucket + MCC sub-buckets.
3) Add MCC courses to courses, course_prereqs, course_offerings.
4) Map MCC courses in courses_all_buckets under MCC_CORE.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
from datetime import datetime

import pandas as pd


DEFAULT_WORKBOOK = os.path.join(
    os.path.dirname(__file__),
    "..",
    "marquette_courses_full.xlsx",
)

SEMESTER_HEADER_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)
SEASON_RANK = {"spring": 1, "summer": 2, "fall": 3}


def _semester_sort_key(header: str) -> tuple[int, int]:
    raw = str(header or "").strip()
    m = SEMESTER_HEADER_RE.match(raw)
    if not m:
        return (-1, -1)
    season = m.group(1).strip().lower()
    year = int(m.group(2))
    return (year, SEASON_RANK.get(season, 0))


def _coerce_bool(value) -> bool:
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _norm_code(value: str) -> str:
    return str(value or "").strip().upper()


def _derive_level(course_code: str) -> int:
    code = _norm_code(course_code)
    m = re.search(r"(\d{4})", code)
    if not m:
        return 1000
    num = int(m.group(1))
    return max(1000, (num // 1000) * 1000)


def _backup(path: str) -> str:
    workbook = os.path.abspath(path)
    root = os.path.dirname(workbook)
    backups = os.path.join(root, "backups")
    os.makedirs(backups, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = os.path.join(backups, f"marquette_courses_full.pre_v162_{stamp}.xlsx")
    shutil.copy2(workbook, out)
    return out


MCC_COURSES = [
    # MCC_Foundation
    {
        "course_code": "ENGL 1001",
        "course_name": "Foundations in Rhetoric",
        "sub_bucket_id": "MCC_Foundation",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "PHIL 1001",
        "course_name": "Foundations in Philosophy",
        "sub_bucket_id": "MCC_Foundation",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "THEO 1001",
        "course_name": "Foundations in Theology: Finding God in all Things",
        "sub_bucket_id": "MCC_Foundation",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "CORE 1929",
        "course_name": "Foundations in Methods of Inquiry",
        "sub_bucket_id": "MCC_Foundation",
        "prerequisites": "THEO 1001 or PHIL 1001",
        "prereq_warnings": "standing_requirement",
        "min_standing": 2,
        "last3": [True, True, True],
    },
    # MCC_ESSV1
    {
        "course_code": "ANTH 1001",
        "course_name": "Being Human",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "EDUC 1001",
        "course_name": "Child and Adolescent Development and Learning",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "ENGL 2020",
        "course_name": "Studies in Culture",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "ENGL 2030",
        "course_name": "Global Literatures",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [False, False, False],
    },
    {
        "course_code": "HEAL 1025",
        "course_name": "Culture and Health",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "HIST 1101",
        "course_name": "Introduction to American History",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "HIST 1130",
        "course_name": "Latinx History",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [False, False, True],
    },
    {
        "course_code": "HIST 1601",
        "course_name": "Difference and Democracy",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "HIST 1701",
        "course_name": "Engaging the World",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "HOPR 2956H",
        "course_name": "Honors Engaging Social Systems and Values 1: Engaging the City",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "admitted_program;standing_requirement",
        "min_standing": 2,
        "last3": [True, True, True],
    },
    {
        "course_code": "INGS 1001",
        "course_name": "Introduction to Gender and Sexualities Studies",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "INPS 2010",
        "course_name": "Introduction to Peace Studies",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "standing_requirement;instructor_consent",
        "min_standing": 1,
        "last3": [True, True, True],
    },
    {
        "course_code": "LLAC 1020",
        "course_name": "Cultural Capital: The Link between Language, Art and Political Change",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [False, False, False],
    },
    {
        "course_code": "SOCI 1001",
        "course_name": "Principles of Sociology",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "SOCI 1101",
        "course_name": "Advocacy for a Just World",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "SOWJ 1001",
        "course_name": "Introduction to Social Welfare and Justice",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "SOWJ 1101",
        "course_name": "Advocacy for a Just World",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "SPAN 3300",
        "course_name": "Peoples and Cultures of Spain",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "SPAN 3001 or SPAN 3005",
        "prereq_warnings": "instructor_consent",
        "min_standing": 0,
        "last3": [False, True, True],
    },
    {
        "course_code": "SPAN 3310",
        "course_name": "Peoples and Cultures of Latin America",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "SPAN 3001 or SPAN 3005",
        "prereq_warnings": "instructor_consent",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    {
        "course_code": "THAR 2020",
        "course_name": "Theatre Appreciation",
        "sub_bucket_id": "MCC_ESSV1",
        "prerequisites": "none",
        "prereq_warnings": "",
        "min_standing": 0,
        "last3": [True, True, True],
    },
    # MCC_CULM
    {
        "course_code": "CORE 4929",
        "course_name": "The Service of Faith and Promotion of Justice",
        "sub_bucket_id": "MCC_CULM",
        "prerequisites": "none",
        "prereq_warnings": "standing_requirement",
        "min_standing": 3,
        "last3": [True, True, True],
    },
]


def _migrate_programs(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["program_id"] = out.get("program_id", "").fillna("").astype(str).str.strip().str.upper()
    if "program_label" not in out.columns:
        out["program_label"] = out["program_id"]
    if "kind" not in out.columns:
        out["kind"] = "major"
    if "parent_major_id" not in out.columns:
        out["parent_major_id"] = ""
    if "active" not in out.columns:
        out["active"] = True
    if "requires_primary_major" not in out.columns:
        out["requires_primary_major"] = False
    if "applies_to_all" not in out.columns:
        out["applies_to_all"] = False

    mask = out["program_id"] == "MCC_CORE"
    row = {
        "program_id": "MCC_CORE",
        "program_label": "Marquette Core Curriculum",
        "kind": "major",
        "parent_major_id": "",
        "active": True,
        "requires_primary_major": False,
        "applies_to_all": True,
    }
    if "sort_order" in out.columns:
        sort_vals = pd.to_numeric(out["sort_order"], errors="coerce")
        row["sort_order"] = int(sort_vals.max()) + 1 if sort_vals.notna().any() else len(out) + 1
    if "notes" in out.columns:
        row["notes"] = "Universal MCC overlay for all majors."

    if mask.any():
        idx = out[mask].index[0]
        for k, v in row.items():
            if k in out.columns:
                out.at[idx, k] = v
    else:
        out = pd.concat([out, pd.DataFrame([row])], ignore_index=True)

    out["applies_to_all"] = out["applies_to_all"].apply(_coerce_bool)
    out = out.drop_duplicates(subset=["program_id"], keep="last")
    return out


def _migrate_buckets(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["program_id"] = out.get("program_id", "").fillna("").astype(str).str.strip().str.upper()
    out["bucket_id"] = out.get("bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    if "track_required" not in out.columns:
        out["track_required"] = ""
    if "active" not in out.columns:
        out["active"] = True

    row = {
        "program_id": "MCC_CORE",
        "bucket_id": "MCC",
        "bucket_label": "Marquette Core Curriculum",
        "priority": 1,
        "track_required": "",
        "active": True,
    }
    if "notes" in out.columns:
        row["notes"] = "Shared MCC family for all majors."

    mask = (out["program_id"] == "MCC_CORE") & (out["bucket_id"] == "MCC")
    if mask.any():
        idx = out[mask].index[0]
        for k, v in row.items():
            if k in out.columns:
                out.at[idx, k] = v
    else:
        out = pd.concat([out, pd.DataFrame([row])], ignore_index=True)

    out = out.drop_duplicates(subset=["program_id", "bucket_id"], keep="last")
    return out


def _migrate_sub_buckets(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["program_id"] = out.get("program_id", "").fillna("").astype(str).str.strip().str.upper()
    out["bucket_id"] = out.get("bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    out["sub_bucket_id"] = out.get("sub_bucket_id", "").fillna("").astype(str).str.strip()

    rows = [
        {
            "program_id": "MCC_CORE",
            "bucket_id": "MCC",
            "sub_bucket_id": "MCC_Foundation",
            "sub_bucket_label": "MCC Foundation",
            "courses_required": 4,
            "role": "core",
            "priority": 1,
        },
        {
            "program_id": "MCC_CORE",
            "bucket_id": "MCC",
            "sub_bucket_id": "MCC_ESSV1",
            "sub_bucket_label": "MCC Engaging Social Systems and Values 1",
            "courses_required": 1,
            "role": "core",
            "priority": 2,
        },
        {
            "program_id": "MCC_CORE",
            "bucket_id": "MCC",
            "sub_bucket_id": "MCC_CULM",
            "sub_bucket_label": "MCC Culminating Experience",
            "courses_required": 1,
            "role": "core",
            "priority": 3,
        },
    ]

    for row in rows:
        if "notes" in out.columns and "notes" not in row:
            row["notes"] = ""
        mask = (
            (out["program_id"] == row["program_id"])
            & (out["bucket_id"] == row["bucket_id"])
            & (out["sub_bucket_id"] == row["sub_bucket_id"])
        )
        if mask.any():
            idx = out[mask].index[0]
            for k, v in row.items():
                if k in out.columns:
                    out.at[idx, k] = v
        else:
            out = pd.concat([out, pd.DataFrame([row])], ignore_index=True)

    out = out.drop_duplicates(subset=["program_id", "bucket_id", "sub_bucket_id"], keep="last")
    return out


def _migrate_courses(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()
    if "course_name" not in out.columns:
        out["course_name"] = ""
    if "credits" not in out.columns:
        out["credits"] = 3
    if "level" not in out.columns:
        out["level"] = 1000
    if "active" not in out.columns:
        out["active"] = True

    for row in MCC_COURSES:
        code = _norm_code(row["course_code"])
        item = {
            "course_code": code,
            "course_name": row["course_name"],
            "credits": 3,
            "level": _derive_level(code),
            "active": True,
        }
        if "notes" in out.columns:
            item["notes"] = out.loc[out["course_code"] == code, "notes"].iloc[0] if (out["course_code"] == code).any() else ""
        mask = out["course_code"] == code
        if mask.any():
            idx = out[mask].index[0]
            for k, v in item.items():
                if k in out.columns:
                    out.at[idx, k] = v
        else:
            out = pd.concat([out, pd.DataFrame([item])], ignore_index=True)

    out = out.drop_duplicates(subset=["course_code"], keep="last")
    return out


def _migrate_prereqs(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()
    for col, default in (
        ("prerequisites", "none"),
        ("prereq_warnings", ""),
        ("concurrent_with", ""),
        ("min_standing", 0),
    ):
        if col not in out.columns:
            out[col] = default

    # Keep v1.6 normalization: blank instead of literal "none" in concurrent_with.
    out["concurrent_with"] = (
        out["concurrent_with"]
        .fillna("")
        .astype(str)
        .str.strip()
        .mask(lambda s: s.str.lower() == "none", "")
    )

    for row in MCC_COURSES:
        code = _norm_code(row["course_code"])
        item = {
            "course_code": code,
            "prerequisites": row["prerequisites"],
            "prereq_warnings": row["prereq_warnings"],
            "concurrent_with": "",
            "min_standing": int(row["min_standing"]),
        }
        if "notes" in out.columns:
            item["notes"] = out.loc[out["course_code"] == code, "notes"].iloc[0] if (out["course_code"] == code).any() else ""

        mask = out["course_code"] == code
        if mask.any():
            idx = out[mask].index[0]
            for k, v in item.items():
                if k in out.columns:
                    out.at[idx, k] = v
        else:
            out = pd.concat([out, pd.DataFrame([item])], ignore_index=True)

    out = out.drop_duplicates(subset=["course_code"], keep="last")
    return out


def _migrate_offerings(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()
    sem_cols = [c for c in out.columns if c != "course_code" and _semester_sort_key(c) != (-1, -1)]
    sem_cols = sorted(sem_cols, key=_semester_sort_key)
    if len(sem_cols) < 3:
        raise ValueError("course_offerings must contain at least three semester columns.")

    for col in sem_cols:
        out[col] = out[col].apply(_coerce_bool)

    latest_three_desc = sorted(sem_cols, key=_semester_sort_key, reverse=True)[:3]

    for row in MCC_COURSES:
        code = _norm_code(row["course_code"])
        payload = {"course_code": code}
        for c in sem_cols:
            payload[c] = False
        for idx, c in enumerate(latest_three_desc):
            if idx < len(row["last3"]):
                payload[c] = bool(row["last3"][idx])

        mask = out["course_code"] == code
        if mask.any():
            idx = out[mask].index[0]
            for k, v in payload.items():
                if k in out.columns:
                    out.at[idx, k] = v
        else:
            out = pd.concat([out, pd.DataFrame([payload])], ignore_index=True)

    out = out.drop_duplicates(subset=["course_code"], keep="last")
    return out[["course_code"] + sem_cols]


def _migrate_courses_all_buckets(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["program_id"] = out.get("program_id", "").fillna("").astype(str).str.strip().str.upper()
    out["sub_bucket_id"] = out.get("sub_bucket_id", "").fillna("").astype(str).str.strip()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()
    if "notes" not in out.columns:
        out["notes"] = ""

    rows = []
    for c in MCC_COURSES:
        rows.append(
            {
                "program_id": "MCC_CORE",
                "sub_bucket_id": c["sub_bucket_id"],
                "course_code": _norm_code(c["course_code"]),
                "notes": "",
            }
        )
    out = pd.concat([out, pd.DataFrame(rows)], ignore_index=True)
    out = out.drop_duplicates(subset=["program_id", "sub_bucket_id", "course_code"], keep="last")
    return out


def migrate(path: str) -> None:
    workbook = os.path.abspath(path)
    if not os.path.exists(workbook):
        raise FileNotFoundError(workbook)

    backup_path = _backup(workbook)
    xl = pd.ExcelFile(workbook)
    sheets = {name: xl.parse(name) for name in xl.sheet_names}

    required = {
        "programs",
        "buckets",
        "sub_buckets",
        "courses",
        "course_prereqs",
        "course_offerings",
        "courses_all_buckets",
    }
    missing = sorted(required - set(sheets))
    if missing:
        raise ValueError(f"Workbook missing required sheet(s): {missing}")

    sheets["programs"] = _migrate_programs(sheets["programs"])
    sheets["buckets"] = _migrate_buckets(sheets["buckets"])
    sheets["sub_buckets"] = _migrate_sub_buckets(sheets["sub_buckets"])
    sheets["courses"] = _migrate_courses(sheets["courses"])
    sheets["course_prereqs"] = _migrate_prereqs(sheets["course_prereqs"])
    sheets["course_offerings"] = _migrate_offerings(sheets["course_offerings"])
    sheets["courses_all_buckets"] = _migrate_courses_all_buckets(sheets["courses_all_buckets"])

    with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
        for name in xl.sheet_names:
            sheets[name].to_excel(writer, sheet_name=name, index=False)

    print("[OK] v1.6.2 MCC migration complete")
    print(f"[OK] Backup written: {backup_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Inject MCC data into v1.6 workbook model.")
    parser.add_argument("--path", default=DEFAULT_WORKBOOK, help="Path to workbook")
    args = parser.parse_args()
    migrate(args.path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
