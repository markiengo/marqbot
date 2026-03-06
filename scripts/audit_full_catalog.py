#!/usr/bin/env python3
"""
Audit and rewrite data/courses.csv plus split prerequisite CSVs from
full_course_database.md.

Rules:
- full_course_database.md is the source of truth for codes present in the file.
- AIM rows are preserved as-is because they were already manually audited.
- Codes missing from full_course_database.md are preserved for manual review.
- Prerequisites are split into:
    data/course_hard_prereqs.csv
    data/course_soft_prereqs.csv
"""

from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_MD = ROOT / "full_course_database.md"
COURSES_CSV = ROOT / "data" / "courses.csv"
LEGACY_PREREQS_CSV = ROOT / "data" / "course_prereqs.csv"
HARD_PREREQS_CSV = ROOT / "data" / "course_hard_prereqs.csv"
SOFT_PREREQS_CSV = ROOT / "data" / "course_soft_prereqs.csv"

HARD_PREREQ_FIELDS = [
    "course_code",
    "hard_prereq",
    "concurrent_with",
    "min_standing",
]
SOFT_PREREQ_FIELDS = [
    "course_code",
    "soft_prereq",
    "catalog_prereq_raw",
    "soft_prereq_major_restriction",
    "soft_prereq_instructor_consent",
    "soft_prereq_admitted_program",
    "soft_prereq_college_restriction",
    "soft_prereq_program_progress_requirement",
    "soft_prereq_standing_requirement",
    "soft_prereq_placement_required",
    "soft_prereq_minimum_grade",
    "soft_prereq_minimum_gpa",
    "soft_prereq_may_be_concurrent",
    "soft_prereq_other_requirements",
    "soft_prereq_complex_hard_prereq",
    "notes",
]

SKIP_PREFIXES = ("AIM ",)
BIZ_DEPTS = frozenset({
    "ACCO", "AIM", "BUAD", "BUAN", "BULA", "ECON", "ENTP", "FINA",
    "HURE", "INBU", "INSY", "LEAD", "MANA", "MARK", "OSCM", "REAL",
})

COURSE_HEADER_RE = re.compile(
    r"^([A-Z]{2,7}I?\s+\d{4}H?)\s{2,}(.*?)\s{2,}"
    r"\((\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?) credits\)\s*$"
)
COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,7}I?)\s+(\d{4}H?)\b")
PAREN_ANNOTATION_RE = re.compile(r"\([^)]*\)")

INSTRUCTOR_PATTERNS = [
    re.compile(r"\bcons\.?\b", re.IGNORECASE),
    re.compile(r"\bconsent\b", re.IGNORECASE),
    re.compile(r"\binstr\.?\b", re.IGNORECASE),
    re.compile(r"\bdept\.?\s*ch\.?\b", re.IGNORECASE),
    re.compile(r"\bprog\.?\s*dir\.?\b", re.IGNORECASE),
    re.compile(r"\bdirector\b", re.IGNORECASE),
    re.compile(r"\bchair\b", re.IGNORECASE),
]
MAJOR_RESTRICTION_PATTERNS = [
    re.compile(r"\bdeclared\b.*\bmajor", re.IGNORECASE),
    re.compile(r"\bdeclared\b.*\bminor", re.IGNORECASE),
    re.compile(r"\b[A-Z]{2,8}\s+majors?\b(?!\s+courses?\b)"),
    re.compile(r"\b[A-Z]{2,8}\s+minors?\b(?!\s+courses?\b)"),
    re.compile(r"\bmajors?\s+(?:and|or)\s+minors?\b", re.IGNORECASE),
    re.compile(r"\brestricted to\b", re.IGNORECASE),
    re.compile(r"\bopen only to\b", re.IGNORECASE),
]
ADMITTED_PROGRAM_PATTERNS = [
    re.compile(r"\badmitted to\b", re.IGNORECASE),
    re.compile(r"\badmittance into\b", re.IGNORECASE),
    re.compile(r"\badmission to\b", re.IGNORECASE),
    re.compile(r"\baccepted into\b", re.IGNORECASE),
    re.compile(r"\benrolled in\b.*\bprogram\b", re.IGNORECASE),
]
COLLEGE_RESTRICTION_PATTERNS = [
    re.compile(r"\bcollege of\b", re.IGNORECASE),
    re.compile(r"\bklingler college\b", re.IGNORECASE),
    re.compile(r"\bopus college\b", re.IGNORECASE),
    re.compile(r"\benrolled in\b.*\bcollege\b", re.IGNORECASE),
]
PROGRAM_PROGRESS_PATTERNS = [
    re.compile(r"\bcompleted\s+\d+\s+credits?\s+in\s+program\b", re.IGNORECASE),
    re.compile(r"\bmust\s+have\s+completed\s+\d+\s+credits?\s+in\s+program\b", re.IGNORECASE),
    re.compile(r"\bstudent\s+must\s+have\s+completed\s+\d+\s+credits?\s+in\s+program\b", re.IGNORECASE),
]
PLACEMENT_PATTERNS = [
    re.compile(r"\bplacement\b", re.IGNORECASE),
]
MIN_GRADE_PATTERNS = [
    re.compile(r"\bgrade of\b", re.IGNORECASE),
    re.compile(r"\b[a-df]\s+or\s+better\b", re.IGNORECASE),
]
MIN_GPA_PATTERNS = [
    re.compile(r"\bgpa\b", re.IGNORECASE),
]
MAJOR_CREDIT_CAP_PATTERNS = [
    re.compile(r"\ba maximum of\b", re.IGNORECASE),
]
NOTE_ONLY_PATTERNS = [
    re.compile(r"\ba maximum of\b.*?(?:\bcount(?:ed)?\b|\btoward the\b)[^.]*\.", re.IGNORECASE),
    re.compile(r"[^.;]*\brecommended\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
    re.compile(r"[^.;]*\bcross-listed with\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
    re.compile(r"[^.;]*\bcredit is not given for both\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
    re.compile(r"[^.;]*\bcannot receive credit for both\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
    re.compile(r"[^.;]*\ba maximum of\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
    re.compile(r"[^.;]*\bnot eligible to enroll\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
    re.compile(r"[^.;]*\bprevious or subsequent enrollment in\b[^.;]*(?:[.;]|$)", re.IGNORECASE),
]
OTHER_REQUIREMENT_PATTERNS = [
    re.compile(r"\bequiv\.?\b", re.IGNORECASE),
    re.compile(r"\bcurrent certification\b", re.IGNORECASE),
    re.compile(r"\bcertification\b", re.IGNORECASE),
    re.compile(r"\bheritage\b", re.IGNORECASE),
    re.compile(r"\bnative\b", re.IGNORECASE),
    re.compile(r"\bcannot receive credit\b", re.IGNORECASE),
    re.compile(r"\bcredit is not given for both\b", re.IGNORECASE),
    re.compile(r"\bcross-listed with\b", re.IGNORECASE),
    re.compile(r"\bnot open to\b", re.IGNORECASE),
    re.compile(r"\bnot eligible to enroll\b", re.IGNORECASE),
    re.compile(r"\bprevious or subsequent enrollment in\b", re.IGNORECASE),
    re.compile(r"\bhigh level computer language\b", re.IGNORECASE),
    re.compile(r"\bconcurrent enrollment\b", re.IGNORECASE),
    re.compile(r"\bcourse in\b", re.IGNORECASE),
    re.compile(r"\bcourses in\b", re.IGNORECASE),
]
STANDING_PATTERNS = {
    1.0: [
        re.compile(r"\bfresh(?:man)?\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bfreshman\s+standing\b", re.IGNORECASE),
        re.compile(r"\bfirst-?year\s+standing\b", re.IGNORECASE),
        re.compile(r"\bfresh(?:man)?\.?\b.*\bstndg\.?\b", re.IGNORECASE),
    ],
    2.0: [
        re.compile(r"\bsoph\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bsophomore\s+standing\b", re.IGNORECASE),
        re.compile(r"\bsoph\.?\b.*\bstndg\.?\b", re.IGNORECASE),
    ],
    3.0: [
        re.compile(r"\bjr\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bjunior\s+standing\b", re.IGNORECASE),
        re.compile(r"\bjr\.?\b.*\bstndg\.?\b", re.IGNORECASE),
    ],
    4.0: [
        re.compile(r"\bsr\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bsenior\s+standing\b", re.IGNORECASE),
        re.compile(r"\bsr\.?\b.*\bstndg\.?\b", re.IGNORECASE),
    ],
}
COMPLEX_PATTERNS = [
    re.compile(r"\bat least\s+\d+\s+additional\b", re.IGNORECASE),
    re.compile(r"\bcompleted\s+\d+\s+credits?\b", re.IGNORECASE),
    re.compile(r"\badditional\s+[A-Z]{2,8}\s+major\s+courses?\b", re.IGNORECASE),
]
CHOOSE_N_PATTERNS = [
    re.compile(
        r"^(?:any\s+)?(?P<count>\d+|one|two|three|four|five)\s+courses?\s+from\s*:?\s*(?P<options>.+)$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^choose\s+(?P<count>\d+|one|two|three|four|five)\s+from\s*:?\s*(?P<options>.+)$",
        re.IGNORECASE,
    ),
]
SOFT_TAG_ORDER = [
    "major_restriction",
    "college_restriction",
    "admitted_program",
    "program_progress_requirement",
    "instructor_consent",
    "standing_requirement",
    "placement_required",
    "minimum_grade",
    "minimum_gpa",
    "may_be_concurrent",
    "other_requirements",
    "complex_hard_prereq",
]
LABEL_MAP = {
    "Prerequisite:": "prerequisite",
    "Corequisite:": "corequisite",
    "Level of Study:": "level_of_study",
    "Marquette Core Curriculum:": "mcc",
    "Interdisciplinary Studies:": "interdisciplinary",
    "Last four terms offered:": "last_terms",
    "Schedule of Classes": "schedule",
}


@dataclass
class CatalogEntry:
    course_code: str
    course_name: str
    credits: str
    level: str
    description_lines: list[str]
    prerequisite: str
    corequisite: str
    mcc_lines: list[str]
    interdisciplinary_lines: list[str]


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace("\xa0", " ")).strip()


def normalize_code(code: str) -> str:
    match = COURSE_CODE_RE.search(clean_text(code).upper())
    if not match:
        return ""
    return f"{match.group(1)} {match.group(2)}"


def dept_of(course_code: str) -> str:
    head = clean_text(course_code).split(" ", 1)[0].upper()
    return head.rstrip("I")


def unique_in_order(items: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        cleaned = clean_text(item)
        if not cleaned or cleaned in seen:
            continue
        out.append(cleaned)
        seen.add(cleaned)
    return out


def read_csv_rows(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def write_csv_rows(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore", restval="")
        writer.writeheader()
        writer.writerows(rows)


def parse_catalog_entries(text: str) -> list[CatalogEntry]:
    blocks: list[list[str]] = []
    current: list[str] | None = None

    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if COURSE_HEADER_RE.match(stripped):
            if current:
                blocks.append(current)
            current = [stripped]
            continue
        if current is not None:
            current.append(stripped)

    if current:
        blocks.append(current)

    entries: list[CatalogEntry] = []
    seen_codes: set[str] = set()

    for block in blocks:
        header = COURSE_HEADER_RE.match(block[0])
        if not header:
            continue

        course_code = header.group(1).strip()
        course_name = clean_text(header.group(2))
        credits = header.group(3).strip()
        level = str(int(header.group(1).split()[1][0]) * 1000)

        description_lines: list[str] = []
        prerequisite = ""
        corequisite = ""
        mcc_lines: list[str] = []
        interdisciplinary_lines: list[str] = []
        last_field = "description"

        for line in block[1:]:
            if not line:
                continue

            matched_label = None
            for label, field_name in LABEL_MAP.items():
                if line.startswith(label):
                    matched_label = (label, field_name)
                    break

            if matched_label is None:
                if last_field == "description":
                    description_lines.append(line)
                elif last_field == "prerequisite":
                    prerequisite = clean_text(f"{prerequisite} {line}")
                elif last_field == "corequisite":
                    corequisite = clean_text(f"{corequisite} {line}")
                elif last_field == "mcc" and mcc_lines:
                    mcc_lines[-1] = clean_text(f"{mcc_lines[-1]} {line}")
                elif last_field == "interdisciplinary" and interdisciplinary_lines:
                    interdisciplinary_lines[-1] = clean_text(f"{interdisciplinary_lines[-1]} {line}")
                continue

            label, field_name = matched_label
            last_field = field_name
            value = clean_text(line[len(label):])
            if field_name == "prerequisite":
                prerequisite = value
            elif field_name == "corequisite":
                corequisite = value
            elif field_name == "mcc":
                mcc_lines.append(value)
            elif field_name == "interdisciplinary":
                interdisciplinary_lines.append(value)

        if course_code in seen_codes:
            continue
        seen_codes.add(course_code)
        entries.append(
            CatalogEntry(
                course_code=course_code,
                course_name=course_name,
                credits=credits,
                level=level,
                description_lines=unique_in_order(description_lines),
                prerequisite=prerequisite,
                corequisite=corequisite,
                mcc_lines=unique_in_order(mcc_lines),
                interdisciplinary_lines=unique_in_order(interdisciplinary_lines),
            )
        )

    return entries


def derive_course_notes(entry: CatalogEntry) -> str:
    notes: list[str] = []
    for line in entry.description_lines:
        low = line.lower()
        if "grade assessment." in low and len(line.split()) <= 12:
            notes.append(line.rstrip(".") + ".")
    for value in entry.mcc_lines:
        notes.append(f"Marquette Core Curriculum: {value}")
    for value in entry.interdisciplinary_lines:
        notes.append(f"Interdisciplinary Studies: {value}")
    return "; ".join(unique_in_order(notes))


def derive_course_row(entry: CatalogEntry) -> dict[str, str]:
    return {
        "course_code": entry.course_code,
        "course_name": entry.course_name,
        "credits": entry.credits,
        "level": entry.level,
        "active": "True",
        "notes": derive_course_notes(entry),
        "elective_pool_tag": "biz_elective" if dept_of(entry.course_code) in BIZ_DEPTS else "",
        "description": clean_text(" ".join(entry.description_lines)),
    }


def add_tag(tags: list[str], tag: str) -> None:
    if tag not in tags:
        tags.append(tag)


def extract_codes(text: str) -> list[str]:
    codes: list[str] = []
    for match in COURSE_CODE_RE.finditer(str(text or "").upper()):
        code = f"{match.group(1)} {match.group(2)}"
        if code not in codes:
            codes.append(code)
    return codes


def normalize_clause_expression(text: str) -> str:
    codes = extract_codes(text)
    if not codes:
        return ""
    if re.search(r"\bor\b", text, re.IGNORECASE):
        return " or ".join(codes)
    if len(codes) == 1:
        return codes[0]
    return ";".join(codes)


CONCURRENT_CODE_ATOM = r"[A-Z]{2,7}I?\s+\d{4}H?"
CONCURRENT_CODE_EXPR = (
    rf"{CONCURRENT_CODE_ATOM}"
    rf"(?:\s*(?:,\s*|,?\s*(?:and|or)\s+){CONCURRENT_CODE_ATOM})*"
)
CONCURRENT_EXPR_PATTERNS = [
    re.compile(
        rf"(?:may|can|must)\s+be\s+taken\s+concurrent(?:ly)?\s+with\s+(?P<expr>{CONCURRENT_CODE_EXPR})",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?:taken|enrolled)\s+concurrent(?:ly)?\s+with\s+(?P<expr>{CONCURRENT_CODE_EXPR})",
        re.IGNORECASE,
    ),
    re.compile(
        rf"concurrent\s+enrollment\s+(?:with|in)\s+(?P<expr>{CONCURRENT_CODE_EXPR})",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?P<expr>{CONCURRENT_CODE_EXPR})"
        r"\s*,?\s*(?:either\s+)?"
        r"(?:\([^)]*(?:may|can|must)\s+be\s+taken\s+concurrent(?:ly)?[^)]*\)|"
        r"(?:both\s+of\s+)?which\s*,?\s*(?:is\s+the\s+only\s+prerequisite\s+course\s+that\s+)?"
        r"(?:may|can|must)\s+be\s+taken\s+concurrent(?:ly)?(?:\s+with[^;.]*)?|"
        r"(?:may|can|must)\s+be\s+taken\s+concurrent(?:ly)?(?:\s+with[^;.]*)?)",
        re.IGNORECASE,
    ),
]


def extract_concurrent(text: str) -> tuple[str, str]:
    concurrent_exprs: list[str] = []
    working = text

    while True:
        match = None
        for pattern in CONCURRENT_EXPR_PATTERNS:
            candidate = pattern.search(working)
            if candidate is None:
                continue
            if match is None or candidate.start() < match.start():
                match = candidate
        if not match:
            break
        expr = normalize_clause_expression(match.group("expr"))
        if expr and expr not in concurrent_exprs:
            concurrent_exprs.append(expr)
        start, end = match.span()
        working = clean_text(f"{working[:start]} {working[end:]}")

    working = re.sub(r"(?:^|[;,])\s*(?:and|or)\s*(?=$|[;,])", " ", working, flags=re.IGNORECASE)
    working = re.sub(r"\b(?:and|or)\s*$", "", working, flags=re.IGNORECASE)
    working = re.sub(r"\s*;\s*;\s*", "; ", working)
    return clean_text(working.strip(" ;,.")), ";".join(concurrent_exprs)


def strip_parenthetical_annotations(text: str) -> str:
    return clean_text(PAREN_ANNOTATION_RE.sub(" ", text))


def strip_note_only_segments(text: str) -> str:
    working = str(text or "")
    for pattern in NOTE_ONLY_PATTERNS:
        working = pattern.sub(" ", working)
    return clean_text(working)


def strip_placement_code_refs(text: str) -> str:
    return re.sub(
        r"\b[A-Z]{2,7}I?\s+\d{4}H?\s+placement\b",
        "placement",
        str(text or ""),
        flags=re.IGNORECASE,
    )


def has_pattern_match(text: str, patterns: list[re.Pattern[str]]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def is_soft_only_clause(text: str) -> bool:
    clause = strip_parenthetical_annotations(text)
    if not clause:
        return False
    soft_patterns = (
        INSTRUCTOR_PATTERNS
        + MAJOR_RESTRICTION_PATTERNS
        + ADMITTED_PROGRAM_PATTERNS
        + PLACEMENT_PATTERNS
        + MIN_GRADE_PATTERNS
        + MIN_GPA_PATTERNS
    )
    if has_pattern_match(clause, soft_patterns):
        return True
    if infer_min_standing(clause) > 0:
        return True
    return False


def is_benign_or_clause(text: str) -> bool:
    clause = strip_placement_code_refs(strip_parenthetical_annotations(text))
    if not clause or extract_codes(clause):
        return False
    if has_pattern_match(clause, INSTRUCTOR_PATTERNS):
        return True
    if has_pattern_match(clause, PLACEMENT_PATTERNS):
        if has_pattern_match(
            clause,
            ADMITTED_PROGRAM_PATTERNS + MIN_GRADE_PATTERNS + MIN_GPA_PATTERNS,
        ):
            return False
        return infer_min_standing(clause) == 0
    return False


def parse_clause_tokens(clause: str) -> list[str]:
    cleaned_clause = strip_placement_code_refs(clause)
    parts = re.split(r"\s*,\s*|\s+\band\b\s+", cleaned_clause, flags=re.IGNORECASE)
    tokens: list[str] = []

    for raw_part in parts:
        part = clean_text(raw_part).strip(" ,.")
        if not part:
            continue
        if re.match(r"^or\b", part, re.IGNORECASE):
            part = re.sub(r"^or\b", "", part, flags=re.IGNORECASE).strip(" ,.")
        codes = extract_codes(part)
        if not codes:
            continue
        if re.search(r"\bor\b", part, re.IGNORECASE) and len(codes) >= 2:
            tokens.append(" or ".join(codes))
        else:
            tokens.extend(codes)

    return unique_in_order(tokens)


def build_choose_n_expression(clause: str) -> str:
    for pattern in CHOOSE_N_PATTERNS:
        match = pattern.match(clause)
        if not match:
            continue
        codes = extract_codes(match.group("options"))
        if not codes:
            return ""
        count_token = clean_text(match.group("count"))
        label = "course" if count_token == "one" or count_token == "1" else "courses"
        return f"{count_token.title()} {label} from: {' or '.join(codes)}"
    return ""


def build_hard_prereq(text: str) -> tuple[str, bool, bool]:
    clauses = [clean_text(part).rstrip(".").strip() for part in text.split(";") if clean_text(part)]
    tokens: list[str] = []
    complex_flag = False
    alternative_complex = False
    saw_code_clause = False
    choose_n_expr = ""

    for raw_clause in clauses:
        clause = strip_placement_code_refs(strip_parenthetical_annotations(raw_clause))
        leading_or = False
        if re.match(r"^or\b", clause, re.IGNORECASE):
            leading_or = True
            clause = re.sub(r"^or\b", "", clause, flags=re.IGNORECASE).strip(" ,")

        choose_n_clause = build_choose_n_expression(clause)
        if choose_n_clause:
            if saw_code_clause or tokens:
                complex_flag = True
                alternative_complex = True
            else:
                choose_n_expr = choose_n_clause
                saw_code_clause = True
            continue

        if any(pattern.search(raw_clause) for pattern in COMPLEX_PATTERNS):
            complex_flag = True

        clause_codes = extract_codes(clause)
        if leading_or and saw_code_clause:
            if clause_codes or not is_benign_or_clause(raw_clause):
                complex_flag = True
                if clause_codes or not is_benign_or_clause(raw_clause):
                    alternative_complex = True

        clause_tokens = parse_clause_tokens(clause)
        if clause_tokens:
            tokens.extend(clause_tokens)
            saw_code_clause = True

    if choose_n_expr and tokens:
        complex_flag = True
        alternative_complex = True
    ordered = unique_in_order(tokens)
    if choose_n_expr and not alternative_complex and not ordered:
        return choose_n_expr, complex_flag, alternative_complex
    return (";".join(ordered) if ordered else "none"), complex_flag, alternative_complex


def infer_min_standing(text: str) -> float:
    for standing, patterns in STANDING_PATTERNS.items():
        if any(pattern.search(text) for pattern in patterns):
            return standing
    lowered = text.lower()
    if "standing" in lowered or "stndg" in lowered:
        if re.search(r"\bfresh(?:man)?\b|\bfirst-?year\b", lowered):
            return 1.0
        if re.search(r"\bsoph", lowered):
            return 2.0
        if re.search(r"\bjr\b|\bjunior\b", lowered):
            return 3.0
        if re.search(r"\bsr\b|\bsenior\b", lowered):
            return 4.0
    return 0.0


def catalog_prereq_raw(entry: CatalogEntry) -> str:
    parts = [clean_text(entry.prerequisite), clean_text(entry.corequisite)]
    joined = "; ".join([part for part in parts if part])
    if not joined:
        return ""
    return joined.rstrip(".") + "."


def split_soft_segments(raw_text: str) -> list[str]:
    segments: list[str] = []
    for part in re.split(r"\s*;\s*", clean_text(raw_text)):
        cleaned = clean_text(part).strip(" ;")
        if not cleaned:
            continue
        subparts = re.split(r"(?<=[.])\s+(?=[A-Z])", cleaned)
        for subpart in subparts:
            item = clean_text(subpart).strip(" ;")
            if item:
                segments.append(item.rstrip("."))
    return unique_in_order(segments)


def collect_segments(raw_text: str, predicate) -> str:
    return "; ".join(
        unique_in_order(
            [
                segment
                for segment in split_soft_segments(raw_text)
                if not has_pattern_match(segment, MAJOR_CREDIT_CAP_PATTERNS) and predicate(segment)
            ]
        )
    )


def normalize_soft_tags(raw_tags: str) -> list[str]:
    tags: list[str] = []
    for raw_tag in str(raw_tags or "").replace(",", ";").split(";"):
        tag = clean_text(raw_tag)
        if not tag:
            continue
        if tag == "hard_prereq_complex":
            tag = "complex_hard_prereq"
        add_tag(tags, tag)
    return tags


def build_soft_detail_columns(raw_text: str, tags: list[str]) -> dict[str, str]:
    raw = clean_text(raw_text)
    details = {
        "catalog_prereq_raw": raw,
        "soft_prereq_major_restriction": collect_segments(
            raw, lambda segment: has_pattern_match(segment, MAJOR_RESTRICTION_PATTERNS)
        ),
        "soft_prereq_instructor_consent": collect_segments(
            raw, lambda segment: has_pattern_match(segment, INSTRUCTOR_PATTERNS)
        ),
        "soft_prereq_admitted_program": collect_segments(
            raw, lambda segment: has_pattern_match(segment, ADMITTED_PROGRAM_PATTERNS)
        ),
        "soft_prereq_college_restriction": collect_segments(
            raw, lambda segment: has_pattern_match(segment, COLLEGE_RESTRICTION_PATTERNS)
        ),
        "soft_prereq_program_progress_requirement": collect_segments(
            raw, lambda segment: has_pattern_match(segment, PROGRAM_PROGRESS_PATTERNS)
        ),
        "soft_prereq_standing_requirement": collect_segments(
            raw, lambda segment: infer_min_standing(segment) > 0
        ),
        "soft_prereq_placement_required": collect_segments(
            raw, lambda segment: has_pattern_match(segment, PLACEMENT_PATTERNS)
        ),
        "soft_prereq_minimum_grade": collect_segments(
            raw, lambda segment: has_pattern_match(segment, MIN_GRADE_PATTERNS)
        ),
        "soft_prereq_minimum_gpa": collect_segments(
            raw, lambda segment: has_pattern_match(segment, MIN_GPA_PATTERNS)
        ),
        "soft_prereq_may_be_concurrent": collect_segments(
            raw, lambda segment: "concurrent" in segment.lower()
        ),
        "soft_prereq_other_requirements": "",
        "soft_prereq_complex_hard_prereq": raw if "complex_hard_prereq" in tags else "",
    }

    assigned_segments: set[str] = set()
    for key, value in details.items():
        if key in {"catalog_prereq_raw", "soft_prereq_other_requirements", "soft_prereq_complex_hard_prereq"}:
            continue
        for piece in [clean_text(part) for part in str(value).split(";") if clean_text(part)]:
            assigned_segments.add(piece)

    other_segments: list[str] = []
    for segment in split_soft_segments(raw):
        if has_pattern_match(segment, MAJOR_CREDIT_CAP_PATTERNS):
            continue
        if segment in assigned_segments:
            continue
        if has_pattern_match(segment, OTHER_REQUIREMENT_PATTERNS):
            other_segments.append(segment)
            continue
        if not extract_codes(segment):
            other_segments.append(segment)
    details["soft_prereq_other_requirements"] = "; ".join(unique_in_order(other_segments))
    return details


def derive_prereq_row(entry: CatalogEntry) -> dict[str, str]:
    prereq_text = clean_text(entry.prerequisite)
    coreq_text = clean_text(entry.corequisite)
    raw_text = prereq_text or coreq_text
    soft_detection_text = strip_parenthetical_annotations(raw_text)
    if not raw_text:
        return {
            "course_code": entry.course_code,
            "hard_prereq": "none",
            "soft_prereq": "",
            "concurrent_with": "",
            "min_standing": "0.0",
            "notes": "",
        }

    tags: list[str] = []

    if has_pattern_match(soft_detection_text, INSTRUCTOR_PATTERNS):
        add_tag(tags, "instructor_consent")
    if has_pattern_match(soft_detection_text, MAJOR_RESTRICTION_PATTERNS):
        add_tag(tags, "major_restriction")
    if has_pattern_match(soft_detection_text, COLLEGE_RESTRICTION_PATTERNS):
        add_tag(tags, "college_restriction")
    if has_pattern_match(soft_detection_text, ADMITTED_PROGRAM_PATTERNS):
        add_tag(tags, "admitted_program")
    if has_pattern_match(soft_detection_text, PROGRAM_PROGRESS_PATTERNS):
        add_tag(tags, "program_progress_requirement")
    if has_pattern_match(soft_detection_text, PLACEMENT_PATTERNS):
        add_tag(tags, "placement_required")
    if has_pattern_match(soft_detection_text, MIN_GRADE_PATTERNS):
        add_tag(tags, "minimum_grade")
    if has_pattern_match(soft_detection_text, MIN_GPA_PATTERNS):
        add_tag(tags, "minimum_gpa")

    min_standing = infer_min_standing(soft_detection_text)
    if min_standing > 0:
        add_tag(tags, "standing_requirement")

    hard_source, concurrent_with = extract_concurrent(raw_text)
    if coreq_text:
        coreq_expr = normalize_clause_expression(coreq_text)
        if coreq_expr:
            concurrent_with = ";".join(unique_in_order(
                [p for p in [concurrent_with, coreq_expr] if p]
            ))
    if concurrent_with:
        add_tag(tags, "may_be_concurrent")

    hard_source = strip_note_only_segments(hard_source)
    hard_prereq, complex_flag, alternative_complex = build_hard_prereq(hard_source)
    if concurrent_with and re.search(
        r"(?:^|;)\s*or\s+[A-Z]{2,7}I?\s+\d{4}H?\b",
        hard_source,
        re.IGNORECASE,
    ):
        complex_flag = True
        alternative_complex = True
    if alternative_complex:
        hard_prereq = "none"
    if complex_flag:
        add_tag(tags, "complex_hard_prereq")

    notes = ""
    if any(tag in tags for tag in {
        "major_restriction",
        "college_restriction",
        "admitted_program",
        "program_progress_requirement",
        "instructor_consent",
        "standing_requirement",
        "placement_required",
        "minimum_grade",
        "minimum_gpa",
        "may_be_concurrent",
        "other_requirements",
        "complex_hard_prereq",
    }):
        notes = raw_text.rstrip(".") + "."

    detail_columns = build_soft_detail_columns(catalog_prereq_raw(entry), tags)
    if detail_columns["soft_prereq_other_requirements"]:
        add_tag(tags, "other_requirements")

    ordered_tags = [tag for tag in SOFT_TAG_ORDER if tag in tags]
    return {
        "course_code": entry.course_code,
        "hard_prereq": hard_prereq,
        "soft_prereq": ";".join(ordered_tags),
        "concurrent_with": concurrent_with,
        "min_standing": f"{min_standing:.1f}",
        "notes": notes,
    }


def rebuild_rows(index: dict[str, dict[str, str]], original_order: list[str]) -> list[dict[str, str]]:
    rows = [index[code] for code in original_order if code in index]
    seen = set(original_order)
    for code, row in index.items():
        if code not in seen:
            rows.append(row)
    return rows


def should_skip(code: str) -> bool:
    normalized = clean_text(code).upper()
    return any(normalized.startswith(prefix) for prefix in SKIP_PREFIXES)


def build_hard_row(
    course_code: str,
    hard_prereq: str,
    concurrent_with: str,
    min_standing: str,
    existing_row: dict[str, str] | None = None,
) -> dict[str, str]:
    row = {field: "" for field in HARD_PREREQ_FIELDS}
    row["course_code"] = course_code
    row["hard_prereq"] = clean_text(hard_prereq) or "none"
    row["concurrent_with"] = clean_text(concurrent_with)
    row["min_standing"] = clean_text(min_standing) or "0.0"
    if existing_row:
        for field in HARD_PREREQ_FIELDS:
            if not clean_text(row.get(field)) and clean_text(existing_row.get(field)):
                row[field] = clean_text(existing_row.get(field))
    return row


def build_soft_row(
    course_code: str,
    soft_prereq: str,
    raw_catalog: str,
    notes: str,
    existing_row: dict[str, str] | None = None,
) -> dict[str, str]:
    tags = normalize_soft_tags(soft_prereq)
    raw_text = clean_text(raw_catalog) or clean_text((existing_row or {}).get("catalog_prereq_raw", ""))
    details = build_soft_detail_columns(raw_text, tags)
    if details["soft_prereq_other_requirements"]:
        add_tag(tags, "other_requirements")
    if details["soft_prereq_complex_hard_prereq"]:
        add_tag(tags, "complex_hard_prereq")

    row = {field: "" for field in SOFT_PREREQ_FIELDS}
    row["course_code"] = course_code
    row["soft_prereq"] = ";".join([tag for tag in SOFT_TAG_ORDER if tag in tags])
    row["notes"] = clean_text(notes) or clean_text((existing_row or {}).get("notes", ""))
    row.update(details)
    if existing_row:
        if not clean_text(row.get("catalog_prereq_raw")) and clean_text(existing_row.get("catalog_prereq_raw")):
            row["catalog_prereq_raw"] = clean_text(existing_row.get("catalog_prereq_raw"))
    return row


def load_existing_prereq_state() -> tuple[
    dict[str, dict[str, str]],
    dict[str, dict[str, str]],
    list[str],
]:
    hard_index: dict[str, dict[str, str]] = {}
    soft_index: dict[str, dict[str, str]] = {}
    order: list[str] = []

    if HARD_PREREQS_CSV.exists():
        hard_rows, _ = read_csv_rows(HARD_PREREQS_CSV)
        for row in hard_rows:
            code = clean_text(row.get("course_code"))
            if not code:
                continue
            hard_index[code] = build_hard_row(
                code,
                row.get("hard_prereq", "none"),
                row.get("concurrent_with", ""),
                row.get("min_standing", "0.0"),
            )
            order.append(code)

    if SOFT_PREREQS_CSV.exists():
        soft_rows, _ = read_csv_rows(SOFT_PREREQS_CSV)
        for row in soft_rows:
            code = clean_text(row.get("course_code"))
            if not code:
                continue
            normalized = {field: clean_text(row.get(field, "")) for field in SOFT_PREREQ_FIELDS}
            normalized["course_code"] = code
            normalized["soft_prereq"] = ";".join(normalize_soft_tags(row.get("soft_prereq", "")))
            soft_index[code] = normalized
            if code not in order:
                order.append(code)

    if not hard_index and not soft_index and LEGACY_PREREQS_CSV.exists():
        legacy_rows, _ = read_csv_rows(LEGACY_PREREQS_CSV)
        for row in legacy_rows:
            code = clean_text(row.get("course_code"))
            if not code:
                continue
            hard = row.get("hard_prereq", row.get("prerequisites", "none"))
            soft = row.get("soft_prereq", row.get("prereq_warnings", ""))
            notes = clean_text(row.get("notes", ""))
            hard_index[code] = build_hard_row(
                code,
                hard,
                row.get("concurrent_with", ""),
                row.get("min_standing", "0.0"),
            )
            soft_index[code] = build_soft_row(
                code,
                soft,
                notes,
                notes,
            )
            order.append(code)

    return hard_index, soft_index, unique_in_order(order)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit catalog CSVs from full_course_database.md")
    parser.add_argument("--apply", action="store_true", help="Write changes to CSV files.")
    args = parser.parse_args()

    source_text = SOURCE_MD.read_text(encoding="utf-8", errors="replace")
    entries = parse_catalog_entries(source_text)
    entry_by_code = {entry.course_code: entry for entry in entries}

    course_rows, course_fields = read_csv_rows(COURSES_CSV)
    hard_index, soft_index, existing_prereq_order = load_existing_prereq_state()

    course_index = {clean_text(row.get("course_code")): dict(row) for row in course_rows}
    original_course_order = [clean_text(row.get("course_code")) for row in course_rows if clean_text(row.get("course_code"))]

    updated_courses = 0
    added_courses = 0
    updated_hard = 0
    updated_soft = 0
    added_hard = 0
    added_soft = 0

    for code, entry in entry_by_code.items():
        if should_skip(code):
            continue

        new_course = derive_course_row(entry)
        existing_course = course_index.get(code)
        if existing_course is None:
            course_index[code] = new_course
            added_courses += 1
        elif any(clean_text(existing_course.get(k, "")) != clean_text(new_course.get(k, "")) for k in new_course):
            merged = dict(existing_course)
            merged.update(new_course)
            course_index[code] = merged
            updated_courses += 1

        derived = derive_prereq_row(entry)
        new_hard = build_hard_row(
            code,
            derived["hard_prereq"],
            derived["concurrent_with"],
            derived["min_standing"],
            existing_row=hard_index.get(code),
        )
        new_soft = build_soft_row(
            code,
            derived["soft_prereq"],
            catalog_prereq_raw(entry),
            derived["notes"],
            existing_row=soft_index.get(code),
        )

        existing_hard = hard_index.get(code)
        if existing_hard is None:
            hard_index[code] = new_hard
            added_hard += 1
        elif any(clean_text(existing_hard.get(k, "")) != clean_text(new_hard.get(k, "")) for k in HARD_PREREQ_FIELDS):
            hard_index[code] = new_hard
            updated_hard += 1

        existing_soft = soft_index.get(code)
        if existing_soft is None:
            soft_index[code] = new_soft
            added_soft += 1
        elif any(clean_text(existing_soft.get(k, "")) != clean_text(new_soft.get(k, "")) for k in SOFT_PREREQ_FIELDS):
            soft_index[code] = new_soft
            updated_soft += 1

    missing_from_md = sorted(code for code in course_index if code not in entry_by_code)

    for code in [c for c in unique_in_order(existing_prereq_order + original_course_order) if c]:
        if code in entry_by_code and not should_skip(code):
            continue
        existing_hard = hard_index.get(code)
        existing_soft = soft_index.get(code)
        if existing_hard is not None:
            hard_index[code] = build_hard_row(
                code,
                existing_hard.get("hard_prereq", "none"),
                existing_hard.get("concurrent_with", ""),
                existing_hard.get("min_standing", "0.0"),
            )
        if existing_soft is not None:
            soft_index[code] = build_soft_row(
                code,
                existing_soft.get("soft_prereq", ""),
                existing_soft.get("catalog_prereq_raw", existing_soft.get("notes", "")),
                existing_soft.get("notes", ""),
                existing_row=existing_soft,
            )

    rebuilt_courses = rebuild_rows(course_index, original_course_order)
    prereq_order = unique_in_order(existing_prereq_order + original_course_order)
    rebuilt_hard = rebuild_rows(hard_index, prereq_order)
    rebuilt_soft = rebuild_rows(soft_index, prereq_order)

    print(f"parsed entries: {len(entries)}")
    print(f"courses added: {added_courses}, updated: {updated_courses}")
    print(f"hard prereqs added: {added_hard}, updated: {updated_hard}")
    print(f"soft prereqs added: {added_soft}, updated: {updated_soft}")
    print(f"preserved missing-from-md codes ({len(missing_from_md)}): {missing_from_md}")

    if args.apply:
        write_csv_rows(COURSES_CSV, rebuilt_courses, course_fields)
        write_csv_rows(HARD_PREREQS_CSV, rebuilt_hard, HARD_PREREQ_FIELDS)
        write_csv_rows(SOFT_PREREQS_CSV, rebuilt_soft, SOFT_PREREQ_FIELDS)
        if LEGACY_PREREQS_CSV.exists():
            try:
                LEGACY_PREREQS_CSV.unlink()
            except OSError as exc:
                print(
                    "notice: could not remove legacy "
                    f"{LEGACY_PREREQS_CSV.name}: {type(exc).__name__}: {exc}"
                )
        print("wrote data/courses.csv, data/course_hard_prereqs.csv, and data/course_soft_prereqs.csv")
    else:
        print("dry run only; no files written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
