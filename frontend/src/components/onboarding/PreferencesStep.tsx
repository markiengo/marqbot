"use client";

import { motion } from "motion/react";
import { useAppContext } from "@/context/AppContext";
import {
  SEMESTER_OPTIONS,
  SEMESTER_COUNT_OPTIONS,
  MAX_RECS_OPTIONS,
} from "@/lib/constants";
import { STUDENT_STAGE_OPTIONS } from "@/lib/studentStage";
import type { StudentStage } from "@/lib/types";
import { OnboardingStepHeader } from "./OnboardingStepHeader";

export function PreferencesStep() {
  const { state, dispatch } = useAppContext();
  const selectCls =
    "onboarding-input onboarding-select w-full rounded-xl px-4 py-3 text-[0.95rem]";

  return (
    <div className="space-y-5">
      <OnboardingStepHeader
        eyebrow="Plan settings"
        helper="You can change this later"
        title={
          <>
            How should MarqBot <span className="text-gold-light">plan</span>?
          </>
        }
        description="Next term, planning horizon, and course load per semester."
      />

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {([
          {
            panel: "onboarding-panel",
            label: "What\u2019s your next semester?",
            hint: "Your next semester.",
            value: state.targetSemester,
            action: "SET_TARGET_SEMESTER" as const,
            options: SEMESTER_OPTIONS,
            delay: 0,
          },
          {
            panel: "onboarding-panel-soft",
            label: "How far ahead do you want to plan?",
            hint: "1 for next term, or up to 5 to plan ahead.",
            value: state.semesterCount,
            action: "SET_SEMESTER_COUNT" as const,
            options: SEMESTER_COUNT_OPTIONS,
            delay: 0.08,
          },
          {
            panel: "onboarding-panel",
            label: "Classes per semester?",
            hint: "4-5 is typical. 6 is a heavy load.",
            value: state.maxRecs,
            action: "SET_MAX_RECS" as const,
            options: MAX_RECS_OPTIONS,
            delay: 0.16,
          },
        ] as const).map((item) => (
          <motion.div
            key={item.action}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: item.delay }}
            className={`${item.panel} flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]`}
          >
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink-primary">{item.label}</label>
              <p className="mt-0.5 text-xs text-ink-muted">{item.hint}</p>
            </div>
            <div className="mt-auto pt-3">
              <select
                value={item.value}
                onChange={(event) => dispatch({ type: item.action, payload: event.target.value })}
                className={selectCls}
              >
                {item.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.24 }}
          className="onboarding-panel-soft flex flex-col rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-primary">
              Academic stage
            </label>
            <p className="mt-0.5 text-xs text-ink-muted">
              Keeps recommendations appropriate for your year.
            </p>
          </div>
          <div className="mt-auto pt-3">
            <select
              aria-label="Student stage"
              value={state.studentStage}
              onChange={(event) =>
                dispatch({ type: "SET_STUDENT_STAGE", payload: event.target.value as StudentStage })
              }
              className={selectCls}
            >
              {STUDENT_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-ink-muted">
              {STUDENT_STAGE_OPTIONS.find((option) => option.value === state.studentStage)?.helper}
            </p>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.32 }}
        className="grid gap-4 lg:grid-cols-2"
      >
        <label className="onboarding-panel flex cursor-pointer items-center justify-between gap-4 rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <span className="text-sm font-medium text-ink-primary">
              Are you an honors student?
            </span>
            <p className="text-xs text-ink-muted">
              Unlocks honors sections in recommendations.
            </p>
          </div>
          <div className="relative shrink-0">
            <input
              type="checkbox"
              checked={state.isHonorsStudent}
              onChange={(e) => dispatch({ type: "SET_HONORS_STUDENT", payload: e.target.checked })}
              className="peer sr-only"
            />
            <div className="h-7 w-12 rounded-full border border-border-subtle bg-[rgba(22,43,80,0.5)] transition-colors peer-checked:border-gold/40 peer-checked:bg-[rgba(255,204,0,0.18)]" />
            <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-ink-muted transition-all peer-checked:left-[1.375rem] peer-checked:bg-gold-light" />
          </div>
        </label>

        <label className="onboarding-panel-soft flex cursor-pointer items-center justify-between gap-4 rounded-[1.8rem] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <span className="text-sm font-medium text-ink-primary">
              Do you take summer classes?
            </span>
            <p className="text-xs text-ink-muted">
              Includes summer terms in your plan.
            </p>
          </div>
          <div className="relative shrink-0">
            <input
              type="checkbox"
              checked={state.includeSummer}
              onChange={(e) => dispatch({ type: "SET_INCLUDE_SUMMER", payload: e.target.checked })}
              className="peer sr-only"
            />
            <div className="h-7 w-12 rounded-full border border-border-subtle bg-[rgba(22,43,80,0.5)] transition-colors peer-checked:border-gold/40 peer-checked:bg-[rgba(255,204,0,0.18)]" />
            <div className="absolute left-1 top-1 h-5 w-5 rounded-full bg-ink-muted transition-all peer-checked:left-[1.375rem] peer-checked:bg-gold-light" />
          </div>
        </label>
      </motion.div>
    </div>
  );
}
