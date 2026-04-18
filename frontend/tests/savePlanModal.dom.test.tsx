// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SavePlanModal } from "../src/components/saved/SavePlanModal";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => createElement("div", null, children),
  useReducedMotion: () => true,
}));

describe("SavePlanModal", () => {
  test("defaults to save as new, uses the shared planner frame, and can switch to overwrite with prefills", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      createElement(SavePlanModal, {
        open: true,
        onClose: vi.fn(),
        defaultName: "Data Science Plan",
        existingPlans: [
          {
            id: "plan-1",
            name: "Finance Draft",
            notes: "Original finance notes",
            updatedAt: "2026-04-01T10:00:00.000Z",
            programLine: "Finance",
            targetSemester: "Fall 2026",
          },
          {
            id: "plan-2",
            name: "DS + INSY",
            notes: "More aggressive version",
            updatedAt: "2026-04-02T10:00:00.000Z",
            programLine: "Data Science / Information Systems",
            targetSemester: "Spring 2027",
          },
        ],
        onSave,
        error: null,
      }),
    );

    expect(await screen.findByRole("heading", { name: /save plan/i })).toBeInTheDocument();
    expect(await screen.findByTestId("planner-action-frame")).toHaveStyle({
      height: "calc(77vh - 8rem)",
      minHeight: "400px",
    });

    expect(screen.getByRole("button", { name: /save as new/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByDisplayValue("Data Science Plan")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /saved plan to overwrite/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /overwrite existing/i }));

    const overwriteSelect = screen.getByRole("combobox", { name: /saved plan to overwrite/i });
    expect(overwriteSelect).toBeInTheDocument();
    expect(screen.getByDisplayValue("Finance Draft")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original finance notes")).toBeInTheDocument();

    await user.selectOptions(overwriteSelect, "plan-2");
    expect(screen.getByDisplayValue("DS + INSY")).toBeInTheDocument();
    expect(screen.getByDisplayValue("More aggressive version")).toBeInTheDocument();

    const textboxes = screen.getAllByRole("textbox");
    await user.clear(textboxes[0]);
    await user.type(textboxes[0], "DS + INSY Final");
    await user.clear(textboxes[1]);
    await user.type(textboxes[1], "Overwrite this exact snapshot");

    await user.click(screen.getByRole("button", { name: /overwrite plan/i }));

    expect(onSave).toHaveBeenCalledWith({
      mode: "overwrite",
      targetPlanId: "plan-2",
      name: "DS + INSY Final",
      notes: "Overwrite this exact snapshot",
    });
  });

  test("disables overwrite mode when there are no saved plans", async () => {
    render(
      createElement(SavePlanModal, {
        open: true,
        onClose: vi.fn(),
        defaultName: "New Plan",
        existingPlans: [],
        onSave: vi.fn(),
        error: null,
      }),
    );

    expect(await screen.findByTestId("planner-action-frame")).toHaveStyle({
      height: "calc(77vh - 8rem)",
      minHeight: "400px",
    });
    expect(screen.getByRole("button", { name: /overwrite existing/i })).toBeDisabled();
    expect(screen.getByText(/no saved plans are available to overwrite yet/i)).toBeInTheDocument();
  });
});
