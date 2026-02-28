# Overview
MarqBot is a deterministic degree-planning assistant for Marquette business students and advisors, generating recommendations, requirement progress, and can-take checks from workbook-driven rules.

# Architecture
- `backend/`: Flask API and deterministic recommendation/allocation engine.
- `frontend/`: Next.js 16 + React 19 + TypeScript UI; production output is static export (`frontend/out`).
- `scripts/`: local run helpers and workbook governance/migration utilities. One-time migration scripts are archived under `scripts/archive/`.
- `tests/backend`, `tests/frontend`: pytest and vitest coverage.
- `infra/docker/Dockerfile` + `render.yaml`: Docker/Render deployment wiring.
- `data/`: canonical runtime data source (CSV directory). Seven files: `courses.csv`, `course_prereqs.csv`, `course_offerings.csv`, `parent_buckets.csv`, `child_buckets.csv`, `master_bucket_courses.csv`, `double_count_policy.csv`.
- `marquette_courses_full.xlsx`: legacy Excel source; still present but no longer the default. Override with `DATA_PATH=marquette_courses_full.xlsx` to use it.

# Commands
## Setup
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend && npm ci
```

## Build / Run (Local)
```powershell
# Preferred full stack (auto-build frontend export if missing)
.\.venv\Scripts\python.exe scripts/run_local.py

# Backend only (reads data/ CSVs by default)
.\.venv\Scripts\python.exe backend/server.py

# Frontend dev (separate shell)
cd frontend && npm run dev

# Frontend production export
cd frontend && npm run build
```

## Test / Validate
```powershell
.\.venv\Scripts\python.exe scripts/validate_track.py --all
.\.venv\Scripts\python.exe -m pytest tests/backend -q
cd frontend && npm run test && npm run lint && npm run build
```

## Docker / Deploy
```powershell
docker build -f infra/docker/Dockerfile -t marqbot:local .
docker run --rm -p 5000:5000 -e PORT=5000 -e WEB_CONCURRENCY=1 marqbot:local
```
- Render deploys from `render.yaml` at repo root using `infra/docker/Dockerfile`.

# Conventions
- Keep backend logic deterministic and data-first (no LLM/external API calls in request paths).
- Preserve canonical API routes and contracts: `/api/health`, `/api/courses`, `/api/programs`, `/api/recommend`, `/api/can-take`.
- Reuse existing pipeline helpers before adding new logic (`normalize_input`, `allocate_courses`, `run_recommendation_semester`, validators).
- Normalize user/program/course inputs consistently (uppercase canonical IDs/codes).
- Keep frontend API access centralized in `frontend/src/lib/api.ts` and shared payload types in `frontend/src/lib/types.ts`.
- Preserve static-export compatibility in frontend code (no production assumptions requiring `next start` server features).
- Environment variables used by runtime: `DATA_PATH`, `PORT`, `FLASK_DEBUG`, `BCC_DECAY_ENABLED`, `WEB_CONCURRENCY`, `PYTHON_VERSION`.

# Deployment Rules
- Target is Render Starter (`0.5` CPU): optimize for low CPU headroom and predictable latency.
- Gunicorn startup must remain functionally equivalent to:
```bash
gunicorn --chdir backend server:app --bind 0.0.0.0:${PORT:-5000} --workers ${WEB_CONCURRENCY:-1} --timeout ${GUNICORN_TIMEOUT:-90} --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-30}
```
- Always bind to `0.0.0.0` and always honor `$PORT`.
- Default `WEB_CONCURRENCY` is `1`; increase only with measured evidence on Render Starter.
- Keep production frontend serving model as Flask + static export (`frontend/out`).

# Token Management
Global Rules:
- Only include context that is directly relevant to the current coding task.
- Do NOT scan unnecessary files or unrelated folders.
- If asked to explore the codebase, restrict to the specific paths mentioned in the prompt.
- Keep all sections concise; avoid redundant explanations.
- For multi-file changes, reference detailed docs only when required (don’t load them automatically).
- If you feel like there are tasks that need extensive tokens, ask me. 

# Data Model Rules
- All seven CSVs in `data/` must be read with `encoding="utf-8-sig"` (BOM-safe) when using Python's csv module directly.
- `parent_bucket_label` values are the display names shown to users — no "Major" or "Minor" suffix. Labels must be clean (e.g., "Finance", "Accounting", "Marketing").
- `prereq_warnings` in `course_prereqs.csv` use comma `,` as separator, never semicolon.
- `min_standing` is a float (1.0–4.0 for undergrad). 5.0+ is graduate-level and makes a course unreachable for undergrads — never set this for undergrad courses.
- Courses tagged `elective_pool_tag=biz_elective` flow automatically into any `credits_pool` child bucket scoped to their program — no explicit `master_bucket_courses` row needed.
- `_canonical_program_label` in `server.py` uses CSV label as priority; falls back to generated format only when label is empty.
- Discovery tiers (MCC_DISC_CMI, BNJ, CB, EOH, IC) are `type=track` with `parent_major=MCC_DISC` — they appear in the frontend Discovery Theme section, not the Concentration/Track section.
- `requires_primary_major` in `parent_buckets.csv`: when `True`, a major (e.g., AIM_MAJOR, BUAN_MAJOR) cannot be declared alone — it must be paired with a primary (non-requiring) major like FIN_MAJOR or ACCO_MAJOR. Tests involving these majors must always include a primary major in `declared_majors`.
- V2 parent/child bucket model: when a track is selected alongside its parent major, both the base major's child buckets AND the track's child buckets appear in progress. They coexist (no deduplication/replacement).
- `double_count_policy.csv` controls which child buckets may share courses across programs. Referenced by `allocate_courses()` and `get_allowed_double_count_pairs()`.
- Data model documentation lives at `docs/data_model.md` (Mermaid ER diagram).

# Backend Module Structure
- `server.py`: Flask app, route handlers, data loading, validation logic.
- `allocator.py`: Greedy course allocation to buckets. Exports `allocate_courses`, `_safe_int`, `_infer_requirement_mode`.
- `semester_recommender.py`: Multi-semester recommendation engine. Imports shared helpers from `allocator`.
- `eligibility.py`: Course eligibility filtering (prereqs, standing gates, offering checks).
- `requirements.py`: Bucket/role lookups, constants (`DEFAULT_TRACK_ID`, `SOFT_WARNING_TAGS`).
- `unlocks.py`: Reverse prereq graph for "unlock power" scoring.
- `validators.py`: Prereq chain expansion, input validation.
- `normalizer.py`: Course code normalization.
- `prereq_parser.py`: Prerequisite string parsing.
- `data_loader.py`: CSV data loading with v2 parent/child model support.
- Do not duplicate helper functions across modules; import from the canonical source.

# Performance Rules
- Workbook parsing is expensive: load once at startup and refresh via controlled reload path only.
- Never parse Excel in request handlers (`/recommend`, `/can-take`, `/programs`, `/courses`).
- Use bounded in-process LRU caching (`functools.lru_cache`) for repeated pure computations; invalidate cache when workbook data/mtime changes.
- Avoid repeated full-dataframe scans in hot paths; pre-index/precompute for repeated lookups.
- Assume concurrent requests across multiple Gunicorn workers; protect shared mutable state with locks per process.
- Keep logs concise and operational (`[INFO]`, `[WARN]`, `[OK]`, `[FATAL]`), and never log secrets or full user payloads.

# Never Do
- Never switch production away from static Next export without redesigning backend static serving.
- Never hardcode host/port in deploy paths or bind production traffic to `127.0.0.1`.
- Never reload or reparse data files (`data/` CSVs or `marquette_courses_full.xlsx`) per request.
- Never add unbounded caches or caches without explicit invalidation.
- Never raise worker count aggressively on Render Starter (`0.5` CPU).
- Never break canonical API routes without coordinated frontend and test updates.
- Never commit secrets from `.env` or hardcode secret values in tracked files.
- Never define React components inside render functions (move to module scope or a separate file).
- Never define helper functions in multiple backend modules — import from the canonical source (e.g., `_safe_int` from `allocator`).
