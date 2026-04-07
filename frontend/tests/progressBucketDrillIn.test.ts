// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ProgressModal } from "../src/components/planner/ProgressModal";
import { SemesterModal } from "../src/components/planner/SemesterModal";
import type { BucketProgress, CreditKpiMetrics, SemesterData } from "../src/lib/types";
import { renderWithApp, makeAppState } from "./testUtils";

const { loadProgramBucketsSpy } = vi.hoisted(() => ({
  loadProgramBucketsSpy: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  loadProgramBuckets: loadProgramBucketsSpy,
}));

const state = makeAppState();

const baseMetrics: CreditKpiMetrics = {
  minGradCredits: 124,
  completedCredits: 12,
  inProgressCredits: 3,
  remainingCredits: 109,
  standingLabel: "Sophomore",
  donePercent: 10,
  inProgressPercent: 2,
  overallPercent: 12,
};

const courseCatalog = [
  { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
  { course_code: "FINA 3001", course_name: "Introduction to Financial Management", credits: 3, level: 3000 },
];

function makeBucketProgress(overrides: Partial<BucketProgress> = {}): BucketProgress {
  return {
    label: "MCC Core",
    needed: 4,
    needed_count: 4,
    completed_applied: ["ACCO 1030"],
    in_progress_applied: ["FINA 3001"],
    completed_done: 1,
    in_progress_increment: 1,
    completed_courses: 1,
    in_progress_courses: 1,
    requirement_mode: "required",
    ...overrides,
  };
}

describe("Progress bucket drill-in", () => {
  test("opens a bucket modal from current progress and forwards course clicks", async () => {
    const onCourseClick = vi.fn();

    renderWithApp(
      createElement(ProgressModal, {
        open: true,
        onClose: () => {},
        metrics: baseMetrics,
        currentProgress: { MCC_CORE: makeBucketProgress() },
        courses: courseCatalog,
        onCourseClick,
      }),
      state,
    );

    fireEvent.click(screen.getByRole("button", { name: /mcc core/i }));

    const bucketHeading = await screen.findByRole("heading", { name: /mcc core \(2\)/i });
    const bucketDialog = bucketHeading.closest('[role="dialog"]');
    expect(bucketDialog).not.toBeNull();

    const scoped = within(bucketDialog as HTMLElement);
    expect(scoped.getByText("Taken / Counted")).toBeInTheDocument();
    expect(scoped.getByText("In Progress")).toBeInTheDocument();

    fireEvent.click(scoped.getByRole("button", { name: /fina 3001/i }));

    expect(onCourseClick).toHaveBeenCalledWith("FINA 3001");
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /mcc core \(2\)/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /degree progress/i })).toBeInTheDocument();
  });

  test("opens the bucket map help from current progress", async () => {
    loadProgramBucketsSpy.mockResolvedValue([
      {
        program_id: "MCC_FOUNDATION",
        program_label: "MCC Foundation",
        type: "universal",
        buckets: [],
      },
      {
        program_id: "FIN_MAJOR",
        program_label: "Finance",
        type: "major",
        buckets: [],
      },
    ]);

    renderWithApp(
      createElement(ProgressModal, {
        open: true,
        onClose: () => {},
        metrics: baseMetrics,
        currentProgress: { MCC_CORE: makeBucketProgress() },
        courses: courseCatalog,
      }),
      makeAppState({
        selectedMajors: new Set(["FIN_MAJOR"]),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /open bucket map help/i }));

    expect(await screen.findByRole("heading", { name: /bucket map/i })).toBeInTheDocument();
    expect(await screen.findByText(/your degree is split into/i)).toBeInTheDocument();
  });

  test("escape closes only the topmost bucket modal and returns focus to the bucket card", async () => {
    renderWithApp(
      createElement(ProgressModal, {
        open: true,
        onClose: () => {},
        metrics: baseMetrics,
        currentProgress: { MCC_CORE: makeBucketProgress() },
        courses: courseCatalog,
      }),
      state,
    );

    const bucketButton = screen.getByRole("button", { name: /mcc core/i });
    bucketButton.focus();
    fireEvent.click(bucketButton);

    await screen.findByRole("heading", { name: /mcc core \(2\)/i });
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /mcc core \(2\)/i })).not.toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: /degree progress/i })).toBeInTheDocument();
    expect(bucketButton).toHaveFocus();
  });

  test("shows an empty state when no courses are counting in the bucket", async () => {
    renderWithApp(
      createElement(ProgressModal, {
        open: true,
        onClose: () => {},
        metrics: baseMetrics,
        currentProgress: {
          MCC_CORE: makeBucketProgress({
            completed_applied: [],
            in_progress_applied: [],
            completed_courses: 0,
            in_progress_courses: 0,
            completed_done: 0,
            in_progress_increment: 0,
          }),
        },
        courses: courseCatalog,
      }),
      state,
    );

    fireEvent.click(screen.getByRole("button", { name: /mcc core/i }));

    expect(await screen.findByText(/no courses are counting here yet/i)).toBeInTheDocument();
  });
});

describe("Projected bucket drill-in", () => {
  test("uses the projected progress view and labels yellow courses as planned", async () => {
    const semester: SemesterData = {
      target_semester: "Fall 2026",
      standing_label: "Sophomore",
      recommendations: [],
      projected_progress: {
        MCC_CORE: makeBucketProgress({
          completed_applied: [],
          in_progress_applied: ["FINA 3001"],
          completed_courses: 0,
          in_progress_courses: 1,
          completed_done: 0,
          in_progress_increment: 1,
        }),
      },
      projection_note: "Preview of progress after this semester.",
    };

    renderWithApp(
      createElement(SemesterModal, {
        open: true,
        onClose: () => {},
        semester,
        index: 0,
        totalCount: 1,
        requestedCount: 3,
        courses: courseCatalog,
      }),
      state,
    );

    fireEvent.click(screen.getByRole("button", { name: /mcc core/i }));

    const bucketHeading = await screen.findByRole("heading", { name: /mcc core \(1\)/i });
    const bucketDialog = bucketHeading.closest('[role="dialog"]');
    expect(bucketDialog).not.toBeNull();
    expect(within(bucketDialog as HTMLElement).getByText("In Progress / Planned")).toBeInTheDocument();
    expect(within(bucketDialog as HTMLElement).queryByText("Taken / Counted")).not.toBeInTheDocument();
  });

  test("opens the bucket map help from projected progress", async () => {
    loadProgramBucketsSpy.mockResolvedValue([
      {
        program_id: "MCC_FOUNDATION",
        program_label: "MCC Foundation",
        type: "universal",
        buckets: [],
      },
      {
        program_id: "CB_TRACK",
        program_label: "Commercial Banking Track",
        type: "track",
        buckets: [],
      },
    ]);

    const semester: SemesterData = {
      target_semester: "Fall 2026",
      standing_label: "Sophomore",
      recommendations: [],
      projected_progress: {
        MCC_CORE: makeBucketProgress({
          completed_applied: [],
          in_progress_applied: ["FINA 3001"],
          completed_courses: 0,
          in_progress_courses: 1,
          completed_done: 0,
          in_progress_increment: 1,
        }),
      },
      projection_note: "Preview of progress after this semester.",
    };

    renderWithApp(
      createElement(SemesterModal, {
        open: true,
        onClose: () => {},
        semester,
        index: 0,
        totalCount: 1,
        requestedCount: 3,
        courses: courseCatalog,
      }),
      makeAppState({
        selectedMajors: new Set(["FIN_MAJOR"]),
        selectedTracks: ["CB_TRACK"],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /open bucket map help/i }));

    expect(await screen.findByRole("heading", { name: /bucket map/i })).toBeInTheDocument();
    expect(await screen.findByText(/your degree is split into/i)).toBeInTheDocument();
  });
});
