"use client";

import { useEffect, useRef } from "react";
import { useCatalogContext } from "@/context/AppContext";
import { loadCourses } from "@/lib/api";
import type { Course } from "@/lib/types";

type AppDispatch = ReturnType<typeof useCatalogContext>["dispatch"];

async function fetchCoursesOnce(
  courses: Course[],
  dispatch: AppDispatch,
  inFlightRef: { current: Promise<Course[]> | null },
): Promise<Course[]> {
  if (courses.length > 0) return courses;
  if (inFlightRef.current) return inFlightRef.current;

  dispatch({ type: "LOAD_COURSES_START" });
  const request = loadCourses()
    .then((loadedCourses) => {
      dispatch({ type: "SET_COURSES", payload: loadedCourses });
      return loadedCourses;
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : "Failed to load courses.";
      console.error("Failed to load courses:", err);
      dispatch({ type: "LOAD_COURSES_FAILURE", payload: msg });
      throw err;
    })
    .finally(() => {
      inFlightRef.current = null;
    });

  inFlightRef.current = request;
  return request;
}

export function useCourses() {
  const { courses, coursesLoadStatus, coursesLoadError, dispatch } = useCatalogContext();
  const inFlightRef = useRef<Promise<Course[]> | null>(null);

  useEffect(() => {
    if (courses.length > 0 || coursesLoadStatus !== "idle") return;
    void fetchCoursesOnce(courses, dispatch, inFlightRef).catch(() => null);
  }, [courses, coursesLoadStatus, dispatch]);

  const retry = () => {
    void fetchCoursesOnce(courses, dispatch, inFlightRef).catch(() => null);
  };

  return {
    courses,
    loading: coursesLoadStatus === "loading",
    error: coursesLoadError,
    retry,
  };
}
