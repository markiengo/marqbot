# MarqBot Deep Technical Roadmap: V3.4 -> V4.0.0

## 0) Executive Summary
This file is the **implementation-grade execution spec** for the next release train.

Locked release sequence:
1. **V3.4**: MCC universal overlay (deterministic)
2. **V3.5**: Degree-rule enforcement layer
3. **V3.6**: Local-only multi-plan semester grid
4. **V3.7**: Production hardening and security/scalability baseline
5. **V4.0.0**: AI launch (assistive, non-binding lane)

Global principle:
- Deterministic engine remains canonical for eligibility, allocation, and required-path recommendations.
- AI is assistive and cannot override deterministic rule outputs.

---

## 1) Product and Stakeholder Targets

### 1.1 Primary users and KPI
1. Primary user: students.
2. Primary champion: advising office.
3. 90-day KPI: **advising time reduction**.
4. Validation KPI: student next-semester plan completion speed.

### 1.2 Locked behavior decisions
1. MCC: major-first recommendation ordering; MCC always visible in progress.
2. Offering behavior: season filter + confidence warning; no hard 3-term absence block.
3. Governance: validator pass + dean approval + staged publish.
4. Storage: browser-local only for planning sessions and saved plans.
5. AI: separate non-binding lane; deterministic eligibility gate required.

---

## 2) Cross-Version Delivery Controls

## 2.1 Branch and release strategy
1. Each version ships on a dedicated branch: `release/v3.4`, `release/v3.5`, `release/v3.6`, `release/v3.7`, `release/v4.0.0`.
2. Merge to `main` only after gate checks pass.
3. Create Git tag and GitHub release per version.

## 2.2 Mandatory gate checks (all versions)
1. `python -m pytest tests/backend_tests -q`
2. `cmd /c npm test --silent`
3. `python scripts/validate_track.py --all`
4. Manual smoke:
   - `/programs` loads expected majors/tracks.
   - `/recommend` returns deterministic recommendations.
   - `/can-take` returns expected eligibility and warnings.

## 2.3 Rollback
1. Keep workbook `.bak` snapshot for each data migration change.
2. Keep previous tagged release deployable.
3. Any runtime-breaking data issue: revert to previous workbook + redeploy previous tag.

---

## 3) V3.4 Execution Plan: MCC Universal Overlay

## 3.1 Scope outcome
MCC is a universal requirement overlay shown for all students; recommendations remain major-first.

## 3.2 Data model delta
Workbook changes in `marquette_courses_full.xlsx`:
1. `programs`: add column `applies_to_all` (bool, default `FALSE`).
2. Add row:
   - `program_id = MCC_CORE`
   - `kind = major`
   - `active = TRUE`
   - `applies_to_all = TRUE`
3. `buckets`: add MCC bucket families.
4. `sub_buckets`: add MCC sub-buckets and requirements.
5. `courses_all_buckets`: add MCC course mappings.
6. `double_count_policy`: add explicit MCC overlap rows where required.

MCC naming conventions:
1. Program ID prefix: `MCC_`.
2. Bucket IDs: `MCC_*`.
3. Sub-bucket IDs: `MCC_*`.
4. Labels must be human readable and bulletin-consistent.

## 3.3 Backend implementation (file-level)
1. `backend/data_loader.py`
   - Normalize optional `applies_to_all` in `v2_programs_df`.
   - Default missing values to `False`.
2. `backend/server.py`
   - In program selection resolution, include all active programs with `applies_to_all=True`.
   - Keep declared major selection behavior unchanged.
   - Ensure MCC is included in `selection_context.selected_program_ids`.
3. `backend/allocator.py`
   - No algorithm rewrite; ensure merged bucket graph passes through existing allocation path.
4. `backend/requirements.py`
   - No precedence changes; MCC overlaps resolved by current policy resolution chain.

## 3.4 Frontend implementation (file-level)
1. `frontend/modules/rendering.js`
   - Show MCC progress rows in current/projection sections.
   - Keep ordering:
     - recommendation ranking major-first
     - MCC section visibly grouped in progress display
2. `frontend/style.css`
   - Add MCC visual token/class for consistent distinction without new layout model.

## 3.5 Validator and governance changes
1. `scripts/validate_track.py` add checks:
   - exactly one active MCC universal program (or explicit warning if multiple universal overlays are intentionally present)
   - MCC sub-buckets have valid requirement count definitions
   - MCC mapping completeness for active sub-buckets
   - MCC policy node references valid

## 3.6 Test additions
Backend:
1. Add tests in `tests/backend_tests/test_track_aware.py`:
   - universal MCC inclusion with any declared major.
2. Add tests in `tests/backend_tests/test_allocator.py`:
   - MCC + major overlaps respect policy.
3. Add tests in `tests/backend_tests/test_semester_recommender.py`:
   - major-first ranking unchanged when MCC is present.

Frontend:
1. Add rendering tests in `tests/frontend_tests/rendering.test.js`:
   - MCC rows/tags display correctly.

## 3.7 Acceptance criteria
1. MCC appears in progress for every student scenario.
2. Recommendation list remains major-prioritized.
3. All gate checks pass.

---

## 4) V3.5 Execution Plan: Degree Rule Layer

## 4.1 Scope outcome
System enforces deterministic degree progression constraints beyond basic prerequisites.

## 4.2 Data model delta
Add sheet `degree_rules`:
1. `program_id` (FK to programs)
2. `rule_id` (unique per program)
3. `rule_type` (enum)
4. `rule_expr` (JSON string expression)
5. `severity` (`warn` or `block`)
6. `active` (bool)
7. `note` (string)

Initial supported `rule_type` set:
1. `requires_bucket_completion`
2. `requires_one_of_buckets`
3. `min_credits_from_bucket`
4. `max_overlap_with_bucket`

`rule_expr` JSON examples:
1. `requires_bucket_completion`
   - `{"bucket_id":"FIN_MAJOR::FIN_CORE","min_completed":3}`
2. `requires_one_of_buckets`
   - `{"bucket_ids":["A","B","C"],"min_satisfied":1}`
3. `min_credits_from_bucket`
   - `{"bucket_id":"HURE_MAJOR::HURE_BUS_ELEC_4","min_credits":12}`
4. `max_overlap_with_bucket`
   - `{"bucket_id":"MCC_CORE::MCC_WRIT","max_courses":2}`

## 4.3 Backend implementation (file-level)
1. Add `backend/degree_rules.py`:
   - parse and validate rule rows
   - evaluate rules against allocation/progress state
   - return structured `rule_warnings` and `rule_blocks`
2. `backend/data_loader.py`
   - load `degree_rules` sheet into `v2_degree_rules_df`
   - normalize bools/enums/json parse preflight
3. `backend/semester_recommender.py`
   - run rule evaluator before final recommendation list is emitted
   - exclude candidates violating block-level rules
4. `backend/server.py`
   - include `rule_warnings` and `rule_blocks` in response payload.

## 4.4 Frontend implementation (file-level)
1. `frontend/modules/rendering.js`
   - render concise rule warnings in results context box.
2. `frontend/style.css`
   - warning styling reuse; no new heavy component.

## 4.5 Validator changes
1. `scripts/validate_track.py`:
   - validate `rule_type` enum values
   - validate JSON parse for `rule_expr`
   - validate referenced bucket IDs exist
   - validate severity values

## 4.6 Test additions
Backend:
1. add `tests/backend_tests/test_degree_rules.py`:
   - warning-only behavior
   - block behavior
   - invalid expressions fail validation
2. update `tests/backend_tests/test_server_can_take.py` if rule metadata affects eligibility messaging.

Frontend:
1. add rendering tests for rule warning blocks.

## 4.7 Acceptance criteria
1. Block rules deterministically remove invalid options.
2. Warn rules are visible and non-blocking.
3. Existing prereq behavior remains stable.

---

## 5) V3.6 Execution Plan: Local-Only Multi-Plan Semester Grid

## 5.1 Scope outcome
Users can create multiple semester plans locally to compare major paths.

## 5.2 Storage architecture (locked)
Browser-local only:
1. `localStorage` primary persistence.
2. No server persistence and no authentication dependency.
3. Data isolation by browser profile/device.

Key schema:
1. `marqbot_profiles_v1`
   - array of `{id,name,created_at,updated_at}`
2. `marqbot_active_profile_v1`
   - active profile id
3. `marqbot_plan::<profile_id>::v1`
   - `{version,major_context,semester_grid,notes,last_opened_at}`

Semester grid schema:
1. `semester_grid`: array of semester nodes
2. each semester node:
   - `label`
   - `target_term`
   - `courses`
   - `total_credits`
   - `warnings`

## 5.3 Frontend implementation (file-level)
1. Add `frontend/modules/plans_storage.js`
   - profile CRUD
   - migration helper
   - JSON import/export
2. Add `frontend/modules/semester_grid.js`
   - grid state operations
   - credit aggregation
   - conflict/highlight hooks
3. `frontend/app.js`
   - route/tab integration
   - planner mode state transitions
4. `frontend/index.html`
   - planner tab section and controls
5. `frontend/style.css`
   - grid layout and profile controls.

## 5.4 Migration behavior
1. On first load:
   - if `marqbot_session_v1` exists and profiles absent, create default profile and migrate.
2. Migration is idempotent.
3. Preserve original key for one release for rollback safety.

## 5.5 Security requirements
1. Sanitize all user-entered profile names and notes before render.
2. Do not inject untrusted HTML into planner grid.
3. Keep CSP strict enough to reduce XSS risk to local storage.

## 5.6 Test additions
Frontend:
1. `tests/frontend_tests/session.test.js` extend for profile schema migration.
2. new `tests/frontend_tests/plans_storage.test.js`:
   - profile CRUD
   - migration
   - isolation
   - import/export validation.

Backend:
1. no required persistence API tests; ensure existing endpoints unaffected.

## 5.7 Acceptance criteria
1. Multiple local plans function correctly.
2. Plans survive browser revisit.
3. No backend changes required for persistence.

---

## 6) V3.7 Execution Plan: Production Readiness Hardening

## 6.1 Scope outcome
Production baseline with security controls and deploy-safe observability.

## 6.2 Backend hardening implementation
1. `backend/server.py`
   - add security headers middleware:
     - `Content-Security-Policy`
     - `X-Frame-Options`
     - `X-Content-Type-Options`
     - `Referrer-Policy`
   - add request id injection and structured logging fields.
2. Add CORS allowlist controlled by env var:
   - `CORS_ALLOWED_ORIGINS`
3. Add rate limiting (middleware or decorator):
   - `/recommend`
   - `/can-take`
   - future `/ai/*`
4. Add request size/time guards:
   - body size cap
   - request timeout handling.

## 6.3 New endpoints
1. `GET /meta/health`
   - returns service status + workbook load status.
2. `GET /meta/version`
   - returns app version, git SHA (if set), schema version.

## 6.4 Ops and deployment controls
1. Add environment config docs in `README.md`.
2. Add log schema for observability:
   - `request_id`
   - `endpoint`
   - `status_code`
   - `latency_ms`
3. Add minimal load test script for `/recommend`.

## 6.5 Governance process
1. Data changes require:
   - validator pass artifact
   - dean/owner approval record
   - staged publish checklist
2. Add checklist doc:
   - `docs/release_checklist.md` (new)

## 6.6 Test additions
Backend:
1. new `tests/backend_tests/test_security_headers.py`
2. new `tests/backend_tests/test_rate_limit.py`
3. new `tests/backend_tests/test_meta_endpoints.py`

## 6.7 Acceptance criteria
1. Security headers present and correct.
2. Rate limits enforce deterministic behavior.
3. Existing recommendation correctness unchanged.

---

## 7) V4.0.0 Execution Plan: AI Launch (Assistive, Non-Binding)

## 7.1 Scope outcome
AI assists discovery and explanation without replacing deterministic recommendation authority.

## 7.2 AI architecture
New backend modules:
1. `backend/ai/provider.py`
   - provider abstraction interface
2. `backend/ai/openai_provider.py` (or selected provider implementation)
3. `backend/ai/prompts.py`
4. `backend/ai/service.py`
   - orchestration, timeout, fallback handling

Config env vars:
1. `AI_ENABLED`
2. `AI_PROVIDER`
3. `AI_TIMEOUT_MS`
4. `AI_MAX_TOKENS`
5. `AI_API_KEY` (provider-specific)

## 7.3 API contracts

### 7.3.1 `POST /ai/course-search`
Request:
```json
{
  "query": "finance elective next semester with no complex prereqs",
  "declared_majors": ["FIN_MAJOR"],
  "track_id": "FP",
  "completed_courses": ["FINA 3001"],
  "in_progress_courses": ["FINA 4001"],
  "target_semester": "Fall 2026"
}
```
Response:
```json
{
  "mode": "ai_course_search",
  "results": [
    {
      "course_code": "FINA 4050",
      "reason_short": "Matches finance modeling objective and is eligible next term.",
      "decision_source": "ai_assist",
      "eligible_by_rules": true
    }
  ],
  "fallback_used": false
}
```

### 7.3.2 `POST /ai/explain`
Request includes deterministic recommendation context.
Response returns short explanation only, with deterministic references.

### 7.3.3 `POST /ai/what-if`
Request contains hypothetical add/drop.
Response includes deterministic delta and AI short summary.

## 7.4 Deterministic guardrails
1. AI suggestions are post-validated through deterministic eligibility.
2. Any ineligible AI suggestion is returned with `eligible_by_rules=false` and cannot be added as recommendation action.
3. Main recommendation panel remains deterministic-only.

## 7.5 Frontend implementation (file-level)
1. `frontend/modules/api.js`
   - add AI endpoint wrappers.
2. `frontend/app.js`
   - AI query handlers
   - non-binding lane state
3. `frontend/modules/rendering.js`
   - AI lane card templates
   - clear label: "AI Discovery (non-binding)"
4. `frontend/style.css`
   - lane styling distinct from primary deterministic recommendations.

## 7.6 Fallback and failure policy
1. AI timeout or provider failure:
   - return deterministic fallback response with `fallback_used=true`.
2. No provider key configured:
   - endpoints return disabled-state payload, not hard server error.
3. AI uncertainty:
   - do not fabricate certainty; return limited results with explicit warning.

## 7.7 Test additions
Backend:
1. new `tests/backend_tests/test_ai_course_search.py`
2. new `tests/backend_tests/test_ai_explain.py`
3. new `tests/backend_tests/test_ai_what_if.py`
4. provider timeout/fallback tests with mocks.

Frontend:
1. new rendering tests for AI lane.
2. interaction tests that AI lane does not override main list.

## 7.8 Acceptance criteria
1. AI lane is separate and non-binding.
2. Deterministic list remains unchanged for same inputs.
3. Fallback behavior is deterministic and user-visible.

---

## 8) Deep Test Matrix by Version

## 8.1 V3.4
1. Universal program inclusion tests.
2. MCC overlap policy conflict tests.
3. MCC progress rendering order tests.

## 8.2 V3.5
1. Rule parse and validation tests.
2. Rule block filtering tests.
3. Rule warning message rendering tests.

## 8.3 V3.6
1. Profile isolation tests.
2. Migration tests from old session key.
3. Import/export integrity tests.

## 8.4 V3.7
1. Header and CORS tests.
2. Rate-limit boundary tests.
3. Meta endpoint and health tests.

## 8.5 V4.0.0
1. AI lane segregation tests.
2. Deterministic eligibility gate tests for AI outputs.
3. Timeout and provider outage fallback tests.

---

## 9) Rollout and Monitoring Plan

## 9.1 Rollout order
1. Pilot by major.
2. Validate KPI movement.
3. Expand college-wide.

## 9.2 KPI instrumentation
1. Advising time reduction:
   - capture self-reported meeting/prep durations from pilot cohorts.
2. Planning speed:
   - capture first valid plan completion time.
3. Reliability:
   - API error rates
   - validator failure rates in data publish pipeline.

## 9.3 Monitoring requirements
1. Endpoint latency and error logging.
2. Workbook reload success/failure logs.
3. AI fallback rate and timeout rate logs (V4.0.0+).

---

## 10) Explicit Assumptions and Defaults
1. Students still verify final registration choices against bulletin/advisors.
2. No PII-account model is required before V4.0.0.
3. Future universal requirement families reuse `applies_to_all`.
4. Workload/difficulty inference and professor analytics are post-V4 scope.
5. Any unresolved policy ambiguity defaults to deterministic safe behavior (deny/require explicit policy).
