# Recommendation Algorithm
Last updated: March 5, 2026
Status: `current behavior + proposed simplification plan (not implemented yet)`

## Review findings (current system)
1. The current flow is deterministic, but hard to reason about because ranking and selection are split across many tie-breakers and deferred passes.
2. `Term offering is warning-only` is true in general, but summer is a hard special case:
   - summer excludes low-confidence courses
   - summer caps recommendations at 4
3. The behavior is powerful, but the mental model for students is not simple enough to explain in one sentence.

## Current behavior (as implemented)
1. Validate program selection and major/track pairing rules.
2. Build requirement buckets and allocate completed/in-progress courses.
3. Build eligible candidates:
   - not already completed/in-progress
   - prereqs satisfied, or mark as `manual_review`
   - suppress non-recommendable courses (internship/work period/independent study/topics/`4986`)
4. Rank candidates deterministically with this tuple order:
   - `tier`
   - accounting-required boost (accounting context only)
   - core-prereq blocker boost
   - bridge-course status
   - unlock chain depth
   - `multi_bucket_score`
   - soft-tag demotion
   - `prereq_level`
   - course level
   - `course_code`
5. Select greedily with:
   - bucket cap (`2`) with auto-relaxation
   - freshman level-balance deferral
   - program-balance deferral (threshold `2`)
   - bridge-target guard
   - rescue pass when no picks are produced
6. Return recommendations, progress/projection, warnings, and optional debug trace.

## Proposed v2 (simpler and more intuitive)
Goal: one explainable rule for students and one compact scoring model for engineers.

### Student-facing explanation
"We recommend the courses that close your highest-priority unmet requirements soonest, while avoiding risky picks."

### v2 pipeline
1. Gate:
   - apply program pairing rules
   - remove taken/in-progress/non-recommendable courses
   - apply prereq + standing checks
   - keep `manual_review` courses in diagnostics only
2. Score each eligible candidate with one numeric score:
   - `need_score`: how important the unmet bucket is
   - `coverage_score`: how many unmet buckets it fills
   - `unlock_score`: does it unlock blocked required courses
   - `readiness_score`: level/standing fit
   - `risk_penalty`: low confidence, complex soft tags
3. Sort by `total_score desc`, then tie-break with:
   - lower course level
   - lexical `course_code`
4. Select top-N with only two constraints:
   - max 2 picks per bucket (single relax step if needed)
   - optional bridge picks only if they still target open unmet buckets

### Proposed v2 score (deterministic)
`total_score = need_score + coverage_score + unlock_score + readiness_score - risk_penalty`

Default component weights:
- `need_score`
  - +100: Tier 1 (`MCC`, `BCC_REQUIRED`)
  - +70: major buckets
  - +50: track/minor buckets
  - +20: demoted BCC children
- `coverage_score`
  - `+15 * min(additional_unmet_buckets, 2)` (max +30)
- `unlock_score`
  - +25 if core-prereq blocker
  - +5 per unlock chain depth, capped at +15
- `readiness_score`
  - +10 if level <= standing-friendly threshold
  - 0 otherwise
- `risk_penalty`
  - +20 if `low_confidence`
  - +10 if complex soft-tag penalty applies

## Invariants to keep
- Deterministic ordering for identical inputs.
- No recommendation for already completed/in-progress courses.
- `manual_review` is surfaced explicitly in output.
- Explainability: each recommendation includes a small score breakdown.

## Git-tracked rollout plan
Use small commits so behavior changes are easy to audit and revert.

1. `docs: simplify algorithm spec and define v2 scoring model`
   - this document update
2. `backend: add feature flag for recommendation_v2`
   - default `false`
3. `backend: implement v2 scorer + score breakdown payload`
   - keep existing output contract stable
4. `tests: add deterministic fixtures for v1 vs v2`
   - snapshot key recommendations + score fields
5. `backend: simplify selection pass under v2`
   - remove multi-pass deferrals where possible
6. `docs: promote v2 to default and archive v1 behavior`

## API/debug tracking additions (for v2)
Add these debug fields so ranking is transparent in git diffs and test snapshots:
- `total_score`
- `need_score`
- `coverage_score`
- `unlock_score`
- `readiness_score`
- `risk_penalty`
- `selected`
- `skip_reason`
