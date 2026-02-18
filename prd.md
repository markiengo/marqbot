# MARQBOT PRODUCT REQUIREMENTS DOCUMENT
Version: 2.0
Last Updated: February 18, 2026
Owner: Markie Ngo
Status: Implemented MVP (active iteration)

---

## 1. Product Summary

MarqBot helps Marquette Finance majors decide what to take next using deterministic prerequisite and requirement logic. It supports one or two semester plans and an optional can-take eligibility check.

Primary value:
- Recommend courses students can actually take now.
- Keep sequencing tight from lower prerequisite levels to higher levels.
- Show major progress by requirement buckets.

---

## 2. Core Behavior (Current)

### 2.1 Inputs

- Completed courses (search or paste)
- In-progress courses (search or paste)
- Target Semester (1): for example `Spring 2026`
- Recommendations count: 1 to 4
- Target Semester (2) optional:
- `Auto` (default follow-up term)
- Explicit semester label
- `None (Do not generate)`
- Can-take input (optional): "Can I take this next semester?"

### 2.2 Recommendation Logic

Deterministic by default:
1. Normalize and validate input codes.
2. Parse prerequisite expressions.
3. Filter by term offering and prereq satisfaction.
4. Exclude already completed/in-progress courses.
5. Score by requirement priority, prereq level, and multi-bucket value.
6. Return top N eligible results (N = requested count, up to available eligible courses).

OpenAI is optional and used only for explanation/ranking text when enabled.

### 2.3 Two-Semester Planning

- Semester 1 uses user-entered completed/in-progress data.
- Semester 2 (if enabled) is generated from updated completion state:
- Original completed
- Original in-progress
- Semester 1 recommended courses (treated as completed)
- If Semester 2 is `Auto`, follow-up defaults:
- Spring -> Fall (same year)
- Summer -> Fall (same year)
- Fall -> Spring (next year)

### 2.4 Can-Take Mode

If `requested_course` is provided, response switches to can-take mode:
- `can_take: true/false/null`
- Missing prereqs (if any)
- Offering mismatch flag
- Manual-review flag for unsupported prereq patterns
- Alternative eligible suggestions

---

## 3. Data Model and Rules

Workbook: `marquette_courses_full.xlsx`

Sheets:
- `courses`
- `equivalencies`
- `tracks`
- `buckets`
- `bucket_course_map`

Important schema notes:
- Workbook may use `program_id`; backend maps to `track_id` for compatibility.
- Prereqs are split into hard and soft logic in the course data.
- Prereq hierarchy fields (`prereq_level` / tiering) are used to keep recommendations bottom-up.

Buckets for Finance major:
- `CORE` (includes core required path items)
- `FIN_CHOOSE_1` -> "Upper Division Finance Elective (One)"
- `FIN_CHOOSE_2` -> "Upper Division Finance Elective (Two)"
- `BUS_ELEC_4` -> "Business Electives"

Double counting:
- Controlled by data flags (`allow_double_count`, `can_double_count`).
- Courses may appear in multiple buckets and are shown as such in UI.

---

## 4. API Contract (Current)

### 4.1 POST `/recommend`

Request (recommendation mode):

```json
{
  "completed_courses": "ACCO 1031, BUAD 1560",
  "in_progress_courses": "",
  "target_semester_primary": "Spring 2026",
  "target_semester_secondary": "Fall 2026",
  "max_recommendations": 4,
  "requested_course": null
}
```

Response includes:
- `mode: recommendations`
- `semesters: [...]` (1 or 2 blocks)
- Top-level fields mirroring semester 1 for backward compatibility
- Per-semester:
- recommendations
- blocking warnings
- progress
- double-count information
- manual-review list
- timeline estimate

Can-take mode:
- `mode: can_take`
- eligibility and reason fields only (no semester planning)

### 4.2 GET `/courses`

Returns course catalog for searchable UI inputs.

---

## 5. UX Requirements (Current)

- Dashboard-style interface with modern glass visuals.
- Marquette brand colors:
- Blue `#003366`
- Gold `#FFCC00`
- Semester cards:
- "Semester 1: Recommended for ..."
- "Semester 2: Recommended for ..."
- Recommendation cards show:
- course code/name
- prereq check line
- bucket tags (including secondary bucket tags)
- unlocks
- why text
- Degree progress:
- one card per bucket
- completed vs required counts
- in-progress courses shown separately and not counted as completed
- Timeline wording explicitly states estimate for Finance major completion only.

---

## 6. Performance and Cost

- Default mode does not call OpenAI (`USE_OPENAI_EXPLANATIONS=0`), so latency and cost are low.
- Optional OpenAI mode (`USE_OPENAI_EXPLANATIONS=1`) adds API latency/cost for explanation generation.

Targets:
- Deterministic response typically much faster than LLM mode.
- Recommendations must not violate hard prereq gating.

---

## 7. Quality and Validation

Required checks:
- No recommendation should bypass deterministic eligibility.
- Recommendation count must honor requested max when enough eligible courses exist.
- Progress bars must reflect bucket allocations correctly.
- Semester 2 must build on Semester 1 recommendations when generated.
- Can-take behavior remains based only on user-completed/in-progress state.

Testing:
- Unit tests for parsing, eligibility, allocation, unlocks.
- Integration checks on `/recommend` for one-semester and two-semester responses.

---

## 8. Known Product Positioning

MarqBot is a student-facing planning assistant, not official academic advising. Students should verify schedules and policy constraints with university advisors and official systems.

