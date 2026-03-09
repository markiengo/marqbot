# Test Structure

Last updated: 2026-03-09

Commands below assume a VS Code PowerShell terminal opened at the repo root.

## Quick Reference

| What to run | Command | Tests |
|---|---|---:|
| **Standard suite** | `.\.venv\Scripts\python.exe -m pytest -q` | ~637 |
| **Fast dead-end check** | `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q` | ~67 |
| **Nightly sweep** | `.\.venv\Scripts\python.exe -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q` | 750 default |
| **Frontend** | `cd frontend; npm run test` | 71 |

The standard suite runs everything in `tests/backend/` except `nightly`-marked tests (configured in `pytest.ini`).

## When to Run What

| Change type | Run these |
|---|---|
| Narrow backend fix | Closest test file |
| Broad backend change | Focused file + `.\.venv\Scripts\python.exe -m pytest -q` |
| Planner / recommendation logic | Focused file + `test_dead_end_fast.py` |
| Release confidence | Nightly sweep (separately) |
| Frontend helper | Closest test file |
| Frontend broad / pre-push | `cd frontend; npm run test; npm run lint; npm run build` |

## Backend Test Files

| File | Tests | What it covers |
|---|---:|---|
| `test_advisor_match.py` | 14 | Gold-profile overlap against advisor expectations |
| `test_allocator.py` | 26 | Allocation routing, min-level, double-count policy |
| `test_data_integrity.py` | 34 | CSV schema, FK integrity, prereq graph sanity |
| `test_dead_end_archetypes.py` | 9 | Synthetic dead-end classifier archetypes |
| `test_dead_end_fast.py` | ~67 | Single-program empty-state, curated combos, smoke tests, graduation-by-8 |
| `test_dead_end_nightly.py` | 750 default | Focused sampled nightly sweep with prereq-hardened seeded histories and semester-8 completion checks |
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
| `test_semester_recommender.py` | 26 | Ranking heuristics, concurrent picks, caps, standing recovery |
| `test_server_can_take.py` | 15 | `/can-take` endpoint contract |
| `test_server_data_reload.py` | 3 | Hot-reload safety |
| `test_server_security.py` | 6 | Health, security headers, rate limiting |
| `test_tier_invariants.py` | 6 | Stable recommendation tier ordering |
| `test_track_aware.py` | 68 | Track allocation, aliases, merged progress, catalog audits |
| `test_unlocks.py` | 9 | Reverse prereq map, blocker warnings |
| `test_validate_prereqs_endpoint.py` | 8 | `/validate-prereqs` endpoint contract |
| `test_validate_track.py` | 45 | Publish-gate validation, V2 governance |

Support files (not test files): `conftest.py`, `helpers.py`, `dead_end_utils.py`, `nightly_support.py`

## Frontend Test Files

| File | Tests | Default run | What it covers |
|---|---:|---|---|
| `aboutContent.test.ts` | 2 | Yes | About-page content constants |
| `appReducer.test.ts` | 5 | Yes | Bootstrap errors, snapshot restore |
| `canTake.test.ts` | 3 | Yes | Can-take query matching |
| `coursesStep.dom.test.ts` | 1 | No | Prereq inconsistency warnings (DOM) |
| `feedback.test.ts` | 2 | Yes | Feedback payload building and message validation |
| `multiSelect.dom.test.ts` | 2 | No | Picker filtering, keyboard (DOM) |
| `onboardingPage.dom.test.ts` | 3 | No | Onboarding flow, route launch (DOM) |
| `quips.test.ts` | 17 | Yes | Progress and semester quips |
| `rendering.test.ts` | 10 | Yes | Progress grouping, credit metrics |
| `savedPlanPresentation.test.ts` | 3 | Yes | Saved-plan display strings |
| `savedPlans.test.ts` | 9 | Yes | Plan persistence, freshness |
| `utils.test.ts` | 9 | Yes | Bucket labels, note formatting |
| `frontend/tests/coursesStep.dom.test.ts` | 1 | Yes | Planner DOM warning flow |
| `frontend/tests/multiSelect.dom.test.ts` | 2 | Yes | Picker DOM interactions |
| `frontend/tests/onboardingPage.dom.test.ts` | 3 | Yes | Onboarding DOM flow |
| `frontend/tests/profileModal.dom.test.ts` | 2 | Yes | Profile modal submit/error flow |
| `frontend/tests/savedPlanDetailPage.dom.test.ts` | 1 | Yes | Saved-plan detail delete confirmation |
| `frontend/tests/savedPlanViewModal.dom.test.ts` | 1 | Yes | Saved-plan modal delete confirmation |
| `frontend/tests/semesterModal.dom.test.ts` | 1 | Yes | Semester modal interactions |

`tests/frontend/*.dom.test.ts` is excluded from the default Vitest run.
`frontend/tests/*.dom.test.ts` is included in the default Vitest run.

## CI Workflow

One unified workflow: `.github/workflows/nightly-sweep.yml`

| Trigger | Jobs that run |
|---|---|
| **Pull request** | Backend Regression, Planner Fast Guardrail, Frontend Tests |
| **Schedule** (about 2:00 AM Milwaukee) | Nightly Focused Sweep |
| **Manual** (`workflow_dispatch`) | Nightly Focused Sweep |

## Running Tests Locally

All tests run fully offline once dependencies already exist locally. Make sure `.venv/` and `frontend/node_modules/` are present before you lose internet. Everything reads from the CSVs in `data/`.

```powershell
# Standard suite (~1 min)
.\.venv\Scripts\python.exe -m pytest -q

# Fast dead-end only (~30s)
.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q

# Nightly focused sweep (default: 30 combos x 5 profiles x 5 variants = 750 tests)
.\.venv\Scripts\python.exe -m pytest -m nightly -q

# Nightly with a specific seed in PowerShell (replay a past day's sampled combos/histories)
$env:NIGHTLY_SEED='20260308'
.\.venv\Scripts\python.exe -m pytest -m nightly -q

# Reduced nightly smoke (1 combo x 5 profiles x 1 variant)
$env:NIGHTLY_SAMPLE_SIZE='1'
$env:NIGHTLY_SELECTION_VARIANTS='1'
.\.venv\Scripts\python.exe -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q
Remove-Item Env:NIGHTLY_SAMPLE_SIZE
Remove-Item Env:NIGHTLY_SELECTION_VARIANTS

# Run one specific combo
.\.venv\Scripts\python.exe -m pytest -m nightly -k "ACCO_MAJOR+AIM_IB_TRACK+INSY_MAJOR" -q

# Frontend
cd frontend
npm run test
```

The nightly sweep generates a report at `tests/nightly_reports/YYYY-MM-DD.md` after finishing.

## Nightly Sweep Details

The nightly sweep is now a focused sampled harness, not an exhaustive combinatorial sweep.

- **Scenario selection**: by default it samples `30` valid multi-program combos from the full nightly pool using a date-based seed (`YYYYMMDD`)
- **Profiles per combo**: `5` seeded student states: `foundation`, `early`, `mid`, `late`, `capstone`
- **Course-selection variants**: `5` prereq-valid planner-seeded histories per profile, built chronologically from actual recommendation order
- **Seeded history rules**: undergrad-only completed courses, no random course-universe sampling, no impossible prerequisite jumps, and invalid seeded histories are reported as first-class nightly issues
- **Deadline rule**: each seeded student must both avoid dead-ends and still be on pace to finish within an overall `8`-semester path; the seeded semesters already taken count against that cap
- **Expected count accounting**: the report shows expected cases, executed cases, invalid seeded histories, and whether the run was complete or partial
- **Report layout**: short coverage intro and summary first, then student-first failure blocks with majors, track, seeded courses taken, fail point, and plain-English reason text
- **Seed**: override combo/history replay with `NIGHTLY_SEED`
- **Knobs**: `NIGHTLY_SAMPLE_SIZE`, `NIGHTLY_SELECTION_VARIANTS`, and `NIGHTLY_CASE_BUDGET`
- **Report**: uploaded as artifact `nightly-sweep-report` (14-day retention); includes coverage accounting and student-level failures
- **Fallback**: if pytest crashes during collection, a fallback report captures the error output
- **Where to find results**: [GitHub Actions -> Nightly Sweep](../../actions/workflows/nightly-sweep.yml) -> click a run -> scroll to Artifacts at the bottom -> download `nightly-sweep-report`
- **Local runs** generate the report at `tests/nightly_reports/YYYY-MM-DD.md`

### How the nightly sweep works

1. Build the full valid nightly scenario pool from active multi-program combinations.
2. Deterministically sample `30` combos from that pool for the current day.
3. For each combo, generate `5` seeded student states by replaying planner recommendations from an empty start.
4. For each seeded state, branch into `5` different prereq-safe course-selection variants.
5. Simulate forward and fail if the student hits a dead-end, if the seeded history itself is invalid, or if the student cannot still finish by semester `8`.
6. Write a report with explicit completeness metadata so partial runs are not presented as exhaustive.
