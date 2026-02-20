# MarqBot - Marquette Finance Course Advisor

MarqBot is a student-facing planning app for Marquette Finance majors.  
It recommends what to take next based on completed courses, in-progress courses, term availability, and prerequisite readiness.

## Key Features

## 1. Deterministic Prerequisite Eligibility

What it does:
- Validates and normalizes course input (`fina3001` -> `FINA 3001`)
- Checks hard prerequisites from catalog data
- Filters by term offering (`Fall`, `Spring`, `Summer`)
- Excludes already completed or in-progress courses

Why it matters:
- Prevents recommending courses the student cannot actually take.

## 2. One- or Two-Semester Planning

What it does:
- Returns Semester 1 recommendations for the selected target term.
- Optionally returns Semester 2 recommendations.
- Semester 2 is built on Semester 1 picks (assumed completed).
- Supports `Auto` follow-up semester and `None (Do not generate)`.

Why it matters:
- Gives a short roadmap, not just a single next-course suggestion.

## 3. Requirement Bucket Progress

What it does:
- Allocates completed/in-progress courses into Finance requirement buckets.
- Shows per-bucket progress bars, remaining slots, and applied courses.
- Supports multi-bucket course mappings (double count behavior from data flags).

Why it matters:
- Students see how each course choice moves degree completion.

## 4. Can-Take Mode

What it does:
- If `requested_course` is provided, evaluates that single course.
- Returns `can_take` + missing prerequisites + not-offered flags.

Why it matters:
- Quick check for “Can I take X next semester?”

## 5. Fast Local Mode + Optional OpenAI Explanations

What it does:
- Default mode (`USE_OPENAI_EXPLANATIONS=0`) runs fully deterministic and local.
- Optional mode (`USE_OPENAI_EXPLANATIONS=1`) uses OpenAI to improve recommendation wording/ranking over already-eligible candidates.

Why it matters:
- You can optimize for speed/cost or richer explanations.

## 6. Session Persistence in Browser

What it does:
- Saves selected courses and controls in browser storage.
- Restores state on refresh.

Why it matters:
- Students do not need to re-enter everything after reload.

## Tech Stack

- Backend: Python, Flask, pandas, openpyxl
- Frontend: HTML/CSS, vanilla JavaScript (modular ES modules)
- AI (optional): OpenAI Chat Completions API
- Data: Excel workbook (`marquette_courses_full.xlsx`)
- Frontend unit tests: Jest + jsdom

## Architecture

Backend:
- `backend/server.py`: API routes and request orchestration
- `backend/data_loader.py`: workbook load/validation/compatibility mapping
- `backend/semester_recommender.py`: semester pipeline and ranking flow
- `backend/llm_recommender.py`: OpenAI call wrapper + deterministic fallback
- `backend/eligibility.py`, `backend/allocator.py`, `backend/unlocks.py`: core logic

Frontend:
- `frontend/app.js`: UI orchestration
- `frontend/modules/api.js`: HTTP calls
- `frontend/modules/multiselect.js`: course picker behavior
- `frontend/modules/rendering.js`: result rendering
- `frontend/modules/session.js`: localStorage persistence
- `frontend/modules/utils.js`: shared helpers

## API Overview

`GET /courses`
- Returns catalog for frontend pickers.

`POST /recommend`
- Recommendation mode: returns `mode=recommendations` with `semesters` array.
- Can-take mode: if `requested_course` is set, returns `mode=can_take`.

Important request fields:
- `completed_courses`
- `in_progress_courses`
- `target_semester_primary` (`Spring 2026` format)
- `target_semester_secondary` (`Auto`/explicit/`__NONE__`)
- `max_recommendations` (1-4)
- `requested_course` (optional)

## Setup (Windows, beginner-friendly)

1. Install tools:
- Git: https://git-scm.com/download/win
- Python 3.10+ (check “Add Python to PATH”): https://www.python.org/downloads/windows/

2. Clone:

```powershell
git clone https://github.com/markiengo/marqbot.git
cd marqbot
```

3. Create `.env` in project root:

```env
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini
USE_OPENAI_EXPLANATIONS=0
```

4. Install deps:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

5. Run:

```powershell
.\.venv\Scripts\python.exe backend/server.py
```

Open: `http://localhost:5000`

## Testing

Backend tests:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/backend_tests -v
```

Frontend unit tests:

```powershell
npm install
npm test
```

## Notes

MarqBot is not official academic advising.  
Students should confirm final course decisions with advisors and registrar systems.
