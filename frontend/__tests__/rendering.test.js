import {
  renderCard,
  renderErrorHtml,
  renderCanTakeHtml,
  renderSemesterHtml,
  renderRecommendationsHtml,
} from "../modules/rendering.js";

describe("renderCard()", () => {
  const baseCard = {
    course_code: "FINA 3001",
    course_name: "Financial Management",
    credits: 3,
    why: "Core requirement.",
    prereq_check: "ECON 1103 \u2713",
    fills_buckets: ["CORE"],
    unlocks: [],
    soft_tags: [],
    low_confidence: false,
    notes: null,
  };

  test("shows course code and name in title", () => {
    const html = renderCard(baseCard);
    expect(html).toContain("FINA 3001 - Financial Management");
  });

  test("renders prereq line with course code", () => {
    const html = renderCard(baseCard);
    expect(html).toContain("ECON 1103");
  });

  test("renders unlocks using codes", () => {
    const html = renderCard({ ...baseCard, unlocks: ["FINA 4001"] });
    expect(html).toContain("Unlocks:");
    expect(html).toContain("FINA 4001");
  });

  test("renders namespaced bucket with program label", () => {
    const html = renderCard(
      { ...baseCard, fills_buckets: ["CB_CONC::CB_CORE"] },
      { programLabelMap: new Map([["CB_CONC", "Commercial Banking"]]) },
    );
    expect(html).toContain("Commercial Banking: CB Core");
  });
});

describe("renderErrorHtml()", () => {
  test("renders invalid and not-in-catalog lists", () => {
    const html = renderErrorHtml("Bad input", {
      invalid_courses: ["FAKE 9999"],
      not_in_catalog: ["MGMT 5050"],
    });
    expect(html).toContain("FAKE 9999");
    expect(html).toContain("MGMT 5050");
  });
});

describe("renderCanTakeHtml()", () => {
  test("shows requested course code", () => {
    const html = renderCanTakeHtml({
      can_take: false,
      requested_course: "FINA 4081",
      why_not: "Missing prerequisite(s): FINA 3001.",
      not_offered_this_term: false,
      missing_prereqs: ["FINA 3001"],
      next_best_alternatives: [],
    });
    expect(html).toContain("FINA 4081");
    expect(html).toContain("FINA 3001");
  });
});

describe("renderSemesterHtml()", () => {
  const sem = {
    target_semester: "Spring 2026",
    recommendations: [{
      course_code: "FINA 4001",
      course_name: "Advanced Finance",
      credits: 3,
      why: "Core requirement.",
      prereq_check: "FINA 3001 \u2713",
      fills_buckets: ["CORE"],
      unlocks: [],
      soft_tags: [],
      low_confidence: false,
      notes: null,
    }],
    eligible_count: 3,
    in_progress_note: null,
    blocking_warnings: ["Take FINA 3001 ASAP to unlock 3 core courses."],
    not_in_catalog_warning: null,
    input_completed_count: 2,
    applied_completed_count: 2,
    progress: {},
    double_counted_courses: [],
    allocation_notes: [],
    manual_review_courses: [],
    timeline: null,
  };

  test("keeps sequencing warning course code", () => {
    const html = renderSemesterHtml(sem, 1, 3);
    expect(html).toContain("Sequencing Heads-Up");
    expect(html).toContain("FINA 3001 ASAP");
  });
});

describe("renderRecommendationsHtml()", () => {
  const semData = {
    target_semester: "Spring 2026",
    recommendations: [{
      course_code: "FINA 4001",
      course_name: "Advanced Finance",
      credits: 3,
      why: "Good.",
      prereq_check: "FINA 3001 \u2713",
      fills_buckets: ["CORE"],
      unlocks: [],
      soft_tags: [],
      low_confidence: false,
      notes: null,
    }],
    eligible_count: 3,
    in_progress_note: null,
    blocking_warnings: [],
    not_in_catalog_warning: null,
    input_completed_count: 2,
    applied_completed_count: 2,
    progress: {},
    double_counted_courses: [],
    allocation_notes: [],
    manual_review_courses: [],
    timeline: null,
  };

  test("uses labels in plan context", () => {
    const html = renderRecommendationsHtml({
      ...semData,
      selection_context: {
        declared_majors: ["FIN_MAJOR"],
        declared_major_labels: ["Finance Major"],
        selected_track_id: "CB_CONC",
        selected_track_label: "Commercial Banking",
        selected_program_ids: ["FIN_MAJOR", "CB_CONC"],
        selected_program_labels: ["Finance Major", "Commercial Banking"],
      },
    }, 3);
    expect(html).toContain("Majors: Finance Major");
    expect(html).toContain("Track: Commercial Banking");
  });

  test("does not render Program Warnings section", () => {
    const html = renderRecommendationsHtml({
      ...semData,
      program_warnings: ["Track is inactive"],
    }, 3);
    expect(html).not.toContain("Program Warnings");
  });
});
