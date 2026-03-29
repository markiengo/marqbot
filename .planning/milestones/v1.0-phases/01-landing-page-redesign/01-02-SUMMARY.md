---
phase: 01-landing-page-redesign
plan: 02
subsystem: ui
tags: [react, nextjs, tailwind, landing, scroll]
requires:
  - phase: 01-landing-page-redesign
    provides: Hero stage anchor and shell styling
provides:
  - Spotlight-style feature stage with one active benefit at a time
  - Handoff seam and spotlight utility classes
affects: [homepage, landing-page, feature-story]
tech-stack:
  added: []
  patterns: [Sticky spotlight with scroll-activated rail, spotlight utility classes in globals.css]
key-files:
  created: []
  modified:
    - frontend/src/components/landing/BenefitsSection.tsx
    - frontend/src/app/globals.css
key-decisions:
  - "Concentrate the dramatic motion in section two and keep lower sections calmer."
patterns-established:
  - "Desktop spotlight behavior falls back to a stacked layout when reduced effects are active."
requirements-completed: [FLOW-01, FLOW-02, FLOW-03, FEAT-01, FEAT-02]
duration: 14 min
completed: 2026-03-29
---

# Phase 1 Plan 02: Build the Hero Handoff and Spotlight Feature Stage Summary

**Section two now acts as a spotlight handoff, with a sticky feature rail that promotes one dominant MarqBot benefit at a time.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-29T06:04:00Z
- **Completed:** 2026-03-29T06:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rebuilt `BenefitsSection` as `<section id="feature-spotlight">` with a sticky spotlight pane and a scroll rail that advances `activeIndex`.
- Added seam, rail, chip, and shell utilities in `globals.css` to make the hero-to-spotlight transition deliberate.
- Preserved a simpler stacked layout for reduced-effects and smaller screens instead of forcing the sticky scene everywhere.

## Task Commits

Inline execution was done in the current dirty worktree, so task-level commit hashes were not recorded during this run.

1. **Task 1: Rewrite section two as a spotlight stage with one active benefit** - inline worktree change
2. **Task 2: Add the handoff seam and spotlight utility classes** - inline worktree change

## Files Created/Modified

- `frontend/src/components/landing/BenefitsSection.tsx` - Added spotlight-stage storytelling, `useInView` activation, and reduced-effects fallback behavior.
- `frontend/src/app/globals.css` - Added spotlight seam, rail, step, chip, and shell utility classes.

## Decisions Made

- Used one sticky spotlight instead of multiple pinned scenes to keep the scroll moment memorable without creating pagewide motion noise.
- Kept the mobile experience narrative-equivalent but non-sticky to avoid fragile small-screen choreography.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for proof reinsertion and lower-section retuning in `01-03`.
- Section ordering and the spotlight anchor are now stable for DOM verification.

---
*Phase: 01-landing-page-redesign*
*Completed: 2026-03-29*
