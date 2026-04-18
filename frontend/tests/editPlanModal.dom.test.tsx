// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { EditPlanModal } from "../src/components/planner/EditPlanModal";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => createElement("div", null, children),
  useReducedMotion: () => true,
}));

describe("EditPlanModal", () => {
  test("uses the shared planner action frame and opens the selected semester for editing", async () => {
    const user = userEvent.setup();
    const onEditSemester = vi.fn();

    render(
      createElement(EditPlanModal, {
        open: true,
        onClose: vi.fn(),
        onEditSemester,
        semesters: [
          {
            target_semester: "Fall 2026",
            recommendations: [
              { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 },
            ],
            eligible_count: 6,
          },
        ],
      }),
    );

    expect(await screen.findByRole("heading", { name: /edit plan/i })).toBeInTheDocument();
    expect(await screen.findByTestId("planner-action-frame")).toHaveStyle({
      height: "calc(77vh - 8rem)",
      minHeight: "400px",
    });

    await user.click(screen.getByRole("button", { name: /semester 1/i }));
    await user.click(screen.getByRole("button", { name: /edit this semester/i }));

    expect(onEditSemester).toHaveBeenCalledWith(0);
  });
});
