# PROJECT_HISTORY.md - MarqBot Product and Engineering Evolution

## 0) Scope
This is the canonical history for MarqBot development, consolidating:
- `prd.md`
- `ROADMAP.md`
- `ROADMAP_V2.md`
- `ROADMAP_V3.md`
- `UI_redesign.md`
- `DESIGN_NOTES.md`

It preserves stage-by-stage product and technical decisions while removing duplicates and contradictions.

## 1) Product North Star
Build a student-first degree planning assistant that is:
- deterministic (no opaque recommendation behavior)
- explainable (users see why recommendations are shown)
- data-driven (new programs added by data entry, not custom code)
- safe to evolve (validation gates and stable API contracts)

## 2) Phase 0 - Initial Planner Baseline
Goal:
- Deliver a usable course recommendation and eligibility planner for finance.

Key decisions:
- Deterministic backend logic over probabilistic generation.
- Rule-based prerequisites and term offering checks.
- Bucket-based requirement progress.

Implemented outcomes:
- `/recommend` for term planning and progress.
- `/courses` and `/programs` catalog endpoints.
- Prereq parsing and eligibility filtering.

Trade-offs and lessons:
- Fast initial delivery, but structure was not yet ready for broad multi-program scaling.

## 3) Phase 1 - Reliability and Schema Normalization
Goal:
- Stabilize core logic and reduce ambiguous data behavior.

Key decisions:
- Normalize boolean and workbook parsing behavior.
- Strengthen regression coverage before expansion.

Implemented outcomes:
- Loader normalization hardening.
- Broader backend test coverage.

Trade-offs and lessons:
- More upfront data strictness reduced silent failures and made later migrations safer.

## 4) Hotfix Wave - Input Consistency and Auto-Assume Logic
Goal:
- Reduce student input burden and prevent invalid recommendations.

Key decisions:
- Auto-assume required prereq chains from higher-level completed courses.
- Extend assumptions to in-progress context and expose assumption notes.
- Keep inference scope constrained to required chains (`single`/`and`), not `or` or concurrent-optional.

Implemented outcomes:
- Completed and in-progress prerequisite expansion.
- Current progress assumption notes surfaced to UI.
- Better recommendation suppression for implicitly satisfied prereqs.

Trade-offs and lessons:
- Explainability is mandatory whenever inference changes visible progress.

## 5) Phase 2 - Workbook Cleanup and Migration Safety
Goal:
- Remove deprecated schema weight and enforce safer data hygiene.

Key decisions:
- Keep migration utilities focused on safe cleanup.
- Require canonical mapping sheets for cleanup preflight.

Implemented outcomes:
- Deprecated course columns cleaned.
- `migrate_schema --clean` with backup-first behavior.

Trade-offs and lessons:
- Strict preflight checks are worth the friction; they prevent destructive edits on partial workbooks.

## 6) Phase 3 - Track-Aware Architecture
Goal:
- Make recommendations and progress track/program aware without fragile hardcoding.

Key decisions:
- Thread selected program/track context through runtime calls.
- Replace hardcoded requirement IDs with metadata-driven lookups.
- Preserve backward-compatible API semantics.

Implemented outcomes:
- Track-aware eligibility, allocation, and recommendations.
- Role-driven bucket behavior.
- Expanded test coverage for context-aware scenarios.

Trade-offs and lessons:
- Context-aware planning required clear contracts between loader, allocator, eligibility, and server layers.

## 7) Phase 4 - Data Expansion and Program Onboarding
Goal:
- Onboard more majors/tracks using data entry patterns and validation gates.

Key decisions:
- Treat data completeness and validator pass as publish gates.
- Keep runtime deterministic while expanding catalog breadth.

Implemented outcomes:
- Expanded programs and course mappings in workbook.
- Validator checks for mapping integrity and policy references.
- Improved program catalog metadata (kind, parent scope, activation).

Trade-offs and lessons:
- Scale depends more on data governance quality than code volume.

## 8) Phase 5 - Multi-Major Planning UX and Context
Goal:
- Support declared major combinations and optional concentration paths.

Key decisions:
- Preserve single-major behavior while adding declared-major planning context.
- Keep selection context explicit in responses.
- Make cross-program progress understandable without hiding allocation rules.

Implemented outcomes:
- Program context surfaced in output.
- Multi-major planning pathways with context-aware display.
- Continued payload compatibility for existing clients.

Trade-offs and lessons:
- Cross-program counting is a product communication challenge as much as a backend one.

## 9) V2 Migration - Normalized Workbook + Policy-Driven Counting
Goal:
- Move to a normalized, strict V2 runtime model and remove legacy fallbacks.

Key decisions:
- Strict V2 sheet model as runtime source of truth.
- Policy-based overlap (double/triple/N-way) with pairwise compatibility checks.
- Remove unused LLM explanation path and external dependency.

Implemented outcomes:
- Loader hard-cut to V2 model.
- N-way allocation governed by pair-policy resolution.
- Legacy pathways retired.
- Test and validator gates green after migration.

Trade-offs and lessons:
- Explicit policy and strict loader contracts reduce hidden behavior drift.

## 10) V3 Governance - Data Hardening and Explainability
Goal:
- Make data authoring safer and policy behavior easier to inspect.

Key decisions:
- Add validator checks for null/invalid requirement definitions and policy integrity.
- Keep policy defaults simple and explicit.
- Improve workbook README authoring guidance.

Implemented outcomes:
- Governance checks for V2 integrity and scope safety.
- Clarified policy semantics and validation coverage.
- Data hygiene pass to reduce editor confusion.

Trade-offs and lessons:
- Governance is an ongoing product feature, not a one-time engineering task.

## 11) UI Redesign Phase - 3-Panel Student Dashboard
Goal:
- Improve hierarchy, readability, and workflow guidance without breaking contracts.

Key decisions:
- Sticky topbar + guided left input + center progress/results + right quick actions.
- Add dedicated `/can-take` endpoint for inline checker.
- Keep legacy `/recommend` can-take behavior for compatibility.
- Brand token refresh to `#003366`.

Implemented outcomes:
- 3-panel responsive desktop/tablet layout.
- Progress ring + KPI summary + persistent warning strips.
- Inline Enter-to-check `Can I Take This?` in right panel.
- Session persistence and keyboard behaviors retained.

Trade-offs and lessons:
- ID preservation was critical; layout changes were safe because selector contracts were preserved.

## 12) Data Model Simplification Pass (Current)
Goal:
- Remove low-value fields and clarify canonical naming.

Key decisions:
- Canonical mapping sheet renamed to `courses_all_buckets`.
- `sub_buckets.credits_required` removed from active workbook model.
- Mapping `constraints` column removed; equivalency expansion now derives directly from `course_equivalencies`.
- Keep legacy sheet alias support in loader for compatibility.

Implemented outcomes:
- Leaner workbook for data entry.
- Fewer ambiguous fields and less duplicated modeling intent.
- Behavior-preserving runtime with passing tests.

Trade-offs and lessons:
- Simplification is safest when paired with compatibility aliasing and regression tests.

## 13) Current Capabilities (Student View)
Students can:
- Select majors and optional track context
- Add completed and in-progress courses
- Get one- or two-semester recommendations
- See projected and current progress
- Check specific course eligibility inline
- Understand assumptions and overlap notes

## 14) Current Capabilities (Engineering View)
- Frontend: vanilla JS modules + structured render helpers
- Backend: Flask + deterministic eligibility/allocation engine
- Data: normalized workbook model + validator gates
- Testing: backend and frontend suites plus track validator
- API: additive evolution, backward-compatible response strategy

## 15) Main Architectural Lessons
1. Deterministic logic plus visible reasoning builds user trust.
2. Data contract clarity is the largest multiplier for scaling programs.
3. Policy-driven overlap handling scales better than per-program special cases.
4. UI hierarchy improvements are most reliable when selector/API contracts remain stable.
5. Continuous governance checks are required for sustainable data-entry-only growth.

## 16) Forward Priorities
1. Continue program onboarding using canonical workbook patterns.
2. Improve overlap transparency and student-facing requirement guidance.
3. Complete remaining UX polish for mobile and multi-major clarity.
4. Maintain strict validation gates before publishing data updates.
