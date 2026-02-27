"use client";

import { useState, useCallback, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { postRecommend } from "@/lib/api";
import type { RecommendationResponse } from "@/lib/types";

export function useRecommendations() {
  const { state, dispatch } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const fetchRecommendations = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);

    try {
      const majors = [...state.selectedMajors];
      const payload: Record<string, unknown> = {
        completed_courses: [...state.completed].join(", "),
        in_progress_courses: [...state.inProgress].join(", "),
        target_semester: state.targetSemester,
        target_semester_primary: state.targetSemester,
        target_semester_count: Number(state.semesterCount) || 3,
        max_recommendations: Number(state.maxRecs) || 3,
      };
      if (majors.length > 0) payload.declared_majors = majors;
      if (state.selectedTracks.length > 0) payload.track_ids = state.selectedTracks;

      const data: RecommendationResponse = await postRecommend(payload);
      if (id !== reqId.current) return null; // stale

      dispatch({
        type: "SET_RECOMMENDATIONS",
        payload: { data, count: Number(state.maxRecs) || 3 },
      });

      return data;
    } catch (err) {
      if (id !== reqId.current) return null; // stale
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      return null;
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [state.completed, state.inProgress, state.targetSemester, state.semesterCount, state.maxRecs, state.selectedMajors, state.selectedTracks, dispatch]);

  return {
    data: state.lastRecommendationData,
    requestedCount: state.lastRequestedCount,
    loading,
    error,
    fetchRecommendations,
  };
}
