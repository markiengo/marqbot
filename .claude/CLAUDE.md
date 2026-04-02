# MarqBot — Claude Code Configuration

## Behavioral Rules (Always Enforced)
- Always read CHANGELOG.md to understand past changes before planning new codes 
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- NEVER save working files, text/mds, or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- When choosing among personal commands, Claude Flow commands, agents, or skills, consult `.claude/commands/personal/skills_manager.md` first.
- Repo-local skills live at `.claude/skills/<function>/<skill-name>.md`.

## Project Layout

| Directory | Purpose |
|-----------|---------|
| `backend/` | Flask API, planner engine, eligibility logic |
| `frontend/` | Next.js student UI |
| `data/` | CSV course catalog — **manual edits only, never auto-modified** |
| `config/` | Ranking overrides |
| `scripts/` | Data utilities |
| `tests/` | Pytest backend tests, frontend Jest tests |
| `docs/` | Memos, changelogs, prompts |

- NEVER save to the root folder
- Do not touch `data/` CSVs or bulletin data programmatically

## Build & Test

```bash
# Backend tests (non-nightly)
.venv/Scripts/python.exe -m pytest tests/backend -m "not nightly" -q

# Fast dead-end guardrail
.venv/Scripts/python.exe -m pytest tests/backend/test_dead_end_fast.py -m "not nightly" -q

# Frontend
cd frontend && npm test
```

- ALWAYS run the relevant tests after making code changes
- Backend uses `.venv` — activate before running Python commands

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER commit `.env` files or any file containing secrets
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal
- Dependency installs must use `npm` with `--ignore-scripts`
- New direct npm dependencies must be pinned exactly with `name@x.y.z` and `--save-exact`
- If a package genuinely needs lifecycle scripts, install it safely first and then use explicit `npm rebuild <pkg>` only for the approved set: `esbuild`, `sharp`, `tesseract.js`, `unrs-resolver`
- Do not use `yarn` or `pnpm` in this repo

## Parallelism

- Batch all independent file reads/writes/edits in one message
- Batch all independent Bash commands in one message

## Multi-Instance / Parallel Sessions

- Each Claude Code instance MUST operate in its own git worktree — never share the main working tree between concurrent sessions.
- Before starting work in a new session alongside another active instance, confirm isolation: `git worktree list`. If not isolated, create one: `git worktree add ../marqbot-<task> -b <branch>`.
- Never edit files in the main worktree while another instance may be active there.

## Push Rules

- Do not push `main` without explicit user confirmation.
- Keep local-only agent files under `.claude/`.

## Session-End Rules

- Use `.claude/commands/personal/session_end.md` for closeout.
- If planner or ranking logic changed, run `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q`.

## Data Workflow

- `config/ranking_overrides.json` holds manual priority overrides applied during ranking. Edit it directly when course/bucket ordering needs adjustment.
- CSV fixes and bulletin checks stay manual.
