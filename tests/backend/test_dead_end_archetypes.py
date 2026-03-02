"""
Archetype unit tests for the dead-end classifier using tiny synthetic datasets.

These validate that classify_dead_end correctly identifies failures and
healthy states before it is trusted on live workbook data.
"""

import pandas as pd
import pytest

from prereq_parser import parse_prereqs
from semester_recommender import run_recommendation_semester
from unlocks import build_reverse_prereq_map, compute_chain_depths
from dead_end_utils import (
    PlanCase,
    classify_dead_end,
    unsatisfied_active_buckets,
)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _mk_data(courses_rows, map_rows, buckets_rows):
    """Build minimal synthetic data dict matching semester_recommender expectations."""
    courses_df = pd.DataFrame(courses_rows)
    prereq_map = {
        row["course_code"]: parse_prereqs(row.get("prereq_hard", "none"))
        for row in courses_rows
    }
    buckets_df = pd.DataFrame(buckets_rows)
    if "parent_bucket_priority" not in buckets_df.columns:
        buckets_df["parent_bucket_priority"] = 2
    return {
        "courses_df": courses_df,
        "equivalencies_df": pd.DataFrame(),
        "buckets_df": buckets_df,
        "course_bucket_map_df": pd.DataFrame(map_rows),
        "prereq_map": prereq_map,
    }


def _course(code, name="Course", prereq="none", level=1000, credits=3,
            fall=True, spring=True, summer=False, manual_review=False,
            prereq_soft="", offering_confidence="high", notes=None):
    return {
        "course_code": code,
        "course_name": name,
        "credits": credits,
        "level": level,
        "prereq_hard": prereq,
        "prereq_soft": prereq_soft,
        "prereq_level": 0,
        "offered_fall": fall,
        "offered_spring": spring,
        "offered_summer": summer,
        "offering_confidence": offering_confidence,
        "manual_review": manual_review,
        "notes": notes,
    }


def _bucket(bucket_id, label="Bucket", needed_count=1, role="required", priority=1):
    return {
        "track_id": "TEST_MAJOR",
        "bucket_id": bucket_id,
        "bucket_label": label,
        "priority": priority,
        "needed_count": needed_count,
        "needed_credits": None,
        "min_level": None,
        "allow_double_count": False,
        "role": role,
    }


def _map_entry(bucket_id, course_code):
    return {"track_id": "TEST_MAJOR", "bucket_id": bucket_id, "course_code": course_code}


def _run_sim(data, completed, in_progress, semester, num_terms=3, max_recs=6):
    """Run multi-term simulation on synthetic data, returning semester payloads."""
    from semester_recommender import (
        default_followup_semester,
        _credits_to_standing,
    )
    reverse_map = build_reverse_prereq_map(data["courses_df"], data["prereq_map"])
    chain_depths = compute_chain_depths(reverse_map)

    semester_labels = [semester]
    while len(semester_labels) < num_terms:
        semester_labels.append(default_followup_semester(semester_labels[-1]))

    semesters = []
    completed_cursor = list(dict.fromkeys(completed + in_progress))
    running_credits = len(completed_cursor) * 3

    for idx, label in enumerate(semester_labels):
        standing = _credits_to_standing(running_credits)
        if idx == 0:
            sem = run_recommendation_semester(
                completed, in_progress, label, data, max_recs, reverse_map,
                track_id="TEST_MAJOR", current_standing=standing,
                chain_depths=chain_depths,
            )
        else:
            sem = run_recommendation_semester(
                completed_cursor, [], label, data, max_recs, reverse_map,
                track_id="TEST_MAJOR", current_standing=standing,
                chain_depths=chain_depths,
            )
        semesters.append(sem)

        for rec in sem.get("recommendations", []):
            running_credits += 3
        completed_cursor = list(dict.fromkeys(
            completed_cursor + [
                r["course_code"] for r in sem.get("recommendations", [])
                if r.get("course_code")
            ]
        ))

    return semesters


DUMMY_CASE = PlanCase(
    declared_majors=["TEST_MAJOR"],
    track_ids=[],
    declared_minors=[],
    completed_courses=[],
    in_progress_courses=[],
    target_semester_primary="Fall 2026",
)


# ── 1. Bridge course continuity ────────────────────────────────────────────


class TestBridgeCourseContinuity:
    """One unmet required course blocked by a bridge prereq — planner should
    recommend the bridge course instead of dead-ending."""

    def test_bridge_prereq_recommended(self):
        courses = [
            _course("BRIDGE 1000", "Bridge Course"),
            _course("TARGET 2000", "Target Course", prereq="BRIDGE 1000", level=2000),
        ]
        buckets = [_bucket("CORE", needed_count=1)]
        cmap = [_map_entry("CORE", "TARGET 2000")]
        data = _mk_data(courses, cmap, buckets)

        semesters = _run_sim(data, [], [], "Fall 2026", num_terms=3)
        check = classify_dead_end(semesters, DUMMY_CASE)
        assert not check.failed, f"Bridge course should prevent dead-end: {check.failure_kind}"


# ── 2. Selection gap ───────────────────────────────────────────────────────


class TestSelectionGap:
    """eligible_count > 0 but recommendations empty — SELECTION_GAP."""

    def test_selection_gap_detected(self):
        # Simulate this scenario directly with crafted semester payloads
        fake_semesters = [
            {
                "target_semester": "Fall 2026",
                "recommendations": [],
                "eligible_count": 3,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": [],
            },
            {
                "target_semester": "Spring 2027",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": [],
            },
        ]
        check = classify_dead_end(fake_semesters, DUMMY_CASE)
        assert check.failed
        assert check.failure_kind == "SELECTION_GAP"
        assert check.semester_index == 0


# ── 3. Manual-review blocker ───────────────────────────────────────────────


class TestManualReviewBlocker:
    """Only remaining required course is manual-review — MANUAL_REVIEW_BLOCK."""

    def test_manual_review_block_detected(self):
        fake_semesters = [
            {
                "target_semester": "Fall 2026",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": ["INSY 4158"],
            },
            {
                "target_semester": "Spring 2027",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": ["INSY 4158"],
            },
        ]
        check = classify_dead_end(fake_semesters, DUMMY_CASE)
        assert check.failed
        assert check.failure_kind == "MANUAL_REVIEW_BLOCK"


# ── 4. Term-only delay (seasonal recovery) ─────────────────────────────────


class TestTermOnlyDelay:
    """No recommendation in Fall because remaining course is Spring-only.
    Next Spring recovers. Must NOT fail."""

    def test_seasonal_recovery_is_healthy(self):
        courses = [
            _course("SPRING 3000", "Spring Only", fall=False, spring=True, level=3000),
        ]
        buckets = [_bucket("CORE", needed_count=1)]
        cmap = [_map_entry("CORE", "SPRING 3000")]
        data = _mk_data(courses, cmap, buckets)

        semesters = _run_sim(data, [], [], "Fall 2026", num_terms=3)
        check = classify_dead_end(semesters, DUMMY_CASE)
        assert not check.failed, f"Seasonal recovery should be healthy: {check.failure_kind}"


# ── 5. Standing-only delay ──────────────────────────────────────────────────


class TestStandingOnlyDelay:
    """No recommendation until credits increase standing. Next term recovers."""

    def test_standing_recovery_is_healthy(self):
        # Use crafted payloads to isolate classifier logic: term 1 empty due
        # to standing gate, term 2 recovers once standing advances.
        fake_semesters = [
            {
                "target_semester": "Fall 2026",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": [],
            },
            {
                "target_semester": "Spring 2027",
                "recommendations": [{"course_code": "SENIOR 4000"}],
                "eligible_count": 1,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": [],
            },
        ]
        check = classify_dead_end(fake_semesters, DUMMY_CASE)
        assert not check.failed, \
            "Standing recovery in next term should be healthy, not a dead-end"


# ── 6. True 2-term dead-end ─────────────────────────────────────────────────


class TestTrue2TermDeadEnd:
    """Unsatisfied active requirement remains across 2 consecutive empty terms.
    Must fail as ELIGIBILITY_GAP."""

    def test_2_term_dead_end_detected(self):
        fake_semesters = [
            {
                "target_semester": "Fall 2026",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": [],
            },
            {
                "target_semester": "Spring 2027",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": False}},
                "manual_review_courses": [],
            },
        ]
        check = classify_dead_end(fake_semesters, DUMMY_CASE)
        assert check.failed
        assert check.failure_kind == "ELIGIBILITY_GAP"
        assert check.semester_index == 0


# ── 7. Completed-degree terminal ────────────────────────────────────────────


class TestCompletedDegreeTerminal:
    """No recommendations and all buckets satisfied — must pass (graduation)."""

    def test_graduation_is_healthy(self):
        fake_semesters = [
            {
                "target_semester": "Fall 2026",
                "recommendations": [],
                "eligible_count": 0,
                "progress": {"CORE": {"satisfied": True}},
                "manual_review_courses": [],
            },
        ]
        check = classify_dead_end(fake_semesters, DUMMY_CASE)
        assert not check.failed


# ── 8. Choose-n survivability ───────────────────────────────────────────────


class TestChooseNSurvivability:
    """One manual-review course remains in a choose_n bucket but the bucket
    can still be satisfied by other courses — must pass."""

    def test_choose_n_with_manual_review_is_healthy(self):
        courses = [
            _course("PICK 1000", "Pick A"),
            _course("PICK 2000", "Pick B"),
            _course("PICK 3000", "Manual Pick", manual_review=True),
        ]
        buckets = [_bucket("ELECTIVE", needed_count=2, role="choose_n")]
        cmap = [
            _map_entry("ELECTIVE", "PICK 1000"),
            _map_entry("ELECTIVE", "PICK 2000"),
            _map_entry("ELECTIVE", "PICK 3000"),
        ]
        data = _mk_data(courses, cmap, buckets)

        semesters = _run_sim(data, [], [], "Fall 2026", num_terms=3)
        check = classify_dead_end(semesters, DUMMY_CASE)
        assert not check.failed, "choose_n bucket should survive with non-manual alternatives"


# ── 9. Credits-pool non-dead-end ────────────────────────────────────────────


class TestCreditsPoolNonDeadEnd:
    """One specific blocked course remains in a credits-pool universe, but
    other courses can still satisfy the bucket — must pass."""

    def test_credits_pool_not_dead_ended(self):
        courses = [
            _course("POOL 1000", "Pool A"),
            _course("POOL 2000", "Pool B"),
            _course("POOL 3000", "Blocked Pool", prereq="MISSING 9999"),
        ]
        buckets = [_bucket("POOL", needed_count=2, role="credits_pool", priority=3)]
        cmap = [
            _map_entry("POOL", "POOL 1000"),
            _map_entry("POOL", "POOL 2000"),
            _map_entry("POOL", "POOL 3000"),
        ]
        data = _mk_data(courses, cmap, buckets)

        semesters = _run_sim(data, [], [], "Fall 2026", num_terms=3)
        check = classify_dead_end(semesters, DUMMY_CASE)
        assert not check.failed, "credits_pool should not dead-end when alternatives exist"
