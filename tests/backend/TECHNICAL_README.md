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
  Examples: `test_dead_end_fast.py`, `test_regression_profiles.py`, `test_advisor_match.py`

## Which Command To Use

### Default backend regression

`.\.venv\Scripts\python.exe -m pytest tests/backend -q`

Use this for normal development. `pytest.ini` already excludes `nightly`.

### Fast planner guardrail

`.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q`

Run this when touching planner selection, eligibility, or recommendation ordering.

### Nightly-only planner sweep

`.\.venv\Scripts\python.exe -m pytest tests/backend -m nightly -q`

This is the focused nightly-only pass across the backend suite. Do not treat it as a normal local command.

### Full backend suite

`.\.venv\Scripts\python.exe -m pytest tests/backend -q -m "nightly or not nightly"`

Use only when you explicitly want to override the default `pytest.ini` nightly exclusion.

## Release Gate

The repo now includes `.github/workflows/nightly-sweep.yml` for the focused `@nightly` backend sweep. Treat the commands above as the broader local backend release gate outside that workflow.

## Practical Rule

Use the smallest lane that matches the change:
- parser/allocation/API work: normal backend regression
- planner logic work: normal backend regression + fast planner guardrail
- deep release confidence: full backend suite or nightly sweep
