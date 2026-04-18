# Testing Patterns

**Analysis Date:** 2026-04-03

## Test Framework

**Runner:**
- Backend: `pytest` 9.0.2 from `requirements.txt`, configured by `pytest.ini`.
- Frontend: `vitest` 3.2.4 from `frontend/package.json`, configured by `frontend/vitest.config.ts`.
- Checked-in automation: `.github/workflows/nightly-sweep.yml` runs the focused `@nightly` backend suite daily at 9:30 UTC (~4 AM Chicago year-round) and on manual dispatch. The broader release gate is still enforced by local commands.

**Assertion Library:**
- Backend uses native pytest assertions plus Flask test client response inspection, as in `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_feedback_api.py`, and `tests/backend/test_server_security.py`.
- Frontend uses Vitest `expect` with `@testing-library/jest-dom/vitest` from `tests/frontend/setupTests.ts` and `frontend/tests/setupTests.ts`.
- DOM interaction tests use `@testing-library/react` and `@testing-library/user-event`, as in `frontend/tests/onboardingPage.dom.test.ts`, `frontend/tests/profileModal.dom.test.ts`, and `tests/frontend/multiSelect.dom.test.ts`.

**Run Commands:**
```bash
.\.venv\Scripts\python.exe -m pytest tests/backend -q                       # Backend default suite; `pytest.ini` deselects `nightly`
.\.venv\Scripts\python.exe -m pytest tests/backend/test_dead_end_fast.py -m "not nightly" -q
.\.venv\Scripts\python.exe -m pytest -m nightly -q
.\.venv\Scripts\python.exe -m pytest -m migration -q                        # Archived migration-only cases in `tests/backend/test_schema_migration.py`
cd frontend && npm run test                                                 # Frontend default Vitest run
cd frontend && npm run test && npm run lint && npm run build               # Frontend release gate
# Watch mode: Not scripted in the repo
# Coverage: Not configured in the repo
```

## Test File Organization

**Location:**
- Backend tests live under `tests/backend/`, and `pytest.ini` sets `testpaths = tests/backend`.
- Frontend tests are split across `tests/frontend/` and `frontend/tests/`.
- Shared frontend test utilities are duplicated in each test root via `tests/frontend/setupTests.ts`, `tests/frontend/testUtils.ts`, `frontend/tests/setupTests.ts`, and `frontend/tests/testUtils.ts`.

**Naming:**
- Backend test modules use `test_*.py`, such as `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_semester_recommender.py`, and `tests/backend/test_feedback_api.py`.
- Frontend helper/unit tests use `*.test.ts`, such as `tests/frontend/utils.test.ts` and `frontend/tests/courseHistoryImportParser.test.ts`.
- Frontend DOM-heavy tests use `*.dom.test.ts`, such as `frontend/tests/onboardingPage.dom.test.ts`, `frontend/tests/profileModal.dom.test.ts`, and `tests/frontend/coursesStep.dom.test.ts`.

**Structure:**
```text
tests/
├── backend/
│   ├── conftest.py
│   ├── helpers.py
│   ├── dead_end_utils.py
│   ├── nightly_support.py
│   └── test_*.py
├── frontend/
│   ├── setupTests.ts
│   ├── testUtils.ts
│   ├── *.test.ts
│   └── *.dom.test.ts
└── nightly_reports/
    └── YYYY-MM-DD.{md,json}

frontend/
└── tests/
    ├── setupTests.ts
    ├── testUtils.ts
    ├── fixtures/
    ├── *.test.ts
    └── *.dom.test.ts
```

`frontend/vitest.config.ts` includes `../tests/frontend/**/*.test.ts` and `./tests/**/*.test.ts`, uses `environment: "node"` by default, and excludes `../tests/frontend/**/*.dom.test.ts`. DOM files that do run add `// @vitest-environment jsdom` at the top, as in `frontend/tests/onboardingPage.dom.test.ts` and `frontend/tests/useSession.dom.test.ts`.

## Test Structure

**Suite Organization:**
```python
# tests/backend/test_recommend_api_contract.py
@pytest.fixture(scope="module")
def client():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c

@pytest.mark.parametrize("value", [0, 16, "abc"])
def test_invalid_max_recommendations_returns_400(client, value):
    response = _post(client, max_recommendations=value)
    assert response.status_code == 400
```

```typescript
// frontend/tests/onboardingPage.dom.test.ts
describe("OnboardingPage component flow", () => {
  beforeEach(() => {
    pushSpy.mockReset();
  });

  test("walks a student from major selection to planner launch", async () => {
    const user = userEvent.setup();
    renderWithApp(createElement(OnboardingPage), state);
    await user.type(screen.getByPlaceholderText(/search majors/i), "fin");
    expect(pushSpy).toHaveBeenCalledWith("/planner");
  });
});
```

**Patterns:**
- Backend endpoint tests typically create a module-scoped Flask client fixture, then use small `_post(...)` or `_payload(...)` helpers inside the same file; see `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_server_can_take.py`, and `tests/backend/test_validate_prereqs_endpoint.py`.
- Backend algorithm tests often build synthetic `pandas.DataFrame` fixtures inline to exercise pure logic without hitting the full workbook data, as in `tests/backend/test_semester_recommender.py` and `tests/backend/test_track_aware.py`.
- Frontend DOM tests import `./setupTests`, build state through `renderWithApp(...)`, and drive user flows with semantic queries like `screen.getByRole(...)`; see `frontend/tests/onboardingPage.dom.test.ts`, `frontend/tests/profileModal.dom.test.ts`, and `frontend/tests/savedPlanDetailPage.dom.test.ts`.
- Frontend pure utility tests call functions directly without rendering React when browser behavior is not involved, as in `tests/frontend/utils.test.ts`, `tests/frontend/studentStage.test.ts`, and `frontend/tests/courseHistoryImportParser.test.ts`.

## Mocking

**Framework:** Frontend uses Vitest mocks (`vi.mock`, `vi.hoisted`, spies, fake timers). Backend uses pytest fixtures plus `monkeypatch`, `tmp_path`, and synthetic dataframes.

**Patterns:**
```typescript
// frontend/tests/onboardingPage.dom.test.ts
const { pushSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
  }),
}));
```

```python
# tests/backend/test_server_data_reload.py
def test_reload_swaps_runtime_data_when_mtime_advances(monkeypatch):
    monkeypatch.setattr(server, "_data_file_mtime", lambda _path: 200.0)
    monkeypatch.setattr(server, "load_data", lambda _path: new_data)
    monkeypatch.setattr(server, "build_reverse_prereq_map", lambda _df, _map: {"new": True})
```

**What to Mock:**
- Frontend mocks framework boundaries, API wrappers, storage, timers, and heavyweight children. Examples: `next/navigation` in `frontend/tests/onboardingPage.dom.test.ts`, `@/lib/api` in `frontend/tests/coursesStep.dom.test.ts`, and child planner components in `frontend/tests/plannerCourseList.dom.test.ts` and `frontend/tests/plannerFeedbackNudge.dom.test.ts`.
- Backend mocks environment variables, file paths, clock/mtime checks, and in-memory server globals when testing side effects. Examples: `tests/backend/test_feedback_api.py`, `tests/backend/test_server_data_reload.py`, and `tests/backend/test_track_aware.py`.

**What NOT to Mock:**
- Backend contract tests usually hit the real Flask app and real workbook-backed runtime data through `server.app.test_client()`, as in `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_server_security.py`, and `tests/backend/test_dead_end_fast.py`.
- Backend algorithm tests prefer synthetic `DataFrame` inputs over mocking ranking internals. `tests/backend/test_semester_recommender.py` exercises `run_recommendation_semester()` directly with constructed course, bucket, and equivalency tables.
- Frontend helper tests avoid mocking the function under test. See `tests/frontend/utils.test.ts`, `tests/frontend/feedback.test.ts`, and `frontend/tests/courseHistoryImportParser.test.ts`.

## Fixtures and Factories

**Test Data:**
```typescript
// tests/frontend/testUtils.ts
export function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    ...overrides,
    completed: overrides.completed ?? new Set<string>(),
    inProgress: overrides.inProgress ?? new Set<string>(),
  };
}
```

```python
# tests/backend/test_semester_recommender.py
def _mk_data(courses_rows, map_rows, buckets_rows):
    courses_df = pd.DataFrame(courses_rows)
    prereq_map = {
        row["course_code"]: parse_prereqs(row.get("prereq_hard", "none"))
        for row in courses_rows
    }
```

**Location:**
- Backend shared helpers live in `tests/backend/helpers.py`, `tests/backend/dead_end_utils.py`, `tests/backend/nightly_support.py`, and `tests/backend/conftest.py`.
- Frontend shared render/state helpers live in `tests/frontend/testUtils.ts` and `frontend/tests/testUtils.ts`.
- Frontend browser shims live in `tests/frontend/setupTests.ts` and `frontend/tests/setupTests.ts`.
- Frontend binary/fixture assets live in `frontend/tests/fixtures/`, such as `frontend/tests/fixtures/coursehistory.ocr.fixture.json` and `frontend/tests/fixtures/coursehistory.jpg`.

## Coverage

**Requirements:** No coverage threshold, coverage script, or coverage config file was detected. Quality gates currently rely on targeted local suites, especially `pytest tests/backend -q` plus the frontend `npm run test && npm run lint && npm run build` gate.

**View Coverage:**
```bash
# Coverage reporting is not configured in this repo
```

## Test Types

**Unit Tests:**
- Frontend pure helper tests: `tests/frontend/utils.test.ts`, `tests/frontend/studentStage.test.ts`, `tests/frontend/feedback.test.ts`, and `frontend/tests/courseHistoryImportParser.test.ts`.
- Backend pure logic tests: `tests/backend/test_allocator.py`, `tests/backend/test_prereq_parser.py`, `tests/backend/test_semester_recommender.py`, `tests/backend/test_server_data_reload.py`, and `tests/backend/test_scrape_undergrad_policies.py`.

**Integration Tests:**
- Backend Flask endpoint and contract tests: `tests/backend/test_recommend_api_contract.py`, `tests/backend/test_server_can_take.py`, `tests/backend/test_feedback_api.py`, `tests/backend/test_server_security.py`, and `tests/backend/test_validate_prereqs_endpoint.py`.
- Frontend rendered integration tests with provider state and user interaction: `frontend/tests/onboardingPage.dom.test.ts`, `frontend/tests/profileModal.dom.test.ts`, `frontend/tests/savedPlanDetailPage.dom.test.ts`, `frontend/tests/useSession.dom.test.ts`, and `tests/frontend/multiSelect.dom.test.ts`.

**E2E Tests:** Not used. No Playwright, Cypress, or browser-E2E config was detected in the repository.

## Common Patterns

**Async Testing:**
```typescript
// frontend/tests/profileModal.dom.test.ts
const user = userEvent.setup();
await user.click(screen.getByRole("button", { name: /get my plan/i }));
await waitFor(() => expect(onSubmitRecommendations).toHaveBeenCalledTimes(1));
await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
```

Frontend async tests prefer `userEvent.setup()`, semantic queries, and `waitFor(...)` over arbitrary sleeps. Timer-driven behavior uses fake timers and `act(...)`, as in `frontend/tests/useSession.dom.test.ts`.

**Error Testing:**
```python
# tests/backend/test_recommend_api_contract.py
response = _post(client, max_recommendations=0)
assert response.status_code == 400
data = response.get_json()
assert data["error"]["error_code"] == "INVALID_INPUT"
```

Backend error tests assert both HTTP status and the returned JSON contract. Frontend failure-state tests assert the visible message after a rejected dependency, as in `frontend/tests/coursesStep.dom.test.ts` and `frontend/tests/profileModal.dom.test.ts`.

---

*Testing analysis: 2026-04-03*
