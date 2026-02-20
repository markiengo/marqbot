import { esc, bucketLabel, colorizePrereq, formatCourseNotes, filterCourses } from "../modules/utils.js";

describe("esc()", () => {
  test("returns empty string for null", () => {
    expect(esc(null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(esc(undefined)).toBe("");
  });

  test("escapes < and >", () => {
    expect(esc("<script>")).toBe("&lt;script&gt;");
  });

  test("escapes &", () => {
    expect(esc("a & b")).toBe("a &amp; b");
  });

  test("escapes double quotes", () => {
    expect(esc('"hello"')).toBe("&quot;hello&quot;");
  });

  test("passes through safe strings unchanged", () => {
    expect(esc("FINA 3001")).toBe("FINA 3001");
  });

  test("converts numbers to strings", () => {
    expect(esc(42)).toBe("42");
  });
});

describe("bucketLabel()", () => {
  test("returns known label for CORE", () => {
    expect(bucketLabel("CORE")).toBe("Finance Required");
  });

  test("returns known label for FIN_CHOOSE_2", () => {
    expect(bucketLabel("FIN_CHOOSE_2")).toBe("Upper Division Finance Elective (Two)");
  });

  test("returns known label for FIN_CHOOSE_1", () => {
    expect(bucketLabel("FIN_CHOOSE_1")).toBe("Upper Division Finance Elective (One)");
  });

  test("returns known label for BUS_ELEC_4", () => {
    expect(bucketLabel("BUS_ELEC_4")).toBe("Business Electives");
  });

  test("falls back to underscores replaced with spaces for unknown IDs", () => {
    expect(bucketLabel("MY_CUSTOM_BUCKET")).toBe("MY CUSTOM BUCKET");
  });

  test("formats namespaced bucket IDs for multi-program plans", () => {
    expect(bucketLabel("FIN_MAJOR::CORE")).toBe("Finance Required");
    expect(bucketLabel("CB_CONC::CB_CORE")).toBe("CB CORE");
  });

  test("returns empty string for null/undefined", () => {
    expect(bucketLabel(null)).toBe("");
    expect(bucketLabel(undefined)).toBe("");
  });
});

describe("colorizePrereq()", () => {
  test("returns empty string for falsy input", () => {
    expect(colorizePrereq("")).toBe("");
    expect(colorizePrereq(null)).toBe("");
  });

  test("wraps completed course with check span", () => {
    const result = colorizePrereq("FINA 3001 ✓");
    expect(result).toContain('<span class="check">');
    expect(result).toContain("FINA 3001");
  });

  test("wraps in-progress course with ip span", () => {
    const result = colorizePrereq("FINA 3001 (in progress) ✓");
    expect(result).toContain('<span class="ip">');
    expect(result).toContain("FINA 3001");
  });

  test("wraps missing course with miss span", () => {
    const result = colorizePrereq("FINA 3001 ✗");
    expect(result).toContain('<span class="miss">');
    expect(result).toContain("FINA 3001");
  });

  test("handles string with no special markers unchanged", () => {
    const result = colorizePrereq("No prerequisites");
    expect(result).toBe("No prerequisites");
  });

  test("handles mixed satisfied and missing prereqs", () => {
    const result = colorizePrereq("ECON 1103 ✓; BUAD 1560 ✗");
    expect(result).toContain('<span class="check">');
    expect(result).toContain('<span class="miss">');
  });
});

describe("formatCourseNotes()", () => {
  test("extracts course codes from todo/complex prereq note", () => {
    const result = formatCourseNotes("TODO complex prereq: FINA 3001 FINA 4001");
    expect(result).toContain("FINA 3001");
    expect(result).toContain("FINA 4001");
    expect(result).toContain("Hard prereq codes:");
  });

  test("falls back to catalog message when todo note has no codes", () => {
    const result = formatCourseNotes("todo complex prereq (see advisor)");
    expect(result).toBe("Hard prereq codes: see catalog.");
  });

  test("escapes and returns regular notes as-is", () => {
    const result = formatCourseNotes("Only offered in Fall");
    expect(result).toBe("Only offered in Fall");
  });

  test("escapes HTML in regular notes", () => {
    const result = formatCourseNotes("<special> note");
    expect(result).toContain("&lt;special&gt;");
  });

  test("handles null/empty gracefully", () => {
    expect(formatCourseNotes(null)).toBe("");
    expect(formatCourseNotes("")).toBe("");
  });
});

describe("filterCourses()", () => {
  const courses = [
    { course_code: "FINA 3001", course_name: "Financial Management" },
    { course_code: "FINA 4001", course_name: "Advanced Finance" },
    { course_code: "ECON 1103", course_name: "Microeconomics" },
    { course_code: "BUAD 1560", course_name: "Business Analytics" },
  ];

  test("returns empty array for empty query", () => {
    expect(filterCourses("", new Set(), courses)).toEqual([]);
  });

  test("returns empty array for whitespace-only query", () => {
    expect(filterCourses("   ", new Set(), courses)).toEqual([]);
  });

  test("matches by course code (case-insensitive)", () => {
    const results = filterCourses("fina", new Set(), courses);
    expect(results.length).toBe(2);
    expect(results.map(c => c.course_code)).toContain("FINA 3001");
    expect(results.map(c => c.course_code)).toContain("FINA 4001");
  });

  test("matches by course name", () => {
    const results = filterCourses("micro", new Set(), courses);
    expect(results.length).toBe(1);
    expect(results[0].course_code).toBe("ECON 1103");
  });

  test("excludes codes in excludeSet", () => {
    const results = filterCourses("fina", new Set(["FINA 3001"]), courses);
    expect(results.map(c => c.course_code)).not.toContain("FINA 3001");
    expect(results.map(c => c.course_code)).toContain("FINA 4001");
  });

  test("caps results at 12", () => {
    const manyCourses = Array.from({ length: 20 }, (_, i) => ({
      course_code: `FINA ${3000 + i}`,
      course_name: `Finance Course ${i}`,
    }));
    const results = filterCourses("fina", new Set(), manyCourses);
    expect(results.length).toBe(12);
  });

  test("returns empty array when no match", () => {
    const results = filterCourses("xyz999", new Set(), courses);
    expect(results).toEqual([]);
  });
});
