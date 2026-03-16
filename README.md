# MarqBot

Pick your program. Add completed classes. Get a ranked next-term plan.

MarqBot is a student-built planning tool for Marquette Business students. It helps you avoid prereq mistakes, see what counts, and build a cleaner path to graduation.

Built by a Marquette student who got tired of guessing through CheckMarq.

## What You Get

- A ranked list of what to take next
- A quick yes/no on class eligibility
- Progress by requirement bucket
- Multi-semester planning
- Saved plan snapshots in your browser
- An in-app feedback form for bugs and ideas

Same CSVs + same ranking overrides + same inputs = same outputs. No randomness.

## What It Is Not

- Not CheckMarq
- Not DegreeWorks
- Not official advising

Use it to plan faster. Then confirm with your advisor before enrollment.

## Marquette References

- CheckMarq Student Home: https://www.marquette.edu/student-checkmarq/
- Degree Progress reports (Marquette Central): https://www.marquette.edu/central/registrar/degree-progress.php
- College of Business undergraduate info: https://www.marquette.edu/business/undergraduate/

## Quick Start

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm ci
cd ..
.\.venv\Scripts\python.exe scripts/run_local.py
```

## Common Commands

- Backend only: `.\.venv\Scripts\python.exe backend/server.py`
- Frontend dev: `cd frontend; npm run dev`
- Backend tests: `.\.venv\Scripts\python.exe -m pytest -q`
- Frontend checks: `cd frontend; npm run test; npm run lint; npm run build`
- Track validation: `.\.venv\Scripts\python.exe scripts/validate_track.py --all`
- Nightly analyzer dry run: `.\.venv\Scripts\python.exe scripts/analyze_nightly.py --report tests/nightly_reports/YYYY-MM-DD.json --dry-run`

## Nightly Workflow

The scheduled nightly workflow runs the focused planner sweep, writes both a Markdown report and a JSON sidecar, and uploads them as one GitHub Actions artifact.

After that, a second nightly job analyzes the JSON report. It can open a PR that updates:
- `config/ranking_overrides.json`
- `config/data_investigation_queue.json`

Those auto-tuned changes are limited to checked-in config. They do not edit the CSV catalog for you. CSV fixes and bulletin checks still stay manual.

## Environment

- `DATA_PATH`: optional CSV-directory or workbook override
- `FLASK_DEBUG`: optional local backend debug toggle
- `FEEDBACK_PATH`: optional JSONL file path for feedback submissions; for local dev this can point to an ignored file like `docs/feedbacks/feedback.jsonl`, and for production it should point to a Render persistent disk path
- `PORT`, `WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, `GUNICORN_GRACEFUL_TIMEOUT`: deploy/runtime overrides
- `REQUEST_CACHE_SIZE`, `SLOW_REQUEST_LOG_MS`: backend cache/log tuning
- `NEXT_PUBLIC_API_BASE`: optional absolute frontend API base

## Project Directory

- `backend/`: API + recommendation engine
- `config/`: checked-in ranking overrides + nightly investigation queue
- `frontend/`: Next.js UI
- `data/`: course, prereq, offering, and requirement CSVs
- `scripts/`: local tooling, data utilities, and nightly analysis
- `tests/`: backend and frontend tests
- `docs/`: changelog, algorithm notes, prompts, and working memos

## How It Works

MarqBot uses a deterministic recommendation engine that ranks courses by requirement priority, prerequisite chain depth, and bucket coverage. No randomness, no AI, same inputs always produce the same plan.

The planner is currently saved-plan aware and feedback aware:
- saved plans live in browser localStorage
- feedback submissions go to the backend and can be stored as JSONL via `FEEDBACK_PATH`

Current recommendation behavior notes:
- honors students can receive honors-section equivalents without duplicate base-course clutter
- seasonal offering data is loaded, but recommendations currently treat courses as available every term while offering cleanup continues

For full details, see [docs/algorithm.md](docs/algorithm.md).

## Data Model

MarqBot's course catalog, prerequisites, offerings, and requirement structure are defined in CSV files under `data/`. The loader assembles these into a runtime course overlay and a parent/child requirement graph.

See [data/data_model.md](data/data_model.md) for the full schema and ER diagram.
