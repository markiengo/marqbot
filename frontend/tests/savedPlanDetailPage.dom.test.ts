// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

import { SavedPlanDetailPage } from "../src/components/saved/SavedPlanDetailPage";
import { makeAppState, renderWithApp } from "./testUtils";

const { pushSpy, deletePlanSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  deletePlanSpy: vi.fn(),
}));

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
    loadPlan: (planId: string) =>
      planId === "plan-1"
        ? {
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
            },
            recommendationData: {
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
            },
            lastRequestedCount: 5,
            inputHash: "abc",
            resultsInputHash: "abc",
            lastGeneratedAt: "2026-03-02T10:00:00.000Z",
          }
        : null,
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

describe("SavedPlanDetailPage delete confirmation", () => {
  beforeEach(() => {
    pushSpy.mockReset();
    deletePlanSpy.mockReset();
    deletePlanSpy.mockReturnValue({ ok: true, plans: [] });
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
});
