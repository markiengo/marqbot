import { describe, expect, test } from "vitest";

import {
  bucketLabel,
  colorizePrereq,
  filterCourses,
  formatCourseNotes,
  prettifyIdentifier,
} from "../../frontend/src/lib/utils";

describe("utils.bucketLabel", () => {
  test("maps known buckets", () => {
    expect(bucketLabel("CORE")).toBe("Finance Required");
    expect(bucketLabel("FIN_CHOOSE_2")).toBe("Upper Division Finance Elective (Two)");
  });

  test("formats namespaced bucket with program label", () => {
    const map = new Map([["AIM_MAJOR", "AIM Major"]]);
    expect(bucketLabel("AIM_MAJOR::AIM_NO_CONC_CORE", map)).toBe("AIM Major: AIM Core");
  });

  test("normalizes business elective pattern", () => {
    expect(bucketLabel("AIM_MAJOR::AIM_BUS_ELEC_9")).toBe("Business Electives");
  });
});

describe("utils.prettifyIdentifier", () => {
  test("normalizes separators and capitalization", () => {
    expect(prettifyIdentifier("acco-choose-2")).toBe("ACCO Choose 2");
  });
});

describe("utils.colorizePrereq", () => {
  test("applies check and miss markup", () => {
    const out = colorizePrereq("FINA 3001 \u2713; ECON 1103 \u2717");
    expect(out).toContain("text-green-600");
    expect(out).toContain("FINA 3001");
    expect(out).toContain("text-red-500");
    expect(out).toContain("ECON 1103");
  });
});

describe("utils.formatCourseNotes", () => {
  test("extracts complex prereq codes", () => {
    expect(formatCourseNotes("TODO complex prereq: FINA 3001 FINA 4001")).toContain(
      "FINA 3001, FINA 4001",
    );
  });

  test("returns catalog fallback when no codes present", () => {
    expect(formatCourseNotes("todo complex prereq (see advisor)")).toBe(
      "Hard prereq codes: see catalog.",
    );
  });
});

describe("utils.filterCourses", () => {
  test("filters, excludes, and sorts by level then code", () => {
    const courses = [
      { course_code: "ECON 4040", course_name: "International Economics", credits: 3, level: 4000 },
      { course_code: "ECON 1103", course_name: "Microeconomics", credits: 3, level: 1000 },
      { course_code: "ECON 3004", course_name: "Intermediate Macro", credits: 3, level: 3000 },
    ];
    const out = filterCourses("econ", new Set(["ECON 3004"]), courses);
    expect(out.map((c) => c.course_code)).toEqual(["ECON 1103", "ECON 4040"]);
  });
});
