// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PlannerLayout } from "../src/components/planner/PlannerLayout";
import { makeAppState, renderWithApp } from "./testUtils";

const { postRecommendSpy } = vi.hoisted(() => ({
  postRecommendSpy: vi.fn(),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => createElement("div", null, children),
  LayoutGroup: ({ children }: Record<string, unknown>) => createElement("div", null, children),
}));

vi.mock("@/lib/api", () => ({
  postRecommend: postRecommendSpy,
  loadProgramBuckets: vi.fn(async () => []),
}));

vi.mock("@/hooks/useSavedPlans", () => ({
  useSavedPlans: () => ({
    hydrated: true,
    createPlan: vi.fn(() => ({ ok: true })),
  }),
}));

vi.mock("../src/components/planner/ProgressDashboard", () => ({
  ProgressDashboard: () => createElement("div", null, "Progress"),
  useProgressMetrics: () => ({}),
}));

vi.mock("../src/components/planner/ProgressModal", () => ({
  ProgressModal: () => null,
}));

vi.mock("../src/components/planner/CanTakeSection", () => ({
  CanTakeSection: () => createElement("div", null, "Can take"),
}));

vi.mock("../src/components/planner/EditPlanModal", () => ({
  EditPlanModal: ({ open, semesters, onEditSemester }: any) => {
    if (!open) return null;
    return createElement(
      "div",
      { "data-testid": "edit-plan-modal" },
      createElement("button", { onClick: () => onEditSemester(0) }, `Pick ${semesters[0].target_semester}`),
    );
  },
}));

vi.mock("../src/components/planner/SemesterModal", () => ({
  SemesterModal: ({ open, openMode, onEditApply, onClose }: any) => {
    if (!open) return null;
    return createElement(
      "div",
      { "data-testid": "semester-modal", "data-mode": openMode },
      createElement(
        "button",
        {
          onClick: () =>
            void onEditApply([
              { course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3 },
            ]),
        },
        "Apply Edited Semester",
      ),
      createElement("button", { onClick: onClose }, "Close Semester Modal"),
    );
  },
}));

vi.mock("../src/components/planner/ProfileModal", async () => {
  const { useAppContext } = await import("../src/context/AppContext");

  return {
    ProfileModal: ({ open, onSubmitRecommendations }: any) => {
      const { dispatch } = useAppContext();
      if (!open) return null;
      return createElement(
        "div",
        { "data-testid": "profile-modal" },
        createElement(
          "button",
          { onClick: () => dispatch({ type: "SET_SCHEDULING_STYLE", payload: "mixer" }) },
          "Set Mixer",
        ),
        createElement("button", { onClick: () => void onSubmitRecommendations() }, "Run Profile Submit"),
      );
    },
  };
});

vi.mock("../src/components/planner/RecommendationsPanel", () => ({
  RecommendationsPanel: ({ data }: any) =>
    createElement(
      "div",
      { "data-testid": "recommendations-panel" },
      (data?.semesters ?? []).map((semester: any, index: number) =>
        createElement(
          "div",
          { key: `${semester.target_semester || "semester"}-${index}` },
          `${semester.target_semester || "term"}: ${(semester.recommendations ?? [])
            .map((course: { course_code: string }) => course.course_code)
            .join(",")}`,
        ),
      ),
    ),
}));

vi.mock("../src/components/planner/CourseListModal", () => ({
  CourseListModal: () => null,
}));

vi.mock("../src/components/planner/FeedbackModal", () => ({
  FeedbackModal: () => null,
}));

vi.mock("../src/components/planner/MajorGuideModal", () => ({
  MajorGuideModal: () => null,
  rankingExplainerItems: [],
  tierLadder: [],
}));

vi.mock("../src/components/shared/CourseDetailModal", () => ({
  CourseDetailModal: () => null,
}));

vi.mock("@/components/shared/Modal", () => ({
  Modal: ({ open, children }: any) => (open ? createElement("div", null, children) : null),
}));

vi.mock("@/components/saved/SavePlanModal", () => ({
  SavePlanModal: () => null,
}));

describe("PlannerLayout edited semesters survive preference reruns", () => {
  beforeEach(() => {
    postRecommendSpy.mockReset();
  });

  test("preserves the edited semester as the locked prefix when preferences change", async () => {
    postRecommendSpy
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Spring 2027",
            recommendations: [{ course_code: "ECON 2000", course_name: "Economics", credits: 3 }],
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Spring 2027",
            recommendations: [{ course_code: "FINA 3001", course_name: "Financial Management", credits: 3 }],
          },
        ],
      });

    const user = userEvent.setup();

    renderWithApp(
      createElement(PlannerLayout),
      makeAppState({
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
          { course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3, level: 2000 },
          { course_code: "ECON 2000", course_name: "Economics", credits: 3, level: 2000 },
          { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
        ],
        programs: {
          majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
          bucket_labels: {},
        },
        selectedMajors: new Set(["FIN_MAJOR"]),
        semesterCount: "2",
        maxRecs: "4",
        lastRecommendationData: {
          mode: "recommendations",
          semesters: [
            {
              target_semester: "Fall 2026",
              recommendations: [{ course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 }],
            },
            {
              target_semester: "Spring 2027",
              recommendations: [{ course_code: "ECON 2000", course_name: "Economics", credits: 3 }],
            },
          ],
        },
      }),
    );

    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: ACCO 1030");

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick fall 2026/i }));
    await user.click(screen.getByRole("button", { name: /apply edited semester/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100"));
    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2027: ECON 2000");

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    await user.click(screen.getByRole("button", { name: /set mixer/i }));

    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100");

    await user.click(screen.getByRole("button", { name: /run profile submit/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(2));

    const secondPayload = postRecommendSpy.mock.calls[1][0];
    expect(secondPayload.scheduling_style).toBe("mixer");
    expect(secondPayload.completed_courses).toContain("MATH 2100");
    expect(secondPayload.completed_courses).not.toContain("ACCO 1030");
    expect(secondPayload.target_semester).toBe("Spring 2027");
    expect(secondPayload.target_semester_count).toBe(1);

    await waitFor(() => expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100"));
    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2027: FINA 3001");
  });
});
