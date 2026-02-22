# MarqBot

![Python](https://img.shields.io/badge/Python-3.14-3776AB?style=flat-square&logo=python&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)
![pandas](https://img.shields.io/badge/pandas-150458?style=flat-square&logo=pandas&logoColor=white)
![pytest](https://img.shields.io/badge/pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=flat-square&logo=jest&logoColor=white)
![Claude Opus 4.6](https://img.shields.io/badge/Claude_Opus_4.6-7B68EE?style=flat-square&logo=anthropic&logoColor=white)

MarqBot is a degree-planning app for Marquette business students. It helps you plan what to take next, check if you can take a specific class, and see how close you are to finishing your requirements.

---

## Part A - For Students (Non-Technical)

## What MarqBot Does
MarqBot is your semester planning assistant. It helps you turn your current classes into a practical next-step plan.

MarqBot helps you:
- choose your declared major(s) and optional track
- add completed and current in-progress courses
- get recommended courses for your next term (or next two terms)
- check a specific class with "Can I Take This?"
- see requirement progress in a visual dashboard

## Majors and Tracks Currently Included
Majors:
- Finance Major
- Accounting Major
- Human Resources Major
- Business Analytics Major
- Operations and Supply Chain Major
- Information Systems Major
- AIM Major

Tracks and concentrations:
- Corporate Banking (CB)
- Financial Planning (FP)
- Business Leadership (HURE)
- AIM CFA: Investments
- AIM Applied FinTech
- AIM Private Capital & Investment Banking

Note:
- Business Analytics is modeled as a secondary major and must be paired with a primary major.
- AIM is modeled as a secondary major and must be paired with a primary major.

## How Recommendations Are Chosen (Simple Version)
MarqBot first filters to classes you can realistically take:
- prerequisites are satisfied
- class is offered in the selected term
- class is not already completed or in-progress

Then it ranks eligible courses by:
1. Requirements first: courses in higher-priority requirement buckets are favored.
2. Bigger progress impact: courses that fill more unmet requirement buckets are favored.
3. Earlier sequence: lower prerequisite level is favored when ties remain.

This means MarqBot prioritizes courses that move you forward in your degree, not just any open class.

## How Prerequisite Assumptions Work
You do not need to manually enter every lower-level prerequisite if you already entered a higher-level course.

Example:
- if you add an advanced class, MarqBot can infer required prerequisite chains behind it
- inferred prerequisites are shown in notes so you can see exactly what was assumed

Important:
- required chains are inferred for supported prerequisite formats
- OR-choice and concurrent-optional prerequisite branches are not auto-assumed

## What Degree Progress Means
- Green: courses already completed.
- Yellow: current in-progress courses that are assumed completed for projection.
- White: still remaining.

You will also see:
- requirement cards by bucket/sub-bucket
- current snapshot progress and projected progress with in-progress classes
- assumption notes that explain inferred prerequisite courses

## Core Features
- Recommendation planning for up to three semesters
- Inline "Can I Take This?" checker
- Current vs projected progress visualization
- Double-count transparency notes when a course applies to multiple requirement buckets
- Keyboard-friendly searchable selectors

## How To Use
1. Select your major(s), then optional track if applicable.
2. Add completed courses.
3. Add courses you are taking now.
4. Set target semester(s) and recommendation count.
5. Click **Get Recommendations**.
6. Review progress + suggestions, then use **Can I Take This?** for specific classes.

## What MarqBot Does Not Replace
- MarqBot is a planning aid. Final course decisions should still be confirmed with your advisor and official registration systems.

---

## Part B - For Developers (Technical)

## Architecture Overview
Backend (Flask + pandas):
- `backend/server.py`: API orchestration and response assembly
- `backend/data_loader.py`: strict workbook loading + runtime normalization
- `backend/eligibility.py`: eligibility filtering and ranking
- `backend/allocator.py`: requirement allocation and overlap handling
- `backend/requirements.py`: policy resolution for double/triple/N-way counting
- `backend/semester_recommender.py`: semester recommendation pipeline

Frontend (vanilla JS modules):
- `frontend/index.html`: UI structure
- `frontend/style.css`: tokens and component styling
- `frontend/app.js`: state, events, orchestration
- `frontend/modules/api.js`: fetch wrappers
- `frontend/modules/multiselect.js`: searchable selectors
- `frontend/modules/rendering.js`: HTML render helpers
- `frontend/modules/session.js`: local session persistence

## Frontend Token Migration Note
- Canonical tokens:
  - Spacing uses `--sp-1` to `--sp-10`.
- Legacy aliases (temporary):
  - `--sp-xs`, `--sp-sm`, `--sp-md`, `--sp-lg`, `--sp-xl`.
- Allowed raw-px exceptions:
  - border/outline widths
  - shadow/blur values
  - SVG stroke/ring sizes
  - icon dimensions
  - animation timing values
- Removal condition:
  - Alias tokens can be removed after spacing usage is fully canonical and visual/regression QA is green.

## API Endpoints
- `GET /courses`
- `GET /programs`
- `POST /recommend`
- `POST /can-take` (standalone inline eligibility check)

---

## Data Model (Workbook)

Primary workbook: `marquette_courses_full.xlsx`

The workbook uses a **V2 schema** — a two-level hierarchy of `buckets` → `sub_buckets` that the runtime derives into a flat requirement list. The loader in `backend/data_loader.py` enforces strict V2 on startup; missing required sheets raise an error immediately.

### Sheet Reference

| Sheet | Purpose |
|---|---|
| `courses` | Master catalog of all course codes, credits, names, and scheduling flags |
| `programs` | Top-level programs (majors) and sub-programs (tracks/concentrations) |
| `buckets` | Requirement groups scoped to a program (e.g. "Finance Core") |
| `sub_buckets` | Specific requirement slots within a bucket (e.g. "FINA 3310 or equivalent") |
| `courses_all_buckets` | Many-to-many mapping of courses to sub_bucket slots, per program |
| `course_prereqs` | Prerequisite expressions per course (hard, soft/warning, concurrent) |
| `course_offerings` | One row per term per course; drives offered_fall/spring/summer derivation |
| `course_equivalencies` | Groups of interchangeable courses (e.g. FINA 3310 ↔ BUAD 3310) |
| `double_count_policy` | Explicit allow/deny rules for a course counting toward multiple buckets |
| `README` | Authoring guide embedded directly in the workbook |

---

### `courses` sheet

The master course catalog. One row per course code.

| Column | Type | Notes |
|---|---|---|
| `course_code` | string | Primary key. Example: `FINA 3310`. |
| `course_name` | string | Display name shown in UI. |
| `credits` | int | Credit hours. |
| `offered_fall` | bool | Whether the course has ever been offered in fall. Derived at load time from `course_offerings`. |
| `offered_spring` | bool | Same, for spring. |
| `offered_summer` | bool | Same, for summer. |
| `offering_confidence` | string | `confirmed`, `likely`, `unknown`, etc. Pulled from the latest term in `course_offerings`. |
| `last_four_terms` | string | Comma-joined human-readable term labels for the four most recent offering rows. |
| `prereq_hard` | string | Parsed prerequisite expression. Overlaid from `course_prereqs` at load time. |
| `prereq_soft` | string | Warning-level prerequisite note (not blocking). |
| `prereq_concurrent` | string | Courses that may or must be taken concurrently. |
| `prereq_level` | string | Minimum standing (e.g. `sophomore`, `junior`). |

---

### `programs` sheet

Defines all programs — both standalone majors and track/concentration sub-programs.

| Column | Type | Notes |
|---|---|---|
| `program_id` | string | Primary key. Uppercase. Example: `FIN_MAJOR`, `CB`, `FP`. |
| `program_label` | string | Human-readable display name. |
| `kind` | string | `major` or `track`. |
| `parent_major_id` | string | For tracks: the `program_id` of the owning major. Empty for majors. |
| `active` | bool | Whether the program appears in the UI dropdown. |
| `requires_primary_major` | bool | If true, this program must be paired with a separate primary major (used by secondary majors like AIM and BUSA). |

Display label derivation rule: `<CODE>_MAJOR` → `<DISPLAY_CODE> Major`. Code aliases applied at runtime: `FIN → FINA`, `INSY → IS`. Use stable `program_id` values in the workbook; UI labels are always derived.

---

### `buckets` sheet

Requirement groups owned by a program. Think of these as the top-level sections of a degree checklist.

| Column | Type | Notes |
|---|---|---|
| `program_id` | string | FK → `programs.program_id`. |
| `bucket_id` | string | Unique within a program. Example: `fin_core`. |
| `bucket_label` | string | Display name. Example: `Finance Core`. |
| `priority` | int | Lower number = higher recommendation priority. Default 99 if omitted. |
| `track_required` | string | If set, this bucket only activates when the student is enrolled in the specified track. |
| `active` | bool | Inactive buckets are ignored by the runtime. |

---

### `sub_buckets` sheet

Specific requirement slots within a bucket. One sub-bucket = one requirement that must be satisfied.

| Column | Type | Notes |
|---|---|---|
| `program_id` | string | FK → `programs.program_id`. |
| `bucket_id` | string | FK → `buckets.bucket_id`. |
| `sub_bucket_id` | string | Unique within a program+bucket. |
| `sub_bucket_label` | string | Display name shown on progress cards. |
| `role` | string | `core` or `elective`. Drives recommendation priority weighting when explicit `priority` is omitted. |
| `priority` | int or null | Explicit override. If null, derived from parent bucket priority + role weight + position index. |
| `courses_required` | int or null | Minimum courses that must satisfy this slot. If null and `credits_required` is also null, validator raises an error. |
| `credits_required` | int or null | Minimum credits that must satisfy this slot (alternative to `courses_required`). |
| `min_level` | int or null | Minimum course level (e.g. `3000`). |

Priority derivation formula (when `priority` is null):
```
effective_priority = (parent_bucket_priority × 100) + (role_weight × 10) + within_parent_index
```
where `role_weight` is 0 for `core`, 5 for `elective`, 9 for anything else.

---

### `courses_all_buckets` sheet

The many-to-many mapping between courses and sub-bucket slots, scoped per program.

| Column | Type | Notes |
|---|---|---|
| `program_id` | string | FK → `programs.program_id`. |
| `sub_bucket_id` | string | FK → `sub_buckets.sub_bucket_id`. |
| `course_code` | string | FK → `courses.course_code`. |
| `notes` | string | Optional annotation shown in the UI (e.g. "counts as elective only"). |

A single course can appear in multiple rows with different `sub_bucket_id` values — this is how double-counting is modeled. The `double_count_policy` sheet controls whether those overlapping assignments are allowed at runtime.

Legacy alias: the sheet was previously named `course_sub_buckets`. The loader checks for `courses_all_buckets` first and falls back to the legacy name for compatibility-read only.

---

### `course_prereqs` sheet

Prerequisite data separated from the main courses catalog for easier maintenance.

| Column | Type | Notes |
|---|---|---|
| `course_code` | string | FK → `courses.course_code`. |
| `prerequisites` | string | Hard prerequisite expression. Supports AND/OR logic and parentheses. Example: `FINA 3310 AND (FINA 3320 OR BUAD 3320)`. |
| `prereq_warnings` | string | Soft/recommended prerequisite, not blocking. |
| `concurrent_with` | string | Courses allowed or required concurrently. |
| `min_standing` | string | Minimum academic standing required. |

At load time, these columns are overlaid onto the `courses` dataframe as `prereq_hard`, `prereq_soft`, `prereq_concurrent`, and `prereq_level`.

---

### `course_offerings` sheet

One row per term per course. Drives offered-by-season flags derived at load time.

| Column | Type | Notes |
|---|---|---|
| `course_code` | string | FK → `courses.course_code`. |
| `term_code` | string | Format: `YYYYSS` where SS is `FA`, `SP`, or `SU`. Example: `2024FA`. |
| `offered` | bool | Whether the course was/is offered in that term. |
| `confidence` | string | Data quality note. The most recent non-empty confidence value is propagated to `courses.offering_confidence`. |

The loader groups rows by course, sorts descending by term, and derives `offered_fall`, `offered_spring`, `offered_summer` as OR across all matching rows. The four most recent term codes become `last_four_terms`.

---

### `course_equivalencies` sheet

Groups of interchangeable courses. A student completing any one course in a group satisfies requirements that list any other member.

| Column | Type | Notes |
|---|---|---|
| `equiv_group_id` | string | Groups courses together. Example: `eq_fina3310`. |
| `course_code` | string | Member of this equivalency group. |
| `restriction_note` | string | (or `notes`) Optional display annotation. |
| `program_scope` | string | If set, this equivalency is only active for the specified `program_id`. Normalized internally to `scope_program_id`. |

---

### `double_count_policy` sheet

Explicit rules controlling whether a course may count toward multiple requirement buckets simultaneously.

| Column | Type | Notes |
|---|---|---|
| `program_id` | string | Program this policy applies to. |
| `node_type_a` | string | Type of the first node: `bucket` or `sub_bucket`. |
| `node_id_a` | string | ID of the first node. |
| `node_type_b` | string | Type of the second node. |
| `node_id_b` | string | ID of the second node. |
| `allow_double_count` | bool | Whether overlap between these two nodes is allowed. |
| `reason` | string | Authoring note explaining the policy decision. |

Pairs are canonical (A, B) = (B, A). The validator warns on duplicate canonical pairs.

---

### Runtime Derivation

The loader performs these transformations before returning data to the server:

1. **`programs` → `tracks_df`**: Flattens programs into a unified track list used by the eligibility and recommendation engines. Orphan tracks with no `parent_major_id` are auto-parented if exactly one major exists.
2. **`buckets` + `sub_buckets` + `courses_all_buckets` → `buckets_df` + `course_bucket_map_df`**: Builds the flat runtime requirement list and course-to-bucket mapping used by the allocator.
3. **`course_prereqs` overlay**: Merges prereq columns onto `courses_df` by course code.
4. **`course_offerings` overlay**: Derives offered-by-season flags and confidence metadata from row-per-term data.

The runtime never reads raw V2 sheets directly — all consumption goes through these derived dataframes.

---

### Validation

Run the workbook validator before any release:

```powershell
.\.venv\Scripts\python.exe scripts/validate_track.py --all
```

The validator enforces:
- All required sheets present
- No sub-buckets where both `courses_required` and `credits_required` are null
- No duplicate canonical pairs in `double_count_policy`
- No `scope_program_id` values in `course_equivalencies` that reference non-existent programs

---

## Local Setup
1. Python environment:
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

2. Frontend test dependencies:
```powershell
npm install
```

## Run
```powershell
.\.venv\Scripts\python.exe backend/server.py
```
Open: `http://localhost:5000`

## Test and Validation Commands
Backend tests:
```powershell
.\.venv\Scripts\python.exe -m pytest tests/backend_tests -q
```

Frontend tests:
```powershell
cmd /c npm test --silent
```

Data validator:
```powershell
.\.venv\Scripts\python.exe scripts/validate_track.py --all
```

## Contribution Guidance
- Keep API changes additive whenever possible.
- Preserve frontend IDs used by `app.js`.
- Prefer deterministic behavior over hidden heuristics.
- Update tests with every behavior change.
- Treat workbook contract changes as migration-level changes, not incidental edits.

---

## Upcoming Work (In Progress)

Upcoming roadmap highlights:
- **V3.4**: Marquette Common Core (MCC) universal overlay.
- **V3.5-V3.7**: degree-rule enforcement, local multi-plan semester grid, and production hardening.
- **V4.0.0**: AI launch (assistive, non-binding lane).

For full technical scope, execution details, interfaces, and test gates, see:
- `v4_roadmap.md`
---

## Canonical Project Narrative
See `PROJECT_HISTORY.md` for the consolidated phase-by-phase history.



