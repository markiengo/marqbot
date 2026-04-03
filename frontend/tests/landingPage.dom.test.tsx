// @vitest-environment jsdom

import "./setupTests";

import { createElement, Fragment, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import LandingPage from "../src/app/page";
import { Navbar } from "../src/components/layout/Navbar";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function renderLanding() {
  return render(
    createElement(
      Fragment,
      null,
      createElement(Navbar),
      createElement(LandingPage),
    ),
  );
}

function expectBefore(first: HTMLElement, second: HTMLElement) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
}

describe("LandingPage", () => {
  test("renders the merged landing flow in the expected order with route-based home nav", () => {
    const { container } = renderLanding();

    const nav = screen.getByRole("navigation", { name: /primary/i });
    const hero = screen.getByTestId("landing-hero");
    const story = screen.getByTestId("landing-story");
    const features = screen.getByTestId("landing-features");
    const proof = screen.getByTestId("landing-proof");
    const faq = screen.getByTestId("landing-faq");
    const finalCta = screen.getByTestId("landing-final-cta");

    expect(within(nav).getByRole("link", { name: /^home$/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /planner/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /saved/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /courses/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /ai advisor/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /^about$/i })).toBeInTheDocument();
    expect(within(nav).queryByText(/overview/i)).not.toBeInTheDocument();

    expect(screen.getAllByRole("link", { name: /get my plan/i }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole("link", { name: /see how it works/i })).toBeInTheDocument();
    expect(within(faq).getByRole("link", { name: /about marqbot/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /from context to plan\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /built on the actual rules\./i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /plan your semesters\.\s*close the tabs\./i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /see planner proof/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("marketing-footer")).toBeInTheDocument();
    expect(container.querySelector("a button")).toBeNull();

    expectBefore(hero, story);
    expectBefore(story, features);
    expectBefore(features, proof);
    expectBefore(proof, faq);
    expectBefore(faq, finalCta);
  });

  test("uses a single-open accordion pattern for the faq", () => {
    renderLanding();

    const official = screen.getByRole("button", { name: /is marqbot official\?/i });
    const accuracy = screen.getByRole("button", { name: /how accurate are the recommendations\?/i });
    const officialPanel = document.getElementById("faq-panel-official");
    const accuracyPanel = document.getElementById("faq-panel-accuracy");

    expect(official).toHaveAttribute("aria-expanded", "true");
    expect(accuracy).toHaveAttribute("aria-expanded", "false");
    expect(officialPanel).not.toHaveAttribute("hidden");
    expect(accuracyPanel).toHaveAttribute("hidden");

    fireEvent.click(accuracy);

    expect(official).toHaveAttribute("aria-expanded", "false");
    expect(accuracy).toHaveAttribute("aria-expanded", "true");
    expect(officialPanel).toHaveAttribute("hidden");
    expect(accuracyPanel).not.toHaveAttribute("hidden");
  });

  test("lets a visitor switch the interactive story preview manually", async () => {
    renderLanding();

    const story = screen.getByTestId("landing-story");

    expect(story).toHaveAttribute("data-active-step", "1");
    expect(screen.getByText(/loaded from record/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /view progress/i }));

    expect(story).toHaveAttribute("data-active-step", "2");
    expect(await screen.findByText(/6 requirement groups/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit plans/i }));

    expect(story).toHaveAttribute("data-active-step", "3");
    expect(await screen.findByRole("heading", { name: /eligible swaps/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save plans/i }));

    expect(story).toHaveAttribute("data-active-step", "4");
    expect(await screen.findByText(/finance path a/i)).toBeInTheDocument();
  });

  test("falls back to the reduced-effects story mode when effects are reduced", () => {
    document.documentElement.dataset.effectsMode = "reduced";

    renderLanding();

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("landing-story")).toHaveAttribute("data-tour-mode", "poster");
    expect(screen.getByTestId("landing-features")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("landing-proof")).toHaveAttribute("data-reduced-motion", "true");
  });
});
