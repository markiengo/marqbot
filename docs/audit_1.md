# Audit 1 (In-Progress, No Test Execution)

## Findings

- `S1` | `backend/server.py:1252`, `backend/server.py:1204`, `backend/server.py:641` | Legacy V2 single-track requests can be scoped to the track only (major requirements dropped). | In `_resolve_program_selection`, V2 single-program mode sets `major_id = default_program_id` (line 1204), but when a non-default `track_id` is passed it calls `_build_single_major_data_v2(data, selected_track_id, None)` (line 1252). `_build_single_major_data_v2` scopes runtime buckets to `program_scope = {major_id} | universal` (line 666), so passing a track ID as `major_id` can exclude the base major buckets. | Use `_build_single_major_data_v2(data, major_id, selected_track_id)` for the legacy single-track branch; add regression test covering `track_id` legacy payload and assert major-core buckets remain present.

- `S1` | `backend/server.py:1235`, `backend/server.py:1236`, `backend/server.py:1204` | Required-major tracks are unconditionally rejected in legacy single-program V2 flow, even when implicit default major could satisfy requirement. | The code computes an implicit `major_id` (line 1204), but if `required_major_id` exists it always returns `PRIMARY_MAJOR_REQUIRED` (lines 1236-1246) without comparing to `major_id`. | Check `required_major_id` against the effective implicit major in this branch before rejecting; add regression test for a required-major track with compatible default major.

- `S2` | `frontend/src/context/AppReducer.ts:142`, `frontend/src/context/AppReducer.ts:159`, `frontend/src/context/AppReducer.ts:122` | Snapshot restore can keep stale recommendations after majors are sanitized. | `selectedMajors` is filtered against valid major IDs (lines 122-126), but `selectionWasSanitized` only checks track count changes (line 142). If majors are dropped but tracks remain same count, `lastRecommendationData` is preserved (line 159), leaving recommendations for a now-changed program selection. | Include major/minor sanitization deltas in `selectionWasSanitized`; add reducer test where invalid majors are removed and ensure `lastRecommendationData` is cleared.

## Open Questions

- Should legacy `track_id` payloads in V2 still be treated as backward-compatible fully-supported inputs, or should clients be required to send `declared_majors` + `track_ids`?
- For required-major tracks in legacy mode, should the server infer compatibility from the default major, or reject all legacy single-track requests by policy?

## Applied Changes

- Added this audit report file only: `docs/audit_1.md`.
- No code patches applied.

## Validation

- No tests executed in this pass (per request: "don't run yet").

## Residual Risks

- Because tests were intentionally not run, there may be additional runtime regressions not covered by static audit.
- Frontend UI and backend compatibility paths both changed heavily; integration behavior between snapshot restore and API payload shape remains high risk until exercised end-to-end.
