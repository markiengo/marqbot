// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { CoursesStep } from "../src/components/onboarding/CoursesStep";
import { renderWithApp, makeAppState } from "./testUtils";
import { postValidatePrereqs } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  postValidatePrereqs: vi.fn(),
}));

describe("CoursesStep prereq validation", () => {
  beforeEach(() => {
    vi.mocked(postValidatePrereqs).mockReset();
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
});
