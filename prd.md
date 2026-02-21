# MARQBOT PRODUCT REQUIREMENTS DOCUMENT
Version: 3.0
Last Updated: February 19, 2026
Owner: Markie Ngo
Status: Implemented + Iterating

---

## 1. Product Summary

MarqBot is a Finance-major course planning assistant for Marquette students.  
It recommends realistic next courses by combining deterministic prerequisite checks and requirement-bucket progress.

Primary outcome:
- Students quickly know what they can take next and why.

---

## 2. Key Features and Explanations

## 2.1 Deterministic Eligibility Engine

Feature:
- Course recommendations are eligibility-gated by rule-based logic.

How it works:
1. Normalize/validate course input.
2. Parse prerequisite expressions from workbook.
3. Enforce offering term + prereq satisfaction + not-yet-taken checks.
4. Rank eligible set by sequencing and requirement impact.

Why this exists:
- Avoids “hallucinated” recommendations and keeps outputs auditable.

## 2.2 Two-Semester Planning

Feature:
- Supports one or two recommendation semesters in one request.

How it works:
- Semester 1 uses user-entered completed/in-progress courses.
- Semester 2 (optional) assumes Semester 1 recommendations are completed.
- Secondary semester supports:
- explicit term
- `Auto` follow-up
- `__NONE__` to suppress semester 2

Why this exists:
- Lets students see immediate next-step sequencing, not just one-term advice.

## 2.3 Requirement Bucket Allocation + Progress

Feature:
- Course completion is mapped to major requirement buckets with progress output.

How it works:
- Allocator applies course-to-bucket mapping from workbook.
- Tracks completed vs in-progress applied courses.
- Supports multi-bucket mappings via data flags.
- Returns remaining slots and per-bucket satisfaction state.

Why this exists:
- Converts recommendations into visible degree movement.

## 2.4 Can-Take Course Check

Feature:
- Optional mode to evaluate a single requested course.

How it works:
- Returns `can_take`, missing prereqs, term-offering mismatch, and unsupported-prereq/manual-review indicators.

Why this exists:
- Enables quick registration-readiness checks.

## 2.5 Session Persistence

Feature:
- Frontend stores user session state in browser storage.

How it works:
- Saves selected courses + target semester controls + can-take input.
- Restores on refresh.

Why this exists:
- Reduces repetitive re-entry during planning.

---

## 3. Users and Use Cases

Primary user:
- Marquette undergraduate Finance majors.

Core use cases:
- “What should I take next semester?”
- “Can I take course X next semester?”
- “If I follow next-term recommendations, what should I take after that?”
- “How far am I in each requirement bucket?”

---

## 4. Functional Requirements

## 4.1 Inputs

- Completed courses (search + paste)
- In-progress courses (search + paste)
- Target Semester (1) required
- Target Semester (2) optional
- Max recommendations (1-4)
- Optional requested course for can-take mode

## 4.2 Outputs

Recommendation mode:
- `semesters` array (1 or 2 semester blocks)
- recommendation cards with:
- course identity
- prereq check status
- bucket tags
- unlocks
- explanation
- progress by requirement bucket
- blocking warnings and timeline estimate

Can-take mode:
- eligibility state for requested course
- missing prereqs / not-offered / manual-review metadata

## 4.3 Validation and Error Behavior

- Invalid semester format returns `INVALID_INPUT`.
- Unknown course codes return structured invalid/not-in-catalog responses.
- Unexpected server errors return `SERVER_ERROR`.

---

## 5. Data Model

Source workbook: `marquette_courses_full.xlsx`

Expected sheets:
- `courses`
- `equivalencies`
- `tracks`
- `buckets`
- `course_bucket`

Compatibility:
- If workbook uses `program_id`, backend maps to `track_id`.

Prereq fields:
- `prereq_hard` is parsed deterministically.
- `prereq_soft` supports advisory/manual-review flags.

---

## 6. System Design

Backend modules:
- `server.py`: API endpoints + orchestration
- `data_loader.py`: workbook ingestion + integrity warnings
- `semester_recommender.py`: per-semester pipeline + recommendation output
- `eligibility.py`, `allocator.py`, `unlocks.py`, `timeline.py`

Frontend modules:
- `app.js`: orchestration
- `modules/api.js`
- `modules/multiselect.js`
- `modules/rendering.js`
- `modules/session.js`
- `modules/utils.js`

---

## 7. Non-Functional Requirements

Performance:
- All recommendations are fully deterministic and local — no external API calls.

Reliability:
- Recommendations must never bypass deterministic hard-prereq checks.

Maintainability:
- Logic split into domain modules (loader/recommender/render/session).

---

## 8. Quality and Testing

Backend:
- Pytest suite for parser, eligibility, allocator, unlock logic.

Frontend:
- Jest + jsdom tests for rendering/session/utils modules.

Acceptance criteria:
- Input normalization works for messy formats.
- Recommendation count respects max when eligible courses exist.
- Two-semester chaining reflects sem1-as-completed rule.
- Progress cards match allocator output.
- Can-take mode reflects deterministic eligibility only.

---

## 9. Product Constraints and Positioning

- This is a student planning tool, not official advising.
- Output must be presented with advising disclaimer language.
- Students should verify final registration with advisors and official systems.

