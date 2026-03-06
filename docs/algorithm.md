# Recommendation Algorithm
Last updated: March 6, 2026
Status: `current behavior (parent/child + split prereq model)`

## Student Explanation
"We recommend the courses that close your highest-priority unmet requirements soonest, while avoiding risky picks."

## Data Inputs
| Area | Files | Purpose |
|------|-------|---------|
| Catalog | `courses.csv` | Base course catalog, credits, level, description, and `elective_pool_tag`. |
| Program graph | `parent_buckets.csv`, `child_buckets.csv`, `master_bucket_courses.csv` | Defines majors, tracks, minors, universal requirements, child buckets, explicit course membership, and overlap governance. |
| Prereqs | `course_hard_prereqs.csv`, `course_soft_prereqs.csv` | Splits eligibility gates from warning-only or manual-review metadata. |
| Offerings | `course_offerings.csv` | Fall/spring/summer scheduling confidence used by recommendation filtering. |

## Runtime Build
1. Load `courses.csv` as the base catalog.
2. Build the parent/child requirement graph from `parent_buckets.csv`, `child_buckets.csv`, and `master_bucket_courses.csv`.
3. Overlay `course_hard_prereqs.csv` onto the catalog as runtime eligibility fields:
   - `prereq_hard`
   - `prereq_concurrent`
   - `prereq_level`
4. Overlay `course_soft_prereqs.csv` onto the catalog as warning and audit fields:
   - `prereq_soft`
   - `prereq_notes`
   - raw `soft_prereq_*` detail columns
5. Overlay `course_offerings.csv` onto the catalog.
6. Synthesize dynamic elective mappings from `courses.elective_pool_tag` only for elective-like `credits_pool` child buckets. Current dynamic tag: `biz_elective`.
7. Convert the loaded data into runtime bucket and course maps used by allocation, eligibility, and ranking.

## Parent-Child Bucket Mapping
- A `parent_bucket` is the program envelope: major, track, minor, or universal requirement group.
- A `child_bucket` is a single requirement inside that parent.
- `master_bucket_courses` holds explicit course-to-child membership.
- Progress is allocated at the child-bucket level, then rolled up to the parent.
- Tracks are gated by `parent_major` and `required_major`.
- Dynamic elective synthesis supplements explicit mappings at load time; it does not replace `master_bucket_courses`.
- Dynamic synthesis is intentionally narrow: only tagged catalog courses are added, and only into qualifying `credits_pool` buckets.

## Prerequisite System
### Hard inputs used by eligibility
- `hard_prereq`: parseable course-to-course prerequisites only.
- `concurrent_with`: courses that must or may be taken in the same term.
- `min_standing`: standing gate (`1.0=freshman`, `2.0=sophomore`, `3.0=junior`, `4.0=senior`).

### Soft inputs used by warnings and manual review
- `soft_prereq`: machine tags.
- `soft_prereq_*`: raw catalog snippets by category.
- `catalog_prereq_raw`: full bulletin prerequisite line.
- `notes`: overflow or human-readable audit context.

### Excluded from `hard_prereq` on purpose
These clauses may mention course codes, but they are not hard prerequisite graph edges:
- `Cross-listed with ...`
- `Credit is not given for both ...`
- `Cannot receive credit for both ...`
- `A maximum of ... credits ... can count toward the major`
- `previous or subsequent enrollment in ...`
- `not eligible to enroll ...`
- instructor consent, major restriction, program admission, placement, GPA, and minimum-grade clauses

These are kept only in soft detail fields or notes.

### Concurrent nuance
- `which may be taken concurrently` means the course is still a prerequisite, but it may be in progress. That code can appear in both `hard_prereq` and `concurrent_with`.
- `taken concurrently with ...`, `must be taken concurrent with ...`, `concurrent enrollment with ...`, and `both of which must be taken concurrently` are treated as co-req-only phrasing. Those codes go to `concurrent_with`, not `hard_prereq`.

### Manual review
If the bulletin prerequisite logic cannot be encoded safely into the supported parser grammar, the course keeps `hard_prereq=none`, gets the `complex_hard_prereq` soft tag, and is surfaced as `manual_review` in eligibility output.

## Pipeline
1. Validate program selection and major/track pairing rules.
2. Build the active parent/child requirement set and allocate completed or in-progress courses.
3. Build eligible candidates:
   - not already completed or in progress
   - hard prereqs and standing satisfied
   - co-req-compatible
   - otherwise surfaced as `manual_review` when the row is intentionally not auto-decodable
4. Suppress non-recommendable courses (see exclusions below).
5. Rank candidates deterministically with this tuple order:
   - `tier` (`1=MCC/BCC_REQUIRED`, `2=major`, `3=track/minor`, `5=demoted BCC children`)
   - core-prereq blocker (`0=yes`, `1=no`)
   - bridge-course status (`0=direct filler`, `1=bridge-only`)
   - course level (lower first)
   - unlock chain depth (deeper first)
   - `multi_bucket_score` (higher first)
   - `course_code` (lexical tiebreak)
6. Select greedily with:
   - bucket cap (`2`) with auto-relaxation
   - program-balance deferral (threshold `2`)
   - bridge-target guard
   - rescue pass when no picks are produced
7. Return recommendations, progress/projection, warnings, and optional debug trace.

## Currently Excluded From Recommendations
The engine does not recommend courses when either of these is true:
- course code contains `4986` (work-period grading courses)
- course credits include any non-integer numeric values (for example, `1.5` or `1.5-3`)
- course name contains one of:
  - `internship`
  - `work period`
  - `independent study`
  - `topics in`

These courses still count toward progress if they are already completed or in progress.

## Summer Special Cases
- Summer excludes low-confidence courses.
- Summer caps recommendations at 4.

## Standing Recovery
When all remaining required courses are blocked by `min_standing`, the engine recommends filler courses that build credits toward the blocked standing threshold.

## Credit Parsing For Standing
- Standing projection uses parsed catalog credits.
- Decimal credits are preserved (for example, `1.5`).
- Credit ranges use the lower bound for projection (for example, `1-3` is treated as `1.0`).

## Invariants
- Deterministic ordering for identical inputs.
- No recommendation for already completed or in-progress courses.
- No note-only or co-req-only course codes leak into the hard prerequisite graph.
- `manual_review` is surfaced explicitly in output.

## Debug Trace Fields
When `debug=true`, each ranked candidate includes:
- `rank`, `course_code`, `course_name`
- `selected`, `skip_reason`
- `tier`, `is_core_prereq_blocker`, `is_bridge_course`
- `course_level`, `chain_depth`, `multi_bucket_score`
- `fills_buckets`, `selection_buckets`, `bridge_target_buckets`
- `bucket_capacity`

Note: `chain_depth` in debug is sourced from the same chain-depth map used by ranking.
