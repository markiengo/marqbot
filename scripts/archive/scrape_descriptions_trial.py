"""Trial scraper for course descriptions using Marquette class-search API.

This script does NOT overwrite `data/courses.csv`. It writes review artifacts to
`data/webscrape_trial/` by default.

Note:
- Full-catalog bulletin scraping is planned under `scripts/scrape_catalog.py`.
- Prereq proposal export to `course_prereqs.csv` is intentionally not implemented here.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

CLASS_SEARCH_URL = "https://bulletin.marquette.edu/class-search/"
API_BASE = "https://bulletin.marquette.edu/class-search/api/?page=fose"
REQUEST_TIMEOUT = 30
MAX_RETRIES = 5

SUBJECTS = [
    "ACCO",
    "AIM",
    "BUAD",
    "BUAN",
    "BULA",
    "ECON",
    "ENTP",
    "FINA",
    "HURE",
    "INBU",
    "INSY",
    "LEAD",
    "MANA",
    "MARK",
    "OSCM",
    "REAL",
    "SOWJ",
    "CORE",
]

DEFAULT_INPUT = Path("data/courses.csv")
DEFAULT_OUT_DIR = Path("data/webscrape_trial")
FUTURE_RAW_CATALOG_NAME = "all_courses_raw.csv"
FUTURE_PREREQS_PROPOSED_NAME = "course_prereqs_proposed.csv"

SRCDB_PATTERN = re.compile(r"srcDBs:\s*(\[[^\n;]+])", re.IGNORECASE)
TAG_PATTERN = re.compile(r"<[^>]+>")
SPACE_PATTERN = re.compile(r"\s+")
COURSE_CODE_PATTERN = re.compile(r"^([A-Z]{3,4})\s+(\d{4}[A-Z]?)$")


@dataclass
class SearchCourse:
    course_code: str
    title: str
    sample_crn: str
    srcdb: str
    rows_seen: int


def build_session() -> requests.Session:
    """Create session with proxy auto-discovery disabled."""
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


def _post_api(session: requests.Session, route: str, payload: dict[str, Any], *, query: dict[str, str] | None = None) -> dict[str, Any]:
    params = {"route": route}
    if query:
        params.update(query)
    url = f"{API_BASE}&{urllib.parse.urlencode(params)}"
    encoded = urllib.parse.quote(json.dumps(payload, separators=(",", ":")))
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.post(
                url,
                data=encoded,
                headers={"Content-Type": "application/json"},
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            last_error = exc
            if attempt == MAX_RETRIES:
                break
            wait = min(1.5, 0.25 * attempt)
            print(f"Retry {attempt}/{MAX_RETRIES - 1} for route={route}: {exc}")
            time.sleep(wait)

    raise RuntimeError(f"API call failed after retries for route={route}") from last_error


def parse_srcdbs_from_homepage(session: requests.Session) -> list[dict[str, Any]]:
    last_error: Exception | None = None
    response_text = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(CLASS_SEARCH_URL, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            response_text = response.text
            break
        except requests.RequestException as exc:
            last_error = exc
            if attempt == MAX_RETRIES:
                break
            wait = min(1.5, 0.25 * attempt)
            print(f"Retry {attempt}/{MAX_RETRIES - 1} for homepage fetch: {exc}")
            time.sleep(wait)

    if not response_text:
        raise RuntimeError("Unable to fetch class-search homepage after retries") from last_error

    match = SRCDB_PATTERN.search(response_text)
    if not match:
        raise RuntimeError("Unable to locate srcDBs in class-search config")
    return json.loads(match.group(1))


def pick_srcdb(srcdbs: list[dict[str, Any]], explicit_srcdb: str | None) -> str:
    if explicit_srcdb:
        allowed = {str(item.get("code", "")) for item in srcdbs}
        if explicit_srcdb not in allowed:
            raise RuntimeError(f"Requested srcdb '{explicit_srcdb}' not found in class-search config")
        return explicit_srcdb

    publishable = [item for item in srcdbs if item.get("status") == "clss-publish"]
    candidates = publishable or srcdbs
    if not candidates:
        raise RuntimeError("No srcDB terms available")
    # Codes are numeric-like strings where higher tends to mean newer term.
    candidates.sort(key=lambda item: int(str(item.get("code", "0"))), reverse=True)
    return str(candidates[0]["code"])


def parse_subject_and_level(course_code: str) -> tuple[str, int | None]:
    match = COURSE_CODE_PATTERN.match(course_code.strip().upper())
    if not match:
        return "", None
    subject = match.group(1)
    number = match.group(2)
    try:
        level = int(number[0]) * 1000
    except (IndexError, ValueError):
        level = None
    return subject, level


def is_target_undergrad_course(course_code: str) -> bool:
    subject, level = parse_subject_and_level(course_code)
    if subject not in SUBJECTS:
        return False
    if level is None:
        return True
    return level < 5000


def clean_description(text: str) -> str:
    value = html.unescape(text or "")
    value = TAG_PATTERN.sub(" ", value)
    value = SPACE_PATTERN.sub(" ", value).strip()
    return value


def trim_to_sentence_boundary(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rstrip()
    sentence_end = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
    if sentence_end >= int(max_chars * 0.6):
        return cut[: sentence_end + 1].strip()
    last_space = cut.rfind(" ")
    if last_space >= 0:
        return f"{cut[:last_space].strip()}..."
    return f"{cut}..."


def search_subject(session: requests.Session, srcdb: str, subject: str) -> dict[str, Any]:
    payload = {
        "criteria": [{"field": "subject", "value": subject}],
        "other": {"srcdb": srcdb},
    }
    return _post_api(session, "search", payload, query={"subject": subject})


def fetch_details(session: requests.Session, srcdb: str, course_code: str, sample_crn: str, matched: str) -> dict[str, Any]:
    payload = {
        "group": f"code:{course_code}",
        "key": f"crn:{sample_crn}",
        "matched": matched,
        "srcdb": srcdb,
    }
    return _post_api(session, "details", payload)


def read_courses(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build trial description CSVs in data/webscrape_trial.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="Input courses.csv path")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Output trial directory")
    parser.add_argument("--srcdb", type=str, default=None, help="Specific term code (e.g., 1820)")
    parser.add_argument("--max-chars", type=int, default=200, help="Max chars for suggested description")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between API calls in seconds")
    parser.add_argument(
        "--full-catalog",
        action="store_true",
        help=(
            "Reserved for future full bulletin scrape mode. "
            "Not implemented in this script."
        ),
    )
    parser.add_argument(
        "--emit-prereqs-proposed",
        action="store_true",
        help=(
            "Reserved for future course_prereqs proposal export. "
            "Not implemented in this script."
        ),
    )
    args = parser.parse_args()

    if args.full_catalog or args.emit_prereqs_proposed:
        out_dir = args.out_dir
        raise SystemExit(
            "Requested mode is not implemented in scrape_descriptions_trial.py.\n"
            "Use scripts/scrape_catalog.py once full-catalog + prereq export is implemented.\n"
            f"Planned raw catalog output: {out_dir / FUTURE_RAW_CATALOG_NAME}\n"
            f"Planned prereq proposal output: {out_dir / FUTURE_PREREQS_PROPOSED_NAME}"
        )

    rows = read_courses(args.input)
    course_index = {row.get("course_code", "").strip().upper(): idx for idx, row in enumerate(rows)}

    with build_session() as session:
        srcdbs = parse_srcdbs_from_homepage(session)
        srcdb = pick_srcdb(srcdbs, args.srcdb)
        print(f"Using srcdb term: {srcdb}")

        search_courses: dict[str, SearchCourse] = {}
        for subject in SUBJECTS:
            payload = search_subject(session, srcdb, subject)
            subject_rows = payload.get("results", []) or []
            print(f"{subject}: {len(subject_rows)} section rows")
            for item in subject_rows:
                course_code = str(item.get("code", "")).strip().upper()
                crn = str(item.get("crn", "")).strip()
                title = str(item.get("title", "")).strip()
                if not course_code or not crn:
                    continue
                if course_code in search_courses:
                    search_courses[course_code].rows_seen += 1
                else:
                    search_courses[course_code] = SearchCourse(
                        course_code=course_code,
                        title=title,
                        sample_crn=crn,
                        srcdb=srcdb,
                        rows_seen=1,
                    )
            time.sleep(args.delay)

        matched_rows: list[dict[str, Any]] = []
        unmatched_rows: list[dict[str, Any]] = []
        proposed_rows: list[dict[str, str]] = [dict(r) for r in rows]

        target_codes = [code for code in course_index.keys() if is_target_undergrad_course(code)]
        target_code_set = set(target_codes)
        found_target_codes = set()

        for code, info in sorted(search_courses.items()):
            if code not in target_code_set:
                continue

            matched = f"subject:{code.split()[0]}"
            detail_payload = fetch_details(session, srcdb, info.course_code, info.sample_crn, matched)
            raw_description = clean_description(str(detail_payload.get("description", "")))
            suggested = trim_to_sentence_boundary(raw_description, args.max_chars) if raw_description else ""
            source_group = f"code:{info.course_code}"
            source_key = f"crn:{info.sample_crn}"

            idx = course_index[code]
            old_description = (proposed_rows[idx].get("description") or "").strip()
            if suggested:
                proposed_rows[idx]["description"] = suggested

            matched_rows.append(
                {
                    "course_code": code,
                    "course_name_csv": proposed_rows[idx].get("course_name", ""),
                    "course_name_api": info.title,
                    "srcdb": srcdb,
                    "sample_crn": info.sample_crn,
                    "sections_seen": info.rows_seen,
                    "old_description": old_description,
                    "raw_description": raw_description,
                    "suggested_description": suggested,
                    "source_group": source_group,
                    "source_key": source_key,
                }
            )
            found_target_codes.add(code)
            time.sleep(args.delay)

        missing_from_search = sorted(target_code_set - set(search_courses.keys()))
        for code in missing_from_search:
            idx = course_index[code]
            unmatched_rows.append(
                {
                    "course_code": code,
                    "course_name_csv": proposed_rows[idx].get("course_name", ""),
                    "reason": "no class-search result for selected term",
                }
            )

        no_description = [row["course_code"] for row in matched_rows if not row["suggested_description"]]
        for code in sorted(no_description):
            idx = course_index[code]
            unmatched_rows.append(
                {
                    "course_code": code,
                    "course_name_csv": proposed_rows[idx].get("course_name", ""),
                    "reason": "details endpoint returned empty description",
                }
            )

        out_dir = args.out_dir
        out_dir.mkdir(parents=True, exist_ok=True)

        proposed_path = out_dir / "courses_proposed.csv"
        matched_path = out_dir / "matched_descriptions.csv"
        unmatched_path = out_dir / "unmatched_courses.csv"
        summary_path = out_dir / "run_summary.json"

        # Preserve original column order.
        write_csv(proposed_path, proposed_rows, fieldnames=list(proposed_rows[0].keys()))
        write_csv(
            matched_path,
            matched_rows,
            fieldnames=[
                "course_code",
                "course_name_csv",
                "course_name_api",
                "srcdb",
                "sample_crn",
                "sections_seen",
                "old_description",
                "raw_description",
                "suggested_description",
                "source_group",
                "source_key",
            ],
        )
        write_csv(unmatched_path, unmatched_rows, fieldnames=["course_code", "course_name_csv", "reason"])

        summary = {
            "input_csv": str(args.input),
            "output_dir": str(out_dir),
            "selected_srcdb": srcdb,
            "subjects": SUBJECTS,
            "target_courses_in_csv": len(target_code_set),
            "search_courses_found": len(search_courses),
            "matched_target_courses": len(found_target_codes),
            "matched_with_description": sum(1 for row in matched_rows if row["suggested_description"]),
            "unmatched_rows": len(unmatched_rows),
            "outputs": {
                "proposed_courses": str(proposed_path),
                "matched_descriptions": str(matched_path),
                "unmatched_courses": str(unmatched_path),
            },
        }
        summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

        print(f"Wrote: {proposed_path}")
        print(f"Wrote: {matched_path}")
        print(f"Wrote: {unmatched_path}")
        print(f"Wrote: {summary_path}")


if __name__ == "__main__":
    main()
