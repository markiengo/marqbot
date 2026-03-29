---
phase: 01-landing-page-redesign
plan: 04
subsystem: testing
tags: [react, nextjs, vitest, landing, accessibility]
requires:
  - phase: 01-landing-page-redesign
    provides: Hero, spotlight, proof, and lower-section landing rebuild
provides:
  - Shared reduced-effects hook and landing fallbacks
  - Landing DOM coverage and build validation
affects: [homepage, landing-page, test-suite, reduced-effects]
tech-stack:
  added: []
  patterns: [Shared reduced-effects hook, TSX test discovery in Vitest, landing-specific fallback selectors]
key-files:
  created:
    - frontend/src/hooks/useReducedEffects.ts
    - frontend/tests/landingPage.dom.test.tsx
  modified:
    - frontend/src/components/landing/LandingHeroSimple.tsx
    - frontend/src/components/landing/BenefitsSection.tsx
    - frontend/src/components/landing/ProofSection.tsx
    - frontend/src/app/globals.css
    - frontend/tests/effectsMode.test.ts
    - frontend/vitest.config.ts
    - frontend/src/components/onboarding/CourseHistoryImport.tsx
key-decisions:
  - "Centralize reduced-effects logic in one hook instead of rebuilding effects state inside each landing section."
  - "Support TSX tests in Vitest so the planned landing DOM artifact can stay named as designed."
patterns-established:
  - "Landing sections expose stable test ids and data-reduced-motion markers for simplified-mode assertions."
requirements-completed: [PERF-01, PERF-02, PERF-03]
duration: 23 min
completed: 2026-03-29
---

# Phase 1 Plan 04: Harden Fallbacks, Tests, and Performance Summary

**The landing redesign now has a shared reduced-effects signal, explicit mobile fallbacks, DOM coverage for ordering and simplified mode, and a passing production build.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-03-29T06:29:00Z
- **Completed:** 2026-03-29T06:52:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `useReducedEffects` and wired hero, spotlight, and proof sections to simplified rendering paths.
- Added landing-specific mobile clamps and reduced-effects CSS fallbacks in `globals.css`.
- Added landing DOM tests plus landing-specific reduced-effects coverage and finished with green targeted lint, Vitest, and Next build checks.

## Task Commits

Inline execution was done in the current dirty worktree, so task-level commit hashes were not recorded during this run.

1. **Task 1: Add a shared reduced-effects helper and wire the landing sections to it** - inline worktree change
2. **Task 2: Add CSS fallbacks and explicit mobile clamps for the landing shell** - inline worktree change
3. **Task 3: Add homepage DOM coverage and finish verification** - inline worktree change

## Files Created/Modified

- `frontend/src/hooks/useReducedEffects.ts` - Combines motion preference, `data-effects-mode`, and `localStorage` into one landing-safe hook.
- `frontend/src/components/landing/LandingHeroSimple.tsx` - Exposes stable test ids and reduced-effects behavior in the hero.
- `frontend/src/components/landing/BenefitsSection.tsx` - Collapses the desktop spotlight into a simpler stacked layout when effects are reduced.
- `frontend/src/components/landing/ProofSection.tsx` - Simplifies decorative proof framing when effects are reduced.
- `frontend/src/app/globals.css` - Adds mobile clamps and reduced-effects landing fallbacks.
- `frontend/tests/effectsMode.test.ts` - Covers the shared reduced-effects hook and landing override behavior.
- `frontend/tests/landingPage.dom.test.tsx` - Covers landing section order and reduced-effects DOM markers.
- `frontend/vitest.config.ts` - Adds TSX test discovery so the landing DOM test is collected under its planned filename.

## Decisions Made

- Used `useSyncExternalStore` in `useReducedEffects` so DOM dataset changes, storage updates, and motion preferences share one stable subscription model.
- Kept reduced-effects assertions at the DOM-contract level instead of snapshotting visuals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Expand Vitest discovery to include TSX test files**
- **Found during:** Task 3 (Add homepage DOM coverage and finish verification)
- **Issue:** The planned artifact name `landingPage.dom.test.tsx` was being skipped because the existing Vitest config only included `*.test.ts`.
- **Fix:** Added `./tests/**/*.test.tsx` to `frontend/vitest.config.ts` and kept the landing DOM test at the planned `.tsx` path.
- **Files modified:** `frontend/vitest.config.ts`, `frontend/tests/landingPage.dom.test.tsx`
- **Verification:** `npm run test -- landingPage.dom.test.tsx effectsMode.test.ts` exited 0.

**2. [Rule 3 - Blocking] Restore the missing `next/image` import required for production build**
- **Found during:** Task 3 (Add homepage DOM coverage and finish verification)
- **Issue:** `CourseHistoryImport.tsx` still rendered `<Image />` after an unrelated dirty worktree edit had removed the import, which blocked `next build`.
- **Fix:** Re-added `import Image from "next/image";` without altering the surrounding onboarding refactor.
- **Files modified:** `frontend/src/components/onboarding/CourseHistoryImport.tsx`
- **Verification:** `npm run build` exited 0.

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both changes were required to satisfy the planned verification path without changing landing scope.

## Issues Encountered

- Repo-wide `npm run lint` still fails on pre-existing unrelated files in onboarding and planner components. Landing-owned files lint clean, but the global lint baseline is not yet clean enough to satisfy the original all-repo lint command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Implementation is ready for human browser verification of viewport hierarchy, scroll feel, and mobile/reduced-effects presentation.
- After approval, Phase 1 can be marked complete and the milestone can move to closeout or the next UI phase.

---
*Phase: 01-landing-page-redesign*
*Completed: 2026-03-29*
