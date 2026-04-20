"""
Nightly sampled dead-end sweep with prereq-hardened seeded student histories.

Covers:
- 10 deterministic-random sampled multi-program combos by default
- 4 seeded student profiles per combo
- 3 prereq-valid course-selection variants per profile

Seed is date-based for daily reproducibility:
- Same day = same sampled combos and seeded histories
- Next day = fresh nightly slice
- Override with NIGHTLY_SEED to replay a specific day

Run with: pytest -m nightly
"""

import os
from datetime import date

import pytest

from conftest import get_nightly_collector
from dead_end_utils import classify_dead_end, simulate_terms
from helpers import NIGHTLY_CASE_BUDGET, NIGHTLY_SAMPLE_SIZE, NIGHTLY_SELECTION_VARIANTS
from nightly_support import NightlySuite, build_nightly_suite, classify_graduation, format_nightly_failure

pytestmark = pytest.mark.nightly

SEED = int(os.environ.get("NIGHTLY_SEED", date.today().strftime("%Y%m%d")))
SAMPLE_SIZE = int(os.environ.get("NIGHTLY_SAMPLE_SIZE", NIGHTLY_SAMPLE_SIZE))
SELECTION_VARIANTS = int(
    os.environ.get("NIGHTLY_SELECTION_VARIANTS", NIGHTLY_SELECTION_VARIANTS)
)
CASE_BUDGET = int(os.environ.get("NIGHTLY_CASE_BUDGET", NIGHTLY_CASE_BUDGET))

_COLLECTION_ERROR = ""
try:
    _NIGHTLY_SUITE = build_nightly_suite(
        SEED,
        sample_size=SAMPLE_SIZE,
        selection_variants=SELECTION_VARIANTS,
        case_budget=CASE_BUDGET,
    )
except Exception as exc:  # pragma: no cover - exercised only on collection failures
    _COLLECTION_ERROR = f"Nightly suite setup failed during collection: {exc}"
    _NIGHTLY_SUITE = NightlySuite(
        cases=(),
        total_possible_scenarios=0,
        sampled_scenario_labels=(),
        profiles_per_scenario=0,
        selection_variants=0,
        expected_tests=0,
        case_budget=CASE_BUDGET,
    )
else:
    get_nightly_collector().configure_suite(_NIGHTLY_SUITE, seed=SEED)


def test_nightly_suite_collection_setup():
    if not _COLLECTION_ERROR:
        return
    collector = get_nightly_collector()
    collector.supplemental_checks += 1
    collector.record_supplemental_issue(
        label="nightly-suite-collection",
        issue_kind="nightly collection setup",
        scenario_label="nightly-suite",
        reason=_COLLECTION_ERROR,
        details=["The sampled nightly suite could not be built during test collection."],
    )
    raise AssertionError(_COLLECTION_ERROR)


@pytest.mark.parametrize(
    "spec",
    list(_NIGHTLY_SUITE.cases),
    ids=[spec.label for spec in _NIGHTLY_SUITE.cases],
)
def test_nightly_no_dead_end(spec):
    """Assert sampled nightly students avoid dead-ends and still finish by semester 8."""
    collector = get_nightly_collector()
    collector.total_tests += 1

    if spec.invalid_reason:
        collector.record_case_issue(spec, invalid_reason=spec.invalid_reason)
        raise AssertionError(format_nightly_failure(invalid_reason=spec.invalid_reason))

    try:
        semesters = simulate_terms(spec.case, num_terms=9)
    except ValueError as exc:
        reason = f"Program selection failed during simulation: {exc}"
        collector.record_case_issue(spec, invalid_reason=reason)
        raise AssertionError(format_nightly_failure(invalid_reason=reason))

    dead_end = classify_dead_end(semesters, spec.case)
    graduation = classify_graduation(
        semesters,
        spec.case,
        max_semesters=8,
        seeded_semesters=spec.seeded_semesters,
    )

    if not dead_end.failed and not graduation.failed:
        return

    collector.record_case_issue(
        spec,
        dead_end=dead_end if dead_end.failed else None,
        graduation=graduation if graduation.failed else None,
    )
    raise AssertionError(
        format_nightly_failure(
            dead_end=dead_end if dead_end.failed else None,
            graduation=graduation if graduation.failed else None,
        )
    )
