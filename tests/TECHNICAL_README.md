# Tests Technical README

## What this folder is

This folder checks whether the app still works after changes.

It helps catch bugs before students see them.

## What it does

- checks prerequisite logic
- checks progress counting
- checks API behavior
- checks recommendation behavior
- checks that the planner does not get stuck

## Main parts

- `tests/backend`
  Most of the important logic tests.

- `tests/frontend`
  Frontend tests.

## Two important planner tests

- `test_dead_end_fast.py`
  Faster safety check.

- `test_dead_end_nightly.py`
  Bigger scheduled safety check.

## Simple mental model

Tests are the app's safety net.

They help prove old features still work after new changes.

## Common commands

- `python -m pytest tests/backend -q`
  Run backend tests.

- `python -m pytest tests/backend/test_dead_end_fast.py -q`
  Run the fast planner safety test.

- `python -m pytest -m nightly -q`
  Run the bigger nightly planner sweep.
