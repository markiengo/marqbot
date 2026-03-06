# Recommendation Algorithm
Last updated: March 6, 2026
Status: `current behavior (simplified ranking)`

## How it works (student explanation)
"We recommend the courses that close your highest-priority unmet requirements soonest, while avoiding risky picks."

## Pipeline
1. Validate program selection and major/track pairing rules.
2. Build requirement buckets and allocate completed/in-progress courses.
3. Build eligible candidates:
   - not already completed/in-progress
   - prereqs satisfied, or mark as `manual_review`
   - suppress non-recommendable courses (internship/work period/independent study/topics/`4986`)
4. Rank candidates deterministically with this tuple order:
   - `tier` (1=MCC/BCC_REQUIRED, 2=major, 3=track/minor, 5=demoted BCC children)
   - core-prereq blocker (0=yes, 1=no)
   - bridge-course status (0=direct filler, 1=bridge-only)
   - course level (lower first)
   - unlock chain depth (deeper first)
   - `multi_bucket_score` (higher first)
   - `course_code` (lexical tiebreak)
5. Select greedily with:
   - bucket cap (`2`) with auto-relaxation
   - program-balance deferral (threshold `2`)
   - bridge-target guard
   - rescue pass when no picks are produced
6. Return recommendations, progress/projection, warnings, and optional debug trace.

## Summer special cases
- Summer excludes low-confidence courses.
- Summer caps recommendations at 4.

## Standing recovery
When all remaining required courses are blocked by `min_standing`, the engine recommends filler courses that build credits toward the blocked standing threshold.

## Credit parsing for standing
- Standing projection uses parsed course credits from catalog data.
- Decimal credits are preserved (for example, `1.5`).
- Credit ranges use the lower bound for projection (for example, `1-3` is treated as `1.0`).

## Invariants
- Deterministic ordering for identical inputs.
- No recommendation for already completed/in-progress courses.
- `manual_review` is surfaced explicitly in output.

## Debug trace fields
When `debug=true`, each ranked candidate includes:
- `rank`, `course_code`, `course_name`
- `selected`, `skip_reason`
- `tier`, `is_core_prereq_blocker`, `is_bridge_course`
- `course_level`, `chain_depth`, `multi_bucket_score`
- `fills_buckets`, `selection_buckets`, `bridge_target_buckets`
- `bucket_capacity`

Note: `chain_depth` in debug is sourced from the same chain-depth map used by ranking.
