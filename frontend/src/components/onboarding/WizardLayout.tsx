"use client";

import { motion, AnimatePresence } from "motion/react";
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
    title: "Set up your program.",
    body: "Pick your major first. Add a track only if you actually have one.",
  },
  courses: {
    eyebrow: "Step 2 of 3",
    title: "Tell us what you have done.",
    body: "Add finished and in-progress classes so the plan does not invent nonsense.",
  },
  preferences: {
    eyebrow: "Step 3 of 3",
    title: "Choose the kind of plan you want.",
    body: "Pick the next term, your pace, and how far ahead you want to look.",
  },
} as const;

const quickHits = [
  { value: "2 min", label: "setup" },
  { value: "Edit later", label: "no lock-in" },
  { value: "Real rules", label: "not guesswork" },
];

export function WizardLayout({
  stepKey,
  currentStep,
  totalSteps,
  children,
}: WizardLayoutProps) {
  const meta = stepMeta[stepKey];

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] overflow-hidden px-[clamp(0.7rem,1.6vw,1.15rem)] py-[clamp(0.7rem,1.4vh,1rem)] band-blue">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ x: [0, 32, 0], y: [0, -20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-20 top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,204,0,0.14),transparent_70%)] blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -28, 0], y: [0, 26, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-10 top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(0,114,206,0.18),transparent_72%)] blur-3xl"
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </div>

      <div className="relative mx-auto flex h-full w-full max-w-[1440px] flex-1">
        <div className="grid h-full w-full flex-1 items-stretch gap-[clamp(0.8rem,1.25vw,1.1rem)] lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="hidden h-full min-h-0 overflow-hidden rounded-[2.15rem] border border-white/10 bg-[linear-gradient(165deg,rgba(9,24,48,0.94),rgba(10,33,61,0.8))] p-[clamp(1rem,1.5vh,1.3rem)] shadow-[0_18px_60px_rgba(0,0,0,0.22)] lg:flex lg:flex-col"
          >
            <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold">
                {meta.eyebrow}
              </p>
              <h3 className="mt-3 max-w-[10ch] font-[family-name:var(--font-sora)] text-[clamp(1.35rem,1.8vw,1.75rem)] font-bold leading-[1.05] tracking-[-0.03em] text-white">
                {meta.title}
              </h3>
              <p className="mt-3 max-w-[18rem] text-[0.9rem] leading-relaxed text-slate-300">
                {meta.body}
              </p>
            </div>

            <div className="mt-4">
              <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
            </div>

            <div className="anchor-fade mt-4 w-full" />

            <div className="mt-4 grid min-h-0 flex-1 content-start gap-2.5">
              {quickHits.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.08 + index * 0.08 }}
                  className={`rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-4 backdrop-blur ${
                    index === 1 ? "float-soft-delay" : "float-soft"
                  }`}
                >
                  <p className="text-[0.96rem] font-bold leading-none text-white">
                    <span className={index === 0 ? "text-emphasis-gold" : "text-emphasis-blue"}>
                      {item.value}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[0.76rem] uppercase tracking-[0.14em] text-slate-300">
                    {item.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.aside>

          <div className="flex h-full min-h-0 flex-col gap-3">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(165deg,rgba(9,24,48,0.84),rgba(10,33,61,0.66))] px-4 py-4 shadow-[0_14px_40px_rgba(0,0,0,0.16)] lg:hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold">
                    {meta.eyebrow}
                  </p>
                  <h3 className="mt-2 max-w-[11ch] font-[family-name:var(--font-sora)] text-[1.15rem] font-bold leading-[1.05] tracking-[-0.02em] text-white">
                    {meta.title}
                  </h3>
                  <p className="mt-2 max-w-[22rem] text-[0.82rem] leading-relaxed text-slate-400">
                    {meta.body}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-slate-300">
                  {quickHits[currentStep]?.value ?? "Real rules"}
                </span>
              </div>
              <div className="mt-4">
                <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 18, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.992 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex min-h-0 flex-1 overflow-visible rounded-[2.15rem] border border-border-subtle bg-[linear-gradient(160deg,rgba(18,33,63,0.94),rgba(11,25,49,0.88))] p-[clamp(0.95rem,1.8vw,1.5rem)] shadow-[0_28px_70px_rgba(0,0,0,0.28)] accent-top-gold"
              >
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.08),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.10),transparent_34%)]" />
                  <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]" />
                </div>
                <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {children}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
