"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const features = [
  {
    stat: "5+",
    statLabel: "Ranking Factors",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    title: "Smart Recommendations",
    description:
      "Courses ranked by prereq chains, bucket tiers, and multi-requirement efficiency. Same inputs, same outputs.",
  },
  {
    stat: "100%",
    statLabel: "Prereqs Verified",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Prerequisite Tracking",
    description:
      "Every recommendation is prereq-checked. Missing a prereq? You'll know before you register.",
  },
  {
    stat: "6",
    statLabel: "Programs Tracked",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "Degree Progress",
    description:
      "Core, major, MCC, electives — tracked across every bucket. See what's done and what's left.",
  },
];

export function FeatureSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-20 overflow-hidden band-blue band-fade-top">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[300px] bg-gold/[0.03] rounded-full blur-[90px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 space-y-4">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            className="text-gold text-xs sm:text-sm uppercase tracking-widest font-semibold"
          >
            The Problem
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-sora)] text-ink-primary"
          >
            Overwhelmed by degree requirements?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="text-ink-secondary max-w-[620px] mx-auto text-base sm:text-lg leading-relaxed"
          >
            Planning should feel clear and structured, not like sorting through
            disconnected rules.
          </motion.p>
        </div>

        <AnchorLine variant="gold" className="mb-10" />

        <div className="text-center mb-10">
          <p className="text-gold text-xs sm:text-sm uppercase tracking-widest font-semibold mb-3">
            The Solution
          </p>
          <h3 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
            Ranked by actual degree logic.{" "}
            <em className="mu-accent text-ink-secondary">Not guesswork.</em>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.22 + idx * 0.1 }}
              className="bg-surface-card/75 backdrop-blur-[2px] border border-border-subtle rounded-xl p-6 shadow-sm stat-card-decor"
            >
              <div className="text-2xl font-bold font-[family-name:var(--font-sora)] text-gold mb-1">
                {f.stat}
              </div>
              <div className="text-xs text-ink-muted mb-3">{f.statLabel}</div>
              <div className="w-11 h-11 rounded-xl bg-gold/12 text-gold flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h4 className="text-lg font-semibold font-[family-name:var(--font-sora)] text-ink-primary mb-2">
                {f.title}
              </h4>
              <p className="text-sm text-ink-secondary leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
