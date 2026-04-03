"use client";

import { useEffect } from "react";

const USER_PREFERENCE_KEY = "marqbot_effects_preference";
const EFFECTS_CHANGE_EVENT = "marqbot:effects-mode-change";

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function readStorageValue(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Ignore storage failures; the runtime fallback still works for this page load.
  }
}

function dispatchEffectsModeChange() {
  window.dispatchEvent(new Event(EFFECTS_CHANGE_EVENT));
}

function applyEffectsMode(mode: "full" | "reduced", source: "manual" | "system" | "auto") {
  const root = document.documentElement;

  if (mode === "reduced") {
    root.dataset.effectsMode = "reduced";
  } else {
    delete root.dataset.effectsMode;
  }

  root.dataset.effectsModeSource = source;
  dispatchEffectsModeChange();
}

function hasUserReducedPreference() {
  return readStorageValue(window.localStorage, USER_PREFERENCE_KEY) === "reduced";
}

export function EffectsModeManager() {
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ) as LegacyMediaQueryList;

    const evaluate = () => {
      if (hasUserReducedPreference()) {
        applyEffectsMode("reduced", "manual");
        return;
      }

      if (reducedMotionQuery.matches) {
        applyEffectsMode("reduced", "system");
        return;
      }

      applyEffectsMode("full", "auto");
    };

    const handlePreferenceChange = () => {
      evaluate();
    };

    evaluate();

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", handlePreferenceChange);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(handlePreferenceChange);
    }
    window.addEventListener("storage", handlePreferenceChange);

    return () => {
      if (typeof reducedMotionQuery.removeEventListener === "function") {
        reducedMotionQuery.removeEventListener("change", handlePreferenceChange);
      } else if (typeof reducedMotionQuery.removeListener === "function") {
        reducedMotionQuery.removeListener(handlePreferenceChange);
      }
      window.removeEventListener("storage", handlePreferenceChange);
    };
  }, []);

  return null;
}
