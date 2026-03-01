import { describe, expect, test } from "vitest";

import { getProgressQuip, getSemesterQuip } from "../../frontend/src/lib/quips";
import type { CreditKpiMetrics, BucketProgress, SemesterData } from "../../frontend/src/lib/types";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function makeMetrics(overrides: Partial<CreditKpiMetrics> = {}): CreditKpiMetrics {
  return {
    minGradCredits: 124,
    completedCredits: 60,
    inProgressCredits: 15,
    remainingCredits: 49,
    standingLabel: "Junior Standing",
    donePercent: 48.4,
    inProgressPercent: 12.1,
    overallPercent: 60.5,
    ...overrides,
  };
}

function makeSemester(overrides: Partial<SemesterData> = {}): SemesterData {
  return {
    target_semester: "Fall 2026",
    standing_label: "Junior",
    recommendations: [
      { course_code: "FINA 3001", credits: 3, fills_buckets: ["FIN_MAJOR::CORE"] },
      { course_code: "ACCT 3001", credits: 3, fills_buckets: ["ACCO_MAJOR::CORE"] },
      { course_code: "BUAD 3100", credits: 3, fills_buckets: ["BCC::BUAD", "MCC::ETHICS"] },
    ],
    eligible_count: 5,
    ...overrides,
  };
}

/* ── getProgressQuip ─────────────────────────────────────────────────────── */

describe("quips.getProgressQuip", () => {
  test("returns a non-empty string", () => {
    const quip = getProgressQuip({ metrics: makeMetrics(), currentProgress: null });
    expect(typeof quip).toBe("string");
    expect(quip.length).toBeGreaterThan(0);
  });

  test("returns same quip for same inputs (deterministic)", () => {
    const input = { metrics: makeMetrics(), currentProgress: null };
    const a = getProgressQuip(input);
    const b = getProgressQuip(input);
    expect(a).toBe(b);
  });

  test("returns different quip when data changes", () => {
    const a = getProgressQuip({
      metrics: makeMetrics({ donePercent: 10, standingLabel: "Freshman Standing", remainingCredits: 110 }),
      currentProgress: null,
    });
    const b = getProgressQuip({
      metrics: makeMetrics({ donePercent: 92, standingLabel: "Senior Standing", remainingCredits: 10 }),
      currentProgress: null,
    });
    expect(a).not.toBe(b);
  });

  test("handles freshman with early progress", () => {
    const quip = getProgressQuip({
      metrics: makeMetrics({
        completedCredits: 6,
        inProgressCredits: 12,
        remainingCredits: 106,
        standingLabel: "Freshman Standing",
        donePercent: 4.8,
      }),
      currentProgress: null,
    });
    expect(quip.length).toBeGreaterThan(0);
    expect(quip.length).toBeLessThanOrEqual(120);
  });

  test("handles senior near completion", () => {
    const quip = getProgressQuip({
      metrics: makeMetrics({
        completedCredits: 115,
        inProgressCredits: 9,
        remainingCredits: 0,
        standingLabel: "Senior Standing",
        donePercent: 92.7,
      }),
      currentProgress: null,
    });
    expect(quip.length).toBeGreaterThan(0);
    expect(quip.length).toBeLessThanOrEqual(120);
  });

  test("handles 100% completion with all buckets satisfied", () => {
    const progress: Record<string, BucketProgress> = {
      "MCC::CORE": { needed: 12, completed_done: 12, satisfied: true },
      "BCC::BUAD": { needed: 9, completed_done: 9, satisfied: true },
    };
    const quip = getProgressQuip({
      metrics: makeMetrics({ donePercent: 100, remainingCredits: 0 }),
      currentProgress: progress,
    });
    expect(quip.length).toBeGreaterThan(0);
  });

  test("quip never exceeds 120 characters", () => {
    const scenarios = [
      { donePercent: 0, standingLabel: "Freshman Standing", remainingCredits: 124 },
      { donePercent: 30, standingLabel: "Sophomore Standing", remainingCredits: 87 },
      { donePercent: 50, standingLabel: "Junior Standing", remainingCredits: 62 },
      { donePercent: 75, standingLabel: "Senior Standing", remainingCredits: 31 },
      { donePercent: 95, standingLabel: "Senior Standing", remainingCredits: 6 },
      { donePercent: 100, standingLabel: "Senior Standing", remainingCredits: 0 },
    ];
    for (const s of scenarios) {
      const quip = getProgressQuip({ metrics: makeMetrics(s), currentProgress: null });
      expect(quip.length).toBeLessThanOrEqual(120);
    }
  });
});

/* ── getSemesterQuip ─────────────────────────────────────────────────────── */

describe("quips.getSemesterQuip", () => {
  test("returns a non-empty string", () => {
    const quip = getSemesterQuip({ semester: makeSemester(), index: 0, requestedCount: 5 });
    expect(typeof quip).toBe("string");
    expect(quip.length).toBeGreaterThan(0);
  });

  test("returns same quip for same inputs (deterministic)", () => {
    const input = { semester: makeSemester(), index: 0, requestedCount: 5 };
    const a = getSemesterQuip(input);
    const b = getSemesterQuip(input);
    expect(a).toBe(b);
  });

  test("returns different quip for different semester index", () => {
    const semester = makeSemester();
    const a = getSemesterQuip({ semester, index: 0, requestedCount: 5 });
    const b = getSemesterQuip({ semester, index: 3, requestedCount: 5 });
    expect(a).not.toBe(b);
  });

  test("handles summer semester", () => {
    const quip = getSemesterQuip({
      semester: makeSemester({ target_semester: "Summer 2026" }),
      index: 2,
      requestedCount: 3,
    });
    expect(quip.length).toBeGreaterThan(0);
    expect(quip.length).toBeLessThanOrEqual(120);
  });

  test("handles empty recommendations", () => {
    const quip = getSemesterQuip({
      semester: makeSemester({ recommendations: [] }),
      index: 0,
      requestedCount: 5,
    });
    expect(quip.length).toBeGreaterThan(0);
  });

  test("handles deep semester index", () => {
    const quip = getSemesterQuip({
      semester: makeSemester(),
      index: 7,
      requestedCount: 5,
    });
    expect(quip.length).toBeGreaterThan(0);
  });

  test("handles heavy load with warnings", () => {
    const quip = getSemesterQuip({
      semester: makeSemester({
        recommendations: [
          { course_code: "A", credits: 3, fills_buckets: ["X"], warning_text: "prereq issue" },
          { course_code: "B", credits: 3, fills_buckets: ["Y"], soft_tags: ["standing_requirement"] },
          { course_code: "C", credits: 3, fills_buckets: ["Z"] },
          { course_code: "D", credits: 3, fills_buckets: ["W"] },
          { course_code: "E", credits: 3, fills_buckets: ["V"] },
        ],
      }),
      index: 1,
      requestedCount: 5,
    });
    expect(quip.length).toBeGreaterThan(0);
  });

  test("quip never exceeds 120 characters", () => {
    const scenarios = [
      { index: 0, target_semester: "Fall 2025" },
      { index: 2, target_semester: "Summer 2026" },
      { index: 4, target_semester: "Spring 2027" },
      { index: 7, target_semester: "Fall 2028" },
    ];
    for (const s of scenarios) {
      const quip = getSemesterQuip({
        semester: makeSemester({ target_semester: s.target_semester }),
        index: s.index,
        requestedCount: 5,
      });
      expect(quip.length).toBeLessThanOrEqual(120);
    }
  });
});

/* ── fallback ────────────────────────────────────────────────────────────── */

describe("quips fallback", () => {
  test("getProgressQuip returns a string even with minimal data", () => {
    const quip = getProgressQuip({
      metrics: {
        minGradCredits: 124,
        completedCredits: 0,
        inProgressCredits: 0,
        remainingCredits: 124,
        standingLabel: "",
        donePercent: 0,
        inProgressPercent: 0,
        overallPercent: 0,
      },
      currentProgress: null,
    });
    expect(typeof quip).toBe("string");
    expect(quip.length).toBeGreaterThan(0);
  });

  test("getSemesterQuip returns a string even with minimal data", () => {
    const quip = getSemesterQuip({
      semester: { recommendations: [] } as unknown as SemesterData,
      index: 0,
      requestedCount: 0,
    });
    expect(typeof quip).toBe("string");
    expect(quip.length).toBeGreaterThan(0);
  });
});
