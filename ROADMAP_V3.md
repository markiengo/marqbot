# ROADMAP_V3.md — MarqBot Student-First Data Governance and Clarity

## 1) Goal
MarqBot should scale by **data entry, not code rewrites**, while staying clear for students choosing what to take next.

This roadmap finalizes:
- V2 runtime hard-cut (already done),
- governance guardrails for curriculum edits,
- clearer recommendation behavior for real student decisions,
- track/major structure that remains flexible as programs grow.

## 2) Current State (Baseline)
- Backend tests passing (`249`).
- Frontend tests passing (`40`).
- Track validator passing.
- V2 workbook present and runtime is using V2 structures.
- Double-count cap has been removed; overlap is now governed by pairwise policy logic only.
- Working tree includes active V3 updates (document and validator/governance changes).

## 3) Locked Product Decisions
- Primary UX priority: **next classes clarity**.
- Difficulty weighting: **not used**.
- Ranking preference: **prerequisite unlock value first**.
- Input quality: **warn and continue** (don’t hard-block common student mistakes unless contradictory).
- Assumptions visibility: **always show assumptions**.
- Progress bars: keep current semantics:
  - green = completed,
  - yellow = assumed from in-progress.
- Double-counting: show explicit per-course transparency note.
- Persona priority: students first.
- Release gate strictness: tests + validator + manual smoke.
- Multi-major support target: up to 2 majors.
- Credit fulfillment remains config-driven (no hidden heuristics).

## 4) Locked Data Decisions (Excel)
- BCC is split into 4 sub-buckets:
  - `BCC_REQUIRED`
  - `BCC_ETHICS`
  - `BCC_ENHANCE`
  - `BCC_ANALYTICS`
- `BCC_REQUIRED.courses_required = 18` (current workbook truth).
- LEAD courses remain included in BCC foundation.
- `FIN_UPPER_1` and `FIN_UPPER_2` remain separate sibling sub-buckets.
- Same-family sibling sub-buckets do **not** double-count unless explicitly allowed.
- `FIN_REQ <-> track buckets` overlap is allowed by policy (as configured).
- OR options are modeled with equivalency groups.
- 5000-level alternatives remain (program-scoped where needed).
- Program-scoped equivalencies are used for:
  - `INSY 3001` vs `ACCO 4050`
  - `ACCO 4060` vs `ACCO 5060`
- Restriction language (major-only, consent, standing, etc.) stays in warnings via `prereq_soft`.
- Offering confidence behavior:
  - low/unknown = soft demote first,
  - still recommendable with visible warning if selected.

## 5) Canonical V3 Workbook Contract
Keep model intuitive and normalized:
- `programs` (majors/tracks with canonical IDs)
- `buckets` (parent requirement families)
- `sub_buckets` (allocatable requirement units)
- `course_sub_buckets` (course-to-sub-bucket mapping)
- `courses` (catalog identity only)
- `course_prereqs` (hard/soft/concurrent/min standing)
- `course_offerings` (term history + confidence)
- `course_equivalencies` (global or program-scoped)
- `double_count_policy` (explicit allow/deny resolution)
- `README` (authoring rules and examples)

Design principle: runtime reads a small stable contract; curriculum changes happen in data rows.

Current hierarchy in workbook:
1. `programs`: majors and tracks (`kind=major|track`, tracks use `parent_major_id`).
2. `buckets`: parent requirement families (`track_required` controls conditional families).
3. `sub_buckets`: allocatable requirement units under each bucket.
4. `course_sub_buckets`: course-to-sub-bucket mapping.
5. `double_count_policy`: sparse overrides only; defaults apply when rows are absent.

## 6) V3.1 — Data Governance Hardening
### 6.1 Validator upgrades (`scripts/validate_track.py`)
Add/strengthen checks:
1. `courses_required` satisfiable per sub-bucket:
   - warn if required > mapped available courses.
2. No null requirement definition for active sub-buckets:
   - error when both `courses_required` and `credits_required` are null.
3. Double-count policy node integrity:
   - error if referenced node/type does not exist.
4. Duplicate canonical policy pairs:
   - warn if duplicate rows exist after canonical normalization.
5. Program-scoped equivalency integrity:
   - error on broken scope references.

### 6.2 Workbook README hardening
Document in workbook `README`:
- PK/FK-like expectations,
- required columns by sheet,
- policy precedence examples,
- how to add a course,
- how to add a track,
- validator commands and expected pass criteria.

### 6.3 Hygiene sweep
- Remove any remaining deprecated/inert authoring columns if still present.
- Keep backups for every structural edit.
- Re-run validator + tests after each migration step.

### 6.4 Double-Count Policy Explainability (`--policy-matrix`)
Why this is needed:
- `double_count_policy` can be empty by design.
- Effective behavior still exists through hierarchy defaults:
  - same parent bucket -> `DENY`
  - different parent buckets -> `ALLOW`

What this does (exactly):
- It is an **explainability/audit view** of current runtime policy resolution.
- It does **not** change allocation behavior.
- It shows the effective allow/deny result for each sub-bucket pair and where that decision came from.

Counting behavior clarified:
- Double-count is allowed when that pair resolves to `ALLOW`.
- Triple-count (or higher) happens only when **all pairwise combinations** among assigned buckets resolve to `ALLOW`.
- No global bucket-per-course cap is applied anymore.

Sparse override model:
- Add explicit `allow_double_count = TRUE` only when overriding a default deny.
- Add explicit `allow_double_count = FALSE` only when overriding a default allow.

Policy precedence:
1. explicit `sub_bucket <-> sub_bucket` row
2. explicit `bucket <-> bucket` row
3. hierarchy default (same parent deny, different parent allow)

Implementation:
- Add `--policy-matrix` to `scripts/validate_track.py`.
- Keep normal validation output unchanged; matrix output is additive.
- Print effective decision table per sub-bucket pair with:
  - `sub_bucket_a`
  - `sub_bucket_b`
  - `decision` (`ALLOW` / `DENY`)
  - `source` (`explicit sub_bucket`, `explicit bucket`, `hierarchy same-parent`, `hierarchy different-parent`)
- Reuse resolver logic from `backend/requirements.py` to avoid drift:
  - `_build_policy_lookup()`
  - `_policy_pair_allowed()`
  - `_canon_node_pair()`

Verification:
1. `python scripts/validate_track.py --track FIN_MAJOR --policy-matrix`
2. `python scripts/validate_track.py --all --policy-matrix`
3. Add one override row in `double_count_policy`, rerun, confirm source changes from hierarchy to explicit.
4. `python -m pytest tests/backend_tests -q`

Action plan (specific):
1. Implement CLI flag plumbing in `scripts/validate_track.py`:
   - Add `--policy-matrix` argument.
   - Keep existing validation behavior unchanged.
2. Implement matrix printer in `scripts/validate_track.py`:
   - Resolve requested program scope.
   - Enumerate all `sub_bucket` pairs in deterministic order.
   - For each pair, print decision and source.
3. Reuse policy resolver helpers from `backend/requirements.py`:
   - No duplicate logic path is allowed.
4. Add tests in `tests/backend_tests/test_validate_track.py`:
   - matrix prints expected pair count,
   - source switches from hierarchy to explicit when override row is added.
5. Exit criteria:
   - `--policy-matrix` output is stable and human-readable,
   - backend tests pass,
   - validator pass unchanged for existing tracks.

## 7) V3.2 — Student Clarity Upgrades
### 7.1 Recommendation transparency
- Every recommendation shows:
  - why now,
  - what it unlocks,
  - where it counts,
  - whether it’s warning-demoted or policy-constrained.

### 7.2 Assumption transparency
- Keep `current_assumption_notes` visible under current progress.
- Include concise causal notes, e.g.:
  - “Assumed ACCO 1030 because ACCO 1031 is in progress.”

### 7.3 Double-count clarity
- When overlap is used, add explicit note:
  - which buckets consumed the same course,
  - what still must be taken distinctly.

### 7.4 UI Status (Current vs Needed)
Current status:
- Core program/track selection flow exists and is functional.
- Progress/recommendation rendering exists and is test-covered.
- Assumption/warning surfaces exist but still need consistency polish.

Still required to close V3 UX:
1. Consistent warning semantics and color usage across all recommendation blocks.
2. Consistent course code + title formatting rules across all displays.
3. Explicit overlap explanation line for every double-/triple-counted course card.
4. Keep keyboard navigation parity across all custom searchable selectors.

Action plan (specific):
1. Rendering contract pass (`frontend/modules/rendering.js`):
   - Standardize warning text class and placement.
   - Standardize code-first display format (`CODE — Title`) where required.
   - Inject overlap explanation text from backend payload fields.
2. Input interaction pass (`frontend/modules/multiselect.js`, `frontend/app.js`):
   - Verify arrow-up/down, enter, escape behavior parity for all custom selectors.
3. Styling pass (`frontend/style.css`):
   - Ensure warning emphasis is consistent and scoped to warning text only.
4. Frontend tests (`tests/frontend_tests/rendering.test.js`, `tests/frontend_tests/multiselect.test.js`):
   - Add assertions for warning style hooks, overlap explanation rendering, and keyboard behavior parity.
5. Exit criteria:
   - no UI regression in existing workflows,
   - all frontend tests pass,
   - manual smoke confirms clearer recommendation cards for student use.

## 8) V3.3 — Scale Readiness for New Programs
- Add program by data only:
  1. add program row,
  2. add buckets/sub-buckets,
  3. map courses,
  4. define overlap policy,
  5. run validator,
  6. activate.
- No backend logic forks per major/track.
- No hardcoded bucket IDs in runtime code.

### 8.1 Data Ingestion Readiness (Answer)
Current answer: **mostly yes** for data-entry-only onboarding.

What already works:
- New major/track structures can be ingested through `programs` + `buckets` + `sub_buckets`.
- Requirement fulfillment is driven by `course_sub_buckets` mappings.
- Overlap behavior is controlled by sparse `double_count_policy` overrides plus hierarchy defaults.
- Prereqs/offering/equivalencies are independent sheets and loader-normalized.

What must be true before declaring “pure injection complete”:
1. Validator includes all governance checks for required counts, policy node refs, duplicate pairs, and scope integrity.
2. Workbook README and roadmap stay aligned with actual runtime contract.
3. `--policy-matrix` exists so editors can verify effective overlap policy without reading code.
4. Manual smoke for `/programs` and `/recommend` is part of each data publish gate.

Action plan (specific):
1. Create a repeatable onboarding checklist in `ROADMAP_V3.md` and workbook `README`:
   - add/update `programs`,
   - add `buckets` + `sub_buckets`,
   - add `course_sub_buckets`,
   - add `course_prereqs` + `course_offerings`,
   - add `course_equivalencies` where needed,
   - add only required override rows in `double_count_policy`.
2. Add publish-gate command bundle:
   - `python scripts/validate_track.py --track <PROGRAM_OR_TRACK>`
   - `python scripts/validate_track.py --track <PROGRAM_OR_TRACK> --policy-matrix`
   - `python -m pytest tests/backend_tests -q`
   - `cmd /c npm test --silent`
3. Add minimum manual QA scenario for each new program:
   - `/programs` shows expected major/track labels and active flags,
   - `/recommend` returns coherent allocations for baseline completed/in-progress inputs.
4. Exit criteria:
   - onboarding requires no backend code change for normal curriculum expansion,
   - validator + tests + manual QA pass before activation.

## 9) API and Compatibility Policy
- Keep payloads additive where possible.
- Keep legacy track aliases accepted at input boundaries during transition windows.
- Return canonical IDs and labels in responses.

## 10) Test Plan (Release Gates)
### Backend
- Validator tests for governance checks.
- Allocator tests for:
  - explicit allow/deny,
  - sibling deny behavior,
  - N-way overlap constraints.
- Track-aware route tests for canonical + alias handling.

### Frontend
- Rendering tests for assumption and warning visibility.
- Interaction tests for selector behavior and keyboard nav.

### System gates (must pass)
1. `python -m pytest -q`
2. `cmd /c npm test --silent`
3. `python scripts/validate_track.py --all`
4. Manual smoke:
   - `/programs` returns expected active options,
   - `/recommend` returns coherent results for baseline student scenarios.

## 11) Execution Order
1. Finish V3.1 policy explainability implementation (`--policy-matrix`) + tests.
2. Align workbook `README` and roadmap wording to runtime contract (single source of truth).
3. Execute V3.2 UI action plan for warning semantics, overlap explanations, and selector parity.
4. Run full publish gate (validator + backend tests + frontend tests + manual smoke).
5. Activate new/updated data entries only after gates pass.

## 12) Risks and Mitigations
- Risk: silent data drift.
  - Mitigation: strict validator + README conventions + release gates.
- Risk: confusing overlap outcomes.
  - Mitigation: explicit per-course overlap notes.
- Risk: overfitting to one major.
  - Mitigation: policy-driven allocation with no hardcoded IDs.

## 13) Definition of Done (V3)
V3 is complete when:
- Validator catches governance-class data mistakes before runtime.
- Workbook is understandable for non-engineer curriculum editors.
- Students can see assumptions and overlap effects clearly.
- Adding a new program/track is data-entry-first and passes gates without backend rewrites.
- Policy decisions are auditable via `validate_track.py --policy-matrix`.




