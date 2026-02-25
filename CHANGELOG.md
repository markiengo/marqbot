# CHANGELOG

All notable changes to MarqBot are documented here.

Format per release:
- `Changes`: what shipped.
- `Design Decisions`: why those changes were made.

---

## [v1.9.0] - 2026-02-24

### Changes
- **BCC progress-aware decay (5-tier system)**: `_bucket_hierarchy_tier_v2()` now accepts
  `bcc_decay_active` param. When `BCC_DECAY_ENABLED=true` (env flag, default off) and a student
  has >=12 courses applied to BCC_REQUIRED, BCC_REQUIRED demotes from Tier 1 -> Tier 4 (below
  track). Demoted BCC children (BCC_ETHICS/ANALYTICS/ENHANCE) shift from Tier 4 -> Tier 5.
  `_count_bcc_required_done()` helper computes the done count from `build_progress_output`.
- **Production hardening**: Added `GET /health` endpoint (`{"status":"ok","version":"1.9.0"}`),
  `@app.after_request` security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy),
  and manual token-bucket rate limiting on `/recommend` (10 req/min per IP, bypassed in TESTING
  mode).
- **Feedback infrastructure**: Added `POST /feedback` endpoint (validates course_code + rating,
  rank/tier integer shape, and appends JSON lines to `FEEDBACK_PATH`, default `feedback.jsonl`).
  Added `postFeedback()` to `frontend/modules/api.js`, feedback strip buttons to every
  recommendation card in `renderCard()`, and click handlers in `app.js` with session_id
  generation and double-submission guard.
- **Gold dataset + advisor match eval**: Created `eval/advisor_gold.json` (14 freshman profiles
  covering all active business majors, including BUAN as a secondary-major case). Created
  `scripts/eval_advisor_match.py` (>=4/6 overlap case pass, >=80% passing-case release gate, hard
  fail on zero-overlap profile). Added `tests/backend_tests/test_advisor_match.py` (offline
  variant using Flask test client).
- **Regression profiles expanded**: Added `TestFinMajorJuniorBccSaturated` and
  `TestFinMajorSeniorBccFull` BCC-saturation profiles to `test_regression_profiles.py`.
- **Test suite growth**: Backend 326 -> 376 (+50), Frontend 62 -> 98 (+36).

### Design Decisions
- BCC decay behind env flag (`BCC_DECAY_ENABLED`) for safe rollout: enable only after Advisor
  Match baseline confirms >=80%.
- 5-tier instead of 4-tier: decayed BCC_REQUIRED at Tier 4 (below track Tier 3) preserves major
  course priority without disrupting existing tier semantics.
- Demoted BCC children (BCC_ETHICS etc.) promoted from Tier 4 -> Tier 5: now always below decayed
  BCC_REQUIRED, preserving relative ordering intent.
- Rate limiting uses manual token bucket (no new deps) rather than Flask-Limiter.
- Feedback uses append-only JSONL on a Render persistent disk (provision separately).

## [Unreleased]

### Changes
- Removed recommendation-card feedback feature end-to-end:
  - Removed feedback buttons from card rendering.
  - Removed frontend feedback wiring and API helper.
  - Removed backend `POST /feedback` endpoint and feedback file-writing logic.
  - Removed feedback backend test suite.
- **Next.js frontend (`frontend-next/`)**: Complete migration from vanilla JS SPA to Next.js 16 +
  TypeScript + Tailwind CSS 4 with App Router and static export.
  - 53 source files across `src/lib/`, `src/context/`, `src/hooks/`, `src/components/`, `src/app/`.
  - Dark navy theme with gold/blue accents, glassmorphic cards, atmospheric CSS orb backgrounds.
  - Routes: `/` landing, `/onboarding` 3-step wizard, `/planner` main app, `/courses`, `/saved`,
    `/ai-advisor` coming-soon pages.
  - Fonts: Sora (headings) + Plus Jakarta Sans (body) via `next/font/google`.
  - Framer Motion (via `motion/react`) for page transitions and micro-interactions.
  - React Context + useReducer for state, localStorage session persistence.
- **Planner crash fixes**: `loadCourses()` now unwraps Flask `{courses: [...]}` wrapper.
  `loadPrograms()` maps `major_id`/`track_id` to frontend `id` field. Defensive `Array.isArray`
  guard in `RESTORE_SESSION` reducer.
- **Request payload contract**: `useRecommendations` and `useCanTake` hooks now send
  `completed_courses`/`in_progress_courses` as comma-delimited strings (matching backend
  `normalize_input`). `declared_majors` omitted when empty. `track_id` only sent when a real track
  is selected (no more `FIN_MAJOR` major-as-track fallback).
- **Backend input tolerance**: Added `_coerce_course_list()` helper so `/recommend` and `/can-take`
  accept both comma-delimited strings and JSON arrays for course lists.
- **Error handling**: `postRecommend`/`postCanTake` parse backend error JSON for user-friendly
  messages. Invalid-input response now returns HTTP 400 (was 200).
- **Route hardening**: Added `/api/<path>` catch-all returning JSON 404. SPA catch-all now returns
  404 for missing static assets instead of serving `index.html`.
- **Planner 2x2 layout**: Full-viewport quad grid on desktop (>1200px) — TL: profile inputs +
  submit, TR: progress + degree summary, BL: preferences + can-take, BR: recommendations.
  Responsive: 2-col tablet, single-col mobile. New `PreferencesPanel` component extracted from
  `InputSidebar`.
- **Empty state UX**: "Pick your major to get started" card shown in recommendations quad when no
  major selected. Get Recommendations button disabled with inline hint until major is chosen.
- **Coming Soon pages**: Redesigned `PlaceholderPage` to full-viewport immersive experience with
  blurred background image, dark gradient overlay, staggered motion animations, and gold badge.
- **Performance**: Memoized `excludeSet`/`defaultMatches` in `MultiSelect`. Added stale-request
  cancellation via `useRef` counter in recommendation and can-take hooks.
- **ESLint fix**: Downgraded from ESLint 10 to 9 for `eslint-config-next` compatibility. Replaced
  broken `FlatCompat` bridge with native flat config import. Fixed `SingleSelect` lint error.
- **Cleanup**: Deleted `.xlsx.bak` backups, stray `nul` file. Updated `.gitignore` for Next.js
  build artifacts.

### Design Decisions
- Feedback controls added UI noise without improving core recommendation quality for students.
- Next.js chosen for SEO-friendly landing page, file-based routing, and static export compatibility
  with existing Flask serving.
- Dark navy theme aligns with Marquette branding while differentiating from generic light SaaS UIs.
- 2x2 planner grid maximizes information density on desktop — all four concern areas visible without
  scrolling the page.
- Backend accepts both string and array formats for course lists to be tolerant of client variations.
- Stale-request cancellation prevents race conditions when users rapidly re-submit recommendations.

---

## [v1.8.3] - 2026-02-24

### Changes
- Switched dashboard KPI logic to credit-based metrics using workbook course credits.
- Added standing classification from completed credits:
  - Freshman: 0-23
  - Sophomore: 24-59
  - Junior: 60-89
  - Senior: 90+
- Updated progress ring to use credit denominator (`124`) with completed + in-progress visualization.
- Removed low-value recommendation/progress surfaces:
  - double-counted courses section
  - courses remaining / estimated terms timeline cards
- Enforced deterministic same-family child assignment order:
  - `required` -> `choose_n` -> `credits_pool`
  - then priority
  - then lexical bucket ID tie-break
- Fixed ranking tier behavior so any course that fills `BCC_REQUIRED` is treated as Tier 1 (even when not primary bucket).
- Completed workbook integrity audit and refreshed data model docs.

### Design Decisions
- Shift KPI framing from bucket-slot counts to credit reality because students understand credits better than internal allocation counters.
- Keep same-family assignment deterministic to eliminate random routing and inconsistent `fills_buckets` interpretation.
- Remove UI sections that add cognitive load without improving course-taking decisions.
- Preserve cross-family sharing defaults while preventing same-family elective leakage.

---

## [v1.8.2] - 2026-02-24

### Changes
- Brought recommender selection behavior in line with allocator semantics.
- Applied same-family non-elective-first routing during semester packing.
- Enforced pairwise double-count policy checks during selection.
- Corrected credits-pool virtual consumption to use course credits.

### Design Decisions
- Recommendation packing and progress allocation must obey the same rules; divergence creates trust failures.
- Credits-pool logic must be credit-native end-to-end (not inferred via course count).

---

## [v1.8.1] - 2026-02-24

### Changes
- Refreshed documentation of recommender hierarchy and tie-break behavior.
- Clarified and validated cross-major elective sharing behavior.
- Normalized recommendation bucket-tag capitalization.

### Design Decisions
- Policy clarity in docs is part of product correctness for advisor-facing systems.
- Cross-major sharing should be explicit and test-backed, not implicit.

---

## [v1.8.0] - 2026-02-24

### Changes
- Fixed credits-pool runtime integrity for `needed_credits` and `requirement_mode` projection paths.
- Corrected elective pool bucket progress display (e.g., `0/0` issues on credit-based buckets).
- Consolidated decision documentation to a single canonical file.

### Design Decisions
- Preserve workbook semantics through every runtime projection path.
- Favor one canonical architecture rationale source to avoid decision drift.

---

## [v1.7.11] - 2026-02-24

### Changes
- Locked tier hierarchy:
  - Tier 1: MCC + `BCC_REQUIRED`
  - Tier 2: major buckets
  - Tier 3: selected track buckets
  - Tier 4: demoted BCC children (`BCC_ETHICS`, `BCC_ANALYTICS`, `BCC_ENHANCE`)
- Introduced dynamic elective pool synthesis from `courses.elective_pool_tag`.
- Added same-family non-elective-first routing.
- Replaced hard diversity cap with soft-cap auto-relax behavior.

### Design Decisions
- Keep foundational curriculum visible but avoid elective capture ahead of core/choose requirements in the same family.
- Model elective pools dynamically to reduce static map maintenance risk.

---

## [v1.7.10] - 2026-02-24

### Changes
- Migrated to canonical parent/child workbook model:
  - `parent_buckets`
  - `child_buckets`
  - `master_bucket_courses`
- Preserved one-release compatibility for legacy runtime loading paths.
- Added track-family-aware double-count governance.

### Design Decisions
- Keep workbook schema explicit and scalable for majors/tracks/minors.
- Use family-based defaults plus targeted overrides instead of hardcoding special cases.

---

## [v1.7.9] - 2026-02-23

### Changes
- Implemented greedy bucket-aware recommendation selection.
- Applied MCC/BCC tier parity.
- Fixed MCC label capitalization and rendering consistency.

### Design Decisions
- Avoid recommendation list collapse into a single bucket when multiple unmet buckets exist.
- Treat universal overlays consistently across MCC/BCC for student-visible fairness.

---

## [v1.6.x to v1.7.8] - 2026-02-22 to 2026-02-23

### Changes
- Completed V2 runtime/data-model migration and governance hardening.
- Added MCC universal overlay and expanded workbook integrations.
- Rolled out left-rail + 2x2 planner UI architecture and modal/selector refinements.
- Added scalable semester planning controls and recommendation caps.
- Fixed already-satisfied bucket recommendation leakage.

### Design Decisions
- Prioritize deterministic planner behavior over speculative recommendation heuristics.
- Keep public API contracts stable while evolving workbook schema and runtime internals.

---

## [v1.0.0 to v1.5.0] - 2026-02-20 to 2026-02-21

### Changes
- Established stable deterministic runtime baseline.
- Introduced policy-driven allocation and track selection behaviors.
- Improved reliability, validation, and UI workflow foundations.

### Design Decisions
- Commit to data-driven governance and modular backend/frontend boundaries early.
- Prefer incremental contract-safe refactors over one-shot rewrites.
