"""
Shared dead-end detection helpers for the dead-end prevention test suites.

Provides:
- PlanCase / DeadEndCheck dataclasses
- resolve_effective_plan() — mirrors /recommend preprocessing
- simulate_terms() — runs multi-semester simulation directly
- classify_dead_end() — 2-term strict dead-end classifier
- rerun_case_with_debug() — debug rerun on failure
- format_failure() — human-readable failure output
"""

from __future__ import annotations

import textwrap
from dataclasses import dataclass, field

import pandas as pd

import server
from semester_recommender import (
    default_followup_semester,
    default_followup_semester_with_summer,
    run_recommendation_semester,
    _credits_to_standing,
)
from unlocks import build_reverse_prereq_map, compute_chain_depths
from validators import expand_completed_with_prereqs_with_provenance, expand_in_progress_with_prereqs


# ── Dataclasses ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class PlanCase:
    declared_majors: list[str]
    track_ids: list[str]
    declared_minors: list[str]
    completed_courses: list[str]
    in_progress_courses: list[str]
    target_semester_primary: str
    include_summer: bool = False
    max_recommendations: int = 6


@dataclass
class DeadEndCheck:
    failed: bool
    failure_kind: str | None  # SELECTION_GAP | MANUAL_REVIEW_BLOCK | ELIGIBILITY_GAP
    semester_index: int | None
    semester_label: str | None
    unsatisfied_buckets: list[str]
    manual_review_courses: list[str]
    eligible_count: int
    reproduction_case: PlanCase


# ── Data access ─────────────────────────────────────────────────────────────


def _get_data():
    """Return loaded runtime data from server module (loaded at import time)."""
    return server._data


def _get_reverse_map():
    return server._reverse_map


def _get_chain_depths():
    return server._chain_depths


# ── Resolve effective plan ──────────────────────────────────────────────────


def resolve_effective_plan(case: PlanCase):
    """
    Mirror /recommend preprocessing exactly.

    Returns:
        (effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup)
    """
    data = _get_data()

    body = {
        "declared_majors": case.declared_majors,
        "declared_minors": case.declared_minors,
        "track_ids": case.track_ids,
        "target_semester": case.target_semester_primary,
        "include_summer": case.include_summer,
        "max_recommendations": case.max_recommendations,
    }

    selection, err = server._resolve_program_selection(body, data)
    if err is not None:
        raise ValueError(
            f"Program selection failed: {err[0]}"
        )

    effective_data = selection["effective_data"]
    effective_track_id = selection["effective_track_id"]
    catalog_codes = data["catalog_codes"]

    from normalizer import normalize_input
    norm = normalize_input(",".join(case.completed_courses), catalog_codes)
    completed = norm["valid"]

    norm_ip = normalize_input(",".join(case.in_progress_courses), catalog_codes)
    in_progress = norm_ip["valid"]

    completed, _ = expand_completed_with_prereqs_with_provenance(
        completed, effective_data["prereq_map"],
    )
    in_progress, assumption_rows = expand_in_progress_with_prereqs(
        in_progress, completed, effective_data["prereq_map"],
    )
    completed, in_progress = server._promote_inferred_in_progress_prereqs_to_completed(
        completed, in_progress, assumption_rows,
    )

    # Build credits lookup matching server.py exactly
    cdf = effective_data["courses_df"]
    credits_lookup: dict[str, int] = dict(zip(
        cdf["course_code"].astype(str),
        cdf["credits"].fillna(3).apply(lambda x: max(0, int(x)) if pd.notna(x) else 3),
    ))
    running_credits = (
        sum(credits_lookup.get(c, 3) for c in completed)
        + sum(credits_lookup.get(c, 3) for c in in_progress)
    )

    return effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup


# ── Multi-term simulation ──────────────────────────────────────────────────


def simulate_terms(case: PlanCase, num_terms: int = 9) -> list[dict]:
    """
    Run the same semester progression logic as /recommend, directly.

    Simulates num_terms semesters (default 9 so term 8 can be checked against 9).
    Returns list of semester payloads from run_recommendation_semester.
    """
    effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup = (
        resolve_effective_plan(case)
    )
    reverse_map = _get_reverse_map()
    chain_depths = _get_chain_depths()

    followup_fn = default_followup_semester_with_summer if case.include_summer else default_followup_semester

    # Build semester labels
    semester_labels = [case.target_semester_primary]
    while len(semester_labels) < num_terms:
        semester_labels.append(followup_fn(semester_labels[-1]))

    # Filter summer if not included (mirrors server.py)
    if not case.include_summer:
        filtered = [l for l in semester_labels if "summer" not in l.lower()]
        probe = filtered[-1] if filtered else semester_labels[-1]
        while len(filtered) < num_terms:
            next_label = default_followup_semester(probe)
            filtered.append(next_label)
            probe = next_label
        semester_labels = filtered[:num_terms]

    semesters = []
    completed_cursor = list(dict.fromkeys(completed + in_progress))

    for idx, semester_label in enumerate(semester_labels):
        current_standing = _credits_to_standing(running_credits)

        if idx == 0:
            sem = run_recommendation_semester(
                completed,
                in_progress,
                semester_label,
                effective_data,
                case.max_recommendations,
                reverse_map,
                track_id=effective_track_id,
                debug=False,
                current_standing=current_standing,
                chain_depths=chain_depths,
            )
        else:
            sem = run_recommendation_semester(
                completed_cursor,
                [],
                semester_label,
                effective_data,
                case.max_recommendations,
                reverse_map,
                track_id=effective_track_id,
                debug=False,
                current_standing=current_standing,
                chain_depths=chain_depths,
            )

        semesters.append(sem)

        # Advance state: add recommended courses to completed, accumulate credits
        for rec in sem.get("recommendations", []):
            cc = rec.get("course_code", "")
            running_credits += credits_lookup.get(cc, 3)

        completed_cursor = list(dict.fromkeys(
            completed_cursor + [
                r["course_code"]
                for r in sem.get("recommendations", [])
                if r.get("course_code")
            ]
        ))

    return semesters


# ── Dead-end classification ────────────────────────────────────────────────


def unsatisfied_active_buckets(progress: dict) -> list[str]:
    """Return bucket IDs where satisfied is False."""
    return [
        bucket_id for bucket_id, entry in progress.items()
        if not entry.get("satisfied", True)
    ]


def classify_dead_end(semesters: list[dict], case: PlanCase) -> DeadEndCheck:
    """
    Classify a simulation as healthy or dead-ended.

    Rules:
    - SELECTION_GAP: eligible_count > 0 but recommendations empty (immediate fail)
    - 2-term dead-end: empty semester with unsatisfied buckets, AND next semester also empty
      with unsatisfied buckets
      - MANUAL_REVIEW_BLOCK: manual_review_courses non-empty in the failing term
      - ELIGIBILITY_GAP: otherwise
    """
    ok = DeadEndCheck(
        failed=False,
        failure_kind=None,
        semester_index=None,
        semester_label=None,
        unsatisfied_buckets=[],
        manual_review_courses=[],
        eligible_count=0,
        reproduction_case=case,
    )

    for i, sem in enumerate(semesters):
        recs = sem.get("recommendations", [])
        eligible = sem.get("eligible_count", 0)
        progress = sem.get("progress", {})
        unsat = unsatisfied_active_buckets(progress)
        manual = sem.get("manual_review_courses", [])

        # Has recommendations — healthy
        if recs:
            continue

        # No recs but all buckets satisfied — graduation, healthy
        if not unsat:
            continue

        # eligible_count > 0 but no recs — selection/ranking bug
        if eligible > 0:
            return DeadEndCheck(
                failed=True,
                failure_kind="SELECTION_GAP",
                semester_index=i,
                semester_label=sem.get("target_semester", "?"),
                unsatisfied_buckets=unsat,
                manual_review_courses=manual,
                eligible_count=eligible,
                reproduction_case=case,
            )

        # No recs, unsatisfied buckets, eligible_count == 0 — check next term
        if i + 1 < len(semesters):
            next_sem = semesters[i + 1]
            next_recs = next_sem.get("recommendations", [])
            next_progress = next_sem.get("progress", {})
            next_unsat = unsatisfied_active_buckets(next_progress)

            # Next term recovers
            if next_recs or not next_unsat:
                continue

            # 2-term dead-end confirmed
            kind = "MANUAL_REVIEW_BLOCK" if manual else "ELIGIBILITY_GAP"
            return DeadEndCheck(
                failed=True,
                failure_kind=kind,
                semester_index=i,
                semester_label=sem.get("target_semester", "?"),
                unsatisfied_buckets=unsat,
                manual_review_courses=manual,
                eligible_count=eligible,
                reproduction_case=case,
            )

        # Last term, no next to check — single empty term at end is not a 2-term failure
        continue

    return ok


# ── Debug rerun ─────────────────────────────────────────────────────────────


def rerun_case_with_debug(case: PlanCase, failing_semester_index: int) -> dict | None:
    """
    Rerun simulation up to failing semester with debug=True.
    Returns the debug trace for the failing semester only.
    """
    try:
        effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup = (
            resolve_effective_plan(case)
        )
    except ValueError:
        return None

    reverse_map = _get_reverse_map()
    chain_depths = _get_chain_depths()
    followup_fn = default_followup_semester_with_summer if case.include_summer else default_followup_semester

    semester_labels = [case.target_semester_primary]
    while len(semester_labels) <= failing_semester_index:
        semester_labels.append(followup_fn(semester_labels[-1]))

    if not case.include_summer:
        filtered = [l for l in semester_labels if "summer" not in l.lower()]
        probe = filtered[-1] if filtered else semester_labels[-1]
        while len(filtered) <= failing_semester_index:
            next_label = default_followup_semester(probe)
            filtered.append(next_label)
            probe = next_label
        semester_labels = filtered[:failing_semester_index + 1]

    completed_cursor = list(dict.fromkeys(completed + in_progress))

    for idx, semester_label in enumerate(semester_labels):
        current_standing = _credits_to_standing(running_credits)
        is_debug = idx == failing_semester_index

        if idx == 0:
            sem = run_recommendation_semester(
                completed, in_progress, semester_label,
                effective_data, case.max_recommendations, reverse_map,
                track_id=effective_track_id, debug=is_debug, debug_limit=30,
                current_standing=current_standing, chain_depths=chain_depths,
            )
        else:
            sem = run_recommendation_semester(
                completed_cursor, [], semester_label,
                effective_data, case.max_recommendations, reverse_map,
                track_id=effective_track_id, debug=is_debug, debug_limit=30,
                current_standing=current_standing, chain_depths=chain_depths,
            )

        if is_debug:
            return sem

        for rec in sem.get("recommendations", []):
            running_credits += credits_lookup.get(rec.get("course_code", ""), 3)
        completed_cursor = list(dict.fromkeys(
            completed_cursor + [
                r["course_code"]
                for r in sem.get("recommendations", [])
                if r.get("course_code")
            ]
        ))

    return None


# ── Failure formatting ──────────────────────────────────────────────────────


def format_failure(check: DeadEndCheck, debug_sem: dict | None = None) -> str:
    """Build a human-readable failure message for assertion output."""
    c = check.reproduction_case
    lines = [
        f"DEAD-END DETECTED: {check.failure_kind}",
        f"  Semester: #{check.semester_index} ({check.semester_label})",
        f"  Selection:",
        f"    declared_majors: {c.declared_majors}",
        f"    track_ids: {c.track_ids}",
        f"    declared_minors: {c.declared_minors}",
        f"    start_term: {c.target_semester_primary}",
        f"    include_summer: {c.include_summer}",
        f"  Initial completed: {c.completed_courses[:10]}{'...' if len(c.completed_courses) > 10 else ''}",
        f"  Initial in_progress: {c.in_progress_courses}",
        f"  Unsatisfied buckets: {check.unsatisfied_buckets}",
        f"  Manual-review courses: {check.manual_review_courses}",
        f"  Eligible count: {check.eligible_count}",
    ]

    if debug_sem:
        recs = debug_sem.get("recommendations", [])
        lines.append(f"  Recommendations returned: {[r.get('course_code') for r in recs]}")

        debug_trace = debug_sem.get("debug", [])
        if debug_trace:
            lines.append("  Debug trace (top 10):")
            for entry in debug_trace[:10]:
                skip = entry.get("skip_reason", "")
                lines.append(
                    f"    {entry.get('rank','-')}. {entry.get('course_code','?')} "
                    f"sel={entry.get('selected', False)} skip={skip or 'N/A'} "
                    f"tier={entry.get('tier','-')} buckets={entry.get('fills_buckets',[])}"
                )

    return "\n".join(lines)


# ── Seed-based state generation helpers ─────────────────────────────────────


def seed_from_simulation(case: PlanCase, num_semesters_to_take: int) -> list[str]:
    """
    Simulate from empty and take the first N semesters of recommendations
    as a completed course set. Used to generate realistic mid-path states.
    """
    empty_case = PlanCase(
        declared_majors=case.declared_majors,
        track_ids=case.track_ids,
        declared_minors=case.declared_minors,
        completed_courses=[],
        in_progress_courses=[],
        target_semester_primary=case.target_semester_primary,
        include_summer=case.include_summer,
        max_recommendations=case.max_recommendations,
    )
    try:
        semesters = simulate_terms(empty_case, num_terms=num_semesters_to_take + 1)
    except (ValueError, Exception):
        return []

    completed = []
    for sem in semesters[:num_semesters_to_take]:
        for rec in sem.get("recommendations", []):
            cc = rec.get("course_code", "")
            if cc and cc not in completed:
                completed.append(cc)
    return completed


def run_case_and_assert(case: PlanCase, num_terms: int = 9):
    """
    Simulate terms and assert no dead-end. On failure, rerun with debug
    and produce a detailed assertion message.
    """
    try:
        semesters = simulate_terms(case, num_terms=num_terms)
    except ValueError as exc:
        # Program selection failure — skip, not a dead-end
        return

    check = classify_dead_end(semesters, case)
    if not check.failed:
        return

    debug_sem = rerun_case_with_debug(case, check.semester_index)
    msg = format_failure(check, debug_sem)
    raise AssertionError(msg)
