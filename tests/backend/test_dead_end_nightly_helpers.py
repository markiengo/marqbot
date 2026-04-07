import pytest

from dead_end_utils import DeadEndCheck, PlanCase
from helpers import sample_nightly_scenarios
from nightly_support import (
    GraduationCheck,
    NightlyCaseSpec,
    NightlyFailureCollector,
    NightlySuite,
    build_nightly_suite,
    build_seeded_history_variants,
)


def _base_fin_case() -> PlanCase:
    return PlanCase(
        declared_majors=["FIN_MAJOR"],
        track_ids=[],
        declared_minors=[],
        completed_courses=[],
        in_progress_courses=[],
        target_semester_primary="Fall 2026",
    )


def test_sample_nightly_scenarios_is_deterministic_and_unique():
    first = sample_nightly_scenarios(20260309, sample_size=5)
    second = sample_nightly_scenarios(20260309, sample_size=5)
    labels = [scenario.label for scenario in first]

    assert labels == [scenario.label for scenario in second]
    assert len(labels) == 5
    assert len(labels) == len(set(labels))


def test_build_nightly_suite_counts_cases_and_enforces_budget():
    suite = build_nightly_suite(20260309, sample_size=1, selection_variants=1, case_budget=5)

    assert suite.expected_tests == 5
    assert len(suite.cases) == 5

    with pytest.raises(AssertionError, match="Nightly case budget exceeded"):
        build_nightly_suite(20260309, sample_size=1, selection_variants=1, case_budget=4)


def test_seeded_histories_are_undergrad_and_nonempty():
    variants = build_seeded_history_variants(
        _base_fin_case(),
        requested_semesters=2,
        variant_count=2,
        seed=20260309,
    )

    valid = [variant for variant in variants if variant.valid]
    assert valid, "expected at least one valid seeded history"

    for variant in valid:
        assert variant.actual_semesters > 0
        assert variant.completed_courses == list(dict.fromkeys(variant.completed_courses))
        assert all(int(course.split()[1]) < 5000 for course in variant.completed_courses)


def test_nightly_report_uses_plain_english_sections_and_appendix_logs():
    spec = NightlyCaseSpec(
        label="triple-FIN+INSY/foundation/v1",
        scenario_label="triple-FIN+INSY",
        profile_label="foundation",
        selection_variant=1,
        seeded_semesters=1,
        case=_base_fin_case(),
    )
    suite = NightlySuite(
        cases=(spec,),
        total_possible_scenarios=1031,
        sampled_scenario_labels=("triple-FIN+INSY",),
        profiles_per_scenario=5,
        selection_variants=5,
        expected_tests=2,
        case_budget=750,
    )
    collector = NightlyFailureCollector()
    collector.configure_suite(suite, seed=20260309)
    collector.total_tests = 1
    dead_end = DeadEndCheck(
        failed=True,
        failure_kind="ELIGIBILITY_GAP",
        semester_index=2,
        semester_label="Fall 2028",
        unsatisfied_buckets=["FIN_MAJOR::FIN-REQ-CORE"],
        manual_review_courses=[],
        eligible_count=0,
        reproduction_case=spec.case,
    )
    graduation = GraduationCheck(
        failed=True,
        max_semesters=8,
        semester_label="Spring 2030",
        unsatisfied_buckets=["FIN_MAJOR::FIN-REQ-CORE"],
        total_recommendations=18,
        reproduction_case=spec.case,
    )
    collector.record_case_issue(spec, dead_end=dead_end, graduation=graduation)

    report = collector.generate_report()
    snapshot = collector.to_snapshot(report_date="2026-03-09")

    assert "# Nightly Planner Report -" in report
    assert "## Start Here" in report
    assert "- Overall result: Red" in report
    assert "- Students not graduating by semester 8: 1" in report
    assert "This run is incomplete" in report
    assert "## Why Students Failed" in report
    assert "## Fix First" in report
    assert "## Where To Look In Data" in report
    assert "## Programs To Review" in report
    assert "## Most Common Open Buckets" in report
    assert "## Representative Cases" in report
    assert "#### Case 1" in report
    assert "- status: dead end + not graduated by semester 8" in report
    assert "ELIGIBILITY_GAP" not in report
    assert "All sampled student plans completed without reported issues." not in report
    assert snapshot["report_date"] == "2026-03-09"
    assert snapshot["priority_fix_list"]
    assert snapshot["data_investigation_checklist"]
    assert snapshot["failures_by_program"]
