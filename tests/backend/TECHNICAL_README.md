# Backend Tests Technical README

## What These Tests Cover

Backend tests protect:
- prerequisite parsing and validation
- allocation and progress counting
- recommendation ranking and filtering
- API contract behavior
- feedback API validation and persistence
- live CSV/data integrity
- planner dead-end prevention

## Main Test Groups

- Logic tests
  Examples: `test_prereq_parser.py`, `test_allocator.py`, `test_eligibility.py`, `test_semester_recommender.py`

- API tests
  Examples: `test_recommend_api_contract.py`, `test_server_can_take.py`, `test_validate_prereqs_endpoint.py`, `test_feedback_api.py`

- Live-data tests
  Examples: `test_data_integrity.py`, `test_recommendation_quality.py`, `test_equivalencies.py`

- Planner safety tests
  Examples: `test_dead_end_fast.py`, `test_dead_end_nightly.py`, `test_regression_profiles.py`

## Which Command To Use

### Default backend regression

`python -m pytest -q`

Use this for normal development and PR checks.

### Fast planner guardrail

`python -m pytest tests/backend/test_dead_end_fast.py -q`

Run this when touching planner selection, eligibility, or recommendation ordering.

### Nightly-only planner sweep

`python -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q`

This is the large exhaustive planner pass. Do not treat it as a normal local command.

### Full backend suite

`python -m pytest tests/backend -q -m "nightly or not nightly"`

Use only when you explicitly want to override the default `pytest.ini` nightly exclusion.

## CI Split

- Normal CI uses the default backend regression lane from `pytest.ini` (nightly excluded).
- Fast planner guardrail runs as its own CI job.
- The exhaustive planner matrix stays in the nightly workflow only.

## Practical Rule

Use the smallest lane that matches the change:
- parser/allocation/API work: normal backend regression
- planner logic work: normal backend regression + fast planner guardrail
- deep release confidence: full backend suite or nightly sweep
