// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { AppProvider } from "../src/context/AppContext";
import { Modal } from "../src/components/shared/Modal";
import { ProfilePreferencesTab } from "../src/components/planner/ProfilePreferencesTab";
import { makeAppState } from "./testUtils";

describe("effects mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.effectsMode;
    delete document.documentElement.dataset.effectsPreference;
  });

  test("honors a stored reduced-effects override for shared modals", async () => {
    window.localStorage.setItem("marqbot_effects_preference", "reduced");

    renderWithProvider(
      createElement(
        Modal,
        { open: true, onClose: () => {}, title: "Effects test" },
        createElement("div", null, "Body"),
      ),
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.effectsMode).toBe("reduced");
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).not.toContain("backdrop-blur-[20px]");
  });

  test("lets the user override effects mode from planner preferences", async () => {
    const user = userEvent.setup();
    renderWithProvider(createElement(ProfilePreferencesTab));

    await user.selectOptions(screen.getByRole("combobox", { name: /effects mode/i }), "reduced");

    await waitFor(() => {
      expect(document.documentElement.dataset.effectsMode).toBe("reduced");
    });
    expect(window.localStorage.getItem("marqbot_effects_preference")).toBe("reduced");

    await user.selectOptions(screen.getByRole("combobox", { name: /effects mode/i }), "auto");
    await waitFor(() => {
      expect(document.documentElement.dataset.effectsPreference).toBe("auto");
    });
    expect(window.localStorage.getItem("marqbot_effects_preference")).toBeNull();
  });
});

function renderWithProvider(ui: ReturnType<typeof createElement>) {
  return render(createElement(AppProvider, { initialStateValue: makeAppState() }, ui));
}
