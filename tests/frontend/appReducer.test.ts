import { describe, expect, test } from "vitest";

import { appReducer, initialState } from "../../frontend/src/context/AppReducer";

describe("appReducer bootstrap loading", () => {
  test("tracks course bootstrap failures and clears them on success", () => {
    const loading = appReducer(initialState, { type: "LOAD_COURSES_START" });
    expect(loading.coursesLoadStatus).toBe("loading");
    expect(loading.coursesLoadError).toBeNull();

    const failed = appReducer(loading, {
      type: "LOAD_COURSES_FAILURE",
      payload: "catalog down",
    });
    expect(failed.coursesLoadStatus).toBe("error");
    expect(failed.coursesLoadError).toBe("catalog down");

    const recovered = appReducer(failed, {
      type: "SET_COURSES",
      payload: [{ course_code: "ACCO 1030", course_name: "Accounting", credits: 3 }],
    });
    expect(recovered.coursesLoadStatus).toBe("ready");
    expect(recovered.coursesLoadError).toBeNull();
    expect(recovered.courses).toHaveLength(1);
  });

  test("tracks program bootstrap failures and clears them on success", () => {
    const loading = appReducer(initialState, { type: "LOAD_PROGRAMS_START" });
    expect(loading.programsLoadStatus).toBe("loading");
    expect(loading.programsLoadError).toBeNull();

    const failed = appReducer(loading, {
      type: "LOAD_PROGRAMS_FAILURE",
      payload: "program list down",
    });
    expect(failed.programsLoadStatus).toBe("error");
    expect(failed.programsLoadError).toBe("program list down");

    const recovered = appReducer(failed, {
      type: "SET_PROGRAMS",
      payload: {
        majors: [{ id: "FIN_MAJOR", label: "Finance" }],
        tracks: [],
        minors: [],
        default_track_id: "FIN_MAJOR",
      },
    });
    expect(recovered.programsLoadStatus).toBe("ready");
    expect(recovered.programsLoadError).toBeNull();
    expect(recovered.programs.majors).toHaveLength(1);
  });
});

describe("appReducer APPLY_PLANNER_SNAPSHOT", () => {
  test("replaces live planner state intentionally", () => {
    const state = {
      ...initialState,
      courses: [
        { course_code: "ACCO 1030", course_name: "Accounting", credits: 3 },
        { course_code: "FINA 3001", course_name: "Finance", credits: 3 },
      ],
      programs: {
        majors: [
          { id: "FIN_MAJOR", label: "Finance" },
          { id: "AIM_MAJOR", label: "AIM" },
        ],
        tracks: [
          { id: "AIM_CFA_TRACK", label: "AIM CFA", parent_major_id: "AIM_MAJOR" },
        ],
        minors: [{ id: "MKT_MINOR", label: "Marketing" }],
        default_track_id: "FIN_MAJOR",
      },
      onboardingComplete: true,
      completed: new Set(["OLD 1000"]),
      selectedMajors: new Set(["AIM_MAJOR"]),
      selectedTracks: [],
    };

    const next = appReducer(state, {
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: {
        completed: ["ACCO 1030"],
        inProgress: ["FINA 3001"],
        targetSemester: "Fall 2026",
        semesterCount: "4",
        maxRecs: "5",
        includeSummer: true,
        canTake: "FINA 3001",
        declaredMajors: ["FIN_MAJOR"],
        declaredTracks: ["AIM_CFA_TRACK"],
        declaredMinors: ["MKT_MINOR"],
        discoveryTheme: "",
        activeNavTab: "saved",
        onboardingComplete: false,
        lastRecommendationData: { mode: "recommendations", semesters: [], current_progress: {} },
        lastRequestedCount: 5,
      },
    });

    expect([...next.completed]).toEqual(["ACCO 1030"]);
    expect([...next.inProgress]).toEqual(["FINA 3001"]);
    expect([...next.selectedMajors]).toEqual(["FIN_MAJOR"]);
    expect(next.selectedTracks).toEqual(["AIM_CFA_TRACK"]);
    expect([...next.selectedMinors]).toEqual(["MKT_MINOR"]);
    expect(next.targetSemester).toBe("Fall 2026");
    expect(next.maxRecs).toBe("5");
    expect(next.includeSummer).toBe(true);
    expect(next.activeNavTab).toBe("plan");
    expect(next.onboardingComplete).toBe(true);
    expect(next.lastRecommendationData?.mode).toBe("recommendations");
  });

  test("sanitizes invalid tracks and catalog-invalid courses", () => {
    const state = {
      ...initialState,
      courses: [
        { course_code: "ACCO 1030", course_name: "Accounting", credits: 3 },
        { course_code: "FINA 3001", course_name: "Finance", credits: 3 },
      ],
      programs: {
        majors: [{ id: "FIN_MAJOR", label: "Finance" }],
        tracks: [{ id: "AIM_CFA_TRACK", label: "AIM CFA", parent_major_id: "AIM_MAJOR" }],
        minors: [{ id: "MKT_MINOR", label: "Marketing" }],
        default_track_id: "FIN_MAJOR",
      },
    };

    const next = appReducer(state, {
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: {
        completed: ["ACCO 1030", "NOTREAL 9999"],
        inProgress: ["ACCO 1030", "FINA 3001"],
        targetSemester: "Fall 2026",
        semesterCount: "2",
        maxRecs: "4",
        includeSummer: false,
        canTake: "",
        declaredMajors: ["FIN_MAJOR", "UNKNOWN_MAJOR"],
        declaredTracks: ["UNKNOWN_TRACK", "AIM_CFA_TRACK"],
        declaredMinors: ["MKT_MINOR", "UNKNOWN_MINOR"],
        discoveryTheme: "",
        activeNavTab: "saved",
        onboardingComplete: false,
      },
    });

    expect([...next.completed]).toEqual(["ACCO 1030"]);
    expect([...next.inProgress]).toEqual(["FINA 3001"]);
    expect([...next.selectedMajors]).toEqual(["FIN_MAJOR"]);
    expect(next.selectedTracks).toEqual(["AIM_CFA_TRACK"]);
    expect([...next.selectedMinors]).toEqual(["MKT_MINOR"]);
  });
});
