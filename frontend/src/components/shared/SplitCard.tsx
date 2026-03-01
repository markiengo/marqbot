"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

interface SplitCardProps {
  statValue: string;
  statLabel: string;
  description: string;
  children?: React.ReactNode;
  reverse?: boolean;
  accent?: "gold" | "blue";
}

export function SplitCard({
  statValue,
  statLabel,
  description,
  children,
  reverse = false,
  accent = "gold",
}: SplitCardProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const borderColor =
    accent === "gold" ? "border-gold/30" : "border-mu-blue/30";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className={`bg-surface-card/60 backdrop-blur-[2px] border ${borderColor} rounded-2xl overflow-hidden`}
    >
      <div
        className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"}`}
      >
        <div className="flex-1 p-8 md:p-10 flex flex-col justify-center">
          <div
            className={`text-4xl md:text-5xl font-bold font-[family-name:var(--font-sora)] ${accent === "gold" ? "text-gold" : "text-mu-blue"} leading-none mb-2`}
          >
            {statValue}
          </div>
          <h3 className="text-lg font-semibold text-ink-primary mb-2">
            {statLabel}
          </h3>
          <p className="text-sm text-ink-secondary leading-relaxed">
            {description}
          </p>
        </div>
        {children && (
          <div className="flex-1 min-h-[200px] bg-surface-overlay/40 flex items-center justify-center">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}
