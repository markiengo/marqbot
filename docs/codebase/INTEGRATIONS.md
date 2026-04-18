# External Integrations

**Analysis Date:** 2026-04-17

## APIs & External Services

**Hosting / Edge Entry Point:**
- Render - Production web hosting is defined in `render.yaml`, which points to `infra/docker/Dockerfile` and uses `/api/health` for health checks.
  - SDK/Client: No Render SDK in app code; deployment is configuration-driven through `render.yaml`.
  - Auth: Render-managed service credentials are outside the repo; no in-repo auth client is present.

**External Content Source (maintenance-only):**
- Marquette Bulletin - Policy text scraping is implemented in `scripts/scrape_undergrad_policies.py` and writes output to `docs/memos/policies.md` by default.
  - SDK/Client: `requests` plus an optional `beautifulsoup4` import inside `scripts/scrape_undergrad_policies.py`.
  - Auth: None detected; the script fetches public pages at `https://bulletin.marquette.edu`.

**Browser-side OCR (local, no outbound API):**
- Tesseract.js - Screenshot parsing for course-history import runs in the browser in `frontend/src/lib/courseHistoryImport.ts`.
  - SDK/Client: `tesseract.js` from `frontend/package.json`.
  - Auth: Not applicable; OCR runs locally on the client.

**Source Control Automation:**
- GitHub Actions plus local GitHub tooling. The repo now includes `.github/workflows/nightly-sweep.yml` for the focused `@nightly` planner sweep, while other review and ship flows remain local through `git` and optional `gh`.
  - SDK/Client: GitHub-hosted Actions runners, local `git`, and optional `gh` usage from developer workflow scripts and skills.
  - Auth: GitHub-hosted workflow token for Actions; developer-local GitHub auth when `gh` is used.

## Data Storage

**Databases:**
- Not detected - Runtime state is file-backed rather than database-backed, as shown by CSV loading in `backend/data_loader.py` and the architecture notes in `backend/TECHNICAL_README.md`.
  - Connection: `DATA_PATH` only selects a filesystem path in `backend/server.py`; it is not a database DSN.
  - Client: `pandas` plus the custom `_CsvDirSource` adapter in `backend/data_loader.py`.

**File Storage:**
- Local filesystem only.
  - Runtime source data lives in `data/` and is loaded by `backend/data_loader.py`.
  - Runtime config JSON lives in `config/` and is shipped by `infra/docker/Dockerfile`.
  - Static frontend output is built into `frontend/out/` and served by `backend/server.py`.
  - Feedback is appended to `feedback.jsonl` by default or to `FEEDBACK_PATH` in `backend/server.py`; `infra/README.md` recommends a Render persistent disk for production.
  - Client-side saved plans and session state live in browser `localStorage` via `frontend/src/lib/savedPlans.ts` and `frontend/src/hooks/useSession.ts`.
  - Session restore keeps lightweight planner inputs plus manual-add pins in browser storage, then relies on a fresh canonical `/api/recommend` fetch instead of reviving a cached recommendation snapshot.

**Caching:**
- No external cache service detected.
- Backend response caching is in-process only, via the `_LruResponseCache` instances in `backend/server.py`.

## Authentication & Identity

**Auth Provider:**
- None - No login system, OAuth provider, session middleware, or user-account store was detected in `frontend/` or `backend/`.
  - Implementation: Anonymous planner state is stored in browser `localStorage` by `frontend/src/hooks/useSession.ts` and `frontend/src/lib/savedPlans.ts`; feedback submissions are rate-limited per client IP in `backend/server.py`.

## Monitoring & Observability

**Error Tracking:**
- Not detected - The backend currently relies on stdout/stderr logging in `backend/server.py`; no external error-tracking SDK is initialized.

**Logs:**
- Request timing, data reload warnings, and startup diagnostics are printed to stdout/stderr in `backend/server.py`.
- Slow-request logging is controlled by `SLOW_REQUEST_LOG_MS` in `backend/server.py` and surfaced through Render container logs.
- Health status is exposed at `/health` and `/api/health` in `backend/server.py`.

## CI/CD & Deployment

**Hosting:**
- Render Docker service declared in `render.yaml`.
- Production image is built from `infra/docker/Dockerfile`, which compiles the frontend static export and runs Gunicorn against `backend/server.py`.

**CI Pipeline:**
- `.github/workflows/nightly-sweep.yml` runs the `@nightly` pytest suite on a guarded three-day cadence at 4:00 AM America/Chicago and also supports manual dispatch.
- The workflow uploads a markdown summary plus raw `nightly_output.txt` as artifacts and fails the run when nightly tests fail.
- Backend regression tests, planner guardrails, frontend tests, and helper smoke tests are still expected to run locally before shipping changes.
- Historical nightly artifacts remain under `tests/nightly_reports/`, and the checked-in workflow now regenerates fresh nightly artifacts for the focused sweep.

## Environment Configuration

**Required env vars:**
- No secret env vars are strictly required for local development because `backend/server.py` has defaults for `DATA_PATH`, `FEEDBACK_PATH`, `PORT`, and cache settings.
- Production/runtime-critical variables are supplied through `render.yaml` or the host environment: `PORT`, `WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, `GUNICORN_GRACEFUL_TIMEOUT`, `REQUEST_CACHE_SIZE`, and `SLOW_REQUEST_LOG_MS`.
- Optional integration variables include `FEEDBACK_PATH`, `DATA_PATH`, `RENDER_GIT_COMMIT`, `RECOMMEND_CACHE_SIZE`, `CAN_TAKE_CACHE_SIZE`, `PROGRAM_DATA_CACHE_SIZE`, `RECOMMEND_CACHE_TTL_SECONDS`, `CAN_TAKE_CACHE_TTL_SECONDS`, `PROGRAM_DATA_CACHE_TTL_SECONDS`, `RECOMMEND_CACHE_MAX_BYTES`, and `CAN_TAKE_CACHE_MAX_BYTES` from `backend/server.py`.

**Secrets location:**
- Root `.env` and `.env.example` exist and are discovered by `load_dotenv()` in `backend/server.py`; contents were not read.
- Render-managed environment variables are referenced by `render.yaml` but secret values are expected outside the repo.
- GitHub-hosted workflow credentials are managed by Actions; no custom repo secrets are referenced by the checked-in nightly workflow.

## Webhooks & Callbacks

**Incoming:**
- Render health checks call `/api/health` as configured in `render.yaml`.
- No webhook receiver endpoints beyond normal app routes were detected in `backend/server.py`.

**Outgoing:**
- `scripts/scrape_undergrad_policies.py` performs HTTP GET requests to `https://bulletin.marquette.edu` and linked policy pages.
- The checked-in nightly workflow uses GitHub Actions only for scheduling, checkout, and artifact upload. Local developer workflows may still call GitHub APIs through `gh`.
- Frontend runtime code in `frontend/src/lib/api.ts` only calls same-origin backend routes (`/api/courses`, `/api/programs`, `/api/program-buckets`, `/api/recommend`, `/api/replan`, `/api/validate-prereqs`, `/api/can-take`, `/api/feedback`) or `http://localhost:5000` during local server-side dev execution.

---

*Integration audit: 2026-04-17*
