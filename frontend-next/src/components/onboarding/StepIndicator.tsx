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
  labels = ["Major", "Courses", "Preferences"],
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isDone
                    ? "#ffcc00"
                    : isActive
                      ? "#ffcc00"
                      : "#12213f",
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              >
                {isDone ? (
                  <svg className="w-4 h-4 text-navy-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={isActive ? "text-navy-dark" : "text-ink-faint"}>
                    {i + 1}
                  </span>
                )}
              </motion.div>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-gold" : "text-ink-faint"
                }`}
              >
                {labels[i]}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`w-12 h-0.5 rounded-full mb-5 ${
                  isDone ? "bg-gold" : "bg-border-subtle"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
