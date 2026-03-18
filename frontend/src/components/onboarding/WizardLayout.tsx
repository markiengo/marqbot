"use client";

import { AnimatePresence, motion } from "motion/react";
import { StepIndicator } from "./StepIndicator";

interface WizardLayoutProps {
  stepKey: "majors" | "courses" | "preferences";
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
}

const stepMeta = {
  majors: {
    eyebrow: "Step 1 of 3",
    title: "Pick your major.",
    body: "Start with what you've declared. Add tracks if they're official.",
  },
  courses: {
    eyebrow: "Step 2 of 3",
    title: "Add your courses.",
    body: "What you've finished and what you're taking now.",
  },
  preferences: {
    eyebrow: "Step 3 of 3",
    title: "Set your preferences.",
    body: "Next term, planning horizon, and course load.",
  },
} as const;


export function WizardLayout({
  stepKey,
  currentStep,
  totalSteps,
  children,
}: WizardLayoutProps) {
  const meta = stepMeta[stepKey];

  return (
    <div className="warm-page warm-page-noise min-h-[calc(100vh-4rem)] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[96rem]">
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] xl:items-start">
          <aside className="warm-card-muted rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-28">
            <div className="onboarding-panel-gold rounded-[1.5rem] px-5 py-5">
              <p className="warm-kicker">{meta.eyebrow}</p>
              <h3 className="mt-4 max-w-[10ch] font-[family-name:var(--font-sora)] text-[2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-ink-primary">
                {meta.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-ink-secondary sm:text-base">
                {meta.body}
              </p>
            </div>

            <div className="mt-5">
              <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
            </div>

          </aside>

          <div className="space-y-4">
            <div className="onboarding-panel-soft rounded-[1.55rem] px-4 py-4 xl:hidden">
              <p className="warm-kicker">{meta.eyebrow}</p>
              <h3 className="mt-3 font-[family-name:var(--font-sora)] text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-ink-primary">
                {meta.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{meta.body}</p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
                className="warm-card rounded-[2rem] p-5 sm:p-6 lg:p-7"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
