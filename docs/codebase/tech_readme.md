# Technical Reference

Last updated: April 7, 2026

## Start Here

Read these in order if you are orienting to the current repo:

| File | Purpose |
|------|---------|
| `README.md` | Product overview, local run commands, and deployment contract |
| `docs/CHANGELOG.md` | Shipped and unreleased change history |
| `docs/memos/todo.md` | Open product and engineering follow-ups |
| `data/data_model.md` | Runtime data model and CSV relationships |
| `tests/test_structure.md` | Test suite map and quick command matrix |
| `infra/README.md` | Docker and Render deployment notes |

For deeper references, use the rest of `docs/codebase/`:

| File | Purpose |
|------|---------|
| `docs/codebase/ARCHITECTURE.md` | System design and runtime flow |
| `docs/codebase/STACK.md` | Language, framework, and tool inventory |
| `docs/codebase/STRUCTURE.md` | Directory map |
| `docs/codebase/CONVENTIONS.md` | Naming and implementation patterns |
| `docs/codebase/INTEGRATIONS.md` | External services and workflow integrations |
| `docs/codebase/TESTING.md` | Test strategy and execution model |
| `docs/codebase/CONCERNS.md` | Known issues and technical debt |

---

## System Shape

MarqBot is a CSV-backed degree planner for Marquette students. The current checked-in planner is still business-first, but it also supports selected non-business paths such as the Data Science major.

- Frontend: Next.js app with client-heavy planner flows and static-export-friendly public pages.
- Backend: Flask JSON API plus deterministic recommendation engine.
- Data: checked-in CSV source of truth under `data/`.
- Deploy: Render Docker service serving both API routes and the exported frontend.
- Persistence: browser `localStorage` for client state, JSONL feedback file on disk for server-side feedback capture.

Runtime flow:

```text
Browser
  -> Next.js frontend
  -> same-origin API calls to Flask
  -> recommendation / eligibility / validation engine
  -> CSV + config-backed runtime data
```

There is no user auth system and no database for planner state.

---

## Current Frontend Surfaces

### Routes

| Route | Current role |
|-------|--------------|
| `/` | Marketing landing page with Marquette-branded hero, interactive product story, proof, FAQ, and final CTA |
| `/onboarding` | Intake flow before planner launch |
| `/planner` | Main semester planning workspace, including edited-semester reruns and manual-add preservation across downstream reruns |
| `/saved` | Saved plans library |
| `/saved?plan=...` | Saved plan detail and comparison view |
| `/saved?plan=...&export=pdf` | Snapshot-based print/PDF export for a saved plan, rendered as compact per-semester tables |
| `/courses` | Placeholder product page |
| `/ai-advisor` | Placeholder product page |
| `/about` | Founder story, product rationale, roadmap, and CTA surfaces |

### Key component groups

| Area | Primary files |
|------|---------------|
| Landing | `LandingHeroSimple.tsx`, `HowItWorksClear.tsx`, `BenefitsSection.tsx`, `ProofSection.tsx`, `LandingFaqSection.tsx`, `LandingFinalCTA.tsx` |
| About | `AboutHero.tsx`, `NowNextSection.tsx`, `AboutCTA.tsx`, `aboutContent.ts` |
| Layout | `Navbar.tsx`, `Footer.tsx`, `PlaceholderPage.tsx` |
| Shared UI | `Button.tsx`, `Chip.tsx`, `ContactIcon.tsx`, `Modal.tsx`, `MultiSelect.tsx`, `SingleSelect.tsx`, `AnimatedNumber.tsx` |
| Planner | `PlannerLayout.tsx`, `RecommendationsPanel.tsx`, `SemesterModal.tsx`, `EditPlanModal.tsx`, `MajorGuideModal.tsx`, `ProfileModal.tsx`, `CourseCard.tsx`, `plannerManualAdds.ts`, `progressSources.ts` |
| Saved | `SavedPlansLibraryPage.tsx`, `SavedPlanDetailPage.tsx`, `SavedPlanPrintView.tsx`, `SavedPlanViewModal.tsx`, `SavePlanModal.tsx` |

### Effects and motion runtime

These pieces are new enough that they matter for orientation:

| File | Role |
|------|------|
| `frontend/src/components/shared/EffectsModeManager.tsx` | Sets reduced-effects mode from OS reduced-motion or a manual reduced-effects preference and otherwise leaves full effects enabled |
| `frontend/src/components/shared/ReactivePageShell.tsx` | Page-level cursor-reactive gradient shell used on the landing and About pages |
| `frontend/src/components/shared/Button.tsx` | Shared CTA treatment, hover aura, and wake effect |
| `frontend/src/hooks/useReducedEffects.ts` | Reads the current reduced-effects mode |
| `frontend/src/hooks/useTilt.ts` | Pointer tilt helper used by interactive surfaces |
| `frontend/src/app/globals.css` | Global visual tokens, CTA wake styling, landing/about ambient effects, and reduced-effects CSS branches |

---

## Backend Runtime

### Core modules

| File | Role |
|------|------|
| `backend/server.py` | Flask app, API routes, cache setup, health endpoints, feedback endpoint, static frontend serving |
| `backend/data_loader.py` | CSV loading, normalization, runtime dataset assembly |
| `backend/semester_recommender.py` | Main recommendation engine |
| `backend/eligibility.py` | Can-take logic, warnings, and rule-aware eligibility checks |
| `backend/allocator.py` | Bucket allocation and double-count resolution |
| `backend/prereq_parser.py` | Catalog prerequisite parsing |
| `backend/requirements.py` | Requirement graph helpers |
| `backend/validators.py` | Input validation and request guardrails |
| `backend/unlocks.py` | Forward-unlock heuristics used during ranking |

### Primary API endpoints

| Route | Purpose |
|-------|---------|
| `/api/health` and `/health` | Readiness and health checks |
| `/api/programs` | Program inventory plus college-aware program metadata |
| `/api/courses` | Course catalog data |
| `/api/program-buckets` | Requirement map for a selected program |
| `/api/recommend` | Main ranked semester recommendation response, plus edited-semester reruns via optional `selected_courses` |
| `/api/can-take` | Eligibility explanation for specific courses |
| `/api/validate-prereqs` | Prerequisite validation |
| `/api/feedback` | Planner feedback submission |

### Storage and state

- Core planner data is read from `data/` at startup.
- Saved plans and most planner session state live in browser `localStorage`.
- Feedback is appended to `feedback.jsonl` or `FEEDBACK_PATH`.
- Render production config points feedback to `/var/data/marqbot/feedback.jsonl`.

---

## Data Layer

Current checked-in CSV counts:

| File | Rows | Notes |
|------|------|-------|
| `courses.csv` | 5309 | Base course catalog |
| `parent_buckets.csv` | 41 | Program-level requirement envelopes, including college-aware program metadata |
| `child_buckets.csv` | 100 | Requirement buckets inside each parent |
| `master_bucket_courses.csv` | 1623 | Explicit course-to-child-bucket membership |
| `course_hard_prereqs.csv` | 5309 | One row per course with hard prerequisites, concurrent companions, and standing gates |
| `course_soft_prereqs.csv` | 5309 | One row per course with warning tags, raw catalog prereq text, restriction text, and notes |
| `course_equivalencies.csv` | 282 | Honors, grad, cross-listed, equivalent, and no-double-count relationships |
| `course_offerings.csv` | 547 | Term availability history retained for future offering-aware planning; runtime currently treats all courses as offered |
| `policies.csv` | 76 | Normalized policy registry |
| `policies_buckets.csv` | 177 | Policy-to-bucket joins |
| `quips.csv` | 904 | Rotating frontend quips |

Important data behavior:

- `course_offerings.csv` is still validated and shipped, but runtime offering filtering is currently disabled in `backend/data_loader.py`.
- `config/ranking_overrides.json` is the only checked-in runtime config JSON still in active use.
- Policy coverage is split between documented policy data and a smaller set of runtime-enforced rules.

---

## Scripts and Maintenance Utilities

| Script | Purpose |
|--------|---------|
| `scripts/run_local.py` | Start backend and frontend for local development |
| `scripts/ensure_frontend_build.py` | Check that the frontend build exists before deploy |
| `scripts/discover_equivalencies.py` | Discover equivalency relationships from catalog text |
| `scripts/compile_quips.py` | Build generated quip output from `data/quips.csv` |
| `scripts/validate_track.py` | Validate track-related data integrity |
| `scripts/scrape_undergrad_policies.py` | Scrape Marquette Bulletin policies into `docs/memos/policies.md` |
| `scripts/eval_advisor_match.py` | Advisor-match evaluation utility |
| `scripts/advisor_match_common.py` | Shared helpers for advisor-match evaluation |

---

## Tests

| Directory | Framework | Count | Coverage |
|-----------|-----------|-------|----------|
| `tests/backend/` | Pytest | 26 files | Engine behavior, API contract, policy enforcement, regression profiles, dead-end detection, schema migration, and policy scraping |
| `frontend/tests/` + `tests/frontend/` | Vitest | 47 files | Landing/About shells, onboarding, planner modals, recommendations, saved plans, print/export views, import parsing, hooks, and utilities |

The default frontend run uses `frontend/vitest.config.ts`, which includes the active `frontend/tests/` suite and the included legacy suites from `tests/frontend/`.

High-signal test files:

- `tests/backend/test_semester_recommender.py` - core recommendation engine behavior
- `tests/backend/test_allocator.py` - bucket allocation, overflow, and double-count handling
- `tests/backend/test_recommend_api_contract.py` - API shape and validation
- `tests/backend/test_regression_profiles.py` - known student profiles that must not regress
- `tests/backend/test_dead_end_fast.py` - fast guardrail for planner and ranking changes
- `tests/backend/test_policy_verification.py` - policy enforcement coverage
- `tests/backend/test_scrape_undergrad_policies.py` - policy scrape parsing and markdown rendering
- `frontend/tests/effectsMode.test.ts` - reduced-effects DOM flag and override behavior
- `frontend/tests/landingPage.dom.test.tsx` - landing structure and CTA coverage
- `frontend/tests/aboutPage.dom.test.tsx` - About page shell and CTA coverage
- `frontend/tests/recommendationsPanel.dom.test.tsx` - recommendation rendering and term switching
- `frontend/tests/plannerPreferencesEdit.dom.test.tsx` - edited-semester reruns, candidate-pool reuse, and downstream preservation behavior
- `frontend/tests/plannerManualAdds.test.ts` - manual-add pin reconciliation after reruns
- `frontend/tests/progressSources.test.ts` - projected bucket-progress rebuilding from the visible plan
- `frontend/tests/savePlanModal.dom.test.tsx` and `frontend/tests/plannerSavePlan.dom.test.tsx` - explicit overwrite-existing save flow
- `frontend/tests/savedPlanExport.test.ts` - saved-plan export payload fields, including prerequisite text
- `frontend/tests/savedPlanPrintView.dom.test.ts` - print-view rendering and snapshot-required fallback

Checked-in automation:

- `.github/workflows/nightly-sweep.yml` runs the focused `@nightly` pytest suite on a guarded three-day cadence and on manual dispatch.
- The broader release gate is still local: `.\.venv\Scripts\python.exe -m pytest tests/backend -q` plus `cd frontend && npm run test && npm run lint && npm run build`.

---

## Infrastructure and Deployment

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint and runtime env contract |
| `infra/docker/Dockerfile` | Production image build |
| `infra/README.md` | Infra layout and deploy notes |
| `.github/workflows/nightly-sweep.yml` | Focused nightly backend regression workflow |

Deployment facts:

- Render builds the Docker image, serves the Flask app, and uses `/api/health` as the health check.
- Flask serves the static Next.js export from `frontend/out/`.
- Render mounts `/var/data` and uses that persistent disk for feedback storage.
- There is no separate frontend host, worker tier, or database in the current shape.

---

## Invariants Worth Preserving

- Same input state should produce deterministic recommendation ordering.
- Completed and in-progress courses must not come back as recommendations.
- Requirement context must remain attached to surfaced recommendations.
- Policy-backed warnings must be explicit rather than implicit.
- Reduced-effects mode must change presentation only, not planner behavior.
- Saved-plan actions must stay tied to the active plan and active edit context.

---

## Common Gotchas

- `course_offerings.csv` is not currently enforcing term exclusion even though the data still exists.
- Frontend tests live in two roots; do not assume `frontend/tests/` is the whole suite.
- Public pages now rely on shared visual runtime helpers (`EffectsModeManager`, `ReactivePageShell`, CTA wake styling). If those drift, the landing and About pages drift together.
- The planner is still anonymous and local-first. Any cross-device save story would require a real identity and persistence layer.
