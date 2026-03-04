# Tests Technical README

## What This Folder Is

This folder holds the app's regression checks.

Use it to answer three questions:
- Did a backend rule break?
- Did the API contract change?
- Did the planner or UI regress in a way users would notice?

## Test Lanes

### 1. Normal backend regression

Use this for day-to-day work and PR checks:

`python -m pytest tests/backend -m "not nightly" -q`

Why:
- covers the normal backend suite
- skips the huge nightly planner sweep
- should be the default backend command, not `tests/backend -q`

### 2. Fast planner safety check

Use this when touching planner logic:

`python -m pytest tests/backend/test_dead_end_fast.py -q`

Why:
- focused dead-end prevention check
- much faster than the nightly planner sweep

### 3. Nightly planner sweep

Use this for scheduled or manual deep planner validation:

`python -m pytest -m nightly -q`

Why:
- covers large dead-end state exploration
- intentionally expensive
- not a normal local/PR command

### 4. Full backend sweep

Use this only when you intentionally want everything:

`python -m pytest tests/backend -q`

Important:
- this includes the nightly-marked planner sweep
- it is much slower than the normal backend regression lane

### 5. Frontend tests

Run from `frontend/`:

`npm test`

Use this when touching rendering, state logic, or component behavior.

## CI Lanes

- `Regression Checks`
  Runs the normal backend regression lane, the fast planner guardrail, and frontend tests.

- `Nightly Exhaustive Planner Sweep`
  Runs only the large nightly planner matrix.

The split is intentional:
- fast guardrail = routine regression safety
- nightly sweep = expensive exhaustive planner coverage

## Folder Map

- `tests/backend`
  Backend unit, API, live-data, and planner tests.

- `tests/frontend`
  Frontend rendering, state, and component tests.

## Practical Rule

If you are not sure what to run, use:

1. `python -m pytest tests/backend -m "not nightly" -q`
2. `python -m pytest tests/backend/test_dead_end_fast.py -q`
3. `cd frontend && npm test`

That is the default safety bar.
