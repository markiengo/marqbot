# Data Injection Guide - Stage 2 Program Requirements (Parent/Child Model)

> Purpose: instructions for an AI agent to convert pasted major/track requirement text into runtime requirement data in `data/` CSVs.
> This guide mirrors Stage 1 style, but for program buckets and bucket-course mappings.

---

## Scope

Stage 2 writes requirement structure and mappings for majors/tracks using:

- `data/parent_buckets.csv`
- `data/child_buckets.csv`
- `data/master_bucket_courses.csv`
- `data/courses.csv` (only when referenced courses are missing)

No backend/frontend code changes are required for normal Stage 2 injections.

---

## Locked Runtime Conventions

Apply these rules unless the user explicitly overrides:

1. Exclude all `5xxx` and `6xxx` courses from Stage 2 course mappings.
2. Business elective pools use `requirement_mode=credits_pool`.
3. `credits_pool` buckets are intentionally unmapped in `master_bucket_courses.csv`.
4. Use `min_level=3000` for upper-division business elective pools.
5. Non-course constraints (GPA, admission, language, conduct, process) are notes only.
6. Concentration tracks use full bucket visibility (not delta-only) so overlap with parent major is explicit.

---

## Data Model (Current Runtime)

### Parent level: `parent_buckets.csv`

Columns:

- `parent_bucket_id`
- `parent_bucket_label`
- `type` (`major`, `track`, `minor`, `universal`)
- `parent_major` (required for `track`, blank for majors)
- `active`
- `requires_primary_major`
- `double_count_family_id`

### Child requirement level: `child_buckets.csv`

Columns:

- `parent_bucket_id`
- `child_bucket_id`
- `child_bucket_label`
- `requirement_mode` (`required`, `choose_n`, `credits_pool`)
- `courses_required` (used by `required` and `choose_n`)
- `credits_required` (used by `credits_pool`)
- `min_level`
- `notes`

### Course mapping level: `master_bucket_courses.csv`

Columns:

- `parent_bucket_id`
- `child_bucket_id`
- `course_code`
- `notes`

Mappings should be explicit for `required` and `choose_n` buckets.
`credits_pool` buckets should generally not be explicitly mapped.

---

## Step 1 - Parse Requirement Text into Units

From pasted catalog text, extract:

- Program name and type (major vs concentration track).
- Requirement groups that become child buckets:
  - fixed list (`required`)
  - choose N (`choose_n`)
  - credit pools (`credits_pool`)
- Course lists per non-pool requirement group.
- Advisory-only constraints (store in `notes`, do not implement logic).

Treat each section heading as a candidate bucket. Convert to the minimal bucket set needed by planner logic.

---

## Step 2 - Normalize Program IDs

Use stable IDs:

- Majors: `<SUBJECT>_MAJOR` (for example, `MARK_MAJOR`)
- Tracks: `<SUBJECT>_<TRACK>_TRACK` (for example, `MARK_PRSL_TRACK`)

For new tracks, add rows in `parent_buckets.csv`:

- `type=track`
- `parent_major=<MAJOR_ID>`
- `active=True`
- `double_count_family_id=<TRACK_ID>`

If parent row already exists, do not duplicate.

---

## Step 3 - Ensure Course Catalog Coverage First

Before writing mappings:

1. Collect all course codes referenced by non-pool requirement groups.
2. Check `data/courses.csv` for each code.
3. Append missing rows using Stage 1 defaults:
   - `credits=3` unless clearly known otherwise
   - `level` from code (first digit x 1000)
   - `active=True`
   - `notes` blank unless needed
   - `elective_pool_tag=biz_elective` for business prefixes; blank otherwise
   - `description` blank unless user explicitly asks
4. Do not add `5xxx`/`6xxx` rows for Stage 2 mapping payloads.

---

## Step 4 - Create Child Buckets

For each requirement unit, add one row in `child_buckets.csv`:

- `required`: set `courses_required=<count>`, leave `credits_required` blank.
- `choose_n`: set `courses_required=<N>`, optionally `min_level`.
- `credits_pool`: set `credits_required=<credits>`, optionally `min_level`, leave `courses_required` blank.

Use concise, stable IDs with major/track prefix:

- `mark-req-core`
- `mark-choose-3`
- `mark-biz-elec-12`

If a row already exists for `(parent_bucket_id, child_bucket_id)`, update in place instead of duplicating.

---

## Step 5 - Map Courses to Non-Pool Buckets

For each `required` and `choose_n` bucket:

1. Add one mapping row per course in `master_bucket_courses.csv`.
2. Keep `notes` blank unless there is mapping-specific context.
3. Skip excluded `5xxx`/`6xxx` alternatives.

For `credits_pool` buckets:

- Do not add explicit mappings unless user specifically requests static maps.
- Runtime dynamic elective handling will fill these from tagged courses.

---

## Step 6 - Track Modeling Rule (Important)

When the catalog has a concentration/track under a major:

- Build full track buckets, not only delta courses.
- Include overlap courses that also appear in major buckets.
- This makes overlap visible to the allocator and double-count policy layer.

Example:

- `MARK_MAJOR` has `MARK 3001`, `MARK 4060`, `MARK 4110` core.
- `MARK_PRSL_TRACK` also includes those in its own required bucket plus track-specific requirements.

---

## Step 7 - Notes-Only Constraints

Put advisory catalog rules in `child_buckets.notes` (or program documentation), not runtime gating logic:

- maximum course count from a subset (for example, "max 2 ECON")
- second language policy
- study/work abroad completion policy
- admission/application criteria
- minimum grade thresholds
- GPA/conduct/appeal policy text

Use short notes and avoid long policy prose in CSV.

---

## Implemented Stage 2 Reference (Session Baseline)

Use this as the canonical pattern for future injections.

### Programs injected

- Majors: `BECO_MAJOR`, `BADM_MAJOR`, `INBU_MAJOR`, `MARK_MAJOR`, `REAL_MAJOR`
- Tracks: `MARK_PRSL_TRACK`, `REAL_REAP_TRACK`

### Child bucket patterns used

- `BECO_MAJOR`:
  - `beco-req-core` (`required`, 5)
  - `beco-econ-3000plus-9` (`credits_pool`, 9 credits, `min_level=3000`)
  - `beco-biz-elec-9` (`credits_pool`, 9 credits, `min_level=3000`)
- `BADM_MAJOR`:
  - `badm-req-core` (`required`, 1)
  - `badm-biz-elec-27` (`credits_pool`, 27 credits, `min_level=3000`)
- `INBU_MAJOR`:
  - `inbu-functional-choose-3` (`required`, 3, `min_level=3000`)
  - `inbu-study-abroad-1` (`choose_n`, 1)
  - `inbu-exp-global-1` (`choose_n`, 1)
  - `inbu-biz-elec-15` (`credits_pool`, 15 credits, `min_level=3000`)
- `MARK_MAJOR`:
  - `mark-req-core` (`required`, 3)
  - `mark-choose-3` (`choose_n`, 3, `min_level=3000`)
  - `mark-biz-elec-12` (`credits_pool`, 12 credits, `min_level=3000`)
- `MARK_PRSL_TRACK`:
  - `prsl-req-core` (`required`, 4)
  - `prsl-choose-2` (`choose_n`, 2, `min_level=3000`)
  - `prsl-biz-elec-12` (`credits_pool`, 12 credits, `min_level=3000`)
- `REAL_MAJOR`:
  - `real-req-core` (`required`, 5)
  - `real-choose-1` (`choose_n`, 1, `min_level=3000`)
  - `real-biz-elec-12` (`credits_pool`, 12 credits, `min_level=3000`)
- `REAL_REAP_TRACK`:
  - `reap-foundation-req` (`required`, 2)
  - `reap-model-dev-choose-1` (`choose_n`, 1, `min_level=3000`)
  - `reap-applied-req` (`required`, 3)
  - `reap-biz-elec-12` (`credits_pool`, 12 credits, `min_level=3000`)

---

## Data Integrity Checks (Required)

After edits, verify:

1. No duplicate `(parent_bucket_id, child_bucket_id)` in `child_buckets.csv`.
2. No duplicate `(parent_bucket_id, child_bucket_id, course_code)` in `master_bucket_courses.csv`.
3. Every mapping points to existing parent, child, and course.
4. No mapped `5xxx`/`6xxx` courses.

Recommended quick checks:

```powershell
python scripts/validate_track.py --all
python -m pytest tests/backend -q
cd frontend
npm run test
npm run lint
npm run build
```

---

## Worked Mini Example - Marketing + Professional Selling

Input (simplified):

- MARK core: `MARK 3001`, `MARK 4060`, `MARK 4110`
- MARK choose 3 from list
- MARK 12-credit business electives
- Professional Selling concentration requires MARK core + `MARK 4094`, choose 2 from `MARK 4030/4191/4192`, plus 12-credit electives

Output model:

1. Parent rows:
   - `MARK_MAJOR` (major)
   - `MARK_PRSL_TRACK` (track, `parent_major=MARK_MAJOR`)
2. Child buckets on major:
   - `mark-req-core`, `mark-choose-3`, `mark-biz-elec-12`
3. Child buckets on track:
   - `prsl-req-core`, `prsl-choose-2`, `prsl-biz-elec-12`
4. Course mappings:
   - Explicit rows for `mark-req-core`, `mark-choose-3`, `prsl-req-core`, `prsl-choose-2`
   - No explicit mappings for `mark-biz-elec-12` and `prsl-biz-elec-12`

This preserves full overlap visibility and matches current runtime behavior.

---

## Known Pending MCC Items

- `MCC_CULM` is currently parent-only. `CORE 4929` is the target course for CULM. CULM child bucket and mapping are pending.
- `MCC_ESSV2` and `MCC_WRIT` are `active=False`. Pending future injection.
- **Discovery tiers** (`MCC_DISC` + 5 themes) are `active=False` and tagged "Coming Soon". The 5 theme parents (`MCC_DISC_BNJ`, `MCC_DISC_CB`, `MCC_DISC_CMI`, `MCC_DISC_EOH`, `MCC_DISC_IC`) operate like AIM's track model — each is a separate track-type program under `MCC_DISC`. Child buckets (HUM/NSM/SSC/ELEC per theme) and some course mappings exist for future activation. Do not activate until official Marquette data is confirmed.

## Orphaned Prereq References (Known Limitation)

Non-business courses injected for MCC Discovery or cross-department prereq resolution often have prereqs referencing courses not in `courses.csv`. This is expected.

**Rules for Stage 2:**
1. When mapping a course to a Discovery child bucket, ensure it exists in `courses.csv` and `course_prereqs.csv` (use Stage 1 defaults if prereq details are unknown).
2. Do not recursively add every upstream prereq for non-business courses. Only add courses that are directly mapped to active buckets.
3. Phantom prereq references in OR chains are harmless — the system falls back to resolvable alternatives.
4. When a Discovery theme is activated in the future, audit its mapped courses for prereq completeness at that time.

---

## Next Stage Hook

For minors, follow the same pipeline:

1. Ensure/confirm parent row (`type=minor`).
2. Add child buckets (`required`, `choose_n`, `credits_pool`).
3. Add explicit mappings for non-pool buckets.
4. Keep advisory constraints as notes unless planner logic is explicitly extended.
