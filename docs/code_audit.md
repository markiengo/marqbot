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

## 2) Severity order
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

## 3) MarqBot hotspots
Check these areas first.

### Backend
- `backend/server.py`
  - routes, validation, caching, shared globals, reload logic
- `backend/semester_recommender.py`
  - ranking, dead-end handling, filler logic, bucket satisfaction
- `backend/eligibility.py`
  - prereqs, standing checks, offering filters
- `backend/allocator.py`
  - bucket assignment and double-count behavior
- `backend/validators.py`
  - contradictions, cycles, ambiguous input
- `backend/prereq_parser.py`
  - OR/AND parsing edge cases

### Frontend
- `frontend/src/hooks/`
  - async fetch state, stale responses, duplicate requests, error resets
- `frontend/src/lib/api.ts`
  - payload shape and backend contract drift
- `frontend/src/lib/types.ts`
  - type mismatches that hide bugs
- planner UI and context/reducer flow
  - onboarding, modal data, track selection, recommendation rendering

### Data
- `data/course_prereqs.csv`
- `data/child_buckets.csv`
- `data/master_bucket_courses.csv`
- `data/double_count_policy.csv`
- `data/quips.csv`

### Workflows and scripts
- `.github/workflows/`
- `scripts/compile_quips.py`
- `scripts/validate_track.py`

## 4) Main questions to ask
### Correctness
- Can this return the wrong recommendation?
- Can this hide a real blocker?
- Can this break for a valid major/track combination?
- Can this fail only in later semesters or edge standing cases?

### Performance
- Is the same expensive work repeated in loops?
- Is data being reparsed or rescanned too often?
- Is frontend making duplicate fetches?
- Is backend doing repeated full-list scans in hot paths?

### Cleanup
- Is this helper duplicated somewhere else?
- Is this branch unreachable?
- Is this script still used?
- Is this comment or doc now lying?

## 5) Evidence rule
Every finding should include:
- severity
- impact
- exact file reference
- why it is real and not just a guess
- what to do next

Good finding format:
- `S1` | `[backend/semester_recommender.py](/abs/path)` | empty semester returned too early | standing gate blocks last requirement and no filler fallback | patch logic + add regression test

## 6) Audit flow
1. Map the path
- figure out the entry point and the full call path

2. Reproduce or trace
- use code search, tests, and local commands before making claims

3. Find the highest-value issue first
- bugs and regressions beat style

4. Patch only if allowed
- keep fixes small
- preserve behavior unless change is explicitly wanted

5. Validate
- run the closest focused tests first
- then run broader checks if needed

## 7) MarqBot validation shortcuts
### Backend logic change
- `python -m pytest tests/backend -q`
- if recommendation logic changed:
  - `python -m pytest tests/backend/test_dead_end_fast.py -q`

### Frontend logic change
- `cd frontend && npm run test`
- `cd frontend && npm run build`

### Quip change
- `python scripts/compile_quips.py`
- `cd frontend && npm test -- --run ../tests/frontend/quips.test.ts`

### Data-model change
- backend tests
- `python scripts/validate_track.py --all`

## 8) Final audit output
Use this order:
- `Findings`
  - severity, file refs, impact, evidence, recommendation
- `Open questions`
- `Applied changes`
  - only if patching was allowed
- `Validation`
  - command and result
- `Residual risks`

## 9) Simple rule
If a note would not matter to a user, a developer, or a test failure, it is probably not a good audit finding.
