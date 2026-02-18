# MarqBot — Marquette Finance Course Advisor

A Finance major course recommendation chatbot for Marquette University. Students enter their completed and in-progress courses, pick a target semester, and receive 2–3 prioritized course recommendations with prerequisite validation, degree progress tracking, and sequencing intelligence.

## How It Works

**Backend (deterministic Python):**
- Normalizes and validates course code input
- Parses prerequisites using a strict grammar
- Filters eligible courses: offered this term + prereqs satisfied + not yet taken
- Allocates completed courses to requirement buckets (CORE → FIN\_CHOOSE\_2 → FIN\_CHOOSE\_1 → BUS\_ELEC\_4)
- Handles double-counting (one Finance elective can fill both FIN\_CHOOSE\_2 and FIN\_CHOOSE\_1)
- Computes direct unlocks and blocking warnings
- Estimates rough graduation timeline

**AI (Claude Haiku 4.5):**
- Receives 6–10 pre-filtered, pre-labeled eligible candidates
- Selects 2–3 best courses in priority order
- Writes 1–2 sentence explanations for each
- Never decides eligibility — only explains and ranks

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (MU #003366/#FFC82E), Vanilla JS |
| Backend | Python Flask + pandas + openpyxl |
| AI | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Data | `marquette_courses_full.xlsx` (5 sheets) |

## Setup

### 1. Prerequisites
- Python 3.10+
- The Excel data file at the project root: `marquette_courses_full.xlsx`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure API key

Create a `.env` file at the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Run

```bash
python backend/server.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

## Data File

The app reads `marquette_courses_full.xlsx` from the project root. It expects these sheets:

| Sheet | Purpose |
|---|---|
| `courses` | Course catalog with prereq\_hard, offering flags, level |
| `equivalencies` | 4000/5000 course equivalency groups |
| `tracks` | Track metadata (currently FIN\_MAJOR) |
| `buckets` | Requirement bucket definitions and priorities |
| `bucket_course_map` | Which courses satisfy which buckets |

## Running Tests

```bash
python -m pytest tests/ -v
```

## Key Scenarios

| Scenario | Expected |
|---|---|
| Completed: `FINA 3001`, `ECON 1103`, `ACCO 1030` — Fall | Recommends FINA 4001, FINA 4011 (CORE) |
| In-progress: `FINA 3001` | FINA 4001 eligible; labeled "(in progress) ✓" |
| No `FINA 3001` completed | FINA 4001/4011 excluded |
| Requested: `FINA 4081` without prereqs | `can_take: false`, shows missing prereqs |
| Input: `fina-3001` | Normalized to `FINA 3001` correctly |
| Input: `asdfasdf` | `INVALID_INPUT` error |

## Finance Major Requirements (FIN_MAJOR)

| Bucket | Description | Count Required |
|---|---|---|
| CORE | Core Required (FINA 3001, 4001, 4011) | 3 |
| FIN\_CHOOSE\_2 | Choose Two Finance Courses (3000+ level) | 2 |
| FIN\_CHOOSE\_1 | Choose One Finance/Approved Course (3000+ level) | 1 |
| BUS\_ELEC\_4 | Business Electives | 4 |

Double-counting: A Finance elective can count toward both FIN\_CHOOSE\_2 and FIN\_CHOOSE\_1 if both buckets have remaining slots.

## Project Structure

```
marqbot/
├── backend/
│   ├── server.py          # Flask: POST /recommend, GET /courses
│   ├── normalizer.py      # Course code normalization + validation
│   ├── prereq_parser.py   # Prerequisite grammar parser
│   ├── requirements.py    # Constants (allowed double-count pairs, etc.)
│   ├── allocator.py       # Deterministic bucket allocation algorithm
│   ├── unlocks.py         # Reverse-prereq map + blocking warnings
│   ├── timeline.py        # Graduation timeline estimation
│   ├── eligibility.py     # Eligibility filter + can-take check
│   └── prompt_builder.py  # Claude prompt construction
├── frontend/
│   ├── index.html
│   ├── style.css          # Marquette branding
│   └── app.js             # Searchable dropdowns, fetch, render
├── tests/
│   ├── test_normalizer.py
│   ├── test_prereq_parser.py
│   ├── test_allocator.py
│   ├── test_unlocks.py
│   └── test_eligibility.py
├── marquette_courses_full.xlsx
├── .env                   # ANTHROPIC_API_KEY (create this yourself)
├── .gitignore
├── requirements.txt
└── prd.md
```
