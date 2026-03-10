// @vitest-environment jsdom

import "./setupTests";

import { createElement, type ReactNode } from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { PlannerLayout } from "../src/components/planner/PlannerLayout";
import { PLANNER_FEEDBACK_NUDGE_STORAGE_KEY } from "../src/lib/constants";
import { makeAppState, renderWithApp } from "./testUtils";

const {
  createPlanSpy,
  fetchRecommendationsSpy,
  postFeedbackSpy,
  recommendationData,
} = vi.hoisted(() => ({
  createPlanSpy: vi.fn(),
  fetchRecommendationsSpy: vi.fn(),
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
    fetchRecommendations: fetchRecommendationsSpy,
  }),
}));

vi.mock("@/hooks/useSavedPlans", () => ({
  useSavedPlans: () => ({
    hydrated: true,
    createPlan: createPlanSpy,
  }),
}));

vi.mock("@/hooks/useCanTake", () => ({
  isCanTakeResultForQuery: (query: string, data: { requested_course?: string } | null) =>
    query.trim().toUpperCase() !== "" &&
    query.trim().toUpperCase() === String(data?.requested_course || "").trim().toUpperCase(),
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

describe("Planner feedback nudge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
    window.localStorage.clear();
    fetchRecommendationsSpy.mockReset();
    createPlanSpy.mockReset();
    postFeedbackSpy.mockReset();
    postFeedbackSpy.mockResolvedValue({
      ok: true,
      feedback_id: "fb_123",
      submitted_at: "2026-03-09T12:00:05.000Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("removes the header feedback button and opens the modal from the feedback lane", async () => {
    renderPlanner();

    expect(screen.queryByRole("button", { name: /^feedback$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact markie/i })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("button", { name: /feedback form/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /feedback form/i }));

    expect(screen.getByRole("heading", { name: /send feedback/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("heading", { name: /send feedback/i })).not.toBeInTheDocument();
  });

  test("expands after idle timing, opens from the pill, and dismissal blocks future nudges", async () => {
    renderPlanner();

    act(() => {
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.getByRole("button", { name: /feedback form/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss feedback nudge/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /feedback form/i }));

    expect(screen.getByRole("heading", { name: /send feedback/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("heading", { name: /send feedback/i })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(180_000);
    });

    expect(screen.getByRole("button", { name: /feedback form/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dismiss feedback nudge/i }));

    const stored = JSON.parse(window.localStorage.getItem(PLANNER_FEEDBACK_NUDGE_STORAGE_KEY) || "{}");
    expect(stored.dismissedUntil).toBeGreaterThan(Date.now());

    act(() => {
      vi.advanceTimersByTime(180_000);
    });

    expect(screen.getByRole("button", { name: /feedback form/i })).toBeInTheDocument();
  });

  test("successful submit suppresses later auto-nudges", async () => {
    renderPlanner();

    fireEvent.click(screen.getByRole("button", { name: /feedback form/i }));
    fireEvent.click(screen.getByRole("button", { name: /rate marqbot 4 out of 5/i }));
    fireEvent.change(screen.getByLabelText(/what should i know/i), {
      target: {
        value: "The planner warning copy was confusing after I added my finance major.",
      },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^send feedback$/i }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postFeedbackSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/feedback sent\./i)).toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(PLANNER_FEEDBACK_NUDGE_STORAGE_KEY) || "{}");
    expect(stored.submittedUntil).toBeGreaterThan(Date.now());

    act(() => {
      vi.advanceTimersByTime(240_000);
    });

    expect(screen.queryByRole("button", { name: /dismiss feedback nudge/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /feedback form/i })).toBeInTheDocument();
  });
});
