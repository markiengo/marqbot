"use client";

import { motion } from "motion/react";
import { useReducedEffects } from "@/hooks/useReducedEffects";

const proofCards = [
  {
    title: "Built on real Marquette data",
    body: "5,300+ course records and 1,500+ requirement links. All verified against the bulletin.",
  },
  {
    title: "Made for Business students",
    body: "12 majors, 13 tracks, and 7 minors are built in and ready to plan.",
  },
  {
    title: "Same inputs, same plan",
    body: "Rules-based ranking. No randomness, no hand-waving, no main character energy.",
  },
] as const;

const metrics = [
  { value: "5,300+", label: "courses tracked" },
  { value: "32", label: "programs supported" },
  { value: "90", label: "requirement buckets" },
  { value: "1,500+", label: "requirement links" },
] as const;

const trustNotes = [
  {
    lead: "Planning tool.",
    body: "Not official advising.",
  },
  {
    lead: "Double-check with your advisor",
    body: "before registration week gets ugly.",
  },
  {
    lead: "Built by a Marquette student.",
    body: "It knows the difference between Raynor stress and O'Brien stress.",
  },
] as const;

export function ProofSection() {
  const reduceEffects = useReducedEffects();

  return (
    <section
      id="proof"
      data-testid="landing-proof"
      data-reduced-motion={reduceEffects ? "true" : "false"}
      className="relative overflow-hidden bg-[linear-gradient(180deg,#131207_0%,#171608_100%)] py-16 sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,204,0,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(0,114,206,0.06),transparent_28%)]" />

      <div className="relative mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="max-w-[54rem]">
          <p className="text-[0.96rem] font-semibold uppercase tracking-[0.24em] text-gold-light">
            Why this is not guesswork
          </p>
          <h2 className="mt-5 text-[clamp(2.8rem,6vw,5rem)] font-bold leading-[0.94] tracking-[-0.055em] text-white">
            Built on <span className="text-gold-light">the actual rules.</span>
          </h2>
          <p className="mt-5 max-w-[50rem] text-[1.08rem] leading-relaxed text-slate-300">
            It checks course data, prereqs, and requirement mappings before it suggests anything.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <div className="h-px w-56 bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.92),transparent)]" />
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {proofCards.map((card, index) => (
            <motion.article
              key={card.title}
              initial={reduceEffects ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: reduceEffects ? 0.18 : 0.42, delay: reduceEffects ? 0 : index * 0.05 }}
              className="rounded-[1.9rem] border border-gold/10 bg-[linear-gradient(180deg,rgba(38,34,18,0.88),rgba(27,25,14,0.92))] p-7 shadow-[0_22px_70px_rgba(0,0,0,0.20)]"
            >
              <div className="h-1 w-14 rounded-full bg-[linear-gradient(90deg,#ffcc00,#ffe48a)]" />
              <h3 className="mt-7 text-[clamp(1.7rem,2.5vw,2.4rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-white">
                {card.title}
              </h3>
              <p className="mt-5 text-[1rem] leading-relaxed text-slate-300">{card.body}</p>
            </motion.article>
          ))}
        </div>

        <div className="mt-10 rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,28,54,0.94),rgba(10,25,47,0.96))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
          <div className="grid gap-3 lg:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[1.45rem] border border-white/8 bg-white/[0.03] px-5 py-6 text-center"
              >
                <p className="text-[clamp(2.8rem,4vw,4rem)] font-bold leading-none tracking-[-0.06em] text-gold-light">
                  {metric.value}
                </p>
                <p className="mt-4 text-base text-slate-400">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {trustNotes.map((note) => (
              <div
                key={note.lead}
                className="rounded-[1.45rem] border border-white/8 bg-white/[0.03] px-5 py-6 text-[1rem] leading-relaxed text-slate-300"
              >
                <span className="font-semibold text-gold-light">{note.lead}</span> {note.body}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
