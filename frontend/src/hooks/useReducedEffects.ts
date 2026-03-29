"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

function readReducedEffectsPreference() {
  if (typeof window === "undefined") {
    return false;
  }

  const htmlMode = document.documentElement.dataset.effectsMode;
  const storedPreference = window.localStorage.getItem("marqbot_effects_preference");

  return htmlMode === "reduced" || storedPreference === "reduced";
}

function subscribeToReducedEffects(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => {
    onStoreChange();
  };

  const observer = new MutationObserver(handleChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-effects-mode"],
  });

  window.addEventListener("storage", handleChange);
  window.addEventListener("marqbot:effects-mode-change", handleChange as EventListener);

  return () => {
    observer.disconnect();
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("marqbot:effects-mode-change", handleChange as EventListener);
  };
}

export function useReducedEffects() {
  const prefersReducedMotion = useReducedMotion();
  const prefersReducedEffects = useSyncExternalStore(
    subscribeToReducedEffects,
    readReducedEffectsPreference,
    () => false,
  );

  return Boolean(prefersReducedMotion || prefersReducedEffects);
}
