import re
import pandas as pd

from requirements import DEFAULT_TRACK_ID, BLOCKING_WARNING_THRESHOLD, get_buckets_by_role
from allocator import allocate_courses
from unlocks import get_direct_unlocks, get_blocking_warnings
from timeline import estimate_timeline
from eligibility import get_eligible_courses, parse_term


SEM_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)

_CONCURRENT_ONLY_TAG = "may_be_concurrent"
_PROJECTION_NOTE = (
    "Projected progress below assumes you complete these recommendations."
)


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


def _prereq_courses(parsed: dict) -> set[str]:
    t = parsed.get("type")
    if t == "single":
        return {parsed["course"]}
    if t in ("and", "or"):
        return set(parsed["courses"])
    return set()


def _soft_tag_demote_penalty(candidate: dict) -> int:
    """
    Demote any course that has prereq_soft tags, except when the only
    prereq_soft tag is may_be_concurrent.
    """
    tags = [str(t).strip() for t in candidate.get("all_soft_tags", []) if str(t).strip()]
    if not tags:
        return 0
    uniq = set(tags)
    if uniq == {_CONCURRENT_ONLY_TAG}:
        return 0
    return 1


def _local_bucket_id(bucket_id: str) -> str:
    raw = str(bucket_id or "").strip()
    if "::" in raw:
        return raw.split("::", 1)[1]
    return raw


def _bucket_hierarchy_tier(candidate: dict) -> int:
    """
    Recommendation hierarchy override:
    1) BCC_REQUIRED first
    2) All other buckets in the same tier (BCC child sub-buckets and major requirements)
    """
    local_id = _local_bucket_id(candidate.get("primary_bucket"))
    if local_id == "BCC_REQUIRED":
        return 0
    return 1


def build_progress_output(allocation: dict, course_bucket_map_df: pd.DataFrame) -> dict:
    progress = {}
    for bid, applied in allocation["applied_by_bucket"].items():
        remaining = allocation["remaining"].get(bid, {})
        progress[bid] = {
            "label": applied.get("label", bid),
            "needed": applied.get("needed"),
            "completed_applied": applied["completed_applied"],
            "in_progress_applied": applied["in_progress_applied"],
            "done_count": len(applied["completed_applied"]),
            "satisfied": applied["satisfied"],
            "remaining_courses": remaining.get("remaining_courses", []),
            "slots_remaining": remaining.get("slots_remaining", 0),
        }
    return progress


def _dedupe_codes(codes: list[str]) -> list[str]:
    """Return codes in first-seen order without duplicates."""
    return list(dict.fromkeys([c for c in codes if c]))


def _build_projected_outputs(
    completed: list[str],
    in_progress: list[str],
    selected_codes: list[str],
    data: dict,
    track_id: str,
) -> tuple[dict, dict]:
    # Progress view keeps planned semester courses as in-progress (yellow segment),
    # while timeline keeps completion-assumption semantics.
    projected_completed_for_progress = _dedupe_codes(completed)
    projected_in_progress_for_progress = _dedupe_codes(in_progress + selected_codes)
    projected_alloc_for_progress = allocate_courses(
        projected_completed_for_progress,
        projected_in_progress_for_progress,
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )
    projected_progress = build_progress_output(
        projected_alloc_for_progress,
        data["course_bucket_map_df"],
    )

    projected_completed_for_timeline = _dedupe_codes(completed + in_progress + selected_codes)
    projected_alloc_for_timeline = allocate_courses(
        projected_completed_for_timeline,
        [],
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )
    projected_timeline = estimate_timeline(projected_alloc_for_timeline["remaining"])
    if isinstance(projected_timeline, dict):
        projected_timeline["disclaimer"] = (
            "Major-only estimate, assuming ~3 major courses per term and typical availability."
        )
    return projected_progress, projected_timeline


def _build_deterministic_recommendations(candidates: list[dict], max_recommendations: int) -> list[dict]:
    """Build recommendation output from pre-ranked candidates. No LLM call."""
    target_count = min(max_recommendations, len(candidates))
    recs = []
    for cand in candidates[:target_count]:
        buckets = cand.get("fills_buckets", [])
        if buckets:
            why = (
                "This course advances your declared degree path and "
                f"counts toward {len(buckets)} unmet requirement bucket(s)."
            )
        else:
            why = (
                "This course advances your declared degree path based on "
                "prerequisite order and remaining requirements."
            )
        recs.append({
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "why": why,
            "prereq_check": cand.get("prereq_check", ""),
            "min_standing": cand.get("min_standing"),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": cand.get("fills_buckets", []),
            "unlocks": cand.get("unlocks", []),
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        })
    return recs


def run_recommendation_semester(
    completed: list[str],
    in_progress: list[str],
    target_semester_label: str,
    data: dict,
    max_recs: int,
    reverse_map: dict,
    track_id: str = DEFAULT_TRACK_ID,
) -> dict:
    """Run the full recommendation pipeline for a single semester."""
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
    )
    manual_review_sem = [c["course_code"] for c in eligible_sem if c.get("manual_review")]
    non_manual_sem = [c for c in eligible_sem if not c.get("manual_review")]
    eligible_count_sem = len(non_manual_sem)

    progress_sem = build_progress_output(alloc, data["course_bucket_map_df"])
    timeline_sem = estimate_timeline(alloc["remaining"])
    if isinstance(timeline_sem, dict):
        timeline_sem["disclaimer"] = (
            "Major-only estimate, assuming ~3 major courses per term and typical availability."
        )

    if not non_manual_sem:
        projected_progress_sem, projected_timeline_sem = _build_projected_outputs(
            completed,
            in_progress,
            [],
            data,
            track_id,
        )
        return {
            "target_semester": target_semester_label,
            "recommendations": [],
            "requested_recommendations": max_recs,
            "eligible_count": 0,
            "input_completed_count": len(completed),
            "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
            "in_progress_note": None,
            "blocking_warnings": [],
            "progress": progress_sem,
            "double_counted_courses": alloc["double_counted_courses"],
            "allocation_notes": alloc["notes"],
            "manual_review_courses": manual_review_sem,
            "timeline": timeline_sem,
            "projected_progress": projected_progress_sem,
            "projected_timeline": projected_timeline_sem,
            "projection_note": _PROJECTION_NOTE,
        }

    core_bucket_ids = get_buckets_by_role(data["buckets_df"], track_id, "core")
    core_remaining_sem: list[str] = []
    for core_bid in core_bucket_ids:
        core_remaining_sem.extend(
            alloc["remaining"].get(core_bid, {}).get("remaining_courses", [])
        )
    # Deduplicate while preserving order for deterministic warnings.
    core_remaining_sem = list(dict.fromkeys(core_remaining_sem))
    core_prereq_blockers_sem: set[str] = set()
    for core_code in core_remaining_sem:
        core_prereq_blockers_sem |= _prereq_courses(data["prereq_map"].get(core_code, {"type": "none"}))

    ranked_sem = sorted(
        non_manual_sem,
        key=lambda c: (
            0 if c["course_code"] in core_prereq_blockers_sem else 1,
            _soft_tag_demote_penalty(c),
            _bucket_hierarchy_tier(c),
            -c.get("multi_bucket_score", 0),
            c.get("prereq_level", 0),
            c["course_code"],
        ),
    )
    selected_sem = ranked_sem[:max_recs]
    for cand in selected_sem:
        cand["unlocks"] = get_direct_unlocks(cand["course_code"], reverse_map, limit=3)

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

    in_progress_note_sem = None
    if any("in progress" in (r.get("prereq_check") or "") for r in recommendations_sem):
        in_progress_note_sem = "Prerequisites satisfied via in-progress courses assume successful completion."

    selected_codes = [r["course_code"] for r in recommendations_sem if r.get("course_code")]
    projected_progress_sem, projected_timeline_sem = _build_projected_outputs(
        completed,
        in_progress,
        selected_codes,
        data,
        track_id,
    )

    return {
        "target_semester": target_semester_label,
        "recommendations": recommendations_sem,
        "requested_recommendations": max_recs,
        "eligible_count": eligible_count_sem,
        "input_completed_count": len(completed),
        "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
        "in_progress_note": in_progress_note_sem,
        "blocking_warnings": blocking_sem,
        "progress": progress_sem,
        "double_counted_courses": alloc["double_counted_courses"],
        "allocation_notes": alloc["notes"],
        "manual_review_courses": manual_review_sem,
        "timeline": timeline_sem,
        "projected_progress": projected_progress_sem,
        "projected_timeline": projected_timeline_sem,
        "projection_note": _PROJECTION_NOTE,
    }
