"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "motion/react";

const stats = [
  { value: 200, suffix: "+", label: "Courses Tracked" },
  { value: 6, suffix: "", label: "Majors Supported" },
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
}: {
  value: number;
  suffix: string;
  label: string;
  inView: boolean;
  delay: number;
}) {
  const count = useCountUp(value, inView);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }}
      className="text-center"
    >
      <div className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-sora)] text-gold">
        {count}
        {suffix}
      </div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </motion.div>
  );
}

export function SocialProof() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="relative py-14">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-px bg-gradient-to-r from-transparent via-border-medium to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
          {stats.map((s, idx) => (
            <StatItem
              key={s.label}
              value={s.value}
              suffix={s.suffix}
              label={s.label}
              inView={inView}
              delay={idx * 0.12}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-px bg-gradient-to-r from-transparent via-border-medium to-transparent" />
    </section>
  );
}
