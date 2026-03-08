# Test Structure

Last updated: 2026-03-08

## Quick Reference

| What to run | Command | Tests |
|---|---|---:|
| **Standard suite** | `python -m pytest -q` | ~633 |
| **Fast dead-end check** | `python -m pytest tests/backend/test_dead_end_fast.py -q` | 55 |
| **Nightly sweep** | `python -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q` | ~8,248 |
| **Frontend** | `cd frontend && npm run test` | 60 |

The standard suite runs everything in `tests/backend/` except `nightly`-marked tests (configured in `pytest.ini`).

## When to Run What

| Change type | Run these |
|---|---|
| Narrow backend fix | Closest test file |
| Broad backend change | Focused file + `python -m pytest -q` |
| Planner / recommendation logic | Focused file + `test_dead_end_fast.py` |
| Release confidence | Nightly sweep (separately) |
| Frontend helper | Closest test file |
| Frontend broad / pre-push | `npm run test && npm run lint && npm run build` |

## Backend Test Files

| File | Tests | What it covers |
|---|---:|---|
| `test_advisor_match.py` | 14 | Gold-profile overlap against advisor expectations |
| `test_allocator.py` | 26 | Allocation routing, min-level, double-count policy |
| `test_data_integrity.py` | 34 | CSV schema, FK integrity, prereq graph sanity |
| `test_dead_end_archetypes.py` | 9 | Synthetic dead-end classifier archetypes |
| `test_dead_end_fast.py` | 55 | Single-program empty-state, curated combos, smoke tests |
| `test_dead_end_nightly.py` | ~8,248 | Triple-combo sweep with randomized profiles (nightly only) |
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

DOM specs (`*.dom.test.ts`) are checked in but excluded from the default Vitest config.

## Nightly Sweep Details

The nightly sweep tests every valid triple combination of programs (major + track + minor) against 8 randomized student profiles (2 per class level: freshman, sophomore, junior, senior).

- **Seed**: date-based (`YYYYMMDD`) for daily reproducibility; override with `NIGHTLY_SEED` env var
- **Failure collection**: `NightlyFailureCollector` aggregates patterns; combos with 5+ failures flagged in report artifact
- **CI**: runs via `.github/workflows/nightly-dead-end-sweep.yml` at ~2:39 AM Milwaukee time
