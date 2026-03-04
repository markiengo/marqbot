"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

interface OnboardingStepHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  helper?: string;
}

export function OnboardingStepHeader({
  eyebrow,
  title,
  description,
  helper,
}: OnboardingStepHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center rounded-full border border-gold/20 bg-gold/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold"
        >
          {eyebrow}
        </motion.span>
        {helper && (
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-ink-secondary"
          >
            {helper}
          </motion.span>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h2 className="max-w-[24ch] text-[clamp(1.55rem,3vw,2.2rem)] font-bold leading-[0.98] tracking-[-0.03em] text-ink-primary">
          {title}
        </h2>
        <p className="mt-2.5 max-w-[52rem] text-[0.94rem] leading-relaxed text-ink-muted sm:text-[0.98rem]">
          {description}
        </p>
      </motion.div>
    </div>
  );
}
