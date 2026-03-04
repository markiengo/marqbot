import { describe, expect, test } from "vitest";

import {
  buildCourseCreditMap,
  compactKpiBucketLabel,
  computeCreditKpiMetrics,
  deriveStandingFromCredits,
  getProgramLabelMap,
  groupProgressByParent,
  groupProgressByTierWithMajors,
  groupProgressByTierSections,
  sortProgressEntries,
  sumCreditsForCourseCodes,
} from "../../frontend/src/lib/rendering";

describe("rendering.getProgramLabelMap", () => {
  test("builds id to label map from selection context", () => {
    const map = getProgramLabelMap({
      selected_program_ids: ["FIN_MAJOR", "CB_TRACK"],
      selected_program_labels: ["FINA Major", "Commercial Banking"],
    });
    expect(map.get("FIN_MAJOR")).toBe("FINA Major");
    expect(map.get("CB_TRACK")).toBe("Commercial Banking");
  });
});

describe("rendering.compactKpiBucketLabel", () => {
  test("compacts long labels and strips no-concentration text", () => {
    const label = compactKpiBucketLabel(
      "AIM Major (No Concentration): AIM No Concentration Elective (1)",
    );
    expect(label).toContain("AIM Major:");
    expect(label).toContain("AIM Elective");
    expect(label).not.toContain("No Concentration");
  });
});

describe("rendering.sortProgressEntries", () => {
  test("ranks MCC before BCC, then majors", () => {
    const out = sortProgressEntries({
      "FIN_MAJOR::FINA-REQ-CORE": { needed: 1, completed_done: 0 },
      "BCC::BCC_REQUIRED": { needed: 1, completed_done: 0 },
      "MCC_FOUNDATION::MCC_CORE": { needed: 1, completed_done: 0 },
    });
    expect(out.map(([bucketId]) => bucketId)).toEqual([
      "MCC_FOUNDATION::MCC_CORE",
      "BCC::BCC_REQUIRED",
      "FIN_MAJOR::FINA-REQ-CORE",
    ]);
  });

  test("keeps demoted BCC children below major buckets", () => {
    const out = sortProgressEntries({
      "BCC::BCC_ANALYTICS": { needed: 1, completed_done: 0, recommendation_tier: 5 },
      "FIN_MAJOR::FINA-REQ-CORE": { needed: 1, completed_done: 0, recommendation_tier: 2 },
      "BCC::BCC_REQUIRED": { needed: 1, completed_done: 0, recommendation_tier: 1 },
    });
    expect(out.map(([bucketId]) => bucketId)).toEqual([
      "BCC::BCC_REQUIRED",
      "BCC::BCC_ANALYTICS",
      "FIN_MAJOR::FINA-REQ-CORE",
    ]);
  });
});

describe("rendering.groupProgressByParent", () => {
  test("keeps parent groups intact", () => {
    const groups = groupProgressByParent({
      "BCC::BCC_REQUIRED": { needed: 1, completed_done: 0, recommendation_tier: 1 },
      "BCC::BCC_ANALYTICS": { needed: 1, completed_done: 0, recommendation_tier: 5 },
      "FIN_MAJOR::FINA-REQ-CORE": { needed: 1, completed_done: 0, recommendation_tier: 2 },
    });
    expect(groups.map((group) => group.parentId)).toEqual([
      "BCC",
      "FIN_MAJOR",
    ]);
  });
});

describe("rendering.groupProgressByTierSections", () => {
  test("builds recommender-style sections for modal views", () => {
    const sections = groupProgressByTierSections({
      "MCC_FOUNDATION::MCC_CORE": { needed: 1, completed_done: 0, recommendation_tier: 1 },
      "BCC::BCC_REQUIRED": { needed: 1, completed_done: 0, recommendation_tier: 1 },
      "FIN_MAJOR::FINA-REQ-CORE": { needed: 1, completed_done: 0, recommendation_tier: 2 },
      "CB_TRACK::COMMBANK-REQ-CORE": { needed: 1, completed_done: 0, recommendation_tier: 3 },
    });
    expect(sections.map((section) => section.label)).toEqual([
      "MCC",
      "Business Core (BCC)",
      "Major Requirements",
      "Tracks & Minors",
    ]);
  });
});

describe("rendering.groupProgressByTierWithMajors", () => {
  test("puts core-labeled buckets first within a major subgroup", () => {
    const sections = groupProgressByTierWithMajors(
      {
        "ACCO_MAJOR::acco-choose-2": {
          needed: 2,
          completed_done: 0,
          recommendation_tier: 2,
          label: "ACCO: Choose 2",
        },
        "ACCO_MAJOR::acco-electives": {
          needed: 6,
          completed_done: 0,
          recommendation_tier: 2,
          label: "ACCO: 2 Business Electives (6 credits)",
        },
        "ACCO_MAJOR::acco-req-core": {
          needed: 7,
          completed_done: 0,
          recommendation_tier: 2,
          label: "ACCO: ACCO Core Requirements",
        },
        "MARK_MAJOR::mark-elective": {
          needed: 3,
          completed_done: 0,
          recommendation_tier: 2,
          label: "Marketing: Choose 3",
        },
      },
      new Map([
        ["ACCO_MAJOR", "Accounting"],
        ["MARK_MAJOR", "Marketing"],
      ]),
      ["ACCO_MAJOR", "MARK_MAJOR"],
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].subGroups).toHaveLength(2);
    expect(sections[0].subGroups?.[0].entries.map(([bucketId]) => bucketId)).toEqual([
      "ACCO_MAJOR::acco-req-core",
      "ACCO_MAJOR::acco-choose-2",
      "ACCO_MAJOR::acco-electives",
    ]);
  });
});

describe("rendering.credit metrics", () => {
  test("builds credit map and sums unique courses", () => {
    const map = buildCourseCreditMap([
      { course_code: "FINA 3001", course_name: "Financial Management", credits: 3 },
      { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 },
    ]);
    expect(sumCreditsForCourseCodes(["FINA 3001", "FINA 3001", "ACCO 1030"], map)).toBe(6);
  });

  test("derives standing from credits", () => {
    expect(deriveStandingFromCredits(0)).toBe("Freshman Standing");
    expect(deriveStandingFromCredits(24)).toBe("Sophomore Standing");
    expect(deriveStandingFromCredits(60)).toBe("Junior Standing");
    expect(deriveStandingFromCredits(90)).toBe("Senior Standing");
  });

  test("computes credit KPI totals and percentages", () => {
    const kpi = computeCreditKpiMetrics(62, 12, 124);
    expect(kpi.completedCredits).toBe(62);
    expect(kpi.inProgressCredits).toBe(12);
    expect(kpi.remainingCredits).toBe(50);
    expect(kpi.overallPercent).toBeCloseTo(((62 + 12) / 124) * 100, 6);
  });
});
