// @vitest-environment jsdom

import "./setupTests";

import { createElement, type ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import LandingPage from "../src/app/page";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
}));

function expectBefore(first: HTMLElement, second: HTMLElement) {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
}

describe("LandingPage", () => {
  test("renders the upgraded landing story in the expected order", () => {
    render(createElement(LandingPage));

    const hero = screen.getByTestId("landing-hero");
    const spotlight = screen.getByTestId("feature-spotlight");
    const proof = screen.getByTestId("landing-proof");
    const howItWorks = screen.getByRole("heading", { name: /three steps\./i }).closest("section");
    const finalCta = screen.getByRole("heading", { name: /plan your semesters\./i }).closest("section");

    expect(howItWorks).not.toBeNull();
    expect(finalCta).not.toBeNull();

    expect(screen.getAllByRole("button", { name: /get my plan/i }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /see how it works/i })).toBeInTheDocument();
    expect(screen.getByText(/why this isn't guesswork/i)).toBeInTheDocument();

    expectBefore(hero, spotlight);
    expectBefore(spotlight, proof);
    expectBefore(proof, howItWorks as HTMLElement);
    expectBefore(howItWorks as HTMLElement, finalCta as HTMLElement);
  });

  test("keeps the landing sections in simplified mode when effects are reduced", () => {
    document.documentElement.dataset.effectsMode = "reduced";

    render(createElement(LandingPage));

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("feature-spotlight")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("landing-proof")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.queryByText(/active benefit/i)).not.toBeInTheDocument();
  });
});
