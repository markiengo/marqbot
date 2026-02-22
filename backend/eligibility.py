import re
import pandas as pd
from prereq_parser import prereqs_satisfied, build_prereq_check_string
from requirements import SOFT_WARNING_TAGS, COMPLEX_PREREQ_TAG, CONCURRENT_TAGS, DEFAULT_TRACK_ID


def parse_term(s: str) -> str:
    """'Fall 2026' → 'Fall'. Year is ignored."""
    for t in ("Fall", "Spring", "Summer"):
        if t.lower() in s.lower():
            return t
    raise ValueError(f"Cannot parse term from: {s!r}")


def _safe_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().upper() == "TRUE"
    return bool(val)


def _is_none_prereq(raw_val) -> bool:
    if raw_val is None:
        return True
    s = str(raw_val).strip().lower()
    return s in ("", "none", "none listed", "n/a", "nan")


def get_course_eligible_buckets(
    course_code: str,
    course_bucket_map_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    track_id: str = DEFAULT_TRACK_ID,
) -> list[dict]:
    """
    Returns all {bucket_id, label, priority} dicts for a given course,
    filtered by min_level constraint.

    Double-count eligibility is not tracked here — it is gated solely by
    bucket-level allow_double_count (see allocator.py).
    """
    track_map = course_bucket_map_df[
        (course_bucket_map_df["track_id"] == track_id)
        & (course_bucket_map_df["course_code"] == course_code)
    ]

    course_rows = courses_df[courses_df["course_code"] == course_code]
    course_level = None
    if len(course_rows) > 0:
        lvl = course_rows.iloc[0].get("level")
        if lvl is not None and not (isinstance(lvl, float) and pd.isna(lvl)):
            course_level = int(lvl)

    bucket_meta = {
        row["bucket_id"]: row
        for _, row in buckets_df[buckets_df["track_id"] == track_id].iterrows()
    }

    result = []
    for _, row in track_map.iterrows():
        bid = row["bucket_id"]
        meta = bucket_meta.get(bid)
        if meta is None:
            continue
        # Check min_level
        min_lvl = meta.get("min_level")
        if min_lvl is not None and not (isinstance(min_lvl, float) and pd.isna(min_lvl)):
            min_lvl = int(min_lvl)
            if course_level is not None and course_level < min_lvl:
                continue

        result.append({
            "bucket_id": bid,
            "label": str(meta.get("bucket_label", bid)),
            "priority": int(meta.get("priority", 99)),
        })

    result.sort(key=lambda b: b["priority"])
    return result


def get_eligible_courses(
    courses_df: pd.DataFrame,
    completed: list[str],
    in_progress: list[str],
    target_term: str,
    prereq_map: dict,
    allocator_remaining: dict,
    course_bucket_map_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    equivalencies_df: pd.DataFrame = None,
    track_id: str = DEFAULT_TRACK_ID,
) -> list[dict]:
    """
    Returns eligible courses for the target term, sorted by:
      1. Primary bucket priority (ascending = most important first)
      2. Multi-bucket score (descending = more unmet buckets filled = better)
      3. Prerequisite level (ascending = earlier classes first)

    Eligible = not yet taken AND prereqs satisfied AND not manual_review.
    Term offering is warning-only in recommendation mode (no hard exclusion).

    Each returned dict:
    {
      "course_code": str,
      "course_name": str,
      "credits": int,
      "primary_bucket": str,          # bucket_id of highest-priority bucket
      "primary_bucket_label": str,
      "fills_buckets": [str, ...],    # all bucket_ids this course can fill
      "multi_bucket_score": int,      # count of unmet buckets filled
      "prereq_check": str,            # human-readable prereq label
      "has_soft_requirement": bool,
      "soft_tags": [str, ...],        # non-blocking soft tags
      "all_soft_tags": [str, ...],    # full prereq_soft tags (internal ranking helper)
      "manual_review": bool,          # True if prereq_hard is unsupported
      "low_confidence": bool,         # offering_confidence != high
      "notes": str | None,            # course notes from sheet
      "unlocks": [],                  # filled in by server.py
    }
    """
    completed_set = set(completed)
    in_progress_set = set(in_progress)
    satisfied_codes = completed_set | in_progress_set

    term_col = {
        "Fall": "offered_fall",
        "Spring": "offered_spring",
        "Summer": "offered_summer",
    }.get(target_term, "offered_fall")

    results = []

    for _, row in courses_df.iterrows():
        code = row["course_code"]

        # Skip already taken / in-progress
        if code in completed_set or code in in_progress_set:
            continue

        # Recommendation lane is warning-driven for term offering:
        # do not hard-exclude courses that are not offered in target term.
        offered_this_term = _safe_bool(row.get(term_col, False))

        # Parse prereqs
        parsed = prereq_map.get(code, {"type": "none"})
        raw_concurrent = row.get("prereq_concurrent", "none")
        parsed_concurrent = prereq_map.get(f"{code}::__concurrent__")
        if parsed_concurrent is None:
            from prereq_parser import parse_prereqs
            parsed_concurrent = parse_prereqs(raw_concurrent if not _is_none_prereq(raw_concurrent) else "none")

        manual_review = parsed["type"] == "unsupported"

        # Parse prereq_soft tags
        soft_raw = str(row.get("prereq_soft", "") or "")
        soft_tags = [t.strip() for t in soft_raw.split(";") if t.strip()] if soft_raw else []
        allow_concurrent = any(t in CONCURRENT_TAGS for t in soft_tags)
        has_explicit_concurrent = not _is_none_prereq(raw_concurrent)

        # Data exception: some starter courses have no hard prereqs but include a
        # concurrent-enrollment soft tag; do not force manual review in that case.
        complex_tag_blocks = (
            COMPLEX_PREREQ_TAG in soft_tags
            and not (parsed["type"] == "none" and any(t in CONCURRENT_TAGS for t in soft_tags))
        )
        if complex_tag_blocks:
            manual_review = True
        if parsed_concurrent["type"] == "unsupported":
            manual_review = True

        # Check prereq satisfaction (manual review courses are excluded)
        if manual_review:
            # Still include in list but flagged
            prereq_satisfied = False
        else:
            if has_explicit_concurrent:
                hard_ok = prereqs_satisfied(parsed, completed_set)
                concurrent_ok = prereqs_satisfied(parsed_concurrent, satisfied_codes)
                prereq_satisfied = hard_ok and concurrent_ok
            else:
                # Default: hard prereqs must be completed; in-progress only counts
                # when may_be_concurrent soft tag is present.
                prereq_source = satisfied_codes if allow_concurrent else completed_set
                prereq_satisfied = prereqs_satisfied(parsed, prereq_source)

        if not prereq_satisfied:
            if not manual_review:
                continue
            # manual_review courses: include with flag even if prereq check is N/A

        # Soft requirement warnings (non-blocking)
        warning_tags = [t for t in soft_tags if t in SOFT_WARNING_TAGS]
        has_soft_requirement = bool(warning_tags)

        # Offering confidence
        confidence = str(row.get("offering_confidence", "high") or "high").lower()
        low_confidence = confidence in ("medium", "low", "unknown") or not offered_this_term

        # Course notes
        course_notes = str(row.get("notes", "") or "")
        if not course_notes or course_notes == "nan":
            course_notes = None

        # Bucket info
        eligible_buckets = get_course_eligible_buckets(
            code, course_bucket_map_df, courses_df, buckets_df, track_id=track_id
        )

        if not eligible_buckets and not manual_review:
            continue  # course doesn't belong to any tracked bucket

        # Multi-bucket score still reflects unmet buckets for ranking,
        # but fills_buckets now shows all eligible buckets for UI clarity.
        unmet_buckets = [
            b for b in eligible_buckets
            if allocator_remaining.get(b["bucket_id"], {}).get("slots_remaining", 0) > 0
        ]
        multi_bucket_score = len(unmet_buckets)

        primary = eligible_buckets[0] if eligible_buckets else None

        # prereq_check string
        if has_explicit_concurrent:
            hard_label = build_prereq_check_string(parsed, completed_set, set())
            concurrent_label = build_prereq_check_string(parsed_concurrent, completed_set, in_progress_set)
            prereq_check = f"Hard prereq: {hard_label}; Concurrent allowed: {concurrent_label}"
        else:
            ip_for_check = in_progress_set if allow_concurrent else set()
            prereq_check = build_prereq_check_string(parsed, completed_set, ip_for_check)
            if allow_concurrent and parsed["type"] != "none":
                prereq_check = f"{prereq_check} (concurrent allowed)"
        if manual_review:
            prereq_check = "Manual review required"

        min_standing = int(row.get("prereq_level", 0)) if not pd.isna(row.get("prereq_level", 0)) else 0

        # Reconcile standing_requirement tag with min_standing level.
        # Case A: tag is set but level is 0 — infer level from the course number
        #         (e.g. 3001 → 3xxx → sophomore = 2).
        if "standing_requirement" in soft_tags and min_standing == 0:
            m = re.search(r"\d+", code or "")
            if m:
                level_digit = int(m.group()) // 1000
                if level_digit >= 2:
                    min_standing = max(1, level_digit - 1)
        # Case B: level is set but tag is missing — synthesize the tag so it surfaces.
        if min_standing > 0 and "standing_requirement" not in soft_tags:
            soft_tags = list(soft_tags) + ["standing_requirement"]

        # Recompute warning_tags after reconciliation.
        warning_tags = [t for t in soft_tags if t in SOFT_WARNING_TAGS]
        has_soft_requirement = bool(warning_tags)

        results.append({
            "course_code": code,
            "course_name": str(row.get("course_name", "")),
            "credits": int(row.get("credits", 3)) if not pd.isna(row.get("credits", 3)) else 3,
            "prereq_level": min_standing,
            "min_standing": min_standing,
            "primary_bucket": primary["bucket_id"] if primary else None,
            "primary_bucket_label": primary["label"] if primary else None,
            "primary_bucket_priority": primary["priority"] if primary else 99,
            "fills_buckets": [b["bucket_id"] for b in eligible_buckets],
            "multi_bucket_score": multi_bucket_score,
            "prereq_check": prereq_check,
            "has_soft_requirement": has_soft_requirement,
            "soft_tags": warning_tags,
            "all_soft_tags": soft_tags,
            "manual_review": manual_review,
            "low_confidence": low_confidence,
            "notes": course_notes,
            "unlocks": [],  # populated by server.py
        })

    # Sort: bucket priority ASC (higher-priority requirements first),
    # then multi_bucket_score DESC (fills more unmet buckets),
    # then prerequisite depth ASC, then code.
    results.sort(
        key=lambda c: (
            c["primary_bucket_priority"],
            -c["multi_bucket_score"],
            c["prereq_level"],
            c["course_code"],
        )
    )

    return results


def check_can_take(
    requested_code: str,
    courses_df: pd.DataFrame,
    completed: list[str],
    in_progress: list[str],
    target_term: str,
    prereq_map: dict,
) -> dict:
    """
    Returns a can-take assessment for a specific requested course.

    Returns:
    {
      "can_take": True | False | None,   # None = unknown (unsupported prereq)
      "why_not": str | None,
      "missing_prereqs": [str],
      "not_offered_this_term": bool,
      "unsupported_prereq_format": bool,
    }
    """
    completed_set = set(completed)
    in_progress_set = set(in_progress)
    satisfied_codes = completed_set | in_progress_set

    course_rows = courses_df[courses_df["course_code"] == requested_code]
    if len(course_rows) == 0:
        return {
            "can_take": False,
            "why_not": f"{requested_code} is not in the course catalog.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
        }

    row = course_rows.iloc[0]

    # Check offering
    term_col = {
        "Fall": "offered_fall",
        "Spring": "offered_spring",
        "Summer": "offered_summer",
    }.get(target_term, "offered_fall")
    offered = _safe_bool(row.get(term_col, False))

    if not offered:
        return {
            "can_take": False,
            "why_not": f"{requested_code} is not offered in {target_term}.",
            "missing_prereqs": [],
            "not_offered_this_term": True,
            "unsupported_prereq_format": False,
        }

    # Check if already taken
    if requested_code in completed_set:
        return {
            "can_take": False,
            "why_not": f"You have already completed {requested_code}.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
        }

    parsed = prereq_map.get(requested_code, {"type": "none"})
    raw_concurrent = row.get("prereq_concurrent", "none")
    from prereq_parser import parse_prereqs
    parsed_concurrent = parse_prereqs(raw_concurrent if not _is_none_prereq(raw_concurrent) else "none")

    # Check soft tags
    soft_raw = str(row.get("prereq_soft", "") or "")
    soft_tags = [t.strip() for t in soft_raw.split(";") if t.strip()] if soft_raw else []
    allow_concurrent = any(t in CONCURRENT_TAGS for t in soft_tags)
    has_explicit_concurrent = not _is_none_prereq(raw_concurrent)

    complex_tag_blocks = (
        COMPLEX_PREREQ_TAG in soft_tags
        and not (parsed["type"] == "none" and any(t in CONCURRENT_TAGS for t in soft_tags))
    )

    if parsed["type"] == "unsupported" or parsed_concurrent["type"] == "unsupported" or complex_tag_blocks:
        return {
            "can_take": None,
            "why_not": "Cannot determine eligibility: prerequisite format requires manual review.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": True,
        }

    if has_explicit_concurrent:
        hard_ok = prereqs_satisfied(parsed, completed_set)
        concurrent_ok = prereqs_satisfied(parsed_concurrent, satisfied_codes)
        overall_ok = hard_ok and concurrent_ok
    else:
        prereq_source = satisfied_codes if allow_concurrent else completed_set
        overall_ok = prereqs_satisfied(parsed, prereq_source)

    if overall_ok:
        return {
            "can_take": True,
            "why_not": None,
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
        }

    # Determine which prereqs are missing
    missing: list[str] = []
    def missing_from(parsed_req: dict, source: set) -> list[str]:
        t = parsed_req["type"]
        if t == "single":
            return [parsed_req["course"]] if parsed_req["course"] not in source else []
        if t == "and":
            return [c for c in parsed_req["courses"] if c not in source]
        if t == "or":
            return [] if any(c in source for c in parsed_req["courses"]) else parsed_req["courses"]
        return []

    if has_explicit_concurrent:
        missing_hard = missing_from(parsed, completed_set)
        missing_conc = missing_from(parsed_concurrent, satisfied_codes)
        missing = missing_hard + [m for m in missing_conc if m not in missing_hard]
    else:
        source = satisfied_codes if allow_concurrent else completed_set
        missing = missing_from(parsed, source)

    why_not = f"Missing prerequisite(s): {', '.join(missing)}." if missing else "Prerequisites not satisfied."

    return {
        "can_take": False,
        "why_not": why_not,
        "missing_prereqs": missing,
        "not_offered_this_term": False,
        "unsupported_prereq_format": False,
    }
