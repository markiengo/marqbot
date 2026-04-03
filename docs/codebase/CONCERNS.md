# Codebase Concerns

**Analysis Date:** 2026-03-28

## Tech Debt

**Backend request and runtime orchestration are concentrated in one module:**
- Issue: `backend/server.py` owns Flask bootstrap, dotenv loading, startup data loading, hot reload, in-memory caches, manual rate limiting, feedback persistence, static export serving, and the main `/recommend` and `/can-take` request pipelines in one 2,553-line file.
- Files: `backend/server.py`, `tests/backend/test_server_data_reload.py`, `tests/backend/test_feedback_api.py`, `tests/backend/test_server_security.py`
- Impact: small changes require reasoning about unrelated global state, import-time side effects, and cross-cutting behavior in the same edit; regression isolation is harder than it should be.
- Fix approach: split `backend/server.py` into bootstrap/middleware, feedback routes, recommendation handlers, and a runtime-state service that owns `_data`, caches, and reload coordination.

**Program-selection logic is duplicated across multiple frontend surfaces:**
- Issue: major/track/discovery-theme selection rules are reimplemented in `frontend/src/components/onboarding/MajorStep.tsx`, `frontend/src/components/planner/ProfileProgramTab.tsx`, and an apparently unused `frontend/src/components/planner/InputSidebar.tsx`.
- Files: `frontend/src/components/onboarding/MajorStep.tsx`, `frontend/src/components/planner/ProfileProgramTab.tsx`, `frontend/src/components/planner/InputSidebar.tsx`, `frontend/src/context/AppReducer.ts`, `frontend/src/lib/api.ts`
- Impact: validation changes can land in one UI and miss the others; `InputSidebar.tsx` can drift silently because it has no live imports in `frontend/src/`.
- Fix approach: extract one shared program-picker/controller layer, then delete or rewire `frontend/src/components/planner/InputSidebar.tsx` so only one implementation remains.

**Deployment depends on committed build artifacts and generated caches:**
- Issue: production serves `frontend/out` directly from Flask, and the repo also contains generated cache directories.
- Files: `backend/server.py`, `frontend/out/`, `backend/__pycache__/`, `scripts/__pycache__/`, `tests/backend/__pycache__/`
- Impact: source changes in `frontend/src/` can drift from what the backend actually serves, searches pick up built JavaScript, and reviews get noisy with generated output.
- Fix approach: choose one deployment contract. Either build `frontend/out` in CI and treat it as an artifact, or stop committing the export and have deployment generate it.

**The data loader still carries schema migration and compatibility code in the runtime path:**
- Issue: `backend/data_loader.py` combines current CSV loading, parent/child-to-v2 conversion, legacy compatibility, dynamic elective mapping, and warning-based integrity checks in one runtime loader.
- Files: `backend/data_loader.py`, `scripts/validate_track.py`, `tests/backend/test_schema_migration.py`
- Impact: schema work is expensive and brittle because changes to data shape and runtime shape are coupled; warnings can hide correctness issues until they hit planner output.
- Fix approach: freeze one canonical runtime schema and move conversions into explicit migration scripts and CI validation, not the hot path.

## Known Bugs

**Term availability is intentionally ignored, so recommendations can be wrong for a real semester:**
- Symptoms: courses can be recommended as available in Fall, Spring, and Summer even when actual offering history says otherwise; `not_offered_this_term` checks lose value.
- Files: `backend/data_loader.py`, `backend/eligibility.py`, `backend/semester_recommender.py`, `tests/backend/test_schema_migration.py`
- Trigger: any seasonal or infrequently offered course.
- Workaround: verify term availability manually against Marquette systems before registration.

**Feedback submission depends on writable local disk and can fail operationally:**
- Symptoms: `/api/feedback` returns a server error when `FEEDBACK_PATH` is unwritable or the host filesystem is not suitable for append-only JSONL storage.
- Files: `backend/server.py`, `tests/backend/test_feedback_api.py`
- Trigger: read-only deploys, ephemeral storage issues, or invalid `FEEDBACK_PATH`.
- Workaround: set `FEEDBACK_PATH` to a writable location or move feedback storage out of the app process.

## Security Considerations

**Rate limiting trusts `X-Forwarded-For` directly:**
- Risk: `_client_ip()` takes the first `X-Forwarded-For` value without verifying that the request came through a trusted proxy, so spoofed headers can weaken rate limiting.
- Files: `backend/server.py`, `tests/backend/test_server_security.py`
- Current mitigation: process-local token-bucket rate limiting on `/recommend` and `/feedback`.
- Recommendations: trust forwarded headers only behind a configured reverse proxy, or use platform/middleware-provided client IP handling.

**Feedback storage captures detailed academic state and request metadata:**
- Risk: the feedback payload stores completed courses, in-progress courses, declared programs, recommendation snapshots, referer, and user agent in a JSONL file.
- Files: `frontend/src/lib/feedback.ts`, `backend/server.py`, `tests/backend/test_feedback_api.py`
- Current mitigation: field normalization, context byte cap, message length cap, and a file lock.
- Recommendations: minimize retained snapshot data, add retention and deletion policy, and move records to a managed store with access controls instead of raw filesystem append.

**Direct `python backend/server.py` runs with debug enabled by default:**
- Risk: the `__main__` path defaults `FLASK_DEBUG` to `"1"`, which is unsafe if someone uses the file directly in a non-development environment.
- Files: `backend/server.py`
- Current mitigation: normal production deployment is expected to use Gunicorn, not the `__main__` block.
- Recommendations: default debug to off and require explicit opt-in for local development.

## Performance Bottlenecks

**Client-side OCR import is CPU-heavy and front-loaded in the browser:**
- Problem: the import flow preprocesses every pixel on a canvas and then boots a `tesseract.js` worker for OCR.
- Files: `frontend/src/lib/courseHistoryImport.ts`, `frontend/src/components/onboarding/CourseHistoryImport.tsx`, `frontend/package.json`
- Cause: main-thread image processing plus large OCR worker startup on user devices.
- Improvement path: move preprocessing into a Worker, tighten image-size limits further, add device fallback/timeouts, and measure parse latency per stage.

**Semester editing re-runs the full recommendation pipeline repeatedly:**
- Problem: the planner fetches a fresh recommendation pool for edited semesters and then posts another full downstream recomputation after edits are applied.
- Files: `frontend/src/components/planner/PlannerLayout.tsx`, `frontend/src/hooks/useRecommendations.ts`, `backend/server.py`, `backend/semester_recommender.py`
- Cause: no dedicated delta/candidate endpoint exists, so the frontend keeps reconstructing whole recommendation requests from current state.
- Improvement path: add a lightweight candidate endpoint or memoized service keyed by semester state, then avoid full downstream recompute when only one semester changes.

## Fragile Areas

**Browser persistence and session normalization are tightly coupled:**
- Files: `frontend/src/hooks/useSession.ts`, `frontend/src/context/AppReducer.ts`, `frontend/src/lib/savedPlans.ts`, `frontend/src/app/planner/page.tsx`
- Why fragile: reducer normalization, saved-plan freshness hashes, session snapshot shape, and recommendation snapshot restore all depend on matching field names and normalization rules.
- Safe modification: change persistence schema in one wave across snapshot builders, reducer restore paths, and saved-plan hashing/migration helpers.
- Test coverage: `tests/frontend/savedPlans.test.ts` covers storage helpers, but no default frontend test covers `useSession()` restore behavior or full planner bootstrap.

**Program-selection behavior is duplicated while the course-import tab stays mounted for state preservation:**
- Files: `frontend/src/components/onboarding/MajorStep.tsx`, `frontend/src/components/planner/ProfileProgramTab.tsx`, `frontend/src/components/planner/ProfileModal.tsx`, `frontend/src/components/planner/ProfileCoursesTab.tsx`, `frontend/src/components/onboarding/CourseHistoryImport.tsx`
- Why fragile: the same business rules live in multiple components, and the hidden-but-mounted profile courses tab is preserving `CourseHistoryImport` state by lifecycle trick rather than explicit state ownership.
- Safe modification: centralize program-selection logic and move course-import state into a dedicated hook or reducer before changing modal/tab lifecycle.
- Test coverage: no default frontend test directly exercises `ProfileModal`, `ProfileProgramTab`, or the hidden-tab persistence behavior.

**Backend runtime state is process-global and mutation-heavy:**
- Files: `backend/server.py`, `tests/backend/test_server_data_reload.py`
- Why fragile: `_data`, `_reverse_map`, `_chain_depths`, mtime checks, caches, and file locks all mutate at module scope with partial synchronization.
- Safe modification: treat reload, cache invalidation, and runtime indexes as one subsystem and test them together whenever changing that area.
- Test coverage: reload behavior is tested, but only in single-process test-client scenarios.

## Scaling Limits

**Rate limiting and caches do not coordinate across processes or instances:**
- Current capacity: each Python process keeps its own `_rate_limit_tracker`, `_feedback_rate_limit_tracker`, and LRU caches.
- Limit: multiple Gunicorn workers or platform instances weaken rate-limit guarantees and reduce cache hit rates because state is not shared.
- Scaling path: move rate limiting and response caching to shared infrastructure such as Redis or an edge proxy.

**Feedback persistence is single-host and filesystem-bound:**
- Current capacity: one host can append JSONL records with a process-local file lock.
- Limit: multiple instances will not share feedback storage, ephemeral deploys can lose data, and unwritable disks surface 500s.
- Scaling path: move feedback records to a database, queue, or managed log sink.

**Static frontend serving depends on manually refreshed export output:**
- Current capacity: Flask serves whatever exists under `frontend/out/`.
- Limit: `frontend/src/` changes do not automatically update the served app, and deploy payload grows with committed export output.
- Scaling path: build the frontend in CI/CD and publish versioned artifacts, or deploy the frontend separately from Flask.

## Dependencies at Risk

**`tesseract.js`:**
- Risk: browser OCR startup cost and memory usage are high and vary significantly by device/browser.
- Impact: the screenshot import path can be the slowest, least predictable user-facing feature in the app.
- Migration plan: keep it lazy-loaded for now, but plan either Worker-based preprocessing plus telemetry or a server-side OCR alternative if the feature needs stronger reliability.

## Missing Critical Features

**Minor selection is modeled in state but blocked in the UI:**
- Problem: minors are loaded by the frontend API layer and supported in reducer/session types, but current planner UIs render minors as disabled "Coming Soon" controls.
- Files: `frontend/src/lib/api.ts`, `frontend/src/context/AppReducer.ts`, `frontend/src/lib/savedPlans.ts`, `frontend/src/components/planner/ProfileProgramTab.tsx`, `frontend/src/components/planner/InputSidebar.tsx`
- Blocks: students cannot plan around minor requirements even though the data model and saved-plan schema already expect them.

**Course offering awareness is disabled:**
- Problem: the loader forces every course to be offered every term, so the planner cannot give term-accurate recommendations.
- Files: `backend/data_loader.py`, `backend/eligibility.py`, `backend/semester_recommender.py`
- Blocks: reliable "can I take this next semester?" and season-aware recommendation quality.

**The AI Advisor route is still a placeholder:**
- Problem: `/ai-advisor` exists as a real route but only renders placeholder content.
- Files: `frontend/src/app/ai-advisor/page.tsx`, `frontend/src/components/layout/PlaceholderPage.tsx`
- Blocks: natural-language advising and explanation workflows exposed by navigation and page copy.

## Test Coverage Gaps

**Default frontend test runs skip the existing DOM interaction suites:**
- What's not tested: `npm test` uses `frontend/vitest.config.ts`, which excludes `tests/frontend/*.dom.test.ts` even though those files contain real onboarding and widget interaction coverage.
- Files: `frontend/vitest.config.ts`, `tests/frontend/onboardingPage.dom.test.ts`, `tests/frontend/coursesStep.dom.test.ts`, `tests/frontend/multiSelect.dom.test.ts`
- Risk: interaction regressions can slip through even when tests already exist for them.
- Priority: High

**The highest-complexity planner shell has little direct coverage:**
- What's not tested: planner save flow, feedback nudge timing, profile modal submission, semester edit recomputation, and most `PlannerLayout` UI branching.
- Files: `frontend/src/components/planner/PlannerLayout.tsx`, `frontend/src/components/planner/ProfileModal.tsx`, `frontend/src/hooks/useRecommendations.ts`, `frontend/src/hooks/useSavedPlans.ts`, `frontend/src/lib/plannerFeedbackNudge.ts`
- Risk: the core day-to-day planner experience can regress without failing the default frontend suite.
- Priority: High

**Session restore and browser-state transitions are not exercised end-to-end:**
- What's not tested: `useSession()` restore, reducer sanitization of stale localStorage data, and planner bootstrap behavior in `frontend/src/app/planner/page.tsx`.
- Files: `frontend/src/hooks/useSession.ts`, `frontend/src/context/AppReducer.ts`, `frontend/src/app/planner/page.tsx`, `frontend/src/lib/savedPlans.ts`
- Risk: stale or malformed browser state can produce silent resets, dropped recommendations, or confusing restore behavior.
- Priority: High

**OCR import failure modes are not covered by the default test path:**
- What's not tested: file-size rejection, dynamic parser import, stage transitions, worker failures, review/apply flow, and low-confidence row resolution.
- Files: `frontend/src/components/onboarding/CourseHistoryImport.tsx`, `frontend/src/lib/courseHistoryImport.ts`
- Risk: the heaviest frontend feature depends on manual browser testing for reliability.
- Priority: High

**No E2E test runner is detected for frontend-backend integration:**
- What's not tested: full planner boot, live recommendation fetches, save/restore across navigation, and feedback submission against the real API contract.
- Files: `frontend/package.json`, `tests/frontend/`, `tests/backend/`
- Risk: contract drift between `frontend/src/lib/api.ts` and Flask endpoints can pass unit/integration suites but still break the actual app flow.
- Priority: Medium

---

*Concerns audit: 2026-03-28*
