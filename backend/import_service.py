import base64
import binascii
import difflib
import json
import os
import re
import threading
import time
from collections import defaultdict
from typing import Callable

import requests
from flask import jsonify, request
from werkzeug.exceptions import RequestEntityTooLarge

from normalizer import normalize_code

MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
OPENAI_IMPORT_MODEL = os.environ.get("OPENAI_IMPORT_MODEL", "gpt-4o")
OPENAI_IMPORT_TIMEOUT_S = max(5, int(os.environ.get("OPENAI_IMPORT_TIMEOUT_S", "45") or "45"))
IMPORT_RATE_LIMIT_MAX = 5
IMPORT_RATE_LIMIT_WINDOW = 600
LOW_CONFIDENCE_THRESHOLD = 0.8

PASSING_GRADES = {
    "TC",
    "A",
    "A-",
    "B+",
    "B",
    "B-",
    "C+",
    "C",
    "C-",
    "D+",
    "D",
    "D-",
    "SNC",
}
TERM_RANKS = {
    "WINTER": 0,
    "SPRING": 1,
    "SPRG": 1,
    "SUMMER": 2,
    "SUM": 2,
    "FALL": 3,
}
COURSE_NUMBER_RE = re.compile(r"\b([A-Z]{2,6})\s*[-]?\s*(\d{4}[A-Z]?)\b")
TERM_RE = re.compile(r"(?P<year>\d{4})\s*(?P<term>[A-Za-z]+)")
_import_rate_limit_lock = threading.Lock()
_import_rate_limit_tracker: dict[str, list[float]] = defaultdict(list)


def _json_error(message: str, status_code: int, error_code: str) -> tuple:
    return jsonify({
        "error": {
            "error_code": error_code,
            "message": message,
        }
    }), status_code


def _coerce_string(value) -> str:
    return str(value or "").strip()


def _coerce_confidence(value, default: float = 0.85) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        confidence = default
    return max(0.0, min(1.0, confidence))


def _normalize_term(term: str) -> tuple[int, int, str]:
    raw = _coerce_string(term)
    if not raw:
        return (0, -1, "")
    match = TERM_RE.search(raw.upper())
    if not match:
        return (0, -1, raw)
    year = int(match.group("year"))
    term_key = _coerce_string(match.group("term")).upper()
    return (year, TERM_RANKS.get(term_key, -1), raw)


def _row_sort_key(row: dict) -> tuple[int, int, int]:
    year, term_rank, _ = _normalize_term(row.get("term"))
    return (year, term_rank, int(row.get("_source_index", 0)))


def _source_text(row: dict) -> str:
    parts = [
        _coerce_string(row.get("subject")),
        _coerce_string(row.get("number")),
        _coerce_string(row.get("title")),
        _coerce_string(row.get("term")),
        _coerce_string(row.get("final_grade")),
    ]
    return " | ".join([part for part in parts if part])


def _classify_row(row: dict) -> tuple[str, str | None]:
    final_grade = _coerce_string(row.get("final_grade")).upper()
    type_col = _coerce_string(row.get("type_col")).upper()

    if final_grade == "W":
        return ("ignored", "withdrawn")
    if final_grade == "IP" or type_col == "IP":
        return ("in_progress", None)
    if final_grade in PASSING_GRADES:
        return ("completed", None)
    if type_col == "EN" and final_grade in PASSING_GRADES:
        return ("completed", None)
    if not final_grade:
        return ("unmatched", "missing_grade")
    return ("unmatched", "unrecognized_grade")


def _extract_text_from_response_payload(payload: dict) -> str:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    for item in payload.get("output", []) or []:
        for content in item.get("content", []) or []:
            if not isinstance(content, dict):
                continue
            text_value = content.get("text")
            if isinstance(text_value, str) and text_value.strip():
                return text_value.strip()
    return ""


def _parse_json_object(raw_text: str) -> dict:
    text = _coerce_string(raw_text)
    if not text:
        raise ValueError("Model returned an empty response.")

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise ValueError("Model response was not valid JSON.") from None
        parsed = json.loads(text[start : end + 1])

    if isinstance(parsed, list):
        return {"rows": parsed}
    if not isinstance(parsed, dict):
        raise ValueError("Model response must be a JSON object.")
    return parsed


def _sanitize_model_rows(payload: dict) -> list[dict]:
    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise ValueError("Model response must include a 'rows' array.")

    normalized_rows: list[dict] = []
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            continue
        subject = _coerce_string(row.get("subject")).upper()
        number = _coerce_string(row.get("number")).upper()
        title = _coerce_string(row.get("title"))
        term = _coerce_string(row.get("term"))
        final_grade = _coerce_string(row.get("final_grade")).upper()
        type_col = _coerce_string(row.get("type_col")).upper()
        credits = _coerce_string(row.get("credits"))
        confidence = _coerce_confidence(row.get("confidence"), default=0.85)

        if not any([subject, number, title, term, final_grade, type_col, credits]):
            continue

        normalized_rows.append({
            "subject": subject,
            "number": number,
            "title": title,
            "term": term,
            "final_grade": final_grade,
            "type_col": type_col,
            "credits": credits,
            "confidence": confidence,
            "_source_index": index,
        })
    return normalized_rows


def _course_code_from_row(row: dict) -> str | None:
    subject = _coerce_string(row.get("subject")).upper()
    number = _coerce_string(row.get("number")).upper()
    if not subject or not number:
        return None
    return normalize_code(f"{subject} {number}")


def _extract_code_like_text(source_text: str) -> str | None:
    match = COURSE_NUMBER_RE.search(_coerce_string(source_text).upper())
    if not match:
        return None
    return normalize_code(f"{match.group(1)} {match.group(2)}")


def _suggest_matches(source_text: str, catalog_codes: set[str], limit: int = 5) -> list[str]:
    candidate = _extract_code_like_text(source_text)
    pool = sorted(catalog_codes)
    if candidate:
        dept = candidate.split(" ", 1)[0]
        dept_pool = [code for code in pool if code.startswith(f"{dept} ")]
        search_pool = dept_pool or pool
        suggestions = difflib.get_close_matches(candidate, search_pool, n=limit, cutoff=0.45)
        if suggestions:
            return suggestions

    compact_source = re.sub(r"[^A-Z0-9]+", " ", _coerce_string(source_text).upper()).strip()
    if not compact_source:
        return []
    return difflib.get_close_matches(compact_source, pool, n=limit, cutoff=0.3)


def process_import_rows(rows: list[dict], catalog_codes: set[str]) -> dict:
    matched_candidates: list[dict] = []
    unmatched_rows: list[dict] = []
    ignored_rows: list[dict] = []

    for index, original_row in enumerate(rows):
        row = dict(original_row)
        row["_source_index"] = int(row.get("_source_index", index))
        source_text = _source_text(row)
        confidence = _coerce_confidence(row.get("confidence"), default=0.85)
        status, reason = _classify_row(row)

        if status == "ignored":
            ignored_rows.append({
                "source_text": source_text,
                "term": _coerce_string(row.get("term")),
                "status": status,
                "reason": reason or "ignored",
                "confidence": confidence,
            })
            continue

        if status == "unmatched":
            unmatched_rows.append({
                "source_text": source_text,
                "term": _coerce_string(row.get("term")),
                "status": status,
                "suggested_matches": _suggest_matches(source_text, catalog_codes),
                "confidence": confidence,
                "reason": reason or "unmatched",
            })
            continue

        course_code = _course_code_from_row(row)
        if not course_code:
            unmatched_rows.append({
                "source_text": source_text,
                "term": _coerce_string(row.get("term")),
                "status": status,
                "suggested_matches": _suggest_matches(source_text, catalog_codes),
                "confidence": confidence,
                "reason": "invalid_code",
            })
            continue

        if course_code not in catalog_codes:
            unmatched_rows.append({
                "source_text": source_text,
                "term": _coerce_string(row.get("term")),
                "status": status,
                "suggested_matches": _suggest_matches(course_code, catalog_codes),
                "confidence": confidence,
                "reason": "not_in_catalog",
            })
            continue

        matched_candidates.append({
            "course_code": course_code,
            "source_text": source_text,
            "term": _coerce_string(row.get("term")),
            "status": status,
            "confidence": confidence,
            "_source_index": row["_source_index"],
        })

    chosen_rows: list[dict] = []
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in matched_candidates:
        grouped[row["course_code"]].append(row)

    for course_code, rows_for_code in grouped.items():
        completed_rows = [row for row in rows_for_code if row["status"] == "completed"]
        in_progress_rows = [row for row in rows_for_code if row["status"] == "in_progress"]
        if completed_rows:
            chosen = max(completed_rows, key=_row_sort_key)
        else:
            chosen = max(in_progress_rows, key=_row_sort_key)
        chosen_rows.append({
            "course_code": course_code,
            "source_text": chosen["source_text"],
            "term": chosen["term"],
            "status": chosen["status"],
            "confidence": chosen["confidence"],
        })

    chosen_rows.sort(key=lambda row: (_row_sort_key(row), row["course_code"]))
    completed_matches = [row for row in chosen_rows if row["status"] == "completed"]
    in_progress_matches = [row for row in chosen_rows if row["status"] == "in_progress"]

    return {
        "completed_matches": completed_matches,
        "in_progress_matches": in_progress_matches,
        "unmatched_rows": unmatched_rows,
        "ignored_rows": ignored_rows,
        "summary": {
            "completed_count": len(completed_matches),
            "in_progress_count": len(in_progress_matches),
            "unmatched_count": len(unmatched_rows),
            "ignored_count": len(ignored_rows),
            "total_rows": len(rows),
        },
    }


def _check_import_rate_limit(ip: str) -> bool:
    now = time.time()
    with _import_rate_limit_lock:
        timestamps = [
            ts for ts in _import_rate_limit_tracker[ip]
            if now - ts < IMPORT_RATE_LIMIT_WINDOW
        ]
        if len(timestamps) >= IMPORT_RATE_LIMIT_MAX:
            _import_rate_limit_tracker[ip] = timestamps
            return False
        timestamps.append(now)
        _import_rate_limit_tracker[ip] = timestamps
        return True


def _guess_mime_type(filename: str) -> str:
    lower = _coerce_string(filename).lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


def _read_image_upload(limit_bytes: int) -> tuple[bytes, str]:
    upload = request.files.get("file")
    if upload is not None:
        raw_bytes = upload.read()
        if not raw_bytes:
            raise ValueError("Upload file was empty.")
        if len(raw_bytes) > limit_bytes:
            raise RequestEntityTooLarge()
        return raw_bytes, _guess_mime_type(upload.filename or "")

    body = request.get_json(force=True, silent=True) or {}
    image_base64 = _coerce_string(body.get("image_base64"))
    if not image_base64:
        raise ValueError("Attach an image file or provide image_base64.")

    mime_type = _coerce_string(body.get("mime_type")) or "image/jpeg"
    if "," in image_base64 and image_base64.startswith("data:"):
        prefix, image_base64 = image_base64.split(",", 1)
        header_match = re.match(r"data:(.*?);base64$", prefix)
        if header_match:
            mime_type = header_match.group(1) or mime_type
    try:
        raw_bytes = base64.b64decode(image_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("image_base64 was not valid base64.") from exc
    if not raw_bytes:
        raise ValueError("Image payload was empty.")
    if len(raw_bytes) > limit_bytes:
        raise RequestEntityTooLarge()
    return raw_bytes, mime_type


def _build_openai_prompt() -> str:
    return (
        "You are extracting rows from a Marquette CheckMarq course history screenshot.\n"
        "Return JSON only with this shape: "
        '{"rows":[{"subject":"","number":"","title":"","term":"","final_grade":"","type_col":"","credits":"","confidence":0.0}]}. '
        "One object per visible course row.\n"
        "Important rules:\n"
        "- The table columns are Term, Subject, Nbr, Title, Mid Grd, Final Grade, Cr, Term GPA, Type, Note*.\n"
        "- Do not extract footer notes, GPA summary lines, legends, or blank continuation lines.\n"
        "- Preserve the exact visible Term, Subject, Nbr, Final Grade, Type, and Credits when possible.\n"
        "- If a title wraps to a second line, keep it attached to the same row.\n"
        "- Use empty strings when a field is unreadable; never invent a course code.\n"
        "- confidence must be between 0 and 1 and reflect how confident you are that the row fields were read correctly."
    )


def call_openai_course_history_import(image_bytes: bytes, mime_type: str) -> list[dict]:
    api_key = _coerce_string(os.environ.get("OPENAI_API_KEY"))
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "model": OPENAI_IMPORT_MODEL,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": _build_openai_prompt()},
                    {"type": "input_image", "image_url": f"data:{mime_type};base64,{image_b64}"},
                ],
            }
        ],
    }

    response = requests.post(
        OPENAI_RESPONSES_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=OPENAI_IMPORT_TIMEOUT_S,
    )
    if not response.ok:
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = {}
        message = _coerce_string(error_payload.get("error", {}).get("message"))
        raise RuntimeError(message or f"OpenAI request failed with status {response.status_code}.")

    parsed_payload = response.json()
    output_text = _extract_text_from_response_payload(parsed_payload)
    model_payload = _parse_json_object(output_text)
    return _sanitize_model_rows(model_payload)


def register_import_routes(
    app,
    data_source,
    refresh_data_if_needed: Callable[[], None] | None = None,
):
    if getattr(app, "_course_history_import_routes_registered", False):
        return

    app._course_history_import_routes_registered = True
    app.config["MAX_IMPORT_FILE_SIZE"] = MAX_IMPORT_FILE_SIZE
    existing_max = app.config.get("MAX_CONTENT_LENGTH")
    if existing_max is None or int(existing_max) > MAX_IMPORT_FILE_SIZE:
        app.config["MAX_CONTENT_LENGTH"] = MAX_IMPORT_FILE_SIZE

    @app.errorhandler(RequestEntityTooLarge)
    def _handle_oversized_upload(_exc):
        if request.path in {"/import-course-history", "/api/import-course-history"}:
            return _json_error(
                "Course history screenshots must be 5MB or smaller.",
                413,
                "IMPORT_FILE_TOO_LARGE",
            )
        return _json_error("Request body is too large.", 413, "REQUEST_TOO_LARGE")

    def import_course_history_endpoint():
        if refresh_data_if_needed is not None:
            refresh_data_if_needed()

        if not app.config.get("TESTING", False):
            client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
            client_ip = client_ip.split(",")[0].strip()
            if not _check_import_rate_limit(client_ip):
                return _json_error(
                    "Too many screenshot imports. Please wait before trying again.",
                    429,
                    "IMPORT_RATE_LIMITED",
                )

        try:
            image_bytes, mime_type = _read_image_upload(app.config["MAX_IMPORT_FILE_SIZE"])
        except RequestEntityTooLarge:
            raise
        except ValueError as exc:
            return _json_error(str(exc), 400, "INVALID_IMPORT_REQUEST")

        runtime_data = data_source() if callable(data_source) else data_source
        if not runtime_data or not isinstance(runtime_data, dict):
            return _json_error(
                "Course catalog data is unavailable right now.",
                503,
                "IMPORT_DATA_UNAVAILABLE",
            )

        catalog_codes = runtime_data.get("catalog_codes")
        if not isinstance(catalog_codes, set):
            return _json_error(
                "Course catalog data is unavailable right now.",
                503,
                "IMPORT_DATA_UNAVAILABLE",
            )

        try:
            extracted_rows = call_openai_course_history_import(image_bytes, mime_type)
        except RuntimeError as exc:
            message = str(exc)
            status_code = 503 if "OPENAI_API_KEY" in message else 502
            error_code = "OPENAI_API_KEY_MISSING" if status_code == 503 else "IMPORT_PARSE_FAILED"
            return _json_error(message, status_code, error_code)
        except requests.RequestException:
            return _json_error(
                "Could not reach the screenshot parser right now.",
                502,
                "IMPORT_PARSE_FAILED",
            )
        except ValueError as exc:
            return _json_error(
                str(exc) or "The screenshot parser returned an unusable result.",
                502,
                "IMPORT_PARSE_FAILED",
            )

        return jsonify(process_import_rows(extracted_rows, catalog_codes))

    app.add_url_rule(
        "/import-course-history",
        endpoint="import_course_history",
        view_func=import_course_history_endpoint,
        methods=["POST"],
    )
    app.add_url_rule(
        "/api/import-course-history",
        endpoint="api_import_course_history",
        view_func=import_course_history_endpoint,
        methods=["POST"],
    )

