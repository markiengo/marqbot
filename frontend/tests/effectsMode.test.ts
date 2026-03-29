// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import LandingPage from "../src/app/page";
import { useReducedEffects } from "../src/hooks/useReducedEffects";

function EffectsProbe() {
  const reduceEffects = useReducedEffects();
  return createElement("div", { "data-testid": "effects-probe" }, reduceEffects ? "reduced" : "full");
}

describe("effects mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.effectsMode;
    delete document.documentElement.dataset.effectsPreference;
  });

  test("reacts to document effects mode updates", async () => {
    render(createElement(EffectsProbe));

    expect(screen.getByTestId("effects-probe")).toHaveTextContent("full");

    document.documentElement.dataset.effectsMode = "reduced";

    await waitFor(() => {
      expect(screen.getByTestId("effects-probe")).toHaveTextContent("reduced");
    });
  });

  test("applies a stored reduced-effects override to the landing page", () => {
    window.localStorage.setItem("marqbot_effects_preference", "reduced");

    render(createElement(LandingPage));

    expect(screen.getByTestId("landing-hero")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("feature-spotlight")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("landing-proof")).toHaveAttribute("data-reduced-motion", "true");
  });
});
