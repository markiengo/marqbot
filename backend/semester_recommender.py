import json
import os
import re
from functools import lru_cache

import pandas as pd

from requirements import (
    DEFAULT_TRACK_ID,
    BLOCKING_WARNING_THRESHOLD,
    get_allowed_double_count_pairs,
    get_buckets_by_role,
)
from allocator import (
    allocate_courses,
    ensure_runtime_indexes,
    get_applied_bucket_progress_units,
    _safe_int,
    _infer_requirement_mode,
)
from unlocks import get_blocking_warnings
from eligibility import get_eligible_courses, parse_term
from prereq_parser import prereq_course_codes
from scheduling_styles import (
    StyleConfig,
    get_style_config,
    classify_candidate as _classify_candidate,
    style_select,
    VALID_SCHEDULING_STYLES,
)


SEM_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)

_MAX_PER_BUCKET_PER_SEM = 2
_DISC_FAMILY_PREFIX = "MCC_DISC"
_PROJECTION_NOTE = (
    "Projected progress below assumes you complete these recommendations."
)
_MCC_FOUNDATION_BUCKET_IDS = {"MCC_CORE", "MCC_ESSV1"}
_DISCOVERY_FOUNDATION_BUCKET_IDS = _MCC_FOUNDATION_BUCKET_IDS
_MCC_LATE_BUCKET_IDS = {"MCC_ESSV2", "MCC_WRIT", "MCC_CULM"}
_MCC_LOWEST_BUCKET_IDS: set[str] = set()
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
# Approximate semesters remaining by standing — used for style-aware BCC
# deferral decisions (explorer only defers BCC when runway >= 4).
_STANDING_TO_SEMESTERS_REMAINING = {1: 7, 2: 5, 3: 3, 4: 1}
_MATH_SUBJECT_PREFIX = "MATH"
_MAX_RANKING_OVERRIDE_BOOST = 2
_RANKING_OVERRIDES_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "config", "ranking_overrides.json")
)


def _credits_to_standing(credits: int) -> int:
    if credits >= 90:
        return 4
    if credits >= 60:
        return 3
    if credits >= 24:
        return 2
    return 1


@lru_cache(maxsize=1)
def _load_ranking_overrides() -> dict:
    try:
        with open(_RANKING_OVERRIDES_PATH, encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {"bucket_priority_boosts": {}}

    boosts = {}
    for bucket_id, raw_value in (raw.get("bucket_priority_boosts") or {}).items():
        try:
            boost = int(raw_value)
        except (TypeError, ValueError):
            continue
        boost = max(-_MAX_RANKING_OVERRIDE_BOOST, min(0, boost))
        if boost >= 0:
            continue
        boosts[str(bucket_id or "").strip().upper()] = boost
    return {"bucket_priority_boosts": boosts}


def _clear_ranking_overrides_cache() -> None:
    _load_ranking_overrides.cache_clear()


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


def _parse_bucket_flags(raw) -> set[str]:
    return {
        str(flag or "").strip().lower()
        for flag in str(raw or "").split(";")
        if str(flag or "").strip()
    }


def _bucket_meta_entry(bucket_id: str, bucket_meta: dict[str, dict] | None) -> dict:
    if not bucket_meta:
        return {}
    normalized = str(bucket_id or "").strip()
    if not normalized:
        return {}
    direct = bucket_meta.get(normalized)
    if direct is not None:
        return direct
    upper = normalized.upper()
    for key, value in bucket_meta.items():
        if str(key or "").strip().upper() == upper:
            return value
    return {}


def _bucket_has_flag(bucket_id: str, bucket_meta: dict[str, dict] | None, flag: str) -> bool:
    wanted = str(flag or "").strip().lower()
    if not wanted:
        return False
    meta = _bucket_meta_entry(bucket_id, bucket_meta)
    return wanted in _parse_bucket_flags(meta.get("bucket_flags", ""))


def _bucket_parent_alias(bucket_id: str, bucket_meta: dict[str, dict] | None) -> str:
    meta = _bucket_meta_entry(bucket_id, bucket_meta)
    return str(meta.get("display_parent_alias", "") or "").strip().upper()


def _bucket_planner_tier(bucket_id: str, bucket_meta: dict[str, dict] | None) -> int | None:
    meta = _bucket_meta_entry(bucket_id, bucket_meta)
    raw = pd.to_numeric(meta.get("planner_tier"), errors="coerce")
    if pd.notna(raw):
        return int(raw)
    return None


def _bucket_planner_rank(bucket_id: str, bucket_meta: dict[str, dict] | None) -> int | None:
    meta = _bucket_meta_entry(bucket_id, bucket_meta)
    raw = pd.to_numeric(meta.get("planner_bucket_rank"), errors="coerce")
    if pd.notna(raw):
        return int(raw)
    return None



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


def _is_discovery_bucket(
    bucket_id: str,
    bucket_parent_map: dict[str, str],
    bucket_meta: dict[str, dict] | None = None,
) -> bool:
    bid = str(bucket_id or "").strip().upper()
    if not bid:
        return False
    if _bucket_has_flag(bid, bucket_meta, "discovery_bucket"):
        return True
    local_id = _local_bucket_id(bid).upper()
    if local_id.startswith(_DISC_FAMILY_PREFIX):
        return True
    return str(bucket_parent_map.get(bid, "") or "").strip().upper().startswith(_DISC_FAMILY_PREFIX)


def _is_discovery_driven(
    candidate: dict,
    allocator_remaining: dict,
    bucket_parent_map: dict[str, str],
    bucket_meta: dict[str, dict] | None = None,
) -> bool:
    bucket_meta = bucket_meta or candidate.get("selection_bucket_meta") or candidate.get("bucket_meta")
    unmet_bucket_ids = _current_unmet_bucket_ids(candidate, allocator_remaining)
    if not unmet_bucket_ids:
        return False
    return all(
        _is_discovery_bucket(bucket_id, bucket_parent_map, bucket_meta)
        for bucket_id in unmet_bucket_ids
    )


def _open_foundation_slots(
    allocator_remaining: dict,
    bucket_meta: dict[str, dict] | None = None,
) -> int:
    total = 0
    for bucket_id, remaining in (allocator_remaining or {}).items():
        if _bucket_has_flag(bucket_id, bucket_meta, "foundation_bucket"):
            slots_raw = pd.to_numeric((remaining or {}).get("slots_remaining", 0), errors="coerce")
            slots_remaining = int(slots_raw) if pd.notna(slots_raw) else 0
            if slots_remaining > 0:
                total += slots_remaining
            continue
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
    bucket_meta: dict[str, dict] | None = None,
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
        if not parent_id or _is_discovery_bucket(bucket_id, bucket_parent_map, bucket_meta):
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
            "label": str(row.get("bucket_label", bid) or bid),
            "bucket_label": str(row.get("bucket_label", bid) or bid),
            "priority": int(p_raw) if pd.notna(p_raw) else 99,
            "parent_bucket_id": str(row.get("parent_bucket_id", "") or "").strip(),
            "parent_bucket_label": str(
                row.get("parent_bucket_label", row.get("parent_bucket_id", "")) or ""
            ).strip(),
            "requirement_mode": _infer_requirement_mode(row),
            "display_parent_alias": str(row.get("display_parent_alias", "") or "").strip().upper(),
            "planner_tier": pd.to_numeric(row.get("planner_tier"), errors="coerce"),
            "planner_bucket_rank": pd.to_numeric(row.get("planner_bucket_rank"), errors="coerce"),
            "bucket_flags": str(row.get("bucket_flags", "") or "").strip().lower(),
            "dynamic_pool_tag": str(row.get("dynamic_pool_tag", "") or "").strip().lower(),
            "dynamic_pool_exclusive": bool(row.get("dynamic_pool_exclusive", False)),
        }
    return out


def _selection_bucket_ids(candidate: dict) -> list[str]:
    raw = candidate.get("selection_buckets")
    if raw is None:
        raw = candidate.get("fills_buckets", [])
    return [str(b).strip() for b in (raw or []) if str(b).strip()]


def _override_tier_adj(candidate: dict, overrides: dict) -> int:
    boosts = overrides.get("bucket_priority_boosts") or {}
    if not boosts:
        return 0
    parent_id = str(candidate.get("primary_parent_bucket_id", "") or "").strip().upper()
    adjustment = 0
    for bucket_id in _selection_bucket_ids(candidate):
        key = str(bucket_id).strip().upper()
        boost = int(boosts.get(key, 0) or 0)
        if not boost and parent_id:
            boost = int(boosts.get(f"{parent_id}::{key}", 0) or 0)
        adjustment = min(adjustment, boost)
    return max(-_MAX_RANKING_OVERRIDE_BOOST, min(0, adjustment))


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
    bucket_meta: dict[str, dict] | None = None,
) -> int:
    explicit_tier = _bucket_planner_tier(bucket_id, bucket_meta)
    if explicit_tier is not None:
        return explicit_tier

    local_id = _local_bucket_id(bucket_id).upper()
    parent_id = bucket_parent_map.get(bucket_id, "")
    if not parent_id and bucket_id == primary_bucket:
        parent_id = primary_parent_id
    parent_id = str(parent_id or "").strip().upper()
    parent_type = parent_type_map.get(parent_id, "")
    track_required = bucket_track_required_map.get(bucket_id, "")
    parent_alias = _bucket_parent_alias(bucket_id, bucket_meta)

    # Tier 1 - MCC foundation work should be filled before business-core backfill.
    if _bucket_has_flag(bucket_id, bucket_meta, "foundation_bucket") or local_id in _MCC_FOUNDATION_BUCKET_IDS or parent_id == "MCC_FOUNDATION":
        return 1

    # Tier 2 - all BCC work, with BCC_REQUIRED first inside the tier.
    if parent_alias == "BCC" or local_id.startswith(_BCC_PREFIX) or bucket_id.startswith("BCC::") or parent_id.startswith("BCC"):
        return 2

    # Tier 3 - declared major requirements.
    if parent_type == "major":
        return 3

    # Discovery and culminating buckets stay below explicit major/track work.
    if (
        local_id in _MCC_LOWEST_BUCKET_IDS
        or parent_id in _MCC_LOWEST_BUCKET_IDS
        or _is_discovery_bucket(bucket_id, bucket_parent_map, bucket_meta)
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
    bucket_meta = candidate.get("selection_bucket_meta") or candidate.get("bucket_meta")
    if any(
        _bucket_has_flag(bucket_id, bucket_meta, "priority_core_bridge_target")
        for bucket_id in target_bucket_ids
    ):
        return True
    return any(
        (
            (_local_bucket_id(bucket_id).upper() == "BCC_REQUIRED")
            or _local_bucket_id(bucket_id).upper().startswith("MCC_CORE")
            or _local_bucket_id(bucket_id).upper().startswith("MCC_ESSV1")
        )
        for bucket_id in target_bucket_ids
    )


def _bcc_priority_rank(
    candidate: dict,
    bucket_parent_map: dict[str, str],
    bucket_meta: dict[str, dict] | None = None,
) -> int:
    bucket_meta = bucket_meta or candidate.get("selection_bucket_meta") or candidate.get("bucket_meta")
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
    explicit_bcc_rank: int | None = None
    for bucket_id in bucket_ids:
        local_id = _local_bucket_id(bucket_id).upper()
        parent_id = str(bucket_parent_map.get(bucket_id, "") or "").strip().upper()
        if _bucket_parent_alias(bucket_id, bucket_meta) == "BCC":
            has_bcc = True
            rank = _bucket_planner_rank(bucket_id, bucket_meta)
            if rank is not None:
                explicit_bcc_rank = rank if explicit_bcc_rank is None else min(explicit_bcc_rank, rank)
        if local_id == "BCC_REQUIRED":
            has_bcc_required = True
        if local_id.startswith(_BCC_PREFIX) or bucket_id.startswith("BCC::") or parent_id.startswith("BCC"):
            has_bcc = True
    if explicit_bcc_rank is not None:
        if explicit_bcc_rank <= 0:
            return 0 if _is_math_candidate(candidate) else 1
        return 2 if has_bcc else 3
    if has_bcc_required:
        return 0 if _is_math_candidate(candidate) else 1
    return 2 if has_bcc else 3


def _ranking_band(
    candidate: dict,
    bucket_parent_map: dict[str, str],
    style: StyleConfig | None = None,
    semesters_remaining: int = 8,
) -> int:
    """Map a candidate to a ranking band (0-8) for the primary sort key.

    Bands control the coarse selection order.  Lower band = selected first.

      Band 0 — Priority core bridge candidates (e.g. MATH 1200 unlocking
               MATH 1400 -> BCC chain).  Always first, every style.
      Band 1 — BCC_REQUIRED courses with high BCC priority rank.  This band
               keeps accounting/math prereqs on track for freshmen.
               **Explorer can demote this to band 2** when the student has
               >= 4 semesters of runway, letting MCC foundation and discovery
               courses surface earlier.
      Band 2-7 — Mapped linearly from the effective ranking tier (1-6).
      Band 8 — Unknown/fallback.

    The scheduling style only affects band 1: explorer's ``relax_bcc_band``
    flag allows BCC_REQUIRED to drop one band when there is enough runway.
    All other bands are style-independent.
    """
    # Band 0: priority core bridge candidates are non-negotiable.
    if _is_priority_core_bridge_candidate(candidate):
        return 0

    bcc_rank = _bcc_priority_rank(candidate, bucket_parent_map)
    if bcc_rank <= 1:
        # Explorer: demote band-1 BCC to band 2 when the student has enough
        # remaining semesters to still complete BCC prereq chains on time.
        if style and style.relax_bcc_band and semesters_remaining >= 4:
            return 2
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


def _protected_ranking_band_group(
    candidate: dict,
    bucket_parent_map: dict[str, str],
    *,
    style: StyleConfig | None = None,
    semesters_remaining: int = 8,
) -> int:
    """Keep critical chain work ahead of efficiency tie-breaks.

    Bands 0-2 cover priority bridges, BCC-required sequencing, and MCC foundation.
    Those stay protected. Outside that protected set, unmet multi-bucket coverage
    becomes the dominant ranking lever.
    """
    band = _ranking_band(
        candidate,
        bucket_parent_map,
        style=style,
        semesters_remaining=semesters_remaining,
    )
    return 0 if band <= 2 else 1


def _major_family_priority_rank(
    candidate: dict,
    parent_type_map: dict[str, str],
) -> int:
    """Return primary bucket priority for declared-major candidates only.

    Lower values mean "earlier within the major family" and already encode the
    runtime ordering of required -> choose_n -> credits_pool. Non-major
    candidates return a neutral rank so their ordering is unchanged.
    """
    parent_id = str(candidate.get("primary_parent_bucket_id", "") or "").strip().upper()
    parent_type = str(parent_type_map.get(parent_id, "") or "").strip().lower()
    if parent_type != "major":
        return 9999
    priority = _safe_int(candidate.get("primary_bucket_priority"), 9999)
    return priority if priority is not None else 9999


def _ranking_sort_key(
    candidate: dict,
    bucket_parent_map: dict[str, str],
    *,
    parent_type_map: dict[str, str],
    style: StyleConfig,
    semesters_remaining: int,
    chain_scores: dict[str, int],
    is_honors_student: bool,
) -> tuple:
    ranking_band = _ranking_band(
        candidate,
        bucket_parent_map,
        style=style,
        semesters_remaining=semesters_remaining,
    )
    honors_rank = (
        0
        if is_honors_student and re.search(r"\d+H$", candidate["course_code"])
        else 1
        if is_honors_student
        else 0
    )
    if style.strict_band_progression:
        return (
            ranking_band,
            candidate.get("effective_ranking_tier", candidate.get("ranking_tier", 99)),
            _major_family_priority_rank(candidate, parent_type_map),
            -candidate.get("multi_bucket_score", 0),
            _bcc_priority_rank(candidate, bucket_parent_map),
            0 if candidate.get("is_core_prereq_blocker") else 1,
            _bridge_sort_penalty(candidate, bucket_parent_map),
            candidate.get("soft_prereq_penalty", 0),
            candidate.get("discovery_foundation_penalty", 0),
            candidate.get("discovery_affinity_penalty", 0),
            -chain_scores.get(candidate["course_code"], 0),
            honors_rank,
            _course_level(candidate) if _course_level(candidate) is not None else 9999,
            candidate["course_code"],
        )

    return (
        _protected_ranking_band_group(
            candidate,
            bucket_parent_map,
            style=style,
            semesters_remaining=semesters_remaining,
        ),
        _major_family_priority_rank(candidate, parent_type_map),
        -candidate.get("multi_bucket_score", 0),
        ranking_band,
        candidate.get("effective_ranking_tier", candidate.get("ranking_tier", 99)),
        _bcc_priority_rank(candidate, bucket_parent_map),
        0 if candidate.get("is_core_prereq_blocker") else 1,
        _bridge_sort_penalty(candidate, bucket_parent_map),
        candidate.get("soft_prereq_penalty", 0),
        candidate.get("discovery_foundation_penalty", 0),
        candidate.get("discovery_affinity_penalty", 0),
        -chain_scores.get(candidate["course_code"], 0),
        honors_rank,
        _course_level(candidate) if _course_level(candidate) is not None else 9999,
        candidate["course_code"],
    )


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
        bucket_meta = candidate.get("selection_bucket_meta") or candidate.get("bucket_meta")
        if _bucket_has_flag(bucket_id, bucket_meta, "priority_core_bridge_target"):
            return True
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
    bucket_meta: dict[str, dict] | None = None,
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
    bucket_meta = bucket_meta or candidate.get("selection_bucket_meta") or candidate.get("bucket_meta")
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
            bucket_meta=bucket_meta,
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


def _progress_section_annotation(
    bucket_id: str,
    parent_id: str,
    parent_type_map: dict[str, str],
    bucket_meta: dict[str, dict] | None,
) -> dict[str, object]:
    meta = _bucket_meta_entry(bucket_id, bucket_meta)
    parent_type = str(parent_type_map.get(str(parent_id or "").strip().upper(), "") or "").strip().lower()
    parent_label = str(meta.get("parent_bucket_label", parent_id) or parent_id).strip()
    parent_alias = _bucket_parent_alias(bucket_id, bucket_meta)

    if parent_alias == "MCC":
        return {
            "section_key": "mcc",
            "section_label": "MCC",
            "section_rank": 0,
            "group_parent_id": "MCC",
            "group_parent_label": "MCC",
        }
    if parent_alias == "BCC":
        return {
            "section_key": "bcc",
            "section_label": "BCC",
            "section_rank": 1,
            "group_parent_id": "BCC",
            "group_parent_label": "BCC",
        }
    if parent_type == "track":
        return {
            "section_key": "track",
            "section_label": "Tracks",
            "section_rank": 3,
            "group_parent_id": str(parent_id or "").strip().upper(),
            "group_parent_label": parent_label,
        }
    if parent_type == "minor":
        return {
            "section_key": "minor",
            "section_label": "Minors",
            "section_rank": 4,
            "group_parent_id": str(parent_id or "").strip().upper(),
            "group_parent_label": parent_label,
        }
    return {
        "section_key": "major",
        "section_label": "Majors",
        "section_rank": 2,
        "group_parent_id": str(parent_id or "").strip().upper(),
        "group_parent_label": parent_label,
    }


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

    selection_bucket_meta = _build_selection_bucket_meta(data, track_id)
    if parent_type_map is None:
        parent_type_map = _build_parent_type_map(data)
    if bucket_track_required_map is None:
        bucket_track_required_map = _build_bucket_track_required_map(data, track_id)
    if bucket_parent_map is None:
        bucket_parent_map = _build_bucket_parent_map(data, track_id)

    annotated: dict = {}
    for bid, info in progress.items():
        parent_id = bucket_parent_map.get(str(bid), "")
        bucket_meta = _bucket_meta_entry(str(bid), selection_bucket_meta)
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
            selection_bucket_meta,
        )
        annotated_info["planner_bucket_rank"] = (
            _bucket_planner_rank(str(bid), selection_bucket_meta)
            if _bucket_planner_rank(str(bid), selection_bucket_meta) is not None
            else 99
        )
        annotated_info["parent_bucket_id"] = str(parent_id or "").strip().upper()
        annotated_info["parent_bucket_label"] = str(
            bucket_meta.get("parent_bucket_label", parent_id) or parent_id
        ).strip()
        annotated_info["display_parent_alias"] = _bucket_parent_alias(str(bid), selection_bucket_meta)
        annotated_info.update(
            _progress_section_annotation(
                str(bid),
                str(parent_id or "").strip().upper(),
                parent_type_map,
                selection_bucket_meta,
            )
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


def _normalize_course_code(raw: str | None) -> str:
    return str(raw or "").strip().upper()


def _build_course_conflict_map(data: dict, track_id: str) -> dict[str, set[str]]:
    ensure_runtime_indexes(data)
    track_key = _normalize_course_code(track_id)
    runtime_indexes = data.get("runtime_indexes") or {}
    track_runtime = (runtime_indexes.get("tracks") or {}).get(track_key) or {}

    conflict_map: dict[str, set[str]] = {}

    def _link_members(members: set[str]) -> None:
        if len(members) < 2:
            return
        for member in members:
            conflict_map.setdefault(member, set()).update(members - {member})

    equivalent_course_map = track_runtime.get("equivalent_course_map") or {}
    for raw_code, raw_aliases in equivalent_course_map.items():
        members = {
            _normalize_course_code(raw_code),
            *{
                _normalize_course_code(alias)
                for alias in (raw_aliases or set())
            },
        }
        _link_members({code for code in members if code})

    cross_listed_map = data.get("cross_listed_map") or {}
    for raw_code, raw_aliases in cross_listed_map.items():
        members = {
            _normalize_course_code(raw_code),
            *{
                _normalize_course_code(alias)
                for alias in (raw_aliases or set())
            },
        }
        _link_members({code for code in members if code})

    ndc_groups = track_runtime.get("no_double_count_groups") or data.get("no_double_count_groups") or []
    for raw_group in ndc_groups:
        members = {
            _normalize_course_code(member)
            for member in (raw_group or set())
            if _normalize_course_code(member)
        }
        _link_members(members)

    return conflict_map


def _expand_with_course_conflicts(
    codes: set[str],
    conflict_map: dict[str, set[str]],
) -> set[str]:
    expanded = {_normalize_course_code(code) for code in codes if _normalize_course_code(code)}
    for code in list(expanded):
        expanded.update(conflict_map.get(code, set()))
    return expanded


def _normalize_selected_codes_for_conflicts(
    selected_codes: list[str],
    conflict_map: dict[str, set[str]],
) -> tuple[list[str], dict[str, str]]:
    kept_codes: list[str] = []
    blocked_codes: set[str] = set()
    dropped_conflicts: dict[str, str] = {}

    for course_code in _dedupe_codes(selected_codes):
        code = _normalize_course_code(course_code)
        if not code:
            continue
        if code in blocked_codes:
            blocker = next(
                (
                    kept
                    for kept in kept_codes
                    if code == kept or code in conflict_map.get(kept, set())
                ),
                "",
            )
            if blocker:
                dropped_conflicts[code] = blocker
            continue
        kept_codes.append(code)
        blocked_codes.update(_expand_with_course_conflicts({code}, conflict_map))

    return kept_codes, dropped_conflicts


def _annotate_candidates_with_conflicts(
    candidates: list[dict],
    conflict_map: dict[str, set[str]],
) -> list[dict]:
    for candidate in candidates:
        code = _normalize_course_code(candidate.get("course_code"))
        candidate["conflicts_with_courses"] = sorted(conflict_map.get(code, set())) if code else []
    return candidates


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
        equivalency_targets = [
            str(code or "").strip()
            for code in (cand.get("equivalent_to_courses") or [])
            if str(code or "").strip()
        ]
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
        elif equivalency_targets and not _is_bridge_candidate(cand):
            target_text = ", ".join(equivalency_targets[:2])
            if len(equivalency_targets) > 2:
                target_text += ", and other approved equivalents"
            why = (
                f"This course counts as an equivalent to {target_text} "
                "for your declared degree path."
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
            "bucket_label_overrides": cand.get("bucket_label_overrides", {}),
            "equivalent_to_courses": equivalency_targets,
            "conflicts_with_courses": [
                str(code or "").strip()
                for code in (cand.get("conflicts_with_courses") or [])
                if str(code or "").strip()
            ],
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "warning_text": cand.get("warning_text"),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        }
        recs.append(rec)
    return recs


def _build_edit_swap_candidates(
    ranked_candidates: list[dict],
    recommendations: list[dict],
    equivalencies_df: pd.DataFrame | None,
) -> list[dict]:
    """Return the full eligible edit pool, keeping selected recs at the top."""
    if not ranked_candidates:
        return list(recommendations)

    formatted_candidates = _build_deterministic_recommendations(
        ranked_candidates,
        len(ranked_candidates),
    )

    swap_rows: list[dict] = []
    seen_codes: set[str] = set()

    for rec in recommendations:
        code = str(rec.get("course_code", "") or "").strip().upper()
        if not code or code in seen_codes:
            continue
        swap_rows.append(rec)
        seen_codes.add(code)

    for rec in formatted_candidates:
        code = str(rec.get("course_code", "") or "").strip().upper()
        if not code or code in seen_codes:
            continue
        swap_rows.append(rec)
        seen_codes.add(code)

    return swap_rows


def _manual_selected_fills_buckets(course_code: str, data: dict, track_id: str) -> list[str]:
    course_map_df = data.get("course_bucket_map_df", pd.DataFrame())
    if (
        course_map_df is None
        or len(course_map_df) == 0
        or "course_code" not in course_map_df.columns
        or "bucket_id" not in course_map_df.columns
    ):
        return []

    code = str(course_code or "").strip().upper()
    if not code:
        return []

    subset = course_map_df[
        course_map_df["course_code"].astype(str).str.strip().str.upper() == code
    ].copy()
    if len(subset) == 0:
        return []

    if "track_id" in subset.columns:
        tid = str(track_id or "").strip().upper()
        scoped = subset[
            subset["track_id"].astype(str).str.strip().str.upper() == tid
        ].copy()
        if len(scoped) > 0:
            subset = scoped

    return _dedupe_codes(
        [
            str(bucket_id or "").strip()
            for bucket_id in subset["bucket_id"].tolist()
            if str(bucket_id or "").strip()
        ]
    )


def _manual_selected_course_candidate(
    course_code: str,
    data: dict,
    track_id: str,
    conflict_map: dict[str, set[str]] | None = None,
) -> dict | None:
    courses_df = data.get("courses_df", pd.DataFrame())
    if courses_df is None or len(courses_df) == 0 or "course_code" not in courses_df.columns:
        return None

    code = str(course_code or "").strip().upper()
    if not code:
        return None

    match = courses_df[
        courses_df["course_code"].astype(str).str.strip().str.upper() == code
    ]
    if len(match) == 0:
        return None

    row = match.iloc[0]
    raw_credits = row.get("credits", 3)
    try:
        credits = int(float(raw_credits)) if pd.notna(raw_credits) else 3
    except (TypeError, ValueError):
        credits = 3

    raw_min_standing = row.get("min_standing")
    try:
        min_standing = int(float(raw_min_standing)) if pd.notna(raw_min_standing) else None
    except (TypeError, ValueError):
        min_standing = None

    notes = row.get("notes")
    if pd.isna(notes):
        notes = None

    return {
        "course_code": code,
        "course_name": str(row.get("course_name", "") or "").strip(),
        "credits": credits,
        "fills_buckets": _manual_selected_fills_buckets(code, data, track_id),
        "conflicts_with_courses": sorted((conflict_map or {}).get(code, set())),
        "prereq_check": "",
        "min_standing": min_standing,
        "has_soft_requirement": False,
        "soft_tags": [],
        "warning_text": None,
        "low_confidence": False,
        "notes": notes,
    }


def _build_semester_credit_warnings(
    target_semester_label: str,
    recommendations: list[dict],
) -> list[str]:
    semester_warnings: list[str] = []
    total_rec_credits = sum(float(r.get("credits", 3)) for r in recommendations)
    is_summer_sem = "summer" in target_semester_label.lower()

    if is_summer_sem:
        if total_rec_credits > 16:
            semester_warnings.append(
                f"This semester totals {total_rec_credits:.0f} recommended credits, "
                "which exceeds the summer term maximum of 16."
            )
        return semester_warnings

    if total_rec_credits > 19:
        semester_warnings.append(
            f"This semester totals {total_rec_credits:.0f} recommended credits, "
            "which exceeds the College of Business maximum of 19. "
            "A Credit Overload form and dean approval are required."
        )
    elif total_rec_credits > 18:
        semester_warnings.append(
            f"This semester totals {total_rec_credits:.0f} recommended credits, "
            "which is above the normal 15–18 range."
        )

    if total_rec_credits < 12 and len(recommendations) > 0:
        semester_warnings.append(
            f"This semester totals {total_rec_credits:.0f} recommended credits, "
            "which is below the 12-credit full-time minimum."
        )

    return semester_warnings


def _build_manual_selected_semester_result(
    *,
    completed: list[str],
    in_progress: list[str],
    selected_codes: list[str],
    target_semester_label: str,
    data: dict,
    track_id: str,
    reverse_map: dict,
    current_standing: int,
    assumes_in_progress_completion: bool,
    alloc: dict,
    progress_sem: dict,
    non_manual_swap_sem: list[dict],
    eligible_count_sem: int,
    manual_review_sem: list[str],
    parent_type_map: dict[str, str],
    bucket_track_required_map: dict[str, str],
    bucket_parent_map: dict[str, str],
    conflict_map: dict[str, set[str]],
) -> dict:
    selected_codes, dropped_conflicts = _normalize_selected_codes_for_conflicts(
        selected_codes,
        conflict_map,
    )
    candidate_lookup = {
        str(candidate.get("course_code", "") or "").strip().upper(): candidate
        for candidate in non_manual_swap_sem
        if str(candidate.get("course_code", "") or "").strip()
    }

    selected_candidates: list[dict] = []
    for course_code in selected_codes:
        candidate = candidate_lookup.get(course_code.upper())
        if candidate is None:
            candidate = _manual_selected_course_candidate(
                course_code,
                data,
                track_id,
                conflict_map=conflict_map,
            )
        if candidate is not None:
            selected_candidates.append(candidate)

    recommendations_sem = _build_deterministic_recommendations(
        selected_candidates,
        len(selected_candidates),
    )

    core_remaining_sem: list[str] = []
    for bid, rem_info in alloc["remaining"].items():
        slots = rem_info.get("slots_remaining", 0)
        if slots <= 0:
            continue
        if rem_info.get("is_credit_based"):
            continue
        parent_id = bucket_parent_map.get(bid.upper(), "")
        if parent_type_map.get(parent_id) == "universal":
            continue
        core_remaining_sem.extend(rem_info.get("remaining_courses", []))
    core_remaining_sem = list(dict.fromkeys(core_remaining_sem))

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

    semester_warnings = _build_semester_credit_warnings(
        target_semester_label,
        recommendations_sem,
    )
    for dropped_code, blocker in dropped_conflicts.items():
        semester_warnings.append(
            f"{dropped_code} was removed from this semester because it conflicts with {blocker}."
        )

    return {
        "target_semester": target_semester_label,
        "standing": current_standing,
        "standing_label": _STANDING_LABELS[current_standing],
        "recommendations": recommendations_sem,
        "eligible_swaps": _build_edit_swap_candidates(
            non_manual_swap_sem,
            recommendations_sem,
            data.get("equivalencies_df"),
        ),
        "requested_recommendations": len(selected_codes),
        "eligible_count": eligible_count_sem,
        "input_completed_count": len(completed),
        "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
        "in_progress_note": _build_in_progress_note(
            recommendations_sem,
            assumes_in_progress_completion,
        ),
        "blocking_warnings": blocking_sem,
        "semester_warnings": semester_warnings,
        "progress": progress_sem,
        "manual_review_courses": manual_review_sem,
        "projected_progress": projected_progress_sem,
        "projection_note": _PROJECTION_NOTE,
    }


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
            "override_tier_adj": c.get("override_tier_adj", 0),
            "effective_ranking_tier": c.get("effective_ranking_tier", tier),
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


def _course_codes_for_bucket_flag(
    course_bucket_map_df: pd.DataFrame,
    track_id: str,
    bucket_meta: dict[str, dict] | None,
    flag: str,
    *,
    legacy_local_bucket_id: str | None = None,
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

    target_local_id = str(legacy_local_bucket_id or "").strip().upper()
    codes: set[str] = set()
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        if not bid:
            continue
        if not _bucket_has_flag(bid, bucket_meta, flag):
            if not target_local_id or _local_bucket_id(bid).upper() != target_local_id:
                continue
        code = str(row.get("course_code", "") or "").strip().upper()
        if code:
            codes.add(code)
    return codes


def _candidate_advances_declared_or_bcc_requirement(
    candidate: dict,
    bucket_parent_map: dict[str, str],
    parent_type_map: dict[str, str],
    bucket_meta: dict[str, dict] | None = None,
) -> bool:
    bucket_meta = bucket_meta or candidate.get("selection_bucket_meta") or candidate.get("bucket_meta")
    bucket_ids = list(candidate.get("fills_buckets", []) or []) + list(
        candidate.get("bridge_target_buckets", []) or []
    )
    for raw_bucket_id in bucket_ids:
        bid = str(raw_bucket_id or "").strip().upper()
        if not bid:
            continue
        local_id = _local_bucket_id(bid).upper()
        if _bucket_parent_alias(bid, bucket_meta) == "BCC" or local_id.startswith(_BCC_PREFIX):
            return True
        parent = bucket_parent_map.get(bid, "")
        if (
            parent_type_map.get(parent, "") in {"major", "track", "minor"}
            and not _is_discovery_bucket(bid, bucket_parent_map, bucket_meta)
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
    scheduling_style: str | None = None,
    manual_selected_codes: list[str] | None = None,
) -> dict:
    """Run the full recommendation pipeline for a single semester.

    The pipeline has nine phases:
      1. Allocation — determine which buckets still need courses.
      2. Eligibility — filter to courses offered this term with met prereqs.
      3. Standing & summer gates — exclude standing-blocked courses and apply
         summer caps.  Standing-recovery path handles dead-end rescue.
      4. Scoring setup — build parent/bucket maps, progress state, WRIT
         tracking, and core prereq blocker set.
      5. Tier assignment & style application — assign each candidate a base
         tier from the bucket hierarchy, then remap through the active
         scheduling style's tier map.
      6. Multi-key sort — produce the ranked candidate list used by selection.
      7. Style-aware greedy selection — three-pass slot reservation system
         (mandatory bridge -> style reservations -> greedy fill).
      8. Same-semester concurrent follow-up — pick courses that needed a
         same-semester prereq that was selected in pass 7.
      9. Rescue pass — force-assign to any mapped bucket when all passes
         produced nothing but unsatisfied buckets remain.
    """
    if completed_only_standing is None:
        completed_only_standing = current_standing

    # Resolve the scheduling style to a StyleConfig with slot reservations,
    # tier map, and band relaxation settings.
    style = get_style_config(scheduling_style)
    semesters_remaining = _STANDING_TO_SEMESTERS_REMAINING.get(current_standing, 7)

    selection_program_ids = list(
        selected_program_ids
        or data.get("selected_program_ids", [])
        or data.get("restriction_program_ids", [])
    )

    # ── Phase 1: Allocation ───────────────────────────────────────────
    # Walk the student's completed + in-progress courses through the bucket
    # tree to determine which buckets still need courses and how many slots
    # remain in each.
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
    selection_bucket_meta = _build_selection_bucket_meta(data, track_id)

    # ── Phase 2: Eligibility ──────────────────────────────────────────
    # Filter the full course catalog to courses the student can actually take
    # this term: prerequisites met, not already completed/in-progress, mapped
    # to at least one unsatisfied bucket, and offered this term.
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
    # Edit-mode swap pools should expose the full can-take list, not just
    # courses that still advance an unmet bucket in the current plan.
    eligible_swap_sem = get_eligible_courses(
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
        restrict_to_unmet_buckets=False,
    )
    conflict_map_sem = _build_course_conflict_map(data, track_id)
    _annotate_candidates_with_conflicts(eligible_sem, conflict_map_sem)
    _annotate_candidates_with_conflicts(eligible_swap_sem, conflict_map_sem)
    for candidate in eligible_sem:
        candidate["selection_bucket_meta"] = selection_bucket_meta
    for candidate in eligible_swap_sem:
        candidate["selection_bucket_meta"] = selection_bucket_meta

    # ── Phase 3: Standing gates & summer filters ─────────────────────
    # Remove courses the student cannot take yet (standing too low) and
    # apply summer-specific caps.  If nothing survives and requirements
    # remain, attempt standing-recovery (filler courses to gain credits).
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
    eligible_swap_sem = [
        c for c in eligible_swap_sem
        if _passes_standing_gate(c)
    ]
    if is_summer_sem:
        eligible_swap_sem = [c for c in eligible_swap_sem if not c.get("low_confidence", False)]
    manual_review_sem = [c["course_code"] for c in eligible_sem if c.get("manual_review")]
    non_manual_sem = [c for c in eligible_sem if not c.get("manual_review")]
    non_manual_swap_sem = [c for c in eligible_swap_sem if not c.get("manual_review")]
    eligible_count_sem = len(non_manual_sem)

    # ── Phase 4: Scoring setup ────────────────────────────────────────
    # Build lookup maps, progress state, WRIT tracking, and the core prereq
    # blocker set.  These are computed once and reused by the ranking and
    # selection phases.
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
    writ_course_codes = _course_codes_for_bucket_flag(
        data.get("course_bucket_map_df"),
        track_id,
        selection_bucket_meta,
        "writ_bucket",
        legacy_local_bucket_id="MCC_WRIT",
    )
    historical_writ_courses = {
        str(code or "").strip().upper()
        for code in (completed + in_progress)
        if str(code or "").strip().upper() in writ_course_codes
    }

    if manual_selected_codes is not None:
        return _build_manual_selected_semester_result(
            completed=completed,
            in_progress=in_progress,
            selected_codes=manual_selected_codes,
            target_semester_label=target_semester_label,
            data=data,
            track_id=track_id,
            reverse_map=reverse_map,
            current_standing=current_standing,
            assumes_in_progress_completion=assumes_in_progress_completion,
            alloc=alloc,
            progress_sem=progress_sem,
            non_manual_swap_sem=non_manual_swap_sem,
            eligible_count_sem=eligible_count_sem,
            manual_review_sem=manual_review_sem,
            parent_type_map=parent_type_map,
            bucket_track_required_map=bucket_track_required_map,
            bucket_parent_map=bucket_parent_map,
            conflict_map=conflict_map_sem,
        )

    def _candidate_is_writ_tagged(candidate: dict) -> bool:
        code = str(candidate.get("course_code", "") or "").strip().upper()
        if code and code in writ_course_codes:
            return True
        return any(
            _bucket_has_flag(bucket_id, selection_bucket_meta, "writ_bucket")
            or _local_bucket_id(bucket_id).upper() == "MCC_WRIT"
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
            selection_bucket_meta,
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

    # ── Phase 4b: Core prereq blocker identification ─────────────────
    # Find courses that are prerequisites of remaining required courses in
    # non-universal (major/track) buckets.  These must be scheduled early so
    # the courses they unlock can still fit within 8 semesters.
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
    foundation_slots_open_sem = _open_foundation_slots(alloc["remaining"], selection_bucket_meta)
    declared_dept_set = _build_declared_dept_set(
        data,
        track_id,
        bucket_parent_map,
        parent_type_map,
        selection_bucket_meta,
    )
    # ── Phase 5: Tier assignment & style application ─────────────────
    # Assign each candidate a base tier from the bucket hierarchy (1-7),
    # then remap through the active style's tier map.  The base tier is
    # preserved as ``base_tier`` for candidate classification (bridge /
    # discovery / core) in the selection phase.
    ranking_overrides = _load_ranking_overrides()
    scored_non_manual_sem: list[dict] = []
    for cand in non_manual_sem:
        if _blocked_by_writ_lifetime_limit(cand):
            continue
        tagged = dict(cand)
        tagged["selection_bucket_meta"] = selection_bucket_meta
        base_tier = _bucket_hierarchy_tier_v2(
            tagged,
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
            selection_bucket_meta,
        )
        tagged["base_tier"] = base_tier
        tagged["ranking_tier"] = base_tier
        current_unmet_buckets = _current_unmet_bucket_ids(tagged, alloc["remaining"])
        is_discovery_driven = _is_discovery_driven(
            tagged,
            alloc["remaining"],
            bucket_parent_map,
            selection_bucket_meta,
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
        tagged["override_tier_adj"] = _override_tier_adj(tagged, ranking_overrides)
        # Apply the style's tier remap (e.g. explorer promotes tiers 5,6 to 2).
        tagged["ranking_tier"] = style.tier_map.get(base_tier, base_tier)
        tagged["effective_ranking_tier"] = tagged["ranking_tier"] + tagged["override_tier_adj"]
        scored_non_manual_sem.append(tagged)

    # ── Phase 6: Multi-key sort ────────────────────────────────────────
    # Grinder keeps ranking bands strict so declared-program work stays ahead
    # of late MCC/discovery cleanup. Explorer and mixer still let multi-bucket
    # efficiency dominate once the protected bands are out of the way.
    ranked_sem = sorted(
        scored_non_manual_sem,
        key=lambda c: _ranking_sort_key(
            c,
            bucket_parent_map,
            parent_type_map=parent_type_map,
            style=style,
            semesters_remaining=semesters_remaining,
            chain_scores=_chain,
            is_honors_student=is_honors_student,
        ),
    )
    eligible_count_sem = len(ranked_sem)
    # ---------- Selection setup ----------
    selected_sem = []
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

    # ── Phase 7: Style-aware greedy selection ─────────────────────────
    # Three-pass slot reservation system:
    #   Pass 1 (mandatory): accept all band-0 bridge candidates.
    #   Pass 2 (reservation): fill style-specific discovery/core slot targets.
    #   Pass 3 (greedy fill): fill remaining slots in ranked order.
    # All passes respect the same gate checks: WRIT limit, same-semester
    # prereqs, maturity guard, bucket capacity, and bridge deferral.

    def _can_select(cand: dict, already_selected_codes: set[str]) -> tuple[bool, list[str]]:
        """Gate check wrapper for style_select.

        Returns (can_accept, assigned_buckets).  Encapsulates all the
        existing skip-logic so style_select does not need to know about
        WRIT limits, maturity guards, bridge deferral, etc.
        """
        if cand["course_code"] in already_selected_codes:
            return False, []
        if cand["course_code"] in selected_codes_set:
            return False, []
        if _blocked_by_writ_lifetime_limit(
            cand,
            selected_writ_courses=selected_writ_courses,
        ):
            return False, []
        unresolved = _missing_same_semester_prereqs(cand)
        if unresolved:
            return False, []
        if _maturity_guard_blocks(
            cand,
            enforce_bucket_cap=False,
            excluded_codes={c["course_code"] for c in selected_sem} | already_selected_codes,
        ):
            return False, []
        assigned_buckets = _assignable_buckets_for_candidate(
            cand,
            enforce_bucket_cap=False,
        )
        is_bridge_pick = _is_bridge_candidate(cand)
        if not assigned_buckets and not is_bridge_pick:
            return False, []
        if (
            is_bridge_pick
            and _should_defer_bridge_for_direct_fill(cand)
            and _has_available_direct_fill_candidate(
                enforce_bucket_cap=False,
                excluded_codes={c["course_code"] for c in selected_sem} | already_selected_codes | {cand["course_code"]},
            )
        ):
            return False, []
        if is_bridge_pick and not _bridge_candidate_has_open_target(cand):
            return False, []
        return True, assigned_buckets

    def _style_accept(cand: dict, assigned_buckets: list[str]) -> None:
        """Accept wrapper that blocks equivalent and no-double-count conflicts."""
        _accept_candidate(cand, assigned_buckets)
        selected_codes_set.update(
            _expand_with_course_conflicts({cand["course_code"]}, conflict_map_sem)
        )

    def _style_classify(cand: dict) -> str:
        """Classify a candidate for slot reservation purposes."""
        band = _ranking_band(cand, bucket_parent_map, style=style, semesters_remaining=semesters_remaining)
        return _classify_candidate(
            cand,
            is_discovery_driven=bool(cand.get("is_discovery_driven")),
            ranking_band=band,
        )

    style_select(
        ranked_sem,
        style,
        max_recs,
        accept_fn=_style_accept,
        can_select_fn=_can_select,
        classify_fn=_style_classify,
    )

    # ── Phase 8: Same-semester concurrent follow-up ──────────────────
    # Pick courses that required a same-semester corequisite which was
    # selected in phase 7.  These were skipped earlier because their
    # corequisite wasn't yet in the selected set.
    if len(selected_sem) < max_recs:
        selected_codes_set = _expand_with_course_conflicts(
            {c["course_code"] for c in selected_sem},
            conflict_map_sem,
        )
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
            selected_codes_set.update(
                _expand_with_course_conflicts({cand["course_code"]}, conflict_map_sem)
            )

    # ── Phase 9: Rescue pass ─────────────────────────────────────────
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
                selected_codes_set.update(
                    _expand_with_course_conflicts({cand["course_code"]}, conflict_map_sem)
                )

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

    semester_warnings = _build_semester_credit_warnings(
        target_semester_label,
        recommendations_sem,
    )

    result = {
        "target_semester": target_semester_label,
        "standing": current_standing,
        "standing_label": _STANDING_LABELS[current_standing],
        "recommendations": recommendations_sem,
        "eligible_swaps": _build_edit_swap_candidates(
            non_manual_swap_sem,
            recommendations_sem,
            data.get("equivalencies_df"),
        ),
        "requested_recommendations": max_recs,
        "eligible_count": eligible_count_sem,
        "input_completed_count": len(completed),
        "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
        "in_progress_note": in_progress_note_sem,
        "blocking_warnings": blocking_sem,
        "semester_warnings": semester_warnings,
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
