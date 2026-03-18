"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { OnboardingStepHeader } from "./OnboardingStepHeader";
import { CourseHistoryImport } from "./CourseHistoryImport";
import { postValidatePrereqs } from "@/lib/api";

interface CoursesStepProps {
  onWarningChange?: (hasWarning: boolean) => void;
}

export function CoursesStep({ onWarningChange }: CoursesStepProps) {
  const { state, dispatch } = useAppContext();
  const [inconsistencies, setInconsistencies] = useState<
    { course_code: string; prereqs_in_progress: string[] }[]
  >([]);

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
    <div className="space-y-5">
      <OnboardingStepHeader
        eyebrow="Add your classes"
        helper="Cleaner inputs, cleaner roadmap"
        title={
          <>
            Add what you&apos;ve <span className="text-[#2e6ea7]">already finished</span>.
          </>
        }
        description="Completed classes first, then the ones in progress. This is how MarqBot knows what counts now and what still depends on next term."
      />

      <CourseHistoryImport />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#fffdf9] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <div className="space-y-1">
            <label className="text-base font-semibold text-[var(--ink-warm)] md:text-lg">
              Classes you&apos;ve already finished
            </label>
            <p className="mt-0.5 text-xs text-[var(--ink-warm-muted)]">
              AP, IB, transfer credit -- all of it goes here.
            </p>
          </div>
          <div className="mt-3">
            <MultiSelect
              courses={state.courses}
              selected={state.completed}
              otherSet={state.inProgress}
              onAdd={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
              onRemove={(code) => dispatch({ type: "REMOVE_COMPLETED", payload: code })}
              placeholder="Search completed courses"
              resolveLabel={(code) => code}
              chipViewportClassName="min-h-[2.75rem]"
              dynamicChipViewport
            />
          </div>
        </div>

        <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#f8efe2] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <div className="space-y-1">
            <label className="text-base font-semibold text-[var(--ink-warm)] md:text-lg">
              Classes you&apos;re taking right now
            </label>
            <p className="mt-0.5 text-xs text-[var(--ink-warm-muted)]">
              Whatever you&apos;re enrolled in right now.
            </p>
          </div>
          <div className="mt-3">
            <MultiSelect
              courses={state.courses}
              selected={state.inProgress}
              otherSet={state.completed}
              onAdd={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
              onRemove={(code) => dispatch({ type: "REMOVE_IN_PROGRESS", payload: code })}
              placeholder="Search in-progress courses"
              resolveLabel={(code) => code}
              chipViewportClassName="min-h-[2.75rem]"
              dynamicChipViewport
            />
          </div>
        </div>
      </div>

      {inconsistencies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-[1.45rem] border border-[#e7c8ba] bg-[#fff3ee] px-4 py-4 text-[0.92rem] text-[#95513c]"
        >
          <p className="mb-1 font-semibold">Prereq mismatch to clean up:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {inconsistencies.map((issue) => (
              <li key={issue.course_code}>
                <span className="font-medium">{issue.course_code}</span> still needs:{" "}
                {issue.prereqs_in_progress.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            Move the prereq to completed, or remove the dependent course. You can continue, but the plan
            will be cleaner if you fix it now.
          </p>
        </motion.div>
      )}
    </div>
  );
}
