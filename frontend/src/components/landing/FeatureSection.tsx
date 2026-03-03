"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const features = [
  {
    stat: "100%",
    statLabel: "prereq-checked",
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
    title: "Nothing slips through.",
    description:
      "Every suggestion is prereq-checked before you see it. Missing a requirement? It's gone — not flagged after you register.",
  },
  {
    stat: "First",
    statLabel: "gatekeepers surfaced",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: "Bottlenecks, handled.",
    description:
      "Some courses block 3–4 others downstream. We find the gatekeepers and push them up. No more discovering this senior year.",
  },
  {
    stat: "0",
    statLabel: "spreadsheets needed",
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
    title: "The full picture.",
    description:
      "Core, major, MCC, electives — tracked in one view. Know exactly what's left and what counts toward what.",
  },
];

export function FeatureSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-20 overflow-hidden band-blue band-fade-top">
      {/* Subtle background depth */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,204,0,0.05) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-[10%] w-[280px] h-[200px] rounded-full blur-[80px]"
          style={{ background: "rgba(24,68,160,0.08)" }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Problem block */}
        <div className="text-center mb-12 space-y-3">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
            className="text-gold text-xs uppercase tracking-widest font-semibold"
          >
            Sound familiar?
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight"
          >
            You Googled your prereqs the night before registration.{" "}
            <em className="mu-accent" style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>Again.</em>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="text-slate-400 max-w-[560px] mx-auto text-base sm:text-lg leading-relaxed"
          >
            Cross-referencing the catalog. Emailing advisors. Opening CheckMarq five times.
            Registration shouldn&apos;t need detective work.
          </motion.p>
        </div>

        <AnchorLine variant="gold" className="mb-10" />

        {/* Solution block */}
        <div className="text-center mb-10 space-y-2">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.28 }}
            className="text-gold text-xs uppercase tracking-widest font-semibold"
          >
            Here&apos;s what changes.
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.36 }}
            className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-sora)] text-white"
          >
            MarqBot runs the logic.{" "}
            <span className="text-gold">You just pick the classes.</span>
          </motion.h3>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((f, idx) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.44 + idx * 0.12 }}
              whileHover={{ y: -6, scale: 1.018 }}
              className="group relative rounded-2xl p-6 border cursor-default overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(15,35,70,0.85) 0%, rgba(10,24,50,0.70) 100%)",
                borderColor: "rgba(255,255,255,0.08)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.22)",
              }}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,204,0,0.06) 0%, transparent 65%)" }} />

              <div className="relative">
                {/* Stat */}
                <div className="text-4xl font-bold font-[family-name:var(--font-sora)] text-gold mb-0.5">
                  {f.stat}
                </div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wide mb-4">{f.statLabel}</div>

                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-gold/10 group-hover:bg-gold/18 text-gold flex items-center justify-center mb-4 transition-colors duration-200">
                  {f.icon}
                </div>

                {/* Text */}
                <h4 className="text-base font-semibold font-[family-name:var(--font-sora)] text-white mb-2">
                  {f.title}
                </h4>
                <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
