# File Cleanup Playbook (Safe, Verifiable, Behavior-Preserving)

Goal: reduce repository clutter without changing product behavior.

## Required Role Framing
When using an AI/code agent for cleanup, start with:
- "You are a senior software engineer focused on safe repository cleanup and zero-regression refactors."

This reduces aggressive, low-confidence deletes.

## Non-Negotiable Safety Rules
- Do not delete files unless you can prove they are unused.
- "Proof of unused" must include checks across:
  - Runtime/application code
  - Tests
  - Build tooling and CI configs
  - Documentation and scripts
- If uncertain, archive instead of delete.
- Keep cleanup changes separate from feature work.
- Never use destructive git commands (`reset --hard`, blanket checkout) during cleanup.

## Protected Paths (Require Explicit Approval Before Deletion)
- `docs/`
- `mds/`
- `.claude/`
- `todo.md`
- `marquette_courses_full.xlsx`
- Any infra or deployment files: `render.yaml`, Dockerfiles, CI workflows

## Safe-to-Delete Local Artifacts
These are generated artifacts and safe to remove locally:
- `.pytest_cache/`
- `**/__pycache__/`
- `.DS_Store`
- `.next/`
- `out/`
- `dist/`
- `build/`
- `coverage/`
- `*.log`
- `*.tmp`

## Repository Hygiene Baseline
Ensure `.gitignore` covers:
- `.pytest_cache/`
- `**/__pycache__/`
- `.next/`
- `out/`
- `dist/`
- `build/`
- `coverage/`
- `.env*` (project policy permitting)

## Cleanup Workflow (Do Not Skip Steps)
1. Inventory
- List top-level directories and classify: source, config, docs, generated, backups, experiments.
- Build candidate list only; no deletions yet.

2. Reference Verification
- For each candidate, search repo-wide references with `rg`:
  - Imports/usages in code
  - Mentions in tests
  - Mentions in build/CI
  - Mentions in docs/scripts
- Record evidence per file.

3. Categorize
- `Delete-safe-now`: strong evidence of no references.
- `Archive-review`: uncertain or low-confidence.
- `Keep`: referenced or operationally important.

4. Execute in Small Batches
- Delete only `Delete-safe-now`.
- Move uncertain files to `archive/` (or keep with explicit TODO note).
- Keep commits atomic and themed.

5. Verify
- Run lint/build/tests relevant to touched areas.
- Smoke-test critical flows.
- Confirm no runtime/config regressions.

## Required Evidence Standard Per File
Before deletion, capture:
- Search terms used
- Files scanned (code/tests/CI/docs)
- Why false positives were ruled out
- Final decision (`delete`, `archive`, `keep`)

No evidence means no deletion.

## Output Format for Cleanup PRs
Use this structure:
- `Deleted files`
  - `<path>` - reason + proof summary
- `Archived files`
  - `<path>` - reason + uncertainty note
- `Kept files`
  - `<path>` - reason kept
- `Validation run`
  - Commands executed + outcomes
- `Follow-ups`
  - Open risks, manual checks, or deferred decisions

## Iterative Prompting Pattern (Recommended)
For large cleanup work, split prompts:
1. "List cleanup candidates only; no edits."
2. "Verify references and produce delete/archive/keep matrix with evidence."
3. "Apply only delete-safe-now changes."
4. "Run validation and produce structured report."

## Ready-to-Paste Prompt Template
Use this with Claude/Codex for cleanup tasks:

```text
You are a senior engineer performing safe repository cleanup with zero functional regressions.

Goal: reduce clutter while preserving all behavior.

Rules:
- Only delete a file if you can prove it is unused.
- Verify references in runtime code, tests, build/CI, and docs/scripts.
- If uncertain, archive instead of delete.
- Do not mix cleanup with feature changes.
- Provide evidence per file decision.

Process:
1) Inventory candidates (no edits).
2) Verify references for each candidate.
3) Categorize into delete-safe-now / archive-review / keep.
4) Apply only delete-safe-now changes.
5) Run lint/build/tests and summarize outcomes.

Output:
- Deleted files + justification
- Archived files + justification
- Kept files + reasoning
- Validation commands/results
- Follow-up actions
```
