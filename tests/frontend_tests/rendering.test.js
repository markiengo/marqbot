import {
  renderCard,
  renderErrorHtml,
  renderCanTakeHtml,
  renderSemesterHtml,
  renderRecommendationsHtml,
  renderProgressRing,
  renderKpiCardsHtml,
  renderDegreeSummaryHtml,
  renderCanTakeInlineHtml,
} from "../../frontend/modules/rendering.js";

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

  test("shows course code and name in title with em dash", () => {
    const html = renderCard(baseCard);
    expect(html).toContain("FINA 3001 — Financial Management");
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

  test("soft_tags render as warning-strip, not soft-warn", () => {
    const html = renderCard({ ...baseCard, soft_tags: ["schedule_uncertain"] });
    expect(html).toContain('class="warning-strip"');
    expect(html).toContain("schedule uncertain");
    // Must NOT use the old transient soft-warn class
    expect(html).not.toContain('class="soft-warn"');
    // Must NOT carry the red warning-text class
    expect(html).not.toContain("warning-text");
  });

  test("low_confidence renders as warning-strip", () => {
    const html = renderCard({ ...baseCard, low_confidence: true });
    expect(html).toContain('class="warning-strip"');
    expect(html).toContain("confirm with registrar");
  });

  test("warning-strip has role=alert", () => {
    const html = renderCard({ ...baseCard, soft_tags: ["schedule_uncertain"] });
    expect(html).toContain('role="alert"');
  });

  test("overlap note appears when course fills multiple buckets", () => {
    const html = renderCard({ ...baseCard, fills_buckets: ["CORE", "ELEC"] });
    expect(html).toContain('class="overlap-note"');
    expect(html).toContain("Counts toward 2 requirements");
  });

  test("no overlap note for single-bucket course", () => {
    const html = renderCard(baseCard); // fills_buckets: ["CORE"]
    expect(html).not.toContain("overlap-note");
    expect(html).toContain("Counts toward:");
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
    projected_progress: {},
    double_counted_courses: [],
    allocation_notes: [],
    manual_review_courses: [],
    timeline: null,
    projected_timeline: null,
    projection_note: "Assuming you complete these recommendations, projected progress updates are shown below.",
  };

  test("does not render sequencing heads-up section", () => {
    const html = renderSemesterHtml(sem, 1, 3);
    expect(html).not.toContain("Sequencing Heads-Up");
    expect(html).not.toContain("sequencing-item");
  });

  test("renames timeline label to courses required remaining", () => {
    const html = renderSemesterHtml({
      ...sem,
      timeline: { remaining_slots_total: 8, estimated_min_terms: 3, disclaimer: "d1" },
    }, 1, 3);
    expect(html).toContain("Courses required remaining");
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
    expect(html).toContain('class="heading-gold">Plan Context');
  });

  test("does not render Program Warnings section", () => {
    const html = renderRecommendationsHtml({
      ...semData,
      program_warnings: ["Track is inactive"],
    }, 3);
    expect(html).not.toContain("Program Warnings");
  });

  test("renders current degree progress before semester sections", () => {
    const html = renderRecommendationsHtml({
      ...semData,
      selection_context: {
        declared_majors: ["FIN_MAJOR"],
        declared_major_labels: ["Finance Major"],
        selected_track_id: null,
        selected_track_label: null,
        selected_program_ids: ["FIN_MAJOR"],
        selected_program_labels: ["Finance Major"],
      },
      current_progress: {
        "FIN_MAJOR::CORE": {
          label: "Finance Major: Core",
          needed: 4,
          completed_done: 1,
          in_progress_increment: 1,
          assumed_done: 2,
          satisfied: false,
        },
      },
      current_assumption_notes: [
        "Assumed ACCO 1030 because ACCO 1031 is in progress.",
      ],
      semesters: [semData],
    }, 3);
    const planIdx = html.indexOf("Plan Context");
    const currentIdx = html.indexOf("Current Degree Progress");
    const semIdx = html.indexOf("Semester 1: Recommended for");
    expect(planIdx).toBeGreaterThanOrEqual(0);
    expect(currentIdx).toBeGreaterThan(planIdx);
    expect(semIdx).toBeGreaterThan(currentIdx);
    expect(html).toContain("With current in-progress: 2 of 4");
    expect(html).toContain('class="assumption-notes"');
    expect(html).toContain("Assumed ACCO 1030 because ACCO 1031 is in progress.");
  });

  test("does not render assumption list when notes are empty", () => {
    const html = renderRecommendationsHtml({
      ...semData,
      current_progress: {
        "FIN_MAJOR::CORE": {
          label: "Finance Major: Core",
          needed: 4,
          completed_done: 1,
          in_progress_increment: 0,
          assumed_done: 1,
          satisfied: false,
        },
      },
      current_assumption_notes: [],
      semesters: [semData],
    }, 3);
    expect(html).toContain("Current Degree Progress");
    expect(html).not.toContain('class="assumption-notes"');
  });
});

describe("renderProgressRing()", () => {
  test("clamps percentage below 0 to 0", () => {
    const html = renderProgressRing(-10);
    expect(html).toContain('aria-label="0% complete"');
    expect(html).toContain("0%");
  });

  test("clamps percentage above 100 to 100", () => {
    const html = renderProgressRing(150);
    expect(html).toContain('aria-label="100% complete"');
    expect(html).toContain("100%");
  });

  test("includes aria-label with rounded percentage", () => {
    const html = renderProgressRing(50);
    expect(html).toContain('aria-label="50% complete"');
  });

  test("renders an SVG element", () => {
    const html = renderProgressRing(75);
    expect(html).toContain("<svg");
    expect(html).toContain("</svg>");
  });

  test("stroke-dashoffset is smaller at higher percentages", () => {
    const low = renderProgressRing(10);
    const high = renderProgressRing(90);
    const extractOffset = s => {
      const m = s.match(/stroke-dashoffset="([\d.]+)"/);
      return m ? parseFloat(m[1]) : null;
    };
    expect(extractOffset(low)).toBeGreaterThan(extractOffset(high));
  });

  test("respects custom size parameter", () => {
    const html = renderProgressRing(50, 200, 12);
    expect(html).toContain('width="200"');
    expect(html).toContain('height="200"');
  });
});

describe("renderKpiCardsHtml()", () => {
  test("contains completed value", () => {
    const html = renderKpiCardsHtml(5, 10, 2);
    expect(html).toContain(">5<");
  });

  test("contains remaining value", () => {
    const html = renderKpiCardsHtml(5, 10, 2);
    expect(html).toContain(">10<");
  });

  test("contains in-progress value", () => {
    const html = renderKpiCardsHtml(5, 10, 2);
    expect(html).toContain(">2<");
  });

  test("uses kpi-cards wrapper class", () => {
    const html = renderKpiCardsHtml(0, 0, 0);
    expect(html).toContain('class="kpi-cards"');
  });
});

describe("renderDegreeSummaryHtml()", () => {
  test("renders bucket label and fraction", () => {
    const progress = {
      CORE: {
        label: "Finance Required",
        needed: 3,
        completed_done: 1,
        in_progress_increment: 0,
        assumed_done: 1,
        satisfied: false,
      },
    };
    const html = renderDegreeSummaryHtml(progress);
    expect(html).toContain("Finance Required");
    expect(html).toContain("1");
    expect(html).toContain("3");
  });

  test("returns empty string for null input", () => {
    expect(renderDegreeSummaryHtml(null)).toBe("");
    expect(renderDegreeSummaryHtml({})).toBe("");
  });

  test("satisfied bucket gets done modifier class", () => {
    const progress = {
      CORE: {
        label: "Core",
        needed: 2,
        completed_done: 2,
        in_progress_increment: 0,
        assumed_done: 2,
        satisfied: true,
      },
    };
    const html = renderDegreeSummaryHtml(progress);
    expect(html).toContain("summary-bucket--done");
  });
});

describe("renderCanTakeInlineHtml()", () => {
  test("can_take true renders yes pill", () => {
    const html = renderCanTakeInlineHtml({
      requested_course: "FINA 4081",
      can_take: true,
      why_not: null,
      missing_prereqs: [],
    });
    expect(html).toContain("ct-pill--yes");
    expect(html).toContain("FINA 4081");
  });

  test("can_take false renders no pill and missing prereqs", () => {
    const html = renderCanTakeInlineHtml({
      requested_course: "FINA 4081",
      can_take: false,
      why_not: "Missing prerequisites.",
      missing_prereqs: ["FINA 3001"],
    });
    expect(html).toContain("ct-pill--no");
    expect(html).toContain("FINA 3001");
  });

  test("can_take null renders review pill", () => {
    const html = renderCanTakeInlineHtml({
      requested_course: "FINA 4081",
      can_take: null,
      why_not: "Complex prereq structure.",
      missing_prereqs: [],
    });
    expect(html).toContain("ct-pill--review");
    expect(html).toContain("Manual review required");
  });

  test("returns empty string for null/missing data", () => {
    expect(renderCanTakeInlineHtml(null)).toBe("");
    expect(renderCanTakeInlineHtml({})).toBe("");
  });
});
