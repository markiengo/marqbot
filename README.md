# MarqBot

Pick your major. Add your classes. Get your next classes.

MarqBot is a student-built planning tool for Marquette Business students. It helps you avoid prereq mistakes and build a clean path to graduation.

Built by a Marquette student who got tired of guessing through CheckMarq.

## What You Get

- A ranked list of what to take next
- A quick yes/no on class eligibility (prereqs, standing, offerings)
- Progress by requirement bucket
- Multi-semester planning

Same inputs = same outputs. No randomness.

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
- Frontend dev: `cd frontend && npm run dev`
- Backend tests: `pytest tests/backend -q`
- Frontend checks: `cd frontend && npm run test && npm run lint && npm run build`

## Project Directory

- `backend/`: API + recommendation engine
- `frontend/`: Next.js UI
- `data/`: course, prereq, offering, and requirement CSVs
- `scripts/`: local tooling + data utilities
- `tests/`: backend and frontend tests
- `docs/`: changelog, PRD, and data model docs

## How It Works

MarqBot uses a deterministic recommendation engine that ranks courses by requirement priority, prerequisite chain depth, and bucket coverage. No randomness, no AI — same inputs always produce the same plan.

For full details, see [docs/algorithm.md](docs/algorithm.md).

## Data Model

MarqBot's course catalog, prerequisites, offerings, and requirement structure are defined in CSV files under `data/`. The loader assembles these into a runtime course overlay and a parent/child requirement graph.

See [data/data_model.md](data/data_model.md) for the full schema and ER diagram.
