// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ProfileModal } from "../src/components/planner/ProfileModal";
import { makeAppState, renderWithApp } from "./testUtils";

describe("ProfileModal recommendation submit flow", () => {
  test("keeps the modal open when refreshing recommendations fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmitRecommendations = vi.fn().mockResolvedValue(null);

    renderWithApp(
      createElement(ProfileModal, {
        open: true,
        onClose,
        loading: false,
        error: "Some completed courses have prerequisites that are still in-progress.",
        onSubmitRecommendations,
      }),
      makeAppState({
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
        ],
        selectedMajors: new Set(["FIN_MAJOR"]),
        programs: {
          majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /get my plan/i }));

    await waitFor(() => expect(onSubmitRecommendations).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/still in-progress/i)).toBeInTheDocument();
  });

  test("closes the modal after recommendations refresh successfully", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmitRecommendations = vi.fn().mockResolvedValue({ mode: "recommendations" });

    renderWithApp(
      createElement(ProfileModal, {
        open: true,
        onClose,
        loading: false,
        error: null,
        onSubmitRecommendations,
      }),
      makeAppState({
        selectedMajors: new Set(["FIN_MAJOR"]),
        programs: {
          majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /get my plan/i }));

    await waitFor(() => expect(onSubmitRecommendations).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  test("renders the student stage selector in profile edit", async () => {
    const user = userEvent.setup();

    renderWithApp(
      createElement(ProfileModal, {
        open: true,
        onClose: vi.fn(),
        loading: false,
        error: null,
        onSubmitRecommendations: vi.fn().mockResolvedValue(null),
      }),
      makeAppState({
        selectedMajors: new Set(["FIN_MAJOR"]),
        programs: {
          majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
        },
      }),
    );

    const selector = screen.getByRole("combobox", { name: /student stage/i });
    expect(selector).toHaveValue("undergrad");

    await user.selectOptions(selector, "doctoral");
    expect(selector).toHaveValue("doctoral");
  });
});
