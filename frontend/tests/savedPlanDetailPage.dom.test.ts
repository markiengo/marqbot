// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SavedPlanDetailPage } from "../src/components/saved/SavedPlanDetailPage";
import { makeAppState, renderWithApp } from "./testUtils";

const { pushSpy, deletePlanSpy, planState } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  deletePlanSpy: vi.fn(),
  planState: { current: null as any },
}));

function makePlan(withSnapshot = true) {
  return {
    id: "plan-1",
    name: "Finance Sprint",
    notes: "Recruiting semester",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-02T10:00:00.000Z",
    inputs: {
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
      studentStage: "undergrad",
      studentStageIsExplicit: false,
    },
    recommendationData: withSnapshot ? {
      mode: "recommendations",
      semesters: [
        {
          target_semester: "Fall 2026",
          standing_label: "Sophomore",
          recommendations: [
            { course_code: "FINA 3001", course_name: "Financial Management", credits: 3 },
          ],
        },
      ],
    } : null,
    lastRequestedCount: 5,
    inputHash: "abc",
    resultsInputHash: "abc",
    lastGeneratedAt: "2026-03-02T10:00:00.000Z",
  };
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
    storageError: null,
    loadPlan: (planId: string) => (planId === "plan-1" ? planState.current : null),
    getFreshness: () => "fresh",
    updatePlan: vi.fn(),
    deletePlan: deletePlanSpy,
  }),
}));

vi.mock("@/components/planner/RecommendationsPanel", () => ({
  RecommendationsPanel: () => createElement("div", null, "Recommendations"),
}));

vi.mock("@/components/planner/SemesterModal", () => ({
  SemesterModal: () => null,
}));

vi.mock("@/components/shared/CourseDetailModal", () => ({
  CourseDetailModal: () => null,
}));

describe("SavedPlanDetailPage export and delete actions", () => {
  beforeEach(() => {
    pushSpy.mockReset();
    deletePlanSpy.mockReset();
    deletePlanSpy.mockReturnValue({ ok: true, plans: [] });
    planState.current = makePlan(true);
  });

  test("requires confirmation before deleting from the detail page", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlanDetailPage, { planId: "plan-1" }), makeAppState());

    await user.click(screen.getByRole("button", { name: /delete plan/i }));

    expect(deletePlanSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /are you sure/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yes, delete plan/i }));

    await waitFor(() => expect(deletePlanSpy).toHaveBeenCalledWith("plan-1"));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith("/saved"));
  });

  test("shows an export link only when a saved snapshot exists", () => {
    const { unmount } = renderWithApp(
      createElement(SavedPlanDetailPage, { planId: "plan-1" }),
      makeAppState(),
    );

    const exportLink = screen.getByRole("link", { name: /export pdf/i });
    expect(exportLink).toHaveAttribute("href", "/saved?plan=plan-1&export=pdf");
    expect(exportLink).toHaveAttribute("target", "_blank");

    planState.current = makePlan(false);
    unmount();
    renderWithApp(createElement(SavedPlanDetailPage, { planId: "plan-1" }), makeAppState());

    expect(screen.queryByRole("link", { name: /export pdf/i })).not.toBeInTheDocument();
    expect(screen.getByText(/pdf export requires a saved snapshot/i)).toBeInTheDocument();
  });
});
