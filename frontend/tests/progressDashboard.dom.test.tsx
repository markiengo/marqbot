// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ProgressDashboard } from "../src/components/planner/ProgressDashboard";
import { makeAppState, renderWithApp } from "./testUtils";

function motionTag(tag: "div" | "button") {
  return ({ children, ...props }: Record<string, unknown>) => {
    const {
      initial,
      animate,
      exit,
      transition,
      whileHover,
      whileTap,
      layout,
      ...domProps
    } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void whileHover;
    void whileTap;
    void layout;
    return createElement(tag, domProps, children);
  };
}

vi.mock("motion/react", () => ({
  motion: {
    div: motionTag("div"),
    button: motionTag("button"),
  },
}));

vi.mock("../src/components/planner/ProgressRing", () => ({
  ProgressRing: () => createElement("div", { "data-testid": "progress-ring" }),
}));

vi.mock("../src/components/shared/AnimatedNumber", () => ({
  AnimatedNumber: ({ value }: { value: number }) => createElement("span", null, String(value)),
}));

vi.mock("../src/components/shared/Modal", () => ({
  Modal: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (open ? createElement("div", null, title ? createElement("div", null, title) : null, children) : null),
}));

describe("ProgressDashboard", () => {
  test("renders the simplified 2x2 KPI dashboard", () => {
    renderWithApp(
      createElement(ProgressDashboard),
      makeAppState({
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
          { course_code: "MATH 1200", course_name: "Applied Calculus", credits: 3, level: 1000 },
        ],
        lastRecommendationData: {
          mode: "recommendations",
          selection_context: {
            selected_program_ids: ["FIN_MAJOR"],
            selected_program_labels: ["Finance"],
          },
          current_progress: {
            "MCC::MCC_FOUNDATION": { needed: 1, satisfied: false },
            "BCC::BCC_REQUIRED": { needed: 1, satisfied: false },
            "FIN_MAJOR::CORE": { needed: 1, satisfied: false },
          },
          semesters: [
            {
              target_semester: "Fall 2026",
              recommendations: [
                {
                  course_code: "ACCO 1030",
                  fills_buckets: ["MCC::MCC_FOUNDATION", "BCC::BCC_REQUIRED"],
                },
                {
                  course_code: "MATH 1200",
                  fills_buckets: ["MCC::MCC_FOUNDATION"],
                },
              ],
            },
          ],
        },
      }),
    );

    expect(screen.getByText(/credits completed/i)).toBeInTheDocument();
    expect(screen.getByText(/credits in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/^standing$/i)).toBeInTheDocument();
    expect(screen.getByText(/credits remaining/i)).toBeInTheDocument();
    expect(screen.queryByTestId("planner-focus")).not.toBeInTheDocument();
  });

  test("opens the standing scale modal", () => {
    renderWithApp(createElement(ProgressDashboard), makeAppState());

    fireEvent.click(screen.getByRole("button", { name: /view standing scale/i }));

    expect(screen.getByText(/standing by credits/i)).toBeInTheDocument();
    expect(screen.getByText(/based on completed credits/i)).toBeInTheDocument();
    expect(screen.getByText(/0-23 credits/i)).toBeInTheDocument();
    expect(screen.getByText(/24-59 credits/i)).toBeInTheDocument();
    expect(screen.getByText(/60-89 credits/i)).toBeInTheDocument();
    expect(screen.getByText(/90\+ credits/i)).toBeInTheDocument();
  });
});
