// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PlannerLayout } from "../src/components/planner/PlannerLayout";
import { hashSavedPlanInputs } from "../src/lib/savedPlans";
import { makeAppState, renderWithApp } from "./testUtils";

const {
  createPlanSpy,
  updatePlanSpy,
  fetchRecommendationsSpy,
  savedPlansState,
  recommendationDataState,
} = vi.hoisted(() => ({
  createPlanSpy: vi.fn(),
  updatePlanSpy: vi.fn(),
  fetchRecommendationsSpy: vi.fn(),
  savedPlansState: {
    current: [
      {
        id: "plan-1",
        name: "Saved DS Draft",
        notes: "Existing saved notes",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
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
          schedulingStyle: "grinder",
          studentStage: "undergrad",
          studentStageIsExplicit: false,
        },
        recommendationData: { mode: "recommendations", semesters: [] },
        lastRequestedCount: 5,
        inputHash: "existing",
        resultsInputHash: "existing",
        lastGeneratedAt: "2026-04-02T10:00:00.000Z",
      },
    ],
  },
  recommendationDataState: {
    current: {
      mode: "recommendations" as const,
      current_progress: {},
      semesters: [
        {
          target_semester: "Fall 2026",
          recommendations: [
            { course_code: "COSC 1010", course_name: "Intro to Software Development", credits: 3 },
          ],
        },
      ],
    },
  },
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
}));

vi.mock("@/hooks/useRecommendations", () => ({
  useRecommendations: () => ({
    data: recommendationDataState.current,
    requestedCount: 6,
    loading: false,
    error: null,
    fetchRecommendations: fetchRecommendationsSpy,
    runRecommendationRequest: vi.fn(),
    applyRecommendationData: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSavedPlans", () => ({
  useSavedPlans: () => ({
    hydrated: true,
    plans: savedPlansState.current,
    createPlan: createPlanSpy,
    updatePlan: updatePlanSpy,
  }),
}));

vi.mock("@/lib/api", () => ({
  postRecommend: vi.fn(),
  postReplan: vi.fn(),
  loadProgramBuckets: vi.fn(async () => []),
}));

vi.mock("../src/components/planner/ProgressDashboard", () => ({
  ProgressDashboard: () => createElement("div", null, "Progress"),
  useProgressMetrics: () => ({}),
}));

vi.mock("../src/components/planner/ProgressModal", () => ({
  ProgressModal: () => null,
}));

vi.mock("../src/components/planner/SemesterModal", () => ({
  SemesterModal: () => null,
}));

vi.mock("../src/components/planner/EditPlanModal", () => ({
  EditPlanModal: () => null,
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
  SavePlanModal: ({ open, onSave, error, existingPlans }: any) => {
    if (!open) return null;
    return createElement(
      "div",
      { "data-testid": "save-plan-modal" },
      createElement("div", { "data-testid": "overwrite-option-count" }, String(existingPlans?.length ?? 0)),
      error ? createElement("div", null, error) : null,
      createElement(
        "button",
        {
          onClick: () => onSave({
            mode: "create",
            targetPlanId: null,
            name: "New Browser Save",
            notes: "Create notes",
          }),
        },
        "Submit Create",
      ),
      createElement(
        "button",
        {
          onClick: () => onSave({
            mode: "overwrite",
            targetPlanId: existingPlans?.[0]?.id ?? null,
            name: "Overwritten Browser Save",
            notes: "Overwrite notes",
          }),
        },
        "Submit Overwrite",
      ),
    );
  },
}));

function makePlannerState() {
  return makeAppState({
    onboardingComplete: true,
    courses: [
      { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
      { course_code: "COSC 1010", course_name: "Intro to Software Development", credits: 3, level: 1000 },
    ],
    programs: {
      majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
      tracks: [],
      minors: [],
      default_track_id: "FIN_MAJOR",
      bucket_labels: {},
    },
    selectedMajors: new Set(["FIN_MAJOR"]),
    maxRecs: "6",
    targetSemester: "Fall 2026",
  });
}

describe("PlannerLayout save-plan routing", () => {
  beforeEach(() => {
    createPlanSpy.mockReset();
    updatePlanSpy.mockReset();
    fetchRecommendationsSpy.mockReset();
    recommendationDataState.current = {
      mode: "recommendations",
      current_progress: {},
      semesters: [
        {
          target_semester: "Fall 2026",
          recommendations: [
            { course_code: "COSC 1010", course_name: "Intro to Software Development", credits: 3 },
          ],
        },
      ],
    };
    savedPlansState.current = [
      {
        id: "plan-1",
        name: "Saved DS Draft",
        notes: "Existing saved notes",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
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
          schedulingStyle: "grinder",
          studentStage: "undergrad",
          studentStageIsExplicit: false,
        },
        recommendationData: { mode: "recommendations", semesters: [] },
        lastRequestedCount: 5,
        inputHash: "existing",
        resultsInputHash: "existing",
        lastGeneratedAt: "2026-04-02T10:00:00.000Z",
      },
    ];
  });

  test("save as new still calls createPlan", async () => {
    const user = userEvent.setup();
    createPlanSpy.mockReturnValue({
      ok: true,
      plans: savedPlansState.current,
      plan: { name: "New Browser Save" },
    });

    renderWithApp(createElement(PlannerLayout), makePlannerState());

    await user.click(screen.getByRole("button", { name: /save plan/i }));
    expect(screen.getByTestId("overwrite-option-count")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: /submit create/i }));

    await waitFor(() => expect(createPlanSpy).toHaveBeenCalledTimes(1));
    expect(updatePlanSpy).not.toHaveBeenCalled();
    expect(createPlanSpy.mock.calls[0][0]).toMatchObject({
      name: "New Browser Save",
      notes: "Create notes",
      lastRequestedCount: 6,
    });
    const createdSnapshot = createPlanSpy.mock.calls[0][0]?.recommendationData;
    expect(createdSnapshot?.mode).toBe("recommendations");
    expect(createdSnapshot?.semesters?.[0]?.recommendations?.[0]?.course_code).toBe("COSC 1010");
    expect(screen.getByText(/saved .+new browser save.+ in this browser/i)).toBeInTheDocument();
  });

  test("overwrite uses updatePlan with the current planner snapshot", async () => {
    const user = userEvent.setup();
    const state = makePlannerState();
    updatePlanSpy.mockReturnValue({
      ok: true,
      plans: savedPlansState.current,
      plan: { name: "Overwritten Browser Save" },
    });

    renderWithApp(createElement(PlannerLayout), state);

    await user.click(screen.getByRole("button", { name: /save plan/i }));
    await user.click(screen.getByRole("button", { name: /submit overwrite/i }));

    const expectedInputs = {
      completed: [],
      inProgress: [],
      declaredMajors: ["FIN_MAJOR"],
      declaredTracks: [],
      declaredMinors: [],
      discoveryTheme: "",
      targetSemester: "Fall 2026",
      semesterCount: "3",
      maxRecs: "6",
      includeSummer: false,
      schedulingStyle: "grinder",
      studentStage: "undergrad",
      studentStageIsExplicit: false,
    };

    await waitFor(() => expect(updatePlanSpy).toHaveBeenCalledTimes(1));
    expect(createPlanSpy).not.toHaveBeenCalled();
    expect(updatePlanSpy.mock.calls[0]?.[0]).toBe("plan-1");
    expect(updatePlanSpy.mock.calls[0]?.[1]).toMatchObject({
      name: "Overwritten Browser Save",
      notes: "Overwrite notes",
      inputs: expectedInputs,
      lastRequestedCount: 6,
      resultsInputHash: hashSavedPlanInputs(expectedInputs),
    });
    expect(updatePlanSpy.mock.calls[0]?.[1]?.lastGeneratedAt).toEqual(expect.any(String));
    expect(updatePlanSpy.mock.calls[0]?.[1]?.recommendationData?.mode).toBe("recommendations");
    expect(updatePlanSpy.mock.calls[0]?.[1]?.recommendationData?.semesters?.[0]?.recommendations?.[0]?.course_code).toBe("COSC 1010");
    expect(screen.getByText(/updated .+overwritten browser save.+ in this browser/i)).toBeInTheDocument();
  });

  test("overwrite saves the normalized visible plan instead of stale raw bucket fills", async () => {
    const user = userEvent.setup();
    recommendationDataState.current = {
      mode: "recommendations",
      current_progress: {
        MCC_WRIT: {
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
              course_code: "ENGL 3250",
              course_name: "Professional Writing",
              credits: 3,
              is_manual_add: true,
              fills_buckets: ["MCC_WRIT"],
            },
          ],
        },
        {
          target_semester: "Spring 2027",
          recommendations: [
            {
              course_code: "MANA 3002",
              course_name: "Business and Its Environment",
              credits: 3,
              fills_buckets: ["MCC_WRIT"],
            },
          ],
        },
      ],
    };
    updatePlanSpy.mockReturnValue({
      ok: true,
      plans: savedPlansState.current,
      plan: { name: "Overwritten Browser Save" },
    });

    renderWithApp(createElement(PlannerLayout), makePlannerState());

    await user.click(screen.getByRole("button", { name: /save plan/i }));
    await user.click(screen.getByRole("button", { name: /submit overwrite/i }));

    await waitFor(() => expect(updatePlanSpy).toHaveBeenCalledTimes(1));
    const savedSnapshot = updatePlanSpy.mock.calls[0][1]?.recommendationData;
    expect(savedSnapshot?.semesters?.[0]?.recommendations?.[0]?.fills_buckets).toEqual(["MCC_WRIT"]);
    expect(savedSnapshot?.semesters?.[1]?.recommendations?.[0]?.fills_buckets).toEqual([]);
    expect(savedSnapshot?.semesters?.[1]?.projected_progress?.MCC_WRIT?.in_progress_applied).toEqual(["ENGL 3250"]);
  });

  test("full saved-plan library still allows overwrite", async () => {
    const user = userEvent.setup();
    createPlanSpy.mockReturnValue({
      ok: false,
      plans: savedPlansState.current,
      error: "You can save up to 25 plans. Delete an older plan first.",
    });
    updatePlanSpy.mockReturnValue({
      ok: true,
      plans: savedPlansState.current,
      plan: { name: "Overwritten Browser Save" },
    });

    renderWithApp(createElement(PlannerLayout), makePlannerState());

    await user.click(screen.getByRole("button", { name: /save plan/i }));
    await user.click(screen.getByRole("button", { name: /submit create/i }));

    expect(await screen.findByText(/you can save up to 25 plans/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /submit overwrite/i }));

    await waitFor(() => expect(updatePlanSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/updated .+overwritten browser save.+ in this browser/i)).toBeInTheDocument();
  });
});
