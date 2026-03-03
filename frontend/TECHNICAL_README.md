# Frontend Technical README

## What this folder is

This is the part of the app students can see.

It controls the pages, buttons, forms, cards, and planner screens.

## What it does

- shows the website pages
- lets students enter majors and courses
- asks the backend for recommendations
- shows the results in a clear way

## Main parts

- `src/app`
  The pages of the site.

- `src/components`
  Reusable pieces like buttons, modals, and planner panels.

- `src/hooks`
  Behind-the-scenes loading logic.

- `src/context`
  Shared app memory.

- `src/lib`
  Helper files and API calls.

- `public`
  Images and static files.

## Good places to start

- `src/app/page.tsx`
  Landing page.

- `src/app/onboarding/page.tsx`
  Student setup flow.

- `src/app/planner/page.tsx`
  Main planner page.

- `src/lib/api.ts`
  Frontend to backend connection.

## Simple mental model

The frontend is the part you touch.

It mostly asks the backend for answers, then shows them to the student.

## Common commands

- `npm run dev`
  Start the frontend.

- `npm run build`
  Build the frontend.

- `npm run test`
  Run frontend tests.
