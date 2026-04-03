// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { RoadmapStep } from "../src/components/onboarding/RoadmapStep";
import { makeAppState, renderWithApp } from "./testUtils";

const { loadProgramBucketsSpy } = vi.hoisted(() => ({
  loadProgramBucketsSpy: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  loadProgramBuckets: loadProgramBucketsSpy,
}));

describe("RoadmapStep bucket map ordering", () => {
  test("renders MCC then BCC then majors then tracks then minors", async () => {
    loadProgramBucketsSpy.mockResolvedValue([
      {
        program_id: "ENTP_MINOR",
        program_label: "Entrepreneurship",
        type: "minor",
        buckets: [],
      },
      {
        program_id: "CB_TRACK",
        program_label: "Commercial Banking Track",
        type: "track",
        buckets: [],
      },
      {
        program_id: "FIN_MAJOR",
        program_label: "Finance",
        type: "major",
        buckets: [],
      },
      {
        program_id: "BCC_CORE",
        program_label: "Business Core",
        type: "universal",
        buckets: [],
      },
      {
        program_id: "MCC_FOUNDATION",
        program_label: "MCC Foundation",
        type: "universal",
        buckets: [],
      },
    ]);

    renderWithApp(
      createElement(RoadmapStep),
      makeAppState({
        selectedMajors: new Set(["FIN_MAJOR"]),
        selectedTracks: ["CB_TRACK"],
        selectedMinors: new Set(["ENTP_MINOR"]),
      }),
    );

    expect(await screen.findByText("MCC Foundation")).toBeInTheDocument();

    const columnHeadings = screen.getAllByRole("heading", { level: 4 }).map((node) => node.textContent);
    expect(columnHeadings).toEqual([
      "MCC Foundation",
      "Business Core",
      "Finance",
      "Commercial Banking Track",
      "Entrepreneurship",
    ]);
  });
});
