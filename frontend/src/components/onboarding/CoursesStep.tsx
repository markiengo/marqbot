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
        description="This is what keeps your plan realistic. Add passed classes, then anything you are taking right now."
      />

      <div className="grid min-h-0 flex-1 items-stretch gap-4 xl:grid-cols-2">
        <div className="flex min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-secondary">
              Classes you&apos;ve already passed
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              Finished classes, AP, IB, and transfer credit all count here.
            </p>
          </div>
          <div className="mt-3 min-h-0 flex-1">
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
        </div>

        <div className="flex min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,21,43,0.76),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-secondary">
              Classes you&apos;re taking right now
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              Current semester only. If you are enrolled but not done yet, put it here.
            </p>
          </div>
          <div className="mt-3 min-h-0 flex-1">
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
        </div>
      </div>

      {inconsistencies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-[1.45rem] border border-bad/20 bg-bad-light px-4 py-3.5 text-[0.9rem] text-bad"
        >
          <p className="mb-1 font-semibold">Something looks off:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {inconsistencies.map((issue) => (
              <li key={issue.course_code}>
                <span className="font-medium">{issue.course_code}</span> still needs:{" "}
                {issue.prereqs_in_progress.join(", ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            Move the prereq into completed if you already passed it, or remove the class that depends on it.
          </p>
        </motion.div>
      )}
    </div>
  );
}
