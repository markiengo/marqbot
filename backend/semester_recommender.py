import re
import pandas as pd

from requirements import TRACK_ID, BLOCKING_WARNING_THRESHOLD
from allocator import allocate_courses
from unlocks import get_direct_unlocks, get_blocking_warnings
from timeline import estimate_timeline
from eligibility import get_eligible_courses, parse_term
from llm_recommender import call_openai, build_deterministic_recommendations


SEM_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)


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


def run_recommendation_semester(
    completed: list[str],
    in_progress: list[str],
    target_semester_label: str,
    data: dict,
    max_recs: int,
    reverse_map: dict,
    use_openai: bool,
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
    )
    manual_review_sem = [c["course_code"] for c in eligible_sem if c.get("manual_review")]
    non_manual_sem = [c for c in eligible_sem if not c.get("manual_review")]
    eligible_count_sem = len(non_manual_sem)

    progress_sem = build_progress_output(alloc, data["course_bucket_map_df"])
    timeline_sem = estimate_timeline(alloc["remaining"])
    if isinstance(timeline_sem, dict):
        timeline_sem["disclaimer"] = (
            "Estimated time to complete Finance major requirements only. "
            "Assumes about 3 major courses per term and typical course availability."
        )

    if not non_manual_sem:
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
        }

    core_remaining_sem = alloc["remaining"].get("CORE", {}).get("remaining_courses", [])
    core_prereq_blockers_sem: set[str] = set()
    for core_code in core_remaining_sem:
        core_prereq_blockers_sem |= _prereq_courses(data["prereq_map"].get(core_code, {"type": "none"}))

    ranked_sem = sorted(
        non_manual_sem,
        key=lambda c: (
            0 if c["course_code"] in core_prereq_blockers_sem else 1,
            c.get("prereq_level", 0),
            c.get("primary_bucket_priority", 99),
            -c.get("multi_bucket_score", 0),
            c["course_code"],
        ),
    )
    selected_sem = ranked_sem[:max_recs]
    for cand in selected_sem:
        cand["unlocks"] = get_direct_unlocks(cand["course_code"], reverse_map, limit=3)

    if use_openai:
        recommendations_sem = call_openai(
            selected_sem,
            completed,
            in_progress,
            target_semester_label,
            len(selected_sem),
        )
    else:
        recommendations_sem = build_deterministic_recommendations(selected_sem, len(selected_sem))

    fin_choose_2_courses = data["course_bucket_map_df"][
        (data["course_bucket_map_df"]["track_id"] == TRACK_ID)
        & (data["course_bucket_map_df"]["bucket_id"] == "FIN_CHOOSE_2")
    ]["course_code"].tolist()
    blocking_sem = get_blocking_warnings(
        core_remaining_sem,
        reverse_map,
        fin_choose_2_courses,
        completed,
        in_progress,
        threshold=BLOCKING_WARNING_THRESHOLD,
    )

    in_progress_note_sem = None
    if any("in progress" in (r.get("prereq_check") or "") for r in recommendations_sem):
        in_progress_note_sem = "Prerequisites satisfied via in-progress courses assume successful completion."

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
    }
