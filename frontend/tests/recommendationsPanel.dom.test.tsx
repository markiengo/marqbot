// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { RecommendationsPanel } from "../src/components/planner/RecommendationsPanel";
import type { RecommendationResponse } from "../src/lib/types";

function makeRecommendationData(): RecommendationResponse {
  return {
    mode: "recommendations",
    semesters: [
      {
        target_semester: "Fall 2026",
        recommendations: [
          {
            course_code: "ACCO 1030",
            course_name: "Financial Accounting",
            credits: 3,
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
          },
        ],
      },
    ],
  };
}

describe("RecommendationsPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.effectsMode;
  });

  test("renders the active semester and lets the user switch terms", async () => {
    render(
      createElement(RecommendationsPanel, {
        data: makeRecommendationData(),
        onExpandSemester: () => {},
      }),
    );

    expect(screen.getByTestId("recommendations-panel")).toHaveAttribute("data-reduced-motion", "false");
    expect(screen.getByText(/semester 1 - fall 2026/i)).toBeInTheDocument();
    expect(screen.getByText("ACCO 1030")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /semester 2/i }));

    expect(screen.getByText(/semester 2 - spring 2027/i)).toBeInTheDocument();
    expect(await screen.findByText("FINA 3001")).toBeInTheDocument();
  });

  test("keeps recommendation content visible in reduced-effects mode", () => {
    document.documentElement.dataset.effectsMode = "reduced";

    render(
      createElement(RecommendationsPanel, {
        data: makeRecommendationData(),
        onExpandSemester: () => {},
      }),
    );

    expect(screen.getByTestId("recommendations-panel")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByText(/semester 1 - fall 2026/i)).toBeInTheDocument();
    expect(screen.getByText("ACCO 1030")).toBeInTheDocument();
  });
});
