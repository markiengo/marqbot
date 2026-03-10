import re
import pandas as pd
from prereq_parser import prereq_course_codes, prereqs_satisfied, build_prereq_check_string
from requirements import SOFT_WARNING_TAGS, COMPLEX_PREREQ_TAGS, CONCURRENT_TAGS, DEFAULT_TRACK_ID
from unlocks import build_reverse_prereq_map
from allocator import get_runtime_course_index, get_runtime_track_index, _safe_bool
from student_stage import (
    build_student_stage_block_message,
    coerce_course_level,
    stage_allows_course_level,
)


def parse_term(s: str) -> str:
    """'Fall 2026' → 'Fall'. Year is ignored."""
    for t in ("Fall", "Spring", "Summer"):
        if t.lower() in s.lower():
            return t
    raise ValueError(f"Cannot parse term from: {s!r}")


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

_PHASE5_PLAN_TRACK_ID = "__DECLARED_PLAN__"
_PROGRAM_CONTEXT_RE = re.compile(
    r"\b([A-Z]{2,7}(?:-[A-Z]{2,7})?)\s+(?:majors?|minors?|program)\b",
    re.IGNORECASE,
)
_BUSINESS_GENERIC_RE = re.compile(
    r"\b("
    r"college of business administration|"
    r"college of business|"
    r"business second major|"
    r"business majors?|"
    r"business minors?"
    r")\b",
    re.IGNORECASE,
)
_POSITIVE_COLLEGE_PATTERNS = (
    (re.compile(r"\b(?:college of business administration|college of business)\b", re.IGNORECASE), "business"),
    (re.compile(r"\b(?:opus college of engineering|college of engineering)\b", re.IGNORECASE), "engineering"),
    (
        re.compile(
            r"\b(?:klingler college of arts and sciences|college of arts and sciences|college of arts and science)\b",
            re.IGNORECASE,
        ),
        "arts_sciences",
    ),
    (re.compile(r"\b(?:diederich college of communication|college of communication)\b", re.IGNORECASE), "communication"),
    (re.compile(r"\bcollege of health sciences\b", re.IGNORECASE), "health_sciences"),
    (re.compile(r"\bcollege of nursing\b", re.IGNORECASE), "nursing"),
    (re.compile(r"\bcollege of education\b", re.IGNORECASE), "education"),
)
_NEGATIVE_COLLEGE_PATTERNS = (
    (
        re.compile(
            r"\bnot enrolled in (?:the )?(?:college of business administration|college of business)\b",
            re.IGNORECASE,
        ),
        "business",
    ),
)


def _bridge_target_allowed(parent_id: str) -> bool:
    raw = str(parent_id or "").strip().upper()
    if not raw:
        return False
    if raw.startswith("MCC_DISC"):
        return False
    if raw.startswith("MCC") or raw.startswith("BCC"):
        return True
    return raw.endswith("_MAJOR")


def _has_non_integer_credits(raw_credits) -> bool:
    """
    Return True when credits include any non-integer numeric value.

    Examples considered non-integer:
      1.5
      "1.5"
      "1.5-3"
    """
    if raw_credits is None:
        return False
    s = str(raw_credits).strip()
    if not s or s.lower() == "nan":
        return False

    # Support scalar values and ranges like "1-3" or "1.5-3".
    parts = [p.strip() for p in s.split("-") if p.strip()]
    if not parts:
        return False

    for part in parts:
        val = pd.to_numeric(part, errors="coerce")
        if pd.isna(val):
            continue
        if float(val) % 1 != 0:
            return True
    return False


def _is_non_recommendable_course(
    course_code: str,
    course_name: str | None = None,
    credits=None,
    is_honors_student: bool = False,
) -> bool:
    """
    Suppress non-recommendable courses from recommendation candidates.
    Internships, work periods, independent studies, and topics courses
    plus non-integer-credit courses have variable structure or scheduling and cannot be
    deterministically recommended.  They still count toward bucket
    progress when completed/in-progress (allocator does NOT call this).
    """
    code = str(course_code or "").strip().upper()
    name = str(course_name or "").strip().lower()
    if re.search(r"\b4986\b", code):
        return True
    # Honors-section courses (H suffix) are excluded for non-honors students.
    if not is_honors_student and re.search(r"\d+H$", code):
        return True
    if _has_non_integer_credits(credits):
        return True
    return any(p in name for p in _NON_RECOMMENDABLE_PATTERNS)


def _normalize_selected_program_ids(
    selected_program_ids: list[str] | None,
    track_id: str,
) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for raw_program_id in selected_program_ids or []:
        program_id = str(raw_program_id or "").strip().upper()
        if not program_id or program_id in seen:
            continue
        seen.add(program_id)
        normalized.append(program_id)
    fallback_track = str(track_id or "").strip().upper()
    if not normalized and fallback_track and fallback_track != _PHASE5_PLAN_TRACK_ID:
        normalized.append(fallback_track)
    return normalized


def _program_base_ids(program_ids: list[str]) -> set[str]:
    bases: set[str] = set()
    for program_id in program_ids:
        upper = str(program_id or "").strip().upper()
        if not upper or upper == _PHASE5_PLAN_TRACK_ID or upper.startswith("MCC_"):
            continue
        if "_" in upper:
            base = upper.split("_", 1)[0]
            if base:
                bases.add(base)
            continue
        bases.add(upper)
    return bases


def _selected_college_aliases(program_ids: list[str]) -> set[str]:
    # Current selectable academic programs in this app are business programs plus MCC overlays.
    colleges: set[str] = set()
    for program_id in program_ids:
        upper = str(program_id or "").strip().upper()
        if not upper or upper == _PHASE5_PLAN_TRACK_ID or upper.startswith("MCC_"):
            continue
        colleges.add("business")
        break
    return colleges


def _extract_enforceable_major_bases(text: str) -> set[str]:
    raw_text = str(text or "")
    return {
        match.group(1).upper().split("-", 1)[0]
        for match in _PROGRAM_CONTEXT_RE.finditer(raw_text)
        if match.group(1)
    }


def _evaluate_major_restriction(
    text: str,
    selected_program_ids: list[str],
) -> tuple[bool, str | None, bool]:
    raw_text = str(text or "").strip()
    if not raw_text:
        return False, None, False

    selected_bases = _program_base_ids(selected_program_ids)
    selected_colleges = _selected_college_aliases(selected_program_ids)

    if _BUSINESS_GENERIC_RE.search(raw_text):
        if "business" in selected_colleges:
            return False, None, True
        return True, "Restricted to business majors/minors.", False

    required_bases = _extract_enforceable_major_bases(raw_text)
    if not required_bases:
        return False, None, False
    if selected_bases & required_bases:
        return False, None, True

    required_label = ", ".join(sorted(required_bases))
    return True, f"Restricted to {required_label} program context.", False


def _evaluate_college_restriction(
    text: str,
    selected_program_ids: list[str],
) -> tuple[bool, str | None, bool]:
    raw_text = str(text or "").strip()
    if not raw_text:
        return False, None, False

    selected_colleges = _selected_college_aliases(selected_program_ids)
    negative_aliases = {
        alias
        for pattern, alias in _NEGATIVE_COLLEGE_PATTERNS
        if pattern.search(raw_text)
    }
    if negative_aliases:
        blocked_aliases = selected_colleges & negative_aliases
        if blocked_aliases:
            label = ", ".join(sorted(blocked_aliases))
            return True, f"Not available to {label} college students.", False
        return False, None, True

    positive_aliases = {
        alias
        for pattern, alias in _POSITIVE_COLLEGE_PATTERNS
        if pattern.search(raw_text)
    }
    if not positive_aliases:
        return False, None, False
    if selected_colleges & positive_aliases:
        return False, None, True

    label = ", ".join(sorted(positive_aliases))
    return True, f"Restricted to {label} college students.", False


def _evaluate_soft_restrictions(
    row,
    soft_tags: list[str],
    selected_program_ids: list[str] | None,
    track_id: str,
) -> tuple[bool, str | None, set[str]]:
    normalized_program_ids = _normalize_selected_program_ids(selected_program_ids, track_id)
    if not normalized_program_ids:
        return False, None, set()

    cleared_tags: set[str] = set()

    if "major_restriction" in soft_tags:
        blocked, reason, satisfied = _evaluate_major_restriction(
            row.get("soft_prereq_major_restriction", ""),
            normalized_program_ids,
        )
        if blocked:
            return True, reason, cleared_tags
        if satisfied:
            cleared_tags.add("major_restriction")

    if "college_restriction" in soft_tags:
        blocked, reason, satisfied = _evaluate_college_restriction(
            row.get("soft_prereq_college_restriction", ""),
            normalized_program_ids,
        )
        if blocked:
            return True, reason, cleared_tags
        if satisfied:
            cleared_tags.add("college_restriction")

    return False, None, cleared_tags


def _prereqs_satisfied_for_semester(
    *,
    parsed: dict,
    parsed_concurrent: dict,
    allow_concurrent: bool,
    has_explicit_concurrent: bool,
    completed_set: set[str],
    satisfied_codes: set[str],
    semester_codes: set[str],
    equiv_map: dict[str, set[str]] | None = None,
) -> bool:
    semester_satisfied = satisfied_codes | set(semester_codes)
    if has_explicit_concurrent:
        hard_ok = prereqs_satisfied(parsed, completed_set, equiv_map=equiv_map)
        concurrent_ok = prereqs_satisfied(parsed_concurrent, semester_satisfied, equiv_map=equiv_map)
        return hard_ok and concurrent_ok

    prereq_source = semester_satisfied if allow_concurrent else completed_set
    return prereqs_satisfied(parsed, prereq_source, equiv_map=equiv_map)


def _missing_from(
    parsed_req: dict,
    source: set[str],
    equiv_map: dict[str, set[str]] | None = None,
) -> list[str]:
    if equiv_map:
        expanded = set(source)
        for code in source:
            expanded.update(equiv_map.get(code, set()))
        source = expanded
    req_type = parsed_req["type"]
    if req_type == "single":
        return [parsed_req["course"]] if parsed_req["course"] not in source else []
    if req_type == "and":
        missing: list[str] = []
        for clause in parsed_req["courses"]:
            if isinstance(clause, dict):
                missing.extend(_missing_from(clause, source))
            elif clause not in source:
                missing.append(clause)
        return missing
    if req_type == "or":
        return [] if any(course in source for course in parsed_req["courses"]) else parsed_req["courses"]
    if req_type == "choose_n":
        courses = prereq_course_codes(parsed_req)
        satisfied = [course for course in courses if course in source]
        if len(satisfied) >= parsed_req["count"]:
            return []
        return [course for course in courses if course not in source]
    return []


def _same_semester_prereqs(
    *,
    parsed: dict,
    parsed_concurrent: dict,
    allow_concurrent: bool,
    has_explicit_concurrent: bool,
    satisfied_codes: set[str],
    semester_codes: set[str],
) -> list[str]:
    extra_semester_codes = set(semester_codes) - satisfied_codes
    if not extra_semester_codes:
        return []
    if has_explicit_concurrent:
        missing_concurrent = _missing_from(parsed_concurrent, satisfied_codes)
        return sorted(code for code in missing_concurrent if code in extra_semester_codes)
    if allow_concurrent:
        missing_hard = _missing_from(parsed, satisfied_codes)
        return sorted(code for code in missing_hard if code in extra_semester_codes)
    return []


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


def _prune_discovery_elective_display(
    eligible_buckets: list[dict],
    unmet_buckets: list[dict],
) -> list[str]:
    """Build display bucket IDs, hiding Discovery Elective when the same course
    also fills a required sibling (HUM/NSM/SSC) in the same family.  A single
    course can only count toward one child bucket, so showing both is confusing."""
    # Identify families where this course fills a required (non-ELEC) bucket.
    families_with_required_fill: set[str] = set()
    for b in eligible_buckets:
        mode = str(b.get("requirement_mode", "")).strip().lower()
        if mode == "required":
            family = _bucket_family_key(b)
            if family:
                families_with_required_fill.add(family)

    result: list[str] = []
    for b in eligible_buckets:
        bid = b["bucket_id"]
        mode = str(b.get("requirement_mode", "")).strip().lower()
        family = _bucket_family_key(b)
        # Suppress _ELEC when the course also fills a required bucket in the same family.
        if (
            mode == "choose_n"
            and bid.endswith("_ELEC")
            and family
            and family in families_with_required_fill
        ):
            continue
        result.append(bid)
    return result


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
    runtime_indexes: dict | None = None,
    *,
    selected_program_ids: list[str] | None = None,
    restrict_to_unmet_buckets: bool = True,
    is_honors_student: bool = False,
    equiv_map: dict[str, set[str]] | None = None,
    cross_listed_map: dict[str, set[str]] | None = None,
    current_standing: int = 0,
    student_stage: str | None = None,
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

    runtime_track = get_runtime_track_index(runtime_indexes, track_key)
    runtime_courses = get_runtime_course_index(runtime_indexes)

    if runtime_track is not None:
        course_bucket_index = runtime_track["course_bucket_index"]
        bucket_meta = {
            bid: {
                "bucket_label": meta.get("label", bid),
                "priority": meta.get("priority", 99),
                "parent_bucket_priority": meta.get("parent_bucket_priority", 99),
                "parent_bucket_id": meta.get("parent_bucket_id", ""),
                "double_count_family_id": meta.get("double_count_family_id", ""),
                "requirement_mode": meta.get("requirement_mode", ""),
                "min_level": meta.get("min_level"),
            }
            for bid, meta in runtime_track["bucket_meta_template"].items()
        }
        course_level_index = runtime_track["course_level_index"]
    else:
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

    course_rows = runtime_courses["rows"] if runtime_courses is not None else None
    if course_rows is None:
        course_rows = [row for _, row in courses_df.iterrows()]

    prepared_candidates: list[dict] = []
    semester_candidate_codes: set[str] = set()

    for row in course_rows:
        code = row["course_code"]
        course_level = coerce_course_level(course_level_index.get(code), code)

        if code in completed_set or code in in_progress_set:
            continue
        # Skip cross-listed aliases of already completed/in-progress courses.
        if cross_listed_map:
            aliases = cross_listed_map.get(code, set())
            if aliases & (completed_set | in_progress_set):
                continue
        # Skip equivalent aliases of already completed/in-progress courses,
        # but only when the course isn't explicitly required in an unmet bucket.
        # Example: REAL 4061 and REAL 4100 may be listed as equivalents but are
        # both distinct required entries in REAL-REQ-CORE; skipping REAL 4100
        # because REAL 4061 is completed would leave the bucket permanently short.
        if equiv_map:
            equiv_aliases = equiv_map.get(code, set())
            if equiv_aliases & (completed_set | in_progress_set):
                if code not in unmet_remaining_courses:
                    continue
        if _is_non_recommendable_course(
            code,
            row.get("course_name"),
            row.get("credits"),
            is_honors_student=is_honors_student,
        ):
            continue
        # Courses at 6000+ level are graduate-only and are never auto-recommended
        # for undergrad students. The intended gate is min_standing >= 5.0 in the data;
        # this is a safety net for any grad course whose data omits that gate.
        # (5000-level courses may be legitimate advanced-undergrad requirements.)
        if course_level is not None and course_level >= 6000:
            continue
        if student_stage and not stage_allows_course_level(student_stage, course_level):
            continue

        offered_this_term = _safe_bool(row.get(term_col, False))
        parsed = prereq_map.get(code, {"type": "none"})
        raw_concurrent = row.get("prereq_concurrent", "none")
        parsed_concurrent = row.get("parsed_concurrent")
        if parsed_concurrent is None:
            parsed_concurrent = prereq_map.get(f"{code}::__concurrent__")
        if parsed_concurrent is None:
            from prereq_parser import parse_prereqs
            parsed_concurrent = parse_prereqs(raw_concurrent if not _is_none_prereq(raw_concurrent) else "none")

        manual_review = parsed["type"] == "unsupported"
        soft_tags = row.get("soft_tags")
        if soft_tags is None:
            soft_raw = str(row.get("prereq_soft", "") or "")
            soft_tags = [tag.strip() for tag in soft_raw.split(";") if tag.strip()] if soft_raw else []
        else:
            soft_tags = list(soft_tags)

        restriction_blocked, _restriction_reason, cleared_restriction_tags = _evaluate_soft_restrictions(
            row,
            soft_tags,
            selected_program_ids,
            track_id,
        )
        if restriction_blocked:
            continue
        if cleared_restriction_tags:
            soft_tags = [tag for tag in soft_tags if tag not in cleared_restriction_tags]

        allow_concurrent = any(tag in CONCURRENT_TAGS for tag in soft_tags)
        has_explicit_concurrent = not _is_none_prereq(raw_concurrent)
        complex_tag_blocks = (
            any(tag in COMPLEX_PREREQ_TAGS for tag in soft_tags)
            and not (parsed["type"] == "none" and (allow_concurrent or has_explicit_concurrent))
        )
        if complex_tag_blocks:
            manual_review = True
        if parsed_concurrent["type"] == "unsupported":
            manual_review = True

        course_notes = row.get("notes")
        if course_notes is None:
            course_notes = str(row.get("notes", "") or "")
            if not course_notes or course_notes == "nan":
                course_notes = None
        warning_text = row.get("warning_text")
        if warning_text is None:
            warning_text = str(row.get("warning_text", "") or "").strip()
            if not warning_text or warning_text.lower() == "nan":
                warning_text = None

        prepared_candidates.append({
            "row": row,
            "code": code,
            "course_level": course_level,
            "offered_this_term": offered_this_term,
            "parsed": parsed,
            "parsed_concurrent": parsed_concurrent,
            "manual_review": manual_review,
            "soft_tags": soft_tags,
            "allow_concurrent": allow_concurrent,
            "has_explicit_concurrent": has_explicit_concurrent,
            "course_notes": course_notes,
            "warning_text": warning_text,
        })

    changed = True
    while changed:
        changed = False
        for candidate in prepared_candidates:
            if candidate["manual_review"] or candidate["code"] in semester_candidate_codes:
                continue
            if _prereqs_satisfied_for_semester(
                parsed=candidate["parsed"],
                parsed_concurrent=candidate["parsed_concurrent"],
                allow_concurrent=candidate["allow_concurrent"],
                has_explicit_concurrent=candidate["has_explicit_concurrent"],
                completed_set=completed_set,
                satisfied_codes=satisfied_codes,
                semester_codes=semester_candidate_codes,
                equiv_map=equiv_map,
            ):
                semester_candidate_codes.add(candidate["code"])
                changed = True

    results = []

    for candidate in prepared_candidates:
        row = candidate["row"]
        code = candidate["code"]
        course_level = candidate["course_level"]
        parsed = candidate["parsed"]
        parsed_concurrent = candidate["parsed_concurrent"]
        soft_tags = list(candidate["soft_tags"])
        allow_concurrent = candidate["allow_concurrent"]
        has_explicit_concurrent = candidate["has_explicit_concurrent"]
        manual_review = candidate["manual_review"]
        offered_this_term = candidate["offered_this_term"]
        course_notes = candidate["course_notes"]
        warning_text = candidate["warning_text"]

        prereq_satisfied = manual_review or code in semester_candidate_codes
        if not prereq_satisfied:
            continue

        confidence = str(row.get("offering_confidence", "high") or "high").lower()
        low_confidence = confidence in ("medium", "low", "unknown") or not offered_this_term

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

        unmet_buckets = [
            bucket
            for bucket in eligible_buckets
            if allocator_remaining.get(bucket["bucket_id"], {}).get("slots_remaining", 0) > 0
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
                req_mode = str(target_meta.get("requirement_mode", "") or "").strip().lower()
                if req_mode == "credits_pool":
                    continue
                parent_id = str(target_meta.get("parent_bucket_id", "") or "").strip().upper()
                if not _bridge_target_allowed(parent_id):
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
            key=lambda bucket: (bucket["priority"], str(bucket.get("bucket_id", ""))),
        )

        if not unmet_buckets and not bridge_target_buckets:
            if not restrict_to_unmet_buckets and eligible_buckets:
                pass
            else:
                continue

        multi_bucket_score = len(unmet_buckets)
        display_buckets = _prune_discovery_elective_display(eligible_buckets, unmet_buckets)
        primary = (
            unmet_buckets[0]
            if unmet_buckets
            else (
                bridge_target_buckets[0]
                if bridge_target_buckets
                else (eligible_buckets[0] if eligible_buckets else None)
            )
        )

        same_semester_prereqs = _same_semester_prereqs(
            parsed=parsed,
            parsed_concurrent=parsed_concurrent,
            allow_concurrent=allow_concurrent,
            has_explicit_concurrent=has_explicit_concurrent,
            satisfied_codes=satisfied_codes,
            semester_codes=semester_candidate_codes,
        )

        if has_explicit_concurrent:
            hard_label = build_prereq_check_string(parsed, completed_set, set())
            concurrent_label = build_prereq_check_string(
                parsed_concurrent,
                completed_set,
                in_progress_set | set(same_semester_prereqs),
            )
            prereq_check = f"Hard prereq: {hard_label}; Concurrent allowed: {concurrent_label}"
        else:
            ip_for_check = (in_progress_set | set(same_semester_prereqs)) if allow_concurrent else set()
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

        if "standing_requirement" in soft_tags and min_standing == 0:
            match = re.search(r"\d+", code or "")
            if match:
                level_digit = int(match.group()) // 1000
                if level_digit >= 2:
                    min_standing = max(1, level_digit - 1)
        if min_standing > 0 and "standing_requirement" not in soft_tags:
            soft_tags = list(soft_tags) + ["standing_requirement"]
        if min_standing > 0 and current_standing >= min_standing:
            soft_tags = [t for t in soft_tags if t != "standing_requirement"]

        warning_tags = [tag for tag in soft_tags if tag in SOFT_WARNING_TAGS]
        has_soft_requirement = bool(warning_tags)

        results.append({
            "course_code": code,
            "course_name": str(row.get("course_name", "")),
            "credits": int(row.get("credits", 3)) if not pd.isna(row.get("credits", 3)) else 3,
            "course_level": course_level,
            "prereq_level": min_standing,
            "min_standing": min_standing,
            "primary_bucket": primary["bucket_id"] if primary else None,
            "primary_bucket_label": primary["label"] if primary else None,
            "primary_bucket_priority": primary["priority"] if primary else 99,
            "primary_parent_bucket_priority": primary["parent_bucket_priority"] if primary else 99,
            "primary_parent_bucket_id": primary["parent_bucket_id"] if primary else "",
            "fills_buckets": display_buckets,
            "selection_buckets": [bucket["bucket_id"] for bucket in eligible_buckets],
            "multi_bucket_score": multi_bucket_score,
            "bridge_target_buckets": [bucket["bucket_id"] for bucket in bridge_target_buckets],
            "unlocks_unmet_courses": direct_unmet_unlocks,
            "is_bridge_course": bool(bridge_target_buckets) and not bool(unmet_buckets),
            "same_semester_prereqs": same_semester_prereqs,
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

    # ── Honors dedup: drop base courses when H variant is also eligible ──
    if is_honors_student and equiv_map:
        result_codes = {r["course_code"] for r in results}
        drop_bases: set[str] = set()
        for code in result_codes:
            if re.search(r"\d+H$", code):
                # Find the base code (strip trailing H)
                base = code[:-1]
                if base in result_codes:
                    drop_bases.add(base)
        if drop_bases:
            results = [r for r in results if r["course_code"] not in drop_bases]

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
    selected_program_ids: list[str] | None = None,
    runtime_indexes: dict | None = None,
    equiv_map: dict[str, set[str]] | None = None,
    student_stage: str | None = None,
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

    runtime_courses = get_runtime_course_index(runtime_indexes)
    row = runtime_courses.get("by_code", {}).get(requested_code) if runtime_courses else None
    if row is None:
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

    if row is None:
        return {
            "can_take": False,
            "why_not": f"{requested_code} is not in the course catalog.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
        }

    course_level = coerce_course_level(row.get("level"), requested_code)
    if student_stage and not stage_allows_course_level(student_stage, course_level):
        return {
            "can_take": False,
            "why_not": build_student_stage_block_message(
                student_stage,
                requested_code,
                course_level,
            ),
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
        }

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
    parsed_concurrent = row.get("parsed_concurrent")
    if parsed_concurrent is None:
        from prereq_parser import parse_prereqs
        parsed_concurrent = parse_prereqs(raw_concurrent if not _is_none_prereq(raw_concurrent) else "none")

    # Check soft tags
    soft_tags = row.get("soft_tags")
    if soft_tags is None:
        soft_raw = str(row.get("prereq_soft", "") or "")
        soft_tags = [t.strip() for t in soft_raw.split(";") if t.strip()] if soft_raw else []
    else:
        soft_tags = list(soft_tags)
    restriction_blocked, restriction_reason, cleared_restriction_tags = _evaluate_soft_restrictions(
        row,
        soft_tags,
        selected_program_ids,
        "",
    )
    if restriction_blocked:
        return {
            "can_take": False,
            "why_not": restriction_reason or "Program restriction not satisfied.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
        }
    if cleared_restriction_tags:
        soft_tags = [tag for tag in soft_tags if tag not in cleared_restriction_tags]
    allow_concurrent = any(t in CONCURRENT_TAGS for t in soft_tags)
    has_explicit_concurrent = not _is_none_prereq(raw_concurrent)

    complex_tag_blocks = (
        any(tag in COMPLEX_PREREQ_TAGS for tag in soft_tags)
        and not (parsed["type"] == "none" and (allow_concurrent or has_explicit_concurrent))
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
        hard_ok = prereqs_satisfied(parsed, completed_set, equiv_map=equiv_map)
        concurrent_ok = prereqs_satisfied(parsed_concurrent, satisfied_codes, equiv_map=equiv_map)
        overall_ok = hard_ok and concurrent_ok
    else:
        prereq_source = satisfied_codes if allow_concurrent else completed_set
        overall_ok = prereqs_satisfied(parsed, prereq_source, equiv_map=equiv_map)

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
    if has_explicit_concurrent:
        missing_hard = _missing_from(parsed, completed_set, equiv_map=equiv_map)
        missing_conc = _missing_from(parsed_concurrent, satisfied_codes, equiv_map=equiv_map)
        missing = missing_hard + [m for m in missing_conc if m not in missing_hard]
    else:
        source = satisfied_codes if allow_concurrent else completed_set
        missing = _missing_from(parsed, source, equiv_map=equiv_map)

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
