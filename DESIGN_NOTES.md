# Design Notes - MarqBot UI Redesign

## Purpose
This document records the implemented UI redesign and a post-implementation review pass against current code behavior.

## What Changed
The UI moved from a single mixed column to a 3-panel dashboard:

- Left panel: guided inputs (majors, track, completed, in-progress, submit)
- Center panel: progress dashboard and recommendation results
- Right panel: quick settings, compact summary, and inline `Can I Take This?`

Top navigation is sticky, section-anchored, and includes a step indicator.

## Implemented Contracts

### ID preservation
Existing functional IDs remain intact so `app.js`, `session.js`, and `multiselect.js` keep working with `getElementById`.

### Standalone can-take
- Enter in `#can-take-input` calls `POST /can-take` via `postCanTake`.
- Inline result renders in `#can-take-result` using `renderCanTakeInlineHtml`.
- Full-form behavior remains backward compatible: submitting with `requested_course` still allows `/recommend` to return `mode: "can_take"`.

### Progress dashboard
After `mode: "recommendations"`:
- ring and KPIs render in center (`#progress-dashboard`)
- compact summary renders in right panel (`#right-summary-content`)
- viewport auto-scrolls to progress

### Warning strip
Recommendation cards now show a persistent inline warning strip when:
- `soft_tags` exist
- or `low_confidence` is true

## Design Tokens
- Brand navy is `#003366` (`--mu-navy`)
- Gold is `#ffcc00` (`--mu-gold`)
- Layout tokens:
  - `--panel-left: 320px`
  - `--panel-right: 280px`
  - `--topbar-height: 52px`

Breakpoints:
- `<=1100px`: right panel hidden
- `<=720px`: single-column stack

## Review Pass (Current)

### Clear
- Component responsibilities by panel are clear.
- Endpoint separation (`/recommend` vs `/can-take`) is clear.
- Progress rendering split (center full detail, right compact summary) is clear.

### Ambiguous
- "Can I Take This?" has two valid entry paths (inline `/can-take` and full-form `/recommend` with `requested_course`). This is intentional for compatibility but should be explicitly communicated in product docs.

### Previously inconsistent with behavior (fixed)
Issue:
- Anchor active state could be unstable because the observer watched all `data-nav-section` blocks, including the always-visible left input section.

Fix applied:
- `setupAnchorNav()` now observes center sections only (`#section-progress`, `#section-recommendations`) and falls back to `#section-input` when neither is in view.
- Active-link state is now deterministic.
- Added section `scroll-margin-top` so sticky topbar does not hide anchor targets.

Why safe:
- Change is frontend-only.
- Does not alter API payloads or response handling.
- Preserves existing IDs and event wiring.

## Non-Goals (This Phase)
- No recommendation algorithm changes
- No workbook/schema migration work
- No mobile-first redesign
- No external chart dependency
