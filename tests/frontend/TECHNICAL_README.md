# Frontend Tests Technical README

## What These Tests Cover

Frontend tests protect:
- reducer and state logic
- rendering helpers and presentation formatting
- saved-plan utilities
- component behavior and onboarding flows

## Main Test Groups

- Pure logic/rendering tests
  Examples: `appReducer.test.ts`, `rendering.test.ts`, `savedPlanPresentation.test.ts`, `utils.test.ts`

- Content tests
  Example: `aboutContent.test.ts`

- Component/DOM tests
  Examples: `coursesStep.dom.test.*`, `multiSelect.dom.test.*`, `onboardingPage.dom.test.*`

## Command

Run from `frontend/`:

`npm test`

This is the frontend lane used by the normal regression workflow.

## Important Note

The DOM-focused tests are meant to cover jsdom/component behavior.

If you add or rename `.dom.test.*` files, make sure the Vitest config still includes them. A test file that exists but is not picked up by `npm test` gives false confidence.

## Practical Rule

When changing frontend code:
- run `npm test`
- if the change is UI-flow heavy, confirm the relevant DOM/component tests are actually included by the test runner
