"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const cards = [
  {
    title: "Built on real Marquette data",
    body: "5,300+ course records and 1,500+ requirement links. Wired in, not vibed in.",
  },
  {
    title: "Made for Business students",
    body: "12 majors, 13 tracks, and 7 minors are built in and ready to plan.",
  },
  {
    title: "Same inputs, same plan",
    body: "Rules-based ranking. No randomness, no hand-waving, no main character energy.",
  },
];

const proofStats = [
  { value: "5,300+", label: "courses tracked" },
  { value: "32", label: "programs supported" },
  { value: "90", label: "requirement buckets" },
  { value: "1,500+", label: "requirement links" },
];

export function ProofSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="relative py-24 band-gold band-fade-top band-fade-bottom">
      <div className="mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-sm font-semibold uppercase tracking-widest text-gold"
        >
          Why this isn&apos;t guesswork
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mt-4 max-w-[42rem] text-[2.7rem] font-bold leading-tight text-white sm:text-[3.6rem]"
        >
          Built on
          <span className="text-gold"> the actual rules.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mt-4 max-w-[42rem] text-[1.08rem] leading-relaxed text-slate-400"
        >
          It checks course data, prereqs, and requirement mappings before it suggests anything.
        </motion.p>

        <AnchorLine variant="gold" className="mx-0 mt-12 mb-12" />

        <div className="grid gap-6 md:grid-cols-3">
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.22 + index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 ${
                index === 1 ? "pulse-gold-soft" : "pulse-blue-soft"
              }`}
            >
              <div className="h-1 w-12 rounded-full bg-gold" />
              <h3 className="mt-5 text-[1.42rem] font-semibold text-white">
                {card.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                {card.body}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 rounded-[2rem] border border-white/8 bg-[linear-gradient(145deg,rgba(15,35,70,0.88),rgba(8,20,42,0.70))] p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {proofStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.56 + index * 0.08 }}
                className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-5 text-center shine-sweep hover-ripple"
              >
                <div className="text-5xl font-bold leading-none text-gold">{stat.value}</div>
                <div className="mt-3 text-sm text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-gold">Planning tool.</span> Not official advising.
            </div>
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-gold">Double-check with your advisor</span> before registration week gets you.
            </div>
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              <span className="font-semibold text-gold">Built by a Marquette student.</span> It knows the difference between Raynor stress and O&apos;Brien stress.
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
