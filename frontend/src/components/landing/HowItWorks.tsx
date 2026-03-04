"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const steps = [
  {
    number: "01",
    title: "Pick your major and track.",
    body: "Start with the degree path you are actually on. No vague planner template nonsense.",
  },
  {
    number: "02",
    title: "Drop your completed courses.",
    body: "Tell MarqBot what you have finished so it stops pretending you still need things you already survived.",
  },
  {
    number: "03",
    title: "Get ranked next classes.",
    body: "Recommendations are filtered for eligibility, then ranked by what moves your degree forward fastest.",
  },
];

const rankingRules = [
  "If prereqs, standing, or offering do not work, the class is out.",
  "Core and major progress beat random filler.",
  "Gatekeeper courses move up before they bottleneck the rest.",
  "Two-for-one classes get rewarded.",
];

export function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative overflow-hidden band-deep py-24"
    >
      <div
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(600px 300px at 15% 10%, rgba(255,204,0,0.08), transparent 60%), radial-gradient(500px 320px at 82% 75%, rgba(0,114,206,0.10), transparent 58%)",
        }}
      />

      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10">
        <div className="max-w-[50rem]">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.35 }}
            className="text-sm font-semibold uppercase tracking-widest text-gold"
          >
            How it works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-4 text-[2.7rem] font-bold leading-tight text-white sm:text-[3.8rem]"
          >
            Three inputs. One clean plan.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="mt-4 max-w-[44rem] text-[1.1rem] leading-relaxed text-slate-400 sm:text-[1.25rem]"
          >
            The product should feel simple because the logic is doing the hard part.
            That is the whole point.
          </motion.p>
        </div>

        <AnchorLine variant="blue" className="mt-12 mb-12 mx-0" />

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, idx) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 22 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: 0.2 + idx * 0.1 }}
                className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold tracking-tight text-gold">
                    {step.number}
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Step
                  </span>
                </div>
                <h3 className="mt-5 text-[1.45rem] font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-slate-400">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="rounded-[1.9rem] border border-gold/18 bg-[linear-gradient(160deg,rgba(255,204,0,0.08),rgba(14,28,58,0.40))] p-7"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">
              What gets ranked highest
            </p>
            <h3 className="mt-4 text-[2rem] font-bold leading-tight text-white">
              Clear logic. Dry delivery. No vibes.
            </h3>
            <div className="mt-6 space-y-3">
              {rankingRules.map((rule) => (
                <div
                  key={rule}
                  className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm leading-relaxed text-slate-200"
                >
                  {rule}
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-400">
              I assume you pass everything. Keep your courses updated so the plan
              stays useful.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
