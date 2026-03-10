import { describe, expect, test } from "vitest";

import {
  getStudentStageHistoryConflict,
  inferStudentStageFromCourseCodes,
  resolveStudentStageSelection,
} from "../../frontend/src/lib/studentStage";

describe("studentStage helpers", () => {
  test("infers graduate and doctoral stages from higher-level course history", () => {
    expect(inferStudentStageFromCourseCodes(["ACCO 1030", "GRAD 6001"])).toBe("graduate");
    expect(inferStudentStageFromCourseCodes(["DOC 8001"])).toBe("doctoral");
  });

  test("uses inference when no explicit stage is stored", () => {
    const resolved = resolveStudentStageSelection({
      completed: ["GRAD 6001"],
      inProgress: [],
    });

    expect(resolved.studentStage).toBe("graduate");
    expect(resolved.studentStageIsExplicit).toBe(false);
  });

  test("flags history conflicts only when recorded work exceeds the selected stage", () => {
    expect(getStudentStageHistoryConflict({
      studentStage: "undergrad",
      completed: ["GRAD 6001"],
      inProgress: [],
    })).toBe("graduate");

    expect(getStudentStageHistoryConflict({
      studentStage: "doctoral",
      completed: ["GRAD 6001"],
      inProgress: [],
    })).toBeNull();
  });
});
