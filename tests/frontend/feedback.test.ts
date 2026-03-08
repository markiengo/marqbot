import { describe, expect, test } from "vitest";

import { makeAppState } from "../../frontend/tests/testUtils";
import {
  buildFeedbackPayload,
  FEEDBACK_MAX_MESSAGE_LENGTH,
  getFeedbackMessageError,
  normalizeFeedbackMessage,
} from "../../frontend/src/lib/feedback";

describe("feedback helpers", () => {
  test("normalizes and validates feedback messages", () => {
    expect(normalizeFeedbackMessage("  planner bug  ")).toBe("planner bug");
    expect(getFeedbackMessageError("")).toContain("Tell me");
    expect(getFeedbackMessageError("too short")).toContain("at least 10");
    expect(getFeedbackMessageError("x".repeat(FEEDBACK_MAX_MESSAGE_LENGTH + 1))).toContain("under 2000");
    expect(getFeedbackMessageError("This warning copy felt a little confusing after I added a track.")).toBeNull();
  });

  test("builds a planner-scoped feedback payload with snapshot data", () => {
    const state = makeAppState({
      completed: new Set(["ECON 1001"]),
      inProgress: new Set(["ACCO 1001"]),
      selectedMajors: new Set(["FIN_MAJOR"]),
      selectedTracks: ["REAL_TRACK"],
      selectedMinors: new Set(["ENTR_MINOR"]),
      discoveryTheme: "REAL_TRACK",
      targetSemester: "Fall 2026",
      semesterCount: "3",
      maxRecs: "4",
      includeSummer: true,
      isHonorsStudent: true,
      activeNavTab: "plan",
      onboardingComplete: true,
      lastRequestedCount: 4,
      lastRecommendationData: {
        mode: "recommendations",
        semesters: [{ target_semester: "Fall 2026", recommendations: [{ course_code: "FINA 3001" }] }],
      },
    });

    const payload = buildFeedbackPayload(
      state,
      "/planner",
      5,
      "  The semester ordering looked right, but the warning text could be clearer.  ",
    );

    expect(payload).toEqual({
      rating: 5,
      message: "The semester ordering looked right, but the warning text could be clearer.",
      context: {
        source: "planner",
        route: "/planner",
        session_snapshot: {
          completed: ["ECON 1001"],
          in_progress: ["ACCO 1001"],
          declared_majors: ["FIN_MAJOR"],
          declared_tracks: ["REAL_TRACK"],
          declared_minors: ["ENTR_MINOR"],
          discovery_theme: "REAL_TRACK",
          target_semester: "Fall 2026",
          semester_count: "3",
          max_recs: "4",
          include_summer: true,
          is_honors_student: true,
          active_nav_tab: "plan",
          onboarding_complete: true,
          last_requested_count: 4,
        },
        recommendation_snapshot: state.lastRecommendationData,
      },
    });
  });
});
