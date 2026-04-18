// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { PlannerPrioritiesModal } from "../src/components/planner/PlannerPrioritiesModal";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => createElement("div", null, children),
  useReducedMotion: () => true,
}));

describe("PlannerPrioritiesModal", () => {
  test("uses the shared planner action frame and forwards apply actions", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onStyleChange = vi.fn();

    render(
      createElement(PlannerPrioritiesModal, {
        open: true,
        onClose: vi.fn(),
        currentStyle: "grinder",
        appliedStyle: "explorer",
        onStyleChange,
        onApply,
        isApplying: false,
      }),
    );

    expect(await screen.findByRole("heading", { name: /change your priorities/i })).toBeInTheDocument();
    expect(await screen.findByTestId("planner-action-frame")).toHaveStyle({
      height: "calc(77vh - 8rem)",
      minHeight: "400px",
    });

    await user.click(screen.getByRole("button", { name: /explorer/i }));
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(onStyleChange).toHaveBeenCalledWith("explorer");
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
