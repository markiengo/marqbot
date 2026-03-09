// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SemesterModal } from "../src/components/planner/SemesterModal";

describe("SemesterModal balance policy notes", () => {
  test("renders balance-policy chips from semester metadata", () => {
    render(
      createElement(SemesterModal, {
        open: true,
        onClose: () => {},
        semester: {
          target_semester: "Fall 2026",
          standing_label: "Sophomore",
          recommendations: [
            {
              course_code: "FINA 3001",
              course_name: "Finance Core",
              credits: 3,
              fills_buckets: ["FIN_MAJOR::FIN_CORE"],
            },
          ],
          eligible_count: 1,
          balance_policy: {
            declared_min_achieved: 1,
            declared_min_relaxed: false,
            family_cap_relaxed: true,
          },
        },
        index: 0,
        requestedCount: 5,
      }),
    );

    expect(screen.getByText("Major or track progress prioritized")).toBeInTheDocument();
    expect(screen.getByText("Family balance relaxed because the pool was thin")).toBeInTheDocument();
    expect(screen.queryByText("Limited major or track options this term")).not.toBeInTheDocument();
  });
});
