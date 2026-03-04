"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";

const benefits = [
  {
    kicker: "Take now",
    title: "See what you can actually take.",
    body: "No more building a perfect plan around a class you cannot even register for yet.",
    accent: "gold",
  },
  {
    kicker: "Catch early",
    title: "Spot bottlenecks before they get ugly.",
    body: "Some classes block a bunch of others. MarqBot pushes those up before they ruin the timeline.",
    accent: "blue",
  },
  {
    kicker: "Stay clear",
    title: "Know what still counts.",
    body: "Core. Major. MCC. You can see what matters and what can wait.",
    accent: "gold",
  },
];

export function BenefitsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-24 overflow-hidden band-blue band-fade-top">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div
          className="absolute top-12 left-[10%] h-[20rem] w-[20rem] rounded-full blur-[110px]"
          style={{ background: "rgba(255,204,0,0.05)" }}
        />
        <div
          className="absolute bottom-8 right-[8%] h-[18rem] w-[18rem] rounded-full blur-[90px]"
          style={{ background: "rgba(0,114,206,0.12)" }}
        />
      </div>

      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10">
        <div className="max-w-[48rem] text-center mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.35 }}
            className="text-sm font-semibold uppercase tracking-widest text-gold"
          >
            Why students use it
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-4 text-[2.8rem] sm:text-[3.7rem] font-bold leading-tight text-white"
          >
            Less guessing.
            <br />
            <span className="text-gold">More clear next moves.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="mt-4 text-[1.1rem] sm:text-[1.25rem] leading-relaxed text-slate-400"
          >
            The point is simple: help you pick better classes faster, without
            opening five tabs and hoping for the best.
          </motion.p>
        </div>

        <AnchorLine variant="gold" className="mt-12 mb-12" />

        <div className="grid gap-7 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.24 + index * 0.12 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className={`group relative overflow-hidden rounded-[1.9rem] border p-7 ${
                benefit.accent === "gold" ? "pulse-gold-soft" : "pulse-blue-soft"
              }`}
              style={{
                background: "linear-gradient(145deg, rgba(15,35,70,0.88), rgba(10,24,50,0.72))",
                borderColor:
                  benefit.accent === "gold" ? "rgba(255,204,0,0.18)" : "rgba(0,114,206,0.22)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              }}
            >
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    benefit.accent === "gold"
                      ? "radial-gradient(circle at 50% 0%, rgba(255,204,0,0.08), transparent 65%)"
                      : "radial-gradient(circle at 50% 0%, rgba(0,114,206,0.10), transparent 65%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      benefit.accent === "gold"
                        ? "bg-gold/12 text-gold"
                        : "bg-blue-400/10 text-[#8ec8ff]"
                    }`}
                  >
                    {benefit.kicker}
                  </span>
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3 + index, repeat: Infinity, ease: "easeInOut" }}
                    className={`h-3 w-3 rounded-full ${
                      benefit.accent === "gold" ? "bg-gold" : "bg-[#8ec8ff]"
                    }`}
                  />
                </div>
                <h3 className="mt-6 text-[1.55rem] font-semibold leading-tight text-white">
                  {benefit.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  {benefit.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
