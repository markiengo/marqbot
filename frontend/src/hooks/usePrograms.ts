"use client";

import { useEffect, useRef } from "react";
import { useCatalogContext } from "@/context/AppContext";
import { loadPrograms } from "@/lib/api";
import type { ProgramsData } from "@/lib/types";

type AppDispatch = ReturnType<typeof useCatalogContext>["dispatch"];

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
  const { programs, programsLoadStatus, programsLoadError, dispatch } = useCatalogContext();
  const inFlightRef = useRef<Promise<ProgramsData> | null>(null);

  useEffect(() => {
    if (programs.majors.length > 0 || programsLoadStatus !== "idle") return;
    void fetchProgramsOnce(programs, dispatch, inFlightRef).catch(() => null);
  }, [programs, programsLoadStatus, dispatch]);

  const retry = () => {
    void fetchProgramsOnce(programs, dispatch, inFlightRef).catch(() => null);
  };

  return {
    programs,
    loading: programsLoadStatus === "loading",
    error: programsLoadError,
    retry,
  };
}
