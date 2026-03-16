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
    title: "Pick your main quest.",
    body: "Start with the major you are actually in. Add tracks only when they are real.",
  },
  courses: {
    eyebrow: "Step 2 of 3",
    title: "Log your lore.",
    body: "Completed and in-progress courses keep the roadmap grounded in what you have already done.",
  },
  preferences: {
    eyebrow: "Step 3 of 3",
    title: "Set the pace.",
    body: "Choose the next term, how far ahead you want to look, and and how ambitious you're feeling.",
  },
} as const;

const quickHits = [
  { value: "3 steps", label: "that's it" },
  { value: "Edit later", label: "nothing is permanent" },
  { value: "Real rules", label: "not vibes" },
];

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
            <div className="rounded-[1.5rem] border border-[#decdbb] bg-[#fff8ef] px-5 py-5">
              <p className="warm-kicker">{meta.eyebrow}</p>
              <h3 className="mt-4 max-w-[10ch] font-[family-name:var(--font-sora)] text-[2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--ink-warm)]">
                {meta.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[var(--ink-warm-soft)] sm:text-base">
                {meta.body}
              </p>
            </div>

            <div className="mt-5">
              <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {quickHits.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.25rem] border border-[#ddd0c0] bg-[#fffaf4] px-4 py-4"
                >
                  <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--ink-warm)]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ink-warm-muted)]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="rounded-[1.55rem] border border-[#decdba] bg-[#fff9f1] px-4 py-4 xl:hidden">
              <p className="warm-kicker">{meta.eyebrow}</p>
              <h3 className="mt-3 font-[family-name:var(--font-sora)] text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--ink-warm)]">
                {meta.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--ink-warm-soft)]">{meta.body}</p>
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
