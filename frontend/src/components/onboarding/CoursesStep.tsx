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
        <div>
          <label className="text-sm font-medium text-ink-secondary">
            Courses you&apos;ve already passed
          </label>
          <p className="text-xs text-ink-faint mt-0.5">
            Every class you&apos;ve officially finished — even from last semester. Include transfer credits too.
          </p>
        </div>
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
        <div>
          <label className="text-sm font-medium text-ink-secondary">
            Courses you&apos;re taking right now
          </label>
          <p className="text-xs text-ink-faint mt-0.5">
            This semester only — classes you&apos;re enrolled in but haven&apos;t finished yet.
          </p>
        </div>
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
            Hold on — some courses you marked as done still have unfinished prereqs:
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
            Move the prerequisite out of &ldquo;right now&rdquo; into completed, or remove the course that needs it.
          </p>
        </div>
      )}
    </div>
  );
}
