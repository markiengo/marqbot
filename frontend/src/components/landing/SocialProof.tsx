"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const stats = [
  { value: 540, suffix: "+", label: "Courses tracked", accent: "gold" as const },
  { value: 12, suffix: "", label: "Majors supported", accent: "blue" as const },
  { value: 124, suffix: "", label: "Credits to graduate", accent: "gold" as const },
];

function useCountUp(target: number, inView: boolean, duration = 1100) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, inView, duration]);

  return count;
}

function StatItem({
  value,
  suffix,
  label,
  inView,
  delay,
  accent,
}: {
  value: number;
  suffix: string;
  label: string;
  inView: boolean;
  delay: number;
  accent: "gold" | "blue";
}) {
  const count = useCountUp(value, inView);
  const done = inView && count === value;
  const isGold = accent === "gold";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }}
      whileHover={{ scale: 1.05, y: -4 }}
      className="group relative rounded-2xl p-7 text-center border cursor-default overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(15,35,70,0.80) 0%, rgba(8,20,42,0.65) 100%)",
        borderColor: isGold ? "rgba(255,204,0,0.18)" : "rgba(24,68,160,0.25)",
        boxShadow: isGold
          ? "0 4px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,204,0,0.06)"
          : "0 4px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(24,68,160,0.10)",
      }}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-12 rounded-full opacity-60"
        style={{ background: isGold ? "#ffcc00" : "#1844a0" }}
      />
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: isGold
            ? "radial-gradient(ellipse at 50% 0%, rgba(255,204,0,0.07) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% 0%, rgba(24,68,160,0.10) 0%, transparent 70%)",
        }}
      />

      <motion.div
        animate={done ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="text-4xl sm:text-5xl font-bold font-[family-name:var(--font-sora)] text-gold leading-none"
      >
        {count}
        {suffix}
      </motion.div>
      <div className="mt-2.5 text-sm font-medium text-slate-400">{label}</div>
    </motion.div>
  );
}

export function SocialProof() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="relative py-16 band-gold band-fade-top band-fade-bottom">
      <AnchorLine variant="gold" className="mb-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center text-xs uppercase tracking-widest font-semibold text-gold mb-8"
        >
          Built on actual degree rules
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {stats.map((s, idx) => (
            <StatItem
              key={s.label}
              value={s.value}
              suffix={s.suffix}
              label={s.label}
              inView={inView}
              delay={idx * 0.11}
              accent={s.accent}
            />
          ))}
        </div>
      </div>

      <AnchorLine variant="fade" className="mt-10" />
    </section>
  );
}
