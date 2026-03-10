"use client";

import { useState, useCallback, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { postCanTake } from "@/lib/api";
import type { CanTakeResponse } from "@/lib/types";

export function isCanTakeResultForQuery(
  query: string,
  data: CanTakeResponse | null,
): boolean {
  const normalizedQuery = query.trim().toUpperCase();
  const normalizedRequestedCourse = data?.requested_course?.trim().toUpperCase() ?? "";
  return normalizedQuery.length > 0 && normalizedQuery === normalizedRequestedCourse;
}

export function useCanTake() {
  const { state } = useAppContext();
  const [data, setData] = useState<CanTakeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const clearCanTake = useCallback(() => {
    reqId.current += 1;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  const checkCanTake = useCallback(
    async (courseCode: string) => {
      if (!courseCode.trim()) {
        clearCanTake();
        return null;
      }
      const id = ++reqId.current;
      setData(null);
      setLoading(true);
      setError(null);

      try {
        const majors = [...state.selectedMajors];
        const payload: Record<string, unknown> = {
          requested_course: courseCode.trim(),
          completed_courses: [...state.completed].join(", "),
          in_progress_courses: [...state.inProgress].join(", "),
          target_semester: state.targetSemester,
        };
        if (majors.length > 0) payload.declared_majors = majors;
        if (state.selectedTracks.length > 0) payload.track_ids = state.selectedTracks;
        if (state.selectedTracks.length === 1) payload.track_id = state.selectedTracks[0];
        payload.student_stage = state.studentStage;

        const result = await postCanTake(payload);
        if (id !== reqId.current) return null;
        setData(result);
        return result;
      } catch (err) {
        if (id !== reqId.current) return null;
        const msg = err instanceof Error ? err.message : "Request failed";
        setData(null);
        setError(msg);
        return null;
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [clearCanTake, state.completed, state.inProgress, state.targetSemester, state.studentStage, state.selectedMajors, state.selectedTracks],
  );

  return { data, loading, error, checkCanTake, clearCanTake };
}
