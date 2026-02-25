"use client";

import { useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { loadCourses } from "@/lib/api";

export function useCourses() {
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    if (state.courses.length > 0) return;
    let cancelled = false;

    loadCourses()
      .then((courses) => {
        if (!cancelled) dispatch({ type: "SET_COURSES", payload: courses });
      })
      .catch((err) => console.error("Failed to load courses:", err));

    return () => {
      cancelled = true;
    };
  }, [state.courses.length, dispatch]);

  return state.courses;
}
