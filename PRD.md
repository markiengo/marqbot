# MarqBot Product Requirements Document

**Version:** v1.9.0
**Last updated:** 2026-02-24

---

## 1. Product Overview

MarqBot is a deterministic degree-planning assistant for Marquette University business students. It recommends next-semester courses, tracks requirement progress, and checks course eligibility -- all driven by workbook data, not hardcoded logic.

**Positioning:** Complementary to DegreeWorks (which shows what is done). MarqBot suggests what to take next.

**Current scope:** 7 College of Business majors, 6 tracks, 2 universal overlays (BCC, MCC). Small pilot with 5-20 finance students, hosted on Render.

---

## 2. Core Principles

1. **Data-first governance.** Requirements and policies live in workbook tables, not code. New majors/tracks are data additions, not architecture changes.
2. **Deterministic behavior.** Same inputs produce same outputs. No randomness, no LLM in the recommendation pipeline.
3. **Student-visible consistency.** Recommendations, progress bars, warnings, and projections all use the same rules.
4. **Explicit exceptions over hidden heuristics.** Defaults are simple; edge cases are handled by policy rows.

---

## 3. Architecture

### 3.1 Stack

| Layer | Technology |
|-------|-----------|
| Backend | Flask + pandas (Python 3.12) |
| Frontend | Vanilla JS modules + HTML/CSS |
| Data source | `marquette_courses_full.xlsx` |
| Deployment | Render (gunicorn) |
| Tests | pytest (backend), Jest with `--experimental-vm-modules` (frontend) |

### 3.2 Key Backend Modules

| Module | Responsibility |
|--------|---------------|
| `backend/server.py` | Flask app, API endpoints, program selection resolution |
| `backend/data_loader.py` | Workbook loading, V2 normalization, schema detection |
| `backend/eligibility.py` | Prereq/standing/offering checks, can-take logic |
| `backend/allocator.py` | Deterministic course-to-bucket assignment with double-count policy |
| `backend/semester_recommender.py` | Tiered ranking, greedy pick loop, debug trace |
| `backend/requirements.py` | Bucket role queries, progress calculations, double-count policy resolution |
| `backend/unlocks.py` | Reverse prereq map, unlock power calculations, blocking warnings |
| `backend/validators.py` | Input normalization, prereq expansion, inconsistency detection |

### 3.3 Key Frontend Modules

| Module | Responsibility |
|--------|---------------|
| `frontend/app.js` | Main orchestration, event wiring, session persistence |
| `frontend/modules/api.js` | API calls (`postRecommend`, `postCanTake`, `fetchCourses`, `fetchPrograms`) |
| `frontend/modules/rendering.js` | HTML generation for cards, progress, KPIs, semester selectors |
| `frontend/modules/multiselect.js` | Course/major multiselect dropdown with search |
| `frontend/modules/session.js` | localStorage session save/restore |
| `frontend/modules/utils.js` | `prettifyIdentifier`, label maps, formatting helpers |

### 3.4 Runtime Flow

```
Workbook sheets
    --> data_loader normalization
    --> parent_buckets_df + child_buckets_df + courses_df + prereq_map + offerings
    --> eligibility candidate filter
    --> allocator deterministic assignment (double-count policy resolution)
    --> semester_recommender ranking and packing
    --> /recommend response
```

Universal programs (`BCC_CORE`, `MCC_FOUNDATION`) are auto-merged into effective data by `_build_declared_plan_data_v2()` in `server.py`, producing namespaced bucket IDs like `BCC::BCC_REQUIRED`.

---

## 4. Data Model

### 4.1 Workbook Sheets

| Sheet | Primary Key | Purpose |
|-------|------------|---------|
| `courses` | `course_code` | Course catalog (code, name, credits, level, elective_pool_tag) |
| `parent_buckets` | `parent_bucket_id` | Programs: majors, tracks, universals (type, active, double_count_family_id) |
| `child_buckets` | `parent_bucket_id` + `child_bucket_id` | Requirement groups (requirement_mode, courses_required, credits_required) |
| `master_bucket_courses` | `parent_bucket_id` + `child_bucket_id` + `course_code` | Course-to-bucket membership mappings |
| `course_prereqs` | `course_code` | Prereq rules (prerequisites, prereq_warnings, concurrent_with, min_standing) |
| `course_offerings` | `course_code` | Term availability (wide boolean columns: spring_2025, fall_2025, etc.) |
| `double_count_policy` | composite | Pairwise bucket overlap overrides (currently empty -- relies on family defaults) |
| `README` | -- | Authoring guide for workbook maintainers |

### 4.2 Parent Bucket Types

| Type | Example | Behavior |
|------|---------|----------|
| `major` | `FIN_MAJOR`, `ACCO_MAJOR` | Selectable in UI. Tier 2 recommendation priority. |
| `track` | `CB_TRACK`, `FP_TRACK` | Selectable, scoped to parent major. Tier 3 priority. |
| `universal` | `BCC_CORE`, `MCC_FOUNDATION` | Auto-included for all students. Tier 1 priority (BCC_REQUIRED + all MCC). |

### 4.3 Requirement Modes

| Mode | Completion Rule |
|------|----------------|
| `required` | All mapped courses must be completed |
| `choose_n` | N courses from the mapped set (governed by `courses_required`) |
| `credits_pool` | N total credits from tagged courses (governed by `credits_required`) |

### 4.4 Double-Count Policy

- **Default rule:** Same-family buckets deny double-counting. Cross-family buckets allow it.
- **Override precedence:** child-bucket pair override > parent/family override > default family rule.
- **Track-family semantics:** A track and its parent major share the same `double_count_family_id`, so their children cannot double-count by default.
- **Cross-major sharing:** Different major families can share course credit, including required and elective children.

### 4.5 Entity Relationship Diagram

```
PARENT_BUCKETS --owns--> CHILD_BUCKETS --maps--> MASTER_BUCKET_COURSES <--satisfies-- COURSES
COURSES --has_rules--> COURSE_PREREQS
COURSES --has_offerings--> COURSE_OFFERINGS
PARENT_BUCKETS --parent_major_ref--> PARENT_BUCKETS
```

### 4.6 Audit Snapshot (v1.9.0)

- 198 courses, 15 parent buckets, 47 child buckets, 289 mappings
- 198 prereq rows, 198 offering rows, 0 policy override rows
- 7 majors: FIN, AIM, ACCO, BUAN, HURE, OSCM, INSY
- 6 tracks: CB, FP, HURE_LEAD, AIM_CFA, AIM_FINTECH, AIM_IB
- 2 universals: BCC_CORE, MCC_FOUNDATION

---

## 5. API Contract

### 5.1 `GET /courses`

Returns the full course catalog.

**Response:**
```json
{
  "courses": [
    {
      "course_code": "FINA 3001",
      "course_name": "Financial Management",
      "credits": 3,
      "level": 3000,
      "prereq_level": 2
    }
  ]
}
```

### 5.2 `GET /programs`

Returns the selectable program catalog (excludes universal overlays).

**Response:**
```json
{
  "majors": [
    { "major_id": "FIN_MAJOR", "label": "Finance", "active": true, "requires_primary_major": false }
  ],
  "tracks": [
    { "track_id": "CB_TRACK", "label": "Corporate Banking", "parent_major_id": "FIN_MAJOR", "active": true }
  ],
  "default_track_id": "FIN_MAJOR"
}
```

### 5.3 `GET /health`

Service liveness endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.9.0"
}
```
### 5.4 `POST /recommend`

Main recommendation endpoint.

**Request body:**
```json
{
  "declared_majors": ["FIN_MAJOR"],
  "track_id": "CB_TRACK",
  "completed_courses": "ECON 1001, ECON 1002, BUAD 1000",
  "in_progress_courses": "",
  "target_semester_primary": "Fall 2026",
  "target_semester_count": 1,
  "max_recommendations": 6,
  "debug": false,
  "debug_limit": 30
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `declared_majors` | string[] | Yes (or `track_id`) | Array of program IDs |
| `track_id` | string | No | Track concentration ID |
| `completed_courses` | string | No | Comma-separated course codes |
| `in_progress_courses` | string | No | Comma-separated course codes |
| `target_semester_primary` | string | No | e.g. "Fall 2026". Default: "Spring 2026" |
| `target_semester_count` | int | No | 1-4 semesters. Default: inferred from legacy fields |
| `max_recommendations` | int | No | 1-6 per semester. Default: 3 |
| `debug` | bool | No | Include debug trace in response |
| `debug_limit` | int | No | Max debug entries (1-100). Default: 30 |

**Response (success):**
```json
{
  "mode": "recommendations",
  "recommendations": [...],
  "semesters": [
    {
      "target_semester": "Fall 2026",
      "recommendations": [
        {
          "course_code": "ECON 1103",
          "course_name": "Principles of Microeconomics",
          "fills_buckets": ["BCC::BCC_REQUIRED"]
        }
      ],
      "eligible_count": 45,
      "debug": [...]
    }
  ],
  "current_progress": {...},
  "eligible_count": 45
}
```

**Debug trace entry (when `debug: true`):**
```json
{
  "rank": 1,
  "course_code": "ECON 1103",
  "course_name": "Principles of Microeconomics",
  "selected": true,
  "skip_reason": null,
  "tier": 1,
  "acco_boost": 0,
  "is_core_prereq_blocker": false,
  "unlock_count": 5,
  "unlocks": ["FINA 3001", "ECON 2010", ...],
  "soft_tag_penalty": 0,
  "multi_bucket_score": 2,
  "prereq_level": 0,
  "fills_buckets": ["BCC::BCC_REQUIRED"],
  "bucket_capacity": {"BCC::BCC_REQUIRED": 8}
}
```

**Error codes:** `INVALID_INPUT`, `INCONSISTENT_INPUT`, `PRIMARY_MAJOR_REQUIRED`, `SERVER_ERROR`

### 5.5 `POST /can-take`

Standalone eligibility check for a single course.

**Request body:**
```json
{
  "requested_course": "FINA 3001",
  "completed_courses": "ECON 1001, ACCO 1030",
  "in_progress_courses": "ECON 1103",
  "target_semester": "Fall 2026",
  "declared_majors": ["FIN_MAJOR"]
}
```

**Response:**
```json
{
  "mode": "can_take",
  "requested_course": "FINA 3001",
  "can_take": true,
  "why_not": null,
  "missing_prereqs": [],
  "not_offered_this_term": false,
  "unsupported_prereq_format": false,
  "next_best_alternatives": []
}
```

### 5.6 `POST /feedback`

Collects thumbs-up/down feedback for recommendation cards.

**Request body:**
```json
{
  "course_code": "ECON 1103",
  "semester": "Fall 2026",
  "rating": 1,
  "rank": 1,
  "tier": 1,
  "fills_buckets": ["BCC::BCC_REQUIRED"],
  "session_id": "abc12345",
  "major": "FIN_MAJOR",
  "track": ""
}
```

**Validation:**
- `course_code` must exist in catalog
- `rating` must be `1` or `-1`
- `rank` and `tier` must be integers

**Response:**
```json
{
  "ok": true
}
```

---

## 6. Recommendation Engine

### 6.1 Pipeline

1. **Eligibility filter:** Only courses the student can take (prereqs satisfied, standing met, warnings checked).
2. **Tiered ranking (locked order):**
   - Tier 1: MCC + `BCC_REQUIRED` (before decay)
   - Tier 2: Selected major buckets
   - Tier 3: Selected track/minor buckets
   - Tier 4: decayed `BCC_REQUIRED`
   - Tier 5: Demoted BCC children (`BCC_ETHICS`, `BCC_ANALYTICS`, `BCC_ENHANCE`)
3. **BCC progress-aware decay (feature-flagged):**
   - Controlled by `BCC_DECAY_ENABLED` (default `false`)
   - Trigger: `>=12` applied courses in `BCC_REQUIRED` (distinct `completed + in-progress`)
   - Effect: `BCC_REQUIRED` moves from Tier 1 to Tier 4
4. **In-tier tie-breakers (sort key order):**
   - ACCO-major required boost (in-tier only, does not jump tiers)
   - Core prereq blocker status (courses that block many others rank higher)
   - Unlock power (number of courses this unlocks, descending)
   - Soft tag demotion penalty
   - Multi-bucket coverage score (descending)
   - Prereq level (ascending -- lower prereq chains first)
   - Course code (alphabetical, deterministic tie-break)
5. **Greedy pick loop with soft diversity cap:**
   - Default: max 2 recommendations per bucket per semester
   - Auto-relaxes when remaining viable unmet buckets < remaining recommendation slots
   - Selection uses allocator-style routing: same-family non-elective-first (`required`/`choose_n` before `credits_pool`), pairwise double-count policy respected
6. **Multi-semester projection:** Semester N+1 treats prior recommended semesters as completed.

### 6.2 Dynamic Elective Pools

Elective pool children (requirement_mode = `credits_pool`) are populated dynamically from `courses.elective_pool_tag == "biz_elective"` rather than explicit mappings in `master_bucket_courses`. This avoids massive static mapping maintenance.

### 6.3 Debug/Explain Mode

Pass `debug: true` in the POST body to get a per-candidate ranking trace. Each entry shows tier, unlock count, soft tag penalty, bucket capacity, and skip reason (if not selected). Capped at `debug_limit` entries (default 30).

**Design purpose:** Answer "Why did course X rank above course Y?" without reading source code.

---

## 7. UI Specification

### 7.1 Layout

Left navigation rail with 6 items (Home, Planner, Courses, Saved, AI Advisor, Avatar) + 2x2 asymmetric planner grid (33/67 column split, equal rows).

| Quadrant | Content |
|----------|---------|
| Top-left | Profile entry (major, track, completed/in-progress courses) |
| Top-right | Progress dashboard (donut + KPIs + degree summary) |
| Bottom-left | Settings (target semester, semester count, max recs) |
| Bottom-right | Recommendations + semester selector |

### 7.2 Semester Selector

Dynamic semester tiles (1-4 semesters). Each tile is expandable to a modal with full course details, focus trap, ARIA dialog attributes, and backdrop/Escape dismissal.

### 7.3 Responsive Breakpoints

- Desktop (>1200px): Full rail + 2x2 grid
- Tablet (900-1200px): Compact rail + single column
- Mobile (<900px): Bottom tab bar + single column

### 7.4 Design Tokens

- Primary navy: `--mu-navy: #003366`
- Accent gold: `--mu-gold: #ffcc00`
- Full token set in `:root` of `style.css`

---

## 8. Programs in Workbook

| Program ID | Kind | Label | Notes |
|-----------|------|-------|-------|
| `FIN_MAJOR` | major | Finance | Default fallback (`DEFAULT_TRACK_ID`) |
| `ACCO_MAJOR` | major | Accounting | Has ACCO-specific in-tier warning boost |
| `AIM_MAJOR` | major | Applied Investment Management | |
| `BUAN_MAJOR` | major | Business Analytics | `requires_primary_major=True` |
| `HURE_MAJOR` | major | Human Resources | |
| `OSCM_MAJOR` | major | Operations and Supply Chain Management | |
| `INSY_MAJOR` | major | Information Systems | |
| `BCC_CORE` | universal | Business Core Curriculum | Auto-included when `active=true` |
| `MCC_FOUNDATION` | universal | Marquette Core Curriculum | Auto-included when `active=true` |
| `CB_TRACK` | track | Corporate Banking | parent: FIN_MAJOR |
| `FP_TRACK` | track | Financial Planning | parent: FIN_MAJOR |
| `HURE_LEAD_TRACK` | track | Leadership | parent: HURE_MAJOR |
| `AIM_CFA_TRACK` | track | CFA | parent: AIM_MAJOR |
| `AIM_FINTECH_TRACK` | track | FinTech | parent: AIM_MAJOR |
| `AIM_IB_TRACK` | track | Investment Banking | parent: AIM_MAJOR |

---

## 9. Validation and Testing

### 9.1 Workbook Governance

`python scripts/validate_track.py --all` checks:
- FK integrity (master_bucket_courses -> parent_buckets, child_buckets, courses)
- No null requirements in child_buckets
- No duplicate policy pairs
- Equivalency scope integrity
- Valid enums for type and requirement_mode

### 9.2 Test Suites

| Suite | Command | Count (v1.9.0) |
|-------|---------|----------------|
| Backend | `python -m pytest tests/backend_tests -q` | 376 |
| Frontend | `npm test` | 98 |

### 9.3 CI Pipeline

`.github/workflows/validate.yml` runs on every push/PR to main:
1. `python scripts/validate_track.py --all`
2. `python -m pytest tests/backend_tests -q`
3. `npm test`

### 9.4 Release Gates

All three must pass before any release:
1. Workbook validation (exit 0)
2. Backend tests (all passing)
3. Frontend tests (all passing)

---

## 10. Deployment

### Render Configuration

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --chdir backend server:app --bind 0.0.0.0:$PORT`
- Service root: repo root (where `requirements.txt` exists)

### Local Development

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
npm install
python backend/server.py  # http://localhost:5000
```

---

## 11. Future Roadmap

| Version | Feature | Status |
|---------|---------|--------|
| v1.9.0 | BCC decay + advisor match gate + feedback + production hardening | Shipped |
| v1.9.1 | Feedback analytics and release-note automation | Planned |
| v2.0.0 | AI-assisted discovery (non-binding, post-validated by deterministic engine) | Planned |

**Design constraint:** The deterministic engine remains source of truth. AI suggestions cannot override deterministic rule outputs.

---

## 12. Important Notes

- MarqBot is a planning aid. Final enrollment decisions belong to official advising and registration workflows.
- `FIN_MAJOR` is `DEFAULT_TRACK_ID` -- used as fallback when no program is selected, not a hard default in the UI.
- `BUAN_MAJOR` requires a primary major (`requires_primary_major=True`). Solo declaration returns `PRIMARY_MAJOR_REQUIRED` error.
- Workbook is maintained via Codex in VS Code with manual diff review.
