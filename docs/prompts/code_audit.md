# Code Audit: Real Review Checklist

Use this when reviewing MarqBot for bugs, slow paths, dead code, or risky design.
Default mode: review first, patch second.

## 1) What a good audit does
A good audit should answer:
- what can break users
- what is slower than it should be
- what code looks dead or duplicated
- what should be fixed now vs later

Do not start with style nitpicks.
Start with real risk.

## 2) Scope and depth
Unless told otherwise, scope the audit to files changed since the last clean commit (`git diff --name-only`).

Three depth levels:
- **Quick** - changed files only. Use when reviewing a single PR or small patch.
- **Standard** - changed files + their direct callers and callees. Default for most audits.
- **Deep** - full hotspot sweep (Section 3). Only on explicit request or before a release.

When running alongside `/simplify`: let simplify handle reuse, quality, and efficiency on the diff. This doc handles correctness, domain risk, and structured reporting. They do not overlap - use both.

## 3) Severity order
Always report findings in this order:
- `S0`
  - release blocker, data-loss, security, or obviously wrong recommendations
- `S1`
  - likely production bug or major regression risk
- `S2`
  - meaningful maintainability or performance issue
- `S3`
  - low-value cleanup or code noise

If there are no findings, say that clearly.

S0 and S1 findings must include a regression test recommendation (new test case or existing test to extend). S2/S3 do not require this.

## 4) MarqBot hotspots
Check these areas first. Listed in priority order - start at the top.

### Backend (high -> low risk)
1. `backend/semester_recommender.py`
   - ranking, dead-end handling, filler logic, bucket satisfaction
2. `backend/server.py`
   - routes, validation, caching, shared globals, reload logic
3. `backend/eligibility.py`
   - prereqs, standing checks, offering filters
4. `backend/allocator.py`
   - bucket assignment and double-count behavior
5. `backend/validators.py`
   - contradictions, cycles, ambiguous input
6. `backend/prereq_parser.py`
   - OR/AND parsing edge cases

### Frontend (high -> low risk)
1. `frontend/src/lib/api.ts`
   - payload shape and backend contract drift
2. `frontend/src/hooks/`
   - async fetch state, stale responses, duplicate requests, error resets
3. `frontend/src/lib/types.ts`
   - type mismatches that hide bugs
4. planner UI and context/reducer flow
   - onboarding, modal data, track selection, recommendation rendering

### Data
- `data/course_hard_prereqs.csv`
- `data/course_soft_prereqs.csv`
- `data/child_buckets.csv`
- `data/master_bucket_courses.csv`
- `data/course_equivalencies.csv`
- `data/quips.csv`

### Workflows and scripts
- `.github/workflows/`
- `scripts/compile_quips.py`
- `scripts/validate_track.py`

## 5) Main questions to ask

### Correctness
- Can this return the wrong recommendation?
- Can this hide a real blocker?
- Can this break for a valid major/track combination?
- Can this fail only in later semesters or edge standing cases?
- Can allocation double-count a course into two buckets that should not share?

### Performance
- Is the same expensive work repeated in loops?
- Is data being reparsed or rescanned too often?
- Is frontend making duplicate fetches?
- Is backend doing repeated full-list scans in hot paths?

### Frontend-specific
- Can this render stale data after a re-fetch or state change?
- Can a modal show incorrect state if opened, closed, and reopened?
- Does this break on mobile viewport or small screen?
- Can a rapid user action (double-click, fast navigation) cause a race condition?

### Cleanup
- Is this helper duplicated somewhere else?
- Is this branch unreachable?
- Is this script still used?
- Is this comment or doc now lying?

## 6) Evidence rule
Every finding should include:
- severity
- impact
- exact file reference
- why it is real and not just a guess
- what to do next (for S0/S1: include test case recommendation)

Good finding format:
- `S1` | `backend/semester_recommender.py:L142` | empty semester returned too early | standing gate blocks last requirement and no filler fallback | patch logic + add regression test in `test_dead_end_fast.py`

## 7) Not a finding
These are not audit findings. Do not report them:
- unused import
- missing type annotation on an internal helper
- comment grammar or spelling
- variable naming preference
- missing docstring on a private function
- code that "could be slightly cleaner" but works correctly and is readable

If it would not matter to a user, a developer debugging a bug, or a failing test, skip it.

## 8) Audit flow
1. **Map the path**
   - figure out the entry point and the full call path

2. **Reproduce or trace**
   - use code search, tests, and local commands before making claims

3. **Find the highest-value issue first**
   - bugs and regressions beat style

4. **Patch only if allowed**
   - keep fixes small
   - preserve behavior unless change is explicitly wanted

5. **Validate**
   - run the closest focused tests first
   - then run broader checks if needed

## 9) MarqBot validation shortcuts

Use `tests/test_structure.md` as the source of truth.

### Backend logic change
- run the closest focused backend file first
- for broad backend confidence:
  - `.\.venv\Scripts\python.exe -m pytest -q`
- if recommendation logic changed:
  - `.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -q`
- keep the nightly sweep separate unless the audit is explicitly release-depth

### Frontend logic change
- narrow frontend change:
  - run the closest focused frontend test file
- broad frontend change:
  - `cd frontend && npm run test`
  - `cd frontend && npm run build`

### Quip change
- `.\.venv\Scripts\python.exe scripts/compile_quips.py`
- `cd frontend && npm test -- --run ../tests/frontend/quips.test.ts`

### Data-model change
- backend tests
- `.\.venv\Scripts\python.exe scripts/validate_track.py --all`

## 10) Final audit output
Use this order:
- **Findings**
  - severity, file refs, impact, evidence, recommendation
  - S0/S1 findings include test case recommendation
- **Open questions**
- **Applied changes**
  - only if patching was allowed
- **Validation**
  - command and result
- **Residual risks**
