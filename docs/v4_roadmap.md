# MarqBot Forward Roadmap (SemVer-Aligned)

## 0) Version Baseline

Current state:
1. Active release line: **v1.5.0** (in progress)

Forward release train:
1. **v1.6.0** - MCC universal overlay
2. **v1.7.0** - Degree rule enforcement layer
3. **v1.8.0** - Local-only multi-plan semester grid
4. **v1.9.0** - Production hardening and security/scalability baseline
5. **v2.0.0** - AI launch (assistive, non-binding lane)

Why `v2.0.0` for AI launch:
1. It introduces a new product mode with dedicated AI endpoints and runtime behavior governance.
2. Deterministic lane remains canonical, but this is a major product capability expansion.

---

## 1) Global Product Principles

1. Deterministic engine remains source of truth for eligibility and allocation.
2. AI suggestions cannot override deterministic rule outputs.
3. Data changes are gated by validator + governance approval.
4. Student-first UX and explainability remain core product constraints.

---

## 2) Cross-Version Engineering Controls

## 2.1 Branching and release
1. Use release branches: `release/v1.6.0`, `release/v1.7.0`, etc.
2. Merge to `main` only with all gates green.
3. Tag every release with SemVer tag and publish release notes.

## 2.2 Mandatory gates (all versions)
1. `python -m pytest tests/backend_tests -q`
2. `cmd /c npm test --silent`
3. `python scripts/validate_track.py --all`
4. Manual smoke:
   - `/programs`
   - `/recommend`
   - `/can-take`

## 2.3 Rollback
1. Keep workbook backup snapshots.
2. Keep last release tag deployable.
3. On data regression: rollback workbook + redeploy previous tag.

---

## 3) v1.6.0 - MCC Universal Overlay

## 3.1 Objective
Introduce MCC as a universal requirement overlay visible for all students while keeping recommendation ranking major-first.

## 3.2 Data model changes
Workbook (`marquette_courses_full.xlsx`):
1. `programs`: add `applies_to_all` (boolean, default `FALSE`).
2. Add `MCC_CORE` row with `applies_to_all=TRUE`.
3. Add MCC rows to:
   - `buckets`
   - `sub_buckets`
   - `courses_all_buckets`
   - `double_count_policy` (where explicit overrides needed)

## 3.3 Backend changes
1. `backend/data_loader.py`:
   - load/normalize `applies_to_all`.
2. `backend/server.py`:
   - automatically include active universal programs in selection context.
3. Allocation/requirements:
   - keep existing policy precedence; no algorithm rewrite needed.

## 3.4 Frontend changes
1. Show MCC progress sections in dashboard/summary.
2. Preserve ordering: major-first recommendation list, MCC visible in progress.

## 3.5 Tests
1. Universal overlay inclusion for any selected major.
2. MCC overlap policy correctness.
3. Rendering visibility and ordering for MCC sections.

---

## 4) v1.7.0 - Degree Rule Enforcement Layer

## 4.1 Objective
Add deterministic degree-rule checks beyond prereqs.

## 4.2 Data model changes
New sheet: `degree_rules`
1. `program_id`
2. `rule_id`
3. `rule_type`
4. `rule_expr` (JSON)
5. `severity` (`warn`/`block`)
6. `active`
7. `note`

## 4.3 Backend changes
1. Add `backend/degree_rules.py` evaluator.
2. `backend/data_loader.py` loads and validates rules.
3. `backend/semester_recommender.py` applies block/warn behavior pre-output.
4. `backend/server.py` includes `rule_warnings` / `rule_blocks` in response.

## 4.4 Frontend changes
1. Render concise rule warnings in plan context/result area.
2. No major layout rewrite required.

## 4.5 Tests
1. Rule parse/validation tests.
2. Block-level exclusion tests.
3. Warning-only rendering and payload integrity tests.

---

## 5) v1.8.0 - Local-Only Multi-Plan Semester Grid

## 5.1 Objective
Support multiple local planning sessions/profiles per browser.

## 5.2 Storage model
1. Local browser storage only (`localStorage`).
2. No server-side user persistence.
3. Schema keys:
   - `marqbot_profiles_v1`
   - `marqbot_active_profile_v1`
   - `marqbot_plan::<profile_id>::v1`

## 5.3 Frontend changes
1. `frontend/modules/plans_storage.js` for profile CRUD and migration.
2. `frontend/modules/semester_grid.js` for per-semester plan state.
3. `frontend/app.js` route/state wiring.
4. `frontend/index.html` profile/grid UI.
5. `frontend/style.css` planner grid visuals.

## 5.4 Security constraints
1. Sanitize all user-entered names/notes before render.
2. No untrusted HTML insertion.
3. Keep CSP safe for local storage usage.

## 5.5 Tests
1. Profile CRUD and isolation tests.
2. Session migration tests from old key schema.
3. Import/export roundtrip integrity tests.

---

## 6) v1.9.0 - Production Hardening

## 6.1 Objective
Establish production-safe baseline for security, observability, and scale readiness.

## 6.2 Backend hardening
1. Add security headers middleware.
2. Add CORS allowlist via env config.
3. Add rate limiting for heavy endpoints.
4. Add request size and timeout guards.
5. Add meta endpoints:
   - `GET /meta/health`
   - `GET /meta/version`

## 6.3 Ops and governance
1. Document deploy env requirements in README.
2. Add structured log fields (`request_id`, endpoint, latency, status).
3. Add release checklist doc for data-governance approvals.

## 6.4 Tests
1. Security header tests.
2. Rate-limit boundary tests.
3. Meta endpoint and health tests.

---

## 7) v2.0.0 - AI Launch (Assistive, Non-Binding)

## 7.1 Objective
Launch AI-assisted discovery/explanation while preserving deterministic authority.

## 7.2 Architecture
1. New modules:
   - `backend/ai/provider.py`
   - `backend/ai/service.py`
   - provider-specific adapters
2. Environment controls:
   - `AI_ENABLED`
   - `AI_PROVIDER`
   - `AI_TIMEOUT_MS`
   - `AI_MAX_TOKENS`
   - provider API key

## 7.3 API additions
1. `POST /ai/course-search`
2. `POST /ai/explain`
3. `POST /ai/what-if`

Guardrail:
1. All AI outputs are post-validated by deterministic eligibility/requirements.
2. AI lane is explicitly marked non-binding in UI.

## 7.4 Frontend changes
1. Add separate AI lane components and state.
2. Keep deterministic recommendation lane unchanged and clearly primary.

## 7.5 Failure behavior
1. Timeout/provider failure => deterministic fallback response.
2. AI-disabled config => explicit disabled-state payload.

## 7.6 Tests
1. AI endpoint contract tests.
2. Fallback behavior tests.
3. AI-lane isolation tests (no deterministic override).

---

## 8) KPI and Rollout Strategy

## 8.1 Rollout order
1. Pilot by major.
2. Expand to college-wide after KPI validation.

## 8.2 KPI targets
1. Reduced advising time per student.
2. Faster student plan completion.
3. Lower plan correction rates in advising meetings.

## 8.3 Monitoring
1. API latency/error rates.
2. Data validation failure rates in publishing workflow.
3. AI fallback/timeout rates (v2.0.0+).

---

## 9) Assumptions

1. Students still confirm final registration choices with advisors/bulletin.
2. No account-level server persistence before dedicated auth scope.
3. Any ambiguous policy path defaults to deterministic-safe behavior.
