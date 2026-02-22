# PROJECT_HISTORY.md - SemVer Release Timeline

This is the canonical project history for MarqBot, inferred from git commit history in chronological order.

## Versioning Policy (SemVer)
1. `X` (major): incompatible public API/contract changes.
2. `Y` (minor): backward-compatible features and substantial improvements.
3. `Z` (patch): backward-compatible bug fixes.

---

<details open>
<summary><strong>X=0 (Pre-1.0 Incubation)</strong></summary>

<details>
<summary><strong>v0.1.0 - Repository Bootstrap</strong></summary>

Window:
1. `51e11e9` -> `750c9b3` (2026-02-18)

Why this version:
1. Initial repo setup and baseline project scaffolding.

Key outcomes:
1. Repository initialized and merged to a stable starting mainline.
2. Core folders established (`backend`, `frontend`, `tests`, docs).

</details>

<details>
<summary><strong>v0.2.0 - First Deterministic Planner Slice</strong></summary>

Window:
1. `05126dc` -> `7494033` (2026-02-18)

Why this version:
1. First meaningful feature leap: deterministic planning + two-semester capability direction.

Key outcomes:
1. AI provider switched to OpenAI.
2. Two-semester planning behavior and data-driven hierarchy introduced.
3. Initial user-facing planner workflow stabilized.

</details>

<details>
<summary><strong>v0.2.1 - Documentation and Onboarding Patch</strong></summary>

Window:
1. `63d487d` -> `db280da` (2026-02-18)

Why this version:
1. Backward-compatible docs/readability patch after feature launch.

Key outcomes:
1. README/PRD updated for deterministic two-semester planner.
2. Beginner-friendly setup docs improved.

</details>

<details>
<summary><strong>v0.3.0 - Reliability Refactor Wave</strong></summary>

Window:
1. `529fceb` -> `37b9c5a` (2026-02-18)

Why this version:
1. Significant internal quality improvement without breaking contracts.

Key outcomes:
1. Session persistence bug fixed.
2. Finance required mapping corrections applied.
3. Hardcoded prereq overrides removed; workbook became stronger source of truth.
4. `server.py` refactored into cleaner modules.
5. Frontend modularization and tests expanded.

</details>

<details>
<summary><strong>v0.3.1 - UX + Recommender Patch Pack</strong></summary>

Window:
1. `a844857` -> `0bd9d1c` (2026-02-18)

Why this version:
1. Backward-compatible polish patch across recommendation UX and behavior.

Key outcomes:
1. Can-take and recommendation UX improved.
2. Recommendation ranking/polish updates shipped.
3. README/PRD aligned to actual architecture and features.

</details>

<details>
<summary><strong>v0.4.0 - Schema and Validation Hardening</strong></summary>

Window:
1. `aaaf96d` -> `6b35972` (2026-02-19)

Why this version:
1. New capability in data governance and runtime correctness.

Key outcomes:
1. Course-bucket schema normalized.
2. Boolean coercion behavior hardened.
3. Track validation and role tie-break logic strengthened.
4. Phase/roadmap workspace consolidation.

</details>

<details>
<summary><strong>v0.5.0 - Program Selection and Assumption Stability</strong></summary>

Window:
1. `697dfc3` -> `0b4836a` (2026-02-20)

Why this version:
1. Feature expansion to program selection and improved prereq assumption behavior.

Key outcomes:
1. Phase 5 program-selection flow implemented.
2. UI refined for code-first course search and interaction stability.
3. Prerequisite assumption and source-data fixes improved recommendation consistency.

</details>

</details>

---

<details open>
<summary><strong>X=1 (Stable Runtime and Expansion)</strong></summary>

<details>
<summary><strong>v1.0.0 - V2 Runtime Migration Milestone</strong></summary>

Window:
1. `033896c` -> `3259b2d` (2026-02-20)

Why this version:
1. First stable architecture baseline after strict V2 migration.

Key outcomes:
1. Legacy/LLM dead code paths removed.
2. V2 dual-read introduced, then hard-cut to strict V2 runtime.
3. Policy-based N-way allocation and V2 track selection finalized.
4. Legacy workbook/runtime compatibility paths retired.

Compatibility:
1. Public API behavior stayed largely backward-compatible, but runtime model was fundamentally upgraded.

</details>

<details>
<summary><strong>v1.1.0 - Governance + Policy Explainability</strong></summary>

Window:
1. `ff23cb8` (2026-02-21)

Why this version:
1. Major feature addition in validator governance and policy transparency.

Key outcomes:
1. ROADMAP_V3 v3.1/v3.2 scope implemented.
2. Governance checks expanded.
3. Policy matrix support and student-clarity UI updates added.

</details>

<details>
<summary><strong>v1.1.1 - Track Input Guard Patch</strong></summary>

Window:
1. `fbb0d04` (2026-02-21)

Why this version:
1. Targeted backward-compatible UX bug fix.

Key outcomes:
1. Track input disabled when selected major has no concentrations.

</details>

<details>
<summary><strong>v1.2.0 - Runtime Mapping and Documentation Consolidation</strong></summary>

Window:
1. `3028f10` -> `67feac5` (2026-02-21)

Why this version:
1. Feature and maintainability expansion across runtime mapping, docs, and repo hygiene.

Key outcomes:
1. V2 mapping runtime and UI interaction updates finalized.
2. Canonical project history + student-first docs added.
3. Repo artifacts cleaned; ignore/env templates tightened.
4. Redundant planning docs/tool configs pruned.

</details>

<details>
<summary><strong>v1.3.0 - Dashboard UX and Program Coverage Expansion</strong></summary>

Window:
1. `f655165` -> `ef1106a` (2026-02-21)

Why this version:
1. User-visible feature expansion and major UI polish.

Key outcomes:
1. Dashboard spacing/layout quality improved.
2. HURE major model injection added.
3. Top-nav active-state behavior stabilized.
4. Student README expanded with product clarity.

</details>

<details>
<summary><strong>v1.3.1 - UI/Label Bugfix Patch Train</strong></summary>

Window:
1. `6979a5f` -> `7c76557` (2026-02-21)

Why this version:
1. A patch-focused sequence fixing regressions and naming/label consistency.

Key outcomes:
1. Frontend nav syntax error fixed (selector initialization unblocked).
2. Standing warning text corrected.
3. Recommendation badge sizing/layout normalized.
4. Rationale text generalized (not Finance-only).
5. Full major names shown in dropdown; program IDs hidden.
6. `gunicorn` dependency added and docs refreshed.

</details>

<details>
<summary><strong>v1.4.0 - Roadmap Handoff Release</strong></summary>

Window:
1. `253b489` (2026-02-21)

Why this version:
1. Product planning transition milestone.

Key outcomes:
1. README upcoming-work section summarized.
2. v4 roadmap positioned as detailed forward plan.

</details>

<details>
<summary><strong>v1.5.0 - Stabilization Precursor (Unreleased Branch Window)</strong></summary>

Window:
1. Current working tree after `v1.4.0` (no release tag yet)

Why this version:
1. Pre-release integration wave that prepared the v1.6 line.

Current themes:
1. Double-count behavior fixes in projected/in-progress paths.
2. Standing/manual-review cleanup in workbook data.
3. Top-nav/screen behavior updates (Courses/Saved/AI placeholder routes).
4. Render deployment config hardening (`render.yaml`, runtime path handling).

Gate status at close of this window:
1. Backend tests passing locally.
2. Frontend tests passing locally.
3. Validator passing locally.

Carry-forward blockers:
1. `FIN_CORE` needed strict 3-course normalization.
2. Remaining prereq/manual-review intent needed to be data-sourced.
3. Release cut and migration packaging still pending.

</details>

<details>
<summary><strong>v1.6.0 - Data-Model Governance Migration</strong></summary>

Window:
1. 2026-02-22 working tree migration batch

Why this version:
1. Contract-level workbook/schema migration with runtime compatibility gates.

Key outcomes (migrated from `docs/CHANGELOG.md`, expanded here):
1. Added `programs.applies_to_all` and established `BCC_CORE` as a universal overlay owner.
2. Renamed track program IDs to canonical `*_TRACK` values and added alias compatibility for legacy inputs (`CB`, `FP`, `*_CONC`).
3. Moved BCC ownership to `BCC_CORE` in `buckets`, `sub_buckets`, and `courses_all_buckets`.
4. Kept `courses_all_buckets` structural schema stable while correcting source data (including strict `FIN_MAJOR::FIN_CORE` composition).
5. Renamed `course_equivalencies.restriction_note` to `course_name`, populated labels, and scoped current entries to `FIN_MAJOR`.
6. Normalized `course_prereqs.concurrent_with` by removing literal `"none"` payloads (blank cell policy).
7. Reworked `course_offerings` into wide literal semester columns and changed confidence derivation to last-3-term frequency (`high`/`medium`/`low`).
8. Simplified `double_count_policy` to program + sub-bucket pair exceptions.
9. Updated loader/server/eligibility/requirements/validator for v1.6 schema while keeping public API shape stable.
10. Added migration and verification scripts for reproducible data-first changes.

Behavioral clarifications:
1. Parent-family no-double-count default still applies unless policy row explicitly allows overlap.
2. Recommendation flow now treats `medium` and `low` offering confidence as warning paths instead of hard exclusion.

</details>

<details>
<summary><strong>v1.6.1 - Placeholder UI Visual Upgrade</strong></summary>

Window:
1. 2026-02-22 patch batch

Why this version:
1. UX-focused patch release for static nav screens and brand consistency.

Key outcomes:
1. Added full-screen cover-image placeholders:
   - Courses: `frontend/screen_courses_cover.jpg`
   - Saved: `frontend/screen_saved_cover.jpg`
   - AI Advisor: `frontend/screen_aiadvisor_cover.jpg`
2. Added translucent blurred overlay layers so foreground controls remain readable.
3. Kept Coming Soon + Notify UI on top of the image treatment.
4. Replaced topbar logo usage to `frontend/marquette_logo2.jpg` and removed legacy `frontend/marquette-logo.jpg`.
5. Smoothed transitions between Plan shell and placeholder screens using class-based fade/slide state, replacing abrupt show/hide toggles.

</details>

<details>
<summary><strong>v1.6.2 - MCC Universal Overlay Injection (Data-First)</strong></summary>

Window:
1. 2026-02-22 migration patch batch

Why this version:
1. Added Marquette Core Curriculum (MCC) as a universal requirement overlay, implemented as source-data updates first.

Key outcomes:
1. Added `MCC_CORE` to `programs` with `applies_to_all=TRUE` (non-selectable universal program).
2. Added MCC bucket family to workbook:
   - Bucket: `MCC`
   - Sub-buckets: `MCC_Foundation`, `MCC_ESSV1`, `MCC_CULM`
3. Added 25 MCC courses into:
   - `courses`
   - `course_prereqs`
   - `course_offerings` (last-3-term booleans)
   - `courses_all_buckets` (mapped under `MCC_CORE`)
4. Added backend overlay key compatibility so MCC namespaces the same way as BCC in merged-plan views (`MCC::...`).
5. Kept rule interpretation deterministic through workbook fields (`prerequisites`, `prereq_warnings`, `min_standing`) rather than hardcoded logic.

Source-data note (intentional):
1. MCC includes SPAN courses with prereq references to `SPAN 3001` / `SPAN 3005`, which are not currently present in `courses`; references were intentionally retained as catalog-authored constraints pending future catalog expansion.

</details>

<details>
<summary><strong>v1.6.3 - Plan-Screen Visual Consistency Patch</strong></summary>

Window:
1. 2026-02-22 frontend patch batch

Why this version:
1. UI consistency and legibility improvements across the new static screens and plan lane.

Key outcomes:
1. Standardized Notify controls typography across all placeholder screens so input and button fonts align with the product type system.
2. Added plan-screen cover background using `frontend/screen_plan_cover.jpg`.
3. Applied the same translucent/blur layering approach used by static placeholders to the plan shell.
4. Tuned left/center/right panel translucency independently so the three planning lanes remain visually distinct on top of the plan cover.
5. Extended frontend contract tests to cover the plan background asset and notify font contracts.

</details>

</details>

---

## Commit-to-Version Index (Quick Map)
1. `v0.1.0`: `51e11e9` -> `750c9b3`
2. `v0.2.0`: `05126dc` -> `7494033`
3. `v0.2.1`: `63d487d` -> `db280da`
4. `v0.3.0`: `529fceb` -> `37b9c5a`
5. `v0.3.1`: `a844857` -> `0bd9d1c`
6. `v0.4.0`: `aaaf96d` -> `6b35972`
7. `v0.5.0`: `697dfc3` -> `0b4836a`
8. `v1.0.0`: `033896c` -> `3259b2d`
9. `v1.1.0`: `ff23cb8`
10. `v1.1.1`: `fbb0d04`
11. `v1.2.0`: `3028f10` -> `67feac5`
12. `v1.3.0`: `f655165` -> `ef1106a`
13. `v1.3.1`: `6979a5f` -> `7c76557`
14. `v1.4.0`: `253b489`
15. `v1.5.0`: unreleased pre-v1.6 stabilization window
16. `v1.6.0`: 2026-02-22 migration batch (data-model governance release)
17. `v1.6.1`: 2026-02-22 UI placeholder + logo patch
18. `v1.6.2`: 2026-02-22 MCC universal overlay injection
19. `v1.6.3`: 2026-02-22 plan-cover + typography consistency patch
