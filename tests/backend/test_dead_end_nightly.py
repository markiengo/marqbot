"""
Nightly triple-combo dead-end sweep with randomized student profiles.

Covers all valid triple program combinations (majors + tracks) with
8 random student profiles per combo (2 per standing level).

Seed is date-based for daily reproducibility:
- Same day = same profiles = reproducible failures
- Next day = new seed = fresh coverage
- Override with NIGHTLY_SEED env var to replay a specific day

Run with: pytest -m nightly
"""

import os
import random
from datetime import date

import pytest

from dead_end_utils import (
    PlanCase,
    classify_dead_end,
    format_failure,
    rerun_case_with_debug,
    simulate_terms,
)
from helpers import build_triple_cases, generate_random_profiles
from conftest import get_nightly_collector

pytestmark = pytest.mark.nightly

# Date-based seed: reproducible within a day, fresh daily
SEED = int(os.environ.get("NIGHTLY_SEED", date.today().strftime("%Y%m%d")))


# ── Course universe cache ──────────────────────────────────────────────────


def _get_course_universe(case: PlanCase) -> list[str]:
    """Get the course universe for a program selection."""
    try:
        from dead_end_utils import resolve_effective_plan
        effective_data, _, _, _, _, _ = resolve_effective_plan(case)
        course_map = effective_data.get("course_bucket_map_df")
        if course_map is not None and not course_map.empty:
            mapped = set(course_map["course_code"].astype(str).tolist())
        else:
            mapped = set()

        prereq_map = effective_data.get("prereq_map", {})
        extended = set(mapped)
        for cc in mapped:
            info = prereq_map.get(cc, {})
            for clause in info.get("clauses", []):
                if isinstance(clause, str):
                    extended.add(clause)
                elif isinstance(clause, list):
                    extended.update(clause)

        return sorted(extended)
    except (ValueError, Exception):
        return []


# ── Collect all nightly cases ──────────────────────────────────────────────


def _collect_nightly_cases():
    triples = build_triple_cases()
    rng = random.Random(SEED)
    all_cases = []

    for label, declared_majors, track_ids, declared_minors in triples:
        base = PlanCase(
            declared_majors=declared_majors,
            track_ids=track_ids,
            declared_minors=declared_minors,
            completed_courses=[],
            in_progress_courses=[],
            target_semester_primary="Fall 2026",
        )

        universe = _get_course_universe(base)
        profiles = generate_random_profiles(
            declared_majors, track_ids, declared_minors,
            rng, universe, start_term="Fall 2026",
        )

        for standing_label, case in profiles:
            all_cases.append((f"{label}/{standing_label}", case, standing_label.split("-")[0]))

    return all_cases


_NIGHTLY_CASES = None


def _get_nightly_cases():
    global _NIGHTLY_CASES
    if _NIGHTLY_CASES is None:
        _NIGHTLY_CASES = _collect_nightly_cases()
    return _NIGHTLY_CASES


def _case_ids():
    return [label for label, _, _ in _get_nightly_cases()]


def _case_params():
    return [(label, case, standing) for label, case, standing in _get_nightly_cases()]


# ── Tests ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "label,case,standing",
    _case_params(),
    ids=_case_ids(),
)
def test_nightly_no_dead_end(label, case, standing):
    """Assert no 2-term dead-end for this triple combo + random profile."""
    collector = get_nightly_collector()
    collector.total_tests += 1
    collector.seed = SEED

    try:
        semesters = simulate_terms(case, num_terms=9)
    except ValueError:
        return

    check = classify_dead_end(semesters, case)
    if not check.failed:
        return

    collector.record_failure(label, check, standing=standing)

    debug_sem = rerun_case_with_debug(case, check.semester_index)
    msg = format_failure(check, debug_sem)
    raise AssertionError(msg)
