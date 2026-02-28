# Data Injection Guide — MarqBot

> **Purpose:** Step-by-step instructions for an AI agent to parse pasted catalog text and update the `data/` CSV files. Use this reference at the start of every session where the user pastes catalog entries or requirement tables.

---

## Stage 1 — Raw Course Injection

**Files modified:** `data/courses.csv`, `data/course_prereqs.csv`, `data/course_offerings.csv`

**Input format:** One or more catalog blocks in roughly this shape:

```
DEPT NNNN: Course Title Description: … Prereq: … Note: … Last four terms offered: …
```

Fields may be absent (e.g., no `Prereq:` line, no `Note:`). Handle gracefully.

---

### Step 1 — Parse Each Catalog Block

Extract these components from each entry:

| Component | Where to extract |
|---|---|
| `course_code` | Token before the first `:` (e.g., `ACCO 4040`) |
| `title` | Text after the first `:`, up to `Description:` |
| `description` | Text between `Description:` and `Prereq:` / `Note:` / `Last four terms` |
| `prereq_raw` | Text after `Prereq:`, up to `Note:` or `Last four terms` |
| `notes_raw` | Text after `Note:`, up to `Last four terms` |
| `mcc_tag` | Substring in `notes_raw` matching `Marquette Core Curriculum: <TAG>` |
| `terms_raw` | Text after `Last four terms offered:` |

If any labeled section is absent, treat that component as empty / `none`.

---

### Step 2 — Insert or Update

For **each** of the three CSV files:
1. Search the `course_code` column for the parsed code.
2. **Found** → edit that row in-place.
3. **Not found** → append a new row at the end.

Never duplicate a row. If you append, preserve the column order exactly.

**Hard completeness rule (required):**
- Any newly added `courses.csv` row must also get a row in `course_prereqs.csv` and `course_offerings.csv` in the same session.
- If details are unknown at injection time, use placeholders:
  - `course_prereqs.csv`: `prerequisites=none`, `min_standing=0.0` (or `0` after numeric cleanup), other fields blank.
  - `course_offerings.csv`: set all tracked term columns to `False` until verified.

---

### Step 3 — Write `data/courses.csv`

Column order: `course_code, course_name, credits, level, active, notes, elective_pool_tag, description`

#### 3a. `course_code`
Verbatim from Step 1. Preserve the space between dept and number (e.g., `ACCO 4040`, not `ACCO4040`).

#### 3b. `course_name`
Title text from Step 1. Strip leading/trailing whitespace.

#### 3c. `credits`
- Default: `3`
- If catalog states `"X cr."` or `"X credits"` → use that integer.
- If catalog states a range `"1–3"` or `"1-4"` (variable) → use the **minimum** (e.g., `1`). Add credit range to `notes` (see §3f).
- If internship/work period with S/U grading → `0`.

#### 3d. `level`
First digit of the course number × 1000.

| Course code | Level |
|---|---|
| `BUAD 1001` | `1000` |
| `LEAD 2000` | `2000` |
| `FINA 3001` | `3000` |
| `ACCO 4040` | `4000` |

#### 3e. `active`
Always `True` for any newly added or catalog-confirmed course.

#### 3f. `notes`
Concatenate any of the following that apply (semicolons between distinct clauses):

| Condition | Notes entry |
|---|---|
| S/U grading | `S/U grade assessment.` |
| Variable credits | `Catalog credits range: X-Y.` |
| Enrollment restriction | Copy verbatim (e.g., `REAP students only`, `Restricted to ACCO majors`) |
| MCC tag present | Copy the raw tag string (e.g., `Marquette Core Curriculum: NSM Crossing Boundaries`) |
| OR-chain prereq too complex to parse exactly | `TODO: complex prereq; extracted codes=A, B, C` |
| Catalog says "Catalog details pending" | `Catalog details pending validation.` |

Leave empty (``) if none apply.

#### 3g. `elective_pool_tag`

| Dept prefix | Tag |
|---|---|
| `ACCO` `AIM` `BUAD` `BUAN` `BULA` `ECON` `ENTP` `FINA` `HURE` `INBU` `INSY` `LEAD` `MANA` `MARK` `OSCM` `REAL` | `biz_elective` |
| All others (`ENGL` `HIST` `PHIL` `THEO` `CORE` `CMST` `COMM` `ANTH` `EDUC` `HEAL` `HOPR` `INGS` `INPS` `LLAC` `MATH` `SOCI` `SOWJ` `SPAN` `THAR`) | *(empty)* |

#### 3h. `description`
Leave empty (``) unless the user explicitly requests it be populated.

---

### Step 4 — Write `data/course_prereqs.csv`

Column order: `course_code, prerequisites, prereq_warnings, concurrent_with, min_standing, notes, warning_text`

#### 4a. `prerequisites`

Parse `prereq_raw` using this decision table:

| Pattern in prereq_raw | `prerequisites` value |
|---|---|
| Absent / `"none"` / no prereq stated | `none` |
| `"ACCO 4020"` (single hard prereq) | `ACCO 4020` |
| `"ACCO 4020; FINA 3001"` (multiple AND) | `ACCO 4020;FINA 3001` (semicolons, no spaces) |
| `"ACCO 4020, which may be taken concurrently"` | `ACCO 4020` (strip the concurrent clause; handle in §4c) |
| `"INSY 3001 or ACCO 4050"` (OR branch) | `INSY 3001 or ACCO 4050` — add `hard_prereq_complex` warning |
| Enrollment-only (`"Restricted to ACCO majors"`, `"Enrolled in CoB"`) | `none` |
| `"Instructor consent required"` | `none` |
| `"Accepted into X program"` / `"Admitted to X"` | `none` |
| `"Corequisite: X"` (must take together, not pre) | `none` — add `may_be_concurrent` flag and set concurrent_with |

**Format rule:** Multiple hard prereqs joined with semicolons (`;`), no spaces around semicolon.

#### 4b. `prereq_warnings`

Comma-separated flags. Include **all** that apply:

| Trigger in catalog text | Flag |
|---|---|
| `"may be taken concurrently"` / `"Corequisite:"` | `may_be_concurrent` |
| Major/program enrollment restriction (`"Restricted to"`, `"declared X major"`) | `major_restriction` |
| Standing requirement explicitly stated (`"Junior standing"`, `"Senior standing required"`) | `standing_requirement` |
| `"Instructor consent"` / `"Faculty approval"` | `instructor_consent` |
| `"Admitted to"` / `"Accepted into"` / `"Acceptance to program"` | `admitted_program` |
| OR chain in prereqs (`"A or B or C"`) | `hard_prereq_complex` |
| Math/language placement test | `placement_required` |
| Ambiguous or multi-branch rule needing human review | `manual_review` |

Leave empty if none apply.

#### 4c. `concurrent_with`

If prereq_raw contains `"may be taken concurrently"` or `"Corequisite:"`, set to the course code of the concurrent course.
Otherwise leave empty.

#### 4d. `min_standing`

Use the deepest **direct** prerequisite's course-code level to determine standing:

| Situation | `min_standing` |
|---|---|
| No prerequisites at all | `0.0` |
| All direct prereqs are 1000-level | `1.0` |
| Highest direct prereq is 2000-level | `2.0` |
| Highest direct prereq is 3000-level | `3.0` |
| Highest direct prereq is 4000-level | `4.0` |
| Explicit `"sophomore standing"` stated | `2.0` |
| Explicit `"junior standing"` stated | `3.0` |
| Explicit `"senior standing"` stated | `4.0` |

**Rule:** Explicit standing text overrides the inferred level. When multiple prereqs exist, use the highest-level one.

#### 4e. `notes` (prereqs sheet)

Copy any enrollment detail from `prereq_raw` not captured by the flags above:
- `"Alternate non-business pathways exist; catalog review may be needed."`
- `"Topics vary."` (for 4931-style courses)
- `"TODO: complex prereq; extracted codes=…"` (OR chains)
- Leave empty if nothing to add.

#### 4f. `warning_text`

Human-readable override shown to the student at plan-check time. Populate **only** for hard enrollment restrictions:
- Major restriction → e.g., `"ACCO major declaration required"`
- Admitted program → e.g., `"Acceptance to the REAP program required"`
- Leave empty otherwise.

---

### Step 5 — Write `data/course_offerings.csv`

Column order: `course_code, Spring 2025, Summer 2025, Fall 2025`

Parse `terms_raw`. For each current semester column:

| Column | Set to `True` if… |
|---|---|
| `Spring 2025` | `"2025 Spring Term"` appears in `terms_raw` |
| `Summer 2025` | `"2025 Summer Term"` appears in `terms_raw` |
| `Fall 2025` | `"2025 Fall Term"` appears in `terms_raw` |

Set to `False` if the semester is not mentioned.
If `terms_raw` is entirely absent → all three `False`.

**Note on semester column updates:** When new semesters are added to the CSV header (e.g., Spring 2026), update this lookup table here and add the new column to all existing rows before inserting new courses.

---

### Step 6 — Record MCC Discovery Theme Tag (Stage 1 only — do not edit bucket CSVs yet)

If `mcc_tag` is present (e.g., `"NSM Crossing Boundaries"`):
1. Store the raw string in `courses.csv` `notes` field (already handled in §3f).
2. **Do not** edit `master_bucket_courses.csv` or any bucket CSV in Stage 1.
3. Record the parsed mapping for Stage 2 using the tables below.

#### Discovery Theme name → parent bucket ID

| Theme name in catalog | Parent bucket ID |
|---|---|
| Cognition, Memory & Intelligence | `MCC_DISC_CMI` |
| Basic Needs and Justice | `MCC_DISC_BNJ` |
| Crossing Boundaries | `MCC_DISC_CB` |
| Expanding Our Horizons | `MCC_DISC_EOH` |
| Individuals and Communities | `MCC_DISC_IC` |

#### Tier abbreviation → child bucket role suffix

| Abbreviation in catalog | Child bucket suffix | Meaning |
|---|---|---|
| `HUM` | `_HUM` | Humanities |
| `NSM` | `_NSCI` | Natural Science & Mathematics |
| `SSCI` | `_SSCI` | Social Science |
| *(no abbreviation — elective slot)* | `_ELEC` | Discovery Elective |

**Example:** `"NSM Crossing Boundaries"` → parent `MCC_DISC_CB`, child `MCC_DISC_CB_NSCI`.

---

### Worked Example — ACCO 4040

**Input pasted by user:**
```
ACCO 4040: International Accounting Description: An overview of accounting
issues faced by multinational corporations or firms involved in international
business. Prereq: ACCO 4020, which may be taken concurrently. Note: Marquette
Core Curriculum: NSM Crossing Boundaries Last four terms offered: 2025 Fall
Term, 2024 Fall Term, 2023 Fall Term, 2023 Spring Term
```

**Parsed components:**
```
course_code : ACCO 4040
title       : International Accounting
prereq_raw  : ACCO 4020, which may be taken concurrently
notes_raw   : Marquette Core Curriculum: NSM Crossing Boundaries
mcc_tag     : NSM Crossing Boundaries
terms_raw   : 2025 Fall Term, 2024 Fall Term, 2023 Fall Term, 2023 Spring Term
```

**Action:** `ACCO 4040` already exists in courses.csv (row 12) — update in-place.

**`courses.csv` row result:**
```
ACCO 4040,International Accounting,3,4000,True,Marquette Core Curriculum: NSM Crossing Boundaries,biz_elective,
```

**`course_prereqs.csv` row result:**
```
ACCO 4040,ACCO 4020,may_be_concurrent,ACCO 4020,4.0,,
```
- `prerequisites`: `ACCO 4020` (concurrent clause stripped)
- `prereq_warnings`: `may_be_concurrent` (concurrent phrasing present; no other warnings)
- `concurrent_with`: `ACCO 4020`
- `min_standing`: `4.0` (direct prereq ACCO 4020 is 4000-level)

**`course_offerings.csv` row result:**
```
ACCO 4040,False,False,True
```
- `Spring 2025`: `False` (not in terms_raw)
- `Summer 2025`: `False` (not in terms_raw)
- `Fall 2025`: `True` (`2025 Fall Term` present)

**MCC note (Stage 2 reference):**
`NSM Crossing Boundaries` → parent `MCC_DISC_CB`, child `MCC_DISC_CB_NSCI`. No CSV edits in Stage 1.

---

## Quick Reference

### Business dept prefixes → `biz_elective`
```
ACCO  AIM  BUAD  BUAN  BULA  ECON  ENTP  FINA
HURE  INBU  INSY  LEAD  MANA  MARK  OSCM  REAL
```

### `prereq_warnings` flags
```
may_be_concurrent   major_restriction    standing_requirement
instructor_consent  admitted_program     hard_prereq_complex
manual_review       placement_required
```

### `min_standing` quick lookup
| Direct prereq level | Value |
|---|---|
| No prereqs | `0.0` |
| 1000-level | `1.0` |
| 2000-level | `2.0` |
| 3000-level | `3.0` |
| 4000-level | `4.0` |
| Stated "junior standing" | `3.0` |
| Stated "senior standing" | `4.0` |

### `credits` edge cases
| Catalog says | `credits` value |
|---|---|
| `"3 cr."` (default) | `3` |
| `"1-3"` (variable) | `1` (minimum) |
| `"0 credits"` / S/U work period | `0` |
| `"4 cr."` (e.g., MATH 1450) | `4` |

---

## Stage 2 — Program Requirements Injection

*(To be added — covers `data/parent_buckets.csv`, `data/child_buckets.csv`, `data/master_bucket_courses.csv`)*

Pending MCC handling reminder: see `docs/data_injection_stage2.md` ("Known Pending MCC Items") for `MCC_CULM`, `MCC_ESSV2`, `MCC_WRIT`, and Discovery status.
