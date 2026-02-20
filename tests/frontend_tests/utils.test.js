import {
  esc,
  bucketLabel,
  colorizePrereq,
  formatCourseNotes,
  filterCourses,
  courseDisplayName,
  replaceCourseCodesInText,
} from "../../frontend/modules/utils.js";

describe("esc()", () => {
  test("returns empty string for null/undefined", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });

  test("escapes HTML chars", () => {
    expect(esc("a & b")).toBe("a &amp; b");
    expect(esc("<b>ok</b>")).toBe("&lt;b&gt;ok&lt;/b&gt;");
  });
});

describe("bucketLabel()", () => {
  test("maps known buckets", () => {
    expect(bucketLabel("CORE")).toBe("Finance Required");
    expect(bucketLabel("FIN_CHOOSE_2")).toBe("Upper Division Finance Elective (Two)");
  });

  test("handles namespaced bucket IDs", () => {
    expect(bucketLabel("CB_CONC::CB_CORE")).toBe("CB Core");
    const map = new Map([["CB_CONC", "Commercial Banking"]]);
    expect(bucketLabel("CB_CONC::CB_CORE", map)).toBe("Commercial Banking: CB Core");
  });
});

describe("colorizePrereq()", () => {
  test("highlights course codes with check/cross", () => {
    const out = colorizePrereq("FINA 3001 \u2713; ECON 1103 \u2717");
    expect(out).toContain('<span class="check">FINA 3001');
    expect(out).toContain('<span class="miss">ECON 1103');
  });

  test("keeps course codes even if name map is passed", () => {
    const map = new Map([["FINA 3001", "Financial Management"]]);
    const out = colorizePrereq("FINA 3001 \u2713", map);
    expect(out).toContain("FINA 3001");
    expect(out).not.toContain("Financial Management");
  });
});

describe("formatCourseNotes()", () => {
  test("extracts and reports hard prereq codes", () => {
    const out = formatCourseNotes("TODO complex prereq: FINA 3001 FINA 4001");
    expect(out).toContain("Hard prereq codes:");
    expect(out).toContain("FINA 3001");
  });

  test("fallback message when no codes are present", () => {
    expect(formatCourseNotes("todo complex prereq (see advisor)")).toBe("Hard prereq codes: see catalog.");
  });
});

describe("courseDisplayName()", () => {
  test("returns mapped value when available", () => {
    const map = new Map([["FINA 3001", "Financial Management"]]);
    expect(courseDisplayName("FINA 3001", map)).toBe("Financial Management");
  });

  test("falls back to code", () => {
    expect(courseDisplayName("FINA 3001", new Map())).toBe("FINA 3001");
  });
});

describe("replaceCourseCodesInText()", () => {
  test("keeps original text unchanged", () => {
    const map = new Map([["FINA 3001", "Financial Management"]]);
    const src = "Take FINA 3001 after ECON 1103.";
    expect(replaceCourseCodesInText(src, map)).toBe(src);
  });
});

describe("filterCourses()", () => {
  const courses = [
    { course_code: "FINA 3001", course_name: "Financial Management", prereq_level: 3 },
    { course_code: "FINA 4001", course_name: "Advanced Finance", prereq_level: 4 },
    { course_code: "ECON 1103", course_name: "Microeconomics", prereq_level: 1 },
    { course_code: "ECON 4040", course_name: "International Economics", prereq_level: 4 },
    { course_code: "ECON 3004", course_name: "Intermediate Macroeconomic Analysis", prereq_level: 3 },
  ];

  test("matches by course code only", () => {
    expect(filterCourses("fina", new Set(), courses).length).toBe(2);
    expect(filterCourses("econ", new Set(), courses)[0].course_code).toBe("ECON 1103");
    expect(filterCourses("micro", new Set(), courses)).toEqual([]);
  });

  test("excludes selected codes", () => {
    const out = filterCourses("fina", new Set(["FINA 3001"]), courses);
    expect(out.map(c => c.course_code)).toEqual(["FINA 4001"]);
  });

  test("orders matches by prereq_level ascending", () => {
    const out = filterCourses("econ", new Set(), courses);
    expect(out.map(c => c.course_code)).toEqual(["ECON 1103", "ECON 3004", "ECON 4040"]);
  });
});
