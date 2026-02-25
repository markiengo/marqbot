"use client";

import { useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { loadPrograms } from "@/lib/api";

export function usePrograms() {
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    if (state.programs.majors.length > 0) return;
    let cancelled = false;

    loadPrograms()
      .then((programs) => {
        if (!cancelled) dispatch({ type: "SET_PROGRAMS", payload: programs });
      })
      .catch((err) => console.error("Failed to load programs:", err));

    return () => {
      cancelled = true;
    };
  }, [state.programs.majors.length, dispatch]);

  return state.programs;
}
