"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { OnboardingStepHeader } from "./OnboardingStepHeader";
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <OnboardingStepHeader
        eyebrow="Add your classes"
        helper="Best results = accurate inputs"
        title={
          <>
            Add what you&apos;ve <span className="text-emphasis-blue">already finished</span>.
          </>
        }
        description="Add completed classes first, then the ones you are taking now. This is what keeps the plan honest."
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <div className="flex flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-base font-semibold text-ink-secondary md:text-lg">
              Classes you&apos;ve already finished
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              Finished classes, AP, IB, and transfer credit all belong here.
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

        <div className="flex flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,21,43,0.76),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-base font-semibold text-ink-secondary md:text-lg">
              Classes you&apos;re taking right now
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              Current term only. If you are enrolled but not done yet, put it here.
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
          className="rounded-[1.45rem] border border-bad/20 bg-bad-light px-4 py-3.5 text-[0.9rem] text-bad"
        >
          <p className="mb-1 font-semibold">Prereq mismatch:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {inconsistencies.map((issue) => (
              <li key={issue.course_code}>
                <span className="font-medium">{issue.course_code}</span> still needs:{" "}
                {issue.prereqs_in_progress.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            Move the prereq to completed if you already passed it, or remove the class that depends on it.
          </p>
        </motion.div>
      )}
    </div>
  );
}
