# MarqBot
![Version](https://img.shields.io/badge/version-v1.7.9-003366?style=for-the-badge&logo=bookstack&logoColor=ffcc00)

MarqBot is a Marquette degree-planning assistant for business students. It recommends next-term courses, explains progress, and checks can-take eligibility from workbook-driven rules.

Current release line: `v1.7.9` (latest local session build).

## Guide

<details open>
<summary><strong>Part A (Non-Technical)</strong></summary>

### What it does
- Helps plan next semester(s) from your completed and in-progress classes.
- Shows progress by requirement buckets/sub-buckets.
- Lets you check a specific course in **Can I Take This Next Semester?**.
- Warns when a course has lower recent-offering confidence.

### How recommendations are prioritized
When MarqBot recommends courses, it follows a priority hierarchy:
1. **Universal requirements first** — Marquette Core Curriculum (MCC) and Business Core (BCC) courses are prioritized above major-specific electives, since every student needs them regardless of major.
2. **Prereq unblockers** — Courses that unlock other required classes get a boost so you stay on track.
3. **Bucket diversity** — The engine avoids recommending multiple courses for the same single-slot requirement. If a bucket only needs one course, you get one recommendation for it, and the remaining slots go toward other unmet requirements.
4. **Prereq readiness** — Lower-level courses you can take now rank before upper-level courses, keeping your plan achievable each semester.

### Who should use it
- Students building a semester plan before advising.
- Advisors who want quick what-if checks.

### Current academic scope
- 7 Business majors and 5 tracks in the workbook.
- Universal shared overlays:
  - `BCC_CORE` (Business Core Courses)
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
- Eligibility: `backend/eligibility.py`
- Double-count policy logic: `backend/requirements.py`
- Frontend app shell: `frontend/index.html`, `frontend/app.js`, `frontend/style.css`

### Data model docs
- ERD and relationship notes: `docs/data_model.md`
- Project release history: `docs/PROJECT_HISTORY.md`

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
<summary><strong>Part C (In Progress / Upcoming Devs)</strong></summary>

- ESSV2 courses, Discovery Tier courses, Writing Intensive (WRIT) incoming soon.
- Additional rule-governance hardening and policy explainability improvements.
- Expanded planner workflow for saved plans and AI advisor UI surfaces.
- See `v4_roadmap.md` for specifics.

</details>
