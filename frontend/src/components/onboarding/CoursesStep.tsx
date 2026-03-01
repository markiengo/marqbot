"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { postValidatePrereqs } from "@/lib/api";

interface CoursesStepProps {
  onWarningChange?: (hasWarning: boolean) => void;
}

export function CoursesStep({ onWarningChange }: CoursesStepProps) {
  const { state, dispatch } = useAppContext();
  const [inconsistencies, setInconsistencies] = useState<
    { course_code: string; prereqs_in_progress: string[] }[]
  >([]);

  // Stable ref so the check callback doesn't depend on the parent's callback identity
  const onWarningChangeRef = useRef(onWarningChange);
  useEffect(() => {
    onWarningChangeRef.current = onWarningChange;
  }, [onWarningChange]);

  const check = useCallback(async () => {
    if (state.completed.size === 0 || state.inProgress.size === 0) {
      setInconsistencies([]);
      onWarningChangeRef.current?.(false);
      return;
    }
    try {
      const result = await postValidatePrereqs({
        completed_courses: [...state.completed].join(", "),
        in_progress_courses: [...state.inProgress].join(", "),
      });
      setInconsistencies(result.inconsistencies);
      onWarningChangeRef.current?.(result.inconsistencies.length > 0);
    } catch {
      setInconsistencies([]);
      onWarningChangeRef.current?.(false);
    }
  }, [state.completed, state.inProgress]);

  useEffect(() => {
    const timer = setTimeout(check, 400);
    return () => clearTimeout(timer);
  }, [check]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
          What courses have you taken?
        </h2>
        <p className="text-base text-ink-muted mt-1">
          Drop your completed courses. Don&apos;t lie to me.
        </p>
      </div>

      {/* Completed courses */}
      <div className="space-y-2 pt-1">
        <label className="text-sm font-medium text-ink-secondary">
          Completed courses
        </label>
        <MultiSelect
          courses={state.courses}
          selected={state.completed}
          otherSet={state.inProgress}
          onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
          onRemove={(code) => dispatch({ type: "REMOVE_COMPLETED", payload: code })}
          placeholder="Search completed courses..."
          resolveLabel={(code) => code}
        />
      </div>

      {/* In-progress courses */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink-secondary">
          Currently in progress
        </label>
        <MultiSelect
          courses={state.courses}
          selected={state.inProgress}
          otherSet={state.completed}
          onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
          onRemove={(code) => dispatch({ type: "REMOVE_IN_PROGRESS", payload: code })}
          placeholder="Search in-progress courses..."
          resolveLabel={(code) => code}
        />
      </div>

      {/* Prereq inconsistency warning */}
      {inconsistencies.length > 0 && (
        <div className="bg-bad-light rounded-xl p-4 text-sm text-bad">
          <p className="font-semibold mb-1">
            Some completed courses have prerequisites still in-progress:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {inconsistencies.map((i) => (
              <li key={i.course_code}>
                <span className="font-medium">{i.course_code}</span> needs:{" "}
                {i.prereqs_in_progress.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            Move these to in-progress, or remove the courses that list them as prerequisites.
          </p>
        </div>
      )}
    </div>
  );
}
