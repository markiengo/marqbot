import { describe, expect, test } from "vitest";

import { getPlanLevelProgress, normalizeVisibleRecommendationData } from "../src/lib/progressSources";
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

  test("rebuilds projected buckets from scratch so stale planned courses do not linger after swaps", () => {
    const response = {
      mode: "recommendations" as const,
      current_progress: {
        MCC_WRIT: {
          label: "MCC Writing Intensive",
          needed: 1,
          needed_count: 1,
          completed_applied: [],
          in_progress_applied: ["MANA 3002"],
          completed_done: 0,
          in_progress_increment: 1,
          completed_courses: 0,
          in_progress_courses: 1,
          requirement_mode: "required",
          satisfied: true,
        },
        MCC_ESSV2: {
          label: "MCC Engaging Social Systems & Values 2",
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
        MCC_DISC_CMI_HUM: {
          label: "Cognition Memory & Intelligence: Discovery Humanities",
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
          target_semester: "Fall 2028",
          recommendations: [
            {
              course_code: "ENGL 3250",
              course_name: "Life-Writing, Creativity and Community",
              credits: 3,
              fills_buckets: ["MCC_DISC_CMI_HUM", "MCC_ESSV2", "MCC_WRIT"],
            },
          ],
        },
        {
          target_semester: "Spring 2029",
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
    } satisfies RecommendationResponse;

    const progress = getPlanLevelProgress(response);

    expect(progress?.MCC_WRIT.in_progress_applied).toEqual(["ENGL 3250"]);
    expect(progress?.MCC_WRIT.in_progress_courses).toBe(1);
    expect(progress?.MCC_ESSV2.in_progress_applied).toEqual(["ENGL 3250"]);
    expect(progress?.MCC_ESSV2.satisfied).toBe(true);
    expect(progress?.MCC_DISC_CMI_HUM.in_progress_applied).toEqual(["ENGL 3250"]);
    expect(progress?.MCC_DISC_CMI_HUM.satisfied).toBe(true);
  });

  test("reassigns visible course bucket tags so redundant later courses stop claiming filled buckets", () => {
    const response = {
      mode: "recommendations" as const,
      current_progress: {
        MCC_WRIT: {
          label: "MCC Writing Intensive",
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
        MCC_ESSV2: {
          label: "MCC Engaging Social Systems & Values 2",
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
        MCC_DISC_CMI_HUM: {
          label: "Cognition Memory & Intelligence: Discovery Humanities",
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
        MCC_DISC_CMI_ELEC: {
          label: "Cognition Memory & Intelligence: Discovery Elective",
          needed: 1,
          needed_count: 1,
          completed_applied: [],
          in_progress_applied: [],
          completed_done: 0,
          in_progress_increment: 0,
          completed_courses: 0,
          in_progress_courses: 0,
          requirement_mode: "choose_n",
          satisfied: false,
        },
      },
      semesters: [
        {
          target_semester: "Fall 2028",
          recommendations: [
            {
              course_code: "ENGL 3250",
              course_name: "Life-Writing, Creativity and Community",
              credits: 3,
              is_manual_add: true,
              fills_buckets: ["MCC_DISC_CMI_ELEC", "MCC_DISC_CMI_HUM", "MCC_ESSV2", "MCC_WRIT"],
            },
          ],
        },
        {
          target_semester: "Spring 2029",
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
    } satisfies RecommendationResponse;

    const normalized = normalizeVisibleRecommendationData(response);
    const firstSemesterCourse = normalized?.semesters?.[0]?.recommendations?.[0];
    const secondSemesterCourse = normalized?.semesters?.[1]?.recommendations?.[0];

    expect(firstSemesterCourse?.fills_buckets).toEqual(["MCC_DISC_CMI_HUM", "MCC_ESSV2", "MCC_WRIT"]);
    expect(secondSemesterCourse?.fills_buckets).toEqual([]);
    expect(normalized?.semesters?.[1]?.projected_progress?.MCC_WRIT?.in_progress_applied).toEqual(["ENGL 3250"]);
  });
});
