# CHANGELOG

All notable changes to MarqBot are documented here.

Format per release:
- `Changes`: what shipped.
- `Design Decisions`: why those changes were made.

---

## [Unreleased]

### Changes
- Added CI workflow at `.github/workflows/validate.yml` to run workbook validation, backend tests, and frontend tests on push/PR.
- Added `/recommend` debug mode (`debug: true`, optional `debug_limit`) for per-course ranking trace output.
- Added regression profile tests against the live workbook in `tests/backend_tests/test_regression_profiles.py`.
- Updated recommender ranking tie-breaks to re-include unlock power.
- Completed documentation consolidation into `PRD.md` and `CHANGELOG.md`.

### Design Decisions
- Keep recommendation behavior deterministic and traceable before making additional policy-level ranking changes.
- Treat workbook correctness as a release gate, not a manual checklist.
- Add explainability as a first-class operational feature so ranking disputes can be resolved from data and score components.

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
