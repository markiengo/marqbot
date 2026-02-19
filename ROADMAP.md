# MarqBot Platform Roadmap and Planning Rationale

## 1) What You Are Planning and Why

You are planning to transform MarqBot from a single-track Finance prototype into a data-driven degree-planning platform.

Today, the system works for one primary track and relies on some assumptions that do not scale cleanly:
- fixed track context in runtime logic,
- hardcoded bucket identifiers in recommendation paths,
- legacy workbook columns that are no longer part of the desired canonical schema.

The target outcome is:
1. Add more courses without schema churn.
2. Add more buckets without code rewrites.
3. Add more majors/tracks primarily by workbook data entry.
4. Keep deterministic eligibility trustworthy while product scope expands.

This roadmap is intentionally sequenced so architecture risk is paid down before UX expansion.

## 2) Planning Decisions and Why These Decisions Were Chosen

### Decision A: Reliability First
Chosen because a planning assistant loses trust fast if it recommends invalid courses. Correctness and contract stability are more valuable than fast feature breadth.

Implication:
- deterministic checks stay authoritative,
- formalized error/warning contracts are treated as API commitments,
- migrations must be reversible and preflighted.

### Decision B: Track Is Request-Scoped, Not Global
Chosen because real students have different majors/tracks. Server-global track state cannot represent concurrent users with different track contexts.

Implication:
- `track_id` must be passed per request,
- runtime filtering in allocator/eligibility/recommender must use request context,
- workbook `active` means published availability, not server default behavior.

### Decision C: Role-Driven Bucket Behavior
Chosen because hardcoded bucket IDs (for example `CORE`, `FIN_CHOOSE_2`) prevent reuse across tracks.

Implication:
- bucket semantics are expressed in data (`role` column),
- recommendation logic resolves bucket IDs by role,
- new tracks can reuse logic by assigning roles in workbook data.

### Decision D: Inactive Tracks Are Allowed With Warning
Chosen to support staging/testing before public publication.

Implication:
- inactive tracks are not blocked if explicitly requested,
- API returns a non-blocking `track_warning` field,
- unknown tracks still hard-fail with `UNKNOWN_TRACK`.

### Decision E: Multi-Track Counting Should Feel Positive
Chosen because when one course satisfies multiple requirements, that is user value.

Implication:
- future Phase 5 UI should show positive credit indicators,
- warnings are for blocked counting cases, not successful overlap.

### Decision F: Phase 5 Is Gated on Data Readiness
Chosen because multi-track UX without validated multi-track data introduces noise and rework.

Implication:
- Phase 5 starts after Phase 4 data onboarding is complete,
- product sequencing is architecture and data first, UX merge second.

## 3) Current State Baseline

### Phase 1 Completed
- Schema normalization direction established (normalized map preferred over wide columns).
- Boolean coercion made robust for Excel variants.
- Double-count gating moved to bucket policy (`allow_double_count`) rather than row-level map flags.

### Hotfix Completed (pending commit)
- Reject contradictory input where completed courses require prereqs still in-progress.
- Expand completed set via transitive required prereqs to avoid redundant prerequisite recommendations.
- Keep prereq parsing/validation track-agnostic.

### Known Remaining Gaps
- Deprecated workbook columns still exist and can cause confusion during manual editing.
- Runtime still contains track and bucket assumptions that block multi-track evolution.
- API does not yet expose full track-aware contracts.

## 4) Target Architecture (North Star)

### Core Principle
Configuration belongs in workbook data; algorithmic behavior belongs in reusable backend modules.

### Data Layers
1. `courses`: canonical course metadata and prereq fields.
2. `buckets`: requirement container definitions plus role metadata.
3. `course_bucket` mapping: normalized many-to-many course-to-bucket relationships.
4. `tracks`: published/active status and track identity catalog.

### Runtime Layers
1. Loader normalizes workbook schema variants and returns typed frames.
2. Allocator computes requirement progress under a given track context.
3. Eligibility filters candidate courses deterministically.
4. Recommender ranks and formats semester output.
5. API orchestrates request validation and response contracts.

### Scale Property You Want
After Phase 3, adding a new track should be mostly:
- `tracks` row,
- `buckets` rows with role assignments,
- `course_bucket` mappings,
- publish gate checks,
without touching core backend logic.

## 5) Phase-by-Phase Plan

---

## Phase 1 (Completed): Schema Normalization and Boolean Fixes

### Goal
Remove immediate schema and parsing brittleness to stabilize deterministic behavior.

### What Was Changed
1. Prefer normalized mapping sheets over wide bucket columns.
2. Normalize bool-like workbook values to deterministic booleans.
3. Use bucket-level policy to govern double-counting.

### Why It Matters
- removes accidental behavior differences caused by workbook formatting,
- reduces transformation complexity,
- sets groundwork for multi-track map semantics.

### Done Criteria (already satisfied)
1. Loader chooses canonical map sheet when present.
2. Boolean coercion handles common Excel representations.
3. Double-count behavior is consistent with bucket policy.

---

## Hotfix (Completed): Input Consistency and Implied Completion

### Goal
Prevent logically invalid student states and avoid recommending prerequisites already implied complete.

### What Was Changed
1. Added contradiction detection for completed-vs-in-progress prereq chains.
2. Added transitive completion expansion for required prereqs.

### Why It Matters
- prevents contradictory plans from entering ranking flow,
- improves recommendation credibility,
- keeps deterministic logic coherent.

### Freeze Rule Going Forward
These remain track-agnostic and should not be changed in Phase 3:
1. `backend/validators.py`
2. `backend/prereq_parser.py`
3. Prereq semantics in eligibility checks

---

## Phase 2: Workbook Cleanup (`migrate_schema.py --clean`)

### Goal
Safely remove deprecated `bucket1..bucket4` columns once canonical mapping is verified healthy.

### Scope
In scope:
1. `scripts/migrate_schema.py`
2. `tests/test_schema_migration.py`

Out of scope:
1. Any backend runtime allocation/eligibility/recommender behavior changes.

### Why This Phase Exists
Even if backend fallback remains as safety net, keeping deprecated columns in live workbook editing paths invites drift and operator confusion. This phase removes dead weight safely and reversibly.

### CLI Contract
- Existing flags stay: `--path`, `--dry-run`
- New flag: `--clean`

Command behavior:
1. Default (no `--clean`): existing migration behavior unchanged.
2. `--clean`: perform cleanup flow (preflight -> backup -> remove cols -> save).
3. `--clean --dry-run`: preflight + report only, no writes.

### Required Safety Helpers
1. `preflight_clean(wb) -> None`
- Fail if `course_bucket` sheet missing.
- Fail if `course_bucket` has headers only.
- Fail if `courses` sheet missing.

2. `find_deprecated_bucket_cols(courses_ws) -> list[int]`
- Return present **1-based openpyxl column indexes** (not 0-based) among `bucket1..bucket4`.
- Return empty list when none are present.
- `remove_columns` depends on these being 1-based — keep consistent.

3. `backup_workbook(path: str) -> str`
- Copy workbook to `<path>.bak` before destructive change (use `shutil.copy2`).
- Overwrite existing backup.
- Abort on failure with `[ERROR]` + non-zero exit.

4. `remove_columns(courses_ws, col_indexes: list[int]) -> None`
- Accepts 1-based openpyxl indexes.
- Delete columns right-to-left (sorted descending) to preserve index stability.

### Main Function Rules
1. `main(args=None)` to enable direct test invocation.
2. If `--clean`:
   1. preflight checks,
   2. no-op success if no deprecated columns → print `[INFO] No deprecated columns found. Nothing to remove.` and exit 0,
   3. dry-run exits without writes → print summary of what would be removed,
   4. create backup,
   5. remove deprecated columns,
   6. save workbook,
   7. print `[DONE]` with list of removed columns and backup path.
3. Non-clean code path remains behaviorally unchanged.

### Failure Contract
Cleanup aborts with clear error and non-zero exit when:
1. canonical mapping sheet is unavailable,
2. canonical mapping has no data rows,
3. courses sheet is absent,
4. backup write fails.

### Test Plan
1. `test_clean_aborts_when_course_bucket_missing`
2. `test_clean_aborts_when_course_bucket_empty`
3. `test_clean_creates_backup_before_delete`
4. `test_clean_noop_when_no_bucket_columns`
5. `test_clean_dry_run_no_writes`
6. `test_clean_preserves_nondeprecated_columns_order`

### Known Pre-existing Bug (out of scope but noted)
`write_course_bucket_sheet` line 121 in `scripts/migrate_schema.py`:
```python
# BUG: max_row returns int — len() on int raises TypeError
print(f"[INFO] Replacing existing 'course_bucket' sheet ({len(wb['course_bucket'].max_row - 1)} existing rows).")
# Fix when touching this function: remove the len() wrapper → use (wb['course_bucket'].max_row - 1) directly
```
This is only triggered if `course_bucket` already exists and the non-`--clean` migration re-runs. Fix it when Phase 2 is being implemented since we're already in that file.

### Phase 2 Exit Criteria
1. Deprecated columns removed only with explicit `--clean`.
2. Operation is reversible via `.bak`.
3. No mutation occurs when preflight fails.
4. All migration tests pass.
5. Pre-existing `len(max_row)` bug fixed in `write_course_bucket_sheet`.

---

## Phase 3: Track-Aware Backend Architecture

### Goal
Replace hardcoded single-track behavior with request-scoped track routing and role-driven bucket logic.

### Why This Is the Main Scaling Phase
Without this phase, every new track still requires code edits in allocator/recommender paths. With this phase, track differentiation becomes primarily data and request context.

### Phase 3.1: Add `role` Column in Buckets Data

Data change:
- Add `role` in `buckets` sheet.

Meaning:
- `role = core`: bucket used for prereq-priority blocker context.
- `role = elective`: bucket(s) used for blocking-warning elective pool.

Publish policy (strict):
1. exactly one `core` bucket per track,
2. at least one `elective` bucket per track.

Why strict policy:
- removes ambiguous runtime behavior,
- makes track onboarding deterministic,
- keeps QA expectations clear.

### Phase 3.2: Thread `track_id` Through Runtime

Backend contracts:
1. `backend/requirements.py`
- define `DEFAULT_TRACK_ID = "FIN_MAJOR"` for compatibility fallback.

2. `backend/data_loader.py`
- include `tracks_df` in loaded payload,
- normalize `program_id` to `track_id` if needed,
- no server-global active-track resolution for request routing.

3. `backend/allocator.py`
- `allocate_courses(..., track_id=DEFAULT_TRACK_ID)`

4. `backend/eligibility.py`
- `get_course_eligible_buckets(..., track_id=DEFAULT_TRACK_ID)`
- `get_eligible_courses(..., track_id=DEFAULT_TRACK_ID)`
- keep prereq semantics unchanged.

5. `backend/semester_recommender.py`
- `run_recommendation_semester(..., track_id=DEFAULT_TRACK_ID)`

6. `backend/server.py`
- accept optional `track_id` in `/recommend`,
- default to `FIN_MAJOR` for backward compatibility,
- validate against `tracks_df`,
- return warning for inactive track,
- return error for unknown track,
- pass `track_id` downstream.

### Phase 3.3: Replace Hardcoded Bucket IDs with Role Lookup

Required helpers (place in `backend/requirements.py` — already the shared-config module, imported by all callers):
1. `_get_bucket_by_role(buckets_df, track_id, role) -> str | None`
2. `_get_buckets_by_role(buckets_df, track_id, role) -> list[str]`

Runtime fallback behavior:
1. missing `core` role:
- log `[WARN]`, disable core-priority boost, continue.
2. missing `elective` role:
- log `[WARN]`, skip blocking-warning elective logic, continue.

Why graceful fallback is chosen:
- maintains request reliability under imperfect staging data,
- limits blast radius of metadata omissions,
- preserves deterministic output shape.

### Phase 3.4: Contract and Regression Tests

Update tests:
1. `tests/test_allocator.py`: explicit `track_id` path coverage.
2. `tests/test_eligibility.py`: explicit `track_id` path coverage.
3. `tests/test_track_aware.py` (new): multi-track isolation behavior in same workbook.
4. server tests for:
- `UNKNOWN_TRACK` response shape,
- inactive track warning behavior,
- backward compatibility when `track_id` omitted.

### API Contract (Phase 3 Stable)

Unknown track:
```json
{
  "mode": "error",
  "error": {
    "error_code": "UNKNOWN_TRACK",
    "message": "Track 'XYZ_MAJOR' is not recognized."
  }
}
```

Inactive track warning on successful recommendation response:
```json
{
  "mode": "recommendations",
  "track_warning": "Track 'XYZ_MAJOR' is not yet published (active=0). Results may be incomplete.",
  "semesters": []
}
```

### Phase 3 Exit Criteria
1. No hardcoded single-track runtime assumptions on critical recommendation path.
2. Role-driven bucket behavior replaces hardcoded bucket IDs.
3. Stable `track_id` error/warning contracts implemented and tested.
4. Existing prereq behavior remains unchanged.

---

## Phase 4: Data Expansion Only (No Core Code Rewrite)

### Goal
Add additional majors/tracks through workbook data, not code changes.

### Required Onboarding Workflow Per Track
1. Add track row in `tracks` with `active=0`.
2. Add bucket rows for the track with valid role assignments.
3. Add normalized mapping rows in `course_bucket`.
4. Run validator checks.
5. Run `/recommend` smoke test with explicit `track_id`.
6. Set `active=1` only after validation and smoke test pass.

### Publish Gate (Locked)
A track cannot be published unless:
1. role policy passes (1 core, at least 1 elective),
2. map references only existing courses and buckets,
3. recommendation smoke test succeeds.

### Why This Gate Exists
It shifts failure detection from runtime user requests to pre-publish QA, protecting reliability while enabling faster onboarding cadence.

### Phase 4 Exit Criteria
1. At least one non-Finance track can be onboarded without backend code edits.
2. Publish gate process is documented and repeatable.

---

## Phase 5: Multi-Track User Declaration and UX

### Start Condition
Do not begin implementation until Phase 4 data for additional tracks/minors is ready.

### Goal
Allow users to declare multiple tracks and receive merged progress/recommendations with transparent conflict handling.

### API Evolution
1. Add `declared_tracks: string[]` to `/recommend`.
2. Preserve backward compatibility:
- if `declared_tracks` absent, use single `track_id` flow.

### Cross-Track Counting Rule (Locked)
A course may count across tracks only when all involved buckets allow counting (`allow_double_count=True`).
If any involved bucket disallows it, allocate once based on priority winner logic.

Why this rule:
- reuses current allocator policy model,
- avoids introducing separate cross-track exception semantics,
- keeps mental model consistent for QA and users.

### UX Policy (Locked)
1. Positive badge when a course counts for multiple tracks (example: "Counts for 2 tracks").
2. Warning only when cross-track counting is blocked.
3. Recommendation cards remain concise with expandable detail.
4. Emphasize clear "why not eligible" explanations in detail views.

### MVP Scope Recommendation
Start with max 2 declared tracks in first release to constrain combinatorial complexity and stabilize contracts before wider expansion.

### Phase 5 Exit Criteria
1. Users can declare multiple tracks and get merged deterministic recommendations.
2. Allocation explanations are transparent for both granted and blocked multi-track credit.
3. UI communicates positive overlap clearly.

## 6) Public API and Contract Stability Matrix

### Error Codes (stable set)
1. `INVALID_INPUT`
2. `INCONSISTENT_INPUT`
3. `UNKNOWN_TRACK`
4. `SERVER_ERROR`

### Warning Fields
1. `track_warning` (Phase 3+)
2. future course-level allocation notes for multi-track conflicts (Phase 5)

### Compatibility Promises
1. Existing clients remain functional without sending `track_id`.
2. `track_id` becomes optional Phase 3 field.
3. `declared_tracks` is additive in Phase 5 and does not break legacy callers.

## 7) Data Governance and Validation Requirements

### Required Checks Before Activating a Track
1. Exactly one core role bucket.
2. At least one elective role bucket.
3. No orphan `bucket_id` values in map.
4. No orphan `course_code` values in map.
5. Non-empty mapping rows for that track.

### Operational Logging Requirements
1. Log map source on load.
2. Log track validation failures with actionable details.
3. Log role lookup warnings when feature fallback is activated.

## 8) Testing Strategy Across Phases

### Unit Tests
1. schema migration safety helpers and cleanup behavior,
2. allocator track filtering,
3. eligibility track filtering without prereq semantic changes,
4. role lookup fallback behavior.

### Integration/API Tests
1. `/recommend` unknown track error contract,
2. `/recommend` inactive track warning contract,
3. backward compatibility when `track_id` absent,
4. multi-track declaration behavior in Phase 5.

### Regression Focus
1. deterministic prereq behavior must remain unchanged,
2. no regressions in existing Finance single-track workflows,
3. stable response shapes for frontend parsing.

## 9) Risks and Mitigations

### Risk: Data entry errors in workbook for new tracks
Mitigation:
- strict validation gate,
- role policy checks,
- smoke tests before activation.

### Risk: Silent feature degradation from missing role metadata
Mitigation:
- warning logs,
- publish gate catches role-policy issues before production publication.

### Risk: Contract drift during expansion
Mitigation:
- explicit response shape tests,
- centralized error-code policy,
- phase-specific acceptance criteria.

### Risk: Scope creep in Phase 5
Mitigation:
- gate Phase 5 on Phase 4 readiness,
- start with 2-track MVP,
- preserve deterministic core before adding broader combinatorics.

## 10) Implementation Order

1. Phase 2
- implement `--clean` cleanup with preflight + backup + tests,
- commit cleanup tooling.

2. Phase 3
- add role data model,
- thread `track_id` across runtime,
- replace hardcoded bucket IDs with role lookup,
- add contract tests and validation tooling,
- commit architecture shift.

3. Phase 4
- onboard additional tracks through workbook data workflow,
- validate and smoke-test,
- publish by setting `active=1`.

4. Phase 5
- add declared multi-track API and merged UX,
- apply cross-track counting rules,
- ship with positive overlap messaging and transparent conflict reasons.

## 11) Definition of Done by Phase

### Phase 2 DoD
1. Cleanup command is safe, reversible, and tested.
2. Deprecated columns removed only with explicit `--clean`.

### Phase 3 DoD
1. Track context is per request.
2. Role-driven logic replaces hardcoded bucket IDs.
3. API contracts for unknown/inactive tracks are stable and tested.

### Phase 4 DoD
1. New track can be published via data only.
2. Validation and smoke process is mandatory and repeatable.

### Phase 5 DoD
1. Multi-track declaration supported in product flow.
2. Cross-track allocation policy enforced and explainable.
3. UX clearly communicates why courses are eligible/ineligible and where overlap credit is gained.

## 12) Deferred Items (Intentional)

1. Advisor export format and integration.
2. Unlimited declared-track support in first multi-track release.
3. Any changes to prereq parsing semantics.

These are deferred to avoid destabilizing the reliability-first delivery path.
