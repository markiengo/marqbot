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
- `docs/PRD.md`
  - Update if product behavior, scope, or user-facing requirements changed.
- `docs/data_model.md`
  - Update if data shape, buckets, or program modeling changed.
- `.claude/CLAUDE.md`
  - Add important repo rules, user preferences, or decisions from the session (local-only, do not push).

### Important push rule
- Inside `docs/`, only push:
  - `docs/CHANGELOG.md`
  - `docs/PRD.md`
  - `docs/data_model.md`
- Keep other docs local-only unless the user clearly asks otherwise.

## 3) Regenerate files when needed
- If `data/quips.csv` changed:
  - Run `python scripts/compile_quips.py`
  - Make sure `frontend/src/lib/quipBank.generated.ts` changed too.

## 4) Run checks
### Backend changes
- Default: `python -m pytest tests/backend -q`
- If planner or recommendation logic changed:
  - Run `python -m pytest tests/backend/test_dead_end_fast.py -q`
- If only one backend area changed:
  - Run the closest focused test file too.

### Frontend changes
- Run:
  - `cd frontend && npm run test`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`

### Data changes
- Run backend tests.
- If recommendation behavior changed, run the fast dead-end sweep too.

### Workflow changes
- Read the workflow file carefully for obvious mistakes.

## 5) Keep the push clean
- Do not push local-only files such as:
  - `.claude/CLAUDE.md`
  - `todo.md`
  - `docs/branding.md`
  - `docs/data_injection_stage1.md`
  - `docs/data_injection_stage2.md`
  - `docs/session_end.md`
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

## 8) Create a release after push
- Keep release notes short.
- Use 3 to 7 bullets.
- Write so a student or advisor could understand it.
- Skip deep technical detail.

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
