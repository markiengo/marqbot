# Technical Reference

Last updated: March 28, 2026

## Architecture Overview

MarqBot is a full-stack degree planning application. The backend is a Python/Flask API that loads CSV-backed course and program data, runs a deterministic recommendation engine, and serves a statically exported Next.js frontend.

```
Browser → Next.js static export (frontend/out/) → Flask API routes → Engine pipeline
                                                                      ↓
                                                              CSV data (data/)
                                                              Config (config/)
```

Production is deployed on Render. The Flask server serves the static frontend export and handles all API requests. There is no database — all state comes from CSVs, config JSON, and the request payload.

---

## Backend (`backend/`)

### Module Map

| Module | Responsibility |
|--------|---------------|
| `server.py` | Flask app, all API routes, request validation, program validation (COBA_05/06), feedback storage, static frontend serving |
| `data_loader.py` | CSV loading, hard/soft prereq overlay, equivalency map construction, dynamic elective synthesis, runtime index building |
| `allocator.py` | Assigns completed and in-progress courses to buckets. Handles precedence (non-elective > elective), overflow spill to elective pools, deterministic tie-breaking |
| `eligibility.py` | Filters candidates by hard prereqs, standing gates, student stage (undergrad range), bucket min_level, college/major restrictions, concurrent compatibility. Surfaces `manual_review` for unparseable prereqs |
| `semester_recommender.py` | Ranks eligible candidates, runs the selection loop, applies credit-load warnings (CRED_01/02/04/10), handles multi-semester planning, standing recovery, bridge courses |
| `scheduling_styles.py` | Three-pass selection loop with style-specific slot reservations (grinder/explorer/mixer). Enforces WRIT limit, bucket capacity, maturity guard, bridge deferral |
| `requirements.py` | Domain constants, bucket ordering, double-count families, NDC groups, pairwise overlap policy, bucket helpers shared by allocator and eligibility |
| `prereq_parser.py` | Recursive-descent parser for hard prerequisite expressions. Supports AND/OR trees with course codes |
| `student_stage.py` | Filters course levels by student stage: undergrad (1000–4999), graduate (5000–7999), doctoral (8000+) |
| `unlocks.py` | Computes prereq chain depth for every course. Used by ranking to prioritize courses that unlock deeper chains |
| `normalizer.py` | Normalizes course codes (spacing, casing) for consistent matching |
| `validators.py` | Input validation helpers for API request payloads |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/recommend` | POST | Main recommendation endpoint. Accepts program selection, completed/in-progress courses, semester parameters. Returns multi-semester plan with progress, projection, warnings, and optional debug trace |
| `/can-take` | POST | Single-course eligibility check. Returns eligibility status, warnings, and bucket context |
| `/api/programs` | GET | Program metadata: majors, tracks, minors, bucket labels |
| `/api/courses` | GET | Full course catalog |
| `/api/program-buckets` | GET | Bucket tree for a set of program IDs. Static CSV read only — no engine |
| `/api/validate-prereqs` | POST | Detects contradictions in completed/in-progress prereq state |
| `/api/feedback` | POST | Accepts planner ratings and bug/idea reports with planner context |

### Engine Pipeline

1. **Validate** — program selection, major/track pairing, COBA_06 (max 3 business majors), COBA_05 (business minor warning).
2. **Allocate** — assign completed/in-progress courses to child buckets. Non-elective precedence. Overflow spill to elective pools.
3. **Filter** — build eligible candidates: prereqs, standing, stage, min_level, restrictions, concurrent compatibility. Surface `manual_review` for unparseable cases.
4. **Suppress** — remove non-recommendable courses (internships, independent study, topics, work periods, honors for non-honors students, fractional credits).
5. **Rank** — deterministic sort by `(tier, bridge_status, chain_depth desc, multi_bucket_score desc, course_level, course_code)`.
6. **Select** — three-pass loop (mandatory bridge, style reservations, greedy fill) with bucket caps, program balance, freshman maturity guard, concurrent follow-up, rescue pass.
7. **Warn** — attach per-semester credit-load warnings (CRED_01/02/04/10).
8. **Return** — recommendations, progress, projection, warnings, semester_warnings, debug trace.

### Priority Tiers

| Tier | Covers | Rationale |
|------|--------|-----------|
| 1 | MCC Foundation | Gates everything else |
| 2 | Business Core (BCC) | Shared prereqs for all major courses |
| 3 | Major requirements | Direct degree requirements |
| 4 | Track / Minor | Supplementary program requirements |
| 5 | MCC Late (writing, culminating) | Upper-division, deferred until credit maturity |
| 6 | Discovery themes | Wide pools, most flexibility |

### Prerequisite System

**Hard** (`course_hard_prereqs.csv`): parseable course-to-course edges (`hard_prereq`), concurrent companions (`concurrent_with`), standing gates (`min_standing`).

**Soft** (`course_soft_prereqs.csv`): machine tags (`soft_prereq`), raw catalog snippets (`soft_prereq_*`), full bulletin line (`catalog_prereq_raw`), notes. Used for warnings and manual review.

**Restriction enforcement**: `major_restriction` and `college_restriction` are enforced when machine-parseable. Currently supports 7 college names and business-major patterns. Ambiguous restrictions stay as warnings.

**Concurrent nuance**: `which may be taken concurrently` → both `hard_prereq` and `concurrent_with`. Pure co-req phrasing (`taken concurrently with`, `must be taken concurrent with`) → `concurrent_with` only.

**Manual review**: unparseable prereqs get `hard_prereq=none`, `complex_hard_prereq` soft tag, surfaced as `manual_review`.

### Bucket System

- `parent_bucket` = program envelope (major, minor, track, universal)
- `child_bucket` = individual requirement inside a parent
- `master_bucket_courses` = explicit course-to-child membership
- Requirement modes: `required`, `choose_n`, `credits_pool`
- Progress allocated at child level, rolled up to parent
- Non-elective buckets always beat elective pools in allocation and display
- Overflow spill: extra courses in full non-elective slots can count in eligible elective pools
- Dynamic elective synthesis: `elective_pool_tag` on courses → auto-mapped into `credits_pool` buckets at load time (current tag: `biz_elective`)

### Policy Enforcement

**Runtime-enforced:**
- `CRED_01` — below 12-credit full-time warning
- `CRED_02` — above 18-credit normal load warning
- `CRED_04` — CoBA 19-credit max, overload form required
- `CRED_10` — summer 16-credit cap
- `COBA_05` — CoBA students cannot declare a business minor (warning)
- `COBA_06` — max 3 business majors (hard block)
- `DC_01–DC_03` — double-count family denial, NDC group blocking, pairwise overlap
- `RT_01–RT_08` — bucket caps, overflow, tier ordering, deferral, overrides, recommendation/semester limits, summer confidence filter
- `MCC_01` — 5000+ courses excluded from MCC buckets
- Standing, stage, and restriction policies via eligibility pipeline

**Deferred:** policies requiring grade data, transfer records, advisor overrides, or GPA thresholds. Documented in `data/policies.csv` with `implementation_status = deferred`. Bucket mappings in `data/policies_buckets.csv`.

### Debug Trace

When `debug=true`, each ranked candidate includes: `rank`, `course_code`, `course_name`, `selected`, `skip_reason`, `tier`, `is_bridge_course`, `course_level`, `chain_depth`, `multi_bucket_score`, `fills_buckets`, `selection_buckets`, `current_unmet_buckets`, `bridge_target_buckets`, `bucket_capacity`.

---

## Frontend (`frontend/`)

Next.js 16 app with React 19, TypeScript 5, Tailwind CSS 4. Exported as a static site (`next export` → `frontend/out/`) and served by the Flask backend in production.

### Pages (`src/app/`)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Landing page with hero, benefits, how-it-works, proof section, CTA |
| `/onboarding` | `onboarding/page.tsx` | 4-step wizard: major → courses → preferences → roadmap preview |
| `/planner` | `planner/page.tsx` | Main planner view with recommendations, progress, sidebar |
| `/courses` | `courses/page.tsx` | Full course catalog browser with eligibility check |
| `/saved` | `saved/page.tsx` | Saved plan list with localStorage persistence |
| `/saved/[id]` | `saved/[id]/page.tsx` | Individual saved plan view |
| `/about` | `about/page.tsx` | About page |
| `/ai-advisor` | `ai-advisor/page.tsx` | AI advisor feature page |

### Component Organization (`src/components/`)

| Directory | Components | Purpose |
|-----------|-----------|---------|
| `landing/` | `LandingHeroSimple`, `BenefitsSection`, `HowItWorksClear`, `ProofSection`, `LandingFinalCTA` | Landing page sections |
| `onboarding/` | `MajorStep`, `CoursesStep`, `PreferencesStep`, `RoadmapStep`, `CourseHistoryImport`, `StepIndicator`, `WizardLayout`, `OnboardingStepHeader` | Onboarding wizard steps and layout |
| `planner/` | `PlannerLayout`, `RecommendationsPanel`, `InputSidebar`, `CourseCard`, `CourseRow`, `SemesterPreview`, `SemesterSelector`, `SemesterModal`, `ProgressDashboard`, `ProgressModal`, `ProgressRing`, `BucketProgressGrid`, `BucketSectionTabs`, `BucketCourseModal`, `CourseListModal`, `DegreeSummary`, `CanTakeSection`, `MajorGuideModal`, `FeedbackModal`, `PreferencesPanel`, `ProfileModal`, `ProfileCoursesTab`, `ProfileProgramTab`, `ProfilePreferencesTab` | Main planner UI |
| `saved/` | Saved plan components | Plan persistence and display |
| `layout/` | `Navbar`, `Footer`, `PlaceholderPage` | App shell |
| `shared/` | `Modal`, `Button`, `Chip`, `Tag`, `MultiSelect`, `SingleSelect`, `Skeleton`, `AnimatedNumber`, `AnchorLine`, `CourseDetailModal` | Reusable UI primitives |
| `about/` | About page components | Static content |

### State Management (`src/context/`)

| File | Purpose |
|------|---------|
| `AppContext.tsx` | React context with split sub-contexts: `CatalogContext` (courses, programs), `CourseHistoryContext` (completed, in-progress), `ProgramSelectionContext` (majors, tracks, minors), `PreferencesContext` (semester, style, stage) |
| `AppReducer.ts` | Centralized reducer handling all state transitions |
| `EffectsContext.tsx` | GPU capability detection and adaptive visual effects (blur, glow, motion fallback for weak renderers) |

### Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useRecommendations` | Fetches recommendations from `/recommend` API |
| `useCanTake` | Single-course eligibility check via `/can-take` |
| `usePrograms` | Loads program metadata from `/api/programs` |
| `useCourses` | Loads course catalog from `/api/courses` |
| `useOnboarding` | Onboarding wizard state and navigation |
| `useSavedPlans` | localStorage-backed saved plan CRUD |
| `useSession` | Session ID management |
| `useConfetti` | Celebration animation trigger |
| `useAnimatedCounter` | Smooth number transitions |

### Library (`src/lib/`)

| File | Purpose |
|------|---------|
| `api.ts` | Typed API client for all backend routes |
| `types.ts` | TypeScript interfaces: `Course`, `Major`, `Track`, `Minor`, `ProgramsData`, `RecommendedCourse`, `BucketProgress`, `AppState`, etc. |
| `constants.ts` | UI constants and defaults |
| `utils.ts` | General utility functions |
| `rendering.ts` | GPU detection, performance tier classification, effect fallback logic |
| `schedulingStyle.ts` | Style metadata (grinder/explorer/mixer labels and descriptions) |
| `studentStage.ts` | Stage labels and validation |
| `programSearch.ts` | Fuzzy program search with aliases |
| `progressSources.ts` | Progress computation helpers |
| `savedPlans.ts` | localStorage plan serialization |
| `savedPlanPresentation.ts` | Display formatting for saved plans |
| `courseHistoryImport.ts` | Paste/import parsing for completed courses |
| `feedback.ts` | Feedback submission helpers |
| `plannerFeedbackNudge.ts` | Nudge logic for feedback prompts |
| `quips.ts`, `quipBank.generated.ts` | Rotating UI quips |
| `BuildExplainerContent.tsx` | Explainer content renderer |

---

## Data Layer (`data/`)

All files are UTF-8-BOM CSVs. Manual edits only — never auto-modified by the engine.

| File | Rows | Purpose |
|------|------|---------|
| `courses.csv` | ~5000 | Base catalog: course code, name, credits, level, description, `elective_pool_tag` |
| `parent_buckets.csv` | 39 | Program envelopes: 12 majors, 7 minors, 12+ tracks, 7 universal (MCC, BCC) |
| `child_buckets.csv` | ~100 | Individual requirements: `requirement_mode` (required/choose_n/credits_pool), `courses_required`, `credits_required`, `min_level` |
| `master_bucket_courses.csv` | ~2000 | Explicit course-to-child-bucket membership |
| `course_hard_prereqs.csv` | ~800 | Hard prereq expressions, concurrent companions, standing gates |
| `course_soft_prereqs.csv` | ~1500 | Warning tags, raw catalog prereq text, restriction text, notes |
| `course_equivalencies.csv` | ~300 | Honors/grad/equivalent/cross-listed/no-double-count relationships |
| `course_offerings.csv` | ~5000 | Term scheduling history (currently disabled — all courses default to offered) |
| `policies.csv` | 76 | Normalized policy registry: 12 columns including `scope_type`, `scope_id`, `runtime_mode`, `implementation_status` |
| `policies_buckets.csv` | 177 | Policy-to-bucket join table with group aliases (ALL, ALL_COBA, ALL_CAS, etc.) |
| `quips.csv` | ~50 | Rotating UI quips for the frontend |
| `data_model.md` | — | Mermaid diagram and narrative of runtime data assembly |

### Data Assembly Flow

```
courses.csv + course_hard_prereqs.csv + course_soft_prereqs.csv
    → Course catalog with prereq overlay

parent_buckets.csv + child_buckets.csv + master_bucket_courses.csv
    → Parent/child requirement graph

course_equivalencies.csv
    → Prereq expansion, bucket expansion, cross-list handling, NDC blocking

courses.elective_pool_tag + qualifying credits_pool buckets
    → Dynamic elective synthesis (biz_elective tag)

config/ranking_overrides.json
    → Bucket priority boosts applied at ranking time
```

---

## Config (`config/`)

| File | Purpose |
|------|---------|
| `ranking_overrides.json` | Manual priority overrides for specific courses or buckets. Applied during ranking phase |
| `data_investigation_queue.json` | Flagged data issues from nightly analysis. Human-reviewed before CSV edits |
| `autotune_ledger.json` | Regression and boost-resistance detection for the nightly auto-tune flow |

---

## Scripts (`scripts/`)

| Script | Purpose |
|--------|---------|
| `analyze_nightly.py` | Nightly auto-tune: runs student profiles, detects regressions, updates `ranking_overrides.json` and `data_investigation_queue.json` |
| `run_local.py` | Launches both backend and frontend for local development |
| `discover_equivalencies.py` | Discovers new equivalency relationships from catalog text |
| `compile_quips.py` | Compiles quip bank from `data/quips.csv` to `quipBank.generated.ts` |
| `validate_track.py` | Validates track data integrity |
| `scrape_undergrad_policies.py` | Scrapes Marquette Bulletin policy pages |
| `ensure_frontend_build.py` | Pre-deploy frontend build check |
| `eval_advisor_match.py`, `advisor_match_common.py` | Advisor matching evaluation utilities |

---

## Tests (`tests/`)

| Directory | Framework | Count | Coverage |
|-----------|-----------|-------|----------|
| `tests/backend/` | Pytest | 612+ | Allocator, eligibility, recommender, prereq parser, API contract, regression profiles, track-awareness, dead-end detection, schema migration, policy verification |
| `tests/frontend/` | Vitest | — | Component and hook tests |
| `tests/nightly_reports/` | — | — | Archived nightly analysis output |

Key test files:
- `test_semester_recommender.py` — core engine behavior
- `test_allocator.py` — bucket allocation, overflow, double-count
- `test_recommend_api_contract.py` — API shape and validation
- `test_regression_profiles.py` — known student profiles that must not regress
- `test_dead_end_fast.py` — fast guardrail for planner/ranking changes
- `test_policy_verification.py` — COBA_05/06, CRED_01/02/04/10 enforcement

Run: `.venv/Scripts/python.exe -m pytest tests/backend -m "not nightly" -q`

---

## Infrastructure (`infra/`)

| File | Purpose |
|------|---------|
| `docker/Dockerfile` | Production Docker image build |
| `README.md` | Infrastructure layout and deployment notes |

Root-level integration files: `render.yaml` (Render Blueprint), `.dockerignore`, `.gitignore`, `.env.example`.

Production deployment: Render. Flask serves the static Next.js export from `frontend/out/` and handles API requests. Feedback stored at `FEEDBACK_PATH` (persistent disk in production, local file in dev).

---

## Invariants

- Deterministic ordering for identical inputs — same programs + same courses = same plan.
- No recommendation for completed or in-progress courses.
- No note-only or co-req-only codes leak into the hard prerequisite graph.
- `manual_review` surfaced explicitly in output.
- Non-elective buckets always take precedence over elective pools.
- All 76 policies documented; 22 runtime-enforced, remainder deferred with clear status.
