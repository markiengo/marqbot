# ROADMAP V2: MarqBot Data-Driven Degree Planning Platform

## 1) Purpose of This Document
This document is the canonical roadmap for MarqBot after the V2 migration work. It captures:

1. What has been completed across Phases 1-5 and V2 cleanup/migration.
2. Why specific architecture and product decisions were made.
3. What is currently live for users.
4. What still needs to be executed next.

This version reflects the codebase on `main` after:

1. `033896c` - cleanup (LLM removal + loader fallback cleanup + migration cleanup)
2. `162756d` - V2 dual-read + policy-based N-way allocation + V2 track selection
3. `3259b2d` - strict V2-only loader/runtime (legacy retirement)

---

## 2) Product North Star
MarqBot should scale to new majors/tracks by data entry, not code rewrites.

Product outcome target:

1. Students select major(s) and optional track, enter completed/in-progress courses, and get trustworthy recommendations.
2. Advisors can extend programs by updating workbook data with strong validation gates.
3. Engineering changes become rare and focused on platform features, not curriculum rewiring.

---

## 3) What Was Completed in This Session (End-to-End Context)

### 3.1 Foundation and Reliability Work
1. Prerequisite consistency hotfixes were implemented and stabilized:
   - Contradiction detection for invalid completed vs in-progress states.
   - Transitive prerequisite inference for completed courses.
   - Later expanded to in-progress prerequisite inference with user-facing assumption notes.
2. Validator contract was stabilized before major architecture changes.
3. Deterministic behavior was kept as the source of truth.

Why:
The recommender loses trust immediately if it suggests invalid courses or accepts contradictory student states.

### 3.2 Phase 2 Workbook Cleanup (Completed)
1. Migration tooling for cleanup mode was implemented and tested with preflight + backup behavior.
2. Schema migration tests were expanded and hardened.
3. Known `len(max_row)` migration bug was addressed while touching migration code.

Why:
Destructive workbook edits must be reversible and testable.

### 3.3 Phase 3 Track-Aware Backend (Completed)
1. Track context was made request-scoped.
2. Hardcoded bucket IDs were replaced with metadata-driven role lookups.
3. `/recommend` gained stable track validation contracts (`UNKNOWN_TRACK`, inactive warnings).
4. Added track-aware tests and integration coverage.

Why:
Single-track hardcoding blocked scale and made every new track a code task.

### 3.4 Phase 4 Data Expansion + Validation (Completed)
1. Added/validated non-default track data and validator CLI workflow.
2. `validate_track.py` became the publish gate.
3. End-to-end tests proved new track data can flow through existing runtime.

Why:
Data-entry-only scaling requires a strong data gate, not manual assumptions.

### 3.5 Phase 5 Product UX Expansion (Partially Completed, Core Delivered)
Delivered:

1. Declared majors + optional track selection flow.
2. Improved search UX:
   - course-code-first matching,
   - deterministic ordering by `prereq_level`,
   - keyboard navigation across custom dropdowns.
3. Progress UX:
   - Plan Context panel,
   - Current Degree Progress section,
   - projected semester progress using selected recommendations,
   - assumption notes (completed/in-progress prerequisite inference).
4. Course-code-first display consistency across recommendations and notes.

Why:
Students need clear control over planning context and transparent explanation of assumptions.

### 3.6 V2 Cleanup and Migration Program (Completed)

#### Commit 1 (`033896c`) - Dead-weight removal
1. Removed optional OpenAI/LLM path and unused prompt builder.
2. Simplified loader assumptions and migration behavior.
3. Removed stale docs and temp test artifacts.

#### Commit 2A/2B (`162756d`) - V2 model + policy engine
1. Added V2 workbook model support and runtime slicing by declared major/track.
2. Added policy-driven N-way double-count allocation.
3. Added canonical track selection model and alias compatibility.

#### Commit 2C (`3259b2d`) - strict V2 runtime
1. Enforced V2-only sheet loading.
2. Removed legacy workbook path dependencies and fallback logic.
3. Enforced policy-table-driven overlap decisions.

Why:
Keeping legacy and V2 in parallel indefinitely causes hidden drift and untestable branches.

---

## 4) Current Product State (User Perspective)

### 4.1 What Users Can Do Today
1. Select declared major(s) and optional track.
2. Add completed and in-progress courses with searchable dropdowns.
3. Use keyboard up/down/enter/escape navigation in custom selectors.
4. Request one or two semester recommendations.
5. See:
   - Plan Context,
   - Current Degree Progress,
   - Sequencing heads-up,
   - recommendation cards with course codes and titles,
   - projected degree progress per semester.
6. Use the "Can I take this next semester?" check with selector behavior aligned to course search UX.

### 4.2 Trust/Explanation Features
1. Inference notes explain assumed prerequisite completions.
2. Warnings and manual-review courses are surfaced in recommendation output.
3. Double-counted courses are surfaced in output notes.

### 4.3 Current Published Catalog State
1. Major: `FIN_MAJOR`.
2. Tracks (under Finance): `CB`, `FP`.
3. V2 workbook has canonical track definitions and policy tables.
4. BCC list provided in this session is represented in catalog (no missing codes from the supplied BCC set).

---

## 5) Current Technical Architecture

### 5.1 Canonical Workbook V2 Sheets (Authoritative)
1. `programs`
2. `track_definitions`
3. `buckets`
4. `sub_buckets`
5. `courses`
6. `course_prereqs`
7. `course_offerings`
8. `course_sub_buckets`
9. `course_equivalencies`
10. `double_count_policy`
11. `README`

### 5.2 Runtime Model
1. Loader (`backend/data_loader.py`) requires V2 sheets and derives runtime tables.
2. Runtime buckets are sub-buckets; parent bucket metadata is carried through for policy resolution.
3. Policy engine (`backend/requirements.py`) resolves overlap with strict precedence:
   1. sub_bucket pair rule
   2. parent bucket pair rule
   3. default deny
4. Allocator (`backend/allocator.py`) supports N-way assignment with pairwise policy checks and cap `MAX_BUCKETS_PER_COURSE`.
5. Server (`backend/server.py`) orchestrates:
   - input normalization,
   - validation/inference,
   - declared plan selection,
   - recommendation + progress payload.

### 5.3 API Behavior Highlights
1. `/programs` returns canonical major + track catalog.
2. `/recommend` supports:
   - declared majors,
   - optional track,
   - compatibility aliases for legacy track IDs (`*_CONC`, `*_TRACK` to canonical IDs).
3. Response includes:
   - semester recommendations,
   - `current_progress`,
   - `projected_progress` / `projected_timeline`,
   - `current_assumption_notes`,
   - warnings and allocation notes.

---

## 6) Key Design Decisions and Rationale

### Decision A: Keep `program_id` as canonical scope key
Why:
It keeps major-level ownership stable while tracks remain optional overlays.

### Decision B: Use `track_definitions` as explicit source of track truth
Why:
Track labels/publish state should not be inferred from bucket rows.

### Decision C: Default overlap policy is deny
Why:
Safe by default, then explicit allow rows where curriculum intends overlap.

### Decision D: N-way overlap support is pair-policy based
Why:
It scales to triple and higher overlap without introducing hardcoded max pair templates. A course can count toward many sub-buckets only if every pair is allowed.

### Decision E: Keep deterministic engine and remove LLM dependency
Why:
Core recommendation path must remain auditable, testable, and offline-safe.

### Decision F: Show assumptions directly to users
Why:
Inference improves recommendation quality but must remain transparent.

---

## 7) Migration Status Matrix

### Completed
1. Strict V2 loader in place (legacy sheet fallback removed).
2. Policy-based double counting in place.
3. N-way allocation in place.
4. Track catalog and selection model in place.
5. Frontend test suite and backend test suite reorganized and passing.

### Partially Completed / Intentional Transitional Items
1. `courses` sheet still contains some legacy reference columns (`bucket1..bucket4`, legacy prereq/offering mirrors) that runtime no longer depends on.
2. Legacy track aliases are still accepted at API input for client compatibility.

Why these remain:
To preserve data-entry flexibility and avoid breaking older client payloads while transition stabilizes.

---

## 8) Quality Gates (Current)

Current validation/test status on `main`:

1. Backend tests: `230 passed`.
2. Frontend tests: `40 passed`.
3. Track validator: strict V2 load + pass on `FIN_MAJOR` with expected informational warnings.

Release gate (must pass before any roadmap milestone marked done):

1. `python -m pytest -q`
2. `cmd /c npm test --silent`
3. `python scripts/validate_track.py --all`

---

## 9) Remaining Risks and Clarifications

### 9.1 Curriculum Modeling Risk
If bucket/sub-bucket counts are not finalized (especially BCC subdivisions), allocator output can be logically correct but curriculum-inaccurate.

Mitigation:
Lock bucket counts and mappings through a data governance checklist before publishing changes.

### 9.2 Overlap Explainability Risk
N-way counting is powerful but can confuse students if not explained in UI.

Mitigation:
Add explicit per-bucket overlap notes in progress cards for assumptions and double-count reasoning.

### 9.3 Residual Data Hygiene
Legacy reference columns in `courses` can still confuse human editors.

Mitigation:
Perform a final workbook hygiene pass once all authoring tools/processes are confirmed stable.

---

## 10) Roadmap V2 Next Milestones

## Milestone V2.1 - Data Governance Hardening
Goal:
Finalize curriculum-authoring rules so data updates are safe and repeatable.

Scope:
1. Lock final BCC counts and mapping conventions by sub-bucket.
2. Document canonical authoring rules in workbook `README`.
3. Add validator checks for required count consistency and orphan policy nodes.

Done when:
1. Validator blocks malformed sub-bucket/count/policy states.
2. Curriculum owner can onboard a change with no backend edits.

## Milestone V2.2 - Phase 5 Completion (Product)
Goal:
Complete multi-major + optional-track planning UX polish.

Scope:
1. Improve overlap explanations where one course satisfies multiple requirement units.
2. Clarify progress summaries when assumptions and double counts are involved.
3. Keep course-code-first consistency across all user-facing text.

Done when:
1. Users can explain "why this course was recommended" and "where it counts" without developer interpretation.

## Milestone V2.3 - Operations and Scale
Goal:
Make ongoing updates low-risk as program catalog grows.

Scope:
1. Add CI command bundle for validator + backend + frontend tests.
2. Add data-change checklist for workbook PRs.
3. Add smoke tests for new major/track onboarding.

Done when:
1. New major/track rollout is checklist-driven and repeatable.

---

## 11) Operational Playbook (Current)

### Add or Update a Track
1. Update `track_definitions`.
2. Add/update conditional parent bucket(s) in `buckets` with `track_required`.
3. Add/update sub-buckets in `sub_buckets`.
4. Map courses in `course_sub_buckets`.
5. Add/adjust overlap rules in `double_count_policy`.
6. Run validator/tests.
7. Publish by setting `active=1` where required.

### Add or Update Course Data
1. Add/update course identity in `courses`.
2. Add/update prereqs in `course_prereqs`.
3. Add/update offerings in `course_offerings`.
4. Add/update equivalencies in `course_equivalencies` when needed.
5. Re-run validator/tests.

---

## 12) Summary
MarqBot has moved from prototype-style hardcoded planning to a V2 data-first architecture with:

1. strict V2 workbook loading,
2. policy-driven N-way allocation,
3. request-scoped major/track selection,
4. transparent progress + inference explanations,
5. stable automated validation and test coverage.

The next focus is not architecture rescue. It is curriculum governance, explainability polish, and repeatable scale operations.
