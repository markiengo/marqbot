# Test Structure

Last updated: 2026-04-17

Commands below assume a VS Code PowerShell terminal opened at the repo root.

## Quick Reference

| What to run | Command | Coverage |
|---|---|---|
| **Standard suite** | `.\.venv\Scripts\python.exe -m pytest tests/backend -q` | Full backend suite under `tests/backend/` |
| **Planner smoke guardrail** | `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -m "not nightly" -q` | Fast planner/regression guardrail |
| **Frontend** | `cd frontend; npm run test` | Active Vitest suites in `frontend/tests/` plus the included legacy suites from `tests/frontend/` |
| **Claude hook smoke** | `node --test .claude/helpers/hook-handler.test.cjs` | Local npm/Claude hook guardrails |

The standard suite runs everything in `tests/backend/` except `nightly`-marked tests (configured in `pytest.ini`).

## When to Run What

| Change type | Run these |
|---|---|
| Narrow backend fix | Closest test file |
| Broad backend change | Focused file + `.\.venv\Scripts\python.exe -m pytest tests/backend -q` |
| Planner / recommendation logic | Focused file + the planner smoke guardrail |
| Frontend helper | Closest test file |
| Frontend broad / pre-push | `cd frontend; npm run test; npm run lint; npm run build` |
| Claude/npm hook logic | `node --test .claude/helpers/hook-handler.test.cjs` |

## Backend Test Files

| File | Tests | What it covers |
|---|---:|---|
| `test_advisor_match.py` | 14 | Nightly-only advisor gold-profile overlap audit |
| `test_allocator.py` | 26 | Allocation routing, min-level, double-count policy |
| `test_data_integrity.py` | 24 | CSV schema, FK integrity, prereq graph sanity |
| `test_dead_end_archetypes.py` | 9 | Synthetic dead-end classifier archetypes |
| `test_dead_end_fast.py` | ~201 total | PR smoke checks plus `@pytest.mark.nightly` catalog dead-end and graduation baselines; every case runs 3x (once per scheduling style: grinder, explorer, mixer) |
| `test_eligibility.py` | 48 | Eligibility filters, restrictions, bridge courses, can-take helpers |
| `test_equivalencies.py` | 36 | Equivalency maps, prereq satisfaction, scoped equivalent dedup, required-bucket remaining collapse, NDC blocking, schema checks |
| `test_feedback_api.py` | 9 | `/api/feedback` contract, JSONL persistence, validation, rate limiting |
| `test_input_validation.py` | 36 | Prereq contradiction detection, inferred prereq expansion |
| `test_normalizer.py` | 20 | Course-code normalization |
| `test_prereq_parser.py` | 33 | Prereq parsing, satisfaction rules, human-readable strings |
| `test_recommend_api_contract.py` | 19 | `/recommend` request/response contract, including edited-semester `selected_courses` reruns |
| `test_recommendation_quality.py` | 37 | Cross-major recommendation invariants, multi-semester quality |
| `test_regression_profiles.py` | 39 | Realistic student-profile regressions |
| `test_schema_migration.py` | 38 | Schema migration, loader compatibility, clean-mode |
| `test_scrape_undergrad_policies.py` | 4 | Bulletin policy scrape parsing and markdown rendering |
| `test_semester_recommender.py` | 49 | Ranking heuristics, major-family ordering, concurrent picks, caps, standing recovery, edit-pool behavior, and scheduling-style ranking/selection archetypes |
| `test_server_can_take.py` | 20 | `/can-take` endpoint contract |
| `test_server_data_reload.py` | 3 | Hot-reload safety |
| `test_server_security.py` | 6 | Health, security headers, rate limiting |
| `test_tier_invariants.py` | 7 | Stable recommendation tier ordering |
| `test_track_aware.py` | 68 | Track allocation, aliases, merged progress |
| `test_unlocks.py` | 9 | Reverse prereq map, blocker warnings |
| `test_validate_prereqs_endpoint.py` | 8 | `/validate-prereqs` endpoint contract |
| `test_validate_track.py` | 45 | Publish-gate validation, V2 governance |
| `test_policy_verification.py` | 17 | COBA_05/06 enforcement, business-elective pool behavior, credit-load warnings, summer cap, semester_warnings field |

Support files (not test files): `conftest.py`, `helpers.py`, `dead_end_utils.py`

### Student Stage Support

`PlanCase` (in `dead_end_utils.py`) and payload builders (`recommend_payload`, `payload_for_major` in `helpers.py`) accept an optional `student_stage` parameter (`"undergrad"`, `"graduate"`, `"doctoral"`, or `None`). When `None` (the default), the stage hard gate is skipped and all course levels are eligible. All existing tests omit this field to preserve backward-compatible behavior. Dedicated student-stage filtering tests live in `test_eligibility.py`, `test_recommend_api_contract.py`, and `test_server_can_take.py`.

### Scheduling Style (Archetype) Support

`PlanCase` accepts an optional `scheduling_style` parameter (`"grinder"`, `"explorer"`, `"mixer"`, or `None`). Styles use a two-layer mechanism: tier remapping (sort-key influence) plus slot reservations (enforced during selection). Configuration lives in `backend/scheduling_styles.py` as `StyleConfig` dataclasses with `min_discovery_slots`, `min_core_slots`, `interleave`, `tier_map`, `relax_bcc_band`, and `strict_band_progression` fields.

- `"grinder"` (default): No reservations. Gateway BCC work stays protected, declared-program work stays ahead of flexible MCC/discovery cleanup, and within declared major work `required` buckets stay ahead of `choose_n` and `credits_pool` buckets.
- `"explorer"`: Reserves 2 discovery slots per semester. Demotes BCC from band 1 to 2 when the student has ≥ 4 semesters of runway.
- `"mixer"`: Reserves 1 discovery + 2 core slots and interleaves picks.

**How archetypes integrate into the test suite:**

- `test_dead_end_fast.py`: Every baseline case (single-major, single-track, curated combos, graduation-by-8) is expanded 3x via `_expand_with_scheduling_styles()`. Each `PlanCase` variant gets a `scheduling_style` field and a label suffix `::style=grinder|explorer|mixer`. This triples the cases (~67 base x 3 = ~201 total).
- `test_semester_recommender.py`: dedicated unit tests verify grinder=default, grinder pushes MCC cleanup behind declared-program work, major-family ordering (`required -> choose_n -> credits_pool`) across styles, non-major guard behavior, explorer reserves discovery slots, explorer can promote discovery over major work, mixer guarantees core+discovery mix, invalid styles fall back to grinder, and all styles respect max_recs.
- `simulate_terms()` in `dead_end_utils.py` passes `scheduling_style` to `run_recommendation_semester()`, so every simulation runs with the correct archetype.

The key safety property: all 3 scheduling styles must still graduate a fresh student within 8 semesters.

## Frontend Test Files

| File | Tests | Default run | What it covers |
|---|---:|---|---|
| `aboutContent.test.ts` | 2 | Yes | About-page content constants |
| `appReducer.test.ts` | 7 | Yes | Bootstrap errors, snapshot restore, stage inference, track sanitization |
| `canTake.test.ts` | 3 | Yes | Can-take query matching |
| `coursesStep.dom.test.ts` | 1 | No | Prereq inconsistency warnings (DOM) |
| `feedback.test.ts` | 2 | Yes | Feedback payload building and message validation |
| `multiSelect.dom.test.ts` | 2 | No | Picker filtering, keyboard (DOM) |
| `onboardingPage.dom.test.ts` | 3 | No | Onboarding flow, route launch (DOM) |
| `quips.test.ts` | 17 | Yes | Progress and semester quips |
| `rendering.test.ts` | 10 | Yes | Progress grouping, credit metrics |
| `savedPlanPresentation.test.ts` | 3 | Yes | Saved-plan display strings |
| `savedPlans.test.ts` | 2 | Yes | Plan persistence and overwrite semantics |
| `studentStage.test.ts` | 3 | Yes | Stage inference, explicit vs inferred, history conflict flags |
| `utils.test.ts` | 9 | Yes | Bucket labels, note formatting |
| `frontend/tests/courseHistoryImportParser.test.ts` | 7 | Yes | Local OCR parser: golden fixture, row matching, grade classification |
| `frontend/tests/coursesStep.dom.test.ts` | 4 | Yes | Screenshot import flow, prereq warnings, parsed-row apply |
| `frontend/tests/effectsMode.test.ts` | 4 | Yes | Reduced-effects override persistence and reduced-motion/system preference handling |
| `frontend/tests/landingPage.dom.test.tsx` | 4 | Yes | Landing-page structure, story CTA, product-story state changes, and reduced-effects coverage |
| `frontend/tests/multiSelect.dom.test.ts` | 2 | Yes | Picker DOM interactions |
| `frontend/tests/onboardingPage.dom.test.ts` | 5 | Yes | Onboarding DOM flow, loading state, secondary-program guard, alias search |
| `frontend/tests/profileModal.dom.test.ts` | 4 | Yes | Profile modal submit/error flow, student-stage selector, alias search |
| `frontend/tests/plannerCourseList.dom.test.ts` | 4 | Yes | Course list assumptions, stage-conflict warning, ranking explainer copy |
| `frontend/tests/plannerFeedbackNudge.dom.test.ts` | 3 | Yes | Feedback lane, nudge timing, dismissal |
| `frontend/tests/plannerLayout.dom.test.ts` | 2 | Yes | Semester-edit stale-response protection and current-progress modal data source wiring |
| `frontend/tests/plannerManualAdds.test.ts` | 4 | Yes | Manual-add pin reconciliation and conflict cleanup after reruns |
| `frontend/tests/plannerPreferencesEdit.dom.test.tsx` | 4 | Yes | Edited-semester reruns, swap candidate reuse, and reconciled downstream behavior |
| `frontend/tests/plannerSavePlan.dom.test.tsx` | 4 | Yes | Planner save flow for create vs overwrite, including normalized saved snapshots |
| `frontend/tests/progressBucketDrillIn.test.ts` | 6 | Yes | Bucket drill-in detail rendering |
| `frontend/tests/progressSources.test.ts` | 4 | Yes | Projected progress derivation from visible semester plans and bucket-ownership cleanup after swaps |
| `frontend/tests/recommendationsPanel.dom.test.tsx` | 2 | Yes | Recommendations term switching and reduced-effects rendering path |
| `frontend/tests/savedPlanExport.test.ts` | 1 | Yes | Saved-plan export payload fields, including credits, prerequisite text, and satisfy labels |
| `frontend/tests/savedPlanDetailPage.dom.test.ts` | 2 | Yes | Saved-plan detail delete and export-link behavior |
| `frontend/tests/savedPlanPrintView.dom.test.ts` | 2 | Yes | Portrait print-view rendering and snapshot-required fallback |
| `frontend/tests/savePlanModal.dom.test.tsx` | 2 | Yes | Save modal mode switching and overwrite target selection |
| `frontend/tests/savedPlanViewModal.dom.test.ts` | 1 | Yes | Saved-plan modal delete confirmation |
| `frontend/tests/semesterModal.dom.test.ts` | 5 | Yes | Semester modal copy, compact cards, course-detail planner context, and equivalent-conflict replacement |
| `frontend/tests/useSession.dom.test.ts` | 2 | Yes | Split recommendation persistence from the lighter planner session snapshot |

`tests/frontend/*.dom.test.ts` is excluded from the default Vitest run.
`frontend/tests/*.dom.test.ts` is included in the default Vitest run.
The frontend test footprint currently spans 42 test files across both roots. Use the live Vitest summary for exact case counts instead of treating this document as the source of truth for totals.

## Repo Helper Tests

| File | Tests | Command | What it covers |
|---|---:|---|---|
| `.claude/helpers/hook-handler.test.cjs` | 6 | `node --test .claude/helpers/hook-handler.test.cjs` | Claude pre/post-bash guardrails for `npm` installs, exact pinning, rebuild allowlists, and post-command lockfile scanning |

## CI Workflow

The repo includes `.github/workflows/nightly-sweep.yml` for the focused `@nightly` backend sweep on a guarded three-day cadence plus manual dispatch. The broader release gate still runs locally.

## Running Tests Locally

All tests run fully offline once dependencies already exist locally. Make sure `.venv/` and `frontend/node_modules/` are present before you lose internet. Everything reads from the CSVs in `data/`.

```powershell
# Standard suite (~10 min)
.\.venv\Scripts\python.exe -m pytest tests/backend -q

# Planner smoke guardrail only (~45 tests)
.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -m "not nightly" -q

# Frontend
cd frontend
npm run test

# Claude hook smoke test
cd ..
node --test .claude/helpers/hook-handler.test.cjs
```

