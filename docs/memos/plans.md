# Backend Test Expansion Plan — Pre-Injection Hardening

## Context

We're about to inject a large batch of new data: non-business courses, new majors/tracks, and expanded bucket mappings. The current test suite (~700 tests across 21 files) covers the engine well but has gaps around **data integrity**, **per-program smoke coverage**, and **recommendation quality invariants** that would let bad data slip through undetected. This plan adds ~200+ tests across 3 new files and extends 4 existing files to catch injection regressions before they reach users.

---

## New File 1: `tests/backend/test_data_integrity.py`

**Purpose**: CSV schema validation + cross-CSV referential integrity + prereq graph sanity. Runs against live `data/` CSVs. ~50 tests.

### 1A. Schema checks (parametrized per CSV)

For each of the 7 CSVs, verify:
- File exists and is non-empty
- Required columns present (exact set per CSV — use column lists from `data_loader.py`)
- No fully blank rows
- No duplicate primary keys:
  - `courses.csv` → `course_code`
  - `parent_buckets.csv` → `parent_bucket_id`
  - `child_buckets.csv` → `(parent_bucket_id, child_bucket_id)` composite
  - `master_bucket_courses.csv` → `(parent_bucket_id, child_bucket_id, course_code)` composite
  - `course_prereqs.csv` → `course_code`
  - `course_offerings.csv` → `course_code`
  - `double_count_policy.csv` → `(bucket_a, bucket_b)` composite

**Pattern**: `@pytest.mark.parametrize("csv_name,required_cols,pk_cols", SCHEMA_SPECS)` with a single test function.

### 1B. Cross-CSV referential integrity

| FK column | Source CSV | Target CSV | Target PK |
|---|---|---|---|
| `parent_bucket_id` | `child_buckets.csv` | `parent_buckets.csv` | `parent_bucket_id` |
| `parent_bucket_id` | `master_bucket_courses.csv` | `parent_buckets.csv` | `parent_bucket_id` |
| `(parent_bucket_id, child_bucket_id)` | `master_bucket_courses.csv` | `child_buckets.csv` | composite |
| `course_code` | `master_bucket_courses.csv` | `courses.csv` | `course_code` |
| `course_code` | `course_prereqs.csv` | `courses.csv` | `course_code` |
| `course_code` | `course_offerings.csv` | `courses.csv` | `course_code` |
| `parent_major` | `parent_buckets.csv` (where type=track) | `parent_buckets.csv` | `parent_bucket_id` |
| `bucket_a`, `bucket_b` | `double_count_policy.csv` | `child_buckets.csv` | `child_bucket_id` |

One parametrized test per FK relationship. Each asserts the set difference is empty.

### 1C. Prereq graph sanity

- **No self-prereqs**: no course lists itself in `prerequisites`
- **No cycles**: BFS/DFS cycle detection on the full prereq graph (parse `prerequisites` column, build adjacency list)
- **Prereq references exist**: every course_code mentioned in a `prerequisites` cell exists in `courses.csv` (warning-level — known orphans for non-business courses are expected, so collect and assert count < threshold, e.g. < 30)
- **Standing range**: all `min_standing` values in `[1.0, 5.0]`
- **Prereq type valid**: parsed prereq type in `{single, and, or, none}` or tagged `hard_prereq_complex`

### 1D. Bucket sanity

- Every active parent bucket has >= 1 child bucket
- Every child bucket has >= 1 course mapping in `master_bucket_courses.csv` OR is a `credits_pool` type
- `requirement_mode` values are in `{required, choose_n, credits_pool}`
- `courses_required` is set when mode is `required` or `choose_n`
- `credits_required` is set when mode is `credits_pool`

---

## New File 2: `tests/backend/test_program_smoke.py`

**Purpose**: For every active program, hit `/recommend` with a clean-slate student and verify a non-error response with >= 1 recommendation. ~80 tests (dynamic, grows with data).

### 2A. Dynamic case generation

Reuse pattern from `test_dead_end_fast.py`:

```python
def _active_programs():
    """Discover all active majors, tracks, minors from server catalog."""
    from server import _get_program_catalog
    catalog = _get_program_catalog()
    majors = sorted([p["id"] for p in catalog if p["active"] and p["type"] == "major" and not p.get("applies_to_all")])
    tracks = sorted([p["id"] for p in catalog if p["active"] and p["type"] == "track"])
    minors = sorted([p["id"] for p in catalog if p["active"] and p["type"] == "minor"])
    return majors, tracks, minors
```

### 2B. Smoke tests (parametrized)

**Single-major smoke** (`test_smoke_major[{id}]`):
- Payload: declared_majors=[id] (+ primary major if `requires_primary_major`), empty completed/in_progress, Fall 2026, 1 semester, max_recs=6
- Assert: HTTP 200, `semesters` list non-empty, first semester has >= 1 recommendation
- Assert: no duplicate course_codes within a semester

**Single-track smoke** (`test_smoke_track[{id}]`):
- Payload: declared_majors=[parent_major], track_id=id, same defaults
- Same assertions

**Single-minor smoke** (`test_smoke_minor[{id}]`):
- Payload: declared_majors=[any active major], declared_minors=[id], same defaults
- Same assertions

### 2C. Response structure invariants

Every smoke test also checks:
- Each recommendation has: `course_code`, `course_name`, `credits`, `fills_buckets`
- `credits` is a positive integer
- `course_code` matches `[A-Z]{2,4} \d{4}` pattern
- `fills_buckets` is a list (can be empty for filler courses)

---

## New File 3: `tests/backend/test_recommendation_quality.py`

**Purpose**: Engine-level invariants that must hold regardless of data. ~60 tests.

### 3A. Tier ordering invariant

For a handful of representative majors (FIN, ACCO, MKTG, MGMT, BUAN, REAL):
- Generate recommendations for a freshman (empty completed)
- Assert: no tier-3 (elective) course appears when tier-1 (gateway/core) courses remain unsatisfied
- Implementation: check `tier` field in debug trace, or infer from `fills_buckets` bucket types

### 3B. Standing gate enforcement

- Create payloads with `completed_courses` that give < 2.0 standing (freshman)
- Request recommendations
- Assert: no course with `min_standing >= 3.0` appears in results
- Parametrize across 3-4 standing thresholds

### 3C. No-duplicate invariant

- For every smoke case, assert: no course_code appears twice across ALL semesters in a multi-semester run
- Parametrize: 5 representative majors x 3-semester runs

### 3D. Convergence check

- For 5 representative majors, run 6-semester simulation
- Assert: total unsatisfied buckets decreases monotonically (or stays same) across semesters
- Allow plateau (same count) but never increase

### 3E. Completed-course exclusion

- Provide `completed_courses` with 3-4 courses
- Assert: none of those course_codes appear in recommendations
- Same for `in_progress_courses`

### 3F. Max-recommendations cap

- Set `max_recommendations=4`
- Assert: each semester has <= 4 recommendations
- Parametrize across 3 majors

---

## Modifications to Existing Files

### 4A. `tests/backend/test_dead_end_fast.py`

Add new entries to `CURATED_COMBOS` for injected program pairs. After injection, add combos like:
- New major + existing track overlap (e.g., new major + FINTECH_TRACK)
- Two new majors together (if any require primary)
- New major + minor combination

*Placeholder section — exact combos depend on which programs are injected.*

### 4B. `tests/backend/test_regression_profiles.py`

Add 2-3 new profile classes post-injection for new programs:
- One freshman-level profile per new major
- One mid-path (junior) profile per new major with realistic completed courses
- Follow existing class pattern: `PAYLOAD` dict + assertion methods

*Placeholder — profiles created after injection with hand-verified expected behavior.*

### 4C. `tests/backend/test_validate_track.py`

Add a **live-data meta-test** that runs `validate_track --all` against actual CSVs:

```python
def test_validate_all_tracks_live():
    """Run full validation suite against live data/ CSVs."""
    from validate_track import validate_track, load_data
    data = load_data()
    for track_id in get_active_tracks(data):
        errors = validate_track(track_id, data)
        assert not errors, f"Track {track_id} validation failed: {errors}"
```

### 4D. `eval/advisor_gold.json`

Post-injection, add 2-3 gold profiles per new major. Each requires hand-verification of expected_top6 against advisor knowledge. Not automatable — flagged as manual follow-up after data lands.

---

## File Summary

| Action | File | Est. Tests |
|---|---|---|
| **New** | `tests/backend/test_data_integrity.py` | ~50 |
| **New** | `tests/backend/test_program_smoke.py` | ~80 (dynamic) |
| **New** | `tests/backend/test_recommendation_quality.py` | ~60 |
| Modify | `tests/backend/test_dead_end_fast.py` | +5-10 combos |
| Modify | `tests/backend/test_regression_profiles.py` | +6-9 classes |
| Modify | `tests/backend/test_validate_track.py` | +1 meta-test |
| Manual | `eval/advisor_gold.json` | +6-9 profiles |

---

## Key Reusable Patterns

- **`dead_end_utils.py`**: `PlanCase`, `simulate_terms()`, `classify_dead_end()`, `run_case_and_assert()` — reuse for quality tests
- **`server._get_program_catalog()`**: dynamic program discovery — reuse for smoke + integrity tests
- **`data_loader.py`**: `load_parent_buckets()`, `load_child_buckets()`, etc. — reuse for integrity tests (don't re-parse CSVs manually)
- **Flask test client pattern**: `app.test_client()` from `server.py` — reuse for smoke + quality tests
- **`conftest.py`**: already adds `backend/` and `scripts/` to path — no changes needed

---

## Verification

1. `pytest tests/backend/test_data_integrity.py -v` — all schema + referential checks pass on current data
2. `pytest tests/backend/test_program_smoke.py -v` — every active program gets a valid response
3. `pytest tests/backend/test_recommendation_quality.py -v` — all invariants hold
4. `pytest tests/backend -q` — full suite still passes (no regressions)
5. After data injection: re-run all above + manually verify new gold profiles in `eval/advisor_gold.json`

---

## Recommended Additions After Full Codebase Read

The baseline Plan 1 work now largely exists in the repo. The next valuable layer is smaller and more targeted: cover the API contracts that frontend code depends on, and add a few runtime-model integrity checks that raw CSV validation still misses.

### New File 4: `tests/backend/test_recommend_api_contract.py`

**Purpose**: Harden the `/recommend` request/response contract directly. A lot of this behavior is exercised indirectly today, but the endpoint surface still has thin explicit coverage. ~25-35 tests.

#### 4E. Input validation matrix

Add endpoint tests for:

- invalid JSON body -> `400 INVALID_INPUT`
- `max_recommendations` outside `[1, 15]`
- `target_semester_count` outside `[1, 8]`
- malformed semester labels in:
  - `target_semester_primary`
  - `target_semester_secondary`
  - `target_semester_tertiary`
  - `target_semester_quaternary`
- request with no declared majors and no track context -> `400 INVALID_INPUT`
- `requested_course` not in catalog -> `400 INVALID_INPUT`
- inconsistent completed / in-progress prereq state -> `400 INCONSISTENT_INPUT`

#### 4F. Response contract invariants

For a valid response, assert:

- `mode == "recommendations"`
- top-level `recommendations`, `target_semester`, and `standing` mirror `semesters[0]`
- `current_progress` is present and is a dict
- `current_assumption_notes` is present and is a list
- `error is None`
- `selection_context` exists for declared-program requests
- `selection_context.selected_program_ids` and `selection_context.selected_program_labels` have matching lengths

#### 4G. Semester-generation behavior

Add targeted tests for:

- `include_summer=False` filters explicit summer labels out and backfills with fall/spring labels
- `include_summer=True` preserves summer labels
- `target_semester_count=1` returns exactly one semester
- `target_semester_count=8` returns exactly eight semesters

Why this is worth adding:

- `recommend()` now carries a lot of request parsing and response shaping logic
- current coverage is strongest on engine behavior, not endpoint contract edges
- this is where frontend-breaking regressions can slip through without failing allocator / eligibility tests

---

### New File 5: `tests/backend/test_validate_prereqs_endpoint.py`

**Purpose**: Lock down the onboarding dependency on `/validate-prereqs`. The core logic is tested already, but the HTTP contract is not. ~10-15 tests.

Add cases for:

- empty body -> `200 {"inconsistencies": []}`
- valid completed/in-progress pair with no issue -> empty list
- direct inconsistency returns offending completed course
- transitive inconsistency returns all offending completed courses
- unknown / malformed course codes do not 500
- `/validate-prereqs` and `/api/validate-prereqs` return the same payload
- response shape is always exactly `{ "inconsistencies": [...] }`

Why this matters:

- onboarding now depends on this API for real-time warning state
- pure logic tests in `test_input_validation.py` do not protect against request parsing or alias-route regressions

---

### Extend `tests/backend/test_data_integrity.py`

Add live-data assertions that are not covered yet:

- every active program in `parent_buckets.csv` has a non-empty label
- every active track's `parent_major` points to an active major, not just any existing parent row
- `course_offerings.csv` values are boolean-like / parseable, not arbitrary strings
- every active non-minor program produces at least one runtime bucket after `load_data()`
- every active non-minor program has at least one runtime course mapping after conversion to runtime data

Why:

- current integrity tests mostly validate raw CSV relationships
- they do not fully validate that the loaded runtime model remains publishable and usable after conversion

---

### Extend `tests/backend/test_program_smoke.py`

Add a small second layer of smoke coverage:

- representative 3-semester smoke for 3-5 majors
- representative 3-semester smoke for 2-3 tracks
- one `include_summer=True` smoke case
- assertion that `selection_context` is present and coherent on successful declared-program requests

Why:

- the current file proves semester 1 works
- it does not yet catch label-generation or later-semester progression bugs

---

### Extend `tests/backend/test_recommendation_quality.py`

Add a few more cross-program invariants:

- no returned recommendation should fill only already-satisfied buckets
- `selected_program_ids` should remain stable across multi-semester runs
- explicit summer runs should preserve non-decreasing progress the same way fall/spring runs do

Keep this section small. The file is already doing the highest-value engine checks, so only add invariants that protect against real regressions.

---

## What Not To Add Right Now

These would create more maintenance cost than safety at this stage:

- full JSON snapshot tests for `/recommend`
- exact top-6 course order assertions for every active program
- one gold profile per program before the new data settles
- tests for every copy string or warning sentence
- more unit tests for helpers already covered indirectly through endpoint + engine tests

The suite is healthiest if it stays heavy on invariants and light on brittle snapshots.

---
---

# Plan 2: AI Advisor Feature

**Status**: Deprioritized -- `/ai-advisor` page exists as placeholder but feature has not shipped. Focus shifted to nightly autotune and planner accuracy.
**Target version**: v2.3.0 (original, now deferred)
**Date**: 2026-03-04 (original target)

---

## Context

MarqBot's planner is deterministic and data-driven -- great for accuracy, but students still want to ask questions about their degree plan in natural language. The AI Advisor is a standalone chat feature that lets students ask "What should I take next?" or "Is it worth adding a minor?" and get answers grounded in their actual profile data. It does **not** replace or modify the deterministic recommendation engine.

**Cost**: gpt-4o-mini at $0.15/1M input + $0.60/1M output. A full 20-message session costs <$0.01. At estimated scale (50-200 users/month, ~5 sessions each), total monthly cost is **~$0.50-$2.00**.

### What the AI Actually Sees (and Doesn't See)

The AI does **not** receive the raw CSVs. It receives a **compact text snapshot** of the student's dashboard, assembled by `buildStudentContext()` on the frontend and formatted by `_format_student_context()` on the backend. This is injected into the system prompt once per request.

**What gets injected (example for a Finance junior)**:
```
=== Current Student Profile ===
Declared Majors: Finance
Declared Tracks: Fintech
Declared Minors: none
Standing: Junior Standing (65 credits completed, 15 in progress)
Target Semester: Fall 2026

Completed Courses (18): ACCO 1030, ACCO 1031, BUAD 1500, BUAD 1950,
  ECON 1001, ECON 1002, FINA 3001, FINA 3041, MATH 1400, MATH 1410,
  MGMT 3010, MKTG 3010, COMM 1100, ENGL 1001, PHIL 1001, THEO 1001,
  MATH 2450, BULA 3010
In Progress (3): FINA 3310, INSY 3010, OSCM 3010

Unsatisfied Requirements (progress toward completion):
  Finance Core Requirements: 4/7 done
  Fintech Track Electives: 0/3 done
  BCC Required Courses: 14/18 done
  Business Elective Pool: 6/9 credits done
  MCC Foundation: 4/5 done
```

**What the AI does NOT see**:
- The full course catalog (all ~300 courses in `courses.csv`)
- Course descriptions (the `description` column exists but is **empty for all courses**)
- The prereq graph (which courses require which prereqs)
- Bucket-to-course mappings (which specific courses can fill "Finance Core Requirements")
- Course offering schedules (which semester each course is offered)
- Other students' data

**Why this matters — the "I want to be a public accountant" problem**:

If a student asks *"I want to be a public accountant, what should I take?"*, the AI only knows:
- They're an Accounting major (from declared majors)
- They have X courses left in "Accounting Core Requirements" (from progress summary)
- Which courses they've already taken (from completed list)

The AI **cannot** answer:
- "Take ACCO 4040 early — that's the auditing course you need for CPA"
- "ACCO 4060 covers tax, which is less critical for public accounting"
- "You need 150 credit hours for CPA licensure in Wisconsin"
- "These electives teach the analytical skills Big Four firms look for"

Because the AI has no course descriptions, no career pathway data, and no knowledge of what any course actually teaches. It can only say "you still need 3 courses in your Accounting Core bucket" — which the student already sees on their dashboard.

The same problem applies to any career-oriented or content-oriented question:
- *"Which elective teaches Excel modeling?"* → Can't answer (no descriptions)
- *"What's the difference between FINA 3310 and FINA 4931?"* → Can only say codes/names, not content
- *"Should I take MKTG 4050 or MKTG 4070 for digital marketing?"* → No idea what either covers

**Mitigation in v2.3 (this release)**:
- System prompt explicitly tells the AI: "You do not have course descriptions. Do not fabricate what a course covers. If a student asks what a course teaches or which courses fit a career goal, say you only know degree structure and recommend they check the Marquette course catalog or ask their advisor for content details."
- The AI can still give genuinely useful **structural** advice:
  - "You have 3 courses left in Accounting Core — knock those out before electives"
  - "You're a junior with 65 credits — you're on track for 4-semester graduation"
  - "You've finished all BCC prereqs, so your schedule has room for electives next semester"
  - "Adding a minor would add ~5 courses to your remaining plan"
- For career questions, the AI should be upfront: *"I know your degree structure but not what each course teaches. For CPA-specific course advice, your Accounting advisor would know which courses map to the exam sections."*

**What v2.3 is actually good at** (without descriptions):
1. Scheduling strategy — "what order should I take my remaining courses?"
2. Progress interpretation — "am I on track to graduate in 4 years?"
3. Requirement explanation — "what does this bucket mean and how many courses do I need?"
4. Trade-off framing — "if I add a minor, how does that change my timeline?"
5. Prereq awareness — "which courses am I eligible for next semester?" (inferred from completed list)

**What v2.3 is bad at** (needs descriptions to fix):
1. Career mapping — "what should I take to become a ___?"
2. Course content — "what does ___ actually teach?"
3. Skill-based recommendations — "which courses teach data analysis?"
4. Course comparison — "what's the difference between these two electives?"

**Fix (future data injection)**:
- Populate `description` column in `courses.csv` with 1-2 sentence catalog descriptions for business courses (~200 courses).
- Once descriptions exist, inject a **program-scoped course catalog** into the student context: only courses mapped to the student's declared programs, with code + name + description. This keeps token count bounded (~50-80 relevant courses per student instead of all ~300).
- Also consider injecting the remaining-course list with descriptions: "Courses you still need: **ACCO 4040** Auditing — covers audit procedures, internal controls, and professional standards."
- This transforms career-mapping questions from "I can't answer that" to grounded, useful advice.
- **Token cost impact**: ~80 program-scoped courses × ~40 words each = ~3.2K tokens added to system prompt. At gpt-4o-mini pricing this adds ~$0.0005 per session — negligible.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | OpenAI `gpt-4o-mini` | Best tone control for MarqBot's dry/witty voice at budget pricing. $0.15/$0.60 per 1M tokens. Considered Gemini 2.0 Flash (free tier) and gpt-4.1-nano (cheaper) but gpt-4o-mini has strongest personality consistency for brand voice. |
| LLM routing | Backend proxy (`POST /api/chat`) | API key stays server-side. Enables rate limiting, logging, cost control. |
| Capabilities | Chat only (no tool use) | Simple. AI answers questions based on injected student context -- no plan mutations. Context-only: student profile injected into system prompt. No live engine calls (potential v2.4 enhancement). |
| Streaming | Non-streaming | Full response appears at once. Simpler implementation. Streaming could be a v2.4 enhancement. |
| UI paradigm | Dedicated page at `/ai-advisor` | Placeholder page and nav item already wired. Clean separation from planner. |
| Chat persistence | localStorage (`marqbot_chat_v1`) | Survives page refreshes. Same pattern as session state. No server-side storage. |
| Message cap | **20 messages** per session | Enough room for follow-up conversations. Still cheap at ~$0.01/session. Server-side IP rate limit (30 req/hr) as abuse backstop. |
| Tone | MarqBot brand voice (see `docs/branding.md`) | Witty upperclassman -- casual, direct, dry humor. "Roast the system, not the student." Clear first, funny second. No emojis. Max 200 words per response. |
| Scope | Degree planning + light Marquette context | Courses, prereqs, scheduling, campus basics. Refuses truly off-topic questions. Deflects gracefully. |
| No-profile UX | Allow generic chat with disclaimer | Students who haven't completed onboarding can still chat. AI warns it doesn't know their specific situation. Prevents blocking but sets expectations. |
| Suggested prompts | **Mix of static + dynamic** | 2 static prompts + 2 dynamic prompts that adapt to student's declared majors/progress. More personalized first impression. |
| Scale target | 50-200 users/month | Early adoption phase. All budget models handle this at <$2/month. No free tier needed. |

---

## Architecture

```
Browser                          Flask                        OpenAI
  |                                |                            |
  |-- POST /api/chat ------------->|                            |
  |   { messages[], student_ctx }  |-- chat.completions.create->|
  |                                |   [system_prompt + msgs]   |
  |<---- { reply: "..." } --------|<---- response -------------|
```

- Frontend gathers student context from `AppState` + `useProgressMetrics()`, sends with each request
- Backend injects context into system prompt, forwards conversation to OpenAI, returns reply
- Chat state is self-contained in `useChat` hook -- **not** part of `AppState`/`AppReducer`
- No caching of chat responses (each conversation is unique)

---

## File Changes

### New Files (7)

| # | File | Purpose |
|---|------|---------|
| 1 | `frontend/src/hooks/useChat.ts` | Chat state, localStorage persistence, student context assembly, message sending with stale-request cancellation |
| 2 | `frontend/src/components/chat/ChatPage.tsx` | Top-level chat interface: header + scrollable messages + input/limit banner |
| 3 | `frontend/src/components/chat/ChatMessageBubble.tsx` | Renders user (right, navy) vs AI (left, glassmorphic) messages with lightweight markdown |
| 4 | `frontend/src/components/chat/ChatInput.tsx` | Auto-resizing textarea, gold send button, Enter to send / Shift+Enter for newline, disclaimer |
| 5 | `frontend/src/components/chat/ChatHeader.tsx` | "AI Advisor" title, "X of 10 remaining" counter, Clear Chat button |
| 6 | `frontend/src/components/chat/ChatWelcome.tsx` | Empty state with MarqBot icon and 4 suggested prompt cards |
| 7 | `frontend/src/components/chat/ChatLimitBanner.tsx` | "That's a wrap" message with "Start New Chat" button |

### Modified Files (6)

| # | File | Change |
|---|------|--------|
| 1 | `requirements.txt` | Add `openai>=1.0.0` |
| 2 | `backend/server.py` | Add chat rate limiter, system prompt constant, context builder, `chat_endpoint()`, route registration |
| 3 | `frontend/src/lib/types.ts` | Add `ChatMessage` and `ChatSession` interfaces |
| 4 | `frontend/src/lib/api.ts` | Add `postChat()` function |
| 5 | `frontend/src/lib/constants.ts` | Add `CHAT_STORAGE_KEY` and `CHAT_MESSAGE_LIMIT` constants |
| 6 | `frontend/src/app/ai-advisor/page.tsx` | Replace `PlaceholderPage` with `ChatPage` component |

---

## Step 1 -- Backend: `/api/chat` Endpoint

### 1a. Dependency

Add `openai>=1.0.0` to `requirements.txt`. Lazy-imported inside the handler so it doesn't add startup cost to other endpoints.

### 1b. Chat Rate Limiter

In `server.py` near existing rate limiter (~line 60). Separate from `/recommend` limiter. 30 requests/hour per IP. Same token-bucket pattern with `threading.Lock`.

### 1c. System Prompt Constant

Module-level `_CHAT_SYSTEM_PROMPT_BASE` string. Voice guidelines sourced from `docs/branding.md`:

- **Persona**: "MarqBot -- savvy upperclassman who actually read the catalog"
- **Voice** (from branding.md §3-5):
  - Clear first, funny second. Every line communicates logic, then optionally adds personality.
  - Casual, direct, dry humor. No emojis. No corporate buzzwords. No excessive slang.
  - Roast the system, not the student. Light sarcasm about prereqs/gatekeeping is OK. Never mock the user.
  - Slightly dramatic, strategically: "Bold choice." "Ambitious." "Four-course saga."
  - Use short sentences. Active voice. "You." Prioritize scannability.
- **Can discuss**: degree requirements, prereqs, scheduling strategy, light Marquette campus context (dining, housing, registration tips), how MarqBot works
- **Must not**: fabricate course codes, **fabricate what a course covers or teaches**, give definitive graduation audit advice, discuss truly unrelated topics (politics, dating, etc.)
- **No-description guardrail**: "You do not have course descriptions. You know course codes, names, credits, prereqs, and which requirements they fill — but not what they teach. If asked what a course covers or which courses fit a career goal, be honest that you only know degree structure. Recommend checking the Marquette course catalog or asking an advisor for course content details."
- **Guardrails**: always caveat with "check Checkmarq / confirm with your advisor", acknowledge uncertainty, never claim to be an official Marquette resource
- **Format**: responses under 200 words, markdown formatting, bold course codes
- **No-profile behavior**: when `student_context` is null/empty, AI should note it doesn't have the student's specific info and give general Marquette business advice. Suggest they "set up their profile in the Planner for personalized answers."

### 1d. Context Builder Functions

`_build_chat_system_prompt(student_context)` -- appends formatted student profile to base prompt. When `student_context` is None or empty, appends a "No student profile available" note instead.

`_format_student_context(ctx)` -- formats the dict into compact text:
- Declared majors, tracks, minors (display labels, not IDs)
- Standing label + completed/in-progress credit counts
- Completed course codes (capped at 50, then "...and N more")
- In-progress course codes
- Target semester
- Unsatisfied bucket progress summary (top 15: `label: done/needed`)

### 1e. Endpoint Handler

```
POST /api/chat
Request:  { messages: [{role, content}], student_context?: {...} }
Response: { reply: string }
Errors:   { error: { error_code, message } }
```

Request body example:
```json
{
  "messages": [
    { "role": "user", "content": "What should I take next?" },
    { "role": "assistant", "content": "Based on your progress..." },
    { "role": "user", "content": "What about FINA 3001?" }
  ],
  "student_context": {
    "declaredMajors": ["Finance"],
    "standingLabel": "Junior Standing",
    "completedCredits": 65,
    "completedCourses": ["ACCO 1030", "ECON 1001"],
    "inProgressCourses": ["FINA 3001"],
    "targetSemester": "Fall 2026",
    "progressSummary": "Finance Core: 3/6\nBCC Required: 14/18"
  }
}
```

Validation:
- `messages` must be non-empty array, max 42 items (20 user + 20 assistant + 2 buffer)
- Each message: `role` in `["user", "assistant"]`, `content` non-empty string, max 2000 chars
- Returns 503 if `OPENAI_API_KEY` not set
- Returns 429 if IP rate limited
- OpenAI call: `max_tokens=800`, `temperature=0.7`
- Error mapping: `openai.RateLimitError` -> 503, `openai.APIError` -> 502, generic -> 500

### 1f. Route Registration

```python
app.add_url_rule("/api/chat", endpoint="api_chat", view_func=chat_endpoint, methods=["POST"])
```

Placed at ~line 2082, before the API catch-all at line 2085.

---

## Step 2 -- Frontend: Types, API Client, Constants

### 2a. Types (`frontend/src/lib/types.ts`)

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatSession {
  messages: ChatMessage[];
  messageCount: number;   // user messages sent (for cap tracking)
  createdAt: number;
}

export interface StudentChatContext {
  declaredMajors?: string[];
  declaredMinors?: string[];
  declaredTracks?: string[];
  standingLabel?: string;
  completedCredits?: number;
  inProgressCredits?: number;
  completedCourses?: string[];
  inProgressCourses?: string[];
  targetSemester?: string;
  progressSummary?: string;
}
```

### 2b. API Client (`frontend/src/lib/api.ts`)

`postChat({ messages, student_context })` -> `{ reply }`. Same `fetch` + error-handling pattern as `postRecommend`.

### 2c. Constants (`frontend/src/lib/constants.ts`)

```typescript
export const CHAT_STORAGE_KEY = "marqbot_chat_v1";
export const CHAT_MESSAGE_LIMIT = 20;
```

---

## Step 3 -- Frontend: `useChat` Hook

**File**: `frontend/src/hooks/useChat.ts`

Self-contained chat state -- **not** part of AppState/AppReducer. Chat is ephemeral; planner state is persistent.

**Responsibilities**:
- `useState` for `messages[]`, `messageCount`, `loading`, `error`
- Restore from localStorage on mount; debounced 300ms save on changes
- `buildStudentContext()` -- reads `useAppContext().state` and `useProgressMetrics()` (from `ProgressDashboard.tsx`):
  - Returns `null` if no onboarding complete and no majors selected (no-profile case)
  - Maps major/track/minor IDs -> labels via `state.programs`
  - Pulls standing + credits from `useProgressMetrics()`
  - Pulls completed/in-progress course codes from state Sets
  - Builds compact progress summary from `state.lastRecommendationData?.current_progress` (unsatisfied buckets only)
- `hasProfile` -- derived boolean: `true` when student has at least one declared major or completed course
- `sendMessage(content)` -- enforces 20-message cap, appends user message optimistically, calls `postChat`, appends AI reply. On error: rolls back message count and removes the failed user message
- `clearChat()` -- resets all state, removes localStorage key
- Stale request cancellation via `useRef` counter (same pattern as `useRecommendations`)

**Returns**:
```typescript
{
  messages: ChatMessage[];
  messageCount: number;
  messagesRemaining: number;
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => void;
  clearChat: () => void;
  isAtLimit: boolean;
  hasProfile: boolean;
}
```

---

## Step 4 -- Frontend: Chat UI Components

All in `frontend/src/components/chat/`.

### ChatPage.tsx (orchestrator)
- Full height: `h-[calc(100vh-4rem)]`, `max-w-3xl mx-auto`
- Three vertical sections: ChatHeader -> scrollable messages (flex-1) -> ChatInput or ChatLimitBanner
- Auto-scroll to bottom on new messages via `useEffect` + `scrollRef`
- Empty state: shows ChatWelcome
- Loading: bouncing gold dots + "MarqBot is thinking..."
- Error: red banner with error message

### ChatMessageBubble.tsx
- User messages: right-aligned, `bg-navy-light`, plain whitespace-preserved text, `rounded-br-md`
- AI messages: left-aligned, `surface-depth-2`, lightweight markdown rendering, `rounded-bl-md`
- Framer Motion entrance (fade + slide up, 200ms)
- Markdown: custom minimal renderer. Escapes HTML entities first (XSS-safe), then bold/italic/code/headers/bullets. No external dependency.

### ChatInput.tsx
- Auto-resizing `<textarea>` (1 row default, max 120px height)
- Gold circular send button with arrow SVG
- Enter sends, Shift+Enter inserts newline
- Disabled while loading
- Below: "Not official Marquette advice. Always confirm with your advisor and Checkmarq." in muted text

### ChatHeader.tsx
- "AI Advisor" in Sora bold, white
- Subtitle: "X of 20 messages remaining" (active) / "Ask questions about your degree plan" (empty)
- "Clear Chat" button only when messages exist

### ChatWelcome.tsx
- Gold "M" icon in rounded badge
- **With profile**: "Hey, what can I help with?" heading + "I know your courses, your major, and your progress." subtitle
- **Without profile**: "Hey, what can I help with?" heading + "I don't know your courses yet — set up your profile in the Planner for personalized answers." subtitle (with link to `/planner`)
- 2x2 grid of suggested prompt cards (mix of static + dynamic):
  - **Static** (always shown):
    1. "What's the best order to tackle BCC courses?"
    2. "Is it worth adding a minor?"
  - **Dynamic** (adapt to student profile, fall back to generic if no profile):
    3. With major: "What {majorLabel} courses should I prioritize?" / Without: "What should I take next semester?"
    4. With progress: "What's blocking my longest prereq chain?" / Without: "How do prereq chains work?"
- Clicking a card calls `sendMessage()` directly
- Dynamic prompts read from `useAppContext().state` (selectedMajors, programs, lastRecommendationData)

### ChatLimitBanner.tsx
- Replaces ChatInput when `isAtLimit` is true
- "That's a wrap for this session. You've used all 20 messages."
- "Clear the chat to start a new conversation with fresh context."
- Gold "Start New Chat" button -> `clearChat()`

### ai-advisor/page.tsx
- One-liner: replace `PlaceholderPage` import with `ChatPage`

---

## Step 5 -- Testing

### Backend Tests (`tests/backend/test_chat_endpoint.py`)

| Test | Expected |
|------|----------|
| No `messages` field | 400 |
| Empty `messages` array | 400 |
| Invalid `role` (e.g. `"system"`) | 400 |
| Empty `content` string | 400 |
| Conversation > 22 messages | 400 |
| Single message > 2000 chars | 400 |
| `OPENAI_API_KEY` not set | 503 with `CHAT_UNAVAILABLE` |
| `_build_chat_system_prompt(None)` | Contains "MarqBot", contains "No student profile available" |
| `_build_chat_system_prompt({...})` | Contains "Current Student Profile" + student data |
| Valid request with mocked OpenAI | 200 with `{ reply: "..." }` |
| Conversation > 42 messages | 400 |

### Frontend Tests (`tests/frontend/chat.test.ts`)

| Test | Expected |
|------|----------|
| `CHAT_MESSAGE_LIMIT` value | Equals 20 |
| `CHAT_STORAGE_KEY` value | Equals `"marqbot_chat_v1"` |

### Manual Testing Checklist

- [ ] Send a message -> AI response appears
- [ ] Refresh page -> chat history persists
- [ ] Send 20 messages -> limit banner appears, input disappears
- [ ] Click "Start New Chat" -> chat clears, counter resets
- [ ] Test with no onboarding (empty student profile) -> generic disclaimer shown, AI warns about limited context
- [ ] Test with full profile (majors, courses, progress data) -> personalized prompts shown
- [ ] Dynamic suggested prompts reflect declared major label
- [ ] "MarqBot is thinking..." animation visible during loading
- [ ] Disconnect network -> error banner appears
- [ ] Mobile viewport (375px) -> layout works
- [ ] Click suggested prompt card -> message sends
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Disclaimer text visible below input

---

## Verification

```bash
# 1. Install dependency
pip install -r requirements.txt

# 2. Ensure .env has keys
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini

# 3. Backend tests
pytest tests/backend -q

# 4. Frontend checks
cd frontend && npm run build && npm run test && npm run lint

# 5. Smoke test
python scripts/run_local.py
# -> http://localhost:3000/ai-advisor
```

---
---

# Plan 2, Part 2: Course Description Data Injection

**Status**: Planned — prerequisite for AI Advisor
**Date**: 2026-03-04

---

## Context

The AI Advisor needs course descriptions to answer the most common student questions ("what does FINA 3310 cover?", "which elective teaches data analysis?"). Currently all 540 courses in `courses.csv` have an empty `description` column. Without descriptions, the AI gives only structural advice that students already see on their dashboard.

Marquette's bulletin at `bulletin.marquette.edu/course-descriptions/{subject}/` has clean, structured HTML with full descriptions. This part scrapes those and injects them into `courses.csv`.

**Scope**: ~275 business courses across 18 subject codes (ACCO, AIM, BUAD, BUAN, BULA, ECON, ENTP, FINA, HURE, INBU, INSY, LEAD, MANA, MARK, OSCM, REAL, SOWJ, CORE). Non-business courses (HIST, ENGL, PHIL, etc.) backfilled later.

---

## File Changes

### New File

| File | Purpose |
|------|---------|
| `scripts/scrape_descriptions.py` | One-time scraper: fetches bulletin pages, parses descriptions, writes to `courses.csv` |

### Modified File

| File | Change |
|------|--------|
| `data/courses.csv` | Populate `description` column for ~275 business courses |

---

## Implementation

### Scraper Script (`scripts/scrape_descriptions.py`)

**Dependencies**: `requests`, `beautifulsoup4`

**Subject-to-URL mapping**:
```python
BULLETIN_BASE = "https://bulletin.marquette.edu/course-descriptions"
SUBJECTS = [
    "acco", "aim", "buad", "buan", "bula", "econ", "entp",
    "fina", "hure", "inbu", "insy", "lead", "mana", "mark",
    "oscm", "real", "sowj", "core"
]
```

**Logic**:
1. Load existing `courses.csv` into a dict keyed by `course_code`
2. For each subject: fetch `{BULLETIN_BASE}/{subject}/`, parse course code + description
3. Trim description to 1-2 sentences (~200 chars max). Strip HTML, prereq info, credit hours (already in other columns)
4. Match against CSV course codes. Skip grad-level (5000+) and missing courses
5. Write updated CSV with descriptions populated
6. Print summary: matched, unmatched, skipped

**Polite scraping**: 1-second delay between requests. 18 total requests.

### Review + Manual Cleanup

- Spot-check ~20 descriptions
- Manually fill unmatched courses if findable
- Verify no HTML artifacts leaked
- Confirm CSV loads: `python -c "import csv; list(csv.DictReader(open('data/courses.csv', encoding='utf-8-sig')))"`

### Archive Script

Move to `scripts/archive/scrape_descriptions.py` after injection (per convention).

---

## Description Format

- **Length**: 1-2 sentences, max ~200 characters
- **Style**: Factual catalog tone
- **Example**: `"Extension of financial management theory. Topics include working capital, capital budgeting, dividend policy, cost of capital, and valuation."`
- **Strip**: Credit hours, prereq info, level info
- **Keep**: What the course covers/teaches — this is what the AI needs

---

## Verification

```bash
# 1. Run scraper
python scripts/scrape_descriptions.py

# 2. Verify CSV integrity
python -c "
import csv
with open('data/courses.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
    has_desc = sum(1 for r in rows if r.get('description','').strip())
    print(f'{has_desc}/{len(rows)} courses have descriptions')
"

# 3. Backend loads cleanly
python backend/server.py

# 4. Tests pass
pytest tests/backend -q
cd frontend && npm run build
```

---

## Sequencing

Complete this **before** starting Plan 2 Part 1 (AI Advisor endpoint + UI). Once descriptions are in `courses.csv`, the AI's `_format_student_context()` can include program-scoped course descriptions in the system prompt.
