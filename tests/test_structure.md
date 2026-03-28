# Test Structure

Last updated: 2026-03-28

Commands below assume a VS Code PowerShell terminal opened at the repo root.

## Quick Reference

| What to run | Command | Tests |
|---|---|---:|
| **Standard suite** | `.\.venv\Scripts\python.exe -m pytest -q` | 627 |
| **Planner smoke guardrail** | `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -m "not nightly" -q` | ~45 |
| **Nightly sweep** | `.\.venv\Scripts\python.exe -m pytest -m nightly -q` | 2250 sampled + nightly-only catalog audits |
| **Frontend** | `cd frontend; npm run test` | 113 |

The standard suite runs everything in `tests/backend/` except `nightly`-marked tests (configured in `pytest.ini`).
Nightly is now the home for data-sensitive catalog acceptance checks that are expected to drive course/major patch decisions from the report, not PR gating.

## When to Run What

| Change type | Run these |
|---|---|
| Narrow backend fix | Closest test file |
| Broad backend change | Focused file + `.\.venv\Scripts\python.exe -m pytest -q` |
| Planner / recommendation logic | Focused file + the planner smoke guardrail |
| Release confidence | Nightly sweep (separately) |
| Frontend helper | Closest test file |
| Frontend broad / pre-push | `cd frontend; npm run test; npm run lint; npm run build` |

## Backend Test Files

| File | Tests | What it covers |
|---|---:|---|
| `test_advisor_match.py` | 14 | Nightly-only advisor gold-profile overlap audit |
| `test_allocator.py` | 26 | Allocation routing, min-level, double-count policy |
| `test_data_integrity.py` | 34 | CSV schema, FK integrity, prereq graph sanity |
| `test_dead_end_archetypes.py` | 9 | Synthetic dead-end classifier archetypes |
| `test_dead_end_fast.py` | ~201 total | Mixed file: PR smoke checks plus nightly-only catalog dead-end and graduation baselines; every case runs 3x (once per scheduling style: grinder, explorer, mixer) |
| `test_dead_end_nightly.py` | 2250 default | Focused sampled nightly sweep with prereq-hardened seeded histories and semester-8 completion checks; each scenario runs across all 3 scheduling styles |
| `test_dead_end_nightly_helpers.py` | 4 | Nightly sampler, seeded-history builder, budget guard, and report-format regression tests |
| `test_eligibility.py` | 42 | Eligibility filters, restrictions, bridge courses, can-take helpers |
| `test_equivalencies.py` | 25 | Equivalency maps, prereq satisfaction, NDC blocking, schema checks |
| `test_feedback_api.py` | 9 | `/api/feedback` contract, JSONL persistence, validation, rate limiting |
| `test_input_validation.py` | 36 | Prereq contradiction detection, inferred prereq expansion |
| `test_normalizer.py` | 20 | Course-code normalization |
| `test_prereq_parser.py` | 33 | Prereq parsing, satisfaction rules, human-readable strings |
| `test_recommend_api_contract.py` | 22 | `/recommend` request/response contract |
| `test_recommendation_quality.py` | 37 | Cross-major recommendation invariants, multi-semester quality |
| `test_regression_profiles.py` | 39 | Realistic student-profile regressions |
| `test_schema_migration.py` | 38 | Schema migration, loader compatibility, clean-mode |
| `test_semester_recommender.py` | 38 | Ranking heuristics, concurrent picks, caps, standing recovery, scheduling style archetypes |
| `test_server_can_take.py` | 15 | `/can-take` endpoint contract |
| `test_server_data_reload.py` | 3 | Hot-reload safety |
| `test_server_security.py` | 6 | Health, security headers, rate limiting |
| `test_nightly_analyze.py` | 6 | Nightly auto-tune analyzer: feasibility audit, concentration detector, ledger regression/boost-resistance |
| `test_tier_invariants.py` | 7 | Stable recommendation tier ordering |
| `test_track_aware.py` | 68 | Track allocation, aliases, merged progress; AIM catalog audits now run nightly-only |
| `test_unlocks.py` | 9 | Reverse prereq map, blocker warnings |
| `test_validate_prereqs_endpoint.py` | 8 | `/validate-prereqs` endpoint contract |
| `test_validate_track.py` | 45 | Publish-gate validation, V2 governance |
| `test_policy_verification.py` | 10 | COBA_05/06 enforcement, CRED_01/02/04/10 credit-load warnings, summer cap, semester_warnings field |

Support files (not test files): `conftest.py`, `helpers.py`, `dead_end_utils.py`, `nightly_support.py`

### Student Stage Support

`PlanCase` (in `dead_end_utils.py`) and payload builders (`recommend_payload`, `payload_for_major` in `helpers.py`) accept an optional `student_stage` parameter (`"undergrad"`, `"graduate"`, `"doctoral"`, or `None`). When `None` (the default), the stage hard gate is skipped and all course levels are eligible. All existing tests omit this field to preserve backward-compatible behavior. Dedicated student-stage filtering tests live in `test_eligibility.py`, `test_recommend_api_contract.py`, and `test_server_can_take.py`.

### Scheduling Style (Archetype) Support

`PlanCase` accepts an optional `scheduling_style` parameter (`"grinder"`, `"explorer"`, `"mixer"`, or `None`). Styles use a two-layer mechanism: tier remapping (sort-key influence) plus slot reservations (enforced during selection). Configuration lives in `backend/scheduling_styles.py` as `StyleConfig` dataclasses with `min_discovery_slots`, `min_core_slots`, `interleave`, `tier_map`, and `relax_bcc_band` fields.

- `"grinder"` (default): No reservations. Core-first, discovery fills gaps.
- `"explorer"`: Reserves 2 discovery slots per semester. Demotes BCC from band 1 to 2 when the student has ≥ 4 semesters of runway.
- `"mixer"`: Reserves 1 discovery + 2 core slots and interleaves picks.

**How archetypes integrate into the nightly suite:**

- `test_dead_end_fast.py`: Every baseline case (single-major, single-track, curated combos, graduation-by-8) is expanded 3x via `_expand_with_scheduling_styles()`. Each `PlanCase` variant gets a `scheduling_style` field and a label suffix `::style=grinder|explorer|mixer`. This triples the fast PR guardrail cases (~67 base x 3 = ~201 total).
- `test_dead_end_nightly.py` + `nightly_support.py`: Inside `build_nightly_suite()`, each sampled scenario + profile + selection-variant combo is expanded across all 3 styles. The case budget was raised from 750 to 2250. Label format: `{scenario}/{profile}/v{n}::style={style}`.
- `test_semester_recommender.py`: 8 dedicated unit tests verify grinder=default, explorer reserves discovery slots, explorer differs from grinder, mixer guarantees core+discovery mix, mixer differs from grinder, invalid styles fall back to grinder, and all styles respect max_recs.
- `simulate_terms()` in `dead_end_utils.py` passes `scheduling_style` to `run_recommendation_semester()`, so every nightly simulation runs with the correct archetype.

The key safety property: all 3 scheduling styles must still graduate a fresh student within 8 semesters. If explorer defers BCC so far that a prereq chain can't complete in time, the nightly sweep catches it.

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
| `savedPlans.test.ts` | 9 | Yes | Plan persistence, freshness |
| `studentStage.test.ts` | 3 | Yes | Stage inference, explicit vs inferred, history conflict flags |
| `utils.test.ts` | 9 | Yes | Bucket labels, note formatting |
| `frontend/tests/courseHistoryImportParser.test.ts` | 7 | Yes | Local OCR parser: golden fixture, row matching, grade classification |
| `frontend/tests/coursesStep.dom.test.ts` | 4 | Yes | Screenshot import flow, prereq warnings, parsed-row apply |
| `frontend/tests/effectsMode.test.ts` | 2 | Yes | Reduced-effects override persistence and modal fallback styling |
| `frontend/tests/multiSelect.dom.test.ts` | 2 | Yes | Picker DOM interactions |
| `frontend/tests/onboardingPage.dom.test.ts` | 5 | Yes | Onboarding DOM flow, loading state, secondary-program guard, alias search |
| `frontend/tests/profileModal.dom.test.ts` | 4 | Yes | Profile modal submit/error flow, student-stage selector, alias search |
| `frontend/tests/plannerCourseList.dom.test.ts` | 4 | Yes | Course list assumptions, stage-conflict warning, ranking explainer copy |
| `frontend/tests/plannerFeedbackNudge.dom.test.ts` | 3 | Yes | Feedback lane, nudge timing, dismissal |
| `frontend/tests/progressBucketDrillIn.test.ts` | 4 | Yes | Bucket drill-in detail rendering |
| `frontend/tests/savedPlanDetailPage.dom.test.ts` | 1 | Yes | Saved-plan detail delete confirmation |
| `frontend/tests/savedPlanViewModal.dom.test.ts` | 1 | Yes | Saved-plan modal delete confirmation |
| `frontend/tests/semesterModal.dom.test.ts` | 3 | Yes | Semester modal copy, compact cards, course-detail planner context |
| `frontend/tests/useSession.dom.test.ts` | 2 | Yes | Split recommendation persistence from the lighter planner session snapshot |

`tests/frontend/*.dom.test.ts` is excluded from the default Vitest run.
`frontend/tests/*.dom.test.ts` is included in the default Vitest run.
The default frontend run currently covers 113 cases across both `tests/frontend/*.test.ts` and `frontend/tests/*.test.ts`.

## CI Workflow

One unified workflow: `.github/workflows/nightly-sweep.yml`

| Trigger | Jobs that run |
|---|---|
| **Pull request** | Backend Regression, Planner Fast Guardrail, Frontend Tests |
| **Schedule** (2am CT daily) | Planner Fast Guardrail, Nightly Focused Sweep — **re-enabled 2026-03-26**. Auto-Tune job remains disabled (`if: false`). |
| **Manual** (`workflow_dispatch`) | Planner Fast Guardrail, Nightly Focused Sweep (Auto-Tune job disabled — set `if: false` back to `github.event_name != 'pull_request'` to restore) |

For the scheduled/manual nightly jobs, catalog-data assertion failures are treated as reportable review items, not release-blocking CI failures. The sweep stays green on pytest exit code `1` as long as the report artifact is produced; runner/internal pytest errors still fail the workflow. After a successful sweep, the auto-tune job reads the JSON sidecar, updates `config/ranking_overrides.json` plus `config/data_investigation_queue.json`, and opens a PR. Small override changes (`<= 3` bucket override edits) are set to auto-merge.

## Running Tests Locally

All tests run fully offline once dependencies already exist locally. Make sure `.venv/` and `frontend/node_modules/` are present before you lose internet. Everything reads from the CSVs in `data/`.

```powershell
# Standard suite (~10 min)
.\.venv\Scripts\python.exe -m pytest -q

# Planner smoke guardrail only (~45 tests)
.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -m "not nightly" -q

# Nightly focused sweep plus nightly-only catalog audits
.\.venv\Scripts\python.exe -m pytest -m nightly -q

# Nightly with a specific seed in PowerShell (replay a past day's sampled combos/histories)
$env:NIGHTLY_SEED='20260308'
.\.venv\Scripts\python.exe -m pytest -m nightly -q

# Reduced nightly smoke (1 combo x 5 profiles x 1 variant, plus any nightly catalog audits)
$env:NIGHTLY_SAMPLE_SIZE='1'
$env:NIGHTLY_SELECTION_VARIANTS='1'
.\.venv\Scripts\python.exe -m pytest -m nightly -q
Remove-Item Env:NIGHTLY_SAMPLE_SIZE
Remove-Item Env:NIGHTLY_SELECTION_VARIANTS

# Run one specific combo
.\.venv\Scripts\python.exe -m pytest -m nightly -k "ACCO_MAJOR+AIM_IB_TRACK+INSY_MAJOR" -q

# Analyze the latest nightly JSON locally without writing config changes
.\.venv\Scripts\python.exe scripts\analyze_nightly.py --report tests\nightly_reports\YYYY-MM-DD.json --dry-run

# Frontend
cd frontend
npm run test
```

The nightly sweep generates `tests/nightly_reports/YYYY-MM-DD.md` plus `tests/nightly_reports/YYYY-MM-DD.json` after finishing.
The Markdown report is the daily review surface for catalog-sensitive failures such as advisor-gold drift, baseline dead-ends, and baseline graduation gaps. The JSON sidecar is the machine-readable input for `scripts/analyze_nightly.py`.

## Nightly Sweep Details

The nightly sweep is now a focused sampled harness, not an exhaustive combinatorial sweep.

- **Scenario selection**: by default it samples `30` valid multi-program combos from the full nightly pool using a date-based seed (`YYYYMMDD`)
- **Profiles per combo**: `5` seeded student states: `foundation`, `early`, `mid`, `late`, `capstone`
- **Course-selection variants**: `5` prereq-valid planner-seeded histories per profile, built chronologically from actual recommendation order
- **Seeded history rules**: undergrad-only completed courses, no random course-universe sampling, no impossible prerequisite jumps, and invalid seeded histories are reported as first-class nightly issues
- **Deadline rule**: each seeded student must both avoid dead-ends and still be on pace to finish within an overall `8`-semester path; the seeded semesters already taken count against that cap
- **Expected count accounting**: the report shows planned samples, evaluated samples, invalid seeded histories, and whether the run was complete or partial
- **Report layout**: plain-English health summary first, then priority fix list, data-investigation checklist, failures by program, biggest patterns, and an appendix with run details and student profile logs
- **Catalog baseline section**: advisor-gold mismatches and baseline dead-end / graduation audits are summarized in a dedicated nightly report section
- **JSON sidecar**: each run also writes `YYYY-MM-DD.json` with raw sampled-plan failures, baseline audit records, and derived priority/checklist sections
- **Seed**: override combo/history replay with `NIGHTLY_SEED`
- **Knobs**: `NIGHTLY_SAMPLE_SIZE`, `NIGHTLY_SELECTION_VARIANTS`, and `NIGHTLY_CASE_BUDGET`
- **Auto-tune**: `scripts/analyze_nightly.py` classifies bucket failures as `DATA`, `ALGORITHM`, or `SETUP`, updates ranking overrides, and refreshes the human investigation queue
- **Report artifact**: uploaded as one artifact named `nightly-sweep-report-YYYY-MM-DD` (14-day retention) and contains both the Markdown report and JSON sidecar
- **Fallback**: if pytest crashes during collection, a fallback report captures the error output
- **Where to find results**: [GitHub Actions -> Nightly Sweep](../../actions/workflows/nightly-sweep.yml) -> click a run -> scroll to Artifacts at the bottom -> download `nightly-sweep-report-YYYY-MM-DD`
- **Local runs** generate the report pair at `tests/nightly_reports/YYYY-MM-DD.md` and `tests/nightly_reports/YYYY-MM-DD.json`

### How the nightly sweep works

1. Build the full valid nightly scenario pool from active multi-program combinations.
2. Deterministically sample `30` combos from that pool for the current day.
3. For each combo, generate `5` seeded student states by replaying planner recommendations from an empty start.
4. For each seeded state, branch into `5` different prereq-safe course-selection variants.
5. Simulate forward and fail if the student hits a dead-end, if the seeded history itself is invalid, or if the student cannot still finish by semester `8`.
6. Write a report with explicit completeness metadata so partial runs are not presented as exhaustive.
