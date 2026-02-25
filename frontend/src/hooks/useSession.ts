"use client";

import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { STORAGE_KEY } from "@/lib/constants";
import { readLocalStorage, writeLocalStorage } from "./useLocalStorage";
import type { SessionSnapshot } from "@/lib/types";

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
        canTake: state.canTakeQuery,
        declaredMajors: [...state.selectedMajors],
        declaredTrack: state.selectedTrack || "",
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
    state.canTakeQuery,
    state.selectedMajors,
    state.selectedTrack,
    state.activeNavTab,
    state.onboardingComplete,
    state.lastRecommendationData,
    state.lastRequestedCount,
  ]);
}
