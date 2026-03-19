# Policy Mapping Plan

Status: Proposed  
Last updated: 2026-03-18  
Primary research input: `docs/memos/webscrape_policies.md`

## Purpose

Turn the scraped undergraduate policy memo into a structured, reviewable, eventually runtime-consumable policy layer for MarqBot.

This plan is intentionally written for repeated human and AI digestion. It is not the source of truth for Marquette policy text. The source of truth remains the Marquette Bulletin pages referenced in `docs/memos/webscrape_policies.md`.

## Document Contract

- This file is an implementation plan, not a policy manual.
- Keep section headings stable after adoption so future AI passes can anchor to them reliably.
- Prefer additive edits over rewrites. Append new decisions, assumptions, and open questions instead of replacing history.
- Use exact code/file names in backticks.
- Use exact runtime field names when proposing schemas.
- Link policy claims back to canonical bulletin URLs, not copied excerpts.
- Treat `docs/memos/webscrape_policies.md` as the full-text research artifact and this file as the normalized action plan.

## Research-Informed Writing Rules Used Here

This plan follows a few documentation practices that are useful for engineering specs and repeated review:

- Start with a concise purpose statement.
- Emphasize material implications and stakeholder-facing behavior over incidental implementation detail.
- Separate background, proposal, assumptions, and deferred work.
- Be explicit about what is a requirement, what is an example, and what is still undecided.
- Preserve important conclusions in the document instead of relying on chat context.
- Use stable links and stable identifiers for future readers.
- Keep background short and link to supporting docs instead of duplicating large amounts of reference material.

These rules were chosen based on:

- Fuchsia RFC best practices: focus on buy-in, material details only, stable links, and preserving important out-of-band conclusions.
- RFC Style Guide: optimize for clarity, consistency, readability, and concise summaries.
- Google developer documentation guidance: start with clear purpose statements and define fields, parameters, and defaults explicitly.

## Current System Snapshot

### Runtime architecture

The current recommendation engine is deterministic and data-driven:

- `backend/server.py`
  - `/api/recommend` validates inputs, resolves declared programs, normalizes course lists, infers standing from credits, and runs semester recommendation logic.
- `backend/allocator.py`
  - Allocates completed courses into requirement buckets and computes remaining requirement slots.
- `backend/eligibility.py`
  - Filters courses to ones the student can plausibly take now.
- `backend/semester_recommender.py`
  - Ranks eligible candidates and selects the final semester recommendations.
- `backend/data_loader.py`
  - Loads checked-in CSVs into runtime indexes.

### Checked-in data model

The current checked-in data is course- and requirement-centric:

- `data/courses.csv`
  - base catalog overlay
- `data/course_hard_prereqs.csv`
  - parseable hard prerequisite expressions
- `data/course_soft_prereqs.csv`
  - soft restriction tags and raw bulletin prerequisite text
- `data/parent_buckets.csv`
  - majors, tracks, minors, universal requirement groups
- `data/child_buckets.csv`
  - requirement buckets
- `data/master_bucket_courses.csv`
  - explicit course-to-bucket mappings
- `data/course_equivalencies.csv`
  - equivalencies, honors/grad aliases, cross-listings, no-double-count groups

### Current scope

The current product scope is still business-centric plus university core overlays:

- Business majors, tracks, minors
- BCC
- MCC

The scraped policy memo covers 8 sections and 112 policy pages across:

- University Policies
- College of Arts and Sciences
- College of Business Administration
- College of Communication
- College of Education
- College of Engineering
- College of Health Sciences
- College of Nursing

Only the university-wide undergraduate rules and the College of Business Administration policies intersect directly with the current planner scope today.

### Current policy-like support already in runtime

The system already supports some course-level policy signals through `course_soft_prereqs.csv`:

- `major_restriction`
- `college_restriction`
- `admitted_program`
- `standing_requirement`
- `minimum_grade`
- `minimum_gpa`
- `program_progress_requirement`
- `instructor_consent`
- `placement_required`
- `complex_hard_prereq`

Important limitation: this support is course-level, not program-level. It is driven by course prerequisite fields, not by a separate policy engine.

### Current student-state limitations

The runtime request model does not currently capture most policy-relevant student state. It has:

- completed courses
- in-progress courses
- declared majors/tracks/minors
- honors flag
- semester targets
- coarse `student_stage` (`undergrad`, `graduate`, `doctoral`)

It does not currently have first-class inputs for:

- cumulative GPA
- major GPA
- college academic alert / probation / dismissal status
- repeat counts or attempt history
- non-degree status
- readmission status
- transfer preapproval
- study-elsewhere approval
- clinical clearance or professional-program admission

## Problem Statement

`docs/memos/webscrape_policies.md` contains valuable policy coverage, but it is not usable directly by the current system because:

- it is unstructured Markdown, not normalized runtime data
- it mixes course-level, college-level, and university-level rules
- many policies require student state the API does not currently collect
- many policy pages are advisory or process-oriented rather than machine-enforceable
- the current product scope does not yet include most non-business undergraduate colleges

If MarqBot consumes the memo naively, it will either:

- over-enforce rules it cannot validate safely, or
- surface noisy policy text without clear connection to runtime behavior

## Goals

- Create a structured policy registry that is auditable and source-traceable.
- Separate machine-enforceable policy rules from advisory-only rules.
- Keep course-level prerequisite restrictions in the current prerequisite model unless there is a clear reason to move them.
- Focus first on university-wide undergraduate rules and College of Business Administration rules.
- Make the policy layer maintainable by humans and digestible by AI.
- Avoid giving the planner authority it does not actually have.

## Non-Goals

- Do not parse `docs/memos/webscrape_policies.md` at runtime.
- Do not attempt to enforce all 112 policy pages immediately.
- Do not expand the degree graph to non-business colleges as part of this work.
- Do not replace advisor judgment or official Marquette systems.
- Do not copy large amounts of bulletin text into runtime CSVs.

## Key Decisions

### DEC-001: Separate policy registry from course prerequisites

Do not use the new policy layer to replace `course_hard_prereqs.csv` or `course_soft_prereqs.csv`.

Reason:

- The current prerequisite pipeline already handles course-level gating reasonably well.
- The new work is primarily about program-level, college-level, and university-level policy rules.
- Mixing them would make the current eligibility model harder to reason about.

### DEC-002: One row per atomic policy rule

The policy registry should be normalized to one row per atomic rule, not one row per policy page.

Reason:

- Many policy pages contain multiple clauses with different runtime implications.
- Atomic rows make future filtering, AI digestion, and implementation status tracking much simpler.

### DEC-003: Source traceability must remain direct

Each atomic policy row must carry its bulletin source URL and a short source locator such as a page title or clause label.

Reason:

- Future reviewers need to verify the rule without re-scraping the whole memo.
- The registry should remain compact and avoid copying full policy text.

### DEC-004: Start with business + university policy scope only

V1 mapping and runtime integration should cover:

- university-wide undergraduate policies relevant to the current planner
- College of Business Administration policies relevant to the current planner

All other undergraduate college policies should be catalogued as deferred or out of runtime scope until those colleges exist in the degree graph.

### DEC-005: Default to advisory unless enforcement is safe

If a policy requires student state that the API does not currently collect, classify it as advisory or deferred rather than inventing inferred enforcement.

Reason:

- False positives are worse than missing a warning.
- The planner must remain deterministic and defensible.

## Proposed Artifacts

### 1. `data/program_policies.csv`

Primary normalized registry for policy rules.

Recommended columns:

| Column | Purpose |
|---|---|
| `policy_id` | Stable unique identifier, e.g. `POL-UG-001`. |
| `scope_type` | `university`, `college`, `program`, `track`, or `global_runtime`. |
| `scope_id` | Canonical scope key, e.g. `UNIVERSITY_UG`, `COLLEGE_BUSINESS_UG`. |
| `policy_name` | Human-readable policy name. |
| `policy_category` | See taxonomy below. |
| `runtime_mode` | `none`, `advisory`, `warning`, `block`, `rank_penalty`, or `manual_review`. |
| `implementation_status` | `planned`, `advisory_only`, `runtime_ready`, `deferred`, `out_of_scope`. |
| `requires_student_state` | Semicolon-delimited list of required input fields. |
| `applies_to_program_ids` | Optional semicolon-delimited list of MarqBot program IDs. |
| `rule_summary` | Short normalized summary of the rule. |
| `rule_logic_notes` | Short implementation note, not full text. |
| `source_title` | Bulletin page title. |
| `source_locator` | Clause label or short locator within the source page. |
| `source_url` | Canonical bulletin URL. |
| `memo_section` | Section name from `webscrape_policies.md`. |
| `owner_notes` | Free-form maintenance notes. |

### 2. `backend/program_policies.py`

Loader and evaluator for normalized program-level policy rows.

Responsibilities:

- load and validate `data/program_policies.csv`
- expose typed policy records
- resolve applicable rows for a student/program selection
- evaluate rows when enough student state exists
- return structured results:
  - `policy_blocks`
  - `policy_warnings`
  - `policy_advisories`
  - `policy_manual_review`

### 3. Optional `policy_state` request object

Do not add many loosely related top-level request fields. If runtime policy evaluation expands, add a single structured object instead:

```json
{
  "policy_state": {
    "cumulative_gpa": 2.75,
    "major_gpa_by_program": {
      "FIN_MAJOR": 2.6
    },
    "academic_status": "good_standing",
    "enrollment_type": "degree_seeking",
    "is_readmitted": false,
    "approved_external_study": false,
    "repeat_counts": {
      "ACCO 3001": 1
    }
  }
}
```

Initial recommended keys:

- `cumulative_gpa`
- `major_gpa_by_program`
- `academic_status`
- `enrollment_type`
- `is_readmitted`
- `approved_external_study`
- `repeat_counts`

## Policy Taxonomy

Use these categories in `program_policies.csv`:

| Category | Meaning | Likely runtime treatment |
|---|---|---|
| `program_declaration` | Must declare a major, track, or minor before certain actions or courses. | Often already enforced elsewhere; otherwise warning or block. |
| `academic_status` | Good standing, probation, dismissal, college academic alert, readmission conditions. | Advisory first; later warning or block with student-state input. |
| `credit_load` | Maximum credits, overload petitions, summer credit caps. | Warning first; later recommendation post-filter if planner becomes credit-load aware. |
| `repeat_policy` | Repeat limits, grade replacement rules, max attempts. | Advisory first; later block or warning with repeat history. |
| `grade_minimum` | Minimum grades for progression, majors, minors, or student teaching. | Warning or block when grade history and program context exist. |
| `gpa_requirement` | Minimum cumulative or major GPA for progression or admission. | Warning or block when GPA input exists. |
| `program_progression` | Admission to professional program, degree progression requirements, student teaching gates, clinical progression. | Deferred unless student-state support exists and scope is in-product. |
| `transfer_and_external_study` | Transfer credit, approval for outside study, advanced standing. | Advisory first. |
| `readmission_and_enrollment` | Readmission, non-degree limits, enrollment status implications. | Advisory first. |
| `withdrawal_and_attendance` | Withdrawal consequences, excessive absence rules. | Usually advisory unless the system gains attendance/grade state. |
| `runtime_disclaimer` | Rules that should be surfaced as product disclaimers, not policy enforcement. | Advisory only. |

## Current Memo Implications By Category

### Directly relevant now

These intersect the current business-focused planner:

- University:
  - Academic Censure
  - Credit Load
  - Major and Minor Declaration
  - Non-Degree Undergraduate Students
  - Readmission
  - Repeated Courses
  - Study at Other Institutions
  - Transfer Course Credit
- College of Business Administration:
  - Academic Load
  - Declaration of Major
  - Grade Minimums
  - Transfer Course Study Approval
  - Transfer Students

### Already partially represented

These are already partially modeled elsewhere and should be audited, not duplicated blindly:

- standing-based course restrictions
- admitted-program restrictions
- major restrictions
- college restrictions
- minimum grade and GPA mentions embedded in course prerequisites

Primary source for those remains `data/course_soft_prereqs.csv`.

### Deferred for now

These matter only after the planner expands beyond business or gains more student-state inputs:

- Education professional-program admission and student-teaching gates
- Engineering admission, transfer, and repeat-limit rules
- Health Sciences college alert and degree progression rules
- Nursing admission, appeals, clinical/health, and degree progression rules

## Mapping Rules

When converting the memo into `data/program_policies.csv`, use these rules:

1. Split policy pages into atomic rules.
2. Do not store large bulletin excerpts.
3. Store a short normalized `rule_summary` and keep the full source in the memo and source URL.
4. Prefer the most specific applicable scope:
   - `program` over `college`
   - `college` over `university`
5. If a rule is course-specific and already belongs in prerequisite data, do not duplicate it here.
6. If a rule cannot be evaluated with current inputs, mark it `advisory_only` or `deferred`.
7. If a rule is outside current product scope, mark it `out_of_scope` instead of forcing a weak implementation.
8. Use canonical MarqBot program IDs in `applies_to_program_ids` whenever a rule is truly program-specific.

## Recommended Scope IDs

Use a small, explicit scope namespace.

Recommended initial values:

- `UNIVERSITY_UG`
- `COLLEGE_BUSINESS_UG`
- `COLLEGE_ARTS_SCIENCES_UG`
- `COLLEGE_COMMUNICATION_UG`
- `COLLEGE_EDUCATION_UG`
- `COLLEGE_ENGINEERING_UG`
- `COLLEGE_HEALTH_SCIENCES_UG`
- `COLLEGE_NURSING_UG`

Do not overload existing `parent_buckets.csv` program IDs for college scopes. Keep college scope IDs separate from program IDs.

## Runtime Evaluation Model

### Separation of concerns

- Course-level prerequisite logic stays in:
  - `course_hard_prereqs.csv`
  - `course_soft_prereqs.csv`
  - `backend/eligibility.py`
- Program-level and policy-page-derived rules move into:
  - `data/program_policies.csv`
  - `backend/program_policies.py`

### Evaluation order

Recommended evaluation order:

1. Resolve declared programs and current effective planner scope.
2. Run existing allocator and course eligibility logic.
3. Resolve applicable program-level policy rows.
4. Evaluate only rows whose `requires_student_state` is satisfied by the request.
5. Produce structured policy results:
   - `policy_blocks`
   - `policy_warnings`
   - `policy_advisories`
   - `policy_manual_review`
6. Merge these into recommendation output without mutating unrelated recommendation logic.

### Conflict handling

- If both university and college rules apply, include both unless they are duplicates.
- If a more specific rule contradicts a more general one, the more specific rule wins.
- If a rule is not safely machine-evaluable, do not silently convert it into a hard block.

## Recommended Response Additions

If policy integration reaches runtime, add these response fields to `/api/recommend` and optionally `/api/can-take`:

```json
{
  "policy_blocks": [],
  "policy_warnings": [],
  "policy_advisories": [],
  "policy_manual_review": []
}
```

Each item should include:

- `policy_id`
- `policy_name`
- `scope_type`
- `scope_id`
- `message`
- `source_url`
- `runtime_mode`

## Phased Implementation Plan

### Phase 0: Stabilize names and boundaries

Deliverables:

- approve taxonomy
- approve `scope_id` conventions
- approve `runtime_mode` enum
- approve `implementation_status` enum
- approve whether `policy_state` lives under a nested request object

Acceptance criteria:

- no ambiguous field names remain in this plan
- no future implementation step depends on undocumented naming decisions

### Phase 1: Build the normalized policy registry

Deliverables:

- create `data/program_policies.csv`
- map university-wide undergraduate rules relevant to the current planner
- map College of Business Administration rules relevant to the current planner
- add deferred rows for non-business college rules that are clearly out of scope

Mapping standard:

- one row per atomic rule
- every row has `policy_id`, `policy_category`, `runtime_mode`, `implementation_status`, `source_url`
- every row has either `scope_id` or `applies_to_program_ids`

Acceptance criteria:

- every relevant university/business policy page in `webscrape_policies.md` has been reviewed
- every mapped row is source-traceable
- every row is explicitly classified as `runtime_ready`, `advisory_only`, `deferred`, or `out_of_scope`

### Phase 2: Add loader and registry validation

Deliverables:

- add `backend/program_policies.py`
- load `data/program_policies.csv` during startup
- validate enums, missing source URLs, duplicate `policy_id`s, and unknown scope IDs

Recommended validation failures:

- duplicate `policy_id`
- unknown `runtime_mode`
- unknown `implementation_status`
- empty `rule_summary`
- missing `source_url`
- `runtime_ready` row with empty `requires_student_state` when the rule clearly needs state

Acceptance criteria:

- startup fails fast on malformed policy rows
- tests cover loader validation and a few example rows

### Phase 3: Add non-runtime policy visibility first

Deliverables:

- add a backend-only policy evaluation path that returns advisory data without changing eligibility decisions
- surface policy information in recommendation responses only when it is relevant to the current selected scope

Important restriction:

- do not show large generic walls of policy text
- do not show every applicable policy by default
- only show concise normalized messages that materially help interpretation

Acceptance criteria:

- recommendation responses can include scoped policy advisories without changing the course list
- noisy, always-on warnings are filtered out

### Phase 4: Add real student-state support

Deliverables:

- add optional `policy_state` request object
- validate `policy_state` in `backend/server.py` or a dedicated validator module
- plumb `policy_state` into policy evaluation

Initial runtime-ready policy targets:

- academic status warnings or blocks
- GPA-gated progression warnings
- repeat-policy warnings
- transfer/study-elsewhere warnings
- credit-load warnings once recommendation output is credit-summed

Acceptance criteria:

- policy evaluation is deterministic
- missing `policy_state` does not break existing clients
- rules that need missing state stay advisory or silent, not wrong

### Phase 5: Targeted enforcement for current product scope

Deliverables:

- promote selected business/university policies from advisory to real warning or block mode where input support exists
- document each promotion in a decision log

Promotion standard:

- only promote rules that are source-traceable
- only promote rules that can be validated with explicit request data
- only promote rules whose output semantics are clear to users

Acceptance criteria:

- every `block` rule has an explicit test
- every `warning` rule has a deterministic message format
- recommendation output remains understandable

### Phase 6: Future expansion beyond business

Only start after new degree graphs exist for those colleges.

Potential next scopes:

- Engineering
- Nursing
- Education
- Health Sciences
- Communication
- Arts and Sciences

## Recommended Initial V1 Rows

These should be prioritized in `program_policies.csv`:

- `UNIVERSITY_UG` + `academic_status`
  - Academic Censure - Undergraduate
- `UNIVERSITY_UG` + `credit_load`
  - Credit Load - Undergraduate
- `UNIVERSITY_UG` + `program_declaration`
  - Major and Minor Declaration - Undergraduate
- `UNIVERSITY_UG` + `readmission_and_enrollment`
  - Non-Degree Undergraduate Students
  - Readmission - Undergraduate
- `UNIVERSITY_UG` + `repeat_policy`
  - Repeated Courses - Undergraduate
- `UNIVERSITY_UG` + `transfer_and_external_study`
  - Study at Other Institutions - Undergraduate
  - Transfer Course Credit - Undergraduate
- `COLLEGE_BUSINESS_UG` + `credit_load`
  - Academic Load
- `COLLEGE_BUSINESS_UG` + `program_declaration`
  - Declaration of Major
- `COLLEGE_BUSINESS_UG` + `grade_minimum`
  - Grade Minimums
- `COLLEGE_BUSINESS_UG` + `transfer_and_external_study`
  - Transfer Course Study Approval
  - Transfer Students

## Risks

### RISK-001: Over-enforcement

If the planner blocks recommendations using rules that depend on missing GPA or academic-status data, the system will become untrustworthy.

Mitigation:

- default to advisory
- require explicit student state for blocks

### RISK-002: Duplicate logic

If program-level policies and course-level soft prereqs both encode the same restriction, behavior will drift.

Mitigation:

- keep course prerequisite restrictions in prerequisite data
- use the new registry for program-level and policy-page-derived rules only

### RISK-003: Scope mismatch

The memo covers all undergraduate colleges; the product does not.

Mitigation:

- map all colleges for research completeness
- integrate runtime support only for business and university scope in v1

### RISK-004: Noisy output

Policy surfacing can overwhelm recommendation results if every advisory appears every time.

Mitigation:

- gate output by relevance
- add concise normalized messages
- avoid full-text policy dumps in API responses

## Test Plan

### Data-layer tests

- loader rejects duplicate `policy_id`s
- loader rejects invalid enums
- loader rejects missing source URLs
- loader accepts valid business/university examples

### Evaluation tests

- selected business program activates `COLLEGE_BUSINESS_UG` policies
- non-business scope does not accidentally trigger business-only policies
- missing `policy_state` keeps stateful rules non-blocking
- more-specific scopes override less-specific conflicts

### API tests

- `/api/recommend` remains backward compatible without `policy_state`
- `/api/recommend` returns policy advisory arrays when applicable
- `/api/can-take` remains independent of unrelated program-level rules unless explicitly integrated

## Open Questions

### Q-001

Should policy advisories appear in normal student responses immediately, or only in debug/admin outputs first?

Current default:

- start with normal responses only for concise, clearly relevant advisories
- keep noisy or experimental output behind debug/admin paths

### Q-002

Should `policy_state` be user-entered, advisor-entered, or inferred from institutional data later?

Current default:

- design the schema for optional manual entry first
- avoid building enforcement that assumes institutional integration exists

### Q-003

Should a future policy registry include effective dates and bulletin years?

Current default:

- not in v1
- add later if multi-year bulletin support becomes necessary

## Decision Log

### 2026-03-18

- Keep course-level prerequisites and program-level policies as separate layers.
- Treat `docs/memos/webscrape_policies.md` as research input, not runtime data.
- Limit v1 runtime implications to university-wide undergraduate rules plus College of Business Administration rules.
- Prefer a nested `policy_state` request object over many new top-level fields.

## Sources

- Fuchsia RFC best practices: https://fuchsia.dev/fuchsia-src/contribute/governance/rfcs/best_practices
- RFC Style Guide (RFC 7322): https://www.ietf.org/rfc/rfc7322
- Google developer documentation style guidance: https://developers.google.com/style/api-reference-comments
