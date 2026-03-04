// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithApp, makeAppState } from "./testUtils";
import { postValidatePrereqs } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  postValidatePrereqs: vi.fn(),
}));

const { CoursesStep } = await import("../../frontend/src/components/onboarding/CoursesStep");

describe("CoursesStep prereq validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(postValidatePrereqs).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });

    expect(await screen.findByText(/something looks off/i)).toBeInTheDocument();
    expect(screen.getByText(/fina 3001/i)).toBeInTheDocument();
    expect(screen.getByText(/acco 1030/i)).toBeInTheDocument();
    expect(onWarningChange).toHaveBeenCalledWith(true);
  });
});
