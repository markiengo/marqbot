# UI Redesign Plan (Merged)

## 1. Summary
This plan merges the 3-panel redesign vision with implementation safeguards based on the current codebase.
It preserves planner behavior, improves hierarchy and visual clarity, and introduces a dedicated inline eligibility flow for `Can I Take This?` without overloading `/recommend`.

## 2. Goals
1. Improve information hierarchy with a guided, dashboard-style layout.
2. Keep current planning functionality and backend contracts stable.
3. Reduce interaction friction for major/track/course selection and progress interpretation.
4. Maintain keyboard and accessibility support.
5. Ship safely in phases with regression coverage.

## 3. Non-Goals
1. No mobile-first redesign in this phase (desktop/tablet first).
2. No backend recommendation logic changes in this UI redesign.
3. No data model migrations in this UI redesign.
4. No dependency on external chart libraries.

## 4. Locked Product Decisions
1. Brand navy becomes `#003366` everywhere.
2. Post-submit recommendation flow auto-scrolls to progress.
3. `Can I Take This?` is standalone with Enter-to-check and inline result in right panel.
4. Recommendation card warnings are persistent inline banners.
5. Progress ring is medium size (~100px) and shown with KPI cards.
6. Step indicator: completed uses gold fill + white check; pending is dim outlined.
7. Right panel is summary/controls/inline checker; full progress detail stays in center.
8. Rollout is phased, not big-bang.

## 5. Public API / Interface Changes

### 5.1 Additive endpoint
`POST /can-take`

Request fields:
1. `completed_courses`
2. `in_progress_courses`
3. `target_semester` or `target_semester_primary`
4. `requested_course`
5. Optional selection context: `declared_majors`, `track_id`

Response shape:
```json
{
  "mode": "can_take",
  "requested_course": "FINA 4081",
  "can_take": true,
  "why_not": null,
  "missing_prereqs": [],
  "not_offered_this_term": false,
  "unsupported_prereq_format": false,
  "next_best_alternatives": []
}
```

### 5.2 Existing behavior
1. `/recommend` remains unchanged as the planning endpoint.
2. `/programs` and `/courses` remain backward compatible.
3. No required payload changes for existing clients.

## 6. File-Level Scope
1. `frontend/index.html` - restructure into 3-panel shell and sticky topbar.
2. `frontend/style.css` - tokenized foundation and full component/layout styling.
3. `frontend/app.js` - step indicator, anchor nav, progress dashboard wiring, standalone can-take handler.
4. `frontend/modules/rendering.js` - ring/KPI/summary/inline-can-take render helpers and warning banner pattern.
5. `frontend/modules/api.js` - add `postCanTake`.
6. `backend/server.py` - add `/can-take`.
7. `tests/frontend_tests/rendering.test.js` - add render helper tests.
8. `tests/frontend_tests/*` - update selector/layout interaction tests as needed.
9. `tests/backend_tests/*` - add `/can-take` endpoint coverage.
10. `DESIGN_NOTES.md` - rationale and component map.
11. `UI_redesign.md` - this plan document.

## 7. Implementation Phases

### Phase 0 - Preflight and Safety
1. Confirm all selector IDs used by `app.js` are preserved in planned HTML locations.
2. Create an ID mapping table from old layout to new panel positions.
3. Confirm session restore still finds moved fields via `getElementById`.

### Phase 1 - Design Tokens and Visual Foundation
1. Update `:root` tokens in `style.css`.
2. Replace old navy hardcodes (`#0a2f66`) with `#003366`-aligned palette.
3. Add spacing/type/layout tokens (`--sp-*`, `--text-*`, panel widths, topbar height).
4. Normalize warning/success colors for contrast on dark surfaces.
5. Keep UI functional before structural changes.

### Phase 2 - HTML Restructure to 3 Panels
1. Implement shell:
   1. Sticky topbar with anchors.
   2. Left panel for guided input steps.
   3. Center panel for hero, progress dashboard, and recommendations.
   4. Right panel for quick settings, summary card, and can-take card.
2. Preserve existing functional IDs exactly.
3. Move quick settings (`target semester`, `second semester`, `max recs`) to right panel.
4. Keep submit button in left panel.
5. Add `data-nav-section` hooks for section tracking.

### Phase 3 - Core Interaction Wiring in app.js
1. Add `updateStepIndicator()` and call after state changes:
   1. major/track updates
   2. chip add/remove
   3. restore session
2. Add `setupAnchorNav()`:
   1. smooth-scroll click behavior
   2. active anchor state via `IntersectionObserver`
3. Add `populateProgressDashboard(data)`:
   1. aggregate `current_progress`
   2. render center ring + KPI cards
   3. render right-panel mini summary
4. Add post-submit auto-scroll to progress after recommendation success.
5. Update `clearResults()` to hide/reset dashboard summary state.

### Phase 4 - Standalone Can-I-Take
1. Add `postCanTake()` in `frontend/modules/api.js`.
2. Add `setupCanTakeStandalone()` in `app.js`:
   1. Enter key triggers only inline check (no full form submit).
   2. Build payload from current state and right-panel settings.
   3. Render inline status into `#can-take-result`.
3. Backend in `server.py`:
   1. Add `/can-take` route.
   2. Reuse existing normalization and selection resolution.
   3. Return dedicated `mode: "can_take"` payload.
4. Keep `/recommend` unaffected.

### Phase 5 - Rendering Module Enhancements
1. Export `getProgramLabelMap` from `rendering.js`.
2. Add `renderProgressRing(pct, size, stroke)` using SVG.
3. Add `renderKpiCardsHtml(done, remaining, inProgress)`.
4. Add `renderDegreeSummaryHtml(currentProgress)` for compact right-panel summary.
5. Add `renderCanTakeInlineHtml(data)` for right-panel checker output.
6. Update recommendation card template:
   1. Replace transient warning text with visible inline warning strip.
   2. Keep warning semantics color-consistent.

### Phase 6 - CSS Component Completion
1. Implement sticky topbar and 3-panel desktop grid.
2. Implement left/right sticky scroll regions.
3. Implement step indicator completed/pending styles.
4. Implement KPI cards and progress ring wrappers.
5. Implement inline warning banner style in recommendation cards.
6. Add tablet breakpoint (`<=1100px`) and defer true mobile redesign.
7. Add reduced-motion and focus-visible rules.

### Phase 7 - QA, Tests, and Documentation
1. Add/extend frontend tests for new render helpers.
2. Add backend tests for `/can-take`.
3. Add interaction tests for:
   1. Enter key on can-take
   2. auto-scroll after recommendations
   3. step indicator update on state change
4. Add `DESIGN_NOTES.md` with rationale and constraints.
5. Run full backend/frontend suites and validator scripts.

## 8. Test Cases and Scenarios

### 8.1 Frontend Rendering
1. Progress ring clamps at `0..100`.
2. KPI HTML contains completed/remaining/in-progress values.
3. Degree summary renders compact bucket stats correctly.
4. Inline can-take renderer handles true/false/manual-review states.
5. Recommendation warning strip appears when `soft_tags` exist.

### 8.2 Frontend Interaction
1. Recommendation submit auto-scrolls to progress dashboard.
2. Can-take Enter does not submit full advisor form.
3. Can-take result updates inline in right panel.
4. Step indicator reflects restored session.
5. Anchor nav highlights current visible section.

### 8.3 Backend
1. `/can-take` returns expected response for:
   1. eligible course
   2. missing prerequisites
   3. not offered this term
   4. unsupported/manual-review prereq format
2. Declared major/track context is respected in `/can-take`.

### 8.4 Regression
1. Existing `/recommend` payload/response behavior remains unchanged.
2. Existing course/major/track selectors keep keyboard support.
3. Session save/restore still works with moved controls.

## 9. Acceptance Criteria
1. New 3-panel layout is live with preserved IDs and working interactions.
2. All old navy values are replaced by `#003366`.
3. Recommendation submit auto-scrolls to progress.
4. Can-take check works inline via Enter and dedicated endpoint.
5. Recommendation warnings are persistent inline banners.
6. Progress ring + KPI row appears in center with coherent totals.
7. Full progress detail renders once (center), not duplicated inconsistently.
8. Existing planner behavior remains functionally unchanged.
9. Backend and frontend test suites pass.
10. Validator script passes unchanged for data constraints.

## 10. Risks and Mitigations
1. ID mismatches break event wiring.
   1. Mitigation: enforce ID-preservation checklist before merge.
2. Form behavior regresses after moving controls.
   1. Mitigation: explicit session and submit integration tests.
3. Duplicate progress rendering causes conflicting numbers.
   1. Mitigation: center panel is canonical full-progress view; right panel is summary-only.
4. Can-take overload on `/recommend`.
   1. Mitigation: dedicated `/can-take` endpoint.

## 11. Rollout Strategy
1. Phase 1/2 merged behind branch-level QA.
2. Phase 3/4 with endpoint and interaction wiring.
3. Phase 5/6 visual polish and breakpoint tuning.
4. Phase 7 test hardening and docs.
5. Merge only after full green CI and manual UX checklist.

## 12. Manual QA Checklist
1. Full input flow from blank state to recommendations.
2. Session restore with majors, track, course chips, and right-panel settings.
3. Can-take inline checks without page jump.
4. Warning strip visibility and readability.
5. Progress totals consistency between summary and detailed cards.
6. Keyboard-only navigation and focus ring visibility.
7. Tablet breakpoint behavior near `1100px`.

## 13. Assumptions and Defaults
1. Desktop/tablet optimization is prioritized over mobile polish.
2. Current backend prerequisite/recommendation logic is retained.
3. Existing IDs are immutable for compatibility.
4. No third-party chart library is added.
5. `/can-take` is additive and does not replace `/recommend`.
