# MarqBot
![Version](https://img.shields.io/badge/version-v1.7.11-003366?style=for-the-badge&logo=bookstack&logoColor=ffcc00)

MarqBot is a Marquette degree-planning assistant for business students. It recommends next-term courses, explains requirement progress, and checks can-take eligibility from workbook-driven rules.

Current release line: `v1.7.11` (latest local session build).

## Upcoming Patch Plan
- Fix KPI cards for consistency and correctness across dashboard surfaces.
- Add a visible credits counter for completed, in-progress, and remaining credits.
- Configure student standings logic (freshman/sophomore/junior/senior) more explicitly in recommendations.
- Fix non-elective child-bucket tie-break routing when one course can satisfy multiple non-elective children.

## Guide

<details open>
<summary><strong>Part A (Non-Technical)</strong></summary>

### What it does
- Helps plan next semester(s) from completed and in-progress classes.
- Shows progress by requirement buckets and child buckets.
- Lets students check a specific class in **Can I Take This Next Semester?**.
- Shows warnings for standing, major declaration, and low offering confidence.

### How recommendations work (simple)
1. **Eligibility baseline**: Only courses you can actually take are considered (prereqs/standing/warnings checked).
2. **Tiered priority**:
   - Tier 1: MCC + `BCC_REQUIRED`
   - Tier 2: selected major buckets
   - Tier 3: selected track buckets
   - Tier 4: demoted BCC children (`BCC_ETHICS`, `BCC_ANALYTICS`, `BCC_ENHANCE`)
3. **Inside each tier**: Courses that unlock more future options are favored.
4. **Bucket diversity**: The engine avoids over-filling one bucket in one semester (soft cap with auto-relax when needed).
5. **Carry-forward planning**: Semester N+1 assumes prior recommended semesters were completed.

### Why this is student-friendly
- Keeps foundational requirements visible early.
- Prevents recommendations that are technically blocked.
- Balances short-term progress with long-term unlock value.
- Avoids confusing duplicate satisfaction within the same major family.

### Current academic scope
- 7 business majors and 5 tracks in the workbook model.
- Universal overlays:
  - `BCC_CORE` (Business Core Curriculum)
  - `MCC_CORE` (Marquette Core Curriculum)

### Important note
- MarqBot is a planning aid. Final enrollment decisions still belong to official advising and registration workflows.

</details>

<details open>
<summary><strong>Part B (Technical)</strong></summary>

### Stack
- Backend: Flask + pandas
- Frontend: vanilla JS modules + HTML/CSS
- Data source: `marquette_courses_full.xlsx`

### Key paths
- Backend API: `backend/server.py`
- Loader/normalization: `backend/data_loader.py`
- Allocation: `backend/allocator.py`
- Eligibility: `backend/eligibility.py`
- Recommender: `backend/semester_recommender.py`
- Double-count policy logic: `backend/requirements.py`

### Recommendation mechanism (technical)
1. **Load and normalize workbook**:
   - `parent_buckets`, `child_buckets`, `master_bucket_courses`
   - course metadata (`prereq_hard`, `prereq_soft`, `warning_text`, offerings)
2. **Build active plan scope**:
   - Selected major(s), selected track, and active universal parents.
3. **Generate course-to-bucket candidates**:
   - Explicit mappings from `master_bucket_courses`
   - Dynamic elective mappings from `courses.elective_pool_tag == "biz_elective"` for elective pool children
4. **Rank candidates by tier and tie-breakers**:
   - Tier, ACCO in-tier warning boost, unlockers, warning penalties, coverage, prereq level
5. **Greedy pick loop with soft diversity cap**:
   - Default cap of 2 recommendations per bucket, auto-relaxed when diversity becomes too low.
6. **Allocate to progress with policy rules**:
   - Same-family default deny, cross-family default allow, explicit override precedence.
   - Same-family non-elective-first routing (`required` / `choose_n` before `credits_pool`).
7. **Project across semesters**:
   - Recommendations are applied virtually to produce multi-semester outcomes.

### Data model and design docs
- ERD and model notes: `docs/data_model.md`
- Decision rationale and architecture choices: `docs/decision_explaination.md`
- Quick alias link: `docs/decision_explanation.md`
- Project release timeline: `docs/PROJECT_HISTORY.md`

### API endpoints
- `GET /courses`
- `GET /programs`
- `POST /recommend`
- `POST /can-take`

### Local setup
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm install
```

### Run
```powershell
.\.venv\Scripts\python.exe backend/server.py
```
Open `http://localhost:5000`.

### Validation and tests
```powershell
.\.venv\Scripts\python.exe scripts/validate_track.py --all
.\.venv\Scripts\python.exe -m pytest tests/backend_tests -q
cmd /c npm test --silent
```

### Render dashboard settings
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --chdir backend server:app --bind 0.0.0.0:$PORT`
- Service root must be repo root (where `requirements.txt` exists).

</details>

<details open>
<summary><strong>Part C (Roadmap Note)</strong></summary>

- See `v4_roadmap.md` for long-range features and roadmap sequencing.

</details>
