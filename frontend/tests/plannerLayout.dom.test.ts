// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PlannerLayout } from "../src/components/planner/PlannerLayout";
import { makeAppState, renderWithApp } from "./testUtils";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const {
  fetchRecommendationsSpy,
  postReplanSpy,
  recommendationData,
  progressModalSpy,
} = vi.hoisted(() => ({
  fetchRecommendationsSpy: vi.fn(),
  postReplanSpy: vi.fn(),
  progressModalSpy: vi.fn(),
  recommendationData: {
    mode: "recommendations" as const,
    current_progress: {
      MCC_WRIT: {
        label: "MCC Writing Intensive",
        needed: 1,
        needed_count: 1,
        completed_applied: [],
        in_progress_applied: [],
        completed_done: 0,
        in_progress_increment: 0,
        completed_courses: 0,
        in_progress_courses: 0,
        requirement_mode: "required",
        satisfied: false,
      },
    },
    semesters: [
      {
        target_semester: "Fall 2026",
        recommendations: [
          {
            course_code: "ACCO 1030",
            course_name: "Financial Accounting",
            credits: 3,
            fills_buckets: ["MCC_WRIT"],
          },
        ],
      },
      {
        target_semester: "Spring 2027",
        recommendations: [
          {
            course_code: "FINA 3001",
            course_name: "Financial Management",
            credits: 3,
            fills_buckets: ["MCC_WRIT"],
          },
        ],
      },
    ],
  },
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
}));

vi.mock("@/hooks/useRecommendations", () => ({
  useRecommendations: () => ({
    data: recommendationData,
    requestedCount: 5,
    loading: false,
    error: null,
    fetchRecommendations: fetchRecommendationsSpy,
  }),
}));

vi.mock("@/hooks/useSavedPlans", () => ({
  useSavedPlans: () => ({
    hydrated: true,
    createPlan: vi.fn(() => ({ ok: true })),
  }),
}));

vi.mock("@/lib/api", () => ({
  postReplan: postReplanSpy,
  loadProgramBuckets: vi.fn(async () => []),
}));

vi.mock("../src/components/planner/ProgressDashboard", () => ({
  ProgressDashboard: () => createElement("div", null, "Progress"),
  useProgressMetrics: () => ({}),
}));

vi.mock("../src/components/planner/ProgressModal", () => ({
  ProgressModal: (props: unknown) => {
    progressModalSpy(props);
    return null;
  },
}));

vi.mock("../src/components/planner/ProfileModal", () => ({
  ProfileModal: () => null,
}));

vi.mock("../src/components/planner/CanTakeSection", () => ({
  CanTakeSection: () => createElement("div", null, "Can take"),
}));

vi.mock("../src/components/planner/RecommendationsPanel", () => ({
  RecommendationsPanel: () => createElement("div", null, "Recommendations"),
}));

vi.mock("../src/components/planner/EditPlanModal", () => ({
  EditPlanModal: ({ open, semesters, onEditSemester, onClose }: any) => {
    if (!open) return null;
    return createElement(
      "div",
      { "data-testid": "edit-plan-modal" },
      createElement("button", { onClick: () => onEditSemester(0) }, `Pick ${semesters[0].target_semester}`),
      createElement("button", { onClick: () => onEditSemester(1) }, `Pick ${semesters[1].target_semester}`),
      createElement("button", { onClick: onClose }, "Close Edit Plan"),
    );
  },
}));

vi.mock("../src/components/planner/SemesterModal", async () => {
  const React = await import("react");
  return {
    SemesterModal: ({ open, openMode, index, candidatePool, candidatePoolLoading, onRequestCandidates, onClose }: any) => {
      React.useEffect(() => {
        if (open && openMode === "edit") {
          onRequestCandidates?.();
        }
      }, [index, onRequestCandidates, open, openMode]);

      if (!open) return null;

      return createElement(
        "div",
        { "data-testid": "semester-modal" },
        createElement("div", { "data-testid": "semester-index" }, String(index)),
        createElement("div", { "data-testid": "candidate-loading" }, candidatePoolLoading ? "loading" : "idle"),
        createElement(
          "div",
          { "data-testid": "candidate-pool" },
          (candidatePool ?? []).map((course: { course_code: string }) => course.course_code).join(",") || "empty",
        ),
        createElement("button", { onClick: onClose }, "Close Semester Modal"),
      );
    },
  };
});

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

describe("PlannerLayout semester edit requests", () => {
  beforeEach(() => {
    fetchRecommendationsSpy.mockReset();
    postReplanSpy.mockReset();
    progressModalSpy.mockReset();
    recommendationData.current_progress = {
      MCC_WRIT: {
        label: "MCC Writing Intensive",
        needed: 1,
        needed_count: 1,
        completed_applied: [],
        in_progress_applied: [],
        completed_done: 0,
        in_progress_increment: 0,
        completed_courses: 0,
        in_progress_courses: 0,
        requirement_mode: "required",
        satisfied: false,
      },
    };
    recommendationData.semesters = [
      {
        target_semester: "Fall 2026",
        recommendations: [
          {
            course_code: "ACCO 1030",
            course_name: "Financial Accounting",
            credits: 3,
            fills_buckets: ["MCC_WRIT"],
          },
        ],
      },
      {
        target_semester: "Spring 2027",
        recommendations: [
          {
            course_code: "FINA 3001",
            course_name: "Financial Management",
            credits: 3,
            fills_buckets: ["MCC_WRIT"],
          },
        ],
      },
    ];
  });

  test("passes raw current progress into the current degree progress modal instead of projected plan progress", () => {
    renderWithApp(
      createElement(PlannerLayout),
      makeAppState({
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
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
        maxRecs: "5",
      }),
    );

    expect(progressModalSpy).toHaveBeenCalled();
    const lastProps = progressModalSpy.mock.calls.at(-1)?.[0] as {
      currentProgress?: Record<string, {
        in_progress_applied?: string[];
        in_progress_courses?: number;
        satisfied?: boolean;
      }>;
    };

    expect(lastProps.currentProgress?.MCC_WRIT.in_progress_applied).toEqual([]);
    expect(lastProps.currentProgress?.MCC_WRIT.in_progress_courses).toBe(0);
    expect(lastProps.currentProgress?.MCC_WRIT.satisfied).toBe(false);
  });

  test("keeps the latest semester swap pool when older candidate requests resolve later", async () => {
    const firstRequest = deferred<any>();
    const secondRequest = deferred<any>();
    postReplanSpy
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    const user = userEvent.setup();

    renderWithApp(
      createElement(PlannerLayout),
      makeAppState({
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
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
        maxRecs: "5",
      }),
    );

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick fall 2026/i }));
    await waitFor(() => expect(screen.getByTestId("candidate-loading")).toHaveTextContent("loading"));

    await user.click(screen.getByRole("button", { name: /close semester modal/i }));

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick spring 2027/i }));

    secondRequest.resolve({
      mode: "recommendations",
      semesters: [
        {
          recommendations: [
            { course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3 },
          ],
        },
      ],
    });

    await waitFor(() => expect(screen.getByTestId("candidate-pool")).toHaveTextContent("MATH 2100"));
    expect(screen.getByTestId("candidate-loading")).toHaveTextContent("idle");

    firstRequest.resolve({
      mode: "recommendations",
      semesters: [
        {
          recommendations: [
            { course_code: "HIST 1001", course_name: "World History", credits: 3 },
          ],
        },
      ],
    });

    await waitFor(() => expect(screen.getByTestId("candidate-loading")).toHaveTextContent("idle"));
    expect(screen.getByTestId("candidate-pool")).toHaveTextContent("MATH 2100");
    expect(screen.getByTestId("candidate-pool")).not.toHaveTextContent("HIST 1001");
  });
});
