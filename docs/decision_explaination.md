# Decision Explanation (v1.7.11)

## Purpose
This document explains the high-level product decisions behind MarqBot so future features stay aligned with student-facing clarity: recommendations should be explainable, deterministic, and auditable from workbook data.

## Core Product Principles
1. Data-first governance: requirements and policies should live in workbook tables, not hardcoded logic.
2. Student-visible consistency: recommendations, progress bars, warnings, and timeline projections must all use the same rules.
3. Deterministic behavior: the same inputs should produce the same outputs across runs.
4. Explicit exceptions over hidden heuristics: defaults are simple, and edge cases are handled by policy rows.

## Architecture Decisions
### 1) Parent/child requirement model
- We model majors, tracks, minors, and universal overlays as `parent_buckets`.
- We model concrete requirement groups as `child_buckets`.
- We map course membership in `master_bucket_courses`.
- Why this exists for users:
  - clearer progress breakdown in UI
  - easier auditing when a course appears in or outside a requirement group
  - cleaner future expansion (new tracks/minors without redesign)

### 2) Keep tracks selectable, but govern overlap by family
- Tracks remain selectable entities for catalog and UI behavior.
- Double-count defaults use family semantics so major+track relationships behave intentionally.
- Why users benefit:
  - avoids "one class counted everywhere" confusion
  - still supports legitimate cross-major overlap for double majors

### 3) Double-count policy precedence
- Precedence order:
  1. child-bucket pair override
  2. parent/family override
  3. default family rule
- Why this exists:
  - advisors and data stewards can override targeted exceptions without breaking global logic

### 4) Universal overlays as first-class requirements
- `BCC_CORE` and `MCC_CORE` are modeled as universal parent buckets.
- They are auto-included when active.
- Why users benefit:
  - common curriculum is always visible and not accidentally omitted

## Recommendation Strategy Decisions
### 1) Eligibility baseline first
- A course is considered only if the student can reasonably take it (prereqs/standing/warnings).
- Why users benefit:
  - fewer unusable recommendations

### 2) Tiered ranking
- Tier 1: MCC + `BCC_REQUIRED`
- Tier 2: selected major buckets
- Tier 3: selected track buckets
- Tier 4: demoted BCC children (`BCC_ETHICS`, `BCC_ANALYTICS`, `BCC_ENHANCE`)
- Tier 5 signal in-tier: unlock power and tie-breakers
- Why users benefit:
  - foundational requirements are not buried
  - major progress remains central

### 3) Soft diversity cap
- Default limit of two recommendations per bucket each semester.
- Auto-relaxes when remaining viable unmet buckets are too few.
- Why users benefit:
  - prevents repetitive recommendation lists early
  - avoids empty/underfilled lists late in degree progress

## Elective-Pool Decisions
### 1) Dynamic elective pools
- Elective pool children are credit-based and broad by design.
- Candidate courses come from `courses.elective_pool_tag` (currently `biz_elective`).
- Why users benefit:
  - electives stay current as catalog rows change
  - no massive static mapping maintenance burden

### 2) Non-elective-first routing inside same family
- If one course can satisfy same-family required/choose bucket and elective pool bucket, required/choose wins first.
- Why users benefit:
  - required progress is not accidentally consumed by elective accounting
  - perceived recommendation randomness drops

## Operational Decisions
1. Keep external API contracts stable (`/programs`, `/recommend`) while evolving internal data model.
2. Keep migration and backfill utilities scriptable so workbook changes are reproducible.
3. Treat unresolved substitution/equivalency patterns as deferred policy work, not hidden logic.

## What this means for future features
- New majors/tracks/minors should be data additions, not architecture changes.
- New elective ecosystems should add new `elective_pool_tag` values and routing rules.
- UX explanations should map directly to these rules so students can trust why a course was recommended.
