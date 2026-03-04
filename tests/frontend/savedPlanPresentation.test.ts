import { describe, expect, test } from "vitest";

import {
  buildSavedPlanProgramLine,
  getSavedPlanFreshnessCopy,
  sortSavedPlans,
} from "../../frontend/src/lib/savedPlanPresentation";
import type { ProgramsData, SavedPlanRecord } from "../../frontend/src/lib/types";

const programs: ProgramsData = {
  majors: [{ id: "FIN_MAJOR", label: "Finance" }],
  tracks: [{ id: "AIM_FINTECH_TRACK", label: "Fintech", parent_major_id: "AIM_MAJOR" }],
  minors: [],
  default_track_id: "FIN_MAJOR",
};

function makePlan(overrides: Partial<SavedPlanRecord> = {}): SavedPlanRecord {
  return {
    id: overrides.id || "plan-1",
    name: overrides.name || "Fintech Push",
    notes: overrides.notes || "Summer-heavy version",
    createdAt: overrides.createdAt || "2026-03-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-03-02T00:00:00.000Z",
    inputs: overrides.inputs || {
      completed: ["ACCO 1030"],
      inProgress: ["FINA 3001"],
      declaredMajors: ["FIN_MAJOR"],
      declaredTracks: ["AIM_FINTECH_TRACK"],
      declaredMinors: [],
      discoveryTheme: "",
      targetSemester: "Fall 2026",
      semesterCount: "3",
      maxRecs: "4",
      includeSummer: true,
    },
    recommendationData: overrides.recommendationData || { mode: "recommendations", semesters: [] },
    lastRequestedCount: overrides.lastRequestedCount || 4,
    inputHash: overrides.inputHash || "hash-a",
    resultsInputHash: overrides.resultsInputHash === undefined ? "hash-a" : overrides.resultsInputHash,
    lastGeneratedAt: overrides.lastGeneratedAt === undefined ? "2026-03-02T00:00:00.000Z" : overrides.lastGeneratedAt,
  };
}

describe("savedPlanPresentation", () => {
  test("builds the program summary line from labels", () => {
    expect(buildSavedPlanProgramLine(makePlan(), programs)).toBe("Finance / Fintech");
  });

  test("sorts by name and date in stable directions", () => {
    const alpha = makePlan({ id: "a", name: "Alpha", updatedAt: "2026-03-01T00:00:00.000Z" });
    const beta = makePlan({ id: "b", name: "Beta", updatedAt: "2026-03-03T00:00:00.000Z" });
    expect(sortSavedPlans([alpha, beta], "recent").map((plan) => plan.id)).toEqual(["b", "a"]);
    expect(sortSavedPlans([alpha, beta], "oldest").map((plan) => plan.id)).toEqual(["a", "b"]);
    expect(sortSavedPlans([beta, alpha], "name").map((plan) => plan.id)).toEqual(["a", "b"]);
  });

  test("exposes user-facing freshness copy", () => {
    expect(getSavedPlanFreshnessCopy("fresh").label).toBe("Current");
    expect(getSavedPlanFreshnessCopy("stale").reason).toContain("older inputs");
    expect(getSavedPlanFreshnessCopy("missing").label).toBe("Snapshot missing");
  });
});
