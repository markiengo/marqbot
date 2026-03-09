# Session End: Real Closeout Checklist

Use this at the end of every coding session.
Keep user-facing writing simple enough for a student to understand.

## 1) Review the session
- Run `git status`.
- Separate changes into:
  - pushable work
  - local-only work
- Never push the `local` branch.

## 2) Update the right docs
### Always consider
- `docs/CHANGELOG.md`
  - Add a new top entry for user-visible changes.
- `README.md`
  - Update if setup, commands, pages, or user workflow changed.
- `data/data_model.md`
  - Update if data shape, buckets, or program modeling changed.
- `.claude/CLAUDE.md`
  - Add important repo rules, user preferences, or decisions from the session.

### Markdown sweep
- Check all `*.md` files for stale paths, commands, workflow names, test guidance, and push rules.
- Update markdown files that act like current instructions or current project docs.
- Do not churn historical records just to modernize wording:
  - leave changelog/history notes alone unless they are being used as current guidance
  - leave planning memos alone unless they now mislead current work

### Important push rule
- `docs/` is pushable now.
- Push the docs that actually changed and are useful to keep in repo history.
- The data model doc lives at `data/data_model.md`, not under `docs/`.

## 3) Regenerate files when needed
- If `data/quips.csv` changed:
  - Run `python scripts/compile_quips.py`
  - Make sure `frontend/src/lib/quipBank.generated.ts` changed too.

## 4) Run checks
Use `tests/test_structure.md` as the source of truth.

Session-end rule:
- run the smallest useful test set for what changed
- do not run the nightly sweep as part of normal closeout

### Backend changes
- Narrow backend fix:
  - Run the closest backend test file.
- Broad backend change or pre-push confidence:
  - Run the closest focused file plus `.\.venv\Scripts\python.exe -m pytest -q`
- If planner or recommendation logic changed:
  - Run `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q`
  - Also run the closest focused backend file.
- Do not run:
  - `.\.venv\Scripts\python.exe -m pytest -m nightly tests/backend/test_dead_end_nightly.py -q`

### Frontend changes
- Frontend helper or narrow UI change:
  - Run the closest frontend test file.
- Broad frontend change or pre-push:
  - `cd frontend; npm run test`
  - `cd frontend; npm run lint`
  - `cd frontend; npm run build`
- Remember:
  - `tests/frontend/*.dom.test.ts` is excluded from the default Vitest run.
  - `frontend/tests/*.dom.test.ts` is included in the default Vitest run.

### Data changes
- Run the closest backend coverage for the changed area.
- If recommendation behavior changed, run the fast dead-end check too.
- If the data change is broad, add `.\.venv\Scripts\python.exe -m pytest -q`.

### Workflow changes
- Read the workflow file carefully for obvious mistakes.
- Do not change or trigger the nightly sweep unless the session was explicitly about that workflow.

## 5) Keep the push clean
- Do not push local/private files such as:
  - `.claude/`
  - `.env`
  - `.venv/`
  - `.pytest_cache/`
  - `frontend/node_modules/`
  - `frontend/.next/`
  - `frontend/out/`
  - `tests/nightly_reports/`
- Docs are not automatically local-only anymore.
- Do not commit secrets or `.env` values.

## 6) Commit
- Commit locally before pushing.
- Commit message rules:
  - 5 to 8 words
  - easy for a normal user to understand
  - should feel like: verb + outcome

Examples:
- `Fix planner standing recovery gap`
- `Add nightly dead-end workflow`
- `Improve onboarding course entry flow`

## 7) Push using repo branch rules
- Normal working branch: `local`
- Remote branch: `main`
- Push flow:
  - move pushable work to `main`
  - leave local-only files behind
  - push `main`
  - merge back into `local` if needed

## 8) Refresh release notes after push
- Keep release notes short.
- Use 3 to 7 bullets.
- Write so a student or advisor could understand it.
- Skip deep technical detail.
- Replace the most recent release notes with the new notes.
- Do not create a brand-new release unless the user explicitly asks for one.

Good release note format:
- Added: user-facing feature
- Fixed: user-facing bug
- Improved: user-facing improvement
- Note: anything users should know

## 9) Final handoff to the user
- Say:
  - what changed
  - what you tested
  - what you did not test
  - any follow-up work or risk
- Keep it short and concrete.
