// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { SavedPlanPrintView } from "../src/components/saved/SavedPlanPrintView";
import { makeAppState, renderWithApp } from "./testUtils";

const { planState, printSpy } = vi.hoisted(() => ({
  planState: { current: null as any },
  printSpy: vi.fn(),
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
      current_progress: {
        "FIN_MAJOR::CORE": {
          needed: 2,
          completed_applied: ["ACCO 1030"],
          in_progress_applied: [],
          satisfied: false,
          label: "Finance Core",
        },
      },
      semesters: [
        {
          target_semester: "Fall 2026",
          standing_label: "Sophomore",
          recommendations: [
            {
              course_code: "BUAN 3065",
              course_name: "Unlocking Business Insights through Predictive Analytics",
              credits: 3,
              fills_buckets: ["BCC::BCC_ANALYTICS", "MCC::MCC_WRIT"],
            },
          ],
        },
        {
          target_semester: "Spring 2027",
          standing_label: "Sophomore",
          recommendations: [],
        },
      ],
    } : null,
    lastRequestedCount: 5,
    inputHash: "abc",
    resultsInputHash: "abc",
    lastGeneratedAt: "2026-03-02T10:00:00.000Z",
  };
}

vi.mock("@/hooks/useCourses", () => ({
  useCourses: () => ({
    courses: [
      { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000, catalog_prereq_raw: "none" },
      { course_code: "BUAN 3065", course_name: "Unlocking Business Insights through Predictive Analytics", credits: 3, level: 3000, catalog_prereq_raw: "none" },
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
      bucket_labels: {
        BCC_ANALYTICS: "Business Core Courses: BCC Analytics",
        MCC_WRIT: "MCC: Writing Intensive: MCC Writing Intensive",
      },
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
  }),
}));

describe("SavedPlanPrintView", () => {
  beforeEach(() => {
    planState.current = makePlan(true);
    printSpy.mockReset();
    Object.defineProperty(window, "print", {
      configurable: true,
      writable: true,
      value: printSpy,
    });
  });

  test("renders the trimmed print export view and auto-triggers print", async () => {
    renderWithApp(createElement(SavedPlanPrintView, { planId: "plan-1" }), makeAppState());

    expect(screen.getByTestId("saved-plan-print-view")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /finance sprint/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /semester plan/i })).toBeInTheDocument();
    expect(screen.getByText(/credits/i)).toBeInTheDocument();
    expect(screen.getByText(/prereq/i)).toBeInTheDocument();
    expect(screen.getByText(/satisfy/i)).toBeInTheDocument();
    expect(screen.getByText(/unlocking business insights through predictive analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/business core - analytics,\s*marquette core - writ/i)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/^none$/i, { selector: "td" })).toBeInTheDocument();
    expect(screen.queryByText(/spring 2027/i)).not.toBeInTheDocument();

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
  });

  test("shows a fallback when the saved plan has no snapshot", async () => {
    planState.current = makePlan(false);

    renderWithApp(createElement(SavedPlanPrintView, { planId: "plan-1" }), makeAppState());

    expect(screen.getByText(/pdf export requires a saved recommendation snapshot/i)).toBeInTheDocument();
    await waitFor(() => expect(printSpy).not.toHaveBeenCalled());
  });
});
