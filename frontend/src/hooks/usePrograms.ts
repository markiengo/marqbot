"use client";

import { useEffect, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { loadPrograms } from "@/lib/api";
import type { ProgramsData } from "@/lib/types";

type AppDispatch = ReturnType<typeof useAppContext>["dispatch"];

async function fetchProgramsOnce(
  programs: ProgramsData,
  dispatch: AppDispatch,
  inFlightRef: { current: Promise<ProgramsData> | null },
): Promise<ProgramsData> {
  if (programs.majors.length > 0) return programs;
  if (inFlightRef.current) return inFlightRef.current;

  dispatch({ type: "LOAD_PROGRAMS_START" });
  const request = loadPrograms()
    .then((loadedPrograms) => {
      dispatch({ type: "SET_PROGRAMS", payload: loadedPrograms });
      return loadedPrograms;
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : "Failed to load programs.";
      console.error("Failed to load programs:", err);
      dispatch({ type: "LOAD_PROGRAMS_FAILURE", payload: msg });
      throw err;
    })
    .finally(() => {
      inFlightRef.current = null;
    });

  inFlightRef.current = request;
  return request;
}

export function usePrograms() {
  const { state, dispatch } = useAppContext();
  const inFlightRef = useRef<Promise<ProgramsData> | null>(null);

  useEffect(() => {
    if (state.programs.majors.length > 0 || state.programsLoadStatus !== "idle") return;
    void fetchProgramsOnce(state.programs, dispatch, inFlightRef).catch(() => null);
  }, [state.programs, state.programsLoadStatus, dispatch]);

  const retry = () => {
    void fetchProgramsOnce(state.programs, dispatch, inFlightRef).catch(() => null);
  };

  return {
    programs: state.programs,
    loading: state.programsLoadStatus === "loading",
    error: state.programsLoadError,
    retry,
  };
}
