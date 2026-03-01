"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const stats = [
  { value: 540, suffix: "+", label: "Courses Tracked" },
  { value: 12, suffix: "", label: "Majors Supported" },
  { value: 124, suffix: "", label: "Credits to Graduate" },
];

function useCountUp(target: number, inView: boolean, duration = 1200) {
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
  const accentClass = accent === "gold" ? "accent-top-gold" : "accent-top-blue";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }}
      className={`bg-surface-card/75 backdrop-blur-[2px] border border-border-subtle rounded-xl p-6 text-center ${accentClass}`}
    >
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold font-[family-name:var(--font-sora)] text-gold leading-none">
        {count}
        {suffix}
      </div>
      <div className="mt-2 text-sm font-semibold text-ink-primary">{label}</div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {stats.map((s, idx) => (
            <StatItem
              key={s.label}
              value={s.value}
              suffix={s.suffix}
              label={s.label}
              inView={inView}
              delay={idx * 0.12}
              accent={idx === 1 ? "blue" : "gold"}
            />
          ))}
        </div>
      </div>

      <AnchorLine variant="fade" className="mt-10" />
    </section>
  );
}
