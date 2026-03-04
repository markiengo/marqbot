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

**Status**: Planned
**Target version**: v2.3.0
**Date**: 2026-03-04

---

## Context

MarqBot's planner is deterministic and data-driven -- great for accuracy, but students still want to ask questions about their degree plan in natural language. The AI Advisor is a standalone chat feature that lets students ask "What should I take next?" or "Is it worth adding a minor?" and get answers grounded in their actual profile data. It does **not** replace or modify the deterministic recommendation engine.

**Cost**: gpt-4o-mini at $0.15/1M input + $0.60/1M output. A full 10-message session costs <$0.005.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM provider | OpenAI `gpt-4o-mini` | Already configured in `.env`. Extremely cheap. |
| LLM routing | Backend proxy (`POST /api/chat`) | API key stays server-side. Enables rate limiting, logging, cost control. |
| Capabilities | Chat only (no tool use) | Simple. AI answers questions based on injected student context -- no plan mutations. |
| UI paradigm | Dedicated page at `/ai-advisor` | Placeholder page and nav item already wired. Clean separation from planner. |
| Chat persistence | localStorage (`marqbot_chat_v1`) | Survives page refreshes. Same pattern as session state. No server-side storage. |
| Message cap | 10 messages per session | Cost control. Clear chat to start fresh. Server-side IP rate limit (30 req/hr) as abuse backstop. |
| Tone | MarqBot brand voice | Witty upperclassman -- casual, direct, dry humor. Matches quip system tone. |
| Scope | Degree planning + light Marquette context | Courses, prereqs, scheduling, campus basics. Refuses off-topic questions. |

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

Module-level `_CHAT_SYSTEM_PROMPT_BASE` string:

- **Persona**: "MarqBot -- savvy upperclassman who actually read the catalog"
- **Voice**: casual, direct, dry humor, no emojis, max one exclamation point per conversation
- **Can discuss**: degree requirements, prereqs, scheduling strategy, light Marquette campus context, how MarqBot works
- **Must not**: fabricate course codes, give definitive graduation audit advice, discuss unrelated topics
- **Guardrails**: always caveat with "check Checkmarq / confirm with your advisor", acknowledge uncertainty
- **Format**: responses under 200 words, markdown formatting, bold course codes

### 1d. Context Builder Functions

`_build_chat_system_prompt(student_context)` -- appends formatted student profile to base prompt.

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
- `messages` must be non-empty array, max 22 items
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
```

### 2b. API Client (`frontend/src/lib/api.ts`)

`postChat({ messages, student_context })` -> `{ reply }`. Same `fetch` + error-handling pattern as `postRecommend`.

### 2c. Constants (`frontend/src/lib/constants.ts`)

```typescript
export const CHAT_STORAGE_KEY = "marqbot_chat_v1";
export const CHAT_MESSAGE_LIMIT = 10;
```

---

## Step 3 -- Frontend: `useChat` Hook

**File**: `frontend/src/hooks/useChat.ts`

Self-contained chat state -- **not** part of AppState/AppReducer. Chat is ephemeral; planner state is persistent.

**Responsibilities**:
- `useState` for `messages[]`, `messageCount`, `loading`, `error`
- Restore from localStorage on mount; debounced 300ms save on changes
- `buildStudentContext()` -- reads `useAppContext().state` and `useProgressMetrics()` (from `ProgressDashboard.tsx`):
  - Maps major/track/minor IDs -> labels via `state.programs`
  - Pulls standing + credits from `useProgressMetrics()`
  - Pulls completed/in-progress course codes from state Sets
  - Builds compact progress summary from `state.lastRecommendationData?.current_progress` (unsatisfied buckets only)
- `sendMessage(content)` -- enforces 10-message cap, appends user message optimistically, calls `postChat`, appends AI reply. On error: rolls back message count and removes the failed user message
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
- Subtitle: "X of 10 messages remaining" (active) / "Ask questions about your degree plan" (empty)
- "Clear Chat" button only when messages exist

### ChatWelcome.tsx
- Gold "M" icon in rounded badge
- "Hey, what can I help with?" heading
- "I know your courses, your major, and your progress." subtitle
- 2x2 grid of suggested prompt cards:
  1. "What should I take next semester?"
  2. "How do prereq chains work for Finance?"
  3. "Is it worth adding a minor?"
  4. "What's the best order to tackle BCC courses?"
- Clicking a card calls `sendMessage()` directly

### ChatLimitBanner.tsx
- Replaces ChatInput when `isAtLimit` is true
- "That's a wrap for this session. You've used all 10 messages."
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
| `_build_chat_system_prompt(None)` | Contains "MarqBot", no "Current Student Profile" |
| `_build_chat_system_prompt({...})` | Contains "Current Student Profile" + student data |
| Valid request with mocked OpenAI | 200 with `{ reply: "..." }` |

### Frontend Tests (`tests/frontend/chat.test.ts`)

| Test | Expected |
|------|----------|
| `CHAT_MESSAGE_LIMIT` value | Equals 10 |
| `CHAT_STORAGE_KEY` value | Equals `"marqbot_chat_v1"` |

### Manual Testing Checklist

- [ ] Send a message -> AI response appears
- [ ] Refresh page -> chat history persists
- [ ] Send 10 messages -> limit banner appears, input disappears
- [ ] Click "Start New Chat" -> chat clears, counter resets
- [ ] Test with no onboarding (empty student profile)
- [ ] Test with full profile (majors, courses, progress data)
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
