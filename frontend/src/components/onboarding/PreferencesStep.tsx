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
    "w-full rounded-xl border border-[#dbcab8] bg-[#fffaf4] px-4 py-3 text-[0.95rem] text-[var(--ink-warm)] focus:outline-none focus:ring-2 focus:ring-[#c89f5e]/35";

  return (
    <div className="space-y-5">
      <OnboardingStepHeader
        eyebrow="Choose your plan"
        helper="You can change this later"
        title={
          <>
            Tell MarqBot what <span className="text-[#b07b2b]">kind of plan</span>{" "}
            <span className="whitespace-nowrap">you want.</span>
          </>
        }
        description="Pick the next term, how far ahead to look, and how heavy each semester should feel."
      />

      <div className="grid items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#fffdf9] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-warm)]">
              What&apos;s your next semester?
            </label>
            <p className="mt-0.5 text-xs text-[var(--ink-warm-muted)]">Your next semester.</p>
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

        <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#f8efe2] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-warm)]">
              How far ahead do you want to plan?
            </label>
            <p className="mt-0.5 text-xs text-[var(--ink-warm-muted)]">
              1 for next term, or up to 5 to plan ahead.
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

        <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#fffdf9] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-warm)]">
              How many classes do you want each semester?
            </label>
            <p className="mt-0.5 text-xs text-[var(--ink-warm-muted)]">
              4-5 is typical. 6 is ambitious.
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

        <div className="flex flex-col rounded-[1.8rem] border border-[#ddd0c1] bg-[#f8efe2] p-[clamp(1rem,1.6vw,1.35rem)] shadow-[0_14px_30px_rgba(83,56,30,0.05)]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--ink-warm)]">
              Which academic stage are you planning for?
            </label>
            <p className="mt-0.5 text-xs text-[var(--ink-warm-muted)]">
              Limits recs to courses at your program year.
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
            <p className="mt-2 text-xs text-[var(--ink-warm-muted)]">
              {STUDENT_STAGE_OPTIONS.find((option) => option.value === state.studentStage)?.helper}
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-[1.5rem] border border-[#d9c4ac] bg-[#fff7eb] px-4 py-3.5 text-[0.95rem] leading-relaxed text-[var(--ink-warm-soft)]"
      >
        Recommendations will count now, unlock future courses, and stay aligned with the pace you picked.
      </motion.div>
    </div>
  );
}
