"use client";

import { motion } from "motion/react";

const stats = [
  { value: "200+", label: "Courses Tracked" },
  { value: "6", label: "Majors Supported" },
  { value: "124", label: "Credits to Graduate" },
];

export function SocialProof() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-3 gap-8 max-w-2xl mx-auto"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-sora)] text-gold">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-ink-muted">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
