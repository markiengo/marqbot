"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const steps = [
  {
    number: "01",
    title: "Pick your programs.",
    body: "Major, track, whatever you declared.",
  },
  {
    number: "02",
    title: "Add your classes.",
    body: "Done and in progress. MarqBot handles the rest.",
  },
  {
    number: "03",
    title: "Get your plan.",
    body: "Next semesters, ranked by degree rules.",
  },
];

const checks = [
  "Eligible right now?",
  "Unlocks future classes?",
  "Counts toward a requirement?",
];

export function HowItWorksClear() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative overflow-hidden py-16 band-deep"
    >
      <div
        className="absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(620px 320px at 15% 10%, rgba(255,204,0,0.08), transparent 60%), radial-gradient(540px 320px at 82% 75%, rgba(0,114,206,0.10), transparent 58%)",
        }}
      />

      <div className="mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="max-w-[50rem]">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.35 }}
            className="text-xs font-semibold uppercase tracking-widest text-gold"
          >
            How it works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-3 text-[1.8rem] font-bold leading-tight text-white sm:text-[2.4rem]"
          >
            Three steps.{" "}
            <span className="text-emphasis-blue">Done between classes.</span>
          </motion.h2>
        </div>

        <AnchorLine variant="blue" className="mx-0 mt-8 mb-8" />

        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shine-sweep"
              >
                <span className="text-2xl font-bold tracking-tight text-gold">
                  {step.number}
                </span>
                <h3 className="mt-3 text-base font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="rounded-[1.4rem] border border-gold/18 bg-[linear-gradient(160deg,rgba(255,204,0,0.08),rgba(14,28,58,0.40))] p-5 float-soft"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              What MarqBot checks
            </p>
            <h3 className="mt-3 text-lg font-bold leading-tight text-white">
              Rules first. <span className="text-gold">Vibes second.</span>
            </h3>
            <div className="mt-4 space-y-2">
              {checks.map((check, index) => (
                <motion.div
                  key={check}
                  initial={{ opacity: 0, x: 16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.36 + index * 0.08 }}
                  className="rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs leading-relaxed text-slate-200"
                >
                  {check}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
