import re

import pandas as pd

from requirements import (
    DEFAULT_TRACK_ID,
    BLOCKING_WARNING_THRESHOLD,
    get_allowed_double_count_pairs,
    get_buckets_by_role,
)
from allocator import (
    allocate_courses,
    get_applied_bucket_progress_units,
    _safe_int,
    _infer_requirement_mode,
)
from unlocks import get_blocking_warnings
from eligibility import get_eligible_courses, parse_term
from prereq_parser import prereq_course_codes


SEM_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)

_MAX_PER_BUCKET_PER_SEM = 2
_DISC_FAMILY_PREFIX = "MCC_DISC"
_PROJECTION_NOTE = (
    "Projected progress below assumes you complete these recommendations."
)
_DISCOVERY_FOUNDATION_BUCKET_IDS = {"MCC_CORE", "MCC_ESSV1"}
_MCC_FOUNDATION_BUCKET_IDS = {"MCC_CORE", "MCC_ESSV1"}
_MCC_LATE_BUCKET_IDS = {"MCC_ESSV2", "MCC_WRIT"}
_MCC_LOWEST_BUCKET_IDS = {"MCC_CULM"}
_STANDING_SOFT_TAG = "standing_requirement"
_BUSINESS_DEPTS = {
    "ACCO", "AIM", "BUAD", "BUAN", "BULA", "ECON", "FINA",
    "HURE", "INBU", "INSY", "LEAD", "MANA", "MARK", "OSCM", "REAL",
}
_NEUTRAL_DISCOVERY_DEPTS = {
    "ANTH", "COMM", "CMST", "ENGL", "HIST", "MATH", "PHIL",
    "POSC", "PSYC", "SOCI", "SOWJ", "THEO",
}

_STANDING_LABELS = {1: "Freshman", 2: "Sophomore", 3: "Junior", 4: "Senior"}
_BCC_PREFIX = "BCC_"
_MATH_SUBJECT_PREFIX = "MATH"


def _credits_to_standing(credits: int) -> int:
    if credits >= 90:
        return 4
    if credits >= 60:
        return 3
    if credits >= 24:
        return 2
    return 1


def normalize_semester_label(label: str) -> str:
    m = SEM_RE.match((label or "").strip())
    if not m:
        return label
    term = m.group(1).capitalize()
    year = int(m.group(2))
    return f"{term} {year}"


def default_followup_semester(first_semester: str) -> str:
    """
    Optional second-semester default:
    - Spring YYYY -> Fall YYYY (skip Summer by default)
    - Summer YYYY -> Fall YYYY
    - Fall YYYY   -> Spring YYYY+1
    """
    m = SEM_RE.match((first_semester or "").strip())
    if not m:
        return "Fall 2026"
    term = m.group(1).capitalize()
    year = int(m.group(2))
    if term == "Spring":
        return f"Fall {year}"
    if term == "Summer":
        return f"Fall {year}"
    return f"Spring {year + 1}"


def default_followup_semester_with_summer(first_semester: str) -> str:
    """
    Like default_followup_semester but inserts Summer between Spring and Fall:
    - Spring YYYY -> Summer YYYY
    - Summer YYYY -> Fall YYYY
    - Fall YYYY   -> Spring YYYY+1
    """
    m = SEM_RE.match((first_semester or "").strip())
    if not m:
        return "Summer 2026"
    term = m.group(1).capitalize()
    year = int(m.group(2))
    if term == "Spring":
        return f"Summer {year}"
    if term == "Summer":
        return f"Fall {year}"
    return f"Spring {year + 1}"


def _prereq_courses(parsed: dict) -> set[str]:
    return set(prereq_course_codes(parsed))


def _course_level(candidate: dict) -> int | None:
    level = candidate.get("course_level")
    if isinstance(level, int):
        return level
    if isinstance(level, float) and pd.notna(level):
        return int(level)
    return None


def _course_department_prefix(course_code: str) -> str:
    raw = str(course_code or "").strip().upper()
    if not raw:
        return ""
    if " " in raw:
        return raw.split(" ", 1)[0].strip()
    m = re.match(r"^[A-Z]+", raw)
    return m.group(0) if m else raw


def _soft_prereq_demote_penalty(candidate: dict) -> int:
    raw_tags = candidate.get("all_soft_tags", [])
    if isinstance(raw_tags, str):
        items = raw_tags.split(";")
    else:
        items = raw_tags or []
    tags = {
        str(tag).strip().lower()
        for tag in items
        if str(tag).strip()
    }
    return 1 if any(tag != _STANDING_SOFT_TAG for tag in tags) else 0



def _build_in_progress_note(
    recommendations: list[dict],
    assumes_in_progress_completion: bool,
) -> str | None:
    notes: list[str] = []
    if assumes_in_progress_completion:
        notes.append(
            "Recommendations for this semester assume your current in-progress courses "
            "are completed before the term starts."
        )
    if any("in progress" in (r.get("prereq_check") or "") for r in recommendations):
        notes.append(
            "Prerequisites satisfied via in-progress courses assume successful completion."
        )
    return " ".join(notes) if notes else None


def _build_bucket_role_map(data: dict, track_id: str) -> dict[str, str]:
    runtime_indexes = data.get("runtime_indexes", {})
    runtime_track = runtime_indexes.get("tracks", {}).get(str(track_id or "").strip().upper())
    if runtime_track is not None:
        return dict(runtime_track.get("bucket_role_map", {}))

    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns:
        return {}

    subset = buckets_df
    if "track_id" in buckets_df.columns:
        tid = str(track_id or "").strip().upper()
        subset = buckets_df[
            buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
        ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, str] = {}
    role_series = subset.get("role", pd.Series(index=subset.index, dtype=str))
    for idx, raw_bucket_id in subset["bucket_id"].items():
        bid = str(raw_bucket_id or "").strip()
        if not bid:
            continue
        out[bid] = str(role_series.loc[idx] or "").strip().lower()
    return out


def _standing_recovery_priority(
    candidate: dict,
    bucket_role_map: dict[str, str],
    bucket_parent_map: dict[str, str],
    parent_type_map: dict[str, str],
) -> int:
    fills = [str(bid or "").strip() for bid in (candidate.get("fills_buckets") or []) if str(bid or "").strip()]
    if any(bucket_role_map.get(bid, "") == "elective" for bid in fills):
        return 0
    if any(parent_type_map.get(bucket_parent_map.get(bid, ""), "") in {"major", "track"} for bid in fills):
        return 1
    return 2


def _build_standing_recovery_candidates(
    completed: list[str],
    in_progress: list[str],
    term: str,
    data: dict,
    alloc: dict,
    track_id: str,
    reverse_map: dict,
    current_standing: int,
    is_summer_sem: bool,
    bucket_role_map: dict[str, str],
    bucket_parent_map: dict[str, str],
    parent_type_map: dict[str, str],
    blocked_targets: list[str],
    selected_program_ids: list[str] | None = None,
    is_honors_student: bool = False,
    student_stage: str | None = None,
) -> list[dict]:
    filler_candidates = get_eligible_courses(
        data["courses_df"],
        completed,
        in_progress,
        term,
        data["prereq_map"],
        alloc["remaining"],
        data["course_bucket_map_df"],
        data["buckets_df"],
        data["equivalencies_df"],
        track_id=track_id,
        reverse_map=reverse_map,
        runtime_indexes=data.get("runtime_indexes"),
        selected_program_ids=selected_program_ids,
        restrict_to_unmet_buckets=False,
        is_honors_student=is_honors_student,
        equiv_map=data.get("equiv_prereq_map"),
        cross_listed_map=data.get("cross_listed_map"),
        current_standing=current_standing,
        student_stage=student_stage,
    )
    filler_candidates = [
        c for c in filler_candidates
        if not c.get("manual_review")
        and (c.get("min_standing") or 0) <= current_standing
    ]
    if is_summer_sem:
        filler_candidates = [c for c in filler_candidates if not c.get("low_confidence", False)]

    marked: list[dict] = []
    for candidate in filler_candidates:
        tagged = dict(candidate)
        tagged["is_standing_recovery_filler"] = True
        tagged["standing_blocked_targets"] = list(blocked_targets)
        marked.append(tagged)

    marked.sort(
        key=lambda c: (
            _standing_recovery_priority(c, bucket_role_map, bucket_parent_map, parent_type_map),
            0 if not c.get("low_confidence", False) else 1,
            _course_level(c) if _course_level(c) is not None else 9999,
            c["course_code"],
        )
    )
    return marked


def _local_bucket_id(bucket_id: str) -> str:
    raw = str(bucket_id or "").strip()
    if "::" in raw:
        return raw.split("::", 1)[1]
    return raw


def _current_unmet_bucket_ids(candidate: dict, allocator_remaining: dict) -> list[str]:
    unmet: list[str] = []
    for bucket_id in _selection_bucket_ids(candidate):
        slots_raw = pd.to_numeric(
            (allocator_remaining or {}).get(bucket_id, {}).get("slots_remaining", 0),
            errors="coerce",
        )
        slots_remaining = int(slots_raw) if pd.notna(slots_raw) else 0
        if slots_remaining > 0 and bucket_id not in unmet:
            unmet.append(bucket_id)
    return unmet


def _is_discovery_bucket(bucket_id: str, bucket_parent_map: dict[str, str]) -> bool:
    bid = str(bucket_id or "").strip().upper()
    if not bid:
        return False
    local_id = _local_bucket_id(bid).upper()
    if local_id.startswith(_DISC_FAMILY_PREFIX):
        return True
    return str(bucket_parent_map.get(bid, "") or "").strip().upper().startswith(_DISC_FAMILY_PREFIX)


def _is_discovery_driven(
    candidate: dict,
    allocator_remaining: dict,
    bucket_parent_map: dict[str, str],
) -> bool:
    unmet_bucket_ids = _current_unmet_bucket_ids(candidate, allocator_remaining)
    if not unmet_bucket_ids:
        return False
    return all(_is_discovery_bucket(bucket_id, bucket_parent_map) for bucket_id in unmet_bucket_ids)


def _open_foundation_slots(allocator_remaining: dict) -> int:
    total = 0
    for bucket_id, remaining in (allocator_remaining or {}).items():
        local_id = _local_bucket_id(bucket_id).upper()
        if local_id not in _DISCOVERY_FOUNDATION_BUCKET_IDS:
            continue
        slots_raw = pd.to_numeric((remaining or {}).get("slots_remaining", 0), errors="coerce")
        slots_remaining = int(slots_raw) if pd.notna(slots_raw) else 0
        if slots_remaining > 0:
            total += slots_remaining
    return total


def _build_declared_dept_set(
    data: dict,
    track_id: str,
    bucket_parent_map: dict[str, str],
    parent_type_map: dict[str, str],
) -> set[str]:
    course_bucket_map_df = data.get("course_bucket_map_df")
    if course_bucket_map_df is None or len(course_bucket_map_df) == 0:
        return set()
    if not {"bucket_id", "course_code"}.issubset(course_bucket_map_df.columns):
        return set()

    subset = course_bucket_map_df
    if "track_id" in course_bucket_map_df.columns:
        tid = str(track_id or "").strip().upper()
        subset = course_bucket_map_df[
            course_bucket_map_df["track_id"].astype(str).str.strip().str.upper() == tid
        ].copy()
    if len(subset) == 0:
        return set()

    declared_depts: set[str] = set()
    for _, row in subset.iterrows():
        bucket_id = str(row.get("bucket_id", "") or "").strip().upper()
        if not bucket_id:
            continue
        parent_id = str(bucket_parent_map.get(bucket_id, "") or "").strip().upper()
        if not parent_id or parent_id.startswith(_DISC_FAMILY_PREFIX):
            continue
        if parent_type_map.get(parent_id, "") not in {"major", "track"}:
            continue
        dept = _course_department_prefix(row.get("course_code", ""))
        if dept:
            declared_depts.add(dept)
    return declared_depts


def _discovery_affinity_penalty(course_code: str, declared_dept_set: set[str]) -> int:
    dept = _course_department_prefix(course_code)
    if not dept:
        return 2
    if dept in declared_dept_set or dept in _BUSINESS_DEPTS:
        return 0
    if dept in _NEUTRAL_DISCOVERY_DEPTS:
        return 1
    return 2




def _build_selection_bucket_meta(data: dict, track_id: str) -> dict[str, dict]:
    runtime_indexes = data.get("runtime_indexes", {})
    runtime_track = runtime_indexes.get("tracks", {}).get(str(track_id or "").strip().upper())
    if runtime_track is not None:
        return dict(runtime_track.get("selection_bucket_meta", {}))

    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns:
        return {}

    subset = buckets_df
    if "track_id" in buckets_df.columns:
        tid = str(track_id or "").strip().upper()
        subset = buckets_df[
            buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
        ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, dict] = {}
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        if not bid:
            continue
        p_raw = pd.to_numeric(row.get("priority", 99), errors="coerce")
        out[bid] = {
            "priority": int(p_raw) if pd.notna(p_raw) else 99,
            "parent_bucket_id": str(row.get("parent_bucket_id", "") or "").strip(),
            "requirement_mode": _infer_requirement_mode(row),
        }
    return out


def _selection_bucket_ids(candidate: dict) -> list[str]:
    raw = candidate.get("selection_buckets")
    if raw is None:
        raw = candidate.get("fills_buckets", [])
    return [str(b).strip() for b in (raw or []) if str(b).strip()]


def _is_bridge_candidate(candidate: dict) -> bool:
    return not _selection_bucket_ids(candidate) and bool(candidate.get("bridge_target_buckets"))


def _order_buckets_allocator_style(
    bucket_ids: list[str],
    bucket_meta: dict[str, dict],
) -> list[str]:
    unique = [str(b).strip() for b in bucket_ids if str(b).strip()]
    unique = list(dict.fromkeys(unique))
    unique.sort(key=lambda b: (bucket_meta.get(b, {}).get("priority", 99), b))
    if len(unique) <= 1:
        return unique

    parent_order: list[str] = []
    grouped: dict[str, dict[str, list[str]]] = {}
    for bid in unique:
        meta = bucket_meta.get(bid, {})
        parent = str(meta.get("parent_bucket_id", "") or "").strip()
        if parent not in grouped:
            grouped[parent] = {
                "required": [],
                "choose_n": [],
                "credits_pool": [],
                "other": [],
            }
            parent_order.append(parent)
        mode = str(meta.get("requirement_mode", "") or "").strip().lower()
        if mode == "required":
            grouped[parent]["required"].append(bid)
        elif mode == "choose_n":
            grouped[parent]["choose_n"].append(bid)
        elif mode == "credits_pool":
            grouped[parent]["credits_pool"].append(bid)
        else:
            grouped[parent]["other"].append(bid)

    def _sort_group(bucket_ids_: list[str]) -> list[str]:
        return sorted(
            bucket_ids_,
            key=lambda b: (bucket_meta.get(b, {}).get("priority", 99), b),
        )

    ordered: list[str] = []
    for parent in parent_order:
        ordered.extend(_sort_group(grouped[parent]["required"]))
        ordered.extend(_sort_group(grouped[parent]["choose_n"]))
        ordered.extend(_sort_group(grouped[parent]["credits_pool"]))
        ordered.extend(_sort_group(grouped[parent]["other"]))
    return ordered


def _select_assignable_buckets_allocator_style(
    candidate_bucket_ids: list[str],
    virtual_remaining: dict[str, int],
    picks_per_bucket: dict[str, int],
    enforce_bucket_cap: bool,
    max_per_bucket: int,
    allowed_pairs: set[frozenset[str]],
    bucket_meta: dict[str, dict],
) -> list[str]:
    ordered = _order_buckets_allocator_style(candidate_bucket_ids, bucket_meta)
    assigned: list[str] = []
    for bid in ordered:
        if virtual_remaining.get(bid, 0) <= 0:
            continue
        if not assigned:
            assigned.append(bid)
            continue
        pairwise_ok = all(
            frozenset([existing, bid]) in allowed_pairs
            for existing in assigned
        )
        if pairwise_ok:
            assigned.append(bid)
    return assigned


def _bucket_virtual_consumption_units(bucket_id: str, candidate: dict, bucket_meta: dict[str, dict]) -> int:
    mode = str(bucket_meta.get(bucket_id, {}).get("requirement_mode", "") or "").strip().lower()
    if mode == "credits_pool":
        return max(1, int(candidate.get("credits", 0) or 0))
    return 1


def _build_parent_type_map(data: dict) -> dict[str, str]:
    """
    Build parent bucket id -> type map from parent_buckets_df when available.
    """
    runtime_indexes = data.get("runtime_indexes", {})
    cached = runtime_indexes.get("parent_type_map")
    if cached is not None:
        return dict(cached)

    parent_buckets_df = data.get("parent_buckets_df")
    if parent_buckets_df is None or len(parent_buckets_df) == 0:
        return {}
    if "parent_bucket_id" not in parent_buckets_df.columns:
        return {}
    out: dict[str, str] = {}
    for _, row in parent_buckets_df.iterrows():
        pid = str(row.get("parent_bucket_id", "") or "").strip().upper()
        ptype = str(row.get("type", "") or "").strip().lower()
        if pid and ptype:
            out[pid] = ptype
    return out


def _build_bucket_track_required_map(data: dict, track_id: str) -> dict[str, str]:
    """
    Build runtime bucket_id -> track_required map for the current runtime track.
    """
    runtime_indexes = data.get("runtime_indexes", {})
    runtime_track = runtime_indexes.get("tracks", {}).get(str(track_id or "").strip().upper())
    if runtime_track is not None:
        return dict(runtime_track.get("bucket_track_required_map", {}))

    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns or "track_id" not in buckets_df.columns:
        return {}

    tid = str(track_id or "").strip().upper()
    subset = buckets_df[
        buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
    ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, str] = {}
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        track_req = str(row.get("track_required", "") or "").strip().upper()
        if bid:
            out[bid] = track_req
    return out


def _build_bucket_parent_map(data: dict, track_id: str) -> dict[str, str]:
    """Build runtime bucket_id -> parent_bucket_id map for the current runtime track."""
    runtime_indexes = data.get("runtime_indexes", {})
    runtime_track = runtime_indexes.get("tracks", {}).get(str(track_id or "").strip().upper())
    if runtime_track is not None:
        return dict(runtime_track.get("bucket_parent_map", {}))

    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns or "track_id" not in buckets_df.columns:
        return {}

    tid = str(track_id or "").strip().upper()
    subset = buckets_df[
        buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
    ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, str] = {}
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip().upper()
        pid = str(row.get("parent_bucket_id", "") or "").strip().upper()
        if bid:
            out[bid] = pid
    return out


def _tier_for_bucket_v2(
    bucket_id: str,
    *,
    primary_bucket: str,
    primary_parent_id: str,
    parent_type_map: dict[str, str],
    bucket_track_required_map: dict[str, str],
    bucket_parent_map: dict[str, str],
) -> int:
    local_id = _local_bucket_id(bucket_id).upper()
    parent_id = bucket_parent_map.get(bucket_id, "")
    if not parent_id and bucket_id == primary_bucket:
        parent_id = primary_parent_id
    parent_id = str(parent_id or "").strip().upper()
    parent_type = parent_type_map.get(parent_id, "")
    track_required = bucket_track_required_map.get(bucket_id, "")

    # Tier 1 - MCC foundation work should be filled before business-core backfill.
    if local_id in _MCC_FOUNDATION_BUCKET_IDS or parent_id == "MCC_FOUNDATION":
        return 1

    # Tier 2 - all BCC work, with BCC_REQUIRED first inside the tier.
    if local_id.startswith(_BCC_PREFIX) or bucket_id.startswith("BCC::") or parent_id.startswith("BCC"):
        return 2

    # Tier 3 - declared major requirements.
    if parent_type == "major":
        return 3

    # Discovery and culminating buckets stay below explicit major/track work.
    if (
        local_id in _MCC_LOWEST_BUCKET_IDS
        or parent_id in _MCC_LOWEST_BUCKET_IDS
        or local_id.startswith(_DISC_FAMILY_PREFIX)
        or parent_id.startswith(_DISC_FAMILY_PREFIX)
    ):
        return 6

    # Tier 4 - track and minor requirements.
    if parent_type in {"track", "minor"} or track_required:
        return 4

    # Tier 5 - later MCC buckets that still matter before discovery/culm.
    if local_id in _MCC_LATE_BUCKET_IDS or parent_id in _MCC_LATE_BUCKET_IDS:
        return 5

    # Unknown non-core buckets stay at the bottom.
    if local_id or parent_id:
        return 6

    return 7


def _is_math_candidate(candidate: dict) -> bool:
    course_code = str(candidate.get("course_code", "") or "").strip().upper()
    return course_code.startswith(f"{_MATH_SUBJECT_PREFIX} ")


def _is_priority_core_bridge_candidate(candidate: dict) -> bool:
    if not candidate.get("is_bridge_course"):
        return False
    level = _course_level(candidate)
    if level is not None and level >= 2000:
        return False
    raw_soft_tags = candidate.get("all_soft_tags") or candidate.get("soft_tags") or []
    if isinstance(raw_soft_tags, str):
        raw_soft_tags = raw_soft_tags.split(";")
    soft_tags = {
        str(tag or "").strip().lower()
        for tag in raw_soft_tags
        if str(tag or "").strip()
    }
    if "standing_requirement" not in soft_tags:
        return False
    target_bucket_ids = [
        str(bucket_id or "").strip().upper()
        for bucket_id in (
            list(candidate.get("bridge_target_buckets", []) or [])
            + [candidate.get("primary_bucket", "")]
        )
        if str(bucket_id or "").strip()
    ]
    return any(
        (
            (_local_bucket_id(bucket_id).upper() == "BCC_REQUIRED")
            or _local_bucket_id(bucket_id).upper().startswith("MCC_CORE")
            or _local_bucket_id(bucket_id).upper().startswith("MCC_ESSV1")
        )
        for bucket_id in target_bucket_ids
    )


def _bcc_priority_rank(candidate: dict, bucket_parent_map: dict[str, str]) -> int:
    bucket_ids = [
        str(bid or "").strip().upper()
        for bid in (candidate.get("fills_buckets") or [])
        if str(bid or "").strip()
    ]
    primary_bucket = str(candidate.get("primary_bucket", "") or "").strip().upper()
    if not bucket_ids and primary_bucket:
        bucket_ids = [primary_bucket]

    has_bcc = False
    has_bcc_required = False
    for bucket_id in bucket_ids:
        local_id = _local_bucket_id(bucket_id).upper()
        parent_id = str(bucket_parent_map.get(bucket_id, "") or "").strip().upper()
        if local_id == "BCC_REQUIRED":
            has_bcc_required = True
        if local_id.startswith(_BCC_PREFIX) or bucket_id.startswith("BCC::") or parent_id.startswith("BCC"):
            has_bcc = True
    if has_bcc_required:
        return 0 if _is_math_candidate(candidate) else 1
    return 2 if has_bcc else 3


def _ranking_band(candidate: dict, bucket_parent_map: dict[str, str]) -> int:
    """
    Actual selection order is slightly stricter than the semantic tier labels.

    We still expose tier metadata as:
      1) MCC foundation
      2) BCC
      3) major
      4) track/minor
      5) late MCC
      6) discovery/culm

    But direct BCC_REQUIRED work and its critical math/bridge unlockers should
    surface ahead of other foundation work so freshmen do not drift math and
    business-core prerequisites too far to the right.
    """
    if _is_priority_core_bridge_candidate(candidate):
        return 0

    bcc_rank = _bcc_priority_rank(candidate, bucket_parent_map)
    if bcc_rank <= 1:
        return 1

    tier = int(candidate.get("ranking_tier", 99) or 99)
    if tier == 1:
        return 2
    if tier == 2:
        return 3
    if tier == 3:
        return 4
    if tier == 4:
        return 5
    if tier == 5:
        return 6
    if tier == 6:
        return 7
    return 8


def _is_critical_bridge_candidate(candidate: dict, bucket_parent_map: dict[str, str]) -> bool:
    if not candidate.get("is_bridge_course"):
        return False

    target_bucket_ids = [
        str(bucket_id or "").strip().upper()
        for bucket_id in (
            list(candidate.get("bridge_target_buckets", []) or [])
            + [candidate.get("primary_bucket", "")]
        )
        if str(bucket_id or "").strip()
    ]
    for bucket_id in target_bucket_ids:
        local_id = _local_bucket_id(bucket_id).upper()
        parent_id = str(bucket_parent_map.get(bucket_id, "") or "").strip().upper()
        if local_id == "BCC_REQUIRED":
            return True
        if local_id in _MCC_FOUNDATION_BUCKET_IDS or parent_id == "MCC_FOUNDATION":
            return True
    return False


def _bridge_sort_penalty(candidate: dict, bucket_parent_map: dict[str, str]) -> int:
    if not candidate.get("is_bridge_course"):
        return 0
    return 0 if _is_critical_bridge_candidate(candidate, bucket_parent_map) else 1

def _bucket_hierarchy_tier_v2(
    candidate: dict,
    parent_type_map: dict[str, str],
    bucket_track_required_map: dict[str, str],
    bucket_parent_map: dict[str, str],
) -> int:
    """
    Priority tiers:
      1) MCC foundation
      2) BCC
      3) major parent buckets
      4) track/minor parent buckets
      5) MCC_ESSV2 + MCC_WRIT
      6) discovery + culminating buckets

    Unlockers remain an in-tier tie-break in the ranking key.
    """
    primary_bucket = str(candidate.get("primary_bucket", "") or "").strip().upper()
    primary_parent_id = str(candidate.get("primary_parent_bucket_id", "") or "").strip().upper()
    fills = [
        str(bid or "").strip().upper()
        for bid in (candidate.get("fills_buckets") or [])
        if str(bid or "").strip()
    ]
    bucket_ids = fills if fills else ([primary_bucket] if primary_bucket else [])
    if not bucket_ids:
        return 7

    return min(
        _tier_for_bucket_v2(
            bid,
            primary_bucket=primary_bucket,
            primary_parent_id=primary_parent_id,
            parent_type_map=parent_type_map,
            bucket_track_required_map=bucket_track_required_map,
            bucket_parent_map=bucket_parent_map,
        )
        for bid in bucket_ids
    )



def _compute_satisfied(applied: dict, assumed_done_credits: int) -> bool:
    """Bucket is satisfied when either its course-count OR its credit
    threshold is met (whichever comes first).  Covers buckets that
    define both requirements."""
    needed_count = applied.get("needed_count")
    needed_credits = applied.get("needed") or 0

    if needed_count is not None and needed_count > 0:
        total_courses = (
            len(applied.get("completed_applied", []))
            + len(applied.get("in_progress_applied", []))
        )
        if total_courses >= needed_count:
            return True

    if needed_credits > 0:
        return assumed_done_credits >= needed_credits

    # No count or credit threshold defined -> vacuously satisfied
    if needed_count is None and needed_credits <= 0:
        return True

    return False


def build_progress_output(allocation: dict, course_bucket_map_df: pd.DataFrame) -> dict:
    progress = {}
    for bid, applied in allocation["applied_by_bucket"].items():
        remaining = allocation["remaining"].get(bid, {})
        completed_done = get_applied_bucket_progress_units(applied)
        assumed_done = get_applied_bucket_progress_units(applied, include_in_progress=True)
        in_progress_increment = max(0, assumed_done - completed_done)
        progress[bid] = {
            "label": applied.get("label", bid),
            "needed": applied.get("needed"),
            "completed_applied": applied["completed_applied"],
            "in_progress_applied": applied["in_progress_applied"],
            "completed_done": completed_done,
            "done_count": completed_done,
            "in_progress_increment": in_progress_increment,
            "satisfied": _compute_satisfied(applied, assumed_done),
            "remaining_courses": remaining.get("remaining_courses", []),
            "slots_remaining": remaining.get("slots_remaining", 0),
            "requirement_mode": applied.get("requirement_mode", "required"),
            "needed_count": applied.get("needed_count"),
            "completed_courses": len(applied.get("completed_applied", [])),
            "in_progress_courses": len(applied.get("in_progress_applied", [])),
        }
    return progress


def annotate_progress_with_recommendation_hierarchy(
    progress: dict,
    data: dict,
    track_id: str,
    *,
    parent_type_map: dict[str, str] | None = None,
    bucket_track_required_map: dict[str, str] | None = None,
    bucket_parent_map: dict[str, str] | None = None,
) -> dict:
    if not progress:
        return progress

    if parent_type_map is None:
        parent_type_map = _build_parent_type_map(data)
    if bucket_track_required_map is None:
        bucket_track_required_map = _build_bucket_track_required_map(data, track_id)
    if bucket_parent_map is None:
        bucket_parent_map = _build_bucket_parent_map(data, track_id)

    annotated: dict = {}
    for bid, info in progress.items():
        parent_id = bucket_parent_map.get(str(bid), "")
        annotated_info = dict(info)
        annotated_info["recommendation_tier"] = _bucket_hierarchy_tier_v2(
            {
                "primary_bucket": bid,
                "primary_parent_bucket_id": parent_id,
                "fills_buckets": [bid],
            },
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
        )
        annotated[bid] = annotated_info
    return annotated


def _dedupe_codes(codes: list[str]) -> list[str]:
    """Return codes in first-seen order without duplicates."""
    return list(dict.fromkeys([c for c in codes if c]))


def _build_projected_outputs(
    completed: list[str],
    in_progress: list[str],
    selected_codes: list[str],
    data: dict,
    track_id: str,
    *,
    prebuilt_alloc: dict | None = None,
    parent_type_map: dict[str, str] | None = None,
    bucket_track_required_map: dict[str, str] | None = None,
    bucket_parent_map: dict[str, str] | None = None,
) -> dict:
    # Progress view keeps planned semester courses as in-progress (yellow segment).
    projected_completed_for_progress = _dedupe_codes(completed)
    projected_in_progress_for_progress = _dedupe_codes(in_progress + selected_codes)
    if prebuilt_alloc is not None and not selected_codes:
        projected_alloc_for_progress = prebuilt_alloc
    else:
        projected_alloc_for_progress = allocate_courses(
            projected_completed_for_progress,
            projected_in_progress_for_progress,
            data["buckets_df"],
            data["course_bucket_map_df"],
            data["courses_df"],
            data["equivalencies_df"],
            track_id=track_id,
            double_count_policy_df=data.get("v2_double_count_policy_df"),
            runtime_indexes=data.get("runtime_indexes"),
        )
    projected_progress = build_progress_output(
        projected_alloc_for_progress,
        data["course_bucket_map_df"],
    )
    return annotate_progress_with_recommendation_hierarchy(
        projected_progress,
        data,
        track_id,
        parent_type_map=parent_type_map,
        bucket_track_required_map=bucket_track_required_map,
        bucket_parent_map=bucket_parent_map,
    )


def _response_bucket_ids(candidate: dict) -> list[str]:
    preferred = (
        candidate.get("assigned_buckets")
        or candidate.get("current_unmet_buckets")
        or candidate.get("fills_buckets", [])
    )
    return [str(bucket_id).strip() for bucket_id in dict.fromkeys(preferred or []) if str(bucket_id).strip()]


def _build_deterministic_recommendations(candidates: list[dict], max_recommendations: int) -> list[dict]:
    """Build recommendation output from pre-ranked candidates. No LLM call."""
    target_count = min(max_recommendations, len(candidates))
    recs = []
    for cand in candidates[:target_count]:
        buckets = _response_bucket_ids(cand)
        blocked_targets = cand.get("standing_blocked_targets", [])
        if cand.get("is_standing_recovery_filler"):
            if blocked_targets:
                why = (
                    "This course helps you build credits toward the standing needed "
                    f"to unlock remaining required course(s) like {', '.join(blocked_targets[:2])}."
                )
            else:
                why = (
                    "This course helps you build credits toward the standing needed "
                    "to keep progressing in your declared degree path."
                )
        elif buckets and not _is_bridge_candidate(cand):
            why = (
                "This course advances your declared degree path and "
                f"counts toward {len(buckets)} unmet requirement bucket(s)."
            )
        elif cand.get("bridge_target_buckets"):
            why = (
                "This course unlocks remaining required courses in your plan "
                "that are currently blocked by prerequisites."
            )
        else:
            why = (
                "This course advances your declared degree path based on "
                "prerequisite order and remaining requirements."
            )
        rec = {
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "credits": cand.get("credits", 3),
            "why": why,
            "tier": cand.get("tier"),
            "prereq_check": cand.get("prereq_check", ""),
            "min_standing": cand.get("min_standing"),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": buckets,
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "warning_text": cand.get("warning_text"),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        }
        recs.append(rec)
    return recs


def _build_debug_trace(
    ranked: list[dict],
    selected_codes: set[str],
    skipped_reasons: dict[str, str],
    parent_type_map: dict,
    bucket_track_required_map: dict,
    bucket_parent_map: dict,
    core_prereq_blockers: set[str],
    reverse_map: dict,
    chain_depths: dict[str, int],
    virtual_remaining_snapshot: dict[str, int],
    debug_limit: int = 30,
) -> list[dict]:
    """Build human-readable debug trace for each ranked candidate."""
    trace = []
    for rank, c in enumerate(ranked[:debug_limit], start=1):
        code = c["course_code"]
        tier = _bucket_hierarchy_tier_v2(
            c, parent_type_map, bucket_track_required_map, bucket_parent_map,
        )
        fills = c.get("fills_buckets", [])
        selection_buckets = _selection_bucket_ids(c)
        bucket_capacity = {
            bid: virtual_remaining_snapshot.get(bid, 0) for bid in selection_buckets
        }
        trace.append({
            "rank": rank,
            "course_code": code,
            "course_name": c.get("course_name", ""),
            "selected": code in selected_codes,
            "skip_reason": skipped_reasons.get(code),
            "tier": tier,
            "is_discovery_driven": bool(c.get("is_discovery_driven")),
            "discovery_foundation_penalty": c.get("discovery_foundation_penalty", 0),
            "discovery_affinity_penalty": c.get("discovery_affinity_penalty", 0),
            "soft_prereq_penalty": c.get("soft_prereq_penalty", 0),
            "current_unmet_buckets": c.get("current_unmet_buckets", []),
            "is_core_prereq_blocker": code in core_prereq_blockers,
            "is_bridge_course": bool(c.get("is_bridge_course")),
            "course_level": _course_level(c),
            "chain_depth": chain_depths.get(code, 0),
            "multi_bucket_score": c.get("multi_bucket_score", 0),
            "fills_buckets": fills,
            "selection_buckets": selection_buckets,
            "bridge_target_buckets": c.get("bridge_target_buckets", []),
            "bucket_capacity": bucket_capacity,
        })
    return trace


def _course_codes_for_local_bucket(
    course_bucket_map_df: pd.DataFrame,
    track_id: str,
    local_bucket_id: str,
) -> set[str]:
    if course_bucket_map_df is None or len(course_bucket_map_df) == 0:
        return set()
    if not {"bucket_id", "course_code"}.issubset(course_bucket_map_df.columns):
        return set()

    subset = course_bucket_map_df
    if "track_id" in course_bucket_map_df.columns:
        tid = str(track_id or "").strip().upper()
        subset = course_bucket_map_df[
            course_bucket_map_df["track_id"].astype(str).str.strip().str.upper() == tid
        ].copy()
    if len(subset) == 0:
        return set()

    target_local_id = str(local_bucket_id or "").strip().upper()
    codes: set[str] = set()
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        if _local_bucket_id(bid).upper() != target_local_id:
            continue
        code = str(row.get("course_code", "") or "").strip().upper()
        if code:
            codes.add(code)
    return codes


def _candidate_advances_declared_or_bcc_requirement(
    candidate: dict,
    bucket_parent_map: dict[str, str],
    parent_type_map: dict[str, str],
) -> bool:
    bucket_ids = list(candidate.get("fills_buckets", []) or []) + list(
        candidate.get("bridge_target_buckets", []) or []
    )
    for raw_bucket_id in bucket_ids:
        bid = str(raw_bucket_id or "").strip().upper()
        if not bid:
            continue
        local_id = _local_bucket_id(bid).upper()
        if local_id.startswith(_BCC_PREFIX):
            return True
        parent = bucket_parent_map.get(bid, "")
        if (
            parent_type_map.get(parent, "") in {"major", "track", "minor"}
            and not str(parent or "").strip().upper().startswith(_DISC_FAMILY_PREFIX)
        ):
            return True
    return False


def run_recommendation_semester(
    completed: list[str],
    in_progress: list[str],
    target_semester_label: str,
    data: dict,
    max_recs: int,
    reverse_map: dict,
    track_id: str = DEFAULT_TRACK_ID,
    debug: bool = False,
    debug_limit: int = 30,
    current_standing: int = 1,
    completed_only_standing: int | None = None,
    assumes_in_progress_completion: bool = False,
    chain_depths: dict[str, int] | None = None,
    is_honors_student: bool = False,
    selected_program_ids: list[str] | None = None,
    student_stage: str | None = None,
) -> dict:
    """Run the full recommendation pipeline for a single semester."""
    if completed_only_standing is None:
        completed_only_standing = current_standing

    selection_program_ids = list(
        selected_program_ids
        or data.get("selected_program_ids", [])
        or data.get("restriction_program_ids", [])
    )

    term = parse_term(target_semester_label)
    alloc = allocate_courses(
        completed,
        in_progress,
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
        runtime_indexes=data.get("runtime_indexes"),
    )

    eligible_sem = get_eligible_courses(
        data["courses_df"],
        completed,
        in_progress,
        term,
        data["prereq_map"],
        alloc["remaining"],
        data["course_bucket_map_df"],
        data["buckets_df"],
        data["equivalencies_df"],
        track_id=track_id,
        reverse_map=reverse_map,
        runtime_indexes=data.get("runtime_indexes"),
        selected_program_ids=selection_program_ids,
        is_honors_student=is_honors_student,
        equiv_map=data.get("equiv_prereq_map"),
        cross_listed_map=data.get("cross_listed_map"),
        current_standing=current_standing,
        student_stage=student_stage,
    )

    def _passes_standing_gate(candidate: dict) -> bool:
        min_standing = candidate.get("min_standing") or 0
        if min_standing <= current_standing:
            return True
        # Some foundational bridge courses carry noisy standing metadata in the
        # source workbook; keep them eligible and surface the standing warning.
        return _is_priority_core_bridge_candidate(candidate)

    standing_blocked_sem = [
        c for c in eligible_sem
        if not c.get("manual_review")
        and not _passes_standing_gate(c)
    ]
    # Standing gate: exclude courses whose min_standing exceeds the student's current standing.
    eligible_sem = [
        c for c in eligible_sem
        if _passes_standing_gate(c)
    ]
    # Summer hard filter: only recommend courses offered in summer; cap recs at 4.
    is_summer_sem = "summer" in target_semester_label.lower()
    if is_summer_sem:
        eligible_sem = [c for c in eligible_sem if not c.get("low_confidence", False)]
        max_recs = min(max_recs, 4)
    manual_review_sem = [c["course_code"] for c in eligible_sem if c.get("manual_review")]
    non_manual_sem = [c for c in eligible_sem if not c.get("manual_review")]
    eligible_count_sem = len(non_manual_sem)

    # Build maps once and reuse throughout this request
    parent_type_map = _build_parent_type_map(data)
    bucket_track_required_map = _build_bucket_track_required_map(data, track_id)
    bucket_parent_map = _build_bucket_parent_map(data, track_id)
    bucket_role_map = _build_bucket_role_map(data, track_id)

    progress_sem = annotate_progress_with_recommendation_hierarchy(
        build_progress_output(alloc, data["course_bucket_map_df"]),
        data,
        track_id,
        parent_type_map=parent_type_map,
        bucket_track_required_map=bucket_track_required_map,
        bucket_parent_map=bucket_parent_map,
    )
    unsatisfied_bucket_ids = [
        bid for bid, info in progress_sem.items()
        if not info.get("satisfied", True)
    ]
    writ_course_codes = _course_codes_for_local_bucket(
        data.get("course_bucket_map_df"),
        track_id,
        "MCC_WRIT",
    )
    historical_writ_courses = {
        str(code or "").strip().upper()
        for code in (completed + in_progress)
        if str(code or "").strip().upper() in writ_course_codes
    }

    def _candidate_is_writ_tagged(candidate: dict) -> bool:
        code = str(candidate.get("course_code", "") or "").strip().upper()
        if code and code in writ_course_codes:
            return True
        return any(
            _local_bucket_id(bucket_id).upper() == "MCC_WRIT"
            for bucket_id in _selection_bucket_ids(candidate)
        )

    def _blocked_by_writ_lifetime_limit(
        candidate: dict,
        *,
        selected_writ_courses: set[str] | None = None,
    ) -> bool:
        if not _candidate_is_writ_tagged(candidate):
            return False
        if _candidate_advances_declared_or_bcc_requirement(
            candidate,
            bucket_parent_map,
            parent_type_map,
        ):
            return False
        if historical_writ_courses:
            return True
        return bool(selected_writ_courses)

    if not non_manual_sem:
        standing_recovery_sem: list[dict] = []
        if unsatisfied_bucket_ids and standing_blocked_sem:
            blocked_targets = _dedupe_codes([c["course_code"] for c in standing_blocked_sem])
            standing_recovery_sem = _build_standing_recovery_candidates(
                completed,
                in_progress,
                term,
                data,
                alloc,
                track_id,
                reverse_map,
                current_standing,
                is_summer_sem,
                bucket_role_map,
                bucket_parent_map,
                parent_type_map,
                blocked_targets,
                selected_program_ids=selection_program_ids,
                is_honors_student=is_honors_student,
                student_stage=student_stage,
            )
        standing_recovery_sem = [
            c for c in standing_recovery_sem
            if not _blocked_by_writ_lifetime_limit(c)
        ]
        if standing_recovery_sem:
            recommendations_sem = _build_deterministic_recommendations(
                standing_recovery_sem,
                max_recs,
            )
            selected_codes = [r["course_code"] for r in recommendations_sem if r.get("course_code")]
            projected_progress_sem = _build_projected_outputs(
                completed,
                in_progress,
                selected_codes,
                data,
                track_id,
                parent_type_map=parent_type_map,
                bucket_track_required_map=bucket_track_required_map,
                bucket_parent_map=bucket_parent_map,
            )
            return {
                "target_semester": target_semester_label,
                "standing": current_standing,
                "standing_label": _STANDING_LABELS[current_standing],
                "recommendations": recommendations_sem,
                "requested_recommendations": max_recs,
                "eligible_count": len(standing_recovery_sem),
                "input_completed_count": len(completed),
                "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
                "in_progress_note": _build_in_progress_note(
                    recommendations_sem,
                    assumes_in_progress_completion,
                ),
                "blocking_warnings": [],
                "progress": progress_sem,
                "manual_review_courses": manual_review_sem,
                "projected_progress": projected_progress_sem,
                "projection_note": _PROJECTION_NOTE,
            }
        projected_progress_sem = _build_projected_outputs(
            completed,
            in_progress,
            [],
            data,
            track_id,
            prebuilt_alloc=alloc,
            parent_type_map=parent_type_map,
            bucket_track_required_map=bucket_track_required_map,
            bucket_parent_map=bucket_parent_map,
        )
        return {
            "target_semester": target_semester_label,
            "standing": current_standing,
            "standing_label": _STANDING_LABELS[current_standing],
            "recommendations": [],
            "requested_recommendations": max_recs,
            "eligible_count": 0,
            "input_completed_count": len(completed),
            "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
            "in_progress_note": _build_in_progress_note(
                [],
                assumes_in_progress_completion,
            ),
            "blocking_warnings": [],
            "progress": progress_sem,
            "manual_review_courses": manual_review_sem,
            "projected_progress": projected_progress_sem,
            "projection_note": _PROJECTION_NOTE,
        }

    # Build core_prereq_blockers: prereqs of remaining courses in unsatisfied
    # non-universal required/choose_n buckets.  These courses need to be
    # scheduled early so the courses they unlock can still fit in 8 semesters.
    core_remaining_sem: list[str] = []
    for bid, rem_info in alloc["remaining"].items():
        slots = rem_info.get("slots_remaining", 0)
        if slots <= 0:
            continue
        # Skip credit-pool buckets (electives don't create critical chains).
        if rem_info.get("is_credit_based"):
            continue
        # Skip universal (BCC/MCC) buckets.
        parent_id = bucket_parent_map.get(bid.upper(), "")
        if parent_type_map.get(parent_id) == "universal":
            continue
        core_remaining_sem.extend(rem_info.get("remaining_courses", []))
    # Deduplicate while preserving order for deterministic warnings.
    core_remaining_sem = list(dict.fromkeys(core_remaining_sem))
    core_prereq_blockers_sem: set[str] = set()
    for core_code in core_remaining_sem:
        core_prereq_blockers_sem |= _prereq_courses(data["prereq_map"].get(core_code, {"type": "none"}))
    _chain = chain_depths or {}
    foundation_slots_open_sem = _open_foundation_slots(alloc["remaining"])
    declared_dept_set = _build_declared_dept_set(
        data,
        track_id,
        bucket_parent_map,
        parent_type_map,
    )
    scored_non_manual_sem: list[dict] = []
    for cand in non_manual_sem:
        if _blocked_by_writ_lifetime_limit(cand):
            continue
        tagged = dict(cand)
        tagged["ranking_tier"] = _bucket_hierarchy_tier_v2(
            tagged,
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
        )
        current_unmet_buckets = _current_unmet_bucket_ids(tagged, alloc["remaining"])
        is_discovery_driven = _is_discovery_driven(
            tagged,
            alloc["remaining"],
            bucket_parent_map,
        )
        tagged["current_unmet_buckets"] = current_unmet_buckets
        tagged["is_core_prereq_blocker"] = tagged["course_code"] in core_prereq_blockers_sem
        tagged["is_discovery_driven"] = is_discovery_driven
        tagged["soft_prereq_penalty"] = _soft_prereq_demote_penalty(tagged)
        if is_discovery_driven:
            tagged["discovery_foundation_penalty"] = foundation_slots_open_sem
            tagged["discovery_affinity_penalty"] = _discovery_affinity_penalty(
                tagged.get("course_code", ""),
                declared_dept_set,
            )
        else:
            tagged["discovery_foundation_penalty"] = 0
            tagged["discovery_affinity_penalty"] = 0
        scored_non_manual_sem.append(tagged)
    ranked_sem = sorted(
        scored_non_manual_sem,
        key=lambda c: (
            _ranking_band(c, bucket_parent_map),
            c.get("ranking_tier", 99),
            _bcc_priority_rank(c, bucket_parent_map),
            _bridge_sort_penalty(c, bucket_parent_map),
            -_chain.get(c["course_code"], 0),
            -c.get("multi_bucket_score", 0),
            # Honors students: prefer H variants (sort before base course).
            0 if is_honors_student and re.search(r"\d+H$", c["course_code"]) else 1 if is_honors_student else 0,
            _course_level(c) if _course_level(c) is not None else 9999,
            c["course_code"],
        ),
    )
    eligible_count_sem = len(ranked_sem)
    # ---------- Selection setup ----------
    selected_sem = []
    _equiv_map = data.get("equiv_prereq_map") or {}
    _cross_map = data.get("cross_listed_map") or {}

    def _expand_with_equivalents(codes: set[str]) -> set[str]:
        """Expand a code set to include all equivalent and cross-listed aliases."""
        expanded = set(codes)
        for c in codes:
            expanded.update(_equiv_map.get(c, set()))
            expanded.update(_cross_map.get(c, set()))
        return expanded

    selection_bucket_meta = _build_selection_bucket_meta(data, track_id)
    allowed_pairs = get_allowed_double_count_pairs(
        data.get("buckets_df", pd.DataFrame()),
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )
    virtual_remaining = {
        bid: rem.get("slots_remaining", 0)
        for bid, rem in alloc["remaining"].items()
    }
    virtual_remaining_snapshot = dict(virtual_remaining) if debug else {}
    picks_per_bucket: dict[str, int] = {}
    bridge_targets_covered: set[str] = set()
    selected_writ_courses: set[str] = set()
    skipped_reasons: dict[str, str] = {}
    selected_codes_set: set[str] = set()

    def _assignable_buckets_for_candidate(candidate: dict, *, enforce_bucket_cap: bool) -> list[str]:
        return _select_assignable_buckets_allocator_style(
            _selection_bucket_ids(candidate),
            virtual_remaining,
            picks_per_bucket,
            enforce_bucket_cap=enforce_bucket_cap,
            max_per_bucket=_MAX_PER_BUCKET_PER_SEM,
            allowed_pairs=allowed_pairs,
            bucket_meta=selection_bucket_meta,
        )

    def _bridge_candidate_has_open_target(candidate: dict) -> bool:
        return any(
            b not in bridge_targets_covered and virtual_remaining.get(b, 0) > 0
            for b in candidate.get("bridge_target_buckets", [])
        )

    def _should_defer_bridge_for_direct_fill(candidate: dict) -> bool:
        return not _is_critical_bridge_candidate(candidate, bucket_parent_map)

    def _has_available_direct_fill_candidate(
        *,
        enforce_bucket_cap: bool,
        excluded_codes: set[str],
    ) -> bool:
        for candidate in ranked_sem:
            code = candidate.get("course_code")
            if code in excluded_codes:
                continue
            if _blocked_by_writ_lifetime_limit(
                candidate,
                selected_writ_courses=selected_writ_courses,
            ):
                continue
            if _is_bridge_candidate(candidate):
                continue
            if _missing_same_semester_prereqs(candidate):
                continue
            assigned = _assignable_buckets_for_candidate(
                candidate,
                enforce_bucket_cap=enforce_bucket_cap,
            )
            if not assigned:
                continue
            return True
        return False

    def _maturity_guard_blocks(
        candidate: dict,
        *,
        enforce_bucket_cap: bool,
        excluded_codes: set[str],
    ) -> bool:
        if current_standing > 1:
            return False
        if candidate.get("ranking_tier", 99) < 3:
            return False
        level = _course_level(candidate)
        if level is None or level < 3000:
            return False

        for other in ranked_sem:
            other_code = other.get("course_code")
            if other_code in excluded_codes:
                continue
            if other_code == candidate.get("course_code"):
                continue
            if _blocked_by_writ_lifetime_limit(
                other,
                selected_writ_courses=selected_writ_courses,
            ):
                continue
            other_level = _course_level(other)
            if other_level is None or other_level >= 3000:
                continue
            if _is_bridge_candidate(other):
                continue
            if _missing_same_semester_prereqs(other):
                continue
            assigned = _assignable_buckets_for_candidate(
                other,
                enforce_bucket_cap=enforce_bucket_cap,
            )
            if not assigned:
                continue
            return True
        return False

    def _accept_candidate(cand: dict, assigned_buckets: list[str]) -> None:
        """Bookkeeping when a candidate is accepted into selected_sem."""
        cand["assigned_buckets"] = list(dict.fromkeys(assigned_buckets))
        selected_sem.append(cand)
        if _candidate_is_writ_tagged(cand):
            code = str(cand.get("course_code", "") or "").strip().upper()
            if code:
                selected_writ_courses.add(code)
        if _is_bridge_candidate(cand):
            for b in cand.get("bridge_target_buckets", []):
                bridge_targets_covered.add(b)
        for bid in assigned_buckets:
            if virtual_remaining.get(bid, 0) > 0:
                consume = _bucket_virtual_consumption_units(
                    bid, cand, selection_bucket_meta,
                )
                virtual_remaining[bid] = max(0, virtual_remaining[bid] - consume)
                picks_per_bucket[bid] = picks_per_bucket.get(bid, 0) + 1

    def _missing_same_semester_prereqs(candidate: dict) -> list[str]:
        available_codes = set(completed) | set(in_progress) | {
            selected.get("course_code")
            for selected in selected_sem
            if selected.get("course_code")
        }
        return [
            code
            for code in candidate.get("same_semester_prereqs", []) or []
            if code not in available_codes
        ]

    # ---------- Main greedy pass ----------
    # Walk one ranked list, respecting prerequisites, real bucket capacity,
    # bridge ordering, and dedupe. No separate balance or quota layer.
    for cand in ranked_sem:
        if len(selected_sem) >= max_recs:
            if debug:
                skipped_reasons[cand["course_code"]] = "max_recs reached"
            break
        if cand["course_code"] in selected_codes_set:
            continue
        if _blocked_by_writ_lifetime_limit(
            cand,
            selected_writ_courses=selected_writ_courses,
        ):
            if debug:
                skipped_reasons[cand["course_code"]] = "WRIT lifetime limit"
            continue
        unresolved_same_sem = _missing_same_semester_prereqs(cand)
        if unresolved_same_sem:
            if debug:
                skipped_reasons[cand["course_code"]] = (
                    "waiting on same-semester concurrent course(s): "
                    + ", ".join(unresolved_same_sem)
                )
            continue
        if _maturity_guard_blocks(
            cand,
            enforce_bucket_cap=False,
            excluded_codes={c["course_code"] for c in selected_sem},
        ):
            if debug:
                skipped_reasons[cand["course_code"]] = "freshman maturity guard deferred advanced course"
            continue

        assigned_buckets = _assignable_buckets_for_candidate(
            cand,
            enforce_bucket_cap=False,
        )
        is_bridge_pick = _is_bridge_candidate(cand)
        if not assigned_buckets and not is_bridge_pick:
            if debug:
                skipped_reasons[cand["course_code"]] = "no assignable buckets (capacity full)"
            continue
        if (
            is_bridge_pick
            and _should_defer_bridge_for_direct_fill(cand)
            and _has_available_direct_fill_candidate(
                enforce_bucket_cap=False,
                excluded_codes={c["course_code"] for c in selected_sem} | {cand["course_code"]},
            )
        ):
            if debug:
                skipped_reasons[cand["course_code"]] = "bridge deferred while direct-fill options remain"
            continue
        if is_bridge_pick and not _bridge_candidate_has_open_target(cand):
            if debug:
                skipped_reasons[cand["course_code"]] = "bridge targets already covered"
            continue

        _accept_candidate(cand, assigned_buckets)
        selected_codes_set.update(_expand_with_equivalents({cand["course_code"]}))

    # ---------- Same-semester concurrent follow-up ----------
    if len(selected_sem) < max_recs:
        selected_codes_set = _expand_with_equivalents({c["course_code"] for c in selected_sem})
        for cand in ranked_sem:
            if len(selected_sem) >= max_recs:
                break
            if cand["course_code"] in selected_codes_set:
                continue
            if _blocked_by_writ_lifetime_limit(
                cand,
                selected_writ_courses=selected_writ_courses,
            ):
                continue
            unresolved_same_sem = _missing_same_semester_prereqs(cand)
            if unresolved_same_sem:
                continue
            if _maturity_guard_blocks(
                cand,
                enforce_bucket_cap=False,
                excluded_codes={c["course_code"] for c in selected_sem},
            ):
                continue
            assigned_buckets = _assignable_buckets_for_candidate(
                cand,
                enforce_bucket_cap=False,
            )
            is_bridge_pick = _is_bridge_candidate(cand)
            if not assigned_buckets and not is_bridge_pick:
                continue
            if (
                is_bridge_pick
                and _should_defer_bridge_for_direct_fill(cand)
                and _has_available_direct_fill_candidate(
                    enforce_bucket_cap=False,
                    excluded_codes={c["course_code"] for c in selected_sem} | {cand["course_code"]},
                )
            ):
                continue
            if is_bridge_pick and not _bridge_candidate_has_open_target(cand):
                continue
            _accept_candidate(cand, assigned_buckets)
            selected_codes_set.update(_expand_with_equivalents({cand["course_code"]}))

    # ---------- Rescue pass ----------
    # When all passes produced nothing, force-assign to any mapped bucket.
    if not selected_sem:
        has_unsatisfied = any(v > 0 for v in virtual_remaining.values())
        if has_unsatisfied:
            for cand in ranked_sem:
                if len(selected_sem) >= max_recs:
                    break
                cand_buckets = _selection_bucket_ids(cand)
                if _blocked_by_writ_lifetime_limit(
                    cand,
                    selected_writ_courses=selected_writ_courses,
                ):
                    continue
                if _is_bridge_candidate(cand):
                    continue
                assigned_buckets = _select_assignable_buckets_allocator_style(
                    cand_buckets,
                    virtual_remaining,
                    picks_per_bucket,
                    enforce_bucket_cap=False,
                    max_per_bucket=_MAX_PER_BUCKET_PER_SEM,
                    allowed_pairs=allowed_pairs,
                    bucket_meta=selection_bucket_meta,
                )
                if not assigned_buckets:
                    for bid in cand_buckets:
                        if bid in virtual_remaining:
                            assigned_buckets = [bid]
                            break
                if not assigned_buckets:
                    continue
                _accept_candidate(cand, assigned_buckets)
                selected_codes_set.update(_expand_with_equivalents({cand["course_code"]}))

    for cand in selected_sem:
        cand["tier"] = _bucket_hierarchy_tier_v2(
            cand,
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
        )

    recommendations_sem = _build_deterministic_recommendations(selected_sem, len(selected_sem))

    elective_bucket_ids = get_buckets_by_role(data["buckets_df"], track_id, "elective")
    if elective_bucket_ids:
        elective_courses = data["course_bucket_map_df"][
            (data["course_bucket_map_df"]["track_id"] == track_id)
            & (data["course_bucket_map_df"]["bucket_id"].isin(elective_bucket_ids))
        ]["course_code"].tolist()
    else:
        elective_courses = []
    blocking_sem = get_blocking_warnings(
        core_remaining_sem,
        reverse_map,
        elective_courses,
        completed,
        in_progress,
        threshold=BLOCKING_WARNING_THRESHOLD,
    )

    in_progress_note_sem = _build_in_progress_note(
        recommendations_sem,
        assumes_in_progress_completion,
    )

    selected_codes = [r["course_code"] for r in recommendations_sem if r.get("course_code")]
    projected_progress_sem = _build_projected_outputs(
        completed,
        in_progress,
        selected_codes,
        data,
        track_id,
        parent_type_map=parent_type_map,
        bucket_track_required_map=bucket_track_required_map,
        bucket_parent_map=bucket_parent_map,
    )

    result = {
        "target_semester": target_semester_label,
        "standing": current_standing,
        "standing_label": _STANDING_LABELS[current_standing],
        "recommendations": recommendations_sem,
        "requested_recommendations": max_recs,
        "eligible_count": eligible_count_sem,
        "input_completed_count": len(completed),
        "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
        "in_progress_note": in_progress_note_sem,
        "blocking_warnings": blocking_sem,
        "progress": progress_sem,
        "manual_review_courses": manual_review_sem,
        "projected_progress": projected_progress_sem,
        "projection_note": _PROJECTION_NOTE,
    }
    if debug:
        selected_code_set = {r["course_code"] for r in recommendations_sem}
        result["debug"] = _build_debug_trace(
            ranked_sem,
            selected_code_set,
            skipped_reasons,
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
            core_prereq_blockers_sem,
            reverse_map,
            _chain,
            virtual_remaining_snapshot,
            debug_limit=debug_limit,
        )
    return result
