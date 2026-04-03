// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import LandingPage from "../src/app/page";
import { EffectsModeManager } from "../src/components/shared/EffectsModeManager";
import { useReducedEffects } from "../src/hooks/useReducedEffects";

function EffectsProbe() {
  const reduceEffects = useReducedEffects();
  return createElement("div", { "data-testid": "effects-probe" }, reduceEffects ? "reduced" : "full");
}

function installMatchMediaMock() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("effects mode", () => {
  beforeEach(() => {
    installMatchMediaMock();
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete document.documentElement.dataset.effectsMode;
    delete document.documentElement.dataset.effectsPreference;
    delete document.documentElement.dataset.effectsModeSource;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window.navigator, "connection");
    Reflect.deleteProperty(window.navigator, "deviceMemory");
    Reflect.deleteProperty(window.navigator, "hardwareConcurrency");
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
    expect(screen.getByTestId("landing-features")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("landing-proof")).toHaveAttribute("data-reduced-motion", "true");
  });

  test("defaults to full effects when no explicit reduced preference is active", async () => {
    Object.defineProperty(window.navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });

    render(createElement(EffectsModeManager));

    await waitFor(() => {
      expect(document.documentElement.dataset.effectsMode).toBeUndefined();
      expect(document.documentElement.dataset.effectsModeSource).toBe("auto");
    });
  });

  test("respects the browser reduced-motion preference", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(createElement(EffectsModeManager));

    await waitFor(() => {
      expect(document.documentElement.dataset.effectsMode).toBe("reduced");
      expect(document.documentElement.dataset.effectsModeSource).toBe("system");
    });
  });
});
