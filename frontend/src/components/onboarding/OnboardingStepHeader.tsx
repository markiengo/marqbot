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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center rounded-full border border-[#dec9b1] bg-[#fff6ea] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f5e1e]"
        >
          {eyebrow}
        </motion.span>
        {helper && (
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="inline-flex items-center rounded-full border border-[#ddd0c0] bg-[#fbf5ec] px-3.5 py-1.5 text-xs text-[var(--ink-warm-muted)]"
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
        <h2 className="max-w-[24ch] font-[family-name:var(--font-sora)] text-[clamp(2rem,3.4vw,2.85rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--ink-warm)]">
          {title}
        </h2>
        <p className="mt-3 max-w-[52rem] text-[0.98rem] leading-relaxed text-[var(--ink-warm-soft)] sm:text-[1.03rem]">
          {description}
        </p>
      </motion.div>
    </div>
  );
}
