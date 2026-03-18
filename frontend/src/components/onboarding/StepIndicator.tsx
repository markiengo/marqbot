"use client";

import { motion } from "motion/react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function StepIndicator({
  currentStep,
  totalSteps,
  labels = ["Path", "Progress", "Pace"],
}: StepIndicatorProps) {
  return (
    <div className="grid w-full gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        const statusLabel = isDone ? "Done" : isActive ? "Current" : "Next";

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
            className="flex items-center gap-3 rounded-[1.15rem] border px-3.5 py-5"
          >
            <span
              className={`flex h-[1.65rem] min-w-[1.65rem] shrink-0 items-center justify-center rounded-full border text-[0.68rem] font-semibold leading-none ${
                isDone
                  ? "border-gold/35 bg-navy-dark text-ink-primary"
                  : isActive
                    ? "border-gold/35 bg-gold/10 text-gold"
                    : "border-white/10 bg-transparent text-ink-faint"
              }`}
            >
              {isDone ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                `0${i + 1}`
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p
                  className={`text-[1.1rem] font-semibold leading-tight sm:text-[1.2rem] ${
                    isDone || isActive ? "text-ink-primary" : "text-ink-muted"
                  }`}
                >
                  {labels[i]}
                </p>
                <span
                  className={`text-[0.72rem] font-semibold uppercase tracking-[0.16em] ${
                    isDone || isActive ? "text-gold" : "text-ink-faint"
                  }`}
                >
                  {statusLabel}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border-subtle">
                <motion.div
                  initial={false}
                  animate={{
                    width: isDone ? "100%" : isActive ? "62%" : "26%",
                    opacity: isDone || isActive ? 1 : 0.55,
                  }}
                  transition={{ duration: 0.28 }}
                  className={`h-full rounded-full ${isDone ? "bg-navy-light" : isActive ? "bg-gold" : "bg-border-medium"}`}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
