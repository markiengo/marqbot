// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { FeedbackModal } from "../src/components/planner/FeedbackModal";
import { makeAppState, renderWithApp } from "./testUtils";

vi.mock("next/navigation", () => ({
  usePathname: () => "/planner",
}));

vi.mock("@/components/shared/Modal", () => ({
  Modal: ({ open, title, size, children }: any) => (
    open
      ? createElement(
        "div",
        { "data-testid": "modal-shell", "data-size": size ?? "default" },
        title ? createElement("h1", null, title) : null,
        children,
      )
      : null
  ),
}));

describe("FeedbackModal", () => {
  test("uses the planner-detail modal shell", () => {
    renderWithApp(
      createElement(FeedbackModal, {
        open: true,
        onClose: vi.fn(),
        onSubmitted: vi.fn(),
      }),
      makeAppState(),
    );

    expect(screen.getByTestId("modal-shell")).toHaveAttribute("data-size", "planner-detail");
    expect(screen.getByRole("heading", { name: /send feedback/i })).toBeInTheDocument();
  });
});
