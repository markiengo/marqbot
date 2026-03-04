// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithApp, makeAppState } from "./testUtils";

const { pushSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
  }),
}));

const { default: OnboardingPage } = await import("../../frontend/src/app/onboarding/page");

const baseCourses = [
  { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
  { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
  { course_code: "MARK 3001", course_name: "Marketing", credits: 3, level: 3000 },
];

const basePrograms = {
  majors: [
    { id: "FIN_MAJOR", label: "Finance", requires_primary_major: false },
    { id: "MCC_DISC", label: "Discovery", requires_primary_major: true },
  ],
  tracks: [
    { id: "FIN_ANALYTICS_TRACK", label: "Finance Analytics", parent_major_id: "FIN_MAJOR" },
  ],
  minors: [],
  default_track_id: "FIN_MAJOR",
};

describe("OnboardingPage component flow", () => {
  beforeEach(() => {
    pushSpy.mockReset();
  });

  test("shows a loading state while onboarding bootstrap is still loading", () => {
    const state = makeAppState({
      courses: [],
      programs: { majors: [], tracks: [], minors: [], default_track_id: "" },
      coursesLoadStatus: "loading",
      programsLoadStatus: "loading",
    });

    renderWithApp(createElement(OnboardingPage), state);

    expect(screen.getByText(/getting your setup ready/i)).toBeInTheDocument();
    expect(
      screen.getByText(/pulling courses and programs so your plan starts with real data/i),
    ).toBeInTheDocument();
  });

  test("walks a student from major selection to planner launch", async () => {
    const user = userEvent.setup();
    const state = makeAppState({
      courses: baseCourses,
      programs: basePrograms,
      coursesLoadStatus: "ready",
      programsLoadStatus: "ready",
    });

    renderWithApp(createElement(OnboardingPage), state);

    const nextToClasses = screen.getByRole("button", { name: /next: classes/i });
    expect(nextToClasses).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/search majors/i), "fin");
    await user.click(await screen.findByRole("option", { name: /^finance$/i }));

    expect(nextToClasses).toBeEnabled();

    await user.click(nextToClasses);
    expect(
      await screen.findByRole("heading", { name: /add what you've already finished/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next: plan/i }));
    expect(
      await screen.findByRole("heading", { name: /tell marqbot what kind of plan you want/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show my plan/i }));
    expect(pushSpy).toHaveBeenCalledWith("/planner");
  });

  test("blocks progress when only a secondary program is selected", async () => {
    const user = userEvent.setup();
    const state = makeAppState({
      courses: baseCourses,
      programs: basePrograms,
      coursesLoadStatus: "ready",
      programsLoadStatus: "ready",
    });

    renderWithApp(createElement(OnboardingPage), state);

    await user.type(screen.getByPlaceholderText(/search majors/i), "disc");
    await user.click(await screen.findByRole("option", { name: /^discovery$/i }));

    expect(screen.getByRole("button", { name: /next: classes/i })).toBeDisabled();
    expect(screen.getByText(/that program cannot stand alone/i)).toBeInTheDocument();
  });
});
