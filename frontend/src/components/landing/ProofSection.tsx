"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const cards = [
  {
    title: "Built on real Marquette data",
    body: "5,300+ course records and 1,500+ requirement links are wired into the engine.",
  },
  {
    title: "Made for Business students",
    body: "12 majors, 13 tracks, and 7 minors — 32 programs built in and ready to plan.",
  },
  {
    title: "Same inputs, same plan",
    body: "The ranking is rules-based. No randomness. No vibes. No fake confidence.",
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
      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-sm uppercase tracking-widest font-semibold text-gold"
        >
          Why you can trust it
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mt-4 max-w-[42rem] text-[2.7rem] font-bold leading-tight text-white sm:text-[3.6rem]"
        >
          It is not just
          <span className="text-gold"> giving you ideas.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mt-4 max-w-[42rem] text-[1.08rem] leading-relaxed text-slate-400"
        >
          It checks real course data, real prereqs, and real requirement mappings —
          then gives you a cleaner path forward.
        </motion.p>

        <AnchorLine variant="gold" className="mt-12 mb-12 mx-0" />

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
                className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-5 text-center shine-sweep"
              >
                <div className="text-5xl font-bold leading-none text-gold">{stat.value}</div>
                <div className="mt-3 text-sm text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              <span className="text-gold font-semibold">Planning tool.</span> Not official advising.
            </div>
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              <span className="text-gold font-semibold">Double-check with your advisor</span> before you enroll.
            </div>
            <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-300">
              <span className="text-gold font-semibold">Built by a Marquette student.</span> So yes, it knows the pain.
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
