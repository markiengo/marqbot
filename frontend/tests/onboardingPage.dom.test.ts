// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import OnboardingPage from "../src/app/onboarding/page";
import { renderWithApp, makeAppState } from "./testUtils";

const { pushSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushSpy,
  }),
}));

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
    { id: "DISC_BUSINESS", label: "Business Analytics", parent_major_id: "MCC_DISC" },
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

    expect(screen.getByText(/loading your data/i)).toBeInTheDocument();
    expect(
      screen.getByText(/pulling 5,300\+ courses/i),
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

    const nextToClasses = screen.getByRole("button", { name: /next: add courses/i });
    expect(nextToClasses).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/search majors/i), "fin");
    await user.click(await screen.findByRole("option", { name: /^finance$/i }));

    expect(nextToClasses).toBeEnabled();

    await user.click(nextToClasses);
    expect(
      await screen.findByRole("heading", { name: /add what you have right now/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next: preferences/i }));
    const studentStageSelect = await screen.findByRole("combobox", { name: /student stage/i });
    expect(studentStageSelect).toHaveValue("undergrad");
    expect(studentStageSelect.className).toContain("onboarding-input");
    expect(studentStageSelect.className).toContain("onboarding-select");

    await user.selectOptions(studentStageSelect, "graduate");
    expect(studentStageSelect).toHaveValue("graduate");

    await user.click(screen.getByRole("button", { name: /show my plan/i }));
    expect(pushSpy).toHaveBeenCalledWith("/planner");
  });

  test("uses onboarding dark select styling for native dropdowns", async () => {
    const user = userEvent.setup();
    const state = makeAppState({
      courses: baseCourses,
      programs: basePrograms,
      coursesLoadStatus: "ready",
      programsLoadStatus: "ready",
    });

    renderWithApp(createElement(OnboardingPage), state);

    // Select a major first so the discovery theme dropdown becomes visible
    await user.type(screen.getByPlaceholderText(/search majors/i), "fin");
    await user.click(await screen.findByRole("option", { name: /^finance$/i }));

    const discoveryThemeSelect = await screen.findByDisplayValue("No theme selected");
    expect(discoveryThemeSelect.className).toContain("onboarding-input");
    expect(discoveryThemeSelect.className).toContain("onboarding-select");
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
    await user.click(await screen.findByRole("option", { name: /discovery/i }));

    expect(screen.getByRole("button", { name: /next: add courses/i })).toBeDisabled();
    expect(screen.getAllByText(/still needs a primary major/i).length).toBeGreaterThan(0);
  });
});
