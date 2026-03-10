"""
Recommendation invariants that should hold across live program data.
"""

from __future__ import annotations

import re
import pytest

from dead_end_utils import PlanCase, seed_from_simulation, simulate_terms
import server
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
    student_stage: str | None = None,
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
        student_stage=student_stage,
    )


def _unsatisfied_bucket_count(progress: dict) -> int:
    return sum(1 for entry in progress.values() if not entry.get("satisfied", True))


def _course_number(course_code: str) -> int:
    match = re.search(r"\b(\d{4})\b", str(course_code or ""))
    return int(match.group(1)) if match else 0


def test_business_foundation_prereqs_do_not_drift_into_late_semesters(client):
    data = post_recommend(client, {
        "declared_majors": ["BUAN_MAJOR", "INSY_MAJOR"],
        "completed_courses": "",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 8,
        "max_recommendations": 6,
    })

    first_seen: dict[str, int] = {}
    for idx, semester in enumerate(data.get("semesters", []), start=1):
        codes = [rec.get("course_code") for rec in semester.get("recommendations", [])]
        for code in codes:
            if code and code not in first_seen:
                first_seen[code] = idx
        assert not ({"MATH 1400", "MATH 1450"} <= set(codes)), (
            f"MATH 1400 and MATH 1450 should not be recommended together: {semester.get('target_semester')} {codes}"
        )

    assert first_seen.get("MATH 1200", 99) <= 3, (
        f"Precalculus drifted too late for BUAN+INSY: first seen in semester {first_seen.get('MATH 1200')}"
    )
    assert first_seen.get("LEAD 1050", 99) <= 3, (
        f"LEAD 1050 drifted too late for BUAN+INSY: first seen in semester {first_seen.get('LEAD 1050')}"
    )
    if "LEAD 2000" in first_seen:
        assert first_seen["LEAD 1050"] < first_seen["LEAD 2000"]


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

    advanced_backfill = [
        (
            rec["course_code"],
            rec.get("tier"),
            rec.get("fills_buckets", []),
        )
        for rec in data.get("recommendations", [])
        if (rec.get("tier") or 0) >= 3 and _course_number(rec.get("course_code")) >= 3000
    ]
    assert not advanced_backfill, (
        f"{major_id} returned advanced tier-3+ backfill too early for a freshman: {advanced_backfill}"
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


def test_discovery_theme_recommendations_do_not_advertise_only_satisfied_buckets(client):
    data = post_recommend(client, {
        "declared_majors": ["BECO_MAJOR", "HURE_MAJOR"],
        "discovery_theme": "MCC_DISC_CMI",
        "completed_courses": (
            "ENGL 1001, SOCI 1001, ECON 1001, BUAD 1000, ECON 1103, "
            "BUAD 1001, ACCO 1030, ACCO 1031, MATH 1400, LEAD 1050"
        ),
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 6,
        "max_recommendations": 6,
    })

    offenders = []
    for semester in data.get("semesters", []):
        satisfied_keys = {
            bucket_id
            for bucket_id, entry in semester.get("progress", {}).items()
            if entry.get("satisfied", False)
        }
        for rec in semester.get("recommendations", []):
            fills = [bucket_id for bucket_id in rec.get("fills_buckets", []) if bucket_id]
            if fills and set(fills).issubset(satisfied_keys):
                offenders.append((semester.get("target_semester"), rec["course_code"], fills))

    assert not offenders, (
        "Discovery-theme recommendations should report the unmet bucket(s) they actually "
        f"advance, not only already-satisfied buckets: {offenders}"
    )


def test_discovery_theme_recommendations_only_use_one_writ_tagged_mcc_course(client):
    data = post_recommend(client, {
        "declared_majors": ["BECO_MAJOR", "HURE_MAJOR"],
        "discovery_theme": "MCC_DISC_CMI",
        "completed_courses": "ENGL 1001, SOCI 1001",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 3,
        "max_recommendations": 6,
    })

    writ_codes = {
        str(row["course_code"]).strip()
        for _, row in server._data["course_bucket_map_df"].iterrows()
        if str(row.get("bucket_id", "")).strip() == "MCC::MCC_WRIT"
    }
    offenders = []
    for semester in data.get("semesters", []):
        for rec in semester.get("recommendations", []):
            code = str(rec.get("course_code", "") or "").strip()
            fills = [str(bucket_id or "").strip() for bucket_id in rec.get("fills_buckets", [])]
            if not code or code not in writ_codes:
                continue
            if fills and all(
                bucket_id == "MCC::MCC_WRIT" or bucket_id.startswith("MCC::MCC_DISC_")
                for bucket_id in fills
            ):
                offenders.append((semester.get("target_semester"), code, fills))

    assert len(offenders) <= 1, (
        "Discovery-theme plans should not recommend multiple MCC-only WRIT-tagged courses "
        f"across the projected history: {offenders}"
    )


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
