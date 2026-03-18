import { describe, expect, test } from "vitest";

import fixture from "./fixtures/coursehistory.ocr.fixture.json";
import { parseCourseHistoryTokens, type CourseHistoryOcrLine } from "@/lib/courseHistoryImport";
import type { Course } from "@/lib/types";

const sampleCourses: Course[] = [
  "ACCO 1030",
  "ACCO 1031",
  "BUAD 1001",
  "BUAD 1560",
  "BUAD 2001",
  "COSC 1020",
  "ECON 1103",
  "ECON 1104",
  "ENGL 1001",
  "FINA 3001",
  "INGS 1001",
  "INSY 3001",
  "LEAD 1050",
  "MARK 3001",
  "MATH 1450",
  "MATH 1455",
  "MATH 1700",
  "MATH 4720",
  "OSCM 3001",
  "PSYC 1001",
  "SOCI 1001",
  "SOCI 2350",
  "SOCI 4420",
  "SOCI 4997",
  "SOCI 4999",
  "THEO 1001",
].map((course_code) => ({
  course_code,
  course_name: course_code,
  credits: 3,
  level: Number(course_code.split(" ")[1]?.slice(0, 1) || 1) * 1000,
}));

function parseSampleFixture(lines: CourseHistoryOcrLine[] = fixture.lines as CourseHistoryOcrLine[]) {
  return parseCourseHistoryTokens(lines, sampleCourses);
}

describe("courseHistoryImport parser", () => {
  test("matches the coursehistory.jpg golden summary", () => {
    const result = parseSampleFixture();

    expect(result.summary).toEqual({
      completed_count: 11,
      in_progress_count: 10,
      unmatched_count: 1,
      ignored_count: 2,
      total_rows: 24,
    });

    expect(result.completed_matches.some((row) => row.course_code === "ACCO 1030")).toBe(true);
    expect(result.completed_matches.some((row) => row.course_code === "THEO 1001")).toBe(true);
    expect(result.in_progress_matches.some((row) => row.course_code === "OSCM 3001")).toBe(true);
    expect(result.in_progress_matches.some((row) => row.course_code === "MATH 1455")).toBe(true);
  });

  test("throws when the header row is missing", () => {
    const withoutHeaders = (fixture.lines as CourseHistoryOcrLine[]).filter((line) => line.bbox.y0 > 140);
    expect(() => parseSampleFixture(withoutHeaders)).toThrow(/could not detect/i);
  });

  test("merges wrapped title continuations into the previous course row", () => {
    const result = parseSampleFixture();
    const oscmRow = result.in_progress_matches.find((row) => row.course_code === "OSCM 3001");
    const leadRow = result.completed_matches.find((row) => row.course_code === "LEAD 1050");

    expect(oscmRow?.source_text).toContain("Operations/Supply Chain Mangmt");
    expect(leadRow?.source_text).toContain("Fndtns Academic/Career Success");
  });

  test("skips footer notes and repeat legends", () => {
    const result = parseSampleFixture();
    const allSourceText = [
      ...result.completed_matches,
      ...result.in_progress_matches,
      ...result.unmatched_rows,
      ...result.ignored_rows,
    ].map((row) => row.source_text);

    expect(allSourceText.some((text) => text.includes("Grade Change"))).toBe(false);
    expect(allSourceText.some((text) => text.includes("Academic Advisement"))).toBe(false);
  });

  test("keeps withdrawn repeats out of completed matches", () => {
    const result = parseSampleFixture();

    expect(result.ignored_rows.map((row) => row.reason)).toEqual(["withdrawn", "withdrawn"]);
    expect(result.completed_matches.filter((row) => row.course_code === "ECON 1103")).toHaveLength(1);
    expect(result.completed_matches.filter((row) => row.course_code === "MATH 1450")).toHaveLength(1);
  });

  test("classifies IP rows even when the final-grade column is blank", () => {
    const result = parseSampleFixture();
    const acco1031 = result.in_progress_matches.find((row) => row.course_code === "ACCO 1031");

    expect(acco1031).toMatchObject({
      course_code: "ACCO 1031",
      status: "in_progress",
      term: "2026 Sprg",
    });
  });

  test("suggests SOCI matches for the unmatched transfer elective", () => {
    const result = parseSampleFixture();
    const unmatched = result.unmatched_rows[0];

    expect(unmatched.reason).toBe("not_in_catalog");
    expect(unmatched.source_text).toContain("SOCI | 9290");
    expect(unmatched.suggested_matches?.every((code) => code.startsWith("SOCI "))).toBe(true);
    expect(unmatched.suggested_matches?.length).toBeGreaterThan(0);
  });
});
