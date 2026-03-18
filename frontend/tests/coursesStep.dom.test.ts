// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CoursesStep } from "../src/components/onboarding/CoursesStep";
import { renderWithApp, makeAppState } from "./testUtils";
import { postImportCourseHistory, postValidatePrereqs } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  postImportCourseHistory: vi.fn(),
  postValidatePrereqs: vi.fn(),
}));

describe("CoursesStep prereq validation", () => {
  beforeEach(() => {
    vi.mocked(postImportCourseHistory).mockReset();
    vi.mocked(postValidatePrereqs).mockReset();
    vi.mocked(postValidatePrereqs).mockResolvedValue({ inconsistencies: [] });
  });

  test("surfaces prereq inconsistencies and notifies the parent warning state", async () => {
    const onWarningChange = vi.fn();
    vi.mocked(postValidatePrereqs).mockResolvedValue({
      inconsistencies: [
        {
          course_code: "FINA 3001",
          prereqs_in_progress: ["ACCO 1030"],
        },
      ],
    });

    const state = makeAppState({
      courses: [
        { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
        { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
      ],
      completed: new Set(["FINA 3001"]),
      inProgress: new Set(["ACCO 1030"]),
    });

    renderWithApp(createElement(CoursesStep, { onWarningChange }), state);

    const warning = await screen.findByText(/prereq mismatch/i);
    const warningCard = warning.closest("div");

    expect(warning).toBeInTheDocument();
    expect(warningCard).not.toBeNull();
    expect(within(warningCard as HTMLDivElement).getByText(/^FINA 3001$/i)).toBeInTheDocument();
    expect(within(warningCard as HTMLDivElement).getByText(/ACCO 1030/i)).toBeInTheDocument();
    await waitFor(() => expect(onWarningChange).toHaveBeenCalledWith(true));
  });

  test("renders the screenshot import card and tutorial", () => {
    const state = makeAppState({
      courses: [
        { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
      ],
    });

    renderWithApp(createElement(CoursesStep), state);

    expect(screen.getByText(/screenshot import/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload screenshot/i })).toBeInTheDocument();
    expect(screen.getByText(/review what marqbot matched/i)).toBeInTheDocument();
  });

  test("reviews parsed rows and applies imported courses into onboarding state", async () => {
    const user = userEvent.setup();
    vi.mocked(postImportCourseHistory).mockResolvedValue({
      completed_matches: [
        {
          course_code: "ACCO 1030",
          source_text: "ACCO | 1030 | Financial Accounting | 2025 Fall | A",
          term: "2025 Fall",
          status: "completed",
          confidence: 0.94,
        },
      ],
      in_progress_matches: [
        {
          course_code: "FINA 3001",
          source_text: "FINA | 3001 | Intro to Financial Management | 2026 Sum | IP",
          term: "2026 Sum",
          status: "in_progress",
          confidence: 0.9,
        },
      ],
      unmatched_rows: [
        {
          source_text: "MYST | 1001 | Mystery Course | 2026 Fall | A",
          term: "2026 Fall",
          status: "completed",
          suggested_matches: ["ECON 1103"],
          confidence: 0.4,
          reason: "not_in_catalog",
        },
      ],
      ignored_rows: [
        {
          source_text: "ECON | 1103 | Principles of Microeconomics | 2025 Fall | W",
          term: "2025 Fall",
          status: "ignored",
          confidence: 0.82,
          reason: "withdrawn",
        },
      ],
      summary: {
        completed_count: 1,
        in_progress_count: 1,
        unmatched_count: 1,
        ignored_count: 1,
        total_rows: 4,
      },
    });

    const state = makeAppState({
      courses: [
        { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
        { course_code: "ECON 1103", course_name: "Principles of Microeconomics", credits: 3, level: 1000 },
        { course_code: "FINA 3001", course_name: "Intro to Financial Management", credits: 3, level: 3000 },
      ],
    });

    const { container } = renderWithApp(createElement(CoursesStep), state);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake-image"], "coursehistory.jpg", { type: "image/jpeg" });

    await user.upload(fileInput, file);

    expect(await screen.findByText(/resolve the rows marqbot won't auto-apply/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /econ 1103/i }));
    await user.click(screen.getByRole("button", { name: /apply imported courses/i }));

    await screen.findByText(/imported 2 completed and 1 in-progress courses/i);
    await waitFor(() => {
      expect(vi.mocked(postValidatePrereqs)).toHaveBeenLastCalledWith({
        completed_courses: "ACCO 1030, ECON 1103",
        in_progress_courses: "FINA 3001",
      });
    });
  });

  test("shows an inline failure state when screenshot import fails", async () => {
    const user = userEvent.setup();
    vi.mocked(postImportCourseHistory).mockRejectedValue(new Error("Parser offline"));

    const state = makeAppState({
      courses: [
        { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
      ],
    });

    const { container } = renderWithApp(createElement(CoursesStep), state);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["fake-image"], "coursehistory.jpg", { type: "image/jpeg" });

    await user.upload(fileInput, file);

    expect(await screen.findByText(/parser offline/i)).toBeInTheDocument();
    expect(screen.getByText(/retry or keep entering classes manually/i)).toBeInTheDocument();
  });
});
