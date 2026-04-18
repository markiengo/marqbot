// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { FeedbackModal } from "../src/components/planner/FeedbackModal";
import { makeAppState, renderWithApp } from "./testUtils";

vi.mock("next/navigation", () => ({
  usePathname: () => "/planner",
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => createElement("div", props, children),
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => createElement("div", null, children),
  useReducedMotion: () => true,
}));

describe("FeedbackModal", () => {
  test("uses the shared planner action frame", async () => {
    renderWithApp(
      createElement(FeedbackModal, {
        open: true,
        onClose: vi.fn(),
        onSubmitted: vi.fn(),
      }),
      makeAppState(),
    );

    expect(await screen.findByRole("heading", { name: /send feedback/i })).toBeInTheDocument();
    expect(await screen.findByTestId("planner-action-frame")).toHaveStyle({
      height: "calc(77vh - 8rem)",
      minHeight: "400px",
    });
  });
});
