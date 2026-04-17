import { describe, expect, test } from "vitest";

import { SAVED_PLANS_STORAGE_KEY } from "../../frontend/src/lib/constants";
import {
  buildSessionSnapshotFromSavedPlan,
  computeSavedPlanFreshness,
  createSavedPlan,
  deleteSavedPlan,
  listSavedPlans,
  updateSavedPlan,
} from "../../frontend/src/lib/savedPlans";
import type { PlannerManualAddPin, RecommendationResponse, SavedPlanRecord } from "../../frontend/src/lib/types";

function makeStorage(initial?: Record<string, string>) {
  const store = new Map(Object.entries(initial || {}));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function makeRecommendation(): RecommendationResponse {
  return {
    mode: "recommendations",
    semesters: [],
    current_progress: {},
    selection_context: {
      selected_program_ids: ["FIN_MAJOR"],
      selected_program_labels: ["Finance"],
    },
  };
}

function makeSavedPlan(overrides: Partial<SavedPlanRecord> = {}): SavedPlanRecord {
  const manualAddPins: PlannerManualAddPin[] = overrides.manualAddPins ?? [];
  return {
    id: overrides.id || "plan-1",
    name: overrides.name || "Finance Draft",
    notes: overrides.notes || "",
    createdAt: overrides.createdAt || "2026-03-03T00:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-03-03T00:00:00.000Z",
    inputs: overrides.inputs || {
      completed: ["ACCO 1030"],
      inProgress: ["FINA 3001"],
      declaredMajors: ["FIN_MAJOR"],
      declaredTracks: [],
      declaredMinors: [],
      discoveryTheme: "",
      targetSemester: "Fall 2026",
      semesterCount: "3",
      maxRecs: "4",
      includeSummer: false,
      studentStage: "undergrad",
      studentStageIsExplicit: false,
    },
    manualAddPins,
    recommendationData: overrides.recommendationData === undefined ? makeRecommendation() : overrides.recommendationData,
    lastRequestedCount: overrides.lastRequestedCount || 4,
    inputHash: overrides.inputHash || "hash-a",
    resultsInputHash: overrides.resultsInputHash === undefined ? "hash-a" : overrides.resultsInputHash,
    lastGeneratedAt: overrides.lastGeneratedAt === undefined ? "2026-03-03T00:00:00.000Z" : overrides.lastGeneratedAt,
  };
}

describe("savedPlans storage", () => {
  test("round-trips a saved plan through storage", () => {
    const storage = makeStorage();
    const created = createSavedPlan({
      name: "Finance Draft",
      inputs: {
        completed: ["ACCO 1030"],
        inProgress: ["FINA 3001"],
        declaredMajors: ["FIN_MAJOR"],
        declaredTracks: [],
        declaredMinors: [],
        discoveryTheme: "",
        targetSemester: "Fall 2026",
        semesterCount: "3",
        maxRecs: "4",
        includeSummer: false,
        studentStage: "undergrad",
        studentStageIsExplicit: false,
      },
      recommendationData: makeRecommendation(),
      lastRequestedCount: 4,
    }, storage);

    expect(created.ok).toBe(true);
    const plans = listSavedPlans(storage);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.name).toBe("Finance Draft");
    expect(plans[0]?.inputs.completed).toEqual(["ACCO 1030"]);
  });

  test("falls back safely on malformed storage payloads", () => {
    const storage = makeStorage({
      [SAVED_PLANS_STORAGE_KEY]: "{not-valid-json",
    });
    expect(listSavedPlans(storage)).toEqual([]);
  });

  test("sorts plans by updatedAt descending", () => {
    const storage = makeStorage({
      [SAVED_PLANS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        plans: [
          makeSavedPlan({ id: "older", updatedAt: "2026-03-01T00:00:00.000Z" }),
          makeSavedPlan({ id: "newer", updatedAt: "2026-03-02T00:00:00.000Z" }),
        ],
      }),
    });
    expect(listSavedPlans(storage).map((plan) => plan.id)).toEqual(["newer", "older"]);
  });
});

describe("savedPlans freshness", () => {
  test("reports fresh results when hashes match", () => {
    expect(computeSavedPlanFreshness(makeSavedPlan())).toBe("fresh");
  });

  test("reports stale results when hashes differ", () => {
    expect(computeSavedPlanFreshness(makeSavedPlan({ resultsInputHash: "hash-b" }))).toBe("stale");
  });

  test("reports missing results when recommendation data is absent", () => {
    expect(computeSavedPlanFreshness(makeSavedPlan({ recommendationData: null, resultsInputHash: null, lastGeneratedAt: null }))).toBe("missing");
  });
});

describe("savedPlans mutations", () => {
  test("creates, updates, and deletes plans", () => {
    const storage = makeStorage();
    const created = createSavedPlan({
      name: "Plan A",
      inputs: {
        completed: ["ACCO 1030"],
        inProgress: [],
        declaredMajors: ["FIN_MAJOR"],
        declaredTracks: [],
        declaredMinors: [],
        discoveryTheme: "",
        targetSemester: "Fall 2026",
        semesterCount: "2",
        maxRecs: "4",
        includeSummer: false,
        studentStage: "undergrad",
        studentStageIsExplicit: false,
      },
      recommendationData: makeRecommendation(),
      lastRequestedCount: 4,
    }, storage);
    expect(created.ok).toBe(true);
    const planId = created.plan!.id;

    const updated = updateSavedPlan(planId, {
      name: "Plan B",
      notes: "Updated notes",
      inputs: {
        ...created.plan!.inputs,
        includeSummer: true,
      },
      recommendationData: created.plan!.recommendationData,
      lastRequestedCount: 5,
      resultsInputHash: created.plan!.inputHash,
      lastGeneratedAt: created.plan!.lastGeneratedAt,
    }, storage);
    expect(updated.ok).toBe(true);
    expect(updated.plan?.name).toBe("Plan B");
    expect(updated.plan?.notes).toBe("Updated notes");
    expect(updated.plan?.inputs.includeSummer).toBe(true);

    const deleted = deleteSavedPlan(planId, storage);
    expect(deleted.ok).toBe(true);
    expect(deleted.plans).toHaveLength(0);
  });

  test("enforces the max saved plan cap", () => {
    const plans = Array.from({ length: 25 }, (_, index) =>
      makeSavedPlan({
        id: `plan-${index}`,
        name: `Plan ${index}`,
        updatedAt: `2026-03-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );
    const storage = makeStorage({
      [SAVED_PLANS_STORAGE_KEY]: JSON.stringify({ version: 1, plans }),
    });
    const result = createSavedPlan({
      name: "Overflow",
      inputs: plans[0]!.inputs,
      recommendationData: makeRecommendation(),
      lastRequestedCount: 4,
    }, storage);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Delete an older plan first");
  });
});

describe("savedPlans transforms", () => {
  test("builds a planner session snapshot from a saved plan", () => {
    const plan = makeSavedPlan();
    const snapshot = buildSessionSnapshotFromSavedPlan(plan);
    expect(snapshot.completed).toEqual(["ACCO 1030"]);
    expect(snapshot.inProgress).toEqual(["FINA 3001"]);
    expect(snapshot.declaredMajors).toEqual(["FIN_MAJOR"]);
    expect(snapshot.studentStage).toBe("undergrad");
    expect(snapshot.studentStageIsExplicit).toBe(false);
    expect(snapshot.manualAddPins).toEqual([]);
    expect(snapshot.lastRecommendationData).toBeUndefined();
    expect(snapshot.onboardingComplete).toBe(true);
  });
});
