import { describe, expect, test } from "vitest";

import { getPlanLevelProgress } from "../src/lib/progressSources";
import type { RecommendationResponse } from "../src/lib/types";

function makeResponse(overrides: Partial<RecommendationResponse> = {}): RecommendationResponse {
  return {
    mode: "recommendations",
    current_progress: {
      MCC_CORE: {
        label: "MCC Core",
        needed: 4,
        needed_count: 4,
        completed_applied: ["THEO 1001", "PHIL 1001"],
        in_progress_applied: [],
        completed_done: 2,
        in_progress_increment: 0,
        completed_courses: 2,
        in_progress_courses: 0,
        requirement_mode: "required",
        satisfied: false,
      },
    },
    semesters: [],
    ...overrides,
  };
}

describe("getPlanLevelProgress", () => {
  test("rebuilds projected progress from the current visible plan even when backend projection exists", () => {
    const response = makeResponse({
      semesters: [
        {
          target_semester: "Fall 2028",
          recommendations: [
            { course_code: "CORE 1929", course_name: "Foundations In Methods Of Inquiry", credits: 3, fills_buckets: ["MCC_CORE"] },
          ],
          projected_progress: {
            MCC_CORE: {
              label: "MCC Core",
              needed: 4,
              needed_count: 4,
              completed_applied: ["THEO 1001", "PHIL 1001"],
              in_progress_applied: ["CORE 1929"],
              completed_done: 2,
              in_progress_increment: 1,
              completed_courses: 2,
              in_progress_courses: 1,
              requirement_mode: "required",
              satisfied: false,
            },
          },
        },
        {
          target_semester: "Spring 2029",
          recommendations: [
            { course_code: "ENGL 3250", course_name: "Professional Writing", credits: 3, fills_buckets: ["MCC_CORE"] },
          ],
          projected_progress: {
            MCC_CORE: {
              label: "MCC Core",
              needed: 4,
              needed_count: 4,
              completed_applied: ["THEO 1001", "PHIL 1001"],
              in_progress_applied: ["CORE 1929"],
              completed_done: 2,
              in_progress_increment: 1,
              completed_courses: 2,
              in_progress_courses: 1,
              requirement_mode: "required",
              satisfied: false,
            },
          },
        },
      ],
    });

    const progress = getPlanLevelProgress(response);
    expect(progress?.MCC_CORE.in_progress_applied).toEqual(["CORE 1929", "ENGL 3250"]);
    expect(progress?.MCC_CORE.in_progress_courses).toBe(2);
    expect(progress?.MCC_CORE.satisfied).toBe(true);
  });

  test("falls back to deriving projected progress from planned semesters when later edits removed backend projection", () => {
    const response = makeResponse({
      semesters: [
        {
          target_semester: "Fall 2028",
          recommendations: [
            { course_code: "CORE 1929", course_name: "Foundations In Methods Of Inquiry", credits: 3, fills_buckets: ["MCC_CORE"] },
          ],
          projected_progress: undefined,
        },
        {
          target_semester: "Spring 2029",
          recommendations: [
            { course_code: "CORE 1929", course_name: "Foundations In Methods Of Inquiry", credits: 3, fills_buckets: ["MCC_CORE"] },
            { course_code: "ENGL 3250", course_name: "Professional Writing", credits: 3, fills_buckets: ["MCC_CORE"] },
          ],
          projected_progress: undefined,
        },
      ],
    });

    const progress = getPlanLevelProgress(response);
    expect(progress?.MCC_CORE.completed_courses).toBe(2);
    expect(progress?.MCC_CORE.in_progress_courses).toBe(2);
    expect(progress?.MCC_CORE.in_progress_applied).toEqual(["CORE 1929", "ENGL 3250"]);
    expect(progress?.MCC_CORE.satisfied).toBe(true);
  });
});
