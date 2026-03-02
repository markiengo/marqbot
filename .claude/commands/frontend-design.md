# MarqBot Frontend Design Command

Use this command whenever editing frontend UI/UX for MarqBot.

## Objective
Ship visually strong, readable, and consistent UI updates without breaking planner behavior.

## Non-Negotiable Brand + Style Rules
1. Preserve Marquette-first palette:
   - Primary navy: `#003366`
   - Gold accent for active highlights and section headers
2. Keep high contrast for readability on dark surfaces.
3. Use the existing MarqBot typography rhythm; do not introduce random font systems.
4. Keep panel/card spacing generous and consistent across left/center/right panes.
5. Avoid generic flat boilerplate visuals; retain depth (glass/panel layering) while preserving legibility.

## Interaction Rules
1. Never break existing element IDs used by `frontend/app.js`.
2. Top-nav active state must persist after click.
3. Navigation animation scope:
   - Animate only top-nav indicator transitions.
   - Do not shift planner panes/content when changing tabs.
4. Track input must stay disabled until at least one major is selected.
5. Keep keyboard and focus-visible behavior intact.

## Content + Label Rules
1. Use user-facing major names in dropdowns; do not expose internal IDs.
2. Keep bucket labels concise and consistent in casing/abbreviations.
3. Warning copy should be concise and explicit ("Warning", not "Schedule note").
4. Maintain consistent badge sizing/alignment across recommendation cards.

## Progress Visualization Rules
1. Completed = green.
2. In-progress = yellow.
3. Remaining = neutral.
4. Donut and horizontal bars must follow the same color semantics.
5. Percentages must be based on requirement totals, capped at 100%.

## Safety + Regression Checklist
Before finishing, run:
1. `cmd /c npm test --silent`
2. `python -m pytest -q`
3. `python scripts/validate_track.py --all`

Verify manually:
1. Top nav tabs and active indicator.
2. Major search, track gating, and chip interactions.
3. Plan screen render + placeholder screens render.
4. Degree progress colors/percentages.
5. Recommendation cards (warnings, badges, labels).

## Output Expectations
1. Explain what changed and why.
2. List files touched.
3. Mention any residual risks.
4. Suggest next UI refinements only if they naturally follow.
