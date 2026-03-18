"use client";

import { motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import { MultiSelect } from "@/components/shared/MultiSelect";
import { CourseHistoryImport } from "@/components/onboarding/CourseHistoryImport";

interface ProfileCoursesTabProps {
  /** Whether this tab is the active/visible tab */
  active: boolean;
}

export function ProfileCoursesTab({ active }: ProfileCoursesTabProps) {
  const { state, dispatch } = useAppContext();

  // Always render (to preserve CourseHistoryImport state), but hide when inactive
  return (
    <div className={active ? "" : "hidden"}>
      <div className="space-y-4">
        <CourseHistoryImport />

        <div className="grid items-start gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.1 }}
            className="onboarding-panel flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
          >
            <div className="space-y-1">
              <label className="text-base font-semibold text-ink-primary md:text-lg">
                Classes you&apos;ve already finished
              </label>
              <p className="mt-0.5 text-xs text-ink-muted">
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.22 }}
            className="onboarding-panel-soft flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
          >
            <div className="space-y-1">
              <label className="text-base font-semibold text-ink-primary md:text-lg">
                Classes you&apos;re taking right now
              </label>
              <p className="mt-0.5 text-xs text-ink-muted">
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
