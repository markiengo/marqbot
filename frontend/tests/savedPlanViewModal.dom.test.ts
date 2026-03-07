// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SavedPlanViewModal } from "../src/components/saved/SavedPlanViewModal";
import { makeAppState, renderWithApp } from "./testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("SavedPlanViewModal delete confirmation", () => {
  test("requires confirmation before deleting a saved plan", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    renderWithApp(
      createElement(SavedPlanViewModal, {
        open: true,
        plan: {
          id: "plan-1",
          name: "Finance Sprint",
          notes: "Recruiting semester",
          createdAt: "2026-03-01T10:00:00.000Z",
          updatedAt: "2026-03-02T10:00:00.000Z",
          inputs: {
            completed: ["ACCO 1030"],
            inProgress: [],
            declaredMajors: ["FIN_MAJOR"],
            declaredTracks: [],
            declaredMinors: [],
            discoveryTheme: "",
            targetSemester: "Fall 2026",
            semesterCount: "4",
            maxRecs: "5",
            includeSummer: false,
          },
          recommendationData: {
            mode: "recommendations",
            semesters: [
              {
                target_semester: "Fall 2026",
                standing_label: "Sophomore",
                recommendations: [
                  { course_code: "FINA 3001", course_name: "Financial Management", credits: 3 },
                ],
              },
            ],
          },
          lastRequestedCount: 5,
          inputHash: "abc",
          resultsInputHash: "abc",
          lastGeneratedAt: "2026-03-02T10:00:00.000Z",
        },
        freshness: "fresh",
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
          { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
        ],
        programs: {
          majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
          tracks: [],
          minors: [],
          default_track_id: "FIN_MAJOR",
          bucket_labels: {},
        },
        onClose: vi.fn(),
        onDelete,
      }),
      makeAppState(),
    );

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /are you sure/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep plan/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yes, delete plan/i }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });
});
