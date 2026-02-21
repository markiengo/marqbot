# MarqBot

MarqBot is a degree-planning app for Marquette business students. It helps you plan what to take next, check if you can take a specific class, and see how close you are to finishing your requirements.

## Part A - For Students (Non-Technical)

## What MarqBot Does
MarqBot is your semester planning assistant. It helps you turn your current classes into a practical next-step plan.

MarqBot helps you:
- choose your declared major(s) and optional track
- add completed and current in-progress courses
- get recommended courses for your next term (or next two terms)
- check a specific class with "Can I Take This?"
- see requirement progress in a visual dashboard

## Majors and Tracks Currently Included
Majors:
- Finance Major
- Accounting Major
- Human Resources Major
- Business Analytics Major
- Operations and Supply Chain Major
- Information Systems Major
- AIM Major

Tracks and concentrations:
- Corporate Banking (CB)
- Financial Planning (FP)
- Business Leadership (HURE)
- AIM CFA: Investments
- AIM Applied FinTech
- AIM Private Capital & Investment Banking

Note:
- Business Analytics is modeled as a secondary major and must be paired with a primary major.
- AIM is modeled as a secondary major and must be paired with a primary major.

## How Recommendations Are Chosen (Simple Version)
MarqBot first filters to classes you can realistically take:
- prerequisites are satisfied
- class is offered in the selected term
- class is not already completed or in-progress

Then it ranks eligible courses by:
1. Requirements first: courses in higher-priority requirement buckets are favored.
2. Bigger progress impact: courses that fill more unmet requirement buckets are favored.
3. Earlier sequence: lower prerequisite level is favored when ties remain.

This means MarqBot prioritizes courses that move you forward in your degree, not just any open class.

## How Prerequisite Assumptions Work
You do not need to manually enter every lower-level prerequisite if you already entered a higher-level course.

Example:
- if you add an advanced class, MarqBot can infer required prerequisite chains behind it
- inferred prerequisites are shown in notes so you can see exactly what was assumed

Important:
- required chains are inferred for supported prerequisite formats
- OR-choice and concurrent-optional prerequisite branches are not auto-assumed

## What Degree Progress Means
- Green: courses already completed.
- Yellow: current in-progress courses that are assumed completed for projection.
- White: still remaining.

You will also see:
- requirement cards by bucket/sub-bucket
- current snapshot progress and projected progress with in-progress classes
- assumption notes that explain inferred prerequisite courses

## Core Features
- Recommendation planning for up to three semesters
- Inline "Can I Take This?" checker
- Current vs projected progress visualization
- Double-count transparency notes when a course applies to multiple requirement buckets
- Keyboard-friendly searchable selectors

## How To Use
1. Select your major(s), then optional track if applicable.
2. Add completed courses.
3. Add courses you are taking now.
4. Set target semester(s) and recommendation count.
5. Click **Get Recommendations**.
6. Review progress + suggestions, then use **Can I Take This?** for specific classes.

## What MarqBot Does Not Replace
- MarqBot is a planning aid. Final course decisions should still be confirmed with your advisor and official registration systems.

---

## Part B - For Developers (Technical)

## Architecture Overview
Backend (Flask + pandas):
- `backend/server.py`: API orchestration and response assembly
- `backend/data_loader.py`: strict workbook loading + runtime normalization
- `backend/eligibility.py`: eligibility filtering and ranking
- `backend/allocator.py`: requirement allocation and overlap handling
- `backend/requirements.py`: policy resolution for double/triple/N-way counting
- `backend/semester_recommender.py`: semester recommendation pipeline

Frontend (vanilla JS modules):
- `frontend/index.html`: UI structure
- `frontend/style.css`: tokens and component styling
- `frontend/app.js`: state, events, orchestration
- `frontend/modules/api.js`: fetch wrappers
- `frontend/modules/multiselect.js`: searchable selectors
- `frontend/modules/rendering.js`: HTML render helpers
- `frontend/modules/session.js`: local session persistence

## Frontend Token Migration Note
- Canonical tokens:
  - Spacing uses `--sp-1` to `--sp-10`.
- Legacy aliases (temporary):
  - `--sp-xs`, `--sp-sm`, `--sp-md`, `--sp-lg`, `--sp-xl`.
- Allowed raw-px exceptions:
  - border/outline widths
  - shadow/blur values
  - SVG stroke/ring sizes
  - icon dimensions
  - animation timing values
- Removal condition:
  - Alias tokens can be removed after spacing usage is fully canonical and visual/regression QA is green.

## API Endpoints
- `GET /courses`
- `GET /programs`
- `POST /recommend`
- `POST /can-take` (standalone inline eligibility check)

## Data Model (Workbook)
Primary workbook: `marquette_courses_full.xlsx`

Canonical V2 sheets:
- `programs`
- `buckets`
- `sub_buckets`
- `courses`
- `course_prereqs`
- `course_offerings`
- `courses_all_buckets` (course-to-sub-bucket mappings)
- `course_equivalencies`
- `double_count_policy`
- `README`

Notes:
- Runtime is strict V2.
- `courses_all_buckets` is canonical. Legacy `course_sub_buckets` is compatibility-read only.
- Major display labels are canonicalized from `program_id`:
  - Rule: `<CODE>_MAJOR -> <DISPLAY_CODE> Major`
  - Current code aliases: `FIN -> FINA`, `INSY -> IS`
  - For future injections, use stable `program_id` codes; UI labels are derived by this rule.

## Local Setup
1. Python environment:
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

2. Frontend test dependencies:
```powershell
npm install
```

## Run
```powershell
.\.venv\Scripts\python.exe backend/server.py
```
Open: `http://localhost:5000`

## Test and Validation Commands
Backend tests:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/backend_tests -q
```

Frontend tests:
```powershell
cmd /c npm test --silent
```

Data validator:
```powershell
.\.venv\Scripts\python.exe scripts/validate_track.py --all
```

## Contribution Guidance
- Keep API changes additive whenever possible.
- Preserve frontend IDs used by `app.js`.
- Prefer deterministic behavior over hidden heuristics.
- Update tests with every behavior change.
- Treat workbook contract changes as migration-level changes, not incidental edits.

## Canonical Project Narrative
See `PROJECT_HISTORY.md` for the consolidated phase-by-phase history.
