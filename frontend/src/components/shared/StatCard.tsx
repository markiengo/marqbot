"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

interface StatCardProps {
  value: string | number;
  suffix?: string;
  label: string;
  description?: string;
  accent?: "gold" | "blue" | "gradient";
  delay?: number;
}

export function StatCard({
  value,
  suffix = "",
  label,
  description,
  accent = "gold",
  delay = 0,
}: StatCardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  const accentClass =
    accent === "gold"
      ? "accent-top-gold"
      : accent === "blue"
        ? "accent-top-blue"
        : "stat-card-decor";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }}
      className={`bg-surface-card/75 backdrop-blur-[2px] border border-border-subtle rounded-xl p-6 text-center ${accentClass}`}
    >
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold font-[family-name:var(--font-sora)] text-gold leading-none">
        {value}
        {suffix}
      </div>
      <div className="mt-2 text-sm font-semibold text-ink-primary">{label}</div>
      {description && (
        <p className="mt-1 text-xs text-ink-muted leading-relaxed">
          {description}
        </p>
      )}
    </motion.div>
  );
}
