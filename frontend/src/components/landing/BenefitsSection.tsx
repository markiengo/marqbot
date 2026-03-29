"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useReducedEffects } from "@/hooks/useReducedEffects";

type Benefit = {
  kicker: string;
  title: string;
  body: string;
  accent: "gold" | "blue";
  detail?: string;
};

const benefits: Benefit[] = [
  {
    kicker: "Take now",
    title: "See what you can actually take.",
    body: "No more planning around a class CheckMarq will reject.",
    accent: "gold",
    detail: "MarqBot checks prereqs, standing, and offering status before surfacing anything. No guessing.",
  },
  {
    kicker: "Catch early",
    title: "Spot bottlenecks before they spiral.",
    body: "Some courses quietly gate half your future. MarqBot surfaces those early.",
    accent: "blue",
  },
  {
    kicker: "Track it all",
    title: "Keep the whole degree map in view.",
    body: "Major, track, MCC, minors, and supporting buckets stay attached to the recommendation.",
    accent: "gold",
  },
];

export function BenefitsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const reduceEffects = useReducedEffects();
  const inView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section
      id="feature-spotlight"
      data-testid="feature-spotlight"
      data-reduced-motion={reduceEffects ? "true" : "false"}
      ref={sectionRef}
      className="feature-spotlight-shell relative overflow-hidden py-20 band-blue band-fade-top"
    >
      {/* Hero-to-spotlight seam */}
      <div className="feature-spotlight-seam absolute top-0 left-0 right-0 h-[2px] w-full" />

      {!reduceEffects && (
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute left-[10%] top-12 h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(255,204,0,0.08),rgba(255,204,0,0.04)_40%,transparent_74%)] opacity-90" />
          <div className="absolute bottom-8 right-[8%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(0,114,206,0.14),rgba(0,114,206,0.07)_42%,transparent_74%)] opacity-95" />
        </div>
      )}

      <div className="mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[48rem] text-center">
          <motion.p
            initial={reduceEffects ? false : { opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: reduceEffects ? 0.18 : 0.35 }}
            className="text-xs font-semibold uppercase tracking-[0.24em] text-gold"
          >
            Why it helps
          </motion.p>
          <motion.h2
            initial={reduceEffects ? false : { opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: reduceEffects ? 0.18 : 0.45, delay: reduceEffects ? 0 : 0.08 }}
            className="mt-3 text-[clamp(1.8rem,5vw,4rem)] font-bold leading-[0.96] tracking-[-0.03em] text-white"
          >
            Less <span className="text-gold">anxiety.</span> More <span className="text-emphasis-blue">clarity.</span>
          </motion.h2>
          <motion.p
            initial={reduceEffects ? false : { opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: reduceEffects ? 0.18 : 0.4, delay: reduceEffects ? 0 : 0.16 }}
            className="mx-auto mt-4 max-w-[38rem] text-[0.98rem] leading-relaxed text-slate-300"
          >
            MarqBot narrows the next move fast, flags bottlenecks early, and keeps the whole degree map attached to the recommendation.
          </motion.p>
        </div>

        {/* Asymmetric spotlight rail: dominant card left, supporting stack right */}
        <div className="feature-spotlight-rail mt-10 grid gap-5 md:grid-cols-[1.5fr_1fr]">

          {/* Dominant card — permanently active */}
          <motion.article
            data-benefit="take-now"
            data-active="true"
            initial={reduceEffects ? false : { opacity: 0, x: -28, y: 16 }}
            animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
            transition={{ duration: reduceEffects ? 0.18 : 0.56, ease: [0.22, 1, 0.36, 1] }}
            className="feature-spotlight-step group relative flex flex-col overflow-hidden rounded-[1.6rem] border p-7"
          >
            <div
              className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "radial-gradient(circle at 30% 0%, rgba(255,204,0,0.10), transparent 65%)" }}
            />
            <div className="relative flex h-full flex-col">
              <span className="feature-spotlight-chip">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                {benefits[0].kicker}
              </span>
              <h3 className="mt-5 text-[1.55rem] font-bold leading-tight tracking-tight text-white sm:text-[1.9rem]">
                {benefits[0].title}
              </h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-300">
                {benefits[0].body}
              </p>
              {benefits[0].detail && (
                <p className="mt-4 border-t border-white/8 pt-4 text-sm leading-relaxed text-slate-400">
                  {benefits[0].detail}
                </p>
              )}
              <div className="mt-auto flex items-center gap-2 pt-6">
                <span className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-gold/60">
                  Why it&apos;s first
                </span>
              </div>
            </div>
          </motion.article>

          {/* Supporting cards stacked */}
          <div className="grid gap-5">
            {benefits.slice(1).map((benefit, i) => (
              <motion.article
                key={benefit.title}
                data-benefit={benefit.kicker.toLowerCase().replace(/\s+/g, "-")}
                initial={reduceEffects ? false : { opacity: 0, x: 22, y: 16 }}
                animate={inView ? { opacity: 1, x: 0, y: 0 } : {}}
                transition={{ duration: reduceEffects ? 0.18 : 0.5, delay: reduceEffects ? 0 : 0.16 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduceEffects ? undefined : { y: -4, scale: 1.01 }}
                className="feature-spotlight-step group relative overflow-hidden rounded-[1.4rem] border p-5 shine-sweep"
              >
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: benefit.accent === "gold"
                      ? "radial-gradient(circle at 50% 0%, rgba(255,204,0,0.07), transparent 65%)"
                      : "radial-gradient(circle at 50% 0%, rgba(0,114,206,0.09), transparent 65%)",
                  }}
                />
                <div className="relative">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      benefit.accent === "gold" ? "bg-gold/12 text-gold" : "bg-blue-400/10 text-[#8ec8ff]"
                    }`}
                  >
                    {benefit.kicker}
                  </span>
                  <h3 className="mt-3 text-[0.95rem] font-semibold leading-tight text-white">
                    {benefit.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {benefit.body}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
