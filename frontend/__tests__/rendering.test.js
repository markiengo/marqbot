import { renderCard, renderErrorHtml, renderCanTakeHtml, renderSemesterHtml, renderRecommendationsHtml } from "../modules/rendering.js";

// ── renderCard() ─────────────────────────────────────────────────────────────
describe("renderCard()", () => {
  const baseCard = {
    course_code: "FINA 3001",
    course_name: "Financial Management",
    credits: 3,
    why: "Core requirement.",
    prereq_check: "ECON 1103 ✓",
    fills_buckets: ["CORE"],
    unlocks: [],
    soft_tags: [],
    low_confidence: false,
    notes: null,
  };

  test("contains course code and name", () => {
    const html = renderCard(baseCard);
    expect(html).toContain("FINA 3001");
    expect(html).toContain("Financial Management");
  });

  test("contains credits", () => {
    const html = renderCard(baseCard);
    expect(html).toContain("3 credits");
  });

  test("contains bucket tag for CORE", () => {
    const html = renderCard(baseCard);
    expect(html).toContain("Finance Required");
  });

  test("escapes XSS in why field", () => {
    const card = { ...baseCard, why: "<script>alert(1)</script>" };
    const html = renderCard(card);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("includes unlocks line when unlocks present", () => {
    const card = { ...baseCard, unlocks: ["FINA 4001", "FINA 4011"] };
    const html = renderCard(card);
    expect(html).toContain("Unlocks:");
    expect(html).toContain("FINA 4001");
  });

  test("does not include unlocks line when unlocks is empty", () => {
    const html = renderCard(baseCard);
    expect(html).not.toContain("Unlocks:");
  });

  test("includes soft warning when soft_tags present", () => {
    const card = { ...baseCard, soft_tags: ["instructor_consent"] };
    const html = renderCard(card);
    expect(html).toContain("soft-warn");
    expect(html).toContain("instructor consent");
  });

  test("includes low confidence warning when low_confidence is true", () => {
    const card = { ...baseCard, low_confidence: true };
    const html = renderCard(card);
    expect(html).toContain("offering schedule may vary");
  });

  test("uses gold why class for generic deterministic reason", () => {
    const card = { ...baseCard, why: "This course advances your Finance major path and counts toward 1 unmet requirement bucket(s)." };
    const html = renderCard(card);
    expect(html).toContain("rec-card-why-gold");
  });

  test("defaults credits to 3 when missing", () => {
    const card = { ...baseCard, credits: undefined };
    const html = renderCard(card);
    expect(html).toContain("3 credits");
  });
});

// ── renderErrorHtml() ────────────────────────────────────────────────────────
describe("renderErrorHtml()", () => {
  test("contains error message", () => {
    const html = renderErrorHtml("Something went wrong.");
    expect(html).toContain("Something went wrong.");
    expect(html).toContain("error-banner");
  });

  test("escapes HTML in error message", () => {
    const html = renderErrorHtml("<b>bad</b>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  test("shows invalid_courses list when present", () => {
    const errObj = { invalid_courses: ["FAKE 9999"], not_in_catalog: [] };
    const html = renderErrorHtml("Invalid input.", errObj);
    expect(html).toContain("FAKE 9999");
    expect(html).toContain("Invalid codes:");
  });

  test("shows not_in_catalog list when present", () => {
    const errObj = { invalid_courses: [], not_in_catalog: ["MGMT 5050"] };
    const html = renderErrorHtml("Not in catalog.", errObj);
    expect(html).toContain("MGMT 5050");
    expect(html).toContain("Not in catalog:");
  });

  test("renders cleanly with no errObj", () => {
    const html = renderErrorHtml("Simple error");
    expect(html).toContain("Simple error");
  });
});

// ── renderCanTakeHtml() ──────────────────────────────────────────────────────
describe("renderCanTakeHtml()", () => {
  test("shows can-take-true class when can_take is true", () => {
    const data = { can_take: true, requested_course: "FINA 4001", why_not: null, not_offered_this_term: false, missing_prereqs: [], next_best_alternatives: [] };
    const html = renderCanTakeHtml(data);
    expect(html).toContain("can-take-true");
    expect(html).toContain("FINA 4001");
  });

  test("shows can-take-false class when can_take is false", () => {
    const data = { can_take: false, requested_course: "FINA 4081", why_not: "Missing FINA 3001.", not_offered_this_term: false, missing_prereqs: ["FINA 3001"], next_best_alternatives: [] };
    const html = renderCanTakeHtml(data);
    expect(html).toContain("can-take-false");
    expect(html).toContain("FINA 3001");
  });

  test("shows can-take-null class when can_take is null", () => {
    const data = { can_take: null, requested_course: "FINA 5099", why_not: null, not_offered_this_term: false, missing_prereqs: [], next_best_alternatives: [] };
    const html = renderCanTakeHtml(data);
    expect(html).toContain("can-take-null");
    expect(html).toContain("Manual review");
  });

  test("shows not-offered message when not_offered_this_term is true", () => {
    const data = { can_take: false, requested_course: "FINA 4081", why_not: null, not_offered_this_term: true, missing_prereqs: [], next_best_alternatives: [] };
    const html = renderCanTakeHtml(data);
    expect(html).toContain("not offered this term");
  });

  test("shows alternatives section when present", () => {
    const alt = { course_code: "FINA 4001", course_name: "Advanced Finance", credits: 3, why: "Good alternative.", prereq_check: "ECON 1103 ✓", fills_buckets: ["CORE"], unlocks: [], soft_tags: [], low_confidence: false, notes: null };
    const data = { can_take: false, requested_course: "FINA 4081", why_not: null, not_offered_this_term: false, missing_prereqs: [], next_best_alternatives: [alt] };
    const html = renderCanTakeHtml(data);
    expect(html).toContain("Alternatives you can take instead");
    expect(html).toContain("FINA 4001");
  });
});

// ── renderSemesterHtml() ─────────────────────────────────────────────────────
describe("renderSemesterHtml()", () => {
  const baseRec = {
    course_code: "FINA 4001",
    course_name: "Advanced Finance",
    credits: 3,
    why: "Core requirement.",
    prereq_check: "FINA 3001 ✓",
    fills_buckets: ["CORE"],
    unlocks: [],
    soft_tags: [],
    low_confidence: false,
    notes: null,
  };

  const baseSemData = {
    target_semester: "Spring 2026",
    recommendations: [baseRec],
    eligible_count: 5,
    in_progress_note: null,
    blocking_warnings: [],
    not_in_catalog_warning: null,
    input_completed_count: 2,
    applied_completed_count: 2,
    progress: {
      CORE: {
        label: "Finance Required",
        needed: 5,
        done_count: 2,
        satisfied: false,
        in_progress_applied: [],
        remaining_courses: ["FINA 4001"],
        slots_remaining: 3,
      },
    },
    double_counted_courses: [],
    allocation_notes: [],
    manual_review_courses: [],
    timeline: null,
  };

  test("contains semester label", () => {
    const html = renderSemesterHtml(baseSemData, 1, 3);
    expect(html).toContain("Spring 2026");
    expect(html).toContain("Semester 1");
  });

  test("contains recommendation card", () => {
    const html = renderSemesterHtml(baseSemData, 1, 3);
    expect(html).toContain("FINA 4001");
    expect(html).toContain("Advanced Finance");
  });

  test("contains degree progress section", () => {
    const html = renderSemesterHtml(baseSemData, 1, 3);
    expect(html).toContain("Degree Progress");
    expect(html).toContain("Finance Required");
  });

  test("shows blocking warning when present", () => {
    const data = { ...baseSemData, blocking_warnings: ["Take FINA 3001 ASAP to unlock 3 core courses."] };
    const html = renderSemesterHtml(data, 1, 3);
    expect(html).toContain("Sequencing Heads-Up");
    expect(html).toContain("FINA 3001 ASAP");
  });

  test("shows recommendation count warning when eligible < requested", () => {
    const data = { ...baseSemData, eligible_count: 1 };
    const html = renderSemesterHtml(data, 1, 3);
    expect(html).toContain("Recommendation Count");
    expect(html).toContain("only 1 eligible");
  });

  test("shows timeline when present", () => {
    const data = { ...baseSemData, timeline: { remaining_slots_total: 10, estimated_min_terms: 4, disclaimer: "Estimate only." } };
    const html = renderSemesterHtml(data, 1, 3);
    expect(html).toContain("timeline-box");
    expect(html).toContain("Estimate only.");
  });

  test("shows manual review courses when present", () => {
    const data = { ...baseSemData, manual_review_courses: ["FINA 5099"] };
    const html = renderSemesterHtml(data, 1, 3);
    expect(html).toContain("FINA 5099");
    expect(html).toContain("manual prereq review");
  });
});

// ── renderRecommendationsHtml() ───────────────────────────────────────────────
describe("renderRecommendationsHtml()", () => {
  const semData = {
    target_semester: "Spring 2026",
    recommendations: [{ course_code: "FINA 4001", course_name: "Adv Finance", credits: 3, why: "Good.", prereq_check: "FINA 3001 ✓", fills_buckets: ["CORE"], unlocks: [], soft_tags: [], low_confidence: false, notes: null }],
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

  test("wraps each semester in semester-block when semesters array present", () => {
    const data = { semesters: [semData, { ...semData, target_semester: "Fall 2026" }] };
    const html = renderRecommendationsHtml(data, 3);
    expect(html).toContain("semester-block");
    expect(html).toContain("Semester 1");
    expect(html).toContain("Semester 2");
  });

  test("renders single semester when no semesters array", () => {
    const html = renderRecommendationsHtml(semData, 3);
    expect(html).toContain("Semester 1");
    expect(html).toContain("FINA 4001");
  });
});
