from __future__ import annotations

import re
from typing import Iterable

import pandas as pd

VALID_STUDENT_STAGES = ("undergrad", "graduate", "doctoral")

_STAGE_LABELS = {
    "undergrad": "Undergraduate",
    "graduate": "Graduate",
    "doctoral": "Doctoral",
}
_STAGE_LEVEL_LABELS = {
    "undergrad": "1000-4000",
    "graduate": "5000-7999",
    "doctoral": "8000+",
}
_COURSE_NUMBER_RE = re.compile(r"\b(\d{4})\b")


def normalize_student_stage(raw_value) -> str | None:
    text = str(raw_value or "").strip().lower()
    if not text:
        return None
    return text if text in VALID_STUDENT_STAGES else None


def coerce_course_level(raw_level, course_code: str | None = None) -> int | None:
    if raw_level is not None and not (isinstance(raw_level, float) and pd.isna(raw_level)):
        try:
            return int(float(raw_level))
        except (TypeError, ValueError):
            pass

    match = _COURSE_NUMBER_RE.search(str(course_code or "").upper())
    if not match:
        return None
    try:
        return int(match.group(1))
    except (TypeError, ValueError):
        return None


def infer_student_stage_from_courses(
    course_codes: Iterable[str],
    courses_df: pd.DataFrame | None = None,
) -> str:
    level_lookup: dict[str, int | None] = {}
    if courses_df is not None and len(courses_df) > 0 and "course_code" in courses_df.columns:
        for _, row in courses_df.iterrows():
            code = str(row.get("course_code", "") or "").strip().upper()
            if not code or code in level_lookup:
                continue
            level_lookup[code] = coerce_course_level(row.get("level"), code)

    highest_level = 0
    for raw_code in course_codes:
        code = str(raw_code or "").strip().upper()
        if not code:
            continue
        level = coerce_course_level(level_lookup.get(code), code)
        if level is not None and level > highest_level:
            highest_level = level

    if highest_level >= 8000:
        return "doctoral"
    if highest_level >= 5000:
        return "graduate"
    return "undergrad"


def stage_allows_course_level(student_stage: str | None, course_level: int | None) -> bool:
    if not student_stage:
        return True
    if course_level is None:
        return True
    if student_stage == "undergrad":
        return 1000 <= course_level < 5000
    if student_stage == "graduate":
        return 5000 <= course_level < 8000
    if student_stage == "doctoral":
        return course_level >= 8000
    return True


def student_stage_label(student_stage: str | None) -> str:
    return _STAGE_LABELS.get(str(student_stage or "").strip().lower(), "Student")


def student_stage_level_label(student_stage: str | None) -> str:
    return _STAGE_LEVEL_LABELS.get(str(student_stage or "").strip().lower(), "this stage")


def build_student_stage_block_message(
    student_stage: str,
    course_code: str,
    course_level: int | None,
) -> str:
    stage_label = student_stage_label(student_stage)
    allowed = student_stage_level_label(student_stage)
    if course_level is None:
        return f"{stage_label} profiles only recommend {allowed} level courses. {course_code} is outside that band."
    level_label = f"{course_level}-level"
    return f"{stage_label} profiles only recommend {allowed} level courses. {course_code} is a {level_label} course."
