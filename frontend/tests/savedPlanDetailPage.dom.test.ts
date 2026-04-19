// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SavedPlanDetailPage } from "../src/components/saved/SavedPlanDetailPage";
import { makeAppState, renderWithApp } from "./testUtils";

const {
  buildSnapshotSpy,
  deletePlanSpy,
  dispatchSpy,
  planState,
  pushSpy,
  updatePlanSpy,
} = vi.hoisted(() => ({
  buildSnapshotSpy: vi.fn((plan: { id: string }) => ({ restoredPlanId: plan.id })),
  deletePlanSpy: vi.fn(),
  dispatchSpy: vi.fn(),
  planState: { current: null as any },
  pushSpy: vi.fn(),
  updatePlanSpy: vi.fn(),
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
    manualAddPins: [],
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
        {
          target_semester: "Spring 2027",
          standing_label: "Sophomore",
          recommendations: [
            { course_code: "MKTG 3001", course_name: "Marketing Management", credits: 3 },
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

vi.mock("@/context/AppContext", async () => {
  const actual = await vi.importActual<typeof import("../src/context/AppContext")>("@/context/AppContext");
  return {
    ...actual,
    useAppContext: () => ({
      dispatch: dispatchSpy,
    }),
  };
});

vi.mock("@/lib/savedPlans", () => ({
  buildSessionSnapshotFromSavedPlan: buildSnapshotSpy,
}));

vi.mock("@/hooks/useCourses", () => ({
  useCourses: () => ({
    courses: [
      { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
      { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
      { course_code: "MKTG 3001", course_name: "Marketing Management", credits: 3, level: 3000 },
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
    updatePlan: updatePlanSpy,
    deletePlan: deletePlanSpy,
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

describe("SavedPlanDetailPage saved-view interactions", () => {
  beforeEach(() => {
    buildSnapshotSpy.mockClear();
    deletePlanSpy.mockReset();
    deletePlanSpy.mockReturnValue({ ok: true, plans: [] });
    dispatchSpy.mockClear();
    pushSpy.mockClear();
    updatePlanSpy.mockReset();
    updatePlanSpy.mockReturnValue({ ok: true, plans: [] });
    planState.current = makePlan(true);
  });

  test("requires confirmation before deleting from the detail page", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlanDetailPage, { planId: "plan-1" }), makeAppState());

    await user.click(screen.getByRole("button", { name: /delete plan/i }));

    expect(deletePlanSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /delete this saved version/i })).toBeInTheDocument();

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

  test("resumes in planner from the saved detail view", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlanDetailPage, { planId: "plan-1" }), makeAppState());

    await user.click(screen.getByRole("button", { name: /resume in planner/i }));

    expect(buildSnapshotSpy).toHaveBeenCalledWith(planState.current);
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: "APPLY_PLANNER_SNAPSHOT",
      payload: { restoredPlanId: "plan-1" },
    });
    expect(pushSpy).toHaveBeenCalledWith("/planner");
  });

  test("switches saved semesters without mutating planner state", async () => {
    const user = userEvent.setup();

    renderWithApp(createElement(SavedPlanDetailPage, { planId: "plan-1" }), makeAppState());

    expect(screen.getByText(/preview fall 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/lead course financial management/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view spring 2027 saved semester/i }));

    expect(screen.getByText(/preview spring 2027/i)).toBeInTheDocument();
    expect(screen.getByText(/lead course marketing management/i)).toBeInTheDocument();
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
