"use client";

import { useState, useCallback, useRef } from "react";
import {
  useCourseHistoryContext,
  usePreferencesContext,
  useProgramSelectionContext,
  useRecommendationContext,
} from "@/context/AppContext";
import { postRecommend } from "@/lib/api";
import type { RecommendationResponse } from "@/lib/types";

export function useRecommendations() {
  const { completed, inProgress } = useCourseHistoryContext();
  const {
    targetSemester,
    semesterCount,
    maxRecs,
    includeSummer,
    isHonorsStudent,
    schedulingStyle,
    studentStage,
  } = usePreferencesContext();
  const { selectedMajors, selectedTracks, selectedMinors, discoveryTheme } =
    useProgramSelectionContext();
  const { lastRecommendationData, lastRequestedCount, dispatch } = useRecommendationContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const applyRecommendationData = useCallback((data: RecommendationResponse, count = Number(maxRecs) || 3) => {
    dispatch({
      type: "SET_RECOMMENDATIONS",
      payload: { data, count },
    });
  }, [dispatch, maxRecs]);

  const runRecommendationRequest = useCallback(async (payload: Record<string, unknown>) => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);

    try {
      const data: RecommendationResponse = await postRecommend(payload);
      if (id !== reqId.current) return null; // stale
      return data;
    } catch (err) {
      if (id !== reqId.current) return null; // stale
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      return null;
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    const majors = [...selectedMajors];
    const payload: Record<string, unknown> = {
      completed_courses: [...completed].join(", "),
      in_progress_courses: [...inProgress].join(", "),
      target_semester: targetSemester,
      target_semester_primary: targetSemester,
      target_semester_count: Number(semesterCount) || 3,
      max_recommendations: Number(maxRecs) || 3,
    };
    if (majors.length > 0) payload.declared_majors = majors;
    const trackIds = [...selectedTracks];
    if (discoveryTheme && !trackIds.includes(discoveryTheme)) {
      trackIds.push(discoveryTheme);
    }
    if (trackIds.length > 0) payload.track_ids = trackIds;
    if (selectedMinors.size > 0) payload.declared_minors = [...selectedMinors];
    if (discoveryTheme) payload.discovery_theme = discoveryTheme;
    if (includeSummer) payload.include_summer = true;
    if (isHonorsStudent) payload.is_honors_student = true;
    payload.student_stage = studentStage;
    payload.scheduling_style = schedulingStyle;

    const data = await runRecommendationRequest(payload);
    if (!data) return null;
    applyRecommendationData(data);
    return data;
  }, [
    applyRecommendationData,
    completed,
    inProgress,
    targetSemester,
    semesterCount,
    maxRecs,
    includeSummer,
    isHonorsStudent,
    schedulingStyle,
    studentStage,
    selectedMajors,
    selectedTracks,
    selectedMinors,
    discoveryTheme,
    runRecommendationRequest,
  ]);

  return {
    data: lastRecommendationData,
    requestedCount: lastRequestedCount,
    loading,
    error,
    applyRecommendationData,
    runRecommendationRequest,
    fetchRecommendations,
  };
}
