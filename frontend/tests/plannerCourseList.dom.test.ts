// @vitest-environment jsdom

import "./setupTests";

import { createElement, type ReactNode } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PlannerLayout } from "../src/components/planner/PlannerLayout";
import type { RecommendationResponse } from "../src/lib/types";
import { makeAppState, renderWithApp } from "./testUtils";

const { recommendationState } = vi.hoisted(() => ({
  recommendationState: {
    data: null as RecommendationResponse | null,
  },
}));

vi.mock("@/hooks/useRecommendations", () => ({
  useRecommendations: () => ({
    data: recommendationState.data,
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

vi.mock("../src/components/planner/ProgressDashboard", () => ({
  ProgressDashboard: ({
    onCompletedClick,
    onInProgressClick,
  }: {
    onCompletedClick?: () => void;
    onInProgressClick?: () => void;
  }) =>
    createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: onCompletedClick }, "Open completed"),
      createElement("button", { type: "button", onClick: onInProgressClick }, "Open in progress"),
    ),
  useProgressMetrics: () => ({
    minGradCredits: 124,
    completedCredits: 6,
    inProgressCredits: 0,
    remainingCredits: 118,
    standingLabel: "Freshman",
    donePercent: 4,
    inProgressPercent: 0,
    overallPercent: 4,
  }),
}));

vi.mock("../src/components/planner/CanTakeSection", () => ({
  CanTakeSection: () => null,
}));

vi.mock("../src/components/planner/RecommendationsPanel", () => ({
  RecommendationsPanel: () => null,
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

vi.mock("@/components/saved/SavePlanModal", () => ({
  SavePlanModal: () => null,
}));

vi.mock("@/components/shared/CourseDetailModal", () => ({
  CourseDetailModal: () => null,
}));

vi.mock("../src/components/planner/FeedbackModal", () => ({
  FeedbackModal: () => null,
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

function makeRecommendationData(overrides: Partial<RecommendationResponse> = {}): RecommendationResponse {
  return {
    mode: "recommendations",
    semesters: [
      {
        target_semester: "Fall 2026",
        standing_label: "Freshman",
        recommendations: [],
      },
    ],
    input_completed_courses: ["FINA 3001"],
    input_in_progress_courses: [],
    current_completed_courses: ["FINA 3001", "ACCO 1030"],
    current_in_progress_courses: [],
    current_progress: {},
    current_assumption_notes: [
      "Assumed ACCO 1030 because FINA 3001 is completed.",
      "Inference scope: required chains only (single/and). OR and concurrent-optional prereqs are not auto-assumed.",
    ],
    selection_context: {
      selected_program_ids: ["FIN_MAJOR"],
      selected_program_labels: ["Finance"],
    },
    ...overrides,
  };
}

function renderPlanner() {
  return renderWithApp(
    createElement(PlannerLayout),
    makeAppState({
      courses: [
        { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
        { course_code: "FINA 3001", course_name: "Introduction to Financial Management", credits: 3, level: 3000 },
      ],
      completed: new Set(["FINA 3001"]),
      selectedMajors: new Set(["FIN_MAJOR"]),
      programs: {
        majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
        tracks: [],
        minors: [],
        default_track_id: "FIN_MAJOR",
        bucket_labels: {},
      },
      onboardingComplete: false,
      lastRecommendationData: null,
    }),
  );
}

describe("Planner completed course modal", () => {
  beforeEach(() => {
    recommendationState.data = makeRecommendationData();
  });

  test("shows assumed completed courses and their explanation when recommendation inputs are current", () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /open completed/i }));

    expect(screen.getByRole("heading", { name: /credits completed \(2\)/i })).toBeInTheDocument();
    expect(screen.getByText("Assumptions Applied")).toBeInTheDocument();
    expect(
      screen.getByText("Assumed ACCO 1030 because FINA 3001 is completed."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Inference scope: required chains only \(single\/and\)\./i),
    ).toBeInTheDocument();
    expect(screen.getByText("ACCO 1030")).toBeInTheDocument();
    expect(screen.getByText("FINA 3001")).toBeInTheDocument();
  });

  test("falls back to raw completed courses when the recommendation snapshot is stale", () => {
    recommendationState.data = makeRecommendationData({
      input_completed_courses: ["ACCO 1030"],
      current_completed_courses: ["FINA 3001", "ACCO 1030"],
    });

    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /open completed/i }));

    expect(screen.getByRole("heading", { name: /credits completed \(1\)/i })).toBeInTheDocument();
    expect(screen.queryByText("Assumptions Applied")).not.toBeInTheDocument();
    expect(screen.getByText("FINA 3001")).toBeInTheDocument();
    expect(screen.queryByText("ACCO 1030")).not.toBeInTheDocument();
  });
});
