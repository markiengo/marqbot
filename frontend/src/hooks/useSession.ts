"use client";

import { useEffect, useRef } from "react";
import {
  useCatalogContext,
  useCourseHistoryContext,
  usePreferencesContext,
  useProgramSelectionContext,
  useRecommendationContext,
  useUiContext,
} from "@/context/AppContext";
import { SESSION_RECOMMENDATION_STORAGE_KEY, STORAGE_KEY } from "@/lib/constants";
import type { SessionSnapshot } from "@/lib/types";

type PersistedRecommendationSnapshot = Pick<SessionSnapshot, "lastRecommendationData">;

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

function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors (private mode / quota exceeded)
  }
}

export function useSession() {
  const { courses } = useCatalogContext();
  const { completed, inProgress } = useCourseHistoryContext();
  const { selectedMajors, selectedTracks, selectedMinors, discoveryTheme } =
    useProgramSelectionContext();
  const {
    targetSemester,
    semesterCount,
    maxRecs,
    includeSummer,
    isHonorsStudent,
    schedulingStyle,
    studentStage,
    studentStageIsExplicit,
  } = usePreferencesContext();
  const { canTakeQuery, activeNavTab, onboardingComplete, dispatch } = useUiContext();
  const { lastRecommendationData, lastRequestedCount } = useRecommendationContext();
  const restoredRef = useRef(false);

  // Restore on mount (once courses are loaded)
  useEffect(() => {
    if (restoredRef.current || courses.length === 0) return;
    restoredRef.current = true;

    const snap = readLocalStorage<SessionSnapshot>(STORAGE_KEY);
    const recommendationSnap =
      readLocalStorage<PersistedRecommendationSnapshot>(SESSION_RECOMMENDATION_STORAGE_KEY);
    if (snap) {
      dispatch({
        type: "RESTORE_SESSION",
        payload: recommendationSnap?.lastRecommendationData
          ? { ...snap, lastRecommendationData: recommendationSnap.lastRecommendationData }
          : snap,
      });
    }
  }, [courses, dispatch]);

  // Save on state changes (debounced)
  useEffect(() => {
    if (!restoredRef.current) return;

    const timer = setTimeout(() => {
      const snapshot: SessionSnapshot = {
        completed: [...completed],
        inProgress: [...inProgress],
        targetSemester,
        semesterCount,
        maxRecs,
        includeSummer,
        isHonorsStudent,
        schedulingStyle,
        studentStage,
        studentStageIsExplicit,
        canTake: canTakeQuery,
        declaredMajors: [...selectedMajors],
        declaredTracks: selectedTracks,
        declaredMinors: [...selectedMinors],
        discoveryTheme,
        activeNavTab,
        onboardingComplete,
        lastRequestedCount,
      };
      writeLocalStorage(STORAGE_KEY, snapshot);
    }, 300);

    return () => clearTimeout(timer);
  }, [
    completed,
    inProgress,
    targetSemester,
    semesterCount,
    maxRecs,
    includeSummer,
    isHonorsStudent,
    schedulingStyle,
    studentStage,
    studentStageIsExplicit,
    canTakeQuery,
    selectedMajors,
    selectedTracks,
    selectedMinors,
    discoveryTheme,
    activeNavTab,
    onboardingComplete,
    lastRequestedCount,
  ]);

  useEffect(() => {
    if (!restoredRef.current) return;

    const timer = setTimeout(() => {
      const recommendationData = lastRecommendationData;
      if (!recommendationData) {
        removeLocalStorage(SESSION_RECOMMENDATION_STORAGE_KEY);
        return;
      }
      const snapshot: PersistedRecommendationSnapshot = {
        lastRecommendationData: recommendationData,
      };
      writeLocalStorage(SESSION_RECOMMENDATION_STORAGE_KEY, snapshot);
    }, 300);

    return () => clearTimeout(timer);
  }, [lastRecommendationData]);
}
