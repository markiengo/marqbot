# Test Structure

## Snapshot metadata

| Field | Value |
|---|---|
| Snapshot date | 2026-03-06 |
| Source | Local suite collection |
| Backend default collector | `python -m pytest -q` |
| Frontend default collector | `cd frontend && npm run test` |
| Purpose | Show the current test footprint, grouped coverage, and practical validation targets |

## Run profiles

| Profile | Count | How it runs | Notes |
|---|---:|---|---|
| Backend standard suite | 607 | `python -m pytest -q` | Comes from `pytest.ini`; runs `tests/backend` and excludes `nightly` |
| Backend nightly sweep | 14,382 | `python -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q` | Large pairwise dead-end simulation; not a normal end-of-session run |
| Frontend checked-in tests | 64 | Files under `tests/frontend` | Includes DOM specs that are checked in but not in the default Vitest include set |
| Frontend default Vitest run | 58 | `cd frontend && npm run test` | Current config excludes `../tests/frontend/**/*.dom.test.ts` |
| All checked-in repo tests | 15,053 | Backend + frontend + nightly | Full footprint, not the normal validation target |

## Group summary

| Group | Count | What the group does | Count breakdown |
|---|---:|---|---|
| Data and schema governance | 117 | Protects workbook shape, migration behavior, and publish-gate data quality. | `7` schema and PK audits; `10` FK audits; `17` prereq and bucket integrity audits; `20` bool coercion tests; `18` loader and migration tests; `25` legacy validator checks; `20` V2 governance checks |
| Prereq parsing, normalization, and inference | 89 | Normalizes course codes, parses prereq text, expands transitive prereqs, and detects inconsistent histories. | `20` normalization tests; `18` prereq parsing tests; `11` prereq satisfaction tests; `4` prereq explanation-string tests; `9` recursive prereq discovery tests; `10` inconsistency detection tests; `17` completed and in-progress expansion plus provenance tests |
| Allocation, eligibility, and unlocks | 69 | Verifies bucket allocation, eligible-course selection, can-take helper logic, and unlock warnings. | `1` runtime standing-index test; `25` allocation and double-count tests; `24` eligibility filter and routing tests; `6` helper-level can-take tests; `4` term parsing tests; `9` reverse-unlock and blocker-warning tests |
| API contracts and server hardening | 52 | Locks down `/recommend`, `/can-take`, `/validate-prereqs`, security headers, rate limiting, and hot reload behavior. | `21` `/recommend` contract tests; `14` `/can-take` tests; `8` `/validate-prereqs` tests; `6` health, security, and rate-limit tests; `3` data-reload safety tests |
| Recommendation ranking and quality invariants | 57 | Checks ranking tiers, bucket caps, bridge-course selection, monotonic progress, and no-repeat planner rules. | `14` semester recommender heuristic tests; `6` tier invariant tests; `37` live-data recommendation-quality invariants |
| Track-aware planning | 68 | Ensures multi-program planning respects track context, aliases, merged progress, projections, and catalog metadata. | `5` track allocation-isolation tests; `4` track eligibility-filter tests; `5` role-lookup tests; `50` live `/recommend` track, program, projection, and catalog audits; `4` synthetic-track smoke tests |
| Live profile regressions and advisor alignment | 53 | Replays realistic student scenarios and gold advisor profiles to keep outputs aligned with expected recommendations. | `10` finance-major lifecycle regressions; `11` other-major smoke and regression tests; `7` track smoke regressions; `11` special regressions for BUAN, HURE, INSY, BECO, BADM, and debug payloads; `14` advisor-gold overlap tests |
| Dead-end prevention, standard suite | 102 | Prevents 2-term planner dead ends with synthetic classifier cases and fast live-data sweeps. | `9` archetype classifier tests; `78` fast no-dead-end cases across majors, tracks, and curated combos; `7` minor smoke tests; `4` three-semester major smokes; `3` three-semester track smokes; `1` include-summer smoke |
| Frontend state and UX helpers | 64 | Protects planner UI state restore, onboarding flows, content helpers, rendering helpers, quips, and saved-plan behavior. | `5` reducer tests; `3` can-take query-match tests; `6` DOM and onboarding interaction tests; `17` quip tests; `10` rendering and credit-metric tests; `12` saved-plan storage and presentation tests; `11` about and utility helper tests |

## Nightly-only group

| Nightly group | Count | What it does | Count breakdown |
|---|---:|---|---|
| Dead-end nightly sweep | 14,382 | Exhaustive pairwise dead-end simulation, excluded from default `pytest` by the `nightly` marker. | `6,678` BFS reachable-state cases plus `7,704` deterministic adversarial-state cases across `300` pairwise program combinations and `3` start terms (`Fall 2026`, `Spring 2026`, `Summer 2026`) |

## Backend file inventory

| File | Count | Main focus |
|---|---:|---|
| `tests/backend/test_advisor_match.py` | 14 | Gold-profile overlap against advisor expectations |
| `tests/backend/test_allocator.py` | 26 | Allocation routing, min-level checks, and double-count policy behavior |
| `tests/backend/test_data_integrity.py` | 34 | CSV schema, referential integrity, runtime bucket integrity, and prereq graph sanity |
| `tests/backend/test_dead_end_archetypes.py` | 9 | Synthetic dead-end classifier archetypes |
| `tests/backend/test_dead_end_fast.py` | 93 | Standard dead-end prevention sweep plus smoke coverage |
| `tests/backend/test_dead_end_nightly.py` | 14,382 | Nightly pairwise dead-end sweep |
| `tests/backend/test_eligibility.py` | 34 | Recommendation eligibility, bridge courses, helper can-take logic, and term parsing |
| `tests/backend/test_input_validation.py` | 36 | Prereq contradiction detection and inferred prereq expansion |
| `tests/backend/test_normalizer.py` | 20 | Course-code and input normalization |
| `tests/backend/test_prereq_parser.py` | 33 | Prereq parsing, satisfaction rules, and human-readable check strings |
| `tests/backend/test_recommend_api_contract.py` | 21 | `/recommend` request and response contract |
| `tests/backend/test_recommendation_quality.py` | 37 | Cross-major recommendation invariants and multi-semester quality checks |
| `tests/backend/test_regression_profiles.py` | 39 | Realistic program and student-profile regression coverage |
| `tests/backend/test_schema_migration.py` | 38 | Schema migration, loader compatibility, and clean-mode behavior |
| `tests/backend/test_semester_recommender.py` | 14 | Ranking heuristics, caps, bridge behavior, and standing recovery |
| `tests/backend/test_server_can_take.py` | 14 | `/can-take` endpoint contract and behavior |
| `tests/backend/test_server_data_reload.py` | 3 | Runtime data hot-reload safety |
| `tests/backend/test_server_security.py` | 6 | Health endpoint, security headers, and rate limiting |
| `tests/backend/test_tier_invariants.py` | 6 | Stable recommendation tier ordering |
| `tests/backend/test_track_aware.py` | 68 | Track-aware allocation, endpoint behavior, aliases, merged progress, and catalog audits |
| `tests/backend/test_unlocks.py` | 9 | Reverse prereq map and blocker warnings |
| `tests/backend/test_validate_prereqs_endpoint.py` | 8 | `/validate-prereqs` endpoint contract and alias behavior |
| `tests/backend/test_validate_track.py` | 45 | Publish-gate validation for tracks and V2 governance checks |

## Frontend file inventory

| File | Count | In default `npm run test` | Main focus |
|---|---:|---|---|
| `tests/frontend/aboutContent.test.ts` | 2 | Yes | About-page content constants stay populated |
| `tests/frontend/appReducer.test.ts` | 5 | Yes | Bootstrap error handling and planner snapshot restore |
| `tests/frontend/canTake.test.ts` | 3 | Yes | Can-take query/result matching rules |
| `tests/frontend/coursesStep.dom.test.ts` | 1 | No | DOM flow for prereq inconsistency warnings |
| `tests/frontend/multiSelect.dom.test.ts` | 2 | No | DOM picker filtering and keyboard behavior |
| `tests/frontend/onboardingPage.dom.test.ts` | 3 | No | DOM onboarding flow and route launch |
| `tests/frontend/quips.test.ts` | 17 | Yes | Progress and semester quip generation |
| `tests/frontend/rendering.test.ts` | 10 | Yes | Progress grouping, label compaction, and credit metrics |
| `tests/frontend/savedPlanPresentation.test.ts` | 3 | Yes | Saved-plan display strings and sorting |
| `tests/frontend/savedPlans.test.ts` | 9 | Yes | Saved-plan persistence, freshness, and snapshot transforms |
| `tests/frontend/utils.test.ts` | 9 | Yes | Bucket labels, note formatting, and course filtering helpers |

## Validation guide

| Situation | Minimum reasonable validation |
|---|---|
| Narrow backend change | Closest focused backend test file |
| Shared backend change | Focused backend tests plus `python -m pytest -q` |
| Recommendation or planner logic change | Focused backend tests plus `python -m pytest tests/backend/test_dead_end_fast.py -q`; add `python -m pytest -q` if the change is broad |
| Narrow frontend helper change | Closest focused frontend test |
| Shared frontend change | Focused frontend tests plus `cd frontend && npm run test` |
| Frontend pushable UI change | `cd frontend && npm run lint` and `cd frontend && npm run build` |
| Release or exhaustive dead-end confidence check | Nightly sweep, explicitly and separately |

## Default-vs-extra reference

| Area | Default run | Extra run only when justified |
|---|---|---|
| Backend | `python -m pytest -q` | `python -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q` |
| Backend planner logic | focused file plus `tests/backend/test_dead_end_fast.py` | nightly sweep |
| Frontend | `cd frontend && npm run test` | DOM specs or extra focused runs outside current Vitest include set |
