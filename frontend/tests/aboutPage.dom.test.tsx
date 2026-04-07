// @vitest-environment jsdom

import "./setupTests";

import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import AboutPage from "../src/app/about/page";
import { NowNextSection } from "../src/components/about/NowNextSection";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
}));

describe("AboutPage", () => {
  test("renders CTA navigation as links without nested buttons", () => {
    const { container } = render(createElement(AboutPage));

    expect(screen.getByRole("link", { name: /get my plan/i })).toHaveAttribute("href", "/onboarding");
    expect(screen.getByRole("link", { name: /send feedback/i })).toHaveAttribute("href", "mailto:markie.ngo@marquette.edu");
    expect(screen.getByRole("link", { name: /use the planner/i })).toHaveAttribute("href", "/planner");
    expect(container.querySelector("a button")).toBeNull();
  });

  test("shows the updated founder intro and github link", () => {
    render(createElement(AboutPage));

    expect(
      screen.getByText(/i'm a freshman studying information systems at marquette\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/i built this because i'm bored, and i hate picking courses each semester\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^here$/i })).toHaveAttribute(
      "href",
      "https://github.com/markiengo/marqbot",
    );
    expect(
      screen.getByText(/if not, enjoy the tool and give me feedback\./i),
    ).toBeInTheDocument();
  });

  test("lets keyboard users toggle roadmap cards", async () => {
    const user = userEvent.setup();

    render(createElement(NowNextSection));

    const card = screen.getByRole("button", { name: /semester offering awareness/i });

    expect(card).toHaveAttribute("aria-pressed", "false");

    card.focus();
    await user.keyboard("{Enter}");

    expect(card).toHaveFocus();
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText(/right now marqbot doesn.t always know when a course is offered\./i)).toBeInTheDocument();
  });
});
