# Frontend Technical README

## What this folder is

This is the student-facing app.

It owns the pages, planner shell, onboarding flow, saved-plan UI, about page, and the in-app feedback modal.

## What it does

- renders the marketing and planner pages
- lets students declare majors, tracks, minors, and courses
- stores session state and saved plans in browser localStorage
- persists the lightweight planner snapshot separately from the heavier recommendation snapshot so normal planner edits do not keep rewriting full results
- resolves a shared visual-effects mode so the UI can keep full styling on capable machines and fall back to a lighter rendering path on weaker browsers
- calls backend APIs for recommendations, can-take checks, prereq validation, and feedback
- shows results with shared planner cards and modal views

## Main parts

- `src/app`
  Route entrypoints for landing, onboarding, planner, saved, courses, AI advisor, and about.

- `src/components`
  Shared UI plus planner, saved-plan, landing, and about-page components.

- `src/hooks`
  Data loading and mutation hooks (`useRecommendations`, `useSavedPlans`, `useSession`, etc.). `useSession` restores `marqbot_session_v1` plus the dedicated `marqbot_session_recommendation_v1` key.

- `src/context`
  Shared app state and reducer logic. `AppProvider` still sits on one reducer, but it now publishes narrower contexts for catalog data, course history, program selection, preferences, UI state, and recommendation data. `useAppContext()` remains as a compatibility shim for older call sites. `EffectsProvider` resolves `full` vs `reduced` effects, persists the user preference in `marqbot_effects_preference`, and applies root `data-effects-mode` / `data-effects-preference` attributes for shared styling.

- `src/lib`
  Shared types, API helpers, rendering helpers, feedback payload builders, saved-plan utilities, and `programSearch.ts` (major code alias matching for onboarding and profile search).

- `public`
  Static images and exported assets.

## Good places to start

- `src/app/planner/page.tsx`
  Main planner route.

- `src/components/planner/PlannerLayout.tsx`
  Planner shell and modal orchestration.

- `src/hooks/useSession.ts`
  Browser session restore/persist boundary for planner state.

- `src/components/planner/FeedbackModal.tsx`
  In-app feedback entrypoint.

- `src/lib/api.ts`
  Frontend-to-backend API connection layer.

## Simple mental model

The frontend collects student inputs, keeps the current planner state in the browser, and renders whatever the backend decides.

## Notes

- Production uses static export compatibility, so do not assume a custom Next server.
- Saved plans are browser-local only right now.
- Reduced-effects mode is automatic by default. It downgrades on `prefers-reduced-motion`, low hardware hints, or poor frame cadence, and users can override it from planner preferences.
