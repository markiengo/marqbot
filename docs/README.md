# Documentation Index

Use this file to choose the right markdown file instead of scanning the whole repo.

If you are a coding agent, start with `../AGENTS.md` first.

## Fastest Orientation

Read these first:

| File | Why it exists |
|---|---|
| `../AGENTS.md` | Lean repo-wide entrypoint for coding agents and shared doc taxonomy |
| `../README.md` | Product overview, local run commands, deployment contract |
| `codebase/tech_readme.md` | Technical map of runtime, APIs, data, and tests |
| `../tests/test_structure.md` | Quick test-command map |
| `CHANGELOG.md` | Unreleased and shipped behavior changes |

## By Audience

| Audience | Start here |
|---|---|
| Product or planning context | `memos/ogprd.md`, `memos/algorithm.md` |
| Policy or bulletin context | `memos/policies.md` |
| System internals | `codebase/tech_readme.md` |
| Folder-specific implementation | `../backend/TECHNICAL_README.md`, `../frontend/TECHNICAL_README.md` |
| Test strategy | `../tests/test_structure.md`, `codebase/TESTING.md` |
| Deployment | `../infra/README.md` |

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
