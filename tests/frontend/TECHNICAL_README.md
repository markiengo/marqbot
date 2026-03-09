# Frontend Tests Technical README

## What These Tests Cover

Frontend tests protect:
- reducer and state logic
- rendering helpers and presentation formatting
- saved-plan utilities
- feedback payload building
- component behavior and onboarding flows

## Main Test Groups

- Pure logic/rendering tests
  Examples: `appReducer.test.ts`, `rendering.test.ts`, `savedPlanPresentation.test.ts`, `utils.test.ts`

- Content tests
  Example: `aboutContent.test.ts`

- Feedback/helper tests
  Example: `feedback.test.ts`

- Component/DOM tests
  Examples: `coursesStep.dom.test.*`, `multiSelect.dom.test.*`, `onboardingPage.dom.test.*`

## Command

Run from `frontend/`:

`npm test`

This is the default frontend lane used by the normal regression workflow.

## Important Note

The current Vitest config has two DOM-test buckets:
- `tests/frontend/*.dom.test.ts` is excluded from the default run.
- `frontend/tests/*.dom.test.ts` is included in the default run.

If you add or rename `.dom.test.*` files, make sure the Vitest config and the intended command still match. A DOM test file that exists but is not part of the default run gives false confidence.

## Practical Rule

When changing frontend code:
- run `npm test`
- if the change is UI-flow heavy, confirm whether the relevant DOM/component tests are in the default run or need a focused command
