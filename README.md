# MarqBot - Marquette Finance Course Advisor

MarqBot is a Finance-major advising app for Marquette students. It recommends eligible courses using deterministic prerequisite and requirement logic, with optional OpenAI explanations.

## Current Features

- Deterministic eligibility: offered term + hard prereqs met + not already completed/in progress.
- Two-semester planning:
- Semester 1 recommendations for selected target semester.
- Optional Semester 2 recommendations built on Semester 1 picks (assumed completed).
- `Target Semester (2)` supports `Auto`, explicit term, or `None (Do not generate)`.
- Can-take mode: `Can I take this next semester?` check for one course.
- Degree progress by requirement bucket with completed vs in-progress handling.
- Multi-bucket visibility on recommendation cards (courses can count toward multiple buckets).
- Timeline estimate shown as time to complete Finance major requirements.
- Fast mode by default (no LLM call); optional OpenAI ranking/explanation.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Flask, pandas, openpyxl
- AI (optional): OpenAI Chat Completions (`OPENAI_MODEL`)
- Data: `marquette_courses_full.xlsx`

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Configure `.env`:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
USE_OPENAI_EXPLANATIONS=0
```

`USE_OPENAI_EXPLANATIONS=0` (default) keeps recommendations deterministic and fast.  
Set it to `1` to call OpenAI for ranking/explanations.

4. Run:

```bash
python backend/server.py
```

Open `http://localhost:5000`.

## API Notes

`POST /recommend` accepts:

- `completed_courses` (string list input)
- `in_progress_courses` (string list input)
- `target_semester_primary` (for example `Spring 2026`)
- `target_semester_secondary` (`Auto` via null/empty, explicit label, or `__NONE__`)
- `requested_course` (optional can-take mode)
- `max_recommendations` (1 to 4)

Response in recommendation mode includes:

- `semesters`: array of semester recommendation blocks
- Sem1 fields also mirrored at top level for compatibility

## Workbook Schema

`marquette_courses_full.xlsx` uses these sheets:

- `courses`
- `equivalencies`
- `tracks`
- `buckets`
- `bucket_course_map`

The workbook may store `program_id`; backend maps it to `track_id` internally for compatibility.

## Finance Bucket Labels

- `CORE`: Core Required
- `FIN_CHOOSE_1`: Upper Division Finance Elective (One)
- `FIN_CHOOSE_2`: Upper Division Finance Elective (Two)
- `BUS_ELEC_4`: Business Electives

Double-counting is enabled by data flags and bucket configuration.

## Tests

```bash
python -m pytest tests/ -v
```

