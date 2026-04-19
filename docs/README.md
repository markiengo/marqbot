# Documentation Index

Use this file to choose the right markdown file instead of scanning the whole repo.

If you are a coding agent, start with `../AGENTS.md` first.

## Fastest Orientation

Read these first:

| File | Why it exists |
|---|---|
| `../AGENTS.md` | Lean repo-wide entrypoint for coding agents and shared doc taxonomy |
| `../README.md` | Product overview, local run commands, and deployment contract |
| `../tests/test_structure.md` | Quick test-command map |
| `codebase/tech_readme.md` | Technical map of runtime, APIs, data, and tests when you need internals |
| `CHANGELOG.md` | Release history. Read `Unreleased` and the newest relevant release first |

## Default Read Depth

- For startup context, stop after `../AGENTS.md`, `../README.md`, this file, and `../tests/test_structure.md` unless the task clearly needs more.
- Open `codebase/tech_readme.md` for runtime, API, data, or architecture work.
- Open `CHANGELOG.md` only when recent shipped behavior matters. Do not read the full history by default.

## By Audience

| Audience | Start here |
|---|---|
| Product or planning context | `memos/ogprd.md`, `memos/algorithm.md` |
| Policy or bulletin context | `memos/policies.md` |
| System internals | `codebase/tech_readme.md` |
| Folder-specific implementation | `../backend/TECHNICAL_README.md`, `../frontend/TECHNICAL_README.md` |
| Test strategy | `../tests/test_structure.md`, `codebase/TESTING.md` |
| Deployment | `../infra/README.md` |
| Agent-tooling wiring | `../.claude/CLAUDE.md`, `../.codex/CODEX.md` after `../AGENTS.md`, but only when the task is about agent tooling |

## What Lives Where

| Path | Contents |
|---|---|
| `codebase/` | Deep technical references: architecture, structure, stack, conventions, integrations, concerns, testing |
| `memos/` | Long-form product, policy, branding, algorithm, and planning docs |
| `CHANGELOG.md` | Versioned release notes |

## Naming Rules

Use names with clear scope:

- `AGENTS.md`: one repo-wide agent entrypoint.
- `README.md`: human-facing overview for a repo root or major folder.
- `TECHNICAL_README.md`: folder-level engineering guide for a code subtree.
- `CHANGELOG.md`: release history.

Avoid creating generic files like `memory.md`, `context.md`, `notes.md`, or extra root-level `overview.md` files. They make agents search more and understand less. Prefer extending an existing scoped document.

## Heavy Docs

These files are valuable, but they are not default reads:

- `memos/policies.md`
- `memos/course_db.md`
- `../tests/nightly_reports/`

Open them only when the task actually needs policy text, catalog reference dumps, or archived nightly analysis.
