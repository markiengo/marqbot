"""Shared helpers for advisor-match scoring across script and tests."""

from __future__ import annotations


def _normalize_codes(codes: list[str]) -> list[str]:
    out: list[str] = []
    for code in codes:
        normalized = str(code or "").strip().upper()
        if normalized:
            out.append(normalized)
    return out


def extract_recommendation_codes(payload: dict, limit: int = 6) -> list[str]:
    """
    Return top recommended course codes from API payload.

    Supports both:
    - top-level `recommendations`
    - `semesters[0].recommendations`
    """
    recs = payload.get("recommendations")
    if not isinstance(recs, list):
        semesters = payload.get("semesters")
        if isinstance(semesters, list) and semesters:
            first = semesters[0] if isinstance(semesters[0], dict) else {}
            recs = first.get("recommendations")
    if not isinstance(recs, list):
        return []

    codes: list[str] = []
    for rec in recs:
        if not isinstance(rec, dict):
            continue
        code = rec.get("course_code")
        if code:
            codes.append(str(code))
    return _normalize_codes(codes)[:limit]


def score_against_gold(
    payload: dict,
    expected_top_codes: list[str],
    limit: int = 6,
) -> tuple[int, list[str]]:
    """Return overlap count and actual top codes."""
    actual = extract_recommendation_codes(payload, limit=limit)
    expected = _normalize_codes(expected_top_codes)[:limit]
    overlap = len(set(actual) & set(expected))
    return overlap, actual


def is_case_pass(overlap: int, min_overlap: int = 4) -> bool:
    """Case pass threshold helper."""
    return int(overlap) >= int(min_overlap)
