# Backend Technical README

## What this folder is

This is the rule engine behind MarqBot.

It loads the catalog and degree data, decides what counts toward progress, checks whether a student can take something now, and returns deterministic recommendations.

## What it does

- loads CSV-backed runtime data
- expands equivalencies and bucket mappings
- checks hard prereqs, standing, and machine-enforceable restrictions
- computes current and projected bucket progress
- ranks multi-semester recommendations
- accepts planner feedback submissions through the API

## Main files

- `server.py`
  Flask app, API routes, request validation, feedback storage, and static frontend serving.

- `data_loader.py`
  Loads split prereq CSVs, program buckets, and equivalency data into runtime indexes.

- `allocator.py`
  Decides what completed and in-progress courses count toward.

- `eligibility.py`
  Decides what courses are eligible now, including honors-aware filtering.

- `semester_recommender.py`
  Ranks and selects deterministic semester recommendations.

- `prereq_parser.py`
  Parses supported hard-prereq expressions.

## Main routes

- `/api/programs`
  Program metadata and bucket labels.

- `/api/recommend`
  Semester recommendations.

- `/api/can-take`
  Checks one course.

- `/api/validate-prereqs`
  Detects completed/in-progress prereq contradictions.

- `/api/feedback`
  Accepts planner ratings and bug/idea reports, with planner context attached.

## Simple mental model

If the frontend is the screen, the backend is the rulebook plus the API.

This folder is where the actual degree logic lives.

## Notes

- Production serves the static Next export from `frontend/out`.
- Feedback storage defaults to `feedback.jsonl` unless `FEEDBACK_PATH` is set.
