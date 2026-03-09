"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const steps = [
  {
    number: "01",
    title: "Pick your programs.",
    body: "Add the major, track, and extras you have actually declared.",
  },
  {
    number: "02",
    title: "Add your classes.",
    body: "Mark what is done and what is still in progress.",
  },
  {
    number: "03",
    title: "Get your full plan.",
    body: "See your next semesters ranked by real requirement logic.",
  },
];

const checks = [
  "Are you eligible right now?",
  "Does it unlock future classes?",
  "Does it count toward an actual requirement?",
];

export function HowItWorksClear() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative overflow-hidden py-24 band-deep"
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
            className="text-sm font-semibold uppercase tracking-widest text-gold"
          >
            How it works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-4 text-[2.8rem] font-bold leading-tight text-white sm:text-[3.7rem]"
          >
            Three steps.
            <br />
            <span className="text-emphasis-blue">No bulletin archaeology.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="mt-4 max-w-[44rem] text-[1.08rem] leading-relaxed text-slate-400 sm:text-[1.22rem]"
          >
            The setup is short. The sorting logic is not.
          </motion.p>
        </div>

        <AnchorLine variant="blue" className="mx-0 mt-12 mb-12" />

        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.45, delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="rounded-[1.8rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shine-sweep"
              >
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold tracking-tight text-gold">
                    {step.number}
                  </span>
                  <motion.span
                    animate={{ rotate: [0, 8, 0] }}
                    transition={{ duration: 2.8 + index, repeat: Infinity, ease: "easeInOut" }}
                    className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400"
                  >
                    Step
                  </motion.span>
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
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="rounded-[1.9rem] border border-gold/18 bg-[linear-gradient(160deg,rgba(255,204,0,0.08),rgba(14,28,58,0.40))] p-7 float-soft"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">
              What MarqBot checks
            </p>
            <h3 className="mt-4 text-[2rem] font-bold leading-tight text-white">
              Rules first.
              <br />
              <span className="text-gold">Jokes second.</span>
            </h3>
            <div className="mt-6 space-y-3">
              {checks.map((check, index) => (
                <motion.div
                  key={check}
                  initial={{ opacity: 0, x: 16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.36 + index * 0.08 }}
                  className="rounded-2xl border border-white/8 bg-black/10 px-4 py-3 text-sm leading-relaxed text-slate-200"
                >
                  {check}
                </motion.div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-400">
              If a class is a bad move, it drops out of the list. Simple.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
