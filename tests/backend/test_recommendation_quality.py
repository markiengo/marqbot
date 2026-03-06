"""
Recommendation invariants that should hold across live program data.
"""

from __future__ import annotations

import pytest

from dead_end_utils import PlanCase, seed_from_simulation, simulate_terms
from server import app
from helpers import (
    declared_majors_for_major,
    payload_for_major,
    post_recommend,
    program_rows,
)


TIER_ORDER_MAJOR_CANDIDATES = [
    "FIN_MAJOR",
    "ACCO_MAJOR",
    "MARK_MAJOR",
    "BADM_MAJOR",
    "BUAN_MAJOR",
    "REAL_MAJOR",
]
SIMULATION_MAJOR_CANDIDATES = [
    "FIN_MAJOR",
    "ACCO_MAJOR",
    "MARK_MAJOR",
    "BADM_MAJOR",
    "REAL_MAJOR",
]
EXCLUSION_MAJOR_CANDIDATES = ["FIN_MAJOR", "ACCO_MAJOR", "REAL_MAJOR"]
CAP_MAJOR_CANDIDATES = ["FIN_MAJOR", "BUAN_MAJOR", "REAL_MAJOR"]
NONREDUNDANT_FILL_MAJOR_CANDIDATES = ["FIN_MAJOR", "ACCO_MAJOR", "REAL_MAJOR"]
SUMMER_PROGRESS_MAJOR_CANDIDATES = ["FIN_MAJOR", "BUAN_MAJOR", "REAL_MAJOR"]
STANDING_SEED_PROBES = (
    (0, 1),
    (2, 2),
    (4, 3),
    (7, 4),
)


@pytest.fixture(scope="module")
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _active_representatives(candidates: list[str]) -> list[str]:
    rows = program_rows()
    return [major_id for major_id in candidates if major_id in rows and rows[major_id].get("kind") == "major"]


def _plan_case_for_major(
    major_id: str,
    *,
    max_recommendations: int = 6,
    target_semester_primary: str = "Fall 2026",
    include_summer: bool = False,
) -> PlanCase:
    return PlanCase(
        declared_majors=declared_majors_for_major(major_id),
        track_ids=[],
        declared_minors=[],
        completed_courses=[],
        in_progress_courses=[],
        target_semester_primary=target_semester_primary,
        include_summer=include_summer,
        max_recommendations=max_recommendations,
    )


def _unsatisfied_bucket_count(progress: dict) -> int:
    return sum(1 for entry in progress.values() if not entry.get("satisfied", True))


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(TIER_ORDER_MAJOR_CANDIDATES),
    ids=_active_representatives(TIER_ORDER_MAJOR_CANDIDATES),
)
def test_freshman_recommendations_do_not_skip_tier_one_work(client, major_id):
    data = post_recommend(client, payload_for_major(major_id, debug=True))

    unsatisfied_tier_one = [
        bucket_id
        for bucket_id, entry in data.get("current_progress", {}).items()
        if not entry.get("satisfied", True) and entry.get("recommendation_tier") == 1
    ]
    assert unsatisfied_tier_one, f"Expected unsatisfied tier-1 buckets for freshman {major_id}"

    elevated = [
        (rec["course_code"], rec.get("tier"), rec.get("fills_buckets", []))
        for rec in data.get("recommendations", [])
        if (rec.get("tier") or 0) >= 3
    ]
    assert not elevated, (
        f"{major_id} returned tier-3+ recommendations before tier-1 work was cleared: {elevated}"
    )


@pytest.mark.parametrize("seed_semesters,expected_standing", STANDING_SEED_PROBES)
def test_standing_gate_blocks_courses_above_current_standing(client, seed_semesters, expected_standing):
    standing_major = _active_representatives(["FIN_MAJOR"])[0]
    base_case = _plan_case_for_major(standing_major)
    completed_courses = seed_from_simulation(base_case, seed_semesters) if seed_semesters else []

    data = post_recommend(
        client,
        payload_for_major(standing_major, completed_courses=completed_courses),
    )

    assert data.get("standing") == expected_standing, (
        f"Expected standing {expected_standing} from seed {seed_semesters}, got {data.get('standing')}"
    )
    blocked = [
        (rec["course_code"], rec.get("min_standing"), expected_standing)
        for rec in data.get("recommendations", [])
        if (rec.get("min_standing") or 0) > expected_standing
    ]
    assert not blocked, f"Standing gate leaked higher-standing courses: {blocked}"


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(SIMULATION_MAJOR_CANDIDATES),
    ids=_active_representatives(SIMULATION_MAJOR_CANDIDATES),
)
def test_multi_semester_runs_do_not_repeat_courses(major_id):
    semesters = simulate_terms(_plan_case_for_major(major_id), num_terms=3)

    seen = set()
    duplicates = []
    for semester in semesters:
        for rec in semester.get("recommendations", []):
            code = rec.get("course_code")
            if code in seen:
                duplicates.append(code)
            seen.add(code)

    assert not duplicates, f"{major_id} repeated courses across semesters: {duplicates}"


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(SIMULATION_MAJOR_CANDIDATES),
    ids=_active_representatives(SIMULATION_MAJOR_CANDIDATES),
)
def test_unsatisfied_bucket_count_is_nonincreasing(major_id):
    semesters = simulate_terms(_plan_case_for_major(major_id), num_terms=6)
    counts = [_unsatisfied_bucket_count(semester.get("progress", {})) for semester in semesters]

    regressions = [
        (earlier, later)
        for earlier, later in zip(counts, counts[1:])
        if later > earlier
    ]
    assert not regressions, f"{major_id} unsatisfied buckets increased across semesters: {counts}"


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(EXCLUSION_MAJOR_CANDIDATES),
    ids=_active_representatives(EXCLUSION_MAJOR_CANDIDATES),
)
def test_completed_and_in_progress_courses_are_excluded(client, major_id):
    seeded_courses = seed_from_simulation(_plan_case_for_major(major_id), 2)
    completed_courses = seeded_courses[:3]
    in_progress_courses = seeded_courses[3:6]
    assert completed_courses or in_progress_courses, f"Seed generation produced no courses for {major_id}"

    data = post_recommend(
        client,
        payload_for_major(
            major_id,
            completed_courses=completed_courses,
            in_progress_courses=in_progress_courses,
        ),
    )

    overlaps = sorted(
        {rec["course_code"] for rec in data.get("recommendations", [])}
        & set(completed_courses + in_progress_courses)
    )
    assert not overlaps, f"{major_id} re-recommended completed or in-progress courses: {overlaps}"


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(CAP_MAJOR_CANDIDATES),
    ids=_active_representatives(CAP_MAJOR_CANDIDATES),
)
def test_max_recommendations_cap_is_respected(client, major_id):
    data = post_recommend(
        client,
        payload_for_major(
            major_id,
            target_semester_count=3,
            max_recommendations=4,
        ),
    )

    over_limit = {
        semester.get("target_semester", f"semester-{idx + 1}"): len(semester.get("recommendations", []))
        for idx, semester in enumerate(data.get("semesters", []))
        if len(semester.get("recommendations", [])) > 4
    }
    assert not over_limit, f"{major_id} exceeded max_recommendations cap: {over_limit}"


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(NONREDUNDANT_FILL_MAJOR_CANDIDATES),
    ids=_active_representatives(NONREDUNDANT_FILL_MAJOR_CANDIDATES),
)
def test_recommendations_do_not_only_fill_already_satisfied_buckets(major_id):
    semesters = simulate_terms(_plan_case_for_major(major_id), num_terms=3)
    offenders = []

    for semester in semesters:
        satisfied_keys = {
            bucket_id
            for bucket_id, entry in semester.get("progress", {}).items()
            if entry.get("satisfied", False)
        }
        for rec in semester.get("recommendations", []):
            fills = [bucket_id for bucket_id in rec.get("fills_buckets", []) if bucket_id]
            if fills and set(fills).issubset(satisfied_keys):
                offenders.append((semester.get("target_semester"), rec["course_code"], fills))

    assert not offenders, f"Recommendations filled only satisfied buckets: {offenders}"


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(SIMULATION_MAJOR_CANDIDATES),
    ids=_active_representatives(SIMULATION_MAJOR_CANDIDATES),
)
def test_multi_semester_response_preserves_selected_program_ids(client, major_id):
    data = post_recommend(
        client,
        payload_for_major(
            major_id,
            target_semester_count=3,
            max_recommendations=4,
        ),
    )

    assert data["selection_context"]["selected_program_ids"] == declared_majors_for_major(major_id)
    assert len(data["selection_context"]["selected_program_ids"]) == len(
        data["selection_context"]["selected_program_labels"]
    )


@pytest.mark.parametrize(
    "major_id",
    _active_representatives(SUMMER_PROGRESS_MAJOR_CANDIDATES),
    ids=_active_representatives(SUMMER_PROGRESS_MAJOR_CANDIDATES),
)
def test_include_summer_runs_keep_unsatisfied_bucket_count_nonincreasing(major_id):
    semesters = simulate_terms(
        _plan_case_for_major(
            major_id,
            target_semester_primary="Spring 2026",
            include_summer=True,
        ),
        num_terms=5,
    )
    labels = [semester.get("target_semester", "") for semester in semesters]
    assert any("Summer" in label for label in labels), f"Expected a summer term in labels: {labels}"

    counts = [_unsatisfied_bucket_count(semester.get("progress", {})) for semester in semesters]
    regressions = [
        (earlier, later)
        for earlier, later in zip(counts, counts[1:])
        if later > earlier
    ]
    assert not regressions, (
        f"{major_id} unsatisfied buckets increased across a summer-inclusive run: {counts}"
    )
