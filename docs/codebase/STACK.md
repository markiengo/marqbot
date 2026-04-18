# Technology Stack

**Analysis Date:** 2026-04-17

## Languages

**Primary:**
- TypeScript 5.9.3 - Student-facing application code in `frontend/src/`, typed API helpers in `frontend/src/lib/api.ts`, and frontend tests/config in `frontend/vitest.config.ts` and `frontend/tsconfig.json`.
- Python 3.x - Backend API and recommendation engine in `backend/server.py` and `backend/data_loader.py`, plus tooling in `scripts/` and backend tests in `tests/backend/`.

**Secondary:**
- JavaScript (ESM/CommonJS) - Frontend build and tool config in `frontend/next.config.js`, `frontend/postcss.config.js`, and `frontend/eslint.config.mjs`.
- CSS - Global design system and page styling in `frontend/src/app/globals.css`.
- YAML - Deployment definitions in `render.yaml`.
- Markdown - Operator and technical docs in `README.md`, `docs/codebase/tech_readme.md`, `docs/memos/algorithm.md`, and the other `docs/codebase/*.md` files.

## Runtime

**Environment:**
- Browser runtime for the planner UI, local session persistence, and browser-only OCR in `frontend/src/hooks/useSession.ts`, `frontend/src/lib/savedPlans.ts`, and `frontend/src/lib/courseHistoryImport.ts`.
- Node.js for Next.js build/dev tooling in `frontend/package.json` and `frontend/next.config.js`.
- Flask + Gunicorn for the backend HTTP service in `backend/server.py` and `infra/docker/Dockerfile`.
- Production container images are `node:20-bookworm-slim` for the frontend build stage and `python:3.11-slim` for the runtime stage in `infra/docker/Dockerfile`.
- Checked-in automation currently consists of `.github/workflows/nightly-sweep.yml` for the focused `@nightly` backend sweep. Broader test, lint, and build gates still run locally through pytest, Vitest, and the documented npm/node commands.

**Package Manager:**
- `npm` - Frontend app dependencies and scripts are declared in `frontend/package.json`; the repo root `package.json` only proxies `npm --prefix frontend run dev`.
- Lockfile: present in `frontend/package-lock.json` and `package-lock.json`.
- `pip` - Backend/runtime dependencies are pinned in `requirements.txt`.
- Lockfile: Python-specific lockfile not detected; `requirements.txt` is the source of truth.

## Frameworks

**Core:**
- Next.js 16.1.6 - Static-export frontend configured in `frontend/package.json` and `frontend/next.config.js`.
- React 19.2.4 / React DOM 19.2.4 - UI component runtime across `frontend/src/app/` and `frontend/src/components/`.
- Flask 3.1.3 - API layer, static asset host, health endpoint, feedback endpoint, and in-process caches in `backend/server.py`.
- Pandas 3.0.1 - CSV/XLSX ingestion and normalization in `backend/data_loader.py` and program/catalog shaping in `backend/server.py`.

**Testing:**
- Pytest 9.0.2 - Backend and engine test runner from `requirements.txt`, configured by `pytest.ini`.
- Vitest 3.2.4 - Frontend test runner from `frontend/package.json`, configured by `frontend/vitest.config.ts`.
- Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`) - Frontend component and DOM tests from `frontend/package.json`.

**Build/Dev:**
- Tailwind CSS 4.2.1 - Utility-first styling pipeline wired through `frontend/postcss.config.js`.
- PostCSS 8.5.6 - CSS processing in `frontend/postcss.config.js`.
- ESLint 9 + `eslint-config-next` - Frontend linting in `frontend/eslint.config.mjs`.
- Gunicorn 25.1.0 - Production WSGI server launched from `infra/docker/Dockerfile`.
- WhiteNoise 6.12.0 - Static `frontend/out/` asset serving in `backend/server.py`.
- Flask-Compress 1.23 - HTTP compression in `backend/server.py`.
- Motion 12.34.3 - UI motion/animation dependency declared in `frontend/package.json`.

## Key Dependencies

**Critical:**
- `next` - App Router frontend and static export pipeline in `frontend/src/app/` and `frontend/next.config.js`.
- `react` / `react-dom` - Interactive UI across `frontend/src/components/` and `frontend/src/context/`.
- `flask` - HTTP routing, request/response handling, and JSON APIs in `backend/server.py`.
- `pandas` - Runtime data assembly from `data/` and Excel compatibility in `backend/data_loader.py`.
- `tesseract.js` - Browser-only course history OCR import in `frontend/src/lib/courseHistoryImport.ts`.

**Infrastructure:**
- `gunicorn` - Container entrypoint in `infra/docker/Dockerfile`.
- `whitenoise` - Static export hosting from `frontend/out/` in `backend/server.py`.
- `flask-compress` - Backend response compression in `backend/server.py`.
- `python-dotenv` - Local environment loading in `backend/server.py`.
- `requests` - HTTP client for maintenance scripts in `scripts/scrape_undergrad_policies.py` and `scripts/eval_advisor_match.py`.
- `openpyxl` - Excel compatibility path for `DATA_PATH` workbook mode in `backend/data_loader.py` and migration/schema tests in `tests/backend/test_schema_migration.py`.

## Configuration

**Environment:**
- Root `.env` and `.env.example` exist for local workflow; `backend/server.py` calls `load_dotenv()` and `infra/README.md` documents that these files stay at the repo root. Contents were not read.
- Backend runtime knobs live in `backend/server.py`: `DATA_PATH`, `FEEDBACK_PATH`, `PORT`, `FLASK_DEBUG`, `SLOW_REQUEST_LOG_MS`, `REQUEST_CACHE_SIZE`, `RECOMMEND_CACHE_SIZE`, `CAN_TAKE_CACHE_SIZE`, `PROGRAM_DATA_CACHE_SIZE`, `RECOMMEND_CACHE_TTL_SECONDS`, `CAN_TAKE_CACHE_TTL_SECONDS`, `PROGRAM_DATA_CACHE_TTL_SECONDS`, `RECOMMEND_CACHE_MAX_BYTES`, and `CAN_TAKE_CACHE_MAX_BYTES`.
- Render blueprint defaults live in `render.yaml`: `PYTHON_VERSION`, `WEB_CONCURRENCY`, `GUNICORN_TIMEOUT`, `GUNICORN_GRACEFUL_TIMEOUT`, `REQUEST_CACHE_SIZE`, and `SLOW_REQUEST_LOG_MS`.
- Frontend dev mode assumes a local backend at `http://localhost:5000` through rewrites in `frontend/next.config.js` and server-side fetch defaults in `frontend/src/lib/api.ts`.

**Build:**
- `frontend/next.config.js` switches between dev rewrites and production `output: "export"`.
- `frontend/tsconfig.json` enables strict TypeScript checks and the `@/*` alias for `frontend/src/*`.
- `frontend/postcss.config.js` wires `@tailwindcss/postcss`.
- `frontend/eslint.config.mjs` extends `eslint-config-next/core-web-vitals`.
- `frontend/vitest.config.ts` defines frontend test roots and path aliases.
- `pytest.ini` scopes backend test discovery to `tests/backend/`.
- `infra/docker/Dockerfile` builds `frontend/out`, copies `backend/`, `data/`, and `config/`, then launches Gunicorn.
- Runtime JSON configuration lives in `config/ranking_overrides.json`.

## Platform Requirements

**Development:**
- Python virtual environment workflow documented in `README.md` and backed by `requirements.txt`.
- Separate frontend install with `npm ci` in `frontend/`, as shown in `README.md` and encoded in `frontend/package.json`.
- A local Flask server on port `5000` is expected for `next dev`, based on `frontend/next.config.js` and `frontend/src/lib/api.ts`.
- Browser support for `localStorage`, `canvas`, and image decoding is required for `frontend/src/hooks/useSession.ts`, `frontend/src/lib/savedPlans.ts`, and `frontend/src/lib/courseHistoryImport.ts`.

**Production:**
- Docker-based web deployment on Render via `render.yaml` and `infra/docker/Dockerfile`.
- The production container must include `backend/`, `data/`, `config/`, and the static export at `frontend/out/`, matching the copy steps in `infra/docker/Dockerfile`.
- Feedback persistence expects a writable filesystem path via `FEEDBACK_PATH` when durable storage is needed, as documented in `infra/README.md` and implemented in `backend/server.py`.
- Health checks target `/api/health` as configured in `render.yaml` and implemented in `backend/server.py`.

---

*Stack analysis: 2026-04-17*
