// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SavedPlansLibraryPage } from "../src/components/saved/SavedPlansLibraryPage";
import { makeAppState, renderWithApp } from "./testUtils";

const { deletePlanSpy, pushSpy, savedLibraryState, updatePlanSpy } = vi.hoisted(() => ({
  deletePlanSpy: vi.fn(),
  pushSpy: vi.fn(),
  updatePlanSpy: vi.fn(),
  savedLibraryState: {
    plans: [] as any[],
    freshnessById: {} as Record<string, "fresh" | "stale" | "missing">,
  },
}));

function makePlan({
  id,
  name,
  notes,
  updatedAt,
  targetSemester,
  withSnapshot = true,
}: {
  id: string;
  name: string;
  notes: string;
  updatedAt: string;
  targetSemester: string;
  withSnapshot?: boolean;
}) {
  return {
    id,
    name,
    notes,
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
    recommendationData: withSnapshot ? {
      mode: "recommendations",
      semesters: [
        {
          target_semester: targetSemester,
          recommendations: [
            { course_code: "FINA 3001", course_name: "Financial Management", credits: 3 },
          ],
        },
      ],
    } : null,
    lastRequestedCount: 5,
    inputHash: "abc",
    resultsInputHash: withSnapshot ? "abc" : null,
    lastGeneratedAt: withSnapshot ? updatedAt : null,
  };
}

function rowOrder() {
  return screen
    .getAllByRole("button", { name: /saved plan$/i })
    .map((button) => button.getAttribute("aria-label"));
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
  }),
}));

vi.mock("@/hooks/useCourses", () => ({
  useCourses: () => ({
    courses: [
      { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
      { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
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
    updatePlan: updatePlanSpy,
    deletePlan: deletePlanSpy,
    getFreshness: (plan: { id: string }) => savedLibraryState.freshnessById[plan.id] ?? "missing",
  }),
}));

vi.mock("@/components/planner/RecommendationsPanel", () => ({
  RecommendationsPanel: ({
    data,
    selectedSemesterIdx = 0,
  }: {
    data: { semesters?: Array<{ target_semester?: string; recommendations?: Array<{ course_name?: string }> }> };
    selectedSemesterIdx?: number;
  }) =>
    createElement(
      "div",
      { "data-testid": "recommendations-panel" },
      createElement("p", null, `Preview ${data?.semesters?.[selectedSemesterIdx]?.target_semester ?? "none"}`),
      createElement(
        "p",
        null,
        `Lead course ${data?.semesters?.[selectedSemesterIdx]?.recommendations?.[0]?.course_name ?? "none"}`,
      ),
    ),
}));

vi.mock("@/components/planner/SemesterModal", () => ({
  SemesterModal: () => null,
}));

vi.mock("@/components/shared/CourseDetailModal", () => ({
  CourseDetailModal: () => null,
}));

describe("SavedPlansLibraryPage workspace controls", () => {
  beforeEach(() => {
    deletePlanSpy.mockReset();
    deletePlanSpy.mockReturnValue({ ok: true, plans: [] });
    pushSpy.mockReset();
    updatePlanSpy.mockReset();
    updatePlanSpy.mockReturnValue({ ok: true, plans: [] });
    savedLibraryState.plans = [
      makePlan({
        id: "plan-newest-stale",
        name: "Exploratory Track",
        notes: "Good if summer stays open.",
        updatedAt: "2026-03-03T10:00:00.000Z",
        targetSemester: "Spring 2027",
      }),
      makePlan({
        id: "plan-fresh",
        name: "Finance Sprint",
        notes: "Recruiting semester build.",
        updatedAt: "2026-03-02T10:00:00.000Z",
        targetSemester: "Fall 2028",
      }),
      makePlan({
        id: "plan-missing",
        name: "Accelerated Option",
        notes: "Saved before recommendations were generated.",
        updatedAt: "2026-03-01T10:00:00.000Z",
        targetSemester: "Fall 2026",
        withSnapshot: false,
      }),
    ];
    savedLibraryState.freshnessById = {
      "plan-newest-stale": "stale",
      "plan-fresh": "fresh",
      "plan-missing": "missing",
    };
  });

  test("supports search, freshness filter, and sort order in the dense saved-plan list", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlansLibraryPage), makeAppState());

    expect(rowOrder()).toEqual([
      "Exploratory Track saved plan",
      "Finance Sprint saved plan",
      "Accelerated Option saved plan",
    ]);
    expect(screen.getByRole("heading", { level: 1, name: /saved plans/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /exploratory track/i })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: /search saved plans/i }), "recruiting");

    expect(rowOrder()).toEqual(["Finance Sprint saved plan"]);
    expect(screen.getByRole("heading", { level: 1, name: /finance sprint/i })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: /search saved plans/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: /freshness filter/i }), "fresh");

    expect(rowOrder()).toEqual(["Finance Sprint saved plan"]);

    await user.selectOptions(screen.getByRole("combobox", { name: /freshness filter/i }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: /sort saved plans/i }), "name");

    expect(rowOrder()).toEqual([
      "Accelerated Option saved plan",
      "Exploratory Track saved plan",
      "Finance Sprint saved plan",
    ]);
  });

  test("selects a saved-plan row and keeps the detail action bar aligned with snapshot availability", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlansLibraryPage), makeAppState());

    expect(screen.getByRole("heading", { level: 1, name: /exploratory track/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /export pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resume in planner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit details/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /accelerated option saved plan/i }));

    expect(screen.getByRole("heading", { level: 1, name: /accelerated option/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /export pdf/i })).not.toBeInTheDocument();
    expect(screen.getByText(/pdf export requires a saved snapshot/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resume in planner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit details/i })).toBeInTheDocument();
  });
});
