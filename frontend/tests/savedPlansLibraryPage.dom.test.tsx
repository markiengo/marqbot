// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SavedPlansLibraryPage } from "../src/components/saved/SavedPlansLibraryPage";
import { makeAppState, renderWithApp } from "./testUtils";

const { deletePlanSpy, savedLibraryState } = vi.hoisted(() => ({
  deletePlanSpy: vi.fn(),
  savedLibraryState: {
    plans: [] as any[],
    freshnessById: {} as Record<string, "fresh" | "stale" | "missing">,
  },
}));

function makePlan({
  id,
  name,
  updatedAt,
  targetSemester,
}: {
  id: string;
  name: string;
  updatedAt: string;
  targetSemester: string;
}) {
  return {
    id,
    name,
    notes: "",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt,
    inputs: {
      completed: ["ACCO 1030"],
      inProgress: [],
      declaredMajors: ["FIN_MAJOR"],
      declaredTracks: [],
      declaredMinors: [],
      discoveryTheme: "",
      targetSemester,
      semesterCount: "4",
      maxRecs: "5",
      includeSummer: false,
      studentStage: "undergrad",
      studentStageIsExplicit: false,
    },
    manualAddPins: [],
    recommendationData: null,
    lastRequestedCount: 5,
    inputHash: "abc",
    resultsInputHash: null,
    lastGeneratedAt: null,
  };
}

function cardOrder() {
  return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
}

vi.mock("@/hooks/useCourses", () => ({
  useCourses: () => ({
    courses: [
      { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
    ],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePrograms", () => ({
  usePrograms: () => ({
    programs: {
      majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
      tracks: [],
      minors: [],
      default_track_id: "FIN_MAJOR",
      bucket_labels: {},
    },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSavedPlans", () => ({
  useSavedPlans: () => ({
    hydrated: true,
    plans: savedLibraryState.plans,
    storageError: null,
    deletePlan: deletePlanSpy,
    getFreshness: (plan: { id: string }) => savedLibraryState.freshnessById[plan.id] ?? "missing",
  }),
}));

describe("SavedPlansLibraryPage sort controls", () => {
  beforeEach(() => {
    deletePlanSpy.mockReset();
    savedLibraryState.plans = [
      makePlan({
        id: "plan-newest-stale",
        name: "Exploratory Track",
        updatedAt: "2026-03-03T10:00:00.000Z",
        targetSemester: "Spring 2027",
      }),
      makePlan({
        id: "plan-fresh",
        name: "Finance Sprint",
        updatedAt: "2026-03-02T10:00:00.000Z",
        targetSemester: "Fall 2028",
      }),
      makePlan({
        id: "plan-missing",
        name: "Accelerated Option",
        updatedAt: "2026-03-01T10:00:00.000Z",
        targetSemester: "Fall 2026",
      }),
    ];
    savedLibraryState.freshnessById = {
      "plan-newest-stale": "stale",
      "plan-fresh": "fresh",
      "plan-missing": "missing",
    };
  });

  test("reorders saved plans by the three compare sort modes and preserves card actions", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlansLibraryPage), makeAppState());

    expect(cardOrder()).toEqual([
      "Exploratory Track",
      "Finance Sprint",
      "Accelerated Option",
    ]);

    expect(screen.getAllByRole("link", { name: /open saved plan/i })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^delete$/i })).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /freshest/i }));

    expect(cardOrder()).toEqual([
      "Finance Sprint",
      "Exploratory Track",
      "Accelerated Option",
    ]);
    expect(screen.getAllByRole("link", { name: /open saved plan/i })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^delete$/i })).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: /target semester/i }));

    expect(cardOrder()).toEqual([
      "Accelerated Option",
      "Exploratory Track",
      "Finance Sprint",
    ]);
    expect(screen.getAllByRole("link", { name: /open saved plan/i })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /^delete$/i })).toHaveLength(3);
  });
});
