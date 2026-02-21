import { jest } from "@jest/globals";
import { getSessionSnapshot, saveSession, restoreSession, STORAGE_KEY } from "../../frontend/modules/session.js";

// jsdom provides localStorage; we reset it before each test
beforeEach(() => {
  localStorage.clear();
});

function makeState(completedArr = [], inProgressArr = [], courses = []) {
  return {
    courses,
    completed: new Set(completedArr),
    inProgress: new Set(inProgressArr),
  };
}

function makeElements(overrides = {}) {
  // Minimal mock element with options array and value
  const mockSelect = (value, options = []) => ({
    value,
    options: options.map(v => ({ value: v })),
  });

  return {
    targetSemester: mockSelect("Spring 2026", ["Spring 2026", "Fall 2026"]),
    targetSemester2: mockSelect("Fall 2026", ["", "__NONE__", "Spring 2026", "Fall 2026"]),
    targetSemester3: mockSelect("", ["", "__NONE__", "Spring 2026", "Fall 2026"]),
    maxRecs: mockSelect("3", ["2", "3", "4", "5"]),
    canTake: { value: "FINA 4001" },
    ...overrides,
  };
}

describe("getSessionSnapshot()", () => {
  test("returns serializable snapshot of state + elements", () => {
    const state = makeState(["FINA 3001"], ["ECON 1103"]);
    const elements = makeElements();
    const snap = getSessionSnapshot(state, elements);

    expect(snap.completed).toContain("FINA 3001");
    expect(snap.inProgress).toContain("ECON 1103");
    expect(snap.targetSemester).toBe("Spring 2026");
    expect(snap.targetSemester3).toBe("");
    expect(snap.maxRecs).toBe("3");
    expect(snap.canTake).toBe("FINA 4001");
  });

  test("handles null elements gracefully", () => {
    const state = makeState();
    const elements = { targetSemester: null, targetSemester2: null, targetSemester3: null, maxRecs: null, canTake: null };
    const snap = getSessionSnapshot(state, elements);
    expect(snap.targetSemester).toBe("");
    expect(snap.maxRecs).toBe("3");
  });
});

describe("saveSession()", () => {
  test("writes JSON to localStorage under the correct key", () => {
    const state = makeState(["FINA 3001"]);
    const elements = makeElements();
    saveSession(state, elements);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw);
    expect(parsed.completed).toContain("FINA 3001");
  });

  test("does not throw when localStorage is unavailable (simulated)", () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("quota exceeded"); };
    const state = makeState(["FINA 3001"]);
    const elements = makeElements();
    expect(() => saveSession(state, elements)).not.toThrow();
    Storage.prototype.setItem = originalSetItem;
  });
});

describe("restoreSession()", () => {
  const courses = [
    { course_code: "FINA 3001" },
    { course_code: "ECON 1103" },
    { course_code: "FINA 4001" },
  ];

  test("is a no-op when localStorage is empty", () => {
    const state = makeState([], [], courses);
    const elements = makeElements();
    const renderCompleted = jest.fn();
    const renderIp = jest.fn();

    restoreSession(state, elements, { renderChipsCompleted: renderCompleted, renderChipsIp: renderIp });
    expect(state.completed.size).toBe(0);
    expect(renderCompleted).not.toHaveBeenCalled();
  });

  test("restores completed and in-progress sets from storage", () => {
    const snap = { completed: ["FINA 3001"], inProgress: ["ECON 1103"], targetSemester: "Spring 2026", targetSemester2: "", targetSemester3: "", maxRecs: "3", canTake: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));

    const state = makeState([], [], courses);
    const elements = makeElements();
    restoreSession(state, elements, { renderChipsCompleted: jest.fn(), renderChipsIp: jest.fn() });

    expect(state.completed.has("FINA 3001")).toBe(true);
    expect(state.inProgress.has("ECON 1103")).toBe(true);
  });

  test("calls render callbacks after restoring", () => {
    const snap = { completed: ["FINA 3001"], inProgress: ["ECON 1103"], targetSemester: "Spring 2026", targetSemester2: "", targetSemester3: "", maxRecs: "3", canTake: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));

    const state = makeState([], [], courses);
    const elements = makeElements();
    const renderCompleted = jest.fn();
    const renderIp = jest.fn();

    restoreSession(state, elements, { renderChipsCompleted: renderCompleted, renderChipsIp: renderIp });
    expect(renderCompleted).toHaveBeenCalledTimes(1);
    expect(renderIp).toHaveBeenCalledTimes(1);
  });

  test("filters out codes not in catalog", () => {
    const snap = { completed: ["FINA 3001", "FAKE 9999"], inProgress: [], targetSemester: "", targetSemester2: "", targetSemester3: "", maxRecs: "3", canTake: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));

    const state = makeState([], [], courses);
    const elements = makeElements();
    restoreSession(state, elements, { renderChipsCompleted: jest.fn(), renderChipsIp: jest.fn() });

    expect(state.completed.has("FINA 3001")).toBe(true);
    expect(state.completed.has("FAKE 9999")).toBe(false);
  });

  test("handles corrupt JSON gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json{{{");
    const state = makeState([], [], courses);
    const elements = makeElements();
    expect(() =>
      restoreSession(state, elements, { renderChipsCompleted: jest.fn(), renderChipsIp: jest.fn() })
    ).not.toThrow();
    expect(state.completed.size).toBe(0);
  });

  test("does not add a completed course to inProgress", () => {
    // ECON 1103 is both in completed and inProgress in saved data — completed wins
    const snap = { completed: ["ECON 1103"], inProgress: ["ECON 1103"], targetSemester: "", targetSemester2: "", targetSemester3: "", maxRecs: "3", canTake: "" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));

    const state = makeState([], [], courses);
    const elements = makeElements();
    restoreSession(state, elements, { renderChipsCompleted: jest.fn(), renderChipsIp: jest.fn() });

    expect(state.completed.has("ECON 1103")).toBe(true);
    expect(state.inProgress.has("ECON 1103")).toBe(false);
  });
});
