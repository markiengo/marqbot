# Frontend Technical README

## What this folder is

This is the student-facing app.

It owns the pages, planner shell, onboarding flow, saved-plan UI, about page, and the in-app feedback modal.

## What it does

- renders the marketing and planner pages
- lets students declare majors, tracks, minors, and courses
- stores session state and saved plans in browser localStorage
- calls backend APIs for recommendations, can-take checks, prereq validation, and feedback
- shows results with shared planner cards and modal views

## Main parts

- `src/app`
  Route entrypoints for landing, onboarding, planner, saved, courses, AI advisor, and about.

- `src/components`
  Shared UI plus planner, saved-plan, landing, and about-page components.

- `src/hooks`
  Data loading and mutation hooks (`useRecommendations`, `useSavedPlans`, `useSession`, etc.).

- `src/context`
  Shared app state and reducer logic.

- `src/lib`
  Shared types, API helpers, rendering helpers, feedback payload builders, and saved-plan utilities.

- `public`
  Static images and exported assets.

## Good places to start

- `src/app/planner/page.tsx`
  Main planner route.

- `src/components/planner/PlannerLayout.tsx`
  Planner shell and modal orchestration.

- `src/components/planner/FeedbackModal.tsx`
  In-app feedback entrypoint.

- `src/lib/api.ts`
  Frontend-to-backend API connection layer.

## Simple mental model

The frontend collects student inputs, keeps the current planner state in the browser, and renders whatever the backend decides.

## Notes

- Production uses static export compatibility, so do not assume a custom Next server.
- Saved plans are browser-local only right now.
