"""One-time full Marquette catalog scraper.

Scrapes bulletin subject pages and writes review artifacts to:
- all_courses_raw.csv
- course_prereqs_proposed.csv
- scrape_summary.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import time
import urllib.parse
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


BASE_URL = "https://bulletin.marquette.edu"
INDEX_URL = f"{BASE_URL}/course-descriptions/"
DEFAULT_OUT_DIR = Path("data/webscrape_1")
DEFAULT_RAW_OUT_NAME = "all_courses_raw.csv"
DEFAULT_PREREQS_OUT_NAME = "course_prereqs_proposed.csv"
DEFAULT_SUMMARY_OUT_NAME = "scrape_summary.json"

REQUEST_TIMEOUT = 30.0
RETRY_COUNT = 5
REQUEST_DELAY_SECONDS = 0.5
MAX_COURSE_FAILURES = 40

COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,5})\s*([0-9]{4}[A-Z]?)\b")
SUBJECT_TEXT_CODE_RE = re.compile(r"\(([A-Z]{2,5})\)")
SEMESTER_LABEL_RE = re.compile(r"^(Spring|Summer|Fall)\s+\d{4}$", re.IGNORECASE)

NONE_TEXTS = {"", "none", "none.", "none listed", "n/a"}

INSTRUCTOR_PATTERNS = [
    re.compile(r"\bcons\.?\s*of\s*instr\.?\b", re.IGNORECASE),
    re.compile(r"\bconsent\s+required\b", re.IGNORECASE),
    re.compile(r"\bconsent\s+of\s+instructor\b", re.IGNORECASE),
    re.compile(r"\binstructor\s+consent\b", re.IGNORECASE),
    re.compile(r"\bcons\.?\s*of\s*prog\.?\s*dir\.?\b", re.IGNORECASE),
    re.compile(r"\bconsent\s+of\s+program\s+director\b", re.IGNORECASE),
]
MAJOR_RESTRICTION_PATTERNS = [
    re.compile(r"\bdeclared\b.*\bmajor", re.IGNORECASE),
    re.compile(r"\bdeclared\b.*\bminor", re.IGNORECASE),
    re.compile(r"\bmajor\s+restriction\b", re.IGNORECASE),
    re.compile(r"\bprogram\s+restriction\b", re.IGNORECASE),
    re.compile(r"\badmitted\b", re.IGNORECASE),
    re.compile(r"\bopen\s+only\s+to\b", re.IGNORECASE),
]
CONCURRENT_PATTERNS = [
    re.compile(r"\bwhich\s+may\s+be\s+taken\s+concurrently\b", re.IGNORECASE),
    re.compile(r"\bmay\s+be\s+taken\s+concurrently\b", re.IGNORECASE),
    re.compile(r"\bmay\s+be\s+concurrent\b", re.IGNORECASE),
]
STANDING_PATTERNS = {
    2.0: [
        re.compile(r"\bsoph\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bsophomore\s+standing\b", re.IGNORECASE),
    ],
    3.0: [
        re.compile(r"\bjr\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bjunior\s+standing\b", re.IGNORECASE),
    ],
    4.0: [
        re.compile(r"\bsr\.?\s*stndg\.?\b", re.IGNORECASE),
        re.compile(r"\bsenior\s+standing\b", re.IGNORECASE),
    ],
}
HARD_COMPLEX_PATTERNS = [
    re.compile(r"\bchoose\b", re.IGNORECASE),
    re.compile(r"\bone\s+of\s+the\s+following\b", re.IGNORECASE),
    re.compile(r"\btwo\s+of\s+the\s+following\b", re.IGNORECASE),
    re.compile(r"\bthree\s+of\s+the\s+following\b", re.IGNORECASE),
    re.compile(r"\bminimum\s+grade\b", re.IGNORECASE),
    re.compile(r"\bco-?req\b", re.IGNORECASE),
    re.compile(r"\bcoreq\b", re.IGNORECASE),
    re.compile(r"\bplacement\b", re.IGNORECASE),
]
WARNING_TAG_ORDER = [
    "major_restriction",
    "instructor_consent",
    "standing_requirement",
    "may_be_concurrent",
    "hard_prereq_complex",
]
NOTE_HINT_PATTERNS = [
    re.compile(r"\bdeclared\b", re.IGNORECASE),
    re.compile(r"\bmajor\b", re.IGNORECASE),
    re.compile(r"\bminor\b", re.IGNORECASE),
    re.compile(r"\bprogram\b", re.IGNORECASE),
    re.compile(r"\bcons", re.IGNORECASE),
    re.compile(r"\bstanding\b", re.IGNORECASE),
    re.compile(r"\bstndg\b", re.IGNORECASE),
    re.compile(r"\bconcurrent\b", re.IGNORECASE),
    re.compile(r"\bpermission\b", re.IGNORECASE),
]


def _require_beautifulsoup():
    try:
        from bs4 import BeautifulSoup as _BeautifulSoup
    except ImportError as exc:  # pragma: no cover - dependency error path
        raise RuntimeError(
            "Missing dependency beautifulsoup4. Install once with: pip install beautifulsoup4"
        ) from exc
    return _BeautifulSoup


@dataclass(frozen=True)
class SubjectInfo:
    slug: str
    code: str
    label: str
    url: str


@dataclass
class ParsedPrereq:
    prerequisites: str
    prereq_warnings: str
    concurrent_with: str
    min_standing: str
    notes: str
    warning_text: str
    has_parseable_codes: bool
    extracted_codes: list[str]


@dataclass
class ScrapedCourse:
    course_code: str
    course_name: str
    credits: str
    level: str
    active: bool
    notes: str
    elective_pool_tag: str
    description: str
    prerequisites_raw: str
    last_four_terms: str
    source_slug: str
    first_seen_index: int


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "").replace("\xa0", " ")).strip()


def normalize_course_code(text: str) -> str:
    cleaned = clean_text(text).upper()
    match = COURSE_CODE_RE.search(cleaned)
    if not match:
        return ""
    return f"{match.group(1)} {match.group(2)}"


def build_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            )
        }
    )
    return session


def request_text(session: requests.Session, url: str, *, timeout: float, retries: int) -> str:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            response = session.get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except requests.RequestException as exc:
            last_error = exc
            if attempt == retries:
                break
            wait_seconds = min(4.0, 0.35 * (2 ** (attempt - 1)))
            print(f"[retry] GET {url} attempt {attempt}/{retries - 1} failed: {exc}")
            time.sleep(wait_seconds)
    raise RuntimeError(f"Failed GET after retries: {url}") from last_error


def parse_subject_index(index_html: str) -> list[SubjectInfo]:
    BeautifulSoup = _require_beautifulsoup()
    soup = BeautifulSoup(index_html, "html.parser")
    by_slug: dict[str, SubjectInfo] = {}

    for link in soup.select("a[href*='/course-descriptions/']"):
        href = clean_text(link.get("href", ""))
        if not href:
            continue

        absolute = urllib.parse.urljoin(INDEX_URL, href)
        parsed = urllib.parse.urlparse(absolute)
        path_parts = [part for part in parsed.path.split("/") if part]
        if len(path_parts) != 2 or path_parts[0] != "course-descriptions":
            continue

        slug = path_parts[1].strip().lower()
        if not slug:
            continue

        label = clean_text(link.get_text(" ", strip=True))
        code_match = SUBJECT_TEXT_CODE_RE.search(label)
        code = code_match.group(1).upper() if code_match else slug.upper()
        normalized_url = f"{BASE_URL}/course-descriptions/{slug}/"
        if slug not in by_slug:
            by_slug[slug] = SubjectInfo(slug=slug, code=code, label=label or slug, url=normalized_url)

    return sorted(by_slug.values(), key=lambda item: item.slug)


def parse_credits(raw_credits_text: str) -> str:
    cleaned = clean_text(raw_credits_text)
    if cleaned.startswith("(") and cleaned.endswith(")"):
        cleaned = cleaned[1:-1].strip()

    cleaned = re.sub(r"\bcredit(s)?\b", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = cleaned.replace("–", "-").replace("—", "-")
    cleaned = re.sub(r"\s*-\s*", "-", cleaned)
    cleaned = clean_text(cleaned)
    if not cleaned:
        return ""

    if re.fullmatch(r"\d+(?:\.\d+)?", cleaned):
        as_float = float(cleaned)
        if as_float.is_integer():
            return str(int(as_float))
        return cleaned
    return cleaned


def has_numeric_credits(credits: str) -> bool:
    return bool(re.fullmatch(r"\d+(?:\.\d+)?", clean_text(credits)))


def derive_level_from_code(course_code: str) -> str:
    normalized = normalize_course_code(course_code)
    match = COURSE_CODE_RE.search(normalized)
    if not match:
        return ""
    num = match.group(2)
    if not num:
        return ""
    return str(int(num[0]) * 1000)


def parse_prereq_text(raw_text: str) -> ParsedPrereq:
    prereq_text = clean_text(raw_text)
    prereq_text = re.sub(r"^Prerequisite(s)?:\s*", "", prereq_text, flags=re.IGNORECASE).strip()
    prereq_text = prereq_text.rstrip(".").strip()

    if prereq_text.lower() in NONE_TEXTS:
        return ParsedPrereq(
            prerequisites="none",
            prereq_warnings="",
            concurrent_with="",
            min_standing="0.0",
            notes="",
            warning_text="",
            has_parseable_codes=False,
            extracted_codes=[],
        )

    tags: set[str] = set()
    for pattern in INSTRUCTOR_PATTERNS:
        if pattern.search(prereq_text):
            tags.add("instructor_consent")
            break
    for pattern in MAJOR_RESTRICTION_PATTERNS:
        if pattern.search(prereq_text):
            tags.add("major_restriction")
            break
    if any(pattern.search(prereq_text) for pattern in CONCURRENT_PATTERNS):
        tags.add("may_be_concurrent")

    standing_matches: set[float] = set()
    for standing_value, patterns in STANDING_PATTERNS.items():
        if any(pattern.search(prereq_text) for pattern in patterns):
            standing_matches.add(standing_value)
    standing_lower = prereq_text.lower()
    if re.search(r"\b(stndg|standing)\b", standing_lower):
        if re.search(r"\bsoph(?:omore)?\.?\b", standing_lower):
            standing_matches.add(2.0)
        if re.search(r"\b(jr|junior)\.?\b", standing_lower):
            standing_matches.add(3.0)
        if re.search(r"\b(sr|senior)\.?\b", standing_lower):
            standing_matches.add(4.0)
    # Standing text communicates a minimum threshold. If multiple standing
    # levels appear ("junior or senior standing"), keep the lower bound.
    min_standing = min(standing_matches) if standing_matches else 0.0
    if min_standing > 0.0:
        tags.add("standing_requirement")

    clauses = [clean_text(part).rstrip(".").strip() for part in prereq_text.split(";")]
    prereq_tokens: list[str] = []
    extracted_codes: list[str] = []
    for clause in clauses:
        if not clause:
            continue
        codes_in_clause = []
        for match in COURSE_CODE_RE.finditer(clause.upper()):
            code = f"{match.group(1)} {match.group(2)}"
            if code not in codes_in_clause:
                codes_in_clause.append(code)
            if code not in extracted_codes:
                extracted_codes.append(code)
        if not codes_in_clause:
            continue
        if re.search(r"\bor\b", clause, re.IGNORECASE) and len(codes_in_clause) >= 2:
            prereq_tokens.append(" or ".join(codes_in_clause))
        else:
            prereq_tokens.extend(codes_in_clause)

    prerequisites = ";".join(prereq_tokens) if prereq_tokens else "none"
    has_parseable_codes = bool(prereq_tokens)

    concurrent_codes: list[str] = []
    if "may_be_concurrent" in tags:
        for match in re.finditer(
            r"([A-Z]{2,5}\s*[0-9]{4}[A-Z]?)\s*(?:which\s+)?may\s+be\s+taken\s+concurrently",
            prereq_text,
            flags=re.IGNORECASE,
        ):
            code = normalize_course_code(match.group(1))
            if code and code not in concurrent_codes:
                concurrent_codes.append(code)
        if not concurrent_codes and extracted_codes:
            concurrent_codes.append(extracted_codes[0])
    concurrent_with = ";".join(concurrent_codes)

    for pattern in HARD_COMPLEX_PATTERNS:
        if pattern.search(prereq_text) and not has_parseable_codes:
            tags.add("hard_prereq_complex")
            break

    note_parts: list[str] = []
    for clause in clauses:
        if not clause:
            continue
        has_course_code = bool(COURSE_CODE_RE.search(clause.upper()))
        has_hint = any(pattern.search(clause) for pattern in NOTE_HINT_PATTERNS)
        if (not has_course_code) or has_hint:
            if clause not in note_parts:
                note_parts.append(clause)
    notes = "; ".join(note_parts)

    ordered_tags = [tag for tag in WARNING_TAG_ORDER if tag in tags]
    return ParsedPrereq(
        prerequisites=prerequisites,
        prereq_warnings=";".join(ordered_tags),
        concurrent_with=concurrent_with,
        min_standing=f"{min_standing:.1f}",
        notes=notes,
        warning_text="",
        has_parseable_codes=has_parseable_codes,
        extracted_codes=extracted_codes,
    )


def _select_text(node, selector: str) -> str:
    selected = node.select_one(selector)
    if selected is None:
        return ""
    return clean_text(selected.get_text(" ", strip=True))


def parse_subject_courses(
    subject: SubjectInfo,
    subject_html: str,
    *,
    start_index: int,
) -> tuple[list[ScrapedCourse], list[dict[str, str]]]:
    BeautifulSoup = _require_beautifulsoup()
    soup = BeautifulSoup(subject_html, "html.parser")
    blocks = soup.select("div.courseblock")

    courses: list[ScrapedCourse] = []
    failures: list[dict[str, str]] = []
    index_cursor = start_index

    if not blocks:
        failures.append(
            {
                "source_slug": subject.slug,
                "reason": "No course blocks found on subject page",
                "context": subject.url,
            }
        )
        return courses, failures

    for block in blocks:
        try:
            raw_code = _select_text(block, "span.text.detail-code > strong")
            course_code = normalize_course_code(raw_code)
            if not course_code:
                failures.append(
                    {
                        "source_slug": subject.slug,
                        "reason": "Missing or invalid course code",
                        "context": raw_code or "(empty)",
                    }
                )
                continue

            course_name = _select_text(block, "span.text.detail-title > strong")
            credits = parse_credits(_select_text(block, "span.text.detail-hours_html > strong"))
            level = derive_level_from_code(course_code)
            description = _select_text(block, "div.courseblockextra.noindent")
            prereq_raw = _select_text(block, "span.text.detail-prereq")
            core_tags = _select_text(block, "span.text.detail-core")
            last_four_terms = _select_text(block, "span.text.detail-last_four_terms_offered")

            courses.append(
                ScrapedCourse(
                    course_code=course_code,
                    course_name=course_name,
                    credits=credits,
                    level=level,
                    active=True,
                    notes=core_tags,
                    elective_pool_tag="",
                    description=description,
                    prerequisites_raw=prereq_raw,
                    last_four_terms=last_four_terms,
                    source_slug=subject.slug,
                    first_seen_index=index_cursor,
                )
            )
            index_cursor += 1
        except Exception as exc:  # pragma: no cover - defensive parse branch
            failures.append(
                {
                    "source_slug": subject.slug,
                    "reason": f"Block parse error: {type(exc).__name__}",
                    "context": str(exc),
                }
            )
    return courses, failures


def _score_course_for_dedupe(course: ScrapedCourse) -> tuple[int, int, int, int]:
    prereq_meta = parse_prereq_text(course.prerequisites_raw)
    return (
        1 if clean_text(course.description) else 0,
        1 if prereq_meta.has_parseable_codes else 0,
        1 if has_numeric_credits(course.credits) else 0,
        1 if clean_text(course.course_name) else 0,
    )


def dedupe_courses(courses: list[ScrapedCourse]) -> tuple[list[ScrapedCourse], dict[str, Any]]:
    by_code: dict[str, list[ScrapedCourse]] = defaultdict(list)
    for row in courses:
        by_code[row.course_code].append(row)

    deduped: list[ScrapedCourse] = []
    duplicate_details: list[dict[str, Any]] = []

    for code in sorted(by_code.keys()):
        rows = by_code[code]
        if len(rows) == 1:
            deduped.append(rows[0])
            continue

        ranked = sorted(
            rows,
            key=lambda row: (
                -_score_course_for_dedupe(row)[0],
                -_score_course_for_dedupe(row)[1],
                -_score_course_for_dedupe(row)[2],
                -_score_course_for_dedupe(row)[3],
                row.source_slug,
                row.first_seen_index,
            ),
        )
        kept = ranked[0]
        deduped.append(kept)
        duplicate_details.append(
            {
                "course_code": code,
                "kept_slug": kept.source_slug,
                "dropped_slugs": [row.source_slug for row in ranked[1:]],
                "candidate_count": len(ranked),
            }
        )

    dedupe_stats = {
        "duplicate_course_codes_count": len(duplicate_details),
        "duplicates_resolved_count": sum(item["candidate_count"] - 1 for item in duplicate_details),
        "duplicate_samples": duplicate_details[:25],
    }
    return deduped, dedupe_stats


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def read_existing_course_codes(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        codes = set()
        for row in reader:
            normalized = normalize_course_code(row.get("course_code", ""))
            if normalized:
                codes.add(normalized)
        return codes


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="One-time full Marquette catalog scrape into data/webscrape_1.",
    )
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output directory.")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY_SECONDS, help="Delay between subject requests.")
    parser.add_argument("--retries", type=int, default=RETRY_COUNT, help="Max retries per GET request.")
    parser.add_argument("--timeout", type=float, default=REQUEST_TIMEOUT, help="HTTP timeout in seconds.")
    parser.add_argument(
        "--max-course-failures",
        type=int,
        default=MAX_COURSE_FAILURES,
        help="Fail run if individual course parse failures exceed this count.",
    )
    parser.add_argument(
        "--existing-courses-csv",
        type=Path,
        default=Path("data/courses.csv"),
        help="Existing courses.csv path for coverage comparison.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    all_courses_out = out_dir / DEFAULT_RAW_OUT_NAME
    prereqs_out = out_dir / DEFAULT_PREREQS_OUT_NAME
    summary_out = out_dir / DEFAULT_SUMMARY_OUT_NAME

    print(f"[start] Scraping index: {INDEX_URL}")
    with build_session() as session:
        index_html = request_text(session, INDEX_URL, timeout=args.timeout, retries=args.retries)
        subjects = parse_subject_index(index_html)
        if not subjects:
            raise SystemExit("No subject pages discovered from bulletin index.")
        print(f"[index] Discovered subjects: {len(subjects)}")

        subject_failures: list[dict[str, str]] = []
        course_failures: list[dict[str, str]] = []
        all_scraped_courses: list[ScrapedCourse] = []
        successful_subjects = 0
        running_index = 0

        for idx, subject in enumerate(subjects, start=1):
            print(f"[subject {idx}/{len(subjects)}] {subject.slug} ({subject.code})")
            try:
                html = request_text(session, subject.url, timeout=args.timeout, retries=args.retries)
                parsed_courses, parsed_failures = parse_subject_courses(
                    subject,
                    html,
                    start_index=running_index,
                )
                running_index += len(parsed_courses)
                all_scraped_courses.extend(parsed_courses)
                course_failures.extend(parsed_failures)
                successful_subjects += 1
                print(
                    f"  scraped={len(parsed_courses)} "
                    f"course_failures={len(parsed_failures)} "
                    f"total_scraped={len(all_scraped_courses)}"
                )
            except Exception as exc:
                subject_failures.append(
                    {
                        "slug": subject.slug,
                        "code": subject.code,
                        "url": subject.url,
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )
                print(f"  [subject-failure] {subject.slug}: {exc}")
            if idx < len(subjects):
                time.sleep(max(0.0, args.delay))

    deduped_courses, dedupe_stats = dedupe_courses(all_scraped_courses)
    print(
        "[dedupe] "
        f"raw_rows={len(all_scraped_courses)} "
        f"unique_courses={len(deduped_courses)} "
        f"duplicates={dedupe_stats['duplicate_course_codes_count']}"
    )

    courses_rows = [
        {
            "course_code": row.course_code,
            "course_name": row.course_name,
            "credits": row.credits,
            "level": row.level,
            "active": True,
            "notes": row.notes,
            "elective_pool_tag": row.elective_pool_tag,
            "description": row.description,
        }
        for row in sorted(deduped_courses, key=lambda item: item.course_code)
    ]

    prereq_rows = []
    last_four_terms_reference = []
    for row in sorted(deduped_courses, key=lambda item: item.course_code):
        parsed = parse_prereq_text(row.prerequisites_raw)
        prereq_rows.append(
            {
                "course_code": row.course_code,
                "prerequisites": parsed.prerequisites,
                "prereq_warnings": parsed.prereq_warnings,
                "concurrent_with": parsed.concurrent_with,
                "min_standing": parsed.min_standing,
                "notes": parsed.notes,
                "warning_text": parsed.warning_text,
            }
        )
        if row.last_four_terms:
            candidate = row.last_four_terms
            candidate = re.sub(
                r"^Last four terms offered:\s*",
                "",
                candidate,
                flags=re.IGNORECASE,
            ).strip()
            terms = [clean_text(part) for part in candidate.split(",") if clean_text(part)]
            valid_terms = [term for term in terms if SEMESTER_LABEL_RE.match(term)]
            last_four_terms_reference.append(
                {
                    "course_code": row.course_code,
                    "source_slug": row.source_slug,
                    "last_four_terms_raw": row.last_four_terms,
                    "parsed_terms": valid_terms,
                }
            )

    write_csv(
        all_courses_out,
        courses_rows,
        [
            "course_code",
            "course_name",
            "credits",
            "level",
            "active",
            "notes",
            "elective_pool_tag",
            "description",
        ],
    )
    write_csv(
        prereqs_out,
        prereq_rows,
        [
            "course_code",
            "prerequisites",
            "prereq_warnings",
            "concurrent_with",
            "min_standing",
            "notes",
            "warning_text",
        ],
    )

    scraped_codes = {row["course_code"] for row in courses_rows}
    existing_codes = read_existing_course_codes(args.existing_courses_csv)
    matched_codes = sorted(existing_codes & scraped_codes)
    missing_codes = sorted(existing_codes - scraped_codes)
    new_codes = sorted(scraped_codes - existing_codes)

    threshold_exceeded = len(course_failures) > args.max_course_failures

    summary = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "settings": {
            "index_url": INDEX_URL,
            "out_dir": str(out_dir),
            "delay_seconds": args.delay,
            "retries": args.retries,
            "timeout_seconds": args.timeout,
            "max_course_failures": args.max_course_failures,
            "existing_courses_csv": str(args.existing_courses_csv),
        },
        "subjects": {
            "attempted": len(subjects),
            "succeeded": successful_subjects,
            "failed": len(subject_failures),
            "failed_subjects": subject_failures,
            "discovered_subjects": [
                {"slug": subject.slug, "code": subject.code, "label": subject.label}
                for subject in subjects
            ],
        },
        "courses": {
            "raw_scraped_rows": len(all_scraped_courses),
            "unique_courses_after_dedupe": len(courses_rows),
            "course_failures_count": len(course_failures),
            "course_failures_threshold_exceeded": threshold_exceeded,
            "course_failures": course_failures[:500],
            "dedupe": dedupe_stats,
        },
        "coverage_vs_existing_courses_csv": {
            "existing_count": len(existing_codes),
            "matched_count": len(matched_codes),
            "missing_count": len(missing_codes),
            "new_count": len(new_codes),
            "missing_sample": missing_codes[:200],
            "new_sample": new_codes[:200],
        },
        "last_four_terms_reference": {
            "rows_with_last_four_terms": len(last_four_terms_reference),
            "entries": last_four_terms_reference,
        },
        "outputs": {
            "all_courses_raw_csv": str(all_courses_out),
            "course_prereqs_proposed_csv": str(prereqs_out),
            "scrape_summary_json": str(summary_out),
        },
    }

    summary_out.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"[write] {all_courses_out}")
    print(f"[write] {prereqs_out}")
    print(f"[write] {summary_out}")

    if threshold_exceeded:
        print(
            "[fail] Individual course failures exceeded threshold: "
            f"{len(course_failures)} > {args.max_course_failures}"
        )
        return 1

    print("[done] Scrape completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
