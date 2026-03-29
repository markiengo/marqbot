---
phase: 01-landing-page-redesign
plan: 01
subsystem: ui
tags: [react, nextjs, tailwind, landing, hero]
requires: []
provides:
  - Full-stage landing hero with centered product scene
  - Hero shell utility classes and scroll cue styling
affects: [homepage, landing-page, onboarding-entry]
tech-stack:
  added: []
  patterns: [Centered stage-first hero composition, landing-prefixed global utilities]
key-files:
  created: []
  modified:
    - frontend/src/components/landing/LandingHeroSimple.tsx
    - frontend/src/app/globals.css
key-decisions:
  - "Use one centered hero stack so the mockup, CTA row, and continuation cue read as a single opening stage."
patterns-established:
  - "Landing-specific shell styles live in globals.css under explicit landing- prefixes."
requirements-completed: [HERO-01, HERO-02, HERO-03, HERO-04, SYS-01]
duration: 12 min
completed: 2026-03-29
---

# Phase 1 Plan 01: Recompose the Hero Stage and Centered Mockup Summary

**A full-stage hero now centers the MarqBot mockup, keeps the primary CTA in-view, and hands off into section two with an explicit scroll cue.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-29T05:52:14Z
- **Completed:** 2026-03-29T06:04:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rebuilt `LandingHeroSimple` around a single vertically centered stage with the badge, headline, compact support copy, CTA row, mockup, and scroll cue.
- Replaced the split hero composition with a dominant planner shell and companion chips that keep the mockup as the focal object.
- Added reusable landing hero utility classes in `globals.css` for the shell, ambient layer, grid, and cue styling.

## Task Commits

Inline execution was done in the current dirty worktree, so task-level commit hashes were not recorded during this run.

1. **Task 1: Rebuild the hero layout around one centered stage** - inline worktree change
2. **Task 2: Build the centered hybrid mockup and hero shell** - inline worktree change

## Files Created/Modified

- `frontend/src/components/landing/LandingHeroSimple.tsx` - Rebuilt the hero composition and CTA flow around a centered product stage.
- `frontend/src/app/globals.css` - Added hero shell utilities and scroll cue styling for the new landing stage.

## Decisions Made

- Kept the first-screen copy compact so the visual hierarchy stays with the mockup and CTA row.
- Used gradients, borders, and shadow depth instead of live blur to stay inside the repo's performance style.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for the section-two spotlight handoff work in `01-02`.
- Hero section now exposes the `#feature-spotlight` anchor expected by the next plan.

---
*Phase: 01-landing-page-redesign*
*Completed: 2026-03-29*
