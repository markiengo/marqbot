import re
import pandas as pd
from prereq_parser import prereq_course_codes, prereqs_satisfied, build_prereq_check_string
from requirements import SOFT_WARNING_TAGS, COMPLEX_PREREQ_TAG, CONCURRENT_TAGS, DEFAULT_TRACK_ID
from unlocks import build_reverse_prereq_map


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


_NON_RECOMMENDABLE_PATTERNS = (
    "internship",
    "work period",
    "independent study",
    "topics in",
)


def _is_non_recommendable_course(course_code: str, course_name: str | None = None) -> bool:
    """
    Suppress non-recommendable courses from recommendation candidates.
    Internships, work periods, independent studies, and topics courses
    have variable content or require special enrollment and cannot be
    deterministically recommended.  They still count toward bucket
    progress when completed/in-progress (allocator does NOT call this).
    """
    code = str(course_code or "").strip().upper()
    name = str(course_name or "").strip().lower()
    if re.search(r"\b4986\b", code):
        return True
    return any(p in name for p in _NON_RECOMMENDABLE_PATTERNS)


def _bucket_family_key(bucket: dict) -> str:
    family = str(bucket.get("double_count_family_id", "") or "").strip()
    if family:
        return family
    parent = str(bucket.get("parent_bucket_id", "") or "").strip()
    if parent:
        return parent
    return ""


def _prune_same_family_elective_overlap(buckets: list[dict]) -> list[dict]:
    """
    If a course can fill both non-elective and elective-pool buckets in the same
    family, keep non-elective visibility only for that family.
    Cross-family elective visibility remains unchanged.
    """
    if len(buckets) <= 1:
        return buckets

    family_has_non_elective: dict[str, bool] = {}
    for bucket in buckets:
        family = _bucket_family_key(bucket)
        if not family:
            continue
        mode = str(bucket.get("requirement_mode", "") or "").strip().lower()
        if mode != "credits_pool":
            family_has_non_elective[family] = True

    pruned: list[dict] = []
    for bucket in buckets:
        family = _bucket_family_key(bucket)
        mode = str(bucket.get("requirement_mode", "") or "").strip().lower()
        if family and family_has_non_elective.get(family, False) and mode == "credits_pool":
            continue
        pruned.append(bucket)
    return pruned


def _order_buckets_same_family(buckets: list[dict]) -> list[dict]:
    """
    Deterministic same-family ordering:
      required -> choose_n -> credits_pool -> other
      then bucket priority -> bucket_id lexical
    """
    if len(buckets) <= 1:
        return buckets

    by_family: dict[str, dict[str, list[dict]]] = {}
    family_order: list[str] = []
    for bucket in buckets:
        family = _bucket_family_key(bucket) or "__NO_FAMILY__"
        if family not in by_family:
            by_family[family] = {
                "required": [],
                "choose_n": [],
                "credits_pool": [],
                "other": [],
            }
            family_order.append(family)
        mode = str(bucket.get("requirement_mode", "") or "").strip().lower()
        if mode == "required":
            by_family[family]["required"].append(bucket)
        elif mode == "choose_n":
            by_family[family]["choose_n"].append(bucket)
        elif mode == "credits_pool":
            by_family[family]["credits_pool"].append(bucket)
        else:
            by_family[family]["other"].append(bucket)

    def _sort_rows(rows: list[dict]) -> list[dict]:
        return sorted(
            rows,
            key=lambda r: (int(r.get("priority", 99)), str(r.get("bucket_id", ""))),
        )

    ordered: list[dict] = []
    for family in family_order:
        ordered.extend(_sort_rows(by_family[family]["required"]))
        ordered.extend(_sort_rows(by_family[family]["choose_n"]))
        ordered.extend(_sort_rows(by_family[family]["credits_pool"]))
        ordered.extend(_sort_rows(by_family[family]["other"]))
    return ordered


def get_course_eligible_buckets(
    course_code: str,
    course_bucket_map_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    track_id: str = DEFAULT_TRACK_ID,
    *,
    _course_bucket_index: dict[str, list[str]] | None = None,
    _bucket_meta: dict[str, dict] | None = None,
    _course_level_index: dict[str, int | None] | None = None,
) -> list[dict]:
    """
    Returns all {bucket_id, label, priority} dicts for a given course,
    filtered by min_level constraint.

    Double-count eligibility is not tracked here — it is gated solely by
    bucket-level allow_double_count (see allocator.py).
    """
    if _course_level_index is not None:
        course_level = _course_level_index.get(course_code)
    else:
        course_rows = courses_df[courses_df["course_code"] == course_code]
        course_level = None
        if len(course_rows) > 0:
            lvl = course_rows.iloc[0].get("level")
            if lvl is not None and not (isinstance(lvl, float) and pd.isna(lvl)):
                course_level = int(lvl)

    bucket_meta = _bucket_meta
    if bucket_meta is None:
        bucket_meta = {}
        track_bucket_rows = buckets_df[buckets_df["track_id"] == track_id]
        for _, row in track_bucket_rows.iterrows():
            bid = str(row.get("bucket_id", "") or "").strip()
            if not bid:
                continue
            bucket_meta[bid] = {
                "bucket_label": str(row.get("bucket_label", bid)),
                "priority": row.get("priority", 99),
                "parent_bucket_priority": row.get("parent_bucket_priority", 99),
                "parent_bucket_id": str(row.get("parent_bucket_id", "") or "").strip().upper(),
                "double_count_family_id": str(row.get("double_count_family_id", "") or "").strip(),
                "requirement_mode": str(row.get("requirement_mode", "") or "").strip().lower(),
                "min_level": row.get("min_level"),
            }

    if _course_bucket_index is not None:
        bucket_ids = _course_bucket_index.get(course_code, [])
    else:
        track_map = course_bucket_map_df[
            (course_bucket_map_df["track_id"] == track_id)
            & (course_bucket_map_df["course_code"] == course_code)
        ]
        bucket_ids = []
        for _, row in track_map.iterrows():
            bid = str(row.get("bucket_id", "") or "").strip()
            if bid and bid not in bucket_ids:
                bucket_ids.append(bid)

    result = []
    seen_bucket_ids: set[str] = set()
    for bid in bucket_ids:
        if bid in seen_bucket_ids:
            continue
        meta = bucket_meta.get(bid)
        if meta is None:
            continue
        # Check min_level
        min_lvl = meta.get("min_level")
        if min_lvl is not None and not (isinstance(min_lvl, float) and pd.isna(min_lvl)):
            min_lvl = int(min_lvl)
            if course_level is not None and course_level < min_lvl:
                continue
        priority_raw = pd.to_numeric(meta.get("priority", 99), errors="coerce")
        parent_priority_raw = pd.to_numeric(
            meta.get("parent_bucket_priority", 99),
            errors="coerce",
        )

        result.append({
            "bucket_id": bid,
            "label": str(meta.get("bucket_label", bid)),
            "priority": int(priority_raw) if pd.notna(priority_raw) else 99,
            "parent_bucket_priority": int(parent_priority_raw) if pd.notna(parent_priority_raw) else 99,
            "parent_bucket_id": str(meta.get("parent_bucket_id", "") or "").strip().upper(),
            "double_count_family_id": str(meta.get("double_count_family_id", "") or "").strip(),
            "requirement_mode": str(meta.get("requirement_mode", "") or "").strip().lower(),
        })
        seen_bucket_ids.add(bid)

    result.sort(key=lambda b: (b["priority"], str(b.get("bucket_id", ""))))
    result = _prune_same_family_elective_overlap(result)
    return _order_buckets_same_family(result)


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
    reverse_map: dict[str, list[str]] | None = None,
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

    track_key = str(track_id or "").strip().upper()
    if reverse_map is None:
        reverse_map = build_reverse_prereq_map(courses_df, prereq_map)

    # Build per-request indexes to avoid repeated dataframe scans in the loop below.
    course_bucket_index: dict[str, list[str]] = {}
    if (
        course_bucket_map_df is not None
        and len(course_bucket_map_df) > 0
        and {"track_id", "course_code", "bucket_id"}.issubset(course_bucket_map_df.columns)
    ):
        track_map = course_bucket_map_df[
            course_bucket_map_df["track_id"].astype(str).str.strip().str.upper() == track_key
        ]
        for _, map_row in track_map.iterrows():
            code = str(map_row.get("course_code", "") or "").strip()
            bid = str(map_row.get("bucket_id", "") or "").strip()
            if not code or not bid:
                continue
            bucket_ids = course_bucket_index.setdefault(code, [])
            if bid not in bucket_ids:
                bucket_ids.append(bid)

    bucket_meta: dict[str, dict] = {}
    if (
        buckets_df is not None
        and len(buckets_df) > 0
        and "bucket_id" in buckets_df.columns
    ):
        if "track_id" in buckets_df.columns:
            track_bucket_rows = buckets_df[
                buckets_df["track_id"].astype(str).str.strip().str.upper() == track_key
            ]
        else:
            track_bucket_rows = buckets_df
        for _, bucket_row in track_bucket_rows.iterrows():
            bid = str(bucket_row.get("bucket_id", "") or "").strip()
            if not bid:
                continue
            bucket_meta[bid] = {
                "bucket_label": str(bucket_row.get("bucket_label", bid)),
                "priority": bucket_row.get("priority", 99),
                "parent_bucket_priority": bucket_row.get("parent_bucket_priority", 99),
                "parent_bucket_id": str(bucket_row.get("parent_bucket_id", "") or "").strip().upper(),
                "double_count_family_id": str(bucket_row.get("double_count_family_id", "") or "").strip(),
                "requirement_mode": str(bucket_row.get("requirement_mode", "") or "").strip().lower(),
                "min_level": bucket_row.get("min_level"),
            }

    course_level_index: dict[str, int | None] = {}
    if courses_df is not None and len(courses_df) > 0 and "course_code" in courses_df.columns:
        for _, course_row in courses_df.iterrows():
            code = str(course_row.get("course_code", "") or "").strip()
            if not code or code in course_level_index:
                continue
            lvl = course_row.get("level")
            if lvl is not None and not (isinstance(lvl, float) and pd.isna(lvl)):
                course_level_index[code] = int(lvl)
            else:
                course_level_index[code] = None

    unmet_course_buckets: dict[str, list[str]] = {}
    for bucket_id, remaining in (allocator_remaining or {}).items():
        slots_remaining_raw = pd.to_numeric(
            (remaining or {}).get("slots_remaining", 0),
            errors="coerce",
        )
        slots_remaining = int(slots_remaining_raw) if pd.notna(slots_remaining_raw) else 0
        if slots_remaining <= 0:
            continue
        for raw_code in (remaining or {}).get("remaining_courses", []) or []:
            code = str(raw_code or "").strip()
            if not code:
                continue
            target_buckets = unmet_course_buckets.setdefault(code, [])
            if bucket_id not in target_buckets:
                target_buckets.append(bucket_id)
    unmet_remaining_courses = set(unmet_course_buckets.keys())

    results = []

    for _, row in courses_df.iterrows():
        code = row["course_code"]

        # Skip already taken / in-progress
        if code in completed_set or code in in_progress_set:
            continue
        if _is_non_recommendable_course(code, row.get("course_name")):
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
        warning_text = str(row.get("warning_text", "") or "").strip()
        if not warning_text or warning_text.lower() == "nan":
            warning_text = None

        # Bucket info
        eligible_buckets = get_course_eligible_buckets(
            code,
            course_bucket_map_df,
            courses_df,
            buckets_df,
            track_id=track_id,
            _course_bucket_index=course_bucket_index,
            _bucket_meta=bucket_meta,
            _course_level_index=course_level_index,
        )

        # Keep only courses that can fill at least one unmet bucket slot.
        # This avoids recommending extra courses for already-satisfied buckets
        # (e.g., MCC_ESSV1 after its single-slot requirement is fulfilled).
        unmet_buckets = [
            b for b in eligible_buckets
            if allocator_remaining.get(b["bucket_id"], {}).get("slots_remaining", 0) > 0
        ]
        direct_unmet_unlocks = [
            unlocked_code
            for unlocked_code in reverse_map.get(code, [])
            if unlocked_code in unmet_remaining_courses
        ]
        bridge_target_buckets: list[dict] = []
        seen_bridge_bucket_ids: set[str] = set()
        for unlocked_code in direct_unmet_unlocks:
            for target_bucket_id in unmet_course_buckets.get(unlocked_code, []):
                if target_bucket_id in seen_bridge_bucket_ids:
                    continue
                target_meta = bucket_meta.get(target_bucket_id)
                if target_meta is None:
                    continue
                priority_raw = pd.to_numeric(target_meta.get("priority", 99), errors="coerce")
                parent_priority_raw = pd.to_numeric(
                    target_meta.get("parent_bucket_priority", 99),
                    errors="coerce",
                )
                bridge_target_buckets.append({
                    "bucket_id": target_bucket_id,
                    "label": str(target_meta.get("bucket_label", target_bucket_id)),
                    "priority": int(priority_raw) if pd.notna(priority_raw) else 99,
                    "parent_bucket_priority": int(parent_priority_raw) if pd.notna(parent_priority_raw) else 99,
                    "parent_bucket_id": str(target_meta.get("parent_bucket_id", "") or "").strip().upper(),
                })
                seen_bridge_bucket_ids.add(target_bucket_id)
        bridge_target_buckets.sort(
            key=lambda b: (b["priority"], str(b.get("bucket_id", ""))),
        )

        if not unmet_buckets and not bridge_target_buckets:
            continue

        # Multi-bucket score reflects unmet buckets for ranking, while
        # fills_buckets shows only direct bucket mappings (never bridge targets).
        multi_bucket_score = len(unmet_buckets)

        display_buckets = [b["bucket_id"] for b in eligible_buckets]
        primary = (
            unmet_buckets[0]
            if unmet_buckets
            else (
                bridge_target_buckets[0]
                if bridge_target_buckets
                else (eligible_buckets[0] if eligible_buckets else None)
            )
        )

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

        _ps = row.get("prereq_level", 0)
        try:
            min_standing = int(float(_ps)) if _ps not in (None, "", "nan") else 0
        except (TypeError, ValueError):
            min_standing = 0

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
            "primary_parent_bucket_priority": primary["parent_bucket_priority"] if primary else 99,
            "primary_parent_bucket_id": primary["parent_bucket_id"] if primary else "",
            "fills_buckets": display_buckets,
            "selection_buckets": [b["bucket_id"] for b in eligible_buckets],
            "multi_bucket_score": multi_bucket_score,
            "bridge_target_buckets": [b["bucket_id"] for b in bridge_target_buckets],
            "unlocks_unmet_courses": direct_unmet_unlocks,
            "is_bridge_course": bool(bridge_target_buckets) and not bool(eligible_buckets),
            "prereq_check": prereq_check,
            "has_soft_requirement": has_soft_requirement,
            "soft_tags": warning_tags,
            "all_soft_tags": soft_tags,
            "warning_text": warning_text,
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
        if t == "choose_n":
            courses = prereq_course_codes(parsed_req)
            satisfied = [c for c in courses if c in source]
            if len(satisfied) >= parsed_req["count"]:
                return []
            return [c for c in courses if c not in source]
        return []

    if has_explicit_concurrent:
        missing_hard = missing_from(parsed, completed_set)
        missing_conc = missing_from(parsed_concurrent, satisfied_codes)
        missing = missing_hard + [m for m in missing_conc if m not in missing_hard]
    else:
        source = satisfied_codes if allow_concurrent else completed_set
        missing = missing_from(parsed, source)

    if parsed["type"] == "choose_n" and missing:
        needed_more = max(0, parsed["count"] - sum(1 for c in parsed["courses"] if c in (satisfied_codes if allow_concurrent else completed_set)))
        why_not = f"Need {needed_more} more prerequisite course(s) from: {', '.join(missing)}."
    else:
        why_not = f"Missing prerequisite(s): {', '.join(missing)}." if missing else "Prerequisites not satisfied."

    return {
        "can_take": False,
        "why_not": why_not,
        "missing_prereqs": missing,
        "not_offered_this_term": False,
        "unsupported_prereq_format": False,
    }
