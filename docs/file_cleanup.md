# File Cleanup Playbook (AI-Executable, Zero-Regression)

Goal: reduce repository clutter without changing product behavior.

## Why this format
This playbook is optimized for AI coding agents:
- Clear objective and scope
- Explicit constraints and precedence
- Deterministic workflow
- Required evidence and output schema

## Instruction precedence
1. System/developer instructions in the agent runtime
2. Repository-wide agent instructions (for example `AGENTS.md`)
3. This playbook
4. Task-specific user prompt

If instructions conflict, follow the higher-priority source and report the conflict.

## Required task packet (before agent starts)
Always provide:
- Cleanup scope (exact paths)
- Out-of-scope paths
- Protected paths that require explicit approval
- Validation commands to run
- Whether archiving is allowed and archive target (default: `archive/YYYY-MM-DD_cleanup/`)

If any required item is missing, agent should choose the safest fallback: `keep` + report.

## Non-negotiable safety rules
- Do not delete files unless there is positive evidence they are unused.
- "Unused" must be verified across runtime code, tests, build/CI, docs, and scripts.
- If uncertain, archive or keep. Never guess.
- Keep cleanup changes separate from feature work.
- Never use destructive git commands (`reset --hard`, blanket checkout).
- Keep commits atomic and themed.

## Protected paths (explicit approval required before deletion)
- `docs/`
- `mds/`
- `.claude/`
- `todo.md`
- `marquette_courses_full.xlsx`
- Infra/deploy files (`render.yaml`, Dockerfiles, CI workflows)

## Safe local artifacts
Generated artifacts that are generally safe to remove locally:
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

## Hygiene baseline
Ensure `.gitignore` includes:
- `.pytest_cache/`
- `**/__pycache__/`
- `.next/`
- `out/`
- `dist/`
- `build/`
- `coverage/`
- `.env*` (if project policy allows)

## Execution workflow (required)
1. Preflight (no edits)
- Capture branch and working tree status.
- Inventory top-level folders and candidate files only.

2. Reference verification
- For each candidate, run repo-wide `rg` checks for:
  - imports/usages in app/runtime code
  - test references
  - build/CI references
  - docs and scripts references
- Record exact search patterns used.

3. Decisioning
- `delete_safe_now`: strong evidence of non-use
- `archive_review`: uncertain, low confidence, or operational ambiguity
- `keep`: referenced or operationally relevant

4. Small-batch execution
- Apply only `delete_safe_now`.
- Move uncertain files to archive only if allowed.
- Re-check working tree after each batch.

5. Validation
- Run approved lint/build/tests.
- Verify no config/runtime regressions.

6. Report
- Produce required output schema (below).
- Include open risks and next actions.

## Evidence standard (required per candidate)
No evidence means no deletion. For each file/path, include:
- Search terms used
- Areas checked (runtime/tests/CI/docs/scripts)
- Why false positives were ruled out
- Final decision (`delete_safe_now`, `archive_review`, `keep`)

## Required output schema
- `Deleted files`
  - `<path>` | reason | proof summary
- `Archived files`
  - `<path>` | reason | uncertainty note
- `Kept files`
  - `<path>` | reason
- `Validation run`
  - command | result
- `Risks / follow-ups`
  - unresolved risk | required manual check

## Iterative prompting pattern
For large cleanups, run in phases:
1. "List candidates only. No edits."
2. "Build delete/archive/keep matrix with evidence."
3. "Apply only delete_safe_now."
4. "Run validation and output report schema."

## Ready-to-paste prompt template
```text
<role>
You are a senior software engineer performing safe repository cleanup with zero functional regressions.
</role>

<objective>
Reduce repository clutter while preserving all behavior.
</objective>

<scope>
In scope: [paths]
Out of scope: [paths]
Protected paths: docs/, mds/, .claude/, todo.md, marquette_courses_full.xlsx, infra/deploy files
</scope>

<constraints>
- Only delete when evidence proves non-use.
- Verify references in runtime code, tests, build/CI, docs, and scripts.
- If uncertain, archive_review (or keep if archive is disallowed).
- Do not mix cleanup with feature changes.
- Use non-destructive git operations only.
</constraints>

<process>
1) Inventory candidates (no edits).
2) Verify references per candidate with repo-wide searches.
3) Classify into delete_safe_now / archive_review / keep.
4) Apply only delete_safe_now.
5) Run validation commands and summarize outcomes.
</process>

<output_format>
- Deleted files: path | reason | proof summary
- Archived files: path | reason | uncertainty
- Kept files: path | reason
- Validation run: command | result
- Risks/follow-ups
</output_format>
```
