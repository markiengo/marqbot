# MarqBot
![Version](https://img.shields.io/badge/version-v1.9.0-003366?style=for-the-badge&logo=bookstack&logoColor=ffcc00)

MarqBot is a Marquette degree-planning assistant for business students. It recommends next-term courses, explains requirement progress, and checks can-take eligibility from workbook-driven rules.

Current release line: `v1.9.0`.

## Upcoming Patch Plan
- Validate advisor-match quality across larger freshman and sophomore profile sets.
- Add release automation for changelog tagging and GitHub release note publishing.

## Guide

<details open>
<summary><strong>Part A (Non-Technical)</strong></summary>

### What it does
- Helps plan next semester(s) from completed and in-progress classes.
- Shows progress by requirement buckets.
- Lets students check a specific class in **Can I Take This Next Semester?**.
- Shows warnings for standing, major declaration, and low offering confidence.

### How recommendations work (simple)
1. **Eligibility baseline**: Only courses you can actually take are considered (prereqs/standing/warnings checked).
2. **Tiered priority (locked order)**:
   - Tier 1: MCC + `BCC_REQUIRED` (before BCC decay threshold)
   - Tier 2: selected major buckets
   - Tier 3: selected track buckets
   - Tier 4: decayed `BCC_REQUIRED` (when `BCC_DECAY_ENABLED=true` and `>=12/18` BCC_REQUIRED courses are applied)
   - Tier 5: demoted BCC sub-groups (`BCC_ETHICS`, `BCC_ANALYTICS`, `BCC_ENHANCE`)
3. **Inside each tier**:
   - ACCO-only warning boost applies in-tier (`Required for ACCO majors`) and does not jump tiers.
   - Unlockers and warning penalties act as tie-breakers, not top-level priority overrides.
4. **Bucket diversity**: The engine avoids over-filling one bucket in one semester (soft cap with auto-relax when needed).
5. **Carry-forward planning**: Semester N+1 assumes prior recommended semesters were completed.

### Double-major sharing behavior
- Courses can be shared across different major families by default.
- This includes required children and elective-pool children across majors when mappings allow.
- Same-family children still do not double count by default.
- Track and parent-major families follow track-aware family rules; explicit policy rows can override defaults.

### Why this is student-friendly
- Keeps foundational requirements visible early.
- Prevents recommendations that are technically blocked.
- Balances short-term progress with long-term unlock value.
- Avoids confusing duplicate satisfaction within the same major family.
- Keeps credit pools interpretable: `12 credits` typically means about `4` 3-credit courses, not `12` courses.

### Current academic scope
- 7 business majors and 6 tracks in the workbook model.
- Universal overlays:
  - `BCC_CORE` (Business Core Curriculum)
  - `MCC_FOUNDATION` (Marquette Core Curriculum)

### Near-term focus
- Validate diversity-cap behavior across dense multi-major plans.
- Keep recommendation traces readable for advisor reviews.
- Maintain deterministic routing between non-elective and elective children.

### Important note
- MarqBot is a planning aid. Final enrollment decisions still belong to official advising and registration workflows.

</details>

<details open>
<summary><strong>Part B (Technical)</strong></summary>

### Stack
- Backend: Flask + pandas
- Frontend: Next.js 16 + React 19 + TypeScript
- Data source: `marquette_courses_full.xlsx`

### Key paths
- Backend API: `backend/server.py`
- Loader/normalization: `backend/data_loader.py`
- Allocation: `backend/allocator.py`
- Eligibility: `backend/eligibility.py`
- Recommender: `backend/semester_recommender.py`
- Double-count policy logic: `backend/requirements.py`
- Frontend app: `frontend/src`

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
   - Selection uses allocator-style routing (same-family non-elective-first + pairwise double-count checks), so semester packing matches allocation behavior.
6. **Allocate to progress with policy rules**:
   - Same-family default deny, cross-family default allow, explicit override precedence.
   - Same-family non-elective-first routing (`required` / `choose_n` before `credits_pool`).
   - Cross-major elective sharing works through the same cross-family default allow.
7. **Project across semesters**:
   - Recommendations are applied virtually to produce multi-semester outcomes.

### Data model and design docs
- Product requirements and architecture: `mds/PRD.md`
- Release history and design decisions: `mds/CHANGELOG.md`

### API endpoints
- `GET /api/courses`
- `GET /api/programs`
- `GET /api/health`
- `POST /api/recommend`
- `POST /api/can-take`

### Local setup
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm ci
```

### Run
```powershell
.\.venv\Scripts\python.exe scripts/run_local.py
```
`scripts/run_local.py` auto-builds `frontend/out` when missing, then starts Flask.

Open `http://localhost:5000`.

### Validation and tests
```powershell
.\.venv\Scripts\python.exe scripts/validate_track.py --all
.\.venv\Scripts\python.exe -m pytest tests/backend -q
cd frontend && npm run test
cd frontend && npm run lint
cd frontend && npm run build
```
Current local baseline: backend `366` passing; frontend utility tests, lint, and build succeed.

### Render dashboard settings
- Runtime: `Docker`
- Dockerfile: `./Dockerfile` (multi-stage build compiles `frontend/out` and runs Gunicorn)
- Service root must be repo root (where `requirements.txt` exists).

</details>

<details open>
<summary><strong>Part C (Roadmap Note)</strong></summary>

- See **mds/PRD.md -> Section 11 (Future Roadmap)** for long-range features and sequencing.
- For every release, update `mds/PRD.md`, `README.md`, and `mds/CHANGELOG.md`, then sync the latest GitHub release notes from those docs.

</details>
