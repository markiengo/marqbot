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
    "w-full rounded-xl border border-border-medium bg-surface-input px-4 py-3 text-[0.95rem] text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <OnboardingStepHeader
        eyebrow="Choose your plan"
        helper="You can change this later"
        title={
          <>
            Tell MarqBot what <span className="text-emphasis-gold">kind of plan</span>{" "}
            <span className="whitespace-nowrap">you want.</span>
          </>
        }
        description="Pick the next term, how far ahead to look, and how heavy each semester should feel."
      />

      <div className="grid min-h-0 flex-1 items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <div className="flex min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)] shine-sweep">
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-secondary">
              What&apos;s your next semester?
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              The term you are planning for next. Not the one you are in right now.
            </p>
          </div>
          <div className="mt-auto pt-3">
            <select
              value={state.targetSemester}
              onChange={(event) =>
                dispatch({ type: "SET_TARGET_SEMESTER", payload: event.target.value })
              }
              className={selectCls}
            >
              {SEMESTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,21,43,0.76),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-secondary">
              How far ahead do you want to plan?
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              Pick 1 for next term only, or go bigger if you want the long game.
            </p>
          </div>
          <div className="mt-auto pt-3">
            <select
              value={state.semesterCount}
              onChange={(event) =>
                dispatch({ type: "SET_SEMESTER_COUNT", payload: event.target.value })
              }
              className={selectCls}
            >
              {SEMESTER_COUNT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,21,43,0.76),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-secondary">
              How many classes do you want each semester?
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              Most students pick 4 or 5. Six is a fully informed choice.
            </p>
          </div>
          <div className="mt-auto pt-3">
            <select
              value={state.maxRecs}
              onChange={(event) =>
                dispatch({ type: "SET_MAX_RECS", payload: event.target.value })
              }
              className={selectCls}
            >
              {MAX_RECS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,21,43,0.76),rgba(255,255,255,0.02))] p-[clamp(1rem,1.6vw,1.35rem)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink-secondary">
              Which academic stage are you planning for?
            </label>
            <p className="mt-0.5 text-xs text-ink-faint">
              This hard-locks recommendations to the course levels that match your program stage.
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
            <p className="mt-2 text-xs text-ink-faint">
              {STUDENT_STAGE_OPTIONS.find((option) => option.value === state.studentStage)?.helper}
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-[1.5rem] border border-gold/18 bg-gold/[0.07] px-4 py-3.5 text-[0.92rem] leading-relaxed text-ink-secondary"
      >
        MarqBot will rank classes that count now, unlock later work, and fit the pace you picked.
      </motion.div>
    </div>
  );
}
