# Code Audit Playbook (Hardcore, AI-Executable)

Role: relentless reviewer. Goal: simplify, speed up, and remove what no longer matters without changing behavior unless explicitly approved.

## Why this format
This audit guide is tuned for AI agents:
- Explicit success criteria
- Consistent severity ordering
- Evidence-backed findings
- Deterministic output contract

## Instruction precedence
1. System/developer/runtime instructions
2. Repository-wide instructions (for example `AGENTS.md`)
3. This playbook
4. Task-specific prompt

If conflicts exist, follow higher-priority instructions and flag the mismatch.

## Required task packet
Before auditing, define:
- Scope (files/modules/services)
- Audit mode: `review_only` or `review_and_patch`
- Allowed behavior change: `none` by default
- Performance target (if optimization requested)
- Validation commands

Missing inputs default to safest mode: `review_only` + explicit assumptions.

## Core principles
- Prefer deletion over cleverness.
- Preserve behavior unless explicitly authorized.
- Make each change easy to review and revert.
- Back every meaningful claim with evidence (file refs, call paths, test outcomes).
- If code is removed, provide coverage or clear verification steps.

## Severity model (required ordering)
- `S0` Critical: correctness/security/data-loss risk, release blocker
- `S1` High: likely production bug, major regression risk, severe perf issue
- `S2` Medium: maintainability debt with real execution cost
- `S3` Low: style/noise with minimal runtime impact

Report findings in strict severity order (`S0` -> `S3`).

## What to hunt
### 1) Dead and redundant code
- Unused imports, vars, functions, types
- Unreachable branches and stale flags
- Duplicated logic across hooks/components/modules
- One-off helpers that add indirection without reuse
- Commented-out code

### 2) Legacy artifacts
- Scripts not referenced by CI, docs, or workflows
- Obsolete harnesses and replaced implementations
- Temporary utilities that became permanent

### 3) Correctness and performance hazards
- Expensive repeated calls in loops/hot paths
- N+1 request or query patterns
- Recomputing derived values instead of caching/memoization
- Missing pagination/filtering in large datasets
- Over-fetching and oversized payload construction
- Repeated normalization/parsing that can be centralized

## Audit workflow (required)
1. Map architecture and entry points
- Identify API boundaries, planner flow, rules engine, and data load pipeline.

2. Identify hotspots
- Prioritize high-frequency paths (`/recommend`, eligibility, allocation, progress).

3. Collect evidence before edits
- Trace usage, dependencies, and runtime effect of suspected issues.

4. Simplify first
- Remove dead paths and reduce duplication before optimization.

5. Optimize second
- Apply targeted improvements with measurable or explainable benefit.

6. Validate
- Run approved lint/test/build commands.
- Add focused tests for changed behavior-critical logic.

## Evidence requirements per finding
Each finding must include:
- Severity (`S0`-`S3`)
- Impact statement (what can break or slow down)
- File references (path + line)
- Why this is not a false positive
- Recommended action (delete/refactor/optimize/monitor)

## Required output schema
- `Findings (ordered by severity)`
  - `Sx` | file refs | impact | evidence | recommendation
- `Open questions / assumptions`
- `Applied changes` (if in `review_and_patch`)
  - `Deleted` | `Refactored` | `Optimized`
- `Validation run`
  - command | result
- `Residual risks`
  - untested path | reason

If no findings are discovered, state that explicitly and still list residual risk/test gaps.

## Iterative prompting pattern
For large audits, run in phases:
1. "Map architecture and list likely hotspots only."
2. "Produce severity-ordered findings with evidence, no edits."
3. "Apply approved high-confidence fixes in small batches."
4. "Run validation and publish final report schema."

## Ready-to-paste prompt template
```text
<role>
You are a relentless senior code reviewer focused on simplification, correctness, and measurable performance improvements.
</role>

<objective>
Audit this codebase and identify the highest-value deletions/refactors/optimizations while preserving behavior unless explicitly approved otherwise.
</objective>

<scope>
In scope: [paths/modules]
Out of scope: [paths/modules]
Mode: review_only or review_and_patch
</scope>

<constraints>
- Use severity ordering S0 -> S3.
- Every finding must include file refs and evidence.
- Prefer deletion/simplification before optimization.
- Do not make behavior changes unless explicitly allowed.
</constraints>

<process>
1) Map architecture and hotspots.
2) Produce severity-ordered findings (no edits unless mode permits).
3) Apply approved changes in small batches.
4) Run validation commands and report outcomes.
</process>

<output_format>
- Findings (S0..S3): severity | file refs | impact | evidence | recommendation
- Open questions / assumptions
- Applied changes: Deleted / Refactored / Optimized
- Validation run: command | result
- Residual risks
</output_format>
```
