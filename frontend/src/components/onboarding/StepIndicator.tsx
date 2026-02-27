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
    <div className="flex items-center justify-center gap-4">
      {Array.from({ length: totalSteps }, (_, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <div key={i} className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isDone
                    ? "#ffcc00"
                    : isActive
                      ? "#ffcc00"
                      : "#12213f",
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
              >
                {isDone ? (
                  <svg className="w-5 h-5 text-navy-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={isActive ? "text-navy-dark" : "text-ink-faint"}>
                    {i + 1}
                  </span>
                )}
              </motion.div>
              <span
                className={`text-sm font-medium ${
                  isActive ? "text-gold" : "text-ink-faint"
                }`}
              >
                {labels[i]}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`w-14 h-1 rounded-full mb-7 ${
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
