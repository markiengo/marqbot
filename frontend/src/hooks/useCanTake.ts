"use client";

import { useState, useCallback, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { postCanTake } from "@/lib/api";
import type { CanTakeResponse } from "@/lib/types";

export function useCanTake() {
  const { state } = useAppContext();
  const [data, setData] = useState<CanTakeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const checkCanTake = useCallback(
    async (courseCode: string) => {
      if (!courseCode.trim()) return null;
      const id = ++reqId.current;
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

        const result = await postCanTake(payload);
        if (id !== reqId.current) return null;
        setData(result);
        return result;
      } catch (err) {
        if (id !== reqId.current) return null;
        const msg = err instanceof Error ? err.message : "Request failed";
        setError(msg);
        return null;
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [state.completed, state.inProgress, state.targetSemester, state.selectedMajors, state.selectedTracks],
  );

  return { data, loading, error, checkCanTake };
}
