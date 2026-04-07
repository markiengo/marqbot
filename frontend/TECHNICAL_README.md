# Frontend Technical README

## What this folder is

This is the student-facing app.

It owns the pages, planner shell, onboarding flow, saved-plan UI, about page, and the in-app feedback modal.

## What it does

- renders the marketing and planner pages
- lets students declare majors, tracks, minors, and courses
- stores session state and saved plans in browser localStorage
- persists the lightweight planner snapshot separately from the heavier recommendation snapshot so normal planner edits do not keep rewriting full results
- renders saved-plan detail and print/PDF export views, including credits, prerequisite text, and satisfied-bucket context
- resolves a shared visual-effects mode so the UI keeps full styling by default and falls back to a lighter rendering path only when reduced motion or a manual reduced-effects preference is active
- calls backend APIs for recommendations, can-take checks, prereq validation, and feedback
- shows results with shared planner cards and modal views

## Main parts

- `src/app`
  Route entrypoints for landing, onboarding, planner, saved, courses, AI advisor, and about.

- `src/components`
  Shared UI plus planner, saved-plan, landing, and about-page components.

- `src/hooks`
  Data loading and mutation hooks (`useRecommendations`, `useSavedPlans`, `useSession`, `useReducedEffects`, etc.). `useSession` restores `marqbot_session_v1` plus the dedicated `marqbot_session_recommendation_v1` key.

- `src/context`
  Shared app state and reducer logic. `AppProvider` still sits on one reducer, but it now publishes narrower contexts for catalog data, course history, program selection, preferences, UI state, and recommendation data. `useAppContext()` remains as a compatibility shim for older call sites.

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

- `src/components/shared/EffectsModeManager.tsx`
  Startup effects-mode selection and root DOM flag management.

- `src/hooks/useReducedEffects.ts`
  Lightweight read path for components that need to react to the current effects mode.

## Simple mental model

The frontend collects student inputs, keeps the current planner state in the browser, and renders whatever the backend decides.

## Notes

- Production uses static export compatibility, so do not assume a custom Next server.
- Saved plans are browser-local only right now, but each saved plan can open a print-friendly `/saved?plan=...&export=pdf` view for browser PDF export.
- Reduced-effects mode is resolved by `EffectsModeManager` in the app shell from OS reduced-motion or a manual reduced-effects preference, and components read it through `useReducedEffects`.
- The landing and About shells add the heavier cursor-reactive treatment through `ReactivePageShell` only when full effects stay enabled.
