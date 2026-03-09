# Test Structure

Last updated: 2026-03-09

Commands below assume a VS Code PowerShell terminal opened at the repo root.

## Quick Reference

| What to run | Command | Tests |
|---|---|---:|
| **Standard suite** | `.\.venv\Scripts\python.exe -m pytest -q` | ~633 |
| **Fast dead-end check** | `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q` | ~67 |
| **Nightly sweep** | `.\.venv\Scripts\python.exe -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q` | ~5,155 |
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
| `test_dead_end_nightly.py` | ~5,155 | Triple-combo sweep with randomized profiles (nightly only) |
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

Support files (not test files): `conftest.py`, `helpers.py`, `dead_end_utils.py`

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
| **Schedule** (2:39 AM Milwaukee) | Nightly Exhaustive Sweep |
| **Manual** (`workflow_dispatch`) | Nightly Exhaustive Sweep |

## Running Tests Locally

All tests run fully offline once dependencies already exist locally. Make sure `.venv/` and `frontend/node_modules/` are present before you lose internet. Everything reads from the CSVs in `data/`.

```powershell
# Standard suite (~1 min)
.\.venv\Scripts\python.exe -m pytest -q

# Fast dead-end only (~30s)
.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q

# Nightly sweep (~60 min, ~5k tests)
.\.venv\Scripts\python.exe -m pytest -m nightly -q

# Nightly with a specific seed in PowerShell (replay a past day's profiles)
$env:NIGHTLY_SEED='20260308'
.\.venv\Scripts\python.exe -m pytest -m nightly -q

# Run one specific combo
.\.venv\Scripts\python.exe -m pytest -m nightly -k "FIN_MAJOR+AIM_CFA_TRACK" -q

# Frontend
cd frontend
npm run test
```

The nightly sweep generates a report at `tests/nightly_reports/YYYY-MM-DD.md` after finishing.

## Nightly Sweep Details

The nightly sweep tests every valid triple combination of programs (major + track + minor) against 5 randomized student profiles (2 freshman, 1 each sophomore/junior/senior).

- **Seed**: date-based (`YYYYMMDD`) for daily reproducibility; override with `NIGHTLY_SEED` env var
- **Report**: uploaded as artifact `nightly-sweep-report` (14-day retention); includes what broke, analysis, and next steps
- **Fallback**: if pytest crashes during collection, a fallback report captures the error output
- **Where to find results**: [GitHub Actions -> Nightly Sweep](../../actions/workflows/nightly-sweep.yml) -> click a run -> scroll to Artifacts at the bottom -> download `nightly-sweep-report`
- **Local runs** generate the report at `tests/nightly_reports/YYYY-MM-DD.md`
