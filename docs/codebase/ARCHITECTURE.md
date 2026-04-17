# Architecture

**Analysis Date:** 2026-03-28

## Pattern Overview

**Overall:** Static-export frontend + Flask API monolith + file-backed deterministic rule engine

**Key Characteristics:**
- `frontend/src/app/` contains the route entries, but production traffic is served from the exported build in `frontend/out` through `backend/server.py`.
- `backend/server.py` is the orchestration boundary: it loads runtime data once, exposes API routes, hot-reloads CSV changes, and serves SPA/static assets.
- Domain behavior lives in focused Python modules under `backend/` instead of route handlers, while durable product state lives in `data/*.csv`, `config/*.json`, and browser storage.

## Layers

**Presentation layer:**
- Purpose: Render routes, compose feature components, and choose loading/error shells.
- Location: `frontend/src/app/`, `frontend/src/components/`
- Contains: route files such as `frontend/src/app/page.tsx`, `frontend/src/app/onboarding/page.tsx`, `frontend/src/app/planner/page.tsx`, `frontend/src/app/saved/page.tsx`; feature components such as `frontend/src/components/planner/PlannerLayout.tsx`, `frontend/src/components/onboarding/WizardLayout.tsx`, and `frontend/src/components/layout/PlaceholderPage.tsx`
- Depends on: `frontend/src/context/AppContext.tsx`, `frontend/src/hooks/`, `frontend/src/lib/`
- Used by: browser clients and the static export configured in `frontend/next.config.js`

**Client state and integration layer:**
- Purpose: Hold app state, build request payloads, persist session/saved-plan data, and expose typed frontend APIs.
- Location: `frontend/src/context/`, `frontend/src/hooks/`, `frontend/src/lib/`
- Contains: `frontend/src/context/AppContext.tsx`, `frontend/src/context/AppReducer.ts`, `frontend/src/hooks/useCourses.ts`, `frontend/src/hooks/usePrograms.ts`, `frontend/src/hooks/useRecommendations.ts`, `frontend/src/hooks/useCanTake.ts`, `frontend/src/hooks/useSession.ts`, `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`, `frontend/src/lib/savedPlans.ts`
- Depends on: browser `localStorage`, `fetch`, and the backend API exposed by `backend/server.py`
- Used by: route files in `frontend/src/app/` and feature components in `frontend/src/components/`

**API and delivery layer:**
- Purpose: Expose HTTP routes, normalize request payloads, assemble JSON responses, apply caching/rate limits, and serve `frontend/out`.
- Location: `backend/server.py`
- Contains: Flask app setup, `/health`, `/recommend`, `/replan`, `/can-take`, `/validate-prereqs`, canonical `/api/*` aliases, static-file fallback, WhiteNoise wiring, response caches, and feedback persistence hooks
- Depends on: `backend/data_loader.py`, `backend/validators.py`, `backend/allocator.py`, `backend/eligibility.py`, `backend/semester_recommender.py`, `backend/student_stage.py`, `backend/unlocks.py`, `backend/normalizer.py`
- Used by: `frontend/src/lib/api.ts`, Render health checks defined in `render.yaml`, and local development through `scripts/run_local.py`

**Domain engine layer:**
- Purpose: Enforce the degree-planning rules independently of HTTP and React.
- Location: `backend/`
- Contains: `backend/data_loader.py`, `backend/allocator.py`, `backend/eligibility.py`, `backend/semester_recommender.py`, `backend/scheduling_styles.py`, `backend/requirements.py`, `backend/prereq_parser.py`, `backend/validators.py`, `backend/student_stage.py`, `backend/unlocks.py`, `backend/normalizer.py`
- Depends on: `data/`, `config/ranking_overrides.json`, pandas dataframes, and shared runtime indexes assembled during load
- Used by: `backend/server.py`, backend tests in `tests/backend/`, and maintenance scripts such as `scripts/validate_track.py` and `scripts/scrape_undergrad_policies.py`

**Data and configuration layer:**
- Purpose: Provide the source-of-truth catalog, program structure, equivalencies, policies, and manual ranking overrides.
- Location: `data/`, `config/`
- Contains: `data/courses.csv`, `data/parent_buckets.csv`, `data/child_buckets.csv`, `data/master_bucket_courses.csv`, `data/course_hard_prereqs.csv`, `data/course_soft_prereqs.csv`, `data/course_equivalencies.csv`, `data/policies.csv`, `data/policies_buckets.csv`, `config/ranking_overrides.json`
- Depends on: manual editing and the loaders in `backend/data_loader.py` and `backend/semester_recommender.py`
- Used by: the backend runtime, nightly scripts in `scripts/`, and integrity tests in `tests/backend/`

**Operations and verification layer:**
- Purpose: Build, run, deploy, and verify the application outside request handling.
- Location: `scripts/`, `tests/`, `frontend/tests/`, `infra/docker/`, `.github/workflows/`, `render.yaml`
- Contains: `scripts/run_local.py`, `scripts/ensure_frontend_build.py`, `tests/backend/conftest.py`, `tests/backend/test_recommend_api_contract.py`, `frontend/tests/profileModal.dom.test.ts`, `frontend/vitest.config.ts`, `pytest.ini`, `render.yaml`
- Depends on: the application code and local toolchains
- Used by: developers, CI, and Render deployments

## Data Flow

**Frontend bootstrap flow:**

1. `frontend/src/app/layout.tsx` wraps every route in `AppProvider` from `frontend/src/context/AppContext.tsx`.
2. Route files such as `frontend/src/app/onboarding/page.tsx`, `frontend/src/app/planner/page.tsx`, and `frontend/src/app/saved/page.tsx` call `useCourses()` and `usePrograms()`.
3. `frontend/src/hooks/useCourses.ts` and `frontend/src/hooks/usePrograms.ts` fetch `/api/courses` and `/api/programs` through `frontend/src/lib/api.ts`, then store results through `frontend/src/context/AppReducer.ts`.
4. Components under `frontend/src/components/` render loading, retry, or live UI based on that shared state.

**Recommendation flow:**

1. Planner selections live in `AppState` from `frontend/src/lib/types.ts` and are updated through actions in `frontend/src/context/AppReducer.ts`.
2. `frontend/src/hooks/useRecommendations.ts` converts that state into a POST payload for `frontend/src/lib/api.ts`.
3. `backend/server.py` normalizes courses and program selection, expands prereq assumptions through `backend/validators.py`, loads effective data from `backend/data_loader.py`, and computes progress through `backend/allocator.py`.
4. `backend/eligibility.py`, `backend/scheduling_styles.py`, `backend/unlocks.py`, and `backend/semester_recommender.py` filter, rank, and select the semester recommendations.
5. The JSON response returns to `frontend/src/components/planner/PlannerLayout.tsx`, which keeps current-progress surfaces tied to the canonical `/api/recommend` audit while using `/api/replan` only for downstream semester projections and edit/swap flows.

**Eligibility check flow:**

1. `frontend/src/components/planner/CanTakeSection.tsx` calls `frontend/src/hooks/useCanTake.ts`.
2. `frontend/src/hooks/useCanTake.ts` builds a single-course request from the current context state and posts to `/api/can-take` via `frontend/src/lib/api.ts`.
3. `backend/server.py` normalizes the request, expands in-progress assumptions, and delegates the actual decision to `check_can_take()` in `backend/eligibility.py`.
4. The result comes back as `CanTakeResponse` from `frontend/src/lib/types.ts` and is rendered in the planner panel.

**Session and saved-plan persistence flow:**

1. `frontend/src/hooks/useSession.ts` restores lightweight planner state plus manual-add pins from browser storage after the catalog is loaded.
2. Session restore does not revive a cached recommendation snapshot; `frontend/src/context/AppReducer.ts` restores planner inputs, then the planner triggers a fresh canonical `/api/recommend` fetch when it needs live results again.
3. `frontend/src/components/saved/SavedPlansLibraryPage.tsx` and `frontend/src/components/saved/SavedPlanDetailPage.tsx` use `frontend/src/hooks/useSavedPlans.ts` plus helpers in `frontend/src/lib/savedPlans.ts` and `frontend/src/lib/savedPlanPresentation.ts`, with saved-plan records carrying manual-add intent separately from the stored recommendation snapshot.
4. `frontend/src/app/saved/page.tsx` switches between the saved-plan library and detail view by reading the `plan` query parameter instead of a true route segment.

**Build and delivery flow:**

1. `frontend/next.config.js` exports a static site in production and only uses API rewrites during `next dev`.
2. `scripts/run_local.py` calls `scripts/ensure_frontend_build.py`, then starts `backend/server.py`.
3. `backend/server.py` serves `frontend/out` directly, maps canonical `/api/*` routes, and falls back to `index.html` for client-side navigation.
4. `render.yaml` deploys the repository through `infra/docker/` and health-checks `backend/server.py` at `/api/health`.

**State Management:**
- Shared client state lives in `frontend/src/context/AppContext.tsx` and `frontend/src/context/AppReducer.ts`, split into catalog, course-history, program-selection, preferences, UI, and recommendation contexts.
- Route- or component-local UI state stays inside feature components such as `frontend/src/components/planner/PlannerLayout.tsx` and `frontend/src/components/saved/SavedPlanDetailPage.tsx`.
- Backend request state is stateless per call except for process-level caches in `backend/server.py` and the module-global runtime dataset loaded from `backend/data_loader.py`.

## Key Abstractions

**App state model:**
- Purpose: Represent the entire client-side planner state in one typed shape.
- Examples: `frontend/src/lib/types.ts`, `frontend/src/context/AppReducer.ts`, `frontend/src/context/AppContext.tsx`
- Pattern: a single `AppState` reducer feeds split React contexts so components can subscribe to narrower slices without duplicating source of truth.

**Typed API contracts:**
- Purpose: Keep the frontend and backend aligned on response shapes.
- Examples: `frontend/src/lib/types.ts`, `frontend/src/lib/api.ts`, `backend/server.py`
- Pattern: the frontend defines transport interfaces such as `RecommendationResponse`, `SemesterData`, `ProgramBucketTree`, and `CanTakeResponse`, then all hooks consume those contracts instead of raw `any` payloads.

**Runtime data bundle:**
- Purpose: Hold the catalog, bucket graphs, prereq maps, equivalencies, and cached runtime indexes in one server-side object.
- Examples: `backend/data_loader.py`, `backend/server.py`, `backend/allocator.py`
- Pattern: `load_data()` builds a reusable dictionary once, and downstream modules consume precomputed indexes instead of reparsing CSVs per request.

**Requirement allocation model:**
- Purpose: Separate "what counts toward progress" from "what can be recommended next."
- Examples: `backend/allocator.py`, `backend/requirements.py`, `backend/semester_recommender.py`
- Pattern: completed and in-progress courses are first allocated into buckets, then eligibility and ranking work against the unmet bucket view produced by that allocation.

**Browser snapshot model:**
- Purpose: Persist planner state without a server-side user account.
- Examples: `frontend/src/hooks/useSession.ts`, `frontend/src/hooks/useSavedPlans.ts`, `frontend/src/lib/savedPlans.ts`
- Pattern: browser-local snapshots store normalized planner inputs and, when available, the last recommendation payload so views can rehydrate offline.

## Entry Points

**Backend runtime:**
- Location: `backend/server.py`
- Triggers: `python backend/server.py`, `scripts/run_local.py`, Docker or Render startup, and pytest fixtures that import the Flask app
- Responsibilities: load runtime data, expose API routes, serve `frontend/out`, manage response caching, rate limiting, and health checks

**Local development launcher:**
- Location: `scripts/run_local.py`
- Triggers: `python scripts/run_local.py`
- Responsibilities: ensure the frontend build exists, validate the backend entrypoint path, and start the Flask server from the repo root

**Frontend root shell:**
- Location: `frontend/src/app/layout.tsx`
- Triggers: every route render in the Next.js app
- Responsibilities: load fonts, import global CSS, mount `AppProvider`, render the top navigation, and provide the `<main>` shell

**Planner route:**
- Location: `frontend/src/app/planner/page.tsx`
- Triggers: `/planner`
- Responsibilities: bootstrap catalog and program data, restore session state through `useSession()`, and hand control to `frontend/src/components/planner/PlannerLayout.tsx`

**Onboarding route:**
- Location: `frontend/src/app/onboarding/page.tsx`
- Triggers: `/onboarding`
- Responsibilities: load catalog and program data, run the step wizard from `frontend/src/hooks/useOnboarding.ts`, and forward completed onboarding into the planner

**Saved route:**
- Location: `frontend/src/app/saved/page.tsx`
- Triggers: `/saved` and `/saved?plan=<id>`
- Responsibilities: choose between the saved-plan library and saved-plan detail screen, both backed by the shared saved-plan components under `frontend/src/components/saved/`

## Error Handling

**Strategy:** Validate early at the route boundary, return structured JSON from `backend/server.py`, and let route-level frontend pages render dedicated loading or retry shells.

**Patterns:**
- `backend/server.py` returns explicit 4xx and 5xx JSON payloads for malformed inputs, missing catalog data, unknown `/api/*` routes, and missing frontend builds; its helper functions normalize bad env and config values instead of crashing mid-request.
- `frontend/src/hooks/useCourses.ts`, `frontend/src/hooks/usePrograms.ts`, `frontend/src/hooks/useRecommendations.ts`, and `frontend/src/hooks/useCanTake.ts` capture async failures into `error` state, while `frontend/src/app/onboarding/page.tsx`, `frontend/src/app/planner/page.tsx`, `frontend/src/components/saved/SavedPlansLibraryPage.tsx`, and `frontend/src/components/saved/SavedPlanDetailPage.tsx` render retry UI instead of throwing.
- Browser storage helpers in `frontend/src/hooks/useSession.ts` ignore quota and private-mode failures, and backend startup in `backend/server.py` fails fast only when the core dataset cannot be loaded.

## Cross-Cutting Concerns

**Logging:** `backend/server.py` logs startup, slow requests, reload warnings, and fatal loader errors to stdout or stderr; frontend fetch hooks such as `frontend/src/hooks/useCourses.ts` and `frontend/src/hooks/usePrograms.ts` log fetch failures with `console.error`.

**Validation:** Input normalization is concentrated in `backend/server.py`, `backend/normalizer.py`, and `backend/validators.py`; domain-specific gating happens in `backend/eligibility.py`, `backend/student_stage.py`, and `backend/requirements.py`; client-side guards like `frontend/src/hooks/useOnboarding.ts` only block obvious invalid UI states.

**Authentication:** Not detected. The current architecture uses anonymous requests to `backend/server.py`, stores planner state in the browser through `frontend/src/hooks/useSession.ts` and `frontend/src/hooks/useSavedPlans.ts`, and has no user-account or backend-session layer.

---

*Architecture analysis: 2026-03-28*
