# Codebase Structure

**Analysis Date:** 2026-03-28

## Directory Layout

```text
[project-root]/
├── backend/              # Flask app and deterministic engine modules
├── config/               # Runtime ranking overrides and investigation ledgers
├── data/                 # CSV source-of-truth degree and catalog data
├── docs/                 # Product and technical documentation
├── frontend/             # Next.js app, public assets, and frontend-side tests
│   ├── public/assets/    # Static images and branding
│   ├── src/app/          # App Router routes and layout
│   ├── src/components/   # Feature-organized React UI
│   ├── src/context/      # Shared app state provider and reducer
│   ├── src/hooks/        # Data-loading, API, and persistence hooks
│   ├── src/lib/          # Typed API client and pure helpers
│   └── tests/            # Active frontend test suite included by default
├── infra/docker/         # Container build files used by Render
├── scripts/              # Local tooling and data-maintenance scripts
├── tests/                # Pytest backend suite plus legacy frontend tests
├── .planning/codebase/   # Generated mapping documents for GSD tooling
├── .claude/              # Claude workflow automation, not product runtime
├── .codex/               # Codex and GSD workflow automation, not product runtime
├── README.md             # Human project overview
├── render.yaml           # Render deployment definition
└── pytest.ini            # Pytest configuration
```

## Directory Purposes

**`backend/`:**
- Purpose: Hold the Flask entrypoint and the backend rule-engine modules.
- Contains: HTTP delivery in `backend/server.py`; engine modules such as `backend/data_loader.py`, `backend/allocator.py`, `backend/eligibility.py`, `backend/semester_recommender.py`, `backend/scheduling_styles.py`, `backend/requirements.py`, `backend/prereq_parser.py`, `backend/student_stage.py`, `backend/unlocks.py`, `backend/validators.py`
- Key files: `backend/server.py`, `backend/data_loader.py`, `backend/semester_recommender.py`

**`frontend/src/app/`:**
- Purpose: Define route entrypoints and the global app shell for the Next.js App Router.
- Contains: `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`, `frontend/src/app/onboarding/page.tsx`, `frontend/src/app/planner/page.tsx`, `frontend/src/app/saved/page.tsx`, `frontend/src/app/courses/page.tsx`, `frontend/src/app/ai-advisor/page.tsx`
- Key files: `frontend/src/app/layout.tsx`, `frontend/src/app/planner/page.tsx`, `frontend/src/app/onboarding/page.tsx`

**`frontend/src/components/`:**
- Purpose: Hold UI implementation grouped by feature area instead of by route.
- Contains: landing sections in `frontend/src/components/landing/`; onboarding steps in `frontend/src/components/onboarding/`; planner UI in `frontend/src/components/planner/`; saved-plan screens in `frontend/src/components/saved/`; shared primitives in `frontend/src/components/shared/`; app-shell pieces in `frontend/src/components/layout/`
- Key files: `frontend/src/components/planner/PlannerLayout.tsx`, `frontend/src/components/onboarding/WizardLayout.tsx`, `frontend/src/components/layout/PlaceholderPage.tsx`

**`frontend/src/context/`:**
- Purpose: Hold the shared reducer-driven client state model.
- Contains: provider wiring in `frontend/src/context/AppContext.tsx` and reducer logic in `frontend/src/context/AppReducer.ts`
- Key files: `frontend/src/context/AppContext.tsx`, `frontend/src/context/AppReducer.ts`

**`frontend/src/hooks/`:**
- Purpose: Hold side-effectful client orchestration and persistence hooks.
- Contains: loaders such as `frontend/src/hooks/useCourses.ts` and `frontend/src/hooks/usePrograms.ts`; API hooks such as `frontend/src/hooks/useRecommendations.ts` and `frontend/src/hooks/useCanTake.ts`; persistence hooks such as `frontend/src/hooks/useSession.ts` and `frontend/src/hooks/useSavedPlans.ts`
- Key files: `frontend/src/hooks/useRecommendations.ts`, `frontend/src/hooks/useCanTake.ts`, `frontend/src/hooks/useSession.ts`

**`frontend/src/lib/`:**
- Purpose: Hold pure TypeScript helpers, transport contracts, and frontend integration utilities.
- Contains: API client in `frontend/src/lib/api.ts`; shared types in `frontend/src/lib/types.ts`; planner and saved-plan helpers such as `frontend/src/lib/savedPlans.ts`, `frontend/src/lib/savedPlanPresentation.ts`, `frontend/src/lib/rendering.ts`, `frontend/src/lib/studentStage.ts`
- Key files: `frontend/src/lib/api.ts`, `frontend/src/lib/types.ts`, `frontend/src/lib/savedPlans.ts`

**`frontend/public/assets/`:**
- Purpose: Store static media served directly by the frontend build.
- Contains: images under `frontend/public/assets/about/`, `frontend/public/assets/branding/`, and `frontend/public/assets/covers/`
- Key files: `frontend/public/assets/covers/`, `frontend/public/assets/branding/`

**`frontend/tests/`:**
- Purpose: Hold the active frontend test suite that the current default Vitest run includes.
- Contains: DOM and integration-style tests such as `frontend/tests/profileModal.dom.test.ts`, `frontend/tests/useSession.dom.test.ts`, `frontend/tests/semesterModal.dom.test.ts`
- Key files: `frontend/tests/profileModal.dom.test.ts`, `frontend/tests/useSession.dom.test.ts`, `frontend/tests/courseHistoryImportParser.test.ts`

**`tests/backend/`:**
- Purpose: Hold the Python backend contract, engine, loader, and regression tests.
- Contains: pytest fixtures in `tests/backend/conftest.py` and focused suites such as `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_semester_recommender.py`, `tests/backend/test_server_can_take.py`
- Key files: `tests/backend/conftest.py`, `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_semester_recommender.py`

**`tests/frontend/`:**
- Purpose: Hold legacy or parallel frontend tests that still exist alongside `frontend/tests/`.
- Contains: tests such as `tests/frontend/appReducer.test.ts`, `tests/frontend/canTake.test.ts`, `tests/frontend/onboardingPage.dom.test.ts`
- Key files: `tests/frontend/appReducer.test.ts`, `tests/frontend/canTake.test.ts`, `tests/frontend/setupTests.ts`

**`data/`:**
- Purpose: Hold the source-of-truth degree and catalog dataset consumed by the backend.
- Contains: catalog, buckets, prereqs, equivalencies, offerings, policies, and quips in CSV form
- Key files: `data/courses.csv`, `data/parent_buckets.csv`, `data/child_buckets.csv`, `data/master_bucket_courses.csv`, `data/course_hard_prereqs.csv`, `data/course_soft_prereqs.csv`

**`config/`:**
- Purpose: Hold runtime tuning and issue-tracking JSON files used by the backend and nightly scripts.
- Contains: ranking overrides and investigation ledgers
- Key files: `config/ranking_overrides.json`, `config/data_investigation_queue.json`, `config/autotune_ledger.json`

**`scripts/`:**
- Purpose: Hold local operator tooling and data-maintenance utilities.
- Contains: `scripts/run_local.py`, `scripts/ensure_frontend_build.py`, `scripts/analyze_nightly.py`, `scripts/validate_track.py`, `scripts/discover_equivalencies.py`, `scripts/compile_quips.py`
- Key files: `scripts/run_local.py`, `scripts/ensure_frontend_build.py`, `scripts/analyze_nightly.py`

**`docs/`:**
- Purpose: Hold product and technical documentation that explains behavior outside the code.
- Contains: algorithm and technical docs in `docs/algorithm.md` and `docs/technical_reference.md`; collected feedback under `docs/feedbacks/`; memos under `docs/memos/`
- Key files: `docs/algorithm.md`, `docs/technical_reference.md`, `docs/CHANGELOG.md`

**`infra/docker/`:**
- Purpose: Hold container-build assets used by deployment.
- Contains: the Docker configuration referenced by `render.yaml`
- Key files: `infra/docker/`

**`.planning/codebase/`:**
- Purpose: Hold generated codebase maps consumed by later GSD planning and execution commands.
- Contains: output files such as `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, and the other mapper documents created by adjacent focus runs
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `backend/server.py`: Flask runtime entrypoint, API surface, static frontend server, and process-level caching layer
- `scripts/run_local.py`: local launcher that ensures a frontend build exists before starting the backend
- `frontend/src/app/layout.tsx`: global frontend shell that mounts `AppProvider` and the shared navbar
- `frontend/src/app/page.tsx`: landing-page route entry
- `frontend/src/app/onboarding/page.tsx`: onboarding wizard route entry
- `frontend/src/app/planner/page.tsx`: planner route entry and session restore trigger
- `frontend/src/app/saved/page.tsx`: saved-plan route entry; detail mode is selected by the `plan` query parameter

**Configuration:**
- `render.yaml`: Render web-service definition and health-check configuration
- `frontend/next.config.js`: Next.js export and dev-rewrite behavior
- `frontend/tsconfig.json`: frontend TypeScript and path-alias configuration
- `frontend/package.json`: frontend scripts and JS dependency manifest
- `package.json`: root convenience script for frontend development
- `requirements.txt`: Python dependency manifest
- `pytest.ini`: pytest markers and defaults
- `.env` and `.env.example`: environment files are present at the repo root; treat them as local configuration only and do not read secrets into committed docs

**Core Logic:**
- `backend/data_loader.py`: assembles the runtime dataset from `data/` and `config/`
- `backend/allocator.py`: bucket allocation and runtime-index construction
- `backend/eligibility.py`: prerequisite, standing, stage, and restriction filtering
- `backend/semester_recommender.py`: ranking and semester selection
- `backend/scheduling_styles.py`: style-specific selection rules
- `frontend/src/context/AppContext.tsx`: shared provider and split contexts
- `frontend/src/context/AppReducer.ts`: reducer for catalog, preferences, planner, and persistence actions
- `frontend/src/lib/api.ts`: typed frontend API boundary
- `frontend/src/hooks/useRecommendations.ts`: planner recommendation orchestration hook
- `frontend/src/components/planner/PlannerLayout.tsx`: the main planner screen composition root

**Testing:**
- `tests/backend/conftest.py`: shared pytest fixtures and backend app wiring
- `tests/backend/`: backend unit, contract, regression, and nightly support tests
- `frontend/tests/`: current frontend DOM and integration-style tests that run by default
- `tests/frontend/`: legacy or complementary frontend tests still present in the repo
- `frontend/vitest.config.ts`: frontend Vitest configuration

## Naming Conventions

**Files:**
- Backend Python modules use snake_case: `backend/semester_recommender.py`, `backend/data_loader.py`, `backend/student_stage.py`
- React component files use PascalCase: `frontend/src/components/planner/PlannerLayout.tsx`, `frontend/src/components/onboarding/CoursesStep.tsx`, `frontend/src/components/saved/SavedPlanDetailPage.tsx`
- Hooks use the `useX` prefix: `frontend/src/hooks/useRecommendations.ts`, `frontend/src/hooks/usePrograms.ts`, `frontend/src/hooks/useSession.ts`
- App Router entries use framework file names: `frontend/src/app/planner/page.tsx`, `frontend/src/app/layout.tsx`
- Frontend pure helper files use lower camel or concise lower-case names: `frontend/src/lib/savedPlans.ts`, `frontend/src/lib/studentStage.ts`, `frontend/src/lib/plannerFeedbackNudge.ts`
- Tests use `test_*.py` in `tests/backend/` and `*.test.ts` or `*.dom.test.ts` in `frontend/tests/` and `tests/frontend/`

**Directories:**
- Frontend feature directories are lowercase nouns: `frontend/src/components/planner/`, `frontend/src/components/onboarding/`, `frontend/src/components/shared/`
- Route directories under `frontend/src/app/` follow URL structure: `frontend/src/app/about/`, `frontend/src/app/planner/`, `frontend/src/app/saved/`, `frontend/src/app/onboarding/`
- Top-level runtime areas stay separated by responsibility: `backend/`, `frontend/`, `data/`, `config/`, `scripts/`, `tests/`

## Where to Add New Code

**New Feature:**
- Primary code: add new route entries under `frontend/src/app/<route>/page.tsx`; put feature UI under `frontend/src/components/<feature>/`; extend shared client state in `frontend/src/context/AppReducer.ts` and `frontend/src/lib/types.ts`; add API wiring in `frontend/src/lib/api.ts`; add Flask route registration in `backend/server.py`; place backend business logic in the closest existing `backend/*.py` module or a new focused snake_case module under `backend/`
- Tests: add backend coverage in `tests/backend/test_<feature>.py`; add frontend coverage in `frontend/tests/<feature>.test.ts` or `frontend/tests/<feature>.dom.test.ts`; only place new frontend tests in `tests/frontend/` when matching an existing legacy suite there

**New Component/Module:**
- Implementation: planner-only UI belongs in `frontend/src/components/planner/`; onboarding-only UI belongs in `frontend/src/components/onboarding/`; saved-plan UI belongs in `frontend/src/components/saved/`; landing or marketing UI belongs in `frontend/src/components/landing/` or `frontend/src/components/about/`; reusable UI primitives belong in `frontend/src/components/shared/`
- Implementation: side-effectful client orchestration belongs in `frontend/src/hooks/`; pure TypeScript helpers and transport shapes belong in `frontend/src/lib/`; reusable Python domain logic belongs in `backend/` and should stay separate from `backend/server.py` when it can be tested independently

**Utilities:**
- Shared helpers: use `frontend/src/lib/` for browser-side utilities, serializers, and type helpers; use `backend/` for reusable Python runtime helpers; use `scripts/` only for developer or operator tooling, not for code that must execute during normal HTTP requests
- Shared fixtures and docs: put frontend test fixtures under `frontend/tests/fixtures/`, backend fixtures under `tests/backend/fixtures/`, and user-facing technical explanation in `docs/`

## Special Directories

**`.planning/codebase/`:**
- Purpose: generated mapping docs consumed by GSD commands
- Generated: Yes
- Committed: Yes

**`.claude/`:**
- Purpose: Claude agent, command, and workspace automation; not part of product runtime
- Generated: No
- Committed: Yes

**`.codex/`:**
- Purpose: Codex and GSD command or skill definitions; not part of product runtime
- Generated: No
- Committed: Yes

**`frontend/src/app/saved/[id]/`:**
- Purpose: currently an empty route directory; the live saved-plan detail experience is still driven by `frontend/src/app/saved/page.tsx` plus the `plan` query parameter
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-28*
