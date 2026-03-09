"""
Fast deterministic dead-end regression suite for PR gating.

Covers:
- Every active single major (empty state) — 12 cases
- Every active single track (empty state) — 8 cases
- Curated high-risk combos with state variants — ~20 cases
- Smoke tests (minors, multi-semester, include_summer) — ~16 cases

Total: ~56 fixed-input regression tests. No randomness.
Target runtime: under 2 minutes on a normal dev machine.
"""

import pytest

from server import app
from dead_end_utils import (
    PlanCase,
    run_case_and_assert,
    assert_graduates_by,
    seed_from_simulation,
)
from helpers import (
    CANONICAL_PRIMARY,
    active_programs,
    active_program_ids,
    active_representatives,
    requires_primary,
    get_parent_major,
    declared_majors_for_major,
    declared_majors_for_track,
    primary_major_id,
    recommend_payload,
    post_recommend,
    assert_recommendation_shape,
    assert_selection_context,
)


# ── Single-program regression cases (empty state only) ─────────────────────


def _single_major_cases():
    majors, _, _ = active_programs()
    cases = []
    for mid in majors:
        declared = [mid]
        if requires_primary(mid):
            declared = [CANONICAL_PRIMARY, mid]
        cases.append((
            f"major-{mid}",
            PlanCase(
                declared_majors=declared,
                track_ids=[],
                declared_minors=[],
                completed_courses=[],
                in_progress_courses=[],
                target_semester_primary="Fall 2026",
            ),
        ))
    return cases


def _single_track_cases():
    _, tracks, _ = active_programs()
    # Exclude MCC_DISC tracks (parent inactive)
    tracks = [t for t in tracks if not t.startswith("MCC_DISC_")]
    cases = []
    for tid in tracks:
        parent = get_parent_major(tid)
        if parent:
            majors = [parent]
            if requires_primary(parent):
                majors = [CANONICAL_PRIMARY, parent]
        else:
            majors = []
        cases.append((
            f"track-{tid}",
            PlanCase(
                declared_majors=majors,
                track_ids=[tid],
                declared_minors=[],
                completed_courses=[],
                in_progress_courses=[],
                target_semester_primary="Fall 2026",
            ),
        ))
    return cases


# ── Curated high-risk combos with state variants ──────────────────────────

CURATED_COMBOS = [
    ("combo-FIN+INSY", PlanCase(
        declared_majors=["FIN_MAJOR", "INSY_MAJOR"],
        track_ids=[], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-FIN+AIM", PlanCase(
        declared_majors=["FIN_MAJOR", "AIM_MAJOR"],
        track_ids=[], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-FIN+AIM+FINTECH", PlanCase(
        declared_majors=["FIN_MAJOR", "AIM_MAJOR"],
        track_ids=["AIM_FINTECH_TRACK"], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-FIN+CB_TRACK", PlanCase(
        declared_majors=["FIN_MAJOR"],
        track_ids=["CB_TRACK"], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-REAL+REAP", PlanCase(
        declared_majors=["REAL_MAJOR"],
        track_ids=["REAL_REAP_TRACK"], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
]


def _generate_state_variants(label: str, base_case: PlanCase):
    variants = [(f"{label}/empty", base_case)]

    foundation = seed_from_simulation(base_case, 1)
    if foundation:
        variants.append((
            f"{label}/foundation",
            PlanCase(
                declared_majors=base_case.declared_majors,
                track_ids=base_case.track_ids,
                declared_minors=base_case.declared_minors,
                completed_courses=foundation[:3],
                in_progress_courses=[],
                target_semester_primary=base_case.target_semester_primary,
                include_summer=base_case.include_summer,
                max_recommendations=base_case.max_recommendations,
            ),
        ))

    mid = seed_from_simulation(base_case, 2)
    if mid:
        variants.append((
            f"{label}/mid",
            PlanCase(
                declared_majors=base_case.declared_majors,
                track_ids=base_case.track_ids,
                declared_minors=base_case.declared_minors,
                completed_courses=mid,
                in_progress_courses=[],
                target_semester_primary=base_case.target_semester_primary,
                include_summer=base_case.include_summer,
                max_recommendations=base_case.max_recommendations,
            ),
        ))

    late = seed_from_simulation(base_case, 4)
    if late:
        variants.append((
            f"{label}/late",
            PlanCase(
                declared_majors=base_case.declared_majors,
                track_ids=base_case.track_ids,
                declared_minors=base_case.declared_minors,
                completed_courses=late,
                in_progress_courses=[],
                target_semester_primary=base_case.target_semester_primary,
                include_summer=base_case.include_summer,
                max_recommendations=base_case.max_recommendations,
            ),
        ))

    return variants


# ── Build parametrized dead-end cases ──────────────────────────────────────


def _collect_fast_cases():
    all_cases = []

    # Single programs — empty state only (no variants)
    all_cases.extend(_single_major_cases())
    all_cases.extend(_single_track_cases())

    # Curated combos — full state variants (known regressions)
    for label, base in CURATED_COMBOS:
        all_cases.extend(_generate_state_variants(label, base))

    return all_cases


_FAST_CASES = _collect_fast_cases()


# ── Dead-end tests ─────────────────────────────────────────────────────────


_KNOWN_XFAIL = {
    "combo-REAL+REAP/mid": "REAP 3-course sequential chain (4210→4220→4230) needs summer terms",
    "combo-REAL+REAP/late": "REAP 3-course sequential chain (4210→4220→4230) needs summer terms",
}


@pytest.mark.parametrize(
    "label,case",
    [(label, case) for label, case in _FAST_CASES],
    ids=[label for label, _ in _FAST_CASES],
)
def test_no_dead_end(label, case):
    """Assert no 2-term dead-end for this program selection and starting state."""
    if label in _KNOWN_XFAIL:
        pytest.xfail(_KNOWN_XFAIL[label])
    run_case_and_assert(case, num_terms=9)


# ── Smoke tests ────────────────────────────────────────────────────────────

REPRESENTATIVE_MAJOR_CANDIDATES = [
    "FIN_MAJOR",
    "ACCO_MAJOR",
    "BUAN_MAJOR",
    "REAL_MAJOR",
    "MARK_MAJOR",
]
REPRESENTATIVE_TRACK_CANDIDATES = [
    "CB_TRACK",
    "REAL_REAP_TRACK",
    "AIM_FINTECH_TRACK",
]


@pytest.fixture(scope="module")
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@pytest.mark.parametrize("minor_id", active_program_ids("minor"), ids=active_program_ids("minor"))
def test_smoke_minor(client, minor_id):
    data = post_recommend(
        client,
        recommend_payload(
            declared_majors=[primary_major_id()],
            declared_minors=[minor_id],
        ),
    )
    semesters = data.get("semesters", [])
    assert semesters, f"No semesters returned for minor {minor_id}"
    assert_recommendation_shape(semesters[0].get("recommendations", []))
    assert_selection_context(data, [primary_major_id(), minor_id])


@pytest.mark.parametrize(
    "major_id",
    active_representatives("major", REPRESENTATIVE_MAJOR_CANDIDATES, 4),
    ids=active_representatives("major", REPRESENTATIVE_MAJOR_CANDIDATES, 4),
)
def test_three_semester_smoke_major(client, major_id):
    data = post_recommend(
        client,
        recommend_payload(
            declared_majors=declared_majors_for_major(major_id),
            target_semester_count=3,
        ),
    )
    semesters = data.get("semesters", [])
    assert len(semesters) == 3, f"Expected 3 semesters for major {major_id}, got {len(semesters)}"
    for semester in semesters:
        assert_recommendation_shape(semester.get("recommendations", []))
    assert_selection_context(data, declared_majors_for_major(major_id))


@pytest.mark.parametrize(
    "track_id",
    active_representatives("track", REPRESENTATIVE_TRACK_CANDIDATES, 3),
    ids=active_representatives("track", REPRESENTATIVE_TRACK_CANDIDATES, 3),
)
def test_three_semester_smoke_track(client, track_id):
    dmajors = declared_majors_for_track(track_id)
    data = post_recommend(
        client,
        recommend_payload(
            declared_majors=dmajors,
            track_id=track_id,
            target_semester_count=3,
        ),
    )
    semesters = data.get("semesters", [])
    assert len(semesters) == 3, f"Expected 3 semesters for track {track_id}, got {len(semesters)}"
    for semester in semesters:
        assert_recommendation_shape(semester.get("recommendations", []))
    assert_selection_context(data, dmajors + [track_id])


def test_include_summer_smoke_preserves_summer_term_when_enabled(client):
    data = post_recommend(
        client,
        recommend_payload(
            declared_majors=[primary_major_id()],
            target_semester_primary="Spring 2026",
            target_semester_count=3,
            include_summer=True,
        ),
    )
    labels = [semester["target_semester"] for semester in data.get("semesters", [])]
    assert labels == ["Spring 2026", "Summer 2026", "Fall 2026"]
    assert_recommendation_shape(data["semesters"][0].get("recommendations", []))
    assert_selection_context(data, [primary_major_id()])


# ── Graduation-by-8 tests ─────────────────────────────────────────────────
# Every standalone major must graduate a fresh student within 8 semesters
# at 6 courses/semester. Catches data bugs (false restrictions, missing
# mappings) that silently block degree completion.


def _graduation_cases():
    """Build one PlanCase per active major (empty student, 8 semesters)."""
    majors, _, _ = active_programs()
    cases = []
    for mid in majors:
        declared = [mid]
        if requires_primary(mid):
            declared = [CANONICAL_PRIMARY, mid]
        cases.append((
            f"grad-{mid}",
            PlanCase(
                declared_majors=declared,
                track_ids=[],
                declared_minors=[],
                completed_courses=[],
                in_progress_courses=[],
                target_semester_primary="Fall 2024",
            ),
        ))
    return cases


_GRAD_CASES = _graduation_cases()


@pytest.mark.parametrize(
    "label,case",
    _GRAD_CASES,
    ids=[label for label, _ in _GRAD_CASES],
)
def test_graduates_by_semester_8(label, case):
    """A fresh student in this major must satisfy all buckets within 8 semesters."""
    assert_graduates_by(case, max_semesters=8)
