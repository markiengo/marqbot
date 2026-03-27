"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type EffectsMode = "full" | "reduced";
export type EffectsPreference = "auto" | EffectsMode;

interface EffectsContextValue {
  mode: EffectsMode;
  autoMode: EffectsMode;
  preference: EffectsPreference;
  setPreference: (next: EffectsPreference) => void;
  reducedEffects: boolean;
}

const EFFECTS_PREFERENCE_KEY = "marqbot_effects_preference";
const EffectsContext = createContext<EffectsContextValue | null>(null);

function readStoredPreference(): EffectsPreference {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(EFFECTS_PREFERENCE_KEY);
  return raw === "full" || raw === "reduced" ? raw : "auto";
}

function getBaselineAutoMode(): EffectsMode {
  if (typeof window === "undefined") return "full";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "reduced";
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) {
    return "reduced";
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) {
    return "reduced";
  }

  return "full";
}

async function probeFrameCadence(sampleCount = 8): Promise<EffectsMode> {
  if (typeof window === "undefined" || document.visibilityState !== "visible") {
    return "full";
  }

  return new Promise((resolve) => {
    let lastTimestamp = 0;
    const deltas: number[] = [];

    const step = (timestamp: number) => {
      if (lastTimestamp !== 0) {
        deltas.push(timestamp - lastTimestamp);
      }
      lastTimestamp = timestamp;

      if (deltas.length >= sampleCount) {
        const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
        const slowFrames = deltas.filter((value) => value > 22).length;
        resolve(averageDelta > 19 || slowFrames >= 3 ? "reduced" : "full");
        return;
      }

      window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
  });
}

export function EffectsProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<EffectsPreference>("auto");
  const [autoMode, setAutoMode] = useState<EffectsMode>("full");

  useEffect(() => {
    setPreferenceState(readStoredPreference());
  }, []);

  useEffect(() => {
    const nextBaseline = getBaselineAutoMode();
    setAutoMode(nextBaseline);

    if (preference !== "auto" || nextBaseline === "reduced") {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void probeFrameCadence().then((nextMode) => {
        if (!cancelled && nextMode === "reduced") {
          setAutoMode("reduced");
        }
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [preference]);

  const setPreference = useCallback((next: EffectsPreference) => {
    setPreferenceState(next);
    if (typeof window === "undefined") return;
    if (next === "auto") {
      window.localStorage.removeItem(EFFECTS_PREFERENCE_KEY);
    } else {
      window.localStorage.setItem(EFFECTS_PREFERENCE_KEY, next);
    }
  }, []);

  const mode = preference === "auto" ? autoMode : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.effectsMode = mode;
    root.dataset.effectsPreference = preference;
    return () => {
      delete root.dataset.effectsMode;
      delete root.dataset.effectsPreference;
    };
  }, [mode, preference]);

  const value = useMemo<EffectsContextValue>(
    () => ({
      mode,
      autoMode,
      preference,
      setPreference,
      reducedEffects: mode === "reduced",
    }),
    [mode, autoMode, preference, setPreference],
  );

  return <EffectsContext.Provider value={value}>{children}</EffectsContext.Provider>;
}

export function useEffectsContext(): EffectsContextValue {
  const ctx = useContext(EffectsContext);
  if (!ctx) throw new Error("useEffectsContext must be used within EffectsProvider");
  return ctx;
}

export function useReducedEffects(): boolean {
  return useEffectsContext().reducedEffects;
}
