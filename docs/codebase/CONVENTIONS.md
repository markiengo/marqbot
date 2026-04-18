# Coding Conventions

**Analysis Date:** 2026-04-17

## Naming Patterns

**Files:**
- Frontend route files use framework names under `frontend/src/app/`, such as `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`, and `frontend/src/app/onboarding/page.tsx`.
- Frontend component files use `PascalCase.tsx` under `frontend/src/components/`, such as `frontend/src/components/onboarding/CoursesStep.tsx`, `frontend/src/components/shared/Button.tsx`, and `frontend/src/components/saved/SavedPlanDetailPage.tsx`.
- Frontend hooks and utility modules use `camelCase.ts` or `use*.ts`, such as `frontend/src/hooks/useRecommendations.ts`, `frontend/src/hooks/usePrograms.ts`, `frontend/src/lib/studentStage.ts`, and `frontend/src/lib/savedPlans.ts`.
- Backend runtime modules use `snake_case.py`, such as `backend/semester_recommender.py`, `backend/student_stage.py`, `backend/data_loader.py`, and `backend/server.py`.
- Backend tests use `test_*.py` under `tests/backend/`; frontend tests use `*.test.ts` and `*.dom.test.ts` under both `tests/frontend/` and `frontend/tests/`.

**Functions:**
- React components and providers are `PascalCase`, such as `CoursesStep`, `Button`, `RootLayout`, and `AppProvider` in `frontend/src/components/onboarding/CoursesStep.tsx`, `frontend/src/components/shared/Button.tsx`, `frontend/src/app/layout.tsx`, and `frontend/src/context/AppContext.tsx`.
- Frontend hooks and helpers are `camelCase`, with hooks always prefixed `use`, such as `useRecommendations`, `fetchCoursesOnce`, `normalizeSessionSnapshot`, and `loadPrograms` in `frontend/src/hooks/useRecommendations.ts`, `frontend/src/hooks/useCourses.ts`, `frontend/src/context/AppReducer.ts`, and `frontend/src/lib/api.ts`.
- Python functions are `snake_case`; private helpers use a leading underscore, such as `_reload_data_if_changed`, `_build_in_progress_note`, `_payload`, and `_expand_with_scheduling_styles` in `backend/server.py`, `backend/semester_recommender.py`, `tests/backend/test_recommend_api_contract.py`, and `tests/backend/test_dead_end_fast.py`.
- Reducer action names are uppercase string literals, such as `"SET_COURSES"`, `"LOAD_PROGRAMS_FAILURE"`, and `"APPLY_PLANNER_SNAPSHOT"` in `frontend/src/context/AppReducer.ts`.

**Variables:**
- Frontend locals, props, and state use `camelCase`, such as `selectedMajors`, `lastRecommendationData`, `whyModalOpen`, and `pushSpy` in `frontend/src/context/AppReducer.ts`, `frontend/src/components/onboarding/CoursesStep.tsx`, and `frontend/tests/onboardingPage.dom.test.ts`.
- Frontend refs append `Ref` or use concise semantic names such as `reqId`, `onWarningChangeRef`, and `inFlightRef` in `frontend/src/hooks/useRecommendations.ts`, `frontend/src/components/onboarding/CoursesStep.tsx`, and `frontend/src/hooks/useCourses.ts`.
- Shared constants use `UPPER_SNAKE_CASE`, such as `API_BASE` in `frontend/src/lib/api.ts`, `DEFAULT_SEMESTER` in `frontend/src/lib/constants.ts`, `BASE_PAYLOAD` in `tests/backend/test_recommend_api_contract.py`, and `_RATE_LIMIT_MAX` in `backend/server.py`.
- Python collections are named after their contents instead of generic placeholders, such as `selected_codes_set`, `virtual_remaining`, `program_rows`, and `assumption_rows` in `backend/semester_recommender.py`, `tests/backend/helpers.py`, and `backend/validators.py`.

**Types:**
- TypeScript interfaces, aliases, and context value types use `PascalCase`, such as `AppState`, `ProgramsData`, `RecommendationResponse`, `CatalogContextValue`, and `SessionSnapshot` in `frontend/src/lib/types.ts` and `frontend/src/context/AppContext.tsx`.
- Type-only imports are explicit via `import type`, such as in `frontend/src/context/AppReducer.ts`, `frontend/src/app/layout.tsx`, and `frontend/tests/useSession.dom.test.ts`.
- Python classes and dataclasses use `PascalCase`, such as `NightlyScenario`, `NightlyProfile`, `TestHealthEndpoint`, and `TestRateLimiting` in `tests/backend/helpers.py`, `tests/backend/test_server_security.py`, and `tests/backend/test_feedback_api.py`.

## Code Style

**Formatting:**
- Frontend code uses 2-space indentation, semicolons, double quotes, and trailing commas in multiline arrays, objects, and function calls. Representative files: `frontend/src/context/AppReducer.ts`, `frontend/src/context/AppContext.tsx`, `frontend/src/lib/api.ts`, and `frontend/tests/onboardingPage.dom.test.ts`.
- JSX prefers early-return guards and direct inline handlers when the action is simple, such as the `dispatch({ type: "ADD_COMPLETED", ... })` and `setWhyModalOpen(true)` handlers in `frontend/src/components/onboarding/CoursesStep.tsx`.
- Client components declare `"use client";` as the first statement when they depend on hooks or browser APIs, as in `frontend/src/hooks/useRecommendations.ts`, `frontend/src/components/onboarding/CoursesStep.tsx`, `frontend/src/components/shared/Button.tsx`, and `frontend/src/context/AppContext.tsx`.
- Python code uses 4-space indentation, docstrings for modules and non-trivial helpers, blank lines between logical sections, and trailing commas in multiline signatures and literals. Representative files: `backend/validators.py`, `backend/server.py`, `tests/backend/helpers.py`, and `tests/backend/test_scrape_undergrad_policies.py`.
- No dedicated Prettier, Black, Ruff, Flake8, or Mypy config was detected in the repo root or `frontend/`. Existing file style plus lint/test gates are the practical formatter.

**Linting:**
- Frontend linting uses Next.js Core Web Vitals rules via `frontend/eslint.config.mjs`.
- Frontend TypeScript runs with `"strict": true`, `"moduleResolution": "bundler"`, and the `@/*` alias in `frontend/tsconfig.json`.
- `frontend/package.json` defines `npm run lint` as `eslint . --max-warnings=0`, so new warnings fail the check.
- No Python lint command or Python lint config file is present. Keep backend changes aligned with existing `backend/*.py` style because pytest is the primary gate.

## Import Organization

**Order:**
1. Standard library or framework imports first. Python examples: `backend/server.py`, `backend/validators.py`, and `tests/backend/helpers.py`. React/Next examples: `frontend/src/app/layout.tsx` and `frontend/src/hooks/useRecommendations.ts`.
2. Third-party packages next, grouped together. Examples include `flask`, `pandas`, `motion/react`, `@testing-library/react`, and `vitest` in `backend/server.py`, `backend/semester_recommender.py`, `frontend/src/components/onboarding/CoursesStep.tsx`, and `frontend/tests/onboardingPage.dom.test.ts`.
3. Project-local imports last, with alias imports before same-directory relative imports. Examples: `@/context/...`, `@/lib/...`, and `@/components/...` before `./OnboardingStepHeader` in `frontend/src/components/onboarding/CoursesStep.tsx`; sibling backend imports such as `from validators import ...` in `backend/server.py`.

**Path Aliases:**
- Frontend uses `@/* -> ./src/*` from `frontend/tsconfig.json`, and `frontend/vitest.config.ts` mirrors that alias for tests.
- Frontend tests in `frontend/tests/` import app code through `@/...` or `../src/...`, as shown in `frontend/tests/courseHistoryImportParser.test.ts`, `frontend/tests/onboardingPage.dom.test.ts`, and `frontend/tests/plannerCourseList.dom.test.ts`.
- Backend runtime modules import sibling files directly because `backend/server.py` prepends `backend/` to `sys.path`.
- Backend tests prepend both `backend/` and `scripts/` to `sys.path` in `tests/backend/conftest.py`, then import modules directly as `import server` or script modules such as `scrape_undergrad_policies`.

## Error Handling

**Patterns:**
- Backend endpoints validate early and return structured JSON errors instead of propagating Flask exceptions. `/recommend`, `/replan`, `/can-take`, `/feedback`, and `/validate-prereqs` in `backend/server.py` return payloads with `"mode": "error"` or nested `error_code`/`message` fields.
- Frontend API wrappers convert non-OK `fetch` responses into thrown `Error` objects with backend-provided messages when available; see `frontend/src/lib/api.ts`.
- Frontend hooks catch those errors and translate them into UI state instead of letting them surface uncaught. See `useRecommendations` in `frontend/src/hooks/useRecommendations.ts`, `useCourses` in `frontend/src/hooks/useCourses.ts`, and `usePrograms` in `frontend/src/hooks/usePrograms.ts`.
- Soft validation failures in the UI clear state rather than blocking the screen. `frontend/src/components/onboarding/CoursesStep.tsx` resets inconsistency warnings if prereq validation fails.

## Logging

**Framework:** `print` on the backend and minimal `console.error` on the frontend.

**Patterns:**
- Backend runtime logging uses plain `print` with status prefixes such as `[OK]`, `[WARN]`, `[FATAL]`, `[SLOW]`, and `[INFO]`; see `backend/server.py`, `backend/data_loader.py`, and `backend/requirements.py`.
- Frontend only logs bootstrap failures to the console inside data-loading hooks, specifically `frontend/src/hooks/useCourses.ts` and `frontend/src/hooks/usePrograms.ts`.
- Tests intentionally print nightly report locations in `tests/backend/conftest.py`. Avoid adding incidental debug logging elsewhere.

## Comments

**When to Comment:**
- Use short comments around environment quirks, framework constraints, or policy-heavy phases. Examples: static export and proxy notes in `frontend/next.config.js`, selection-phase comments in `backend/semester_recommender.py`, and nightly report hook notes in `tests/backend/conftest.py`.
- Avoid comments that restate obvious JSX or reducer updates. Most frontend files rely on naming instead of explanatory comments, as seen in `frontend/src/components/shared/Button.tsx` and `frontend/src/components/onboarding/CoursesStep.tsx`.

**JSDoc/TSDoc:**
- Frontend rarely uses JSDoc or TSDoc. Prefer typed interfaces and descriptive names in `frontend/src/lib/types.ts`, `frontend/src/context/AppContext.tsx`, and `frontend/src/hooks/useRecommendations.ts`.
- Backend and backend tests use Python docstrings for modules, helpers, and non-trivial fixtures, such as `backend/validators.py`, `tests/backend/helpers.py`, `tests/backend/test_server_security.py`, and `tests/backend/test_semester_recommender.py`.

## Function Design

**Size:** Use small pure helpers for validation, parsing, normalization, and payload shaping, as in `backend/validators.py`, `frontend/src/lib/api.ts`, `frontend/src/hooks/useCourses.ts`, and `tests/backend/test_scrape_undergrad_policies.py`. Large orchestrator functions are accepted only where the module owns a full workflow, such as `backend/server.py` for HTTP orchestration and `backend/semester_recommender.py` for ranking/selection; extend those files by extracting helpers instead of adding more nested branches inline.

**Parameters:** Prefer typed payload objects and prop interfaces in TypeScript, as in `frontend/src/lib/api.ts`, `frontend/src/context/AppReducer.ts`, and `frontend/src/components/onboarding/CoursesStep.tsx`. Python helpers use explicit parameters plus keyword-only options for readability, such as `recommend_payload(...)` in `tests/backend/helpers.py` and `_env_float(...)` in `backend/server.py`.

**Return Values:** Frontend hooks return plain object bags like `{ data, loading, error, fetchRecommendations }` in `frontend/src/hooks/useRecommendations.ts` and `{ courses, loading, error, retry }` in `frontend/src/hooks/useCourses.ts`. Backend helpers prefer deterministic dict/list or tuple shapes, such as `expand_completed_with_prereqs_with_provenance()` in `backend/validators.py` and `run_recommendation_semester()` in `backend/semester_recommender.py`.

## Module Design

**Exports:** Frontend modules mostly use named exports; route files are the main default-export exception, such as `frontend/src/app/page.tsx` and `frontend/src/app/layout.tsx`. Shared state is split into focused contexts in `frontend/src/context/AppContext.tsx` rather than a single catch-all API. Backend modules expose plain functions and constants, while global mutable runtime state stays concentrated in `backend/server.py`.

**Barrel Files:** Not used. Import directly from concrete module paths such as `@/lib/api`, `@/components/shared/Button`, `backend/validators.py`, and `tests/backend/helpers.py`.

---

*Convention analysis: 2026-04-17*
