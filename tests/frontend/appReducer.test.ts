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
          {
            id: "AIM_CFA_TRACK",
            label: "AIM CFA",
            parent_major_id: "AIM_MAJOR",
            required_major_id: "FIN_MAJOR",
          },
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
        manualAddPins: [
          {
            course_code: "FINA 3001",
            semester_index: 0,
            course_snapshot: { course_code: "FINA 3001", course_name: "Finance", credits: 3 },
            pinned_at: 1,
          },
        ],
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
    expect(next.manualAddPins).toHaveLength(1);
    expect(next.lastRecommendationData).toBeNull();
  });

  test("infers student stage from restored history when the snapshot has no explicit stage", () => {
    const state = {
      ...initialState,
      courses: [
        { course_code: "GRAD 6001", course_name: "Graduate Seminar", credits: 3, level: 6000 },
      ],
      programs: {
        majors: [{ id: "FIN_MAJOR", label: "Finance" }],
        tracks: [],
        minors: [],
        default_track_id: "FIN_MAJOR",
      },
    };

    const next = appReducer(state, {
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: {
        completed: ["GRAD 6001"],
        inProgress: [],
        targetSemester: "Fall 2026",
        semesterCount: "2",
        maxRecs: "4",
        includeSummer: false,
        canTake: "",
        declaredMajors: ["FIN_MAJOR"],
        declaredTracks: [],
        declaredMinors: [],
        discoveryTheme: "",
        activeNavTab: "saved",
        onboardingComplete: false,
      },
    });

    expect(next.studentStage).toBe("graduate");
    expect(next.studentStageIsExplicit).toBe(false);
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
        tracks: [
          {
            id: "AIM_CFA_TRACK",
            label: "AIM CFA",
            parent_major_id: "AIM_MAJOR",
            required_major_id: "FIN_MAJOR",
          },
        ],
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

  test("drops tracks whose required major is missing during snapshot restore", () => {
    const state = {
      ...initialState,
      courses: [{ course_code: "ACCO 1030", course_name: "Accounting", credits: 3 }],
      programs: {
        majors: [{ id: "ACCO_MAJOR", label: "Accounting" }],
        tracks: [
          {
            id: "AIM_CFA_TRACK",
            label: "AIM CFA",
            parent_major_id: "AIM_MAJOR",
            required_major_id: "FIN_MAJOR",
          },
        ],
        minors: [],
        default_track_id: "ACCO_MAJOR",
      },
    };

    const next = appReducer(state, {
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: {
        completed: ["ACCO 1030"],
        inProgress: [],
        targetSemester: "Fall 2026",
        semesterCount: "2",
        maxRecs: "4",
        includeSummer: false,
        canTake: "",
        declaredMajors: ["ACCO_MAJOR"],
        declaredTracks: ["AIM_CFA_TRACK"],
        declaredMinors: [],
        discoveryTheme: "",
        activeNavTab: "saved",
        onboardingComplete: false,
      },
    });

    expect([...next.selectedMajors]).toEqual(["ACCO_MAJOR"]);
    expect(next.selectedTracks).toEqual([]);
  });

  test("keeps an explicit student stage when higher-level history is added later", () => {
    const state = {
      ...initialState,
      courses: [
        { course_code: "GRAD 6001", course_name: "Graduate Seminar", credits: 3, level: 6000 },
      ],
    };

    const explicit = appReducer(state, {
      type: "SET_STUDENT_STAGE",
      payload: "undergrad",
    });
    const next = appReducer(explicit, {
      type: "ADD_COMPLETED",
      payload: "GRAD 6001",
    });

    expect(next.studentStage).toBe("undergrad");
    expect(next.studentStageIsExplicit).toBe(true);
  });
});

describe("appReducer recommendation invalidation", () => {
  test.each([
    [{ type: "SET_TARGET_SEMESTER", payload: "Spring 2027" }],
    [{ type: "SET_SEMESTER_COUNT", payload: "4" }],
    [{ type: "SET_MAX_RECS", payload: "5" }],
    [{ type: "SET_INCLUDE_SUMMER", payload: true }],
    [{ type: "SET_HONORS_STUDENT", payload: true }],
    [{ type: "SET_SCHEDULING_STYLE", payload: "mixer" }],
    [{ type: "SET_STUDENT_STAGE", payload: "graduate" }],
  ])("clears the last recommendation snapshot for %o", (action) => {
    const next = appReducer(
      {
        ...initialState,
        lastRecommendationData: { mode: "recommendations", semesters: [], current_progress: {} },
      },
      action as any,
    );

    expect(next.lastRecommendationData).toBeNull();
  });
});
