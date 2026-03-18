"use client";

import { motion } from "motion/react";

const STEP_LABELS = ["Pick Major", "Add Courses", "Set Pace", "Your Buckets"];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="grid w-full gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;

        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              x: isActive ? 4 : 0,
              scale: isActive ? 1.02 : 1,
              borderColor: isDone || isActive ? "rgba(255,204,0,0.28)" : "rgba(141,170,224,0.18)",
              backgroundColor: isActive
                ? "rgba(18,33,63,0.96)"
                : isDone
                  ? "rgba(12,29,56,0.92)"
                  : "rgba(12,29,56,0.78)",
              boxShadow: isActive
                ? "0 8px 20px rgba(0,0,0,0.18)"
                : "0 4px 12px rgba(0,0,0,0.10)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            aria-current={isActive ? "step" : undefined}
            className="flex items-center gap-3 rounded-[1.15rem] border px-3.5 py-3.5"
          >
            <span
              className={`flex h-[1.65rem] min-w-[1.65rem] shrink-0 items-center justify-center rounded-full border text-[0.68rem] font-semibold leading-none ${
                isDone
                  ? "border-gold/35 bg-gold/10 text-gold"
                  : isActive
                    ? "border-gold/35 bg-gold/10 text-gold"
                    : "border-white/10 bg-transparent text-ink-faint"
              }`}
            >
              {isDone ? (
                <svg className="h-3.5 w-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                `0${i + 1}`
              )}
            </span>

            <p className={`text-[1.05rem] font-semibold leading-tight ${
              isDone || isActive ? "text-gold" : "text-ink-muted"
            }`}>
              {STEP_LABELS[i] ?? `Step ${i + 1}`}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
