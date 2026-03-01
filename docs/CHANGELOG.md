# CHANGELOG

All notable changes to MarqBot are documented here.

Format per release:
- `Changes`: what shipped.
- `Design Decisions`: why those changes were made.

---

## [v2.0.2] - 2026-03-01

### Changes

**UI revamp — Marquette design language integration**
- Applied Marquette brand visual language across landing, onboarding, and planner: section color banding, gold/blue accent borders, serif italic accents, stat-card decorations, hash-mark section labels, anchor-line dividers.
- Updated branding copy across planner, onboarding, and empty states to match `docs/branding.md` voice (student-built, witty upperclassman tone).
- Responsive typography via CSS `clamp()` on h1–h3 element selectors.
- 4 new shared components: `StatCard`, `SplitCard`, `AnchorLine`, `HashMark`.

**Progress modals — major sub-grouping**
- "Major Requirements" and "Tracks & Minors" sections in both ProgressModal and SemesterModal now sub-group buckets by individual program (e.g., separate "BUAN", "Marketing", "Real Estate" headings).
- Primary major listed first when applicable, otherwise follows user's selected order.
- New `groupProgressByTierWithMajors()` in `rendering.ts`; `programOrder` derived from `selection_context.selected_program_ids`.

**Planner polish**
- "Get My Plan" button glow: two-layer gold shadow (`24px @ 35%` + `48px @ 15%`).
- "How Marqbot Recommends Courses" modal title: gold color, h3-scale sizing.
- Semester heading in recommendations panel: h4 (no clamp override) for tighter fit.
- KPI tiles: removed `stat-card-decor` gradient, kept `text-3xl` bold numbers.
- Course code/title font bumped 20% across all density tiers.
- Semester heading in recommendations reduced 30%.
- Projected progress in SemesterModal restyled to match ProgressModal's bucket cards.

### Design Decisions
- Sub-grouping majors inside tier sections gives multi-major students a clearer mental model without breaking the MCC → BCC → Major → Track hierarchy.
- CSS `clamp()` on heading elements ensures consistent responsive sizing but requires `h4` (no clamp rule) for small UI headings to avoid inflation.
- Gold glow on the primary CTA reinforces Marquette brand while drawing attention to the main action.

---

## [v2.0.1] - 2026-03-01

### Changes

**Prerequisite cleanup — removed phantom course recommendations**
- Cleaned up ~40 OR-alternative prerequisites that were causing unrelated courses (MATH 1700, COMM 1700, SOCI 2060, etc.) to appear in recommendations as "unlock targets."
- OR alternatives replaced with the primary business course (usually BUAD 1560 for stats) or converted to AND where all prereqs are truly required.
- Future `course_equivalencies` sheet will handle OR equivalences for completed/in-progress credit only — they no longer affect recommendations.

**Core prereq blocker fix**
- Fixed a bug where universal buckets (BCC_REQUIRED, MCC_CORE, etc.) were included in the core_prereq_blocker scoring, causing random non-major courses to get boosted in recommendations.
- The existing BCC::/MCC:: prefix filter was dead code — bucket IDs are plain strings, not namespaced. Replaced with proper parent-type lookup.

**"How Marqbot Recommends" rewrite**
- Rewrote the explainer modal from 7 jargon-heavy steps to 5 plain-English steps a student can actually understand.

**Data cleanup**
- Removed MATH 4720 and ECON 1001 from all data files (not real courses students take).
- Restored MATH 1200 (prereq for MATH 1400 which is BCC_REQUIRED).
- Updated all 14 advisor gold profiles with corrected expected recommendations.

### Design Decisions
- OR-alternative prereqs were the root cause of phantom recommendations — the engine treated every OR branch as an unlock target. Stripping them from prereq data and deferring equivalency logic to a future `course_equivalencies` sheet keeps the recommendation engine clean.
- `hard_prereq_complex` tag added to INSY 4158 (choose 2 from 5) and OSCM 4997 (choose 1 from 3) — genuinely unparseable patterns.
- CORE 1929 (`THEO 1001 or PHIL 1001`) kept as OR — commonly known and intentional.

---

## [v2.0.0] - 2026-02-28

### Changes

**Smarter recommendations — chain depth, multi-bucket scoring, and dual-major balance**
- Courses that start long prerequisite chains now rank higher. FINA 3001 (depth 4 — unlocks a 5-semester sequence to AIM 4430) gets scheduled before standalone electives with no downstream dependencies.
- Multi-bucket score is now prioritized over direct unlock count. A course counting toward your major, BCC, and a track requirement simultaneously ranks above one that only fills a single bucket.
- Dual-major students now get balanced picks. If Finance already has 3 picks and INSY has 0, the next FINA course is deferred so INSY can catch up. No major gets starved.
- Removed `hard_prereq_complex` tag from all courses with parseable prerequisites (~80 courses unblocked, including all INSY 4051-4055 core courses and AIM 4310-4430 track chain).
- Lowered FINA 3001 standing gate from Senior (90 credits) to Sophomore (24 credits), unblocking the AIM FinTech chain much earlier in the plan.

**Graduation projection**
- When a future semester has no eligible courses and all degree requirements are projected as satisfied, the planner now shows "You will have graduated!" instead of "No eligible courses."
- Both the main semester view and the sidebar semester list display the graduation indicator.
- Added a disclaimer: "ESSV2, WRIT, and Discovery courses are not yet considered."

**Bug fix — BCC progress satisfaction**
- Fixed a bug where course-count buckets (like BCC Required: 18 courses) could show as unsatisfied even when all courses were completed, because the satisfaction check was comparing credits (52) against an estimated credit target (54) instead of using the actual course count (18/18).
- Satisfaction now uses OR logic: if either the course-count OR credit threshold is met, the bucket is satisfied.

**"How Marqbot Recommends Courses" — rewrite**
- Updated the explainer modal to match the actual 7-step algorithm: Eligibility Filter, Requirement Tiers, Prereq Blocker Priority, Chain Depth, Multi-Bucket Score, Direct Unlockers, Program Diversity.

**Code audit and cleanup (from prior session)**
- Removed duplicate helper functions, dead frontend utility, button typo fix, archived migration scripts.
- Fixed 9 backend test expectations + 4 frontend lint errors. All 377 tests pass.
- Rewrote README as a student-friendly intro. Added `docs/data_model.md`.
- Fixed standing gate deadlock in multi-semester recommendations.
- Deactivated MCC_ESSV2, MCC_DISC, and all 5 Discovery Theme tracks until course data is injected.

### Design Decisions
- Chain depth is computed once at startup via memoized recursive traversal (O(V+E), ~300 courses). No per-request cost.
- Program balance uses a threshold of 2: a program must have ≥ min_picks + 2 before deferral kicks in. Single-major students see no change.
- Satisfaction OR logic ensures that mixed-unit buckets (both course-count and credit targets) don't falsely block graduation projection.
- `hard_prereq_complex` removal was a data cleanup — the prereq parser already handles "or" prereqs correctly; the tag was a leftover TODO from data migration.

---

## [v1.9.8] - 2026-02-28

### Changes

**Requirement progress — grouped hierarchy view**
- Progress panels (Degree Summary, Progress Modal, Semester Modal) now group bucket entries by parent program instead of a flat sorted list.
- Each group shows a labeled section header (e.g. "Finance", "MCC Foundation") with child buckets indented beneath it.
- Hidden parents (`MCC_ESSV2`, `MCC_WRIT`) are filtered from the display until their data is fully injected.

**Planning Settings moved to Preferences pane**
- The "Include Summer Semesters" toggle was in the wrong pane (Your Profile). Moved it to the Preferences pane, right below Semesters and Max Courses.

**Max semesters raised to 8**
- Semester count now accepts 1–8 (was 1–4). Both the UI options list and backend validation/clamp updated.

**Summer semester UX polish**
- Added a gold-tinted note inside the Semester Detail modal when the selected semester is a summer: "Summer semesters are capped at 4 courses (max 12 credits)."
- Suppressed the "You requested N, but only 4 eligible" warning for summer semesters since the 4-course cap is by design.

**Coming Soon — Discovery Theme and Minors**
- Discovery Theme dropdown in the profile modal now shows a translucent "Coming Soon" overlay and is non-interactive. Data not yet injected.
- Minors dropdown similarly marked Coming Soon; no minor data injected yet.

**"How Marqbot Recommends Courses" modal — rewrite**
- Rewrote the explainer modal (accessible via link next to the Can I Take search bar) in a first-person, student-facing voice.
- Now covers 7 steps (0–6): Reality Check First, MCC Foundation, Business Core (BCC), Major Requirements, Tracks & Minors, Course Unlockers, Multi-Bucket Efficiency.
- Removed the redundant "Standing Gates" step (already covered by step 0). Added BCC as its own step. Added Multi-Bucket Efficiency as the final step.

**MCC Writing Intensive (WRIT) bucket deactivated**
- Set `MCC_WRIT active=False` in `data/parent_buckets.csv`. WRIT courses no longer appear in recommendations until the bucket is re-activated after full data review.
- Deactivating the parent bucket cascades through the runtime: its sub-buckets are dropped via inner join, course mappings are removed from the eligibility pool, and WRIT-only courses are skipped (no eligible bucket).

**AIM primary major enforcement**
- Set `AIM_MAJOR requires_primary_major=True` in `data/parent_buckets.csv`. AIM is now correctly treated as a secondary-only major alongside BUAN and INBU.
- Removed the hardcoded `majorId === "AIM_MAJOR" ? true : ...` override from `frontend/src/lib/api.ts` — the data carries the correct value now.
- Added frontend warning in both the onboarding Major step and the planner profile modal: when every selected major has `requires_primary_major=True`, a yellow banner prompts the student to add a standalone primary major.
- Backend already returned `PRIMARY_MAJOR_REQUIRED` (HTTP 400) for this case; the frontend warning now surfaces it before the API call.

### Design Decisions
- Grouping progress by parent gives students a clearer mental model of their degree structure (e.g. all Finance sub-requirements under one "Finance" header) rather than a flat alphabetical list.
- WRIT deactivation is a data-readiness gate, not a feature removal. The bucket and its 103 course mappings remain in the CSV; flipping `active` back to `True` re-enables it instantly.
- AIM primary major rule is enforced at both data and frontend layers: data is the source of truth, frontend gives early feedback, backend is the hard gate.

---

## [v1.9.7] - 2026-02-28

### Changes

**MCC course data — ESSV2, WRIT, CULM buckets now populated**
- Added 107 Engaging Social Systems & Values 2 (ESSV2) approved courses to the data model; MCC_ESSV2 bucket now has full course mappings.
- Added 103 Writing Intensive (WRIT) approved courses; MCC_WRIT bucket now has full course mappings.
- Added CORE 4929 as the Culminating Experience (CULM) course; MCC_CULM bucket now has a mapping.
- All three buckets previously returned no recommendations; students needing these requirements now receive course suggestions.

**Summer semester recommendations**
- New "Include Summer Semesters" toggle in Planning Settings (default Off).
- When enabled, summer semesters appear in the plan capped at 4 courses, showing only summer-available offerings.
- When disabled, summer semesters are skipped and the plan delivers the requested number of non-summer semesters.

**Running academic standing**
- Marqbot now tracks your academic standing (Freshman / Sophomore / Junior / Senior) across each planned semester.
- Standing is computed from your completed courses at the start and projected forward as you complete each semester's recommendations.
- Courses requiring a minimum standing (e.g. Junior-only seminars) are automatically held until you qualify.
- Each semester card now shows a standing badge: e.g. "Semester 1 – Fall 2025 · Freshman Standing".

**"How Marqbot Recommends Courses" explainer**
- Added a link near the course search bar in the Recommendations panel.
- Opens a modal describing the five recommendation tiers: Foundation First, Major Requirements, Tracks & Minors, Standing Gates, and Prerequisite Chains.

**Bug fixes**
- Fixed a crash when using the CSV data source: prerequisite standing values were read as strings, causing a type error during eligibility checks.
- Restored BCC (Business Core Curriculum) decay behavior: once core BCC requirements are substantially complete, lower-priority BCC courses are deprioritized in favor of major-specific courses.

### Design Decisions
- ESSV2 and WRIT bucket course data is live in the data model; the frontend "coming soon" treatment for those buckets will land in a future patch.
- Summer course cap of 4 matches typical summer session load limits at Marquette.
- Standing projection is additive: each semester's recommended credits accumulate before the next semester's eligibility gate runs, so a student finishing Semester 1 as a Freshman may start Semester 2 as a Sophomore.

---

## [v1.9.6] - 2026-02-27

### Changes

**Data source migration: Excel → CSV directory**
- Changed `_DEFAULT_DATA_PATH` in `backend/server.py` from `marquette_courses_full.xlsx` to `data/`. Backend now reads from the six CSV files in `data/` by default; Excel remains as a manual override via `DATA_PATH` env var.
- Fixed `_canonical_program_label` in `backend/server.py`: was hardcoded to ignore CSV labels for `kind=major` and always generate `"{code} Major"` format. Now uses the CSV `parent_bucket_label` as priority; falls back to generated format only when label is absent.
- Removed `MAJOR_LABEL_OVERRIDES` dict from `frontend/src/lib/api.ts` — was an Excel-era workaround that mapped abbreviated labels (e.g. "ACCO Major" → "Accounting"). No longer needed since labels now come directly from CSVs.
- Deleted `marquette_courses_full.xlsx`; removed xlsx COPY line from `infra/docker/Dockerfile`; updated `scripts/validate_track.py` default `--path` to `data/`.

**Stage 1 data injection — `data/courses.csv`, `data/course_prereqs.csv`, `data/course_offerings.csv`**
- Injected 268 business school catalog entries (ACCO, AIM, BUAD, BUAN, BULA, ECON, ENTP, FINA, HURE, INBU, INSY, LEAD, MANA, MARK, OSCM, REAL) via `scripts/inject_stage1.py`.
- CSV BOM fix: changed `read_csv` in inject script to use `encoding="utf-8-sig"` to handle UTF-8 BOM on first column.

**Stage 2 data injection — `data/parent_buckets.csv`, `data/child_buckets.csv`, `data/master_bucket_courses.csv`**
- Added 5 new majors: Marketing (MARK_MAJOR), Real Estate (REAL_MAJOR), Business Economics (BECO_MAJOR), Business Administration (BADM_MAJOR), International Business (INBU_MAJOR).
- Added 7 minors: Business Administration, Entrepreneurship, Human Resources, Information Systems, Marketing, Supply Chain Management, Professional Selling.
- Added 2 new tracks: Professional Selling Concentration (MARK_PRSL_TRACK), Real Estate Asset Program Concentration (REAL_REAP_TRACK).

**CSV integrity fixes**
- AIM 4410: removed ghost prereq `FINA 5075` (graduate code), corrected to `FINA 4075`; fixed `min_standing` from 5.0 → 4.0; removed erroneous `may_be_concurrent`/`instructor_consent` warnings; kept `major_restriction` only.
- MATH 1200: cleared all prereqs and warnings (was incorrectly flagging `instructor_consent;standing_requirement`).
- HOPR 2956H, INPS 2010: fixed `prereq_warnings` separator from `;` to `,`.
- REAL 4002: added to all three CSVs as a cross-listing of FINA 4002 (Commercial Real Estate Finance); resolves orphaned prereq references in REAL 4xxx courses.

**Label cleanup — `data/parent_buckets.csv`**
- Removed "Major" suffix from all major display labels (e.g. "Finance Major" → "Finance", "Accounting Major" → "Accounting").
- Removed "Minor" suffix from all minor display labels (e.g. "Entrepreneurship Minor" → "Entrepreneurship").
- Set AIM label to "AIM - Accelerating Ingenuity in Markets".
- Prefixed Discovery tier track labels with "MCC Discovery:" for clarity in the UI.

**Frontend — MajorStep redesign (`frontend/src/components/onboarding/MajorStep.tsx`)**
- Restructured from a single-column conditional layout to 4 explicit sections: Major(s), Minor(s), Concentration / Track, Discovery Theme.
- Concentration/Track section always visible; shows placeholder text when no major with tracks is selected.
- Added Discovery Theme section: single-select combobox for MCC_DISC tracks (CMI, BNJ, CB, EOH, IC), using existing track selection state keyed by `MCC_DISC`.
- Compacted spacing and font sizes; removed `<hr>` dividers between sections.
- Updated heading to "What's your program?".

### Design Decisions
- CSV directory is the permanent data source going forward; Excel file deleted. All future data changes go through the CSV files.
- Label authority lives in `parent_bucket_label` column — no frontend overrides. Keeps display names in one place and avoids frontend/data drift.
- Discovery themes are tracks (not a separate entity type) to reuse existing `SET_TRACK` dispatch and `selectedTracks` state without new reducer logic.

---

## [v1.9.3] - 2026-02-27

### Changes
- Redesigned planner to a 45/55 dual-column layout: Progress on the left, Recommendations on the right.
- Merged Profile and Preferences into one side-by-side modal (edit pencil icon in the header).
- Added "Get Recommendations" button inside the modal — it auto-closes and fetches your plan.
- Moved "Can I Take This?" inline above the semester tabs for quicker access.
- Removed the left sidebar — all settings now live in the Profile & Preferences modal.
- Enlarged text in semester detail views for easier reading.
- Standardized all warnings to red for clearer visibility (removed yellow warning icons).
- Completed degree buckets now show in green in the Degree Summary.
- Scaled up progress ring, KPI cards, and degree summary for the wider layout.
- Semester tab buttons auto-adapt height based on how many semesters are shown.

### Design Decisions
- 45/55 split gives recommendations more horizontal space since they contain the most detail, while progress and degree summary benefit from full vertical height.
- Merging profile and preferences into one modal reduces clicks and keeps the main viewport focused on results.
- Inline Can-I-Take above semester tabs is contextually closer to the recommendations it relates to.
- Red-only warnings are simpler to scan than mixed yellow/red severity levels.

---

## [v1.9.2] - 2026-02-25

### Changes
- Improved planner responsiveness so recommendation and eligibility requests return faster on larger plans.
- Fixed deployment packaging so Render consistently serves both backend APIs and the latest frontend build from one service.
- Added a single local run command (`python scripts/run_local.py`) that auto-builds the frontend export when needed.
- Archived older one-time migration and investigation scripts under `scripts/archive/` to keep active maintenance scripts easier to navigate.
- Removed duplicate root-level `PRD.md` and `CHANGELOG.md`; canonical product and release docs are now under `mds/`.

### Design Decisions
- Kept behavior-preserving refactors focused on runtime speed and operational reliability.
- Moved historical scripts to archive instead of permanently deleting them so prior migration history remains available.

---

## [v1.9.1] - 2026-02-25

### Changes
- Removed unused code: dead imports, orphaned constants, unused component (KpiCards), and stub functions.
- Removed unused dependencies: root Jest/jsdom devDeps, `array.prototype.flatmap` polyfill.
- Fixed stale README references to `PRD.md` and `CHANGELOG.md` (now point to `mds/`).

### Design Decisions
- Cleanup-only release. No behavior changes. All 270 backend tests pass, frontend lint and build clean.

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
  fail on zero-overlap profile). Added `tests/backend/test_advisor_match.py` (offline
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

---

## [Unreleased]

### Changes
- Removed recommendation-card feedback feature end-to-end:
  - Removed feedback buttons from card rendering.
  - Removed frontend feedback wiring and API helper.
  - Removed backend `POST /feedback` endpoint and feedback file-writing logic.
  - Removed feedback backend test suite.
- **Next.js frontend (`frontend/`)**: Complete migration from vanilla JS SPA to Next.js 16 +
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
