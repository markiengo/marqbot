"use client";

import { AnimatePresence, motion } from "motion/react";
import { StepIndicator } from "./StepIndicator";

interface WizardLayoutProps {
  stepKey: "majors" | "courses" | "preferences" | "roadmap";
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
}

const stepMeta = {
  majors: {
    eyebrow: "Step 1 of 4",
    title: "Pick your major.",
    body: "Declared major first. Tracks after.",
  },
  courses: {
    eyebrow: "Step 2 of 4",
    title: "Add your courses.",
    body: "Finished first. In-progress too.",
  },
  preferences: {
    eyebrow: "Step 3 of 4",
    title: "Set your preferences.",
    body: "Term, pace, and how far ahead.",
  },
  roadmap: {
    eyebrow: "Step 4 of 4",
    title: "Know your buckets.",
    body: "See the buckets before MarqBot ranks the plan.",
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
          <aside className="warm-card-muted overflow-hidden rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-28">
            <div className="onboarding-panel-gold relative overflow-hidden rounded-[1.5rem] px-5 py-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(255,204,0,0.12),transparent_26%),radial-gradient(circle_at_12%_82%,rgba(0,114,206,0.14),transparent_30%)]" />
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
