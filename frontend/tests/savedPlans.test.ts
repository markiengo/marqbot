import { describe, expect, test } from "vitest";

import {
  createSavedPlan,
  hashSavedPlanInputs,
  updateSavedPlan,
  type StorageLike,
} from "../src/lib/savedPlans";

function createStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("savedPlans overwrite semantics", () => {
  test("updateSavedPlan preserves id and createdAt while replacing snapshot data", () => {
    const storage = createStorage();
    const initialInputs = {
      completed: ["ACCO 1030"],
      inProgress: [],
      declaredMajors: ["FIN_MAJOR"],
      declaredTracks: [],
      declaredMinors: [],
      discoveryTheme: "",
      targetSemester: "Fall 2026",
      semesterCount: "4",
      maxRecs: "5",
      includeSummer: false,
      schedulingStyle: "grinder" as const,
      studentStage: "undergrad" as const,
      studentStageIsExplicit: false,
    };
    const updatedInputs = {
      ...initialInputs,
      completed: ["ACCO 1030", "ECON 1103"],
      targetSemester: "Spring 2027",
      maxRecs: "6",
    };

    const created = createSavedPlan(
      {
        name: "Original plan",
        notes: "Original notes",
        inputs: initialInputs,
        recommendationData: {
          mode: "recommendations",
          semesters: [{ target_semester: "Fall 2026", recommendations: [] }],
        },
        lastRequestedCount: 5,
      },
      storage,
    );

    expect(created.ok).toBe(true);
    expect(created.plan).toBeTruthy();

    const updated = updateSavedPlan(
      created.plan!.id,
      {
        name: "Overwritten plan",
        notes: "Updated notes",
        inputs: updatedInputs,
        recommendationData: {
          mode: "recommendations",
          semesters: [{ target_semester: "Spring 2027", recommendations: [] }],
        },
        lastRequestedCount: 6,
      },
      storage,
    );

    expect(updated.ok).toBe(true);
    expect(updated.plan).toBeTruthy();
    expect(updated.plan!.id).toBe(created.plan!.id);
    expect(updated.plan!.createdAt).toBe(created.plan!.createdAt);
    expect(updated.plan!.name).toBe("Overwritten plan");
    expect(updated.plan!.notes).toBe("Updated notes");
    expect(updated.plan!.inputs.targetSemester).toBe("Spring 2027");
    expect(updated.plan!.lastRequestedCount).toBe(6);
    expect(updated.plan!.inputHash).toBe(hashSavedPlanInputs(updatedInputs));
    expect(updated.plan!.resultsInputHash).toBe(hashSavedPlanInputs(updatedInputs));
    expect(updated.plan!.lastGeneratedAt).toBeTruthy();
  });

  test("create mode still allows duplicate saved-plan names", () => {
    const storage = createStorage();
    const inputs = {
      completed: [],
      inProgress: [],
      declaredMajors: ["FIN_MAJOR"],
      declaredTracks: [],
      declaredMinors: [],
      discoveryTheme: "",
      targetSemester: "Fall 2026",
      semesterCount: "4",
      maxRecs: "5",
      includeSummer: false,
      schedulingStyle: "grinder" as const,
      studentStage: "undergrad" as const,
      studentStageIsExplicit: false,
    };

    const first = createSavedPlan(
      {
        name: "Same name",
        notes: "",
        inputs,
        recommendationData: null,
        lastRequestedCount: 5,
      },
      storage,
    );
    const second = createSavedPlan(
      {
        name: "Same name",
        notes: "",
        inputs,
        recommendationData: null,
        lastRequestedCount: 5,
      },
      storage,
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.plans.filter((plan) => plan.name === "Same name")).toHaveLength(2);
  });
});
