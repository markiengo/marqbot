# Backend Technical README

## What this folder is

This is the rule engine behind MarqBot.

It loads the catalog and degree data, decides what counts toward progress, checks whether a student can take something now, and returns deterministic recommendations.

## What it does

- loads CSV-backed runtime data
- carries college-aware program metadata so business-only rules do not spill onto non-business majors
- expands equivalencies and bucket mappings
- suppresses scoped or global equivalent-course duplicates once one alias is already satisfied
- prevents same-semester picks that conflict through equivalency or no-double-count groups
- filters contextual business-elective pools so BCC- or major-bucketed courses do not get reused as generic electives
- checks hard prereqs, standing, and machine-enforceable restrictions
- computes current and projected bucket progress
- ranks multi-semester recommendations
- accepts planner feedback submissions through the API

## Main files

- `server.py`
  Flask app, API routes, request validation, program validation (COBA_05/06 enforcement), feedback storage, and static frontend serving.

- `data_loader.py`
  Loads split prereq CSVs, program buckets, and equivalency data into runtime indexes.

- `allocator.py`
  Decides what completed and in-progress courses count toward.

- `eligibility.py`
  Decides what courses are eligible now, including honors-aware filtering.

- `semester_recommender.py`
  Ranks and selects deterministic semester recommendations.

- `requirements.py`
  Shared domain constants and bucket helpers used by both allocator and eligibility (double-count families, bucket ordering, pairwise policy).

- `prereq_parser.py`
  Parses supported hard-prereq expressions.

- `scheduling_styles.py`
  Style configs plus style-aware ranking and selection behavior. Grinder keeps declared-program work ahead of MCC/discovery cleanup, explorer reserves discovery space, and mixer interleaves the two.

- `student_stage.py`
  Filters course levels by student stage (undergrad/graduate/doctoral).

- `unlocks.py`
  Computes prereq chain depth for bridge course ranking.

- `normalizer.py`
  Course code normalization.

- `validators.py`
  Input validation helpers.

## Main routes

- `/health` and `/api/health`
  Readiness endpoints. Return `200` only when the static frontend export is present, otherwise `503` with readiness details.

- `/api/programs`
  Program metadata and bucket labels, including college-aware selection context.

- `/recommend`
  Semester recommendations. Also accepts optional `selected_courses` for edited-semester reruns so the first returned term can be user-locked while projected progress is recalculated from that edited semester forward.

- `/can-take`
  Checks one course.

- `/api/validate-prereqs`
  Detects completed/in-progress prereq contradictions.

- `/api/courses`
  Full course catalog.

- `/api/program-buckets`
  Bucket tree for a set of program IDs. Static CSV read only.

- `/api/feedback`
  Accepts planner ratings and bug/idea reports, with planner context attached.

## Simple mental model

If the frontend is the screen, the backend is the rulebook plus the API.

This folder is where the actual degree logic lives.

## Notes

- Production serves the static Next export from `frontend/out`.
- Production feedback is expected at `FEEDBACK_PATH`; the checked-in Render blueprint uses `/var/data/marqbot/feedback.jsonl`.
- Local feedback storage falls back to `feedback.jsonl` at the repo root when `FEEDBACK_PATH` is unset.
