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
  labels = ["Path", "Lore", "Pace"],
}: StepIndicatorProps) {
  return (
    <div className="grid w-full grid-cols-3 gap-2.5">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        const statusLabel = isDone ? "Done" : isActive ? "Current" : "Step";

        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              y: isActive ? -4 : 0,
              scale: isActive ? 1.04 : 1,
              borderColor: isDone || isActive ? "rgba(255,204,0,0.28)" : "rgba(141,170,224,0.18)",
              backgroundColor: isActive
                ? "rgba(18,33,63,0.96)"
                : isDone
                  ? "rgba(12,29,56,0.92)"
                  : "rgba(12,29,56,0.78)",
              boxShadow: isActive
                ? "0 14px 30px rgba(0,0,0,0.20)"
                : "0 10px 24px rgba(0,0,0,0.14)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            aria-current={isActive ? "step" : undefined}
            className="min-w-0 rounded-[1.15rem] border px-3.5 py-3 text-left"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span
                className={`whitespace-nowrap text-[0.6rem] font-semibold uppercase leading-none tracking-[0.16em] sm:text-[0.62rem] ${
                  isDone || isActive ? "text-gold" : "text-ink-faint"
                }`}
              >
                {statusLabel}
              </span>
              <span
                className={`flex h-[1.65rem] min-w-[1.65rem] items-center justify-center rounded-full border px-1.5 text-[0.68rem] font-semibold leading-none ${
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
            </div>

            <p
              className={`mt-2.5 text-[0.88rem] font-semibold leading-tight sm:text-[0.95rem] ${
                isDone || isActive ? "text-[var(--ink-warm)]" : "text-[var(--ink-warm-soft)]"
              }`}
            >
              {labels[i]}
            </p>

            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-border-subtle">
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
          </motion.div>
        );
      })}
    </div>
  );
}
