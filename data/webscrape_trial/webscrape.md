# Web Scrape Strategy (Trial)

## Goal
Build a reliable data-injection workflow for MarqBot that:
- populates/refreshes catalog course metadata and descriptions across majors
- updates term-specific offerings without manual per-course searching
- writes trial outputs for human review before any production overwrite

## Decision Summary
Use a **hybrid source strategy**:

1. **Primary source for catalog data**: `https://bulletin.marquette.edu/course-descriptions/`
2. **Secondary source for offerings by term**: `https://bulletin.marquette.edu/class-search/` backend API

## Why This Split

### 1) `course-descriptions` is better for catalog completeness
- It exposes static, structured HTML blocks per subject/course.
- It includes rich catalog fields (code, title, hours, prereq, level, description text).
- Coverage check for current business target set in `data/courses.csv`:
  - target business codes in CSV: `275`
  - found from course-descriptions mapping: `274`
  - miss: `REAL 4002` (appears in prereq text, not as a standalone block)

### 2) `class-search` is better for offerings, not full catalog
- It is term-scoped and search-driven.
- Great for "is offered in Summer/Fall 2026?" booleans.
- Not suitable as primary description/catalog source due to incomplete term coverage.

## Key Findings

### Course-descriptions page structure (usable selectors)
Each course block contains:
- code: `span.text.detail-code > strong` (e.g., `ACCO 1030`)
- title: `span.text.detail-title > strong`
- credits: `span.text.detail-hours_html > strong` (e.g., `(3 credits)`)
- description: `div.courseblockextra.noindent`
- optional metadata:
  - `span.text.detail-prereq`
  - `span.text.detail-level`
  - `span.text.detail-last_four_terms_offered`
  - `span.text.detail-core`
  - `span.text.detail-interdisc`
  - `span.text.detail-schedule`

### Important slug/code mismatches
- CSV subject `AIM` maps to bulletin slug `aiim`
- CSV subject `INBU` maps to bulletin slug `inbu` (not `inbi`)

## Proposed Data Pipeline

### A) Catalog + descriptions pipeline (all majors)
Input:
- `data/courses.csv`
- `course-descriptions/{subject}/` pages

Output (trial first):
- `data/webscrape_trial/courses_proposed.csv`
- `data/webscrape_trial/matched_descriptions.csv`
- `data/webscrape_trial/unmatched_courses.csv`
- `data/webscrape_trial/run_summary.json`

Rule:
- Never overwrite production CSV directly in trial mode.

### B) Offerings pipeline (term booleans)
Input:
- `class-search` API (`route=search`) for selected terms (`srcdb`)

Output (trial first):
- `data/webscrape_trial/course_offerings_proposed.csv`
- `data/webscrape_trial/course_offerings_changed_cells.csv`

Rule:
- update only target term columns (e.g., `Summer 2026`, `Fall 2026`)
- keep previous terms intact

## Design Decisions

1. **Non-destructive first**  
All scraping writes go to `/data/webscrape_trial` for manual QA.

2. **Deterministic matching**  
Normalize course codes to `SUBJ 1234[A-Z]?` before joins.

3. **Retry/backoff networking**  
Remote host can occasionally drop connections; scraper needs retries.

4. **Coverage-first source selection**  
Descriptions from course-descriptions; offerings from class-search.

5. **Review artifacts over raw dumps**  
Store proposed CSVs + explicit mismatch reports so review is quick.

## Known Limitations
- `class-search` cannot be treated as a full historical catalog.
- Some catalog entries may exist in prerequisites text but not as standalone blocks.
- Bulletin HTML structure could change; parser should fail loudly with summary counts.

## Immediate Next Step
Implement/extend scripts so:
1. `course-descriptions` drives description/catalog updates for all majors.
2. `class-search` drives offerings columns for 2026 terms.
3. Trial outputs are generated and reviewed before production promotion.
