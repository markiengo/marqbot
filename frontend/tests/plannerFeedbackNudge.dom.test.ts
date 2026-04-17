// @vitest-environment jsdom

import "./setupTests";

import { createElement, type ReactNode } from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PlannerLayout } from "../src/components/planner/PlannerLayout";
import { makeAppState, renderWithApp } from "./testUtils";

const { postFeedbackSpy, recommendationData } = vi.hoisted(() => ({
  postFeedbackSpy: vi.fn(),
  recommendationData: {
    mode: "recommendations" as const,
    current_progress: {},
    selection_context: {
      selected_program_ids: ["FIN_MAJOR"],
      selected_program_labels: ["Finance"],
    },
    semesters: [
      {
        target_semester: "Fall 2026",
        standing_label: "Sophomore",
        recommendations: [
          {
            course_code: "ACCO 1030",
            course_name: "Financial Accounting",
            credits: 3,
          },
        ],
      },
    ],
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/planner",
}));

vi.mock("@/hooks/useRecommendations", () => ({
  useRecommendations: () => ({
    data: recommendationData,
    requestedCount: 3,
    loading: false,
    error: null,
    fetchRecommendations: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSavedPlans", () => ({
  useSavedPlans: () => ({
    hydrated: true,
    createPlan: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCanTake", () => ({
  isCanTakeResultForQuery: () => false,
  useCanTake: () => ({
    data: null,
    loading: false,
    error: null,
    checkCanTake: vi.fn().mockResolvedValue(null),
    clearCanTake: vi.fn(),
  }),
}));

vi.mock("../src/components/planner/ProgressDashboard", () => ({
  ProgressDashboard: () => createElement("div", null, "Progress Dashboard"),
  useProgressMetrics: () => ({
    minGradCredits: 124,
    completedCredits: 12,
    inProgressCredits: 3,
    remainingCredits: 109,
    standingLabel: "Sophomore",
    donePercent: 10,
    inProgressPercent: 2,
    overallPercent: 12,
  }),
}));

vi.mock("../src/components/planner/RecommendationsPanel", () => ({
  RecommendationsPanel: () => createElement("div", null, "Recommendations"),
}));

vi.mock("../src/components/planner/ProgressModal", () => ({
  ProgressModal: () => null,
}));

vi.mock("../src/components/planner/SemesterModal", () => ({
  SemesterModal: () => null,
}));

vi.mock("../src/components/planner/ProfileModal", () => ({
  ProfileModal: () => null,
}));

vi.mock("../src/components/planner/CourseListModal", () => ({
  CourseListModal: () => null,
}));

vi.mock("../src/components/planner/MajorGuideModal", () => ({
  MajorGuideModal: () => null,
  rankingExplainerItems: [],
  tierLadder: [],
}));

vi.mock("@/components/saved/SavePlanModal", () => ({
  SavePlanModal: () => null,
}));

vi.mock("@/components/shared/CourseDetailModal", () => ({
  CourseDetailModal: () => null,
}));

vi.mock("@/components/shared/Modal", () => ({
  Modal: ({
    open,
    onClose,
    title,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
  }) =>
    open
      ? createElement(
          "div",
          { role: "dialog", "aria-modal": "true" },
          title ? createElement("h3", null, title) : null,
          createElement(
            "button",
            { type: "button", onClick: onClose, "aria-label": "Close dialog" },
            "Close dialog",
          ),
          children,
        )
      : null,
}));

vi.mock("@/lib/api", () => ({
  postFeedback: postFeedbackSpy,
  postRecommend: vi.fn().mockResolvedValue(recommendationData),
  postReplan: vi.fn(),
  loadProgramBuckets: vi.fn().mockResolvedValue([]),
}));

function renderPlanner() {
  return renderWithApp(
    createElement(PlannerLayout),
    makeAppState({
      courses: [
        { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
        { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
      ],
      selectedMajors: new Set(["FIN_MAJOR"]),
      programs: {
        majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
        tracks: [],
        minors: [],
        default_track_id: "FIN_MAJOR",
        bucket_labels: {},
      },
      onboardingComplete: true,
      lastRecommendationData: recommendationData,
    }),
  );
}

describe("Planner feedback entry point", () => {
  beforeEach(() => {
    postFeedbackSpy.mockReset();
    postFeedbackSpy.mockResolvedValue({
      ok: true,
      feedback_id: "fb_123",
      submitted_at: "2026-03-09T12:00:05.000Z",
    });
  });

  test("moves feedback into the ranking header and removes the old left-panel CTA", () => {
    renderPlanner();

    expect(screen.getByRole("button", { name: /how ranking works/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^feedback$/i })).toBeInTheDocument();
    expect(screen.queryByText(/have feedback on this plan/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /contact me/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^feedback$/i }));
    expect(screen.getByRole("heading", { name: /send feedback/i })).toBeInTheDocument();
  });

  test("submits feedback from the new header button and shows success state", async () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /^feedback$/i }));
    fireEvent.click(screen.getByRole("button", { name: /rate marqbot 4 out of 5/i }));
    fireEvent.change(screen.getByLabelText(/what happened/i), {
      target: {
        value: "The majors, tracks, and minors split is much clearer now.",
      },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send feedback$/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postFeedbackSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/feedback sent\./i)).toBeInTheDocument();
  });
});
