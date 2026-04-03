"use client";

import { motion } from "motion/react";
import { useReducedEffects } from "@/hooks/useReducedEffects";

const capabilityCards = [
  {
    id: "take-now",
    eyebrow: "Take now",
    signal: "Prereqs + offering status",
    title: (
      <>
        <span className="text-white">See what you can actually </span>
        <span className="text-gold-light">take now</span>
        <span className="text-white">.</span>
      </>
    ),
    body: "The rank only starts after prereqs, standing, and offering status clear.",
  },
  {
    id: "bottlenecks",
    eyebrow: "Catch early",
    signal: "Course chains",
    title: (
      <>
        <span className="text-white">Spot bottlenecks before they get </span>
        <span className="text-gold-light">dramatic</span>
        <span className="text-white">.</span>
      </>
    ),
    body: "If one class controls three others, it shows up early enough to fix the term.",
  },
  {
    id: "see-farther",
    eyebrow: "Plan ahead",
    signal: "Multi-term drafts",
    title: (
      <>
        <span className="text-white">See farther than </span>
        <span className="text-gold-light">one term</span>
        <span className="text-white">.</span>
      </>
    ),
    body: "Draft more than one semester before internship timing and hard classes collide.",
  },
  {
    id: "whole-map",
    eyebrow: "Track it all",
    signal: "Bucket context attached",
    title: (
      <>
        <span className="text-white">Keep the whole degree map in </span>
        <span className="text-gold-light">view</span>
        <span className="text-white">.</span>
      </>
    ),
    body: "Major, track, MCC, minors, and support buckets stay attached to every suggestion.",
  },
] as const;

export function BenefitsSection() {
  const reduceEffects = useReducedEffects();

  return (
    <section
      id="features"
      data-testid="landing-features"
      data-reduced-motion={reduceEffects ? "true" : "false"}
      className="relative overflow-hidden bg-[linear-gradient(180deg,#061425_0%,#07192e_100%)] py-16 sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,204,0,0.10),transparent_26%),radial-gradient(circle_at_84%_16%,rgba(0,114,206,0.08),transparent_30%)]" />

      <div className="relative mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[52rem] text-center">
          <p className="text-[0.96rem] font-semibold uppercase tracking-[0.24em] text-gold-light">
            Why it helps
          </p>
          <h2 className="mt-4 text-[clamp(2.45rem,6vw,4.8rem)] font-bold leading-[0.94] tracking-[-0.05em] text-white">
            Less <span className="text-[#b6dcff]">guesswork.</span> More <span className="text-gold-light">clarity.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[42rem] text-[1.05rem] leading-relaxed text-slate-300">
            MarqBot narrows the next move fast, flags blockers early, and keeps the degree map attached to the recommendation.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {capabilityCards.map((card, index) => (
            <motion.article
              key={card.id}
              initial={reduceEffects ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={reduceEffects ? undefined : { y: -8, scale: 1.01 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: reduceEffects ? 0.18 : 0.42, delay: reduceEffects ? 0 : index * 0.05 }}
              className="group relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,46,0.92),rgba(7,20,38,0.96))] p-7 shadow-[0_26px_80px_rgba(0,0,0,0.24)] transition-shadow duration-300 hover:shadow-[0_32px_100px_rgba(0,0,0,0.30)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_14%,rgba(255,204,0,0.08),transparent_22%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute left-7 right-7 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.9),transparent)]"
                initial={reduceEffects ? false : { opacity: 0.35, scaleX: 0.45 }}
                whileInView={{ opacity: 1, scaleX: 1 }}
                whileHover={reduceEffects ? undefined : { scaleX: 1.12, opacity: 1 }}
                transition={{ duration: reduceEffects ? 0.16 : 0.45, delay: reduceEffects ? 0 : index * 0.06 }}
              />
              <div className="pointer-events-none absolute right-5 top-5 text-[4.6rem] font-semibold leading-none tracking-[-0.08em] text-white/[0.05]">
                {String(index + 1).padStart(2, "0")}
              </div>

              <p className="relative text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gold-light">
                {card.eyebrow}
              </p>
              <h3 className="relative mt-5 max-w-[20ch] text-[clamp(1.8rem,3vw,2.55rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                {card.title}
              </h3>
              <p className="relative mt-5 max-w-[34rem] text-[1.04rem] leading-relaxed text-slate-300">
                {card.body}
              </p>
              <motion.div
                initial={reduceEffects ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: reduceEffects ? 0.16 : 0.34, delay: reduceEffects ? 0 : 0.12 + index * 0.05 }}
                className="relative mt-6 inline-flex max-w-fit items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#9fd1ff]"
              >
                {card.signal}
              </motion.div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
