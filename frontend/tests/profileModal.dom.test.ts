// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ProfileModal } from "../src/components/planner/ProfileModal";
import { makeAppState, renderWithApp } from "./testUtils";

describe("ProfileModal recommendation submit flow", () => {
  test("uses the shared planner action frame", async () => {
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

    expect(await screen.findByRole("heading", { name: /edit profile/i })).toBeInTheDocument();
    expect(await screen.findByTestId("planner-action-frame")).toHaveStyle({
      height: "calc(77vh - 8rem)",
      minHeight: "400px",
    });
  });

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

  test("renders the onboarding preferences layout in profile edit", async () => {
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

    await user.click(screen.getByRole("button", { name: /preferences/i }));

    expect(
      await screen.findByText(/1 for next term, or up to 5 to plan ahead\./i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/unlocks honors sections in recommendations\./i)).not.toBeInTheDocument();
    expect(screen.queryByText(/includes summer terms in your plan\./i)).not.toBeInTheDocument();

    const selector = await screen.findByLabelText(/student stage/i);
    expect(selector).toHaveValue("undergrad");

    await user.selectOptions(selector, "doctoral");
    expect(selector).toHaveValue("doctoral");
  });

  test("matches majors by subject code aliases in profile edit search", async () => {
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
        programs: {
          majors: [
            { id: "FIN_MAJOR", label: "Finance", requires_primary_major: false },
            {
              id: "OSCM_MAJOR",
              label: "Operations & Supply Chain Management",
              requires_primary_major: false,
            },
          ],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
        },
      }),
    );

    await user.type(screen.getByPlaceholderText(/search majors/i), "oscm");

    expect(
      await screen.findByRole("option", { name: /^operations & supply chain management$/i }),
    ).toBeInTheDocument();
  });
});
