// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useAppContext } from "../src/context/AppContext";
import { useSession } from "../src/hooks/useSession";
import {
  SESSION_RECOMMENDATION_STORAGE_KEY,
  STORAGE_KEY,
} from "../src/lib/constants";
import type { RecommendationResponse } from "../src/lib/types";
import { makeAppState, renderWithApp } from "./testUtils";

function makeRecommendationData(): RecommendationResponse {
  return {
    mode: "recommendations",
    semesters: [
      {
        target_semester: "Fall 2026",
        standing_label: "Freshman",
        recommendations: [
          {
            course_code: "FINA 3001",
            course_name: "Introduction to Financial Management",
            credits: 3,
            why: "Keeps progress moving.",
          },
        ],
      },
    ],
    input_completed_courses: ["ACCO 1030"],
    input_in_progress_courses: [],
    current_completed_courses: ["ACCO 1030"],
    current_in_progress_courses: [],
    current_progress: {},
    current_assumption_notes: [],
    selection_context: {
      selected_program_ids: ["FIN_MAJOR"],
      selected_program_labels: ["Finance"],
    },
  };
}

function SessionHarness() {
  const { state, dispatch } = useAppContext();
  useSession();

  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        type: "button",
        onClick: () =>
          dispatch({
            type: "SET_RECOMMENDATIONS",
            payload: { data: makeRecommendationData(), count: 5 },
          }),
      },
      "Set recommendations",
    ),
    createElement(
      "button",
      {
        type: "button",
        onClick: () => dispatch({ type: "SET_TARGET_SEMESTER", payload: "Spring 2027" }),
      },
      "Change semester",
    ),
    createElement("div", { "data-testid": "target-semester" }, state.targetSemester),
    createElement(
      "div",
      { "data-testid": "recommendation-mode" },
      state.lastRecommendationData?.mode ?? "none",
    ),
    createElement(
      "div",
      { "data-testid": "requested-count" },
      String(state.lastRequestedCount),
    ),
  );
}

function renderSessionHarness() {
  return renderWithApp(
    createElement(SessionHarness),
    makeAppState({
      courses: [
        {
          course_code: "ACCO 1030",
          course_name: "Financial Accounting",
          credits: 3,
          level: 1000,
        },
      ],
      programs: {
        majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
        tracks: [],
        minors: [],
        default_track_id: "",
      },
    }),
  );
}

describe("useSession recommendation persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  test("stores recommendation payload separately from the lightweight session snapshot", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    renderSessionHarness();

    fireEvent.click(screen.getByRole("button", { name: "Set recommendations" }));
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const sessionSnapshot = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const recommendationSnapshot = JSON.parse(
      window.localStorage.getItem(SESSION_RECOMMENDATION_STORAGE_KEY) || "{}",
    );

    expect(sessionSnapshot.lastRecommendationData).toBeUndefined();
    expect(sessionSnapshot.lastRequestedCount).toBe(5);
    expect(recommendationSnapshot.lastRecommendationData?.mode).toBe("recommendations");

    fireEvent.click(screen.getByRole("button", { name: "Change semester" }));
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const recommendationWrites = setItemSpy.mock.calls.filter(
      ([key]) => key === SESSION_RECOMMENDATION_STORAGE_KEY,
    );

    expect(recommendationWrites).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}").targetSemester).toBe(
      "Spring 2027",
    );
  });

  test("restores recommendation payload from the dedicated storage key", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed: [],
        inProgress: [],
        targetSemester: "Spring 2027",
        semesterCount: "3",
        maxRecs: "5",
        includeSummer: false,
        isHonorsStudent: false,
        schedulingStyle: "grinder",
        studentStage: "undergrad",
        studentStageIsExplicit: false,
        canTake: "",
        declaredMajors: ["FIN_MAJOR"],
        declaredTracks: [],
        declaredMinors: [],
        discoveryTheme: "",
        activeNavTab: "plan",
        onboardingComplete: true,
        lastRequestedCount: 5,
      }),
    );
    window.localStorage.setItem(
      SESSION_RECOMMENDATION_STORAGE_KEY,
      JSON.stringify({ lastRecommendationData: makeRecommendationData() }),
    );

    renderSessionHarness();

    expect(screen.getByTestId("target-semester")).toHaveTextContent("Spring 2027");
    expect(screen.getByTestId("recommendation-mode")).toHaveTextContent("recommendations");
    expect(screen.getByTestId("requested-count")).toHaveTextContent("5");
  });
});
