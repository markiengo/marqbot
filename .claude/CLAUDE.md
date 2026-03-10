# 2026-03-08 Current Overrides

If anything below conflicts with this section, trust this section.

- Current deploy target is Render, not Vercel. Production stays as one Dockerized Flask service that serves both the API and the static Next export.
- Canonical runtime data now uses split prereq CSVs plus equivalencies:
  - `course_hard_prereqs.csv`
  - `course_soft_prereqs.csv`
  - `course_equivalencies.csv`
  - `course_offerings.csv` is still loaded, but recommendation filtering currently treats courses as available every term.
- `course_prereqs.csv` and `double_count_policy.csv` are no longer canonical runtime inputs for the current repo state.
- Canonical API routes now include `GET /api/courses` and `POST /api/feedback` in addition to the existing health/programs/recommend/can-take/validate-prereqs routes.
- Planner state now includes saved plans in browser localStorage and an in-app feedback modal in the planner header.
- Feedback submissions are stored through `FEEDBACK_PATH`; on Render this should point at a persistent disk file.
- Honors students can receive honors-section variants, and honors/base equivalents are deduplicated in recommendations.
- Important env vars now include `REQUEST_CACHE_SIZE`, `SLOW_REQUEST_LOG_MS`, and `FEEDBACK_PATH`.
- Frontend default test command is `cd frontend; npm test`; backend default test command is `.\.venv\Scripts\python.exe -m pytest -q`.
- Current Vitest config excludes `tests/frontend/*.dom.test.ts` from the default run, but includes `frontend/tests/*.dom.test.ts`.
- User preference from this session: do not run local tests unless explicitly asked. Let GitHub / nightly handle verification.
- `docs/` is pushable now; do not assume any docs subtree is local-only.
- `docs/feedbacks/` is local-only even though `docs/` is pushable. Do not commit feedback logs.
- `.claude/` stays local-only. Do not push it.
- Prefer `local` for normal work, never push `local`, and be explicit before pushing if `main` is already ahead of `origin/main`.
- Release preference from this session: do not create a new release by default; replace the most recent release notes with the new notes unless the user explicitly asks for a new release.

# Overview
MarqBot is a deterministic degree-planning assistant for Marquette business students and advisors, generating recommendations, requirement progress, and can-take checks from workbook-driven rules.

# Architecture
- `backend/`: Flask API and deterministic recommendation/allocation engine.
- `frontend/`: Next.js 16 + React 19 + TypeScript UI; production output is static export (`frontend/out`).
- `scripts/`: local run helpers and workbook governance/migration utilities. One-time migration scripts are archived under `scripts/archive/`.
- `tests/backend`, `tests/frontend`: pytest and vitest coverage.
- `infra/docker/Dockerfile` + `render.yaml`: Docker/Render deployment wiring.
- `data/`: canonical runtime data source (CSV directory). Current runtime CSVs are `courses.csv`, `course_hard_prereqs.csv`, `course_soft_prereqs.csv`, `course_offerings.csv`, `course_equivalencies.csv`, `parent_buckets.csv`, `child_buckets.csv`, `master_bucket_courses.csv`, and `quips.csv`.
- `marquette_courses_full.xlsx`: legacy Excel source; still present but no longer the default. Override with `DATA_PATH=marquette_courses_full.xlsx` to use it.

# Commands
- **Setup**: `python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt; cd frontend; npm ci`
- **Full stack**: `.\.venv\Scripts\python.exe scripts/run_local.py`
- **Backend only**: `.\.venv\Scripts\python.exe backend/server.py`
- **Frontend dev**: `cd frontend; npm run dev` | **Build**: `npm run build`
- **Backend tests (focused, use first)**: closest relevant file in `tests/backend/`
- **Backend tests (standard suite)**: `.\.venv\Scripts\python.exe -m pytest -q`
- **Backend planner sweep**: `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q`
- **Backend nightly sweep**: `.\.venv\Scripts\python.exe -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q` (only when explicitly requested or release-grade confidence is needed)
- **Frontend tests (default config)**: `cd frontend; npm test`
- **Frontend pushable checks**: `cd frontend; npm test; npm run lint; npm run build`
- **Validate tracks**: `.\.venv\Scripts\python.exe scripts/validate_track.py --all`
- **Docker**: `docker build -f infra/docker/Dockerfile -t marqbot:local .` → `docker run --rm -p 5000:5000 -e PORT=5000 -e WEB_CONCURRENCY=1 marqbot:local`

# Conventions
- Keep backend logic deterministic and data-first (no LLM/external API calls in request paths).
- Preserve canonical API routes and contracts: `/api/health`, `/api/courses`, `/api/programs`, `/api/recommend`, `/api/can-take`.
- Reuse existing pipeline helpers before adding new logic (`normalize_input`, `allocate_courses`, `run_recommendation_semester`, validators).
- Normalize user/program/course inputs consistently (uppercase canonical IDs/codes).
- Keep frontend API access centralized in `frontend/src/lib/api.ts` and shared payload types in `frontend/src/lib/types.ts`.
- Preserve static-export compatibility in frontend code (no production assumptions requiring `next start` server features).
- Keep student-facing writing short, plain, and understandable to students first. Avoid jargon unless the page is explicitly technical.
- Environment variables used by runtime: `DATA_PATH`, `PORT`, `FLASK_DEBUG`, `WEB_CONCURRENCY`, `PYTHON_VERSION`.
- `tests/test_structure.md` is the local test inventory. Update it when test files are added, removed, renamed, regrouped, or when default-vs-extra test run guidance changes.

# Deployment Rules
- Target is Render Starter (`0.5` CPU): optimize for low CPU headroom and predictable latency.
- Gunicorn startup must remain functionally equivalent to:
```bash
gunicorn --chdir backend server:app --bind 0.0.0.0:${PORT:-5000} --workers ${WEB_CONCURRENCY:-1} --timeout ${GUNICORN_TIMEOUT:-90} --graceful-timeout ${GUNICORN_GRACEFUL_TIMEOUT:-30}
```
- Always bind to `0.0.0.0` and always honor `$PORT`.
- Default `WEB_CONCURRENCY` is `1`; increase only with measured evidence on Render Starter.
- Keep production frontend serving model as Flask + static export (`frontend/out`).

# Data Model Rules
- All checked-in runtime CSVs in `data/` should be read with `encoding="utf-8-sig"` (BOM-safe) when using Python's csv module directly.
- `parent_bucket_label` values are the display names shown to users — no "Major" or "Minor" suffix. Labels must be clean (e.g., "Finance", "Accounting", "Marketing").
- Soft warning metadata now lives in `course_soft_prereqs.csv`; do not rely on a legacy `prereq_warnings` field in `course_prereqs.csv`.
- `min_standing` is a float (1.0–4.0 for undergrad). 5.0+ is graduate-level and makes a course unreachable for undergrads — never set this for undergrad courses.
- Courses tagged `elective_pool_tag=biz_elective` flow automatically into any `credits_pool` child bucket scoped to their program — no explicit `master_bucket_courses` row needed.
- `_canonical_program_label` in `server.py` uses CSV label as priority; falls back to generated format only when label is empty.
- Discovery tiers (MCC_DISC_CMI, BNJ, CB, EOH, IC) are `type=track` with `parent_major=MCC_DISC` — they operate like AIM's track model (5 separate theme programs under one parent). Currently `active=False` and tagged "Coming Soon" until official Marquette data is available.
- **Orphaned prereq problem:** Non-business courses (HIST, POSC, SPAN, MATH, etc.) added to `courses.csv` as gap fixes often lack full prereq/offering data. These exist so that MCC Discovery or cross-department prereq references resolve, but they are not fully curated. When injecting new courses, their prereqs may reference courses not yet in `courses.csv` — this is expected and not a bug. Do not chase transitive prereq chains outside the business school scope.
- Non-business courses without bucket mappings or `biz_elective` tags are present solely to satisfy prereq references or future MCC Discovery mappings. They are not recommended by the engine unless mapped to an active bucket.
- `requires_primary_major` in `parent_buckets.csv`: when `True`, a major (e.g., AIM_MAJOR, BUAN_MAJOR) cannot be declared alone — it must be paired with a primary (non-requiring) major like FIN_MAJOR or ACCO_MAJOR. Tests involving these majors must always include a primary major in `declared_majors`.
- V2 parent/child bucket model: when a track is selected alongside its parent major, both the base major's child buckets AND the track's child buckets appear in progress. They coexist (no deduplication/replacement).
- No-double-count behavior is now driven by `course_equivalencies.csv` groups with `type=no_double_count`.
- Data model documentation lives at `data/data_model.md` (Mermaid ER diagram).

# Backend Module Structure
- `server.py`: Flask app, route handlers, data loading, validation logic.
- `allocator.py`: Greedy course allocation to buckets. Exports `allocate_courses`, `_safe_int`, `_infer_requirement_mode`.
- `semester_recommender.py`: Multi-semester recommendation engine. Imports shared helpers from `allocator`.
- `eligibility.py`: Course eligibility filtering (prereqs, standing gates, offering checks, student stage gate). `_is_non_recommendable_course()` excludes internships, work periods, independent studies, and topics courses from recommendations (they still count toward progress when completed).
- `student_stage.py`: Student stage inference and validation. Exports `normalize_student_stage`, `infer_student_stage_from_courses`, `stage_allows_course_level`, `build_student_stage_block_message`. Valid stages: `undergrad` (1000-4000), `graduate` (5000-7999), `doctoral` (8000+).
- `requirements.py`: Bucket/role lookups, constants (`DEFAULT_TRACK_ID`, `SOFT_WARNING_TAGS`).
- `unlocks.py`: Reverse prereq graph, `compute_chain_depths()` for transitive prereq chain scoring, `get_direct_unlocks()` for 1-level unlock counts, `get_blocking_warnings()` for core blocker alerts.
- `validators.py`: Prereq chain expansion, input validation.
- `normalizer.py`: Course code normalization.
- `prereq_parser.py`: Prerequisite string parsing.
- `data_loader.py`: CSV data loading with v2 parent/child model support.
- Do not duplicate helper functions across modules; import from the canonical source.

# Recommendation Algorithm
- Ranking key order (in `semester_recommender.py`): tier → core_prereq_blocker → bridge_course → chain_depth → course_level → multi_bucket_score → lexical tiebreak.
- `compute_chain_depths()` runs once at startup and on data reload; passed to `run_recommendation_semester()` via `chain_depths` kwarg.
- Program balance deferral threshold is `_PROGRAM_BALANCE_THRESHOLD = 2`. Deferred candidates get a second pass after the main greedy loop.
- Post-loop rescue pass: when both main loop and deferred pass produce zero selections but unsatisfied buckets remain, force-assign candidates to any mapped bucket (even at capacity). Overfilling is better than dead-ending. Only fires as last resort — normal caps preserved otherwise.
- Bucket satisfaction uses OR logic: if either course-count or credit threshold is met, the bucket is satisfied (`_compute_satisfied()` in `semester_recommender.py`).
- `hard_prereq_complex` tag should only exist on courses with genuinely unparseable prerequisites. All courses with parseable prereqs (type = single, and, or, none) must NOT have this tag.
- Non-recommendable course groups (filtered by `_is_non_recommendable_course` in `eligibility.py`): **internships**, **work periods**, **independent studies**, and **"Topics in..." courses**. These still count toward bucket progress when completed/in-progress.
- Standing-recovery fallback: if unmet requirements remain but the remaining path is blocked only by `min_standing`, recommend eligible filler courses that build credits toward the blocked standing requirement instead of returning an empty semester.
- Student stage hard gate: `/recommend` and `/can-take` accept optional `student_stage` (`undergrad`, `graduate`, `doctoral`). When set, courses outside the stage's level band are excluded from recommendations and blocked in can-take. When missing, stage is inferred from the highest course level in completed/in-progress history (default: `undergrad`). The gate filters future recommendations only — completed/in-progress history is never restricted. Frontend stage state lives in `studentStage.ts`; backend logic in `student_stage.py` and `eligibility.py`.

# Performance Rules
- Workbook parsing is expensive: load once at startup and refresh via controlled reload path only.
- Never parse Excel in request handlers (`/recommend`, `/can-take`, `/programs`, `/courses`).
- Use bounded in-process LRU caching (`functools.lru_cache`) for repeated pure computations; invalidate cache when workbook data/mtime changes.
- Avoid repeated full-dataframe scans in hot paths; pre-index/precompute for repeated lookups.
- Assume concurrent requests across multiple Gunicorn workers; protect shared mutable state with locks per process.
- Keep logs concise and operational (`[INFO]`, `[WARN]`, `[OK]`, `[FATAL]`), and never log secrets or full user payloads.

# Branch Strategy
- Two branches: `main` (pushed to remote, clean) and `local` (never pushed, superset of main).
- Source of truth for what is tracked vs local-only is `.gitignore` in the current branch. Do not maintain manual allow/deny lists in this file.
- Always work on `local`. To push: checkout `main`, merge `local`, restore/unstage local-only files, push, return to `local`. Or: commit pushable work on `main` directly, then `git checkout local && git merge main`.
- **Never push the `local` branch to remote.**
- `.github/workflows/nightly-sweep.yml` is the single CI workflow. PR gate jobs (backend regression, planner fast, frontend) run on pull requests; nightly exhaustive sweep runs on schedule at `2:39 AM` Milwaukee time (two UTC cron entries + hour-based `America/Chicago` gate).
- Backend standard pytest run is `.\.venv\Scripts\python.exe -m pytest -q`; it excludes `nightly` via `pytest.ini`.
- Frontend default Vitest run excludes `tests/frontend/*.dom.test.ts` but includes `frontend/tests/*.dom.test.ts`.

# Action rules
- Never switch production away from static Next export without redesigning backend static serving.
- Never hardcode host/port in deploy paths or bind production traffic to `127.0.0.1`.
- Never reload or reparse data files (`data/` CSVs or `marquette_courses_full.xlsx`) per request.
- Never add unbounded caches or caches without explicit invalidation.
- Never raise worker count aggressively on Render Starter (`0.5` CPU).
- Never break canonical API routes without coordinated frontend and test updates.
- Never commit secrets from `.env` or hardcode secret values in tracked files.
- Never define React components inside render functions (move to module scope or a separate file).
- Never define helper functions in multiple backend modules — import from the canonical source (e.g., `_safe_int` from `allocator`).
- Never push the `local` branch to remote.
- Follow `.gitignore` for docs/local-only policy; if policy changes, update `.gitignore` first. Read gitignore first before tracking any files that I tag in my prompts. 
- Keep `.claude/` local-only and ignored.

# Known Dev Environment Issues
- **Claude Code Bash tool on Windows**: The Bash tool may return empty output on Windows (known issue, GitHub #26545). Workaround: use Agent tool to spawn subagents for running commands, or run commands directly in a separate terminal. Setting `CLAUDE_CODE_GIT_BASH_PATH` environment variable to Git Bash path (e.g., `$env:CLAUDE_CODE_GIT_BASH_PATH = "C:\Program Files\Git\bin\bash.exe"` in PowerShell) may help but is not guaranteed.

# Prereq Data Rules
- `course_hard_prereqs.csv` uses `;` for AND (all required) and `or` for OR (any one). Mixed AND/OR is supported: `A;B;C or D or E` means "A AND B AND (C or D or E)". `none` = no prereqs.
- OR alternatives in prereqs should be avoided — they cause phantom recommendations. Use AND where all prereqs are truly required, keep only the primary course otherwise. Exception: mixed AND/OR is acceptable when a course genuinely requires "all of X plus one of Y" (e.g., OSCM 4997).
- `course_equivalencies.csv` already handles equivalence expansion for completed/in-progress credit checks, prereq satisfaction, and bucket mapping.
- `hard_prereq_complex` tag is reserved for genuinely unparseable patterns (e.g., "choose 2 from 5"). Currently: no business-school courses use this tag. INSY 4158's "2 from 5" prereq was moved to `other_requirements` soft tag.
- CORE 1929 (`THEO 1001 or PHIL 1001`) is the only intentional OR prereq — kept because both options are commonly known MCC Foundation courses.
