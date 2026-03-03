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
