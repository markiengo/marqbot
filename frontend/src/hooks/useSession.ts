"use client";

import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { STORAGE_KEY } from "@/lib/constants";
import type { SessionSnapshot } from "@/lib/types";

function readLocalStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors (private mode / quota exceeded)
  }
}

export function useSession() {
  const { state, dispatch } = useAppContext();
  const restoredRef = useRef(false);

  // Restore on mount (once courses are loaded)
  useEffect(() => {
    if (restoredRef.current || state.courses.length === 0) return;
    restoredRef.current = true;

    const snap = readLocalStorage<SessionSnapshot>(STORAGE_KEY);
    if (snap) {
      dispatch({ type: "RESTORE_SESSION", payload: snap });
    }
  }, [state.courses, dispatch]);

  // Save on state changes (debounced)
  useEffect(() => {
    if (!restoredRef.current) return;

    const timer = setTimeout(() => {
      const snapshot: SessionSnapshot = {
        completed: [...state.completed],
        inProgress: [...state.inProgress],
        targetSemester: state.targetSemester,
        semesterCount: state.semesterCount,
        maxRecs: state.maxRecs,
        includeSummer: state.includeSummer,
        canTake: state.canTakeQuery,
        declaredMajors: [...state.selectedMajors],
        declaredTracks: state.selectedTracks,
        declaredMinors: [...state.selectedMinors],
        discoveryTheme: state.discoveryTheme,
        activeNavTab: state.activeNavTab,
        onboardingComplete: state.onboardingComplete,
        lastRecommendationData: state.lastRecommendationData,
        lastRequestedCount: state.lastRequestedCount,
      };
      writeLocalStorage(STORAGE_KEY, snapshot);
    }, 300);

    return () => clearTimeout(timer);
  }, [
    state.completed,
    state.inProgress,
    state.targetSemester,
    state.semesterCount,
    state.maxRecs,
    state.includeSummer,
    state.canTakeQuery,
    state.selectedMajors,
    state.selectedTracks,
    state.selectedMinors,
    state.discoveryTheme,
    state.activeNavTab,
    state.onboardingComplete,
    state.lastRecommendationData,
    state.lastRequestedCount,
  ]);
}
