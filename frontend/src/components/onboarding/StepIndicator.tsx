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
  labels = ["Major", "Classes", "Plan"],
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
              y: isActive ? -2 : 0,
              borderColor: isDone || isActive ? "rgba(255,204,0,0.2)" : "rgba(255,255,255,0.08)",
              backgroundColor: isActive
                ? "rgba(255,255,255,0.07)"
                : isDone
                  ? "rgba(255,204,0,0.07)"
                  : "rgba(255,255,255,0.03)",
              boxShadow: isActive
                ? "0 10px 24px rgba(0,0,0,0.16), 0 0 24px rgba(255,204,0,0.08)"
                : "0 6px 18px rgba(0,0,0,0.10)",
            }}
            transition={{ duration: 0.24 }}
            aria-current={isActive ? "step" : undefined}
            className="min-w-0 rounded-[1.15rem] border px-3.5 py-3 text-left"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span
                className={`whitespace-nowrap text-[0.6rem] font-semibold uppercase leading-none tracking-[0.16em] sm:text-[0.62rem] ${
                  isDone || isActive ? "text-gold/90" : "text-ink-faint"
                }`}
              >
                {statusLabel}
              </span>
              <span
                className={`flex h-[1.65rem] min-w-[1.65rem] items-center justify-center rounded-full border px-1.5 text-[0.68rem] font-semibold leading-none ${
                  isDone
                    ? "border-gold/15 bg-gold text-navy-dark"
                    : isActive
                      ? "border-gold/20 bg-gold/10 text-gold"
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
                isDone || isActive ? "text-ink-primary" : "text-ink-secondary"
              }`}
            >
              {labels[i]}
            </p>

            <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/8">
              <motion.div
                initial={false}
                animate={{
                  width: isDone ? "100%" : isActive ? "62%" : "26%",
                  opacity: isDone || isActive ? 1 : 0.55,
                }}
                transition={{ duration: 0.28 }}
                className={`h-full rounded-full ${isDone ? "bg-gold" : isActive ? "bg-mu-blue" : "bg-white/18"}`}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
