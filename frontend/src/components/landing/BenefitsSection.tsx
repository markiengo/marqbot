"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { useReducedEffects } from "@/hooks/useReducedEffects";

type Benefit = {
  num: string;
  kicker: string;
  title: string;
  body: string;
  accent: "gold" | "blue";
};

const benefits: Benefit[] = [
  {
    num: "01",
    kicker: "Take now",
    title: "See what you can actually take.",
    body: "MarqBot checks prereqs, standing, and offering status before surfacing anything. No more planning around a class CheckMarq will reject.",
    accent: "gold",
  },
  {
    num: "02",
    kicker: "Catch early",
    title: "Spot bottlenecks before they spiral.",
    body: "Some courses quietly gate half your future. MarqBot surfaces those early — before they become a senior-year problem.",
    accent: "blue",
  },
  {
    num: "03",
    kicker: "Plan ahead",
    title: "See the next three semesters, not just the next one.",
    body: "Map out multiple terms at once. Scheduling traps are a lot easier to dodge when you can see them coming.",
    accent: "blue",
  },
  {
    num: "04",
    kicker: "Track it all",
    title: "Keep the whole degree map in view.",
    body: "Major, track, MCC, minors, and supporting buckets stay attached to every recommendation. Nothing falls through.",
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

        {/* 2×2 benefit grid */}
        <div className="feature-spotlight-rail mt-10 grid gap-5 sm:grid-cols-2">
          {benefits.map((benefit, index) => (
            <motion.article
              key={benefit.title}
              data-benefit={benefit.kicker.toLowerCase().replace(/\s+/g, "-")}
              initial={reduceEffects ? false : { opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: reduceEffects ? 0.18 : 0.5, delay: reduceEffects ? 0 : 0.12 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={reduceEffects ? undefined : { y: -5, scale: 1.015 }}
              className="feature-spotlight-step group relative overflow-hidden rounded-[1.5rem] border p-6 shine-sweep"
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: benefit.accent === "gold"
                    ? "radial-gradient(circle at 40% 0%, rgba(255,204,0,0.08), transparent 62%)"
                    : "radial-gradient(circle at 40% 0%, rgba(0,114,206,0.10), transparent 62%)",
                }}
              />
              {/* Decorative step number */}
              <span className="pointer-events-none absolute right-5 top-4 select-none text-[3.8rem] font-bold leading-none text-white/[0.04]">
                {benefit.num}
              </span>

              <div className="relative">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    benefit.accent === "gold" ? "bg-gold/12 text-gold" : "bg-blue-400/10 text-[#8ec8ff]"
                  }`}
                >
                  {benefit.kicker}
                </span>
                <h3 className="mt-4 text-[1.08rem] font-bold leading-tight text-white">
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
    </section>
  );
}
