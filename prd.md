# MARQUETTE FINANCE ADVISOR CHATBOT - PROJECT PRD
Version: 1.0
Last Updated: February 18, 2026
Project Owner: Markie Ngo
Status: Planning Phase

---

## 1. EXECUTIVE SUMMARY

### 1.1 Problem Statement
Marquette University Finance majors waste 2-5 hours per semester manually checking prerequisites, validating course offerings, and determining optimal course sequencing. The current system (CheckMarq) displays graduation requirements but provides zero guidance on "what courses should I take next semester?"

### 1.2 Solution
An AI-powered course advising chatbot that analyzes a student's completed courses and recommends 2-3 specific Finance courses for their target semester, with prerequisite validation and major progress tracking.

### 1.3 Success Metrics
- Reduce course planning time from 2-5 hours to <10 minutes per semester
- 90%+ prerequisite accuracy
- Successfully recommend courses for 10+ Finance students by end of Spring 2026
- Positive feedback from professor + 5 student testers

### 1.4 Timeline
- Week 1: Data collection (complete course catalog)
- Week 2: UI development + API integration
- Week 3: Testing + bug fixes
- Week 4: Polish + demo presentation
- Target launch: March 2026 (demo version)

---

## 2. PRODUCT OVERVIEW

### 2.1 Target Users

**Primary:**
- Marquette University Finance majors
- Sophomore-Senior level (have completed some business core)
- Self-service students who prefer quick answers over scheduling advisor meetings

**Secondary (future):**
- Other business majors (Accounting, Marketing, etc.)
- Freshmen (limited utility until business core complete)

**Out of scope:**
- Non-business majors
- Graduate students
- Academic advisors (this is student-facing only)

### 2.2 Core Use Cases

**Use Case 1: Sophomore planning Fall semester**
- User: Finance major, completed FINA 3001 + all business core
- Input: Completed courses, target semester = Fall 2026
- Output: "Take FINA 4001 (required core) + FINA 4011 (required core)"
- Value: Knows exactly which required courses to prioritize

**Use Case 2: Junior planning last year**
- User: Finance major, completed 2/3 core + 1 elective
- Input: Completed courses, target semester = Spring 2027
- Output: "Take FINA 4011 (last required core) + 2 electives from [list]"
- Value: Clear path to graduation

**Use Case 3: Sophomore exploring options**
- User: Finance major, just completed FINA 3001
- Input: Completed courses, target semester = Spring 2027
- Output: "You can take FINA 4001, 4011, or 4050. Recommend 4001 (required core) first."
- Value: Understands priority order

**Use Case 4: Student checking prerequisites**
- User: Wants to take FINA 4075
- Input: Completed courses list
- Output: "❌ Cannot take FINA 4075 - missing prerequisite FINA 3001"
- Value: Saves time from attempting to register for ineligible courses

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 User Input (Must Have)
- ✅ Searchable multi-select for completed courses (with paste fallback)
- ✅ Searchable multi-select for in-progress courses
- ✅ Dropdown for target semester (Fall 2026, Spring 2027, Summer 2027, Fall 2027)
- ✅ Major selection (hardcoded to "Finance" for MVP)
- ✅ "Get Recommendations" button
- ✅ Optional "Can I take this?" single course check mode

### 3.2 Output Display (Must Have)
- ✅ List of 2-3 recommended courses with:
  - Course code + name
  - Prerequisites (with ✓ or ❌ status; amber for in-progress)
  - Brief reasoning ("Required core" or "Good elective because...")
  - Courses unlocked by taking this course
- ✅ Finance major progress summary per bucket:
  - Completed (applied)
  - In-progress (shown, not counted as done)
  - Remaining courses needed
- ✅ Double-counted courses shown transparently
- ✅ Allocation notes ("FINA 4050 could also count toward X but that bucket is satisfied")
- ✅ Rough graduation timeline estimate (with stated assumptions)
- ✅ Manual review list for courses with unsupported prereq formats
- ✅ Error messaging with structured error codes

### 3.3 Backend Logic (Must Have)
- ✅ Load course catalog from Excel file (3 sheets)
- ✅ Normalize + validate course code input
- ✅ Parse prerequisites (explicit grammar: none, single, AND via ;, OR via "or")
- ✅ Deterministic eligibility filter: offered this term + prereqs met + not completed/in-progress
- ✅ Bucket allocation algorithm (priority-based, handles double-counting)
- ✅ Requirement progress per bucket
- ✅ Direct unlock computation (reverse-prereq map)
- ✅ Blocking warnings (unmet Finance electives only)
- ✅ Rough graduation timeline from allocator slot counts
- ✅ OpenAI GPT for ranking + explanation only (never determines eligibility)

### 3.4 Out of Scope (MVP)
- Section times / live scheduling
- Live registrar data integration
- Workload balancing
- Transitive unlock chains
- GPA / grade requirements
- Multiple majors or concentrations

---

## 4. TECHNICAL SPECIFICATIONS

### 4.1 Architecture

```
┌─────────────┐
│   Student   │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP Request
       ▼
┌─────────────────────────┐
│   Frontend (HTML/JS)    │
│   - Multi-select input  │
│   - Response display    │
└──────┬──────────────────┘
       │
       │ POST /recommend
       ▼
┌─────────────────────────┐
│  Backend (Flask/Python) │
│  - Normalize input      │
│  - Filter eligible      │
│  - Allocate buckets     │
│  - Call OpenAI API      │
└──────┬──────────────────┘
       │
       │ API Request (6-10 pre-filtered candidates only)
       ▼
┌─────────────────────────┐
│   OpenAI GPT model      │
│   - Rank candidates     │
│   - Write explanations  │
│   - Return JSON only    │
└──────┬──────────────────┘
       │
       │ Return recommendations
       ▼
┌─────────────────────────┐
│  Display to Student     │
└─────────────────────────┘
```

### 4.2 Tech Stack

**Frontend:**
- HTML5 (semantic structure)
- CSS3 (Marquette branding: blue #003366, gold #FFC82E)
- Vanilla JavaScript (no frameworks)
- Responsive design (mobile-friendly)

**Backend:**
- Python 3.9+
- Flask (minimal web server)
- pandas (Excel data loading)
- openpyxl (Excel file reading)
- openai (API client)
- python-dotenv (environment variables)

**Data Storage:**
- Excel (.xlsx) — 3 sheets: courses, buckets, course_bucket_map
- No database (simple file-based for MVP)

**External APIs:**
- OpenAI model (default: gpt-4o-mini; configurable via OPENAI_MODEL)

**Hosting (MVP):**
- Local development only (localhost:5000)
- Future: Deploy to Vercel/Netlify/Render

### 4.3 Data Model

**Sheet 1: courses**
| Column | Type | Example |
|---|---|---|
| course_code | String | "FINA 4075" |
| course_name | String | "FinTech Foundations" |
| credits | Integer | 3 |
| prerequisites | String | "FINA 3001" |
| offered_fall | Boolean | TRUE |
| offered_spring | Boolean | TRUE |
| offered_summer | Boolean | FALSE |
| level | Integer | 4000 |
| notes | String | "Every other year" |

**Sheet 2: buckets**
| Column | Type | Example |
|---|---|---|
| bucket_id | String | "finance_elective" |
| label | String | "Finance Electives" |
| priority | Integer | 2 (1=highest) |
| needed_count | Integer or null | 3 |
| needed_credits | Integer or null | null |
| min_level | Integer or null | 4000 |

**Sheet 3: course_bucket_map**
| Column | Type | Example |
|---|---|---|
| course_code | String | "FINA 4050" |
| bucket_id | String | "finance_elective" |
| can_double_count | Boolean | TRUE |

**Prerequisite Format Rules:**
- Single: `"FINA 3001"`
- Multiple (AND): `"ECON 1103; ACCO 1030"`
- Multiple (OR): `"FINA 4001 or FINA 5001"` (case-insensitive)
- None: `"none"`
- Anything else → unsupported, manual review required

**Finance Major Requirement Buckets (MVP):**
```python
ALLOWED_DOUBLE_COUNT_PAIRS = {
    frozenset(["finance_elective", "business_elective"]),
}
MAX_BUCKETS_PER_COURSE = 2
```

### 4.4 API Design

**POST /recommend**

Request:
```json
{
  "completed_courses": ["FINA 3001", "ECON 1103"],
  "in_progress_courses": ["FINA 4001"],
  "target_semester": "Fall 2026",
  "requested_course": null,
  "max_recommendations": 3
}
```

Standard response:
```json
{
  "mode": "recommendations",
  "recommendations": [{
    "course_code": "FINA 4011",
    "course_name": "Investment Analysis",
    "why": "Required core course...",
    "prereq_check": "FINA 3001 ✓",
    "primary_bucket": "core_required",
    "fills_buckets": ["core_required"],
    "unlocks": ["FINA 4050", "FINA 4075"]
  }],
  "in_progress_note": "Prerequisites satisfied via in-progress courses assume successful completion.",
  "blocking_warnings": ["Completing FINA 3001 would unlock 4 Finance electives you can't yet take."],
  "progress": {
    "core_required": {
      "completed_applied": ["FINA 3001"],
      "in_progress_applied": ["FINA 4001"],
      "remaining_courses": ["FINA 4011"],
      "needed": 3,
      "done_count": 1,
      "satisfied": false
    }
  },
  "double_counted_courses": [],
  "allocation_notes": [],
  "manual_review_courses": [],
  "timeline": {
    "remaining_slots_total": 7,
    "remaining_credits": 21,
    "estimated_min_terms": 3,
    "disclaimer": "Rough estimate. Assumes 3 major courses/term, all courses offered each term."
  },
  "error": null
}
```

Can-take mode (requested_course set):
```json
{
  "mode": "can_take",
  "requested_course": "FINA 4090",
  "can_take": false,
  "why_not": "Missing prerequisite FINA 4001.",
  "missing_prereqs": ["FINA 4001"],
  "not_offered_this_term": false,
  "unsupported_prereq_format": false,
  "next_best_alternatives": [...]
}
```

Can-take with unsupported prereq:
```json
{
  "mode": "can_take",
  "requested_course": "FINA 4095",
  "can_take": null,
  "why_not": "Cannot determine eligibility: prerequisite format requires manual review.",
  "unsupported_prereq_format": true,
  "next_best_alternatives": [...]
}
```

Error codes: `INVALID_INPUT`, `NO_ELIGIBLE_COURSES`, `API_ERROR`

**GET /courses** — returns full course list for multi-select UI

### 4.5 File Structure
```
marqbot/
├── frontend/
│   ├── index.html          # Multi-select UI + semester dropdown
│   ├── style.css           # Marquette branding
│   └── app.js              # Multi-select, fetch, render by mode
├── backend/
│   ├── server.py           # Flask: POST /recommend, GET /courses
│   ├── normalizer.py       # Course code normalization + validation
│   ├── prereq_parser.py    # Grammar parser (none/single/AND/OR/unsupported)
│   ├── eligibility.py      # Deterministic filter + multi-bucket scoring
│   ├── allocator.py        # Bucket allocation algorithm
│   ├── requirements.py     # ALLOWED_DOUBLE_COUNT_PAIRS, MAX_BUCKETS_PER_COURSE
│   ├── unlocks.py          # Reverse-prereq map + blocking warnings
│   ├── timeline.py         # Rough timeline from allocator slot counts
│   └── prompt_builder.py   # LLM prompt (candidates only)
├── data/
│   └── marquette_courses.xlsx
├── tests/
│   ├── test_normalizer.py
│   ├── test_prereq_parser.py
│   ├── test_eligibility.py
│   ├── test_allocator.py
│   ├── test_unlocks.py
│   └── test_cases.json
├── .env                    # OPENAI_API_KEY (gitignored)
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 5. DATA REQUIREMENTS

### 5.1 Course Catalog Coverage

**Must Have:**
- All Finance courses (FINA 3XXX, FINA 4XXX): ~30 courses
- All Business Core courses: ~15 courses
- Prerequisites accurately mapped

**Data Collection Method:**
1. Navigate to Marquette University Bulletin
2. Copy Finance course descriptions (raw text)
3. Extract into Excel format
4. Manual verification of prerequisites and bucket assignments

### 5.2 Data Quality Standards

**Accuracy Requirements:**
- 100% accuracy on prerequisite chains (critical for student success)
- 95%+ accuracy on semester offerings (Fall/Spring)
- 90%+ accuracy on course names/codes

**Validation Process:**
- Cross-check against official Marquette bulletin
- Test with known student scenarios
- Verify at least 3 prerequisite chains manually
- Run startup integrity validation (course codes in map must exist in catalog)

### 5.3 Data Maintenance

**Update Frequency:**
- Course catalog: Once per semester
- Prerequisites: As needed
- Offerings: Annually

---

## 6. USER EXPERIENCE

### 6.1 User Flow
```
1. Student lands on page
2. Selects completed courses via searchable multi-select
3. Selects in-progress courses via searchable multi-select
4. Selects target semester from dropdown
5. Optionally enters a specific course to check eligibility
6. Clicks "Get Recommendations"
7. Loading indicator appears (~2-3 seconds)
8. Results display:
   - 2-3 recommendation cards (course, prereqs, why, unlocks)
   - Progress per bucket (completed vs in-progress vs remaining)
   - Double-count transparency
   - Graduation timeline estimate
9. Student can adjust inputs and re-submit
```

### 6.2 UI/UX Requirements

**Design Principles:**
- Clean, minimal, student-friendly
- Mobile-responsive
- Fast (<3 second response time)
- Clear error messages

**Branding:**
- Marquette colors (blue #003366, gold #FFC82E)
- Sans-serif fonts (Helvetica, Arial fallback)

**Prerequisite Label Colors:**
- Green ✓: completed prerequisite satisfied
- Amber (in progress) ✓: in-progress prerequisite (with disclaimer)
- Red ❌: missing prerequisite
- Amber banner: manual review required (unsupported prereq format)

### 6.3 Example Inputs

**Example 1: Sophomore**
- Completed: FINA 3001, ECON 1103, ECON 1104, ACCO 1030, MATH 1450, BUAD 1001
- Target: Fall 2026

**Example 2: Junior**
- Completed: FINA 3001, FINA 4001, ECON 1103, ECON 1104, ACCO 1030, ACCO 1031, MARK 3001, INSY 3001
- Target: Spring 2027

**Example 3: Senior**
- Completed: FINA 3001, FINA 4001, FINA 4011, FINA 4050, FINA 4060, [all business core]
- Target: Fall 2026

---

## 7. TESTING & QUALITY ASSURANCE

### 7.1 Test Scenarios

| Case | Input | Expected |
|---|---|---|
| Sophomore happy path | completed: FINA 3001 + core, Fall 2026 | Recommend FINA 4001, FINA 4011 |
| In-progress prereq satisfied | completed: FINA 3001, in-progress: FINA 4001 | FINA 4050 eligible; "(in progress) ✓" label |
| Missing prereq | no FINA 3001 | FINA 4001/4011 excluded; no AI override |
| Can-take: eligible | requested: FINA 4011, has prereqs | can_take: true |
| Can-take: missing prereq | requested: FINA 4090, missing FINA 4001 | can_take: false, missing_prereqs shown |
| Can-take: unsupported prereq | requested course has "permission of instructor" | can_take: null, manual review |
| Wrong semester | Spring-only course, Fall request | Excluded from eligible set |
| OR prereq | needs FINA 4001 or FINA 5001; has FINA 5001 | Eligible |
| Unsupported prereq | "permission of instructor" in catalog | manual_review_courses list |
| Messy input | "fina3001, FINA-4001" | Normalized correctly |
| Invalid input | "asdfasdf" | INVALID_INPUT error |
| All reqs met | all Finance courses complete | Progress 100%, no remaining |
| Blocking warning | core course blocks 3+ unmet electives | Warning surfaced |
| Double-count happy path | FINA 4050 maps to finance_elective + business_elective; both unmet | Applied to both; shown in double_counted_courses |
| Double-count disallowed pair | core_required + finance_elective pair | Applied to core_required only |
| Double-count bucket full | Both eligible; one already satisfied | Applied to remaining bucket; allocation_notes explain |
| Allocation order | Course A: only finance_elective; Course B: finance_elective or business_elective | A placed first; B assigned to business_elective |
| In-progress not counted as done | FINA 4001 in-progress in core_required bucket | satisfied: false; shown in in_progress_applied |

### 7.2 Testing Strategy

**Unit Tests:**
- Normalizer (regex, edge cases)
- Prereq parser (all grammar types, unsupported signals)
- Allocator (allocation order, double-count, disallowed pairs, bucket full)
- Eligibility filter (term, prereq, not-completed checks)
- Unlocks (reverse map, blocking warning count)

**Integration Tests:**
- Full flow: multi-select input → POST /recommend → recommendations rendered
- Excel loading + data integrity validation
- Error handling paths

**User Acceptance Testing:**
- Test with 5 real Finance students
- Collect feedback on recommendations
- Verify accuracy with official advisor

### 7.3 Success Criteria

**Technical:**
- 95%+ uptime (local dev)
- <3 second response time
- All unit tests pass
- Zero cases of recommending ineligible courses

**User Satisfaction:**
- 4/5+ average rating from student testers
- "Would use again" >80%

**Accuracy:**
- 90%+ accuracy on prerequisite validation
- 85%+ accuracy on course recommendations

---

## 8. RISKS & MITIGATION

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| API rate limits | Medium | High | Cache responses, implement rate limiting |
| Prereq parsing errors | High | Critical | Extensive testing, unsupported-format fallback |
| Excel file corruption | Low | Medium | Version control, backup |
| LLM gives bad ranking | Medium | High | Prompt engineering; eligibility is never AI-determined |
| Slow API response | Low | Medium | Loading indicators, timeout handling |

### 8.2 Data Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Bulletin data outdated | High | Critical | Update each semester, add disclaimer |
| Prerequisites change | Low | High | Version control, update notifications |
| Missing courses in catalog | Medium | Medium | Phased rollout, student feedback |
| Incorrect prereq chains | Medium | Critical | Manual verification, startup integrity check |

### 8.3 User Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Students trust chatbot over advisor | High | High | Disclaimer: "Not official advising" |
| Low adoption | Medium | Medium | Demo to student orgs |
| Confused by manual review items | Medium | Low | Clear amber UI + explanation |

### 8.4 Business/Legal Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| University objects to unofficial tool | Low | Critical | Position as student project |
| Liability for bad recommendations | Low | High | Disclaimer, not official advice |
| API costs exceed budget | Low | Low | Monitor usage, set hard limits |

---

*Note: This is a student project and does not constitute official academic advising. Always verify course selections with your official academic advisor.*
