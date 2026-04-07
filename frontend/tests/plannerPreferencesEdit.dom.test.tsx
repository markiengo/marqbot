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
      ...semesters.map((semester: any, index: number) =>
        createElement(
          "button",
          { key: `${semester.target_semester}-${index}`, onClick: () => onEditSemester(index) },
          `Pick ${semester.target_semester}`,
        ),
      ),
    );
  },
}));

vi.mock("../src/components/planner/SemesterModal", () => ({
  SemesterModal: ({ open, openMode, onEditApply, onClose, onRequestCandidates, candidatePool }: any) => {
    if (!open) return null;
    const chosen =
      Array.isArray(candidatePool) && candidatePool.length > 0
        ? [candidatePool[0]]
        : [{ course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3 }];
    return createElement(
      "div",
      { "data-testid": "semester-modal", "data-mode": openMode },
      createElement("button", { onClick: () => onRequestCandidates?.() }, "Load Candidate Pool"),
      createElement(
        "div",
        { "data-testid": "candidate-pool" },
        (candidatePool ?? []).map((course: { course_code: string }) => course.course_code).join(","),
      ),
      createElement(
        "button",
        {
          onClick: () => void onEditApply(chosen),
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

describe("PlannerLayout manual adds survive reruns", () => {
  beforeEach(() => {
    postRecommendSpy.mockReset();
  });

  test("preserves manual adds after a full profile rerun", async () => {
    postRecommendSpy
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Fall 2026",
            recommendations: [{ course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3 }],
          },
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
            target_semester: "Fall 2026",
            recommendations: [{ course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 }],
          },
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
    const firstPayload = postRecommendSpy.mock.calls[0][0];
    expect(firstPayload.selected_courses).toEqual(["MATH 2100"]);
    expect(firstPayload.target_semester).toBe("Fall 2026");
    expect(firstPayload.target_semester_count).toBe(2);
    await waitFor(() => expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100"));
    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2027: ECON 2000");

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    await user.click(screen.getByRole("button", { name: /set mixer/i }));

    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100");

    await user.click(screen.getByRole("button", { name: /run profile submit/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(2));

    const secondPayload = postRecommendSpy.mock.calls[1][0];
    expect(secondPayload.scheduling_style).toBe("mixer");
    expect(secondPayload.completed_courses).toBe("");
    expect(secondPayload.target_semester).toBe("Fall 2026");
    expect(secondPayload.target_semester_count).toBe(2);

    await waitFor(() => expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100"));
    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2027: FINA 3001");
  });

  test("uses eligible_swaps for the edit candidate pool when provided", async () => {
    postRecommendSpy.mockResolvedValueOnce({
      mode: "recommendations",
      semesters: [
        {
          target_semester: "Fall 2026",
          recommendations: [{ course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 }],
          eligible_swaps: [
            { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 },
            { course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3 },
          ],
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
        ],
        programs: {
          majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
          bucket_labels: {},
        },
        selectedMajors: new Set(["FIN_MAJOR"]),
        semesterCount: "1",
        maxRecs: "4",
        lastRecommendationData: {
          mode: "recommendations",
          semesters: [
            {
              target_semester: "Fall 2026",
              recommendations: [{ course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 }],
            },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick fall 2026/i }));
    await user.click(screen.getByRole("button", { name: /load candidate pool/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("candidate-pool")).toHaveTextContent("ACCO 1030,MATH 2100"));
  });

  test("next semester candidate pool adapts after applying edited swaps", async () => {
    postRecommendSpy
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Fall 2026",
            recommendations: [{ course_code: "MATH 2100", course_name: "Applied Calculus", credits: 3 }],
          },
          {
            target_semester: "Spring 2027",
            recommendations: [{ course_code: "FINA 3001", course_name: "Financial Management", credits: 3 }],
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Spring 2027",
            recommendations: [{ course_code: "FINA 3001", course_name: "Financial Management", credits: 3 }],
            eligible_swaps: [
              { course_code: "FINA 3001", course_name: "Financial Management", credits: 3 },
              { course_code: "MANA 3001", course_name: "Management", credits: 3 },
            ],
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
          { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
          { course_code: "MANA 3001", course_name: "Management", credits: 3, level: 3000 },
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

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick fall 2026/i }));
    await user.click(screen.getByRole("button", { name: /apply edited semester/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(1));
    const applyPayload = postRecommendSpy.mock.calls[0][0];
    expect(applyPayload.selected_courses).toEqual(["MATH 2100"]);
    expect(applyPayload.target_semester).toBe("Fall 2026");
    expect(applyPayload.target_semester_count).toBe(2);
    await waitFor(() => expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2026: MATH 2100"));
    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2027: FINA 3001");

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick spring 2027/i }));
    await user.click(screen.getByRole("button", { name: /load candidate pool/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(2));

    const nextSemesterPayload = postRecommendSpy.mock.calls[1][0];
    expect(nextSemesterPayload.target_semester).toBe("Spring 2027");
    expect(nextSemesterPayload.completed_courses).toContain("MATH 2100");
    expect(nextSemesterPayload.completed_courses).not.toContain("ACCO 1030");

    await waitFor(() => expect(screen.getByTestId("candidate-pool")).toHaveTextContent("FINA 3001,MANA 3001"));
  });

  test("preserves a future manual add when an earlier semester reruns", async () => {
    postRecommendSpy
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Spring 2028",
            recommendations: [
              { course_code: "BUAN 3065", course_name: "Predictive Analytics", credits: 3 },
            ],
            eligible_swaps: [
              { course_code: "BUAN 3065", course_name: "Predictive Analytics", credits: 3 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Spring 2028",
            recommendations: [
              { course_code: "BUAN 3065", course_name: "Predictive Analytics", credits: 3 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Fall 2027",
            eligible_swaps: [
              { course_code: "BULA 3001", course_name: "Business Law", credits: 3 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        mode: "recommendations",
        semesters: [
          {
            target_semester: "Fall 2027",
            recommendations: [
              { course_code: "BULA 3001", course_name: "Business Law", credits: 3 },
            ],
          },
          {
            target_semester: "Spring 2028",
            recommendations: [
              { course_code: "INSY 4054", course_name: "Emerging Technologies", credits: 3 },
            ],
          },
        ],
      });

    const user = userEvent.setup();

    renderWithApp(
      createElement(PlannerLayout),
      makeAppState({
        courses: [
          { course_code: "ENTP 3001", course_name: "Entrepreneurship", credits: 3, level: 3000 },
          { course_code: "INSY 4055", course_name: "Web Applications", credits: 3, level: 4000 },
          { course_code: "BULA 3001", course_name: "Business Law", credits: 3, level: 3000 },
          { course_code: "BUAN 3065", course_name: "Predictive Analytics", credits: 3, level: 3000 },
        ],
        programs: {
          majors: [{ id: "INSY_MAJOR", label: "Information Systems", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "INSY_MAJOR",
          bucket_labels: {},
        },
        selectedMajors: new Set(["INSY_MAJOR"]),
        semesterCount: "3",
        maxRecs: "4",
        lastRecommendationData: {
          mode: "recommendations",
          semesters: [
            {
              target_semester: "Spring 2027",
              recommendations: [{ course_code: "ENTP 3001", course_name: "Entrepreneurship", credits: 3 }],
            },
            {
              target_semester: "Fall 2027",
              recommendations: [{ course_code: "INSY 4055", course_name: "Web Applications", credits: 3 }],
            },
            {
              target_semester: "Spring 2028",
              recommendations: [
                { course_code: "BULA 3001", course_name: "Business Law", credits: 3 },
              ],
            },
          ],
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick spring 2028/i }));
    await user.click(screen.getByRole("button", { name: /load candidate pool/i }));
    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /apply edited semester/i }));
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2028: BUAN 3065");
    });
    const futureEditPayload = postRecommendSpy.mock.calls[1][0];
    expect(futureEditPayload.selected_courses).toEqual(["BUAN 3065"]);
    expect(futureEditPayload.target_semester).toBe("Spring 2028");
    expect(futureEditPayload.target_semester_count).toBe(1);

    await user.click(screen.getByRole("button", { name: /edit plan/i }));
    await user.click(screen.getByRole("button", { name: /pick fall 2027/i }));
    await user.click(screen.getByRole("button", { name: /load candidate pool/i }));
    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: /apply edited semester/i }));

    await waitFor(() => expect(postRecommendSpy).toHaveBeenCalledTimes(4));
    const rerunPayload = postRecommendSpy.mock.calls[3][0];
    expect(rerunPayload.selected_courses).toEqual(["BULA 3001"]);
    expect(rerunPayload.target_semester).toBe("Fall 2027");
    expect(rerunPayload.target_semester_count).toBe(2);
    await waitFor(() => {
      expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Fall 2027: BULA 3001");
    });
    expect(screen.getByTestId("recommendations-panel")).toHaveTextContent("Spring 2028: BUAN 3065");
    expect(screen.getByTestId("recommendations-panel")).not.toHaveTextContent("INSY 4054");
  });
});
