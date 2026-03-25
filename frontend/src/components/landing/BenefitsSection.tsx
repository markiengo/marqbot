"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const benefits = [
  {
    kicker: "Take now",
    title: "See what you can actually take.",
    body: "No more planning around a class CheckMarq will reject.",
    accent: "gold",
  },
  {
    kicker: "Catch early",
    title: "Spot bottlenecks before they spiral.",
    body: "Some courses quietly gate half your future. MarqBot surfaces those early.",
    accent: "blue",
  },
  {
    kicker: "Track it all",
    title: "Core, major, track, MCC, minors.",
    body: "Every requirement bucket in one place.",
    accent: "gold",
  },
];

export function BenefitsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative overflow-hidden py-14 band-blue band-fade-top">
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

      <div className="mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="mx-auto max-w-[48rem] text-center">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.35 }}
            className="text-xs font-semibold uppercase tracking-widest text-gold"
          >
            Why it helps
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="mt-3 text-[1.8rem] font-bold leading-tight text-white sm:text-[2.4rem]"
          >
            Less <span className="text-gold">anxiety.</span> More <span className="text-emphasis-blue">clarity.</span>
          </motion.h2>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.18 + index * 0.1 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="group relative overflow-hidden rounded-[1.4rem] border p-5"
              style={{
                background: "linear-gradient(145deg, rgba(15,35,70,0.88), rgba(10,24,50,0.72))",
                borderColor:
                  benefit.accent === "gold" ? "rgba(255,204,0,0.18)" : "rgba(0,114,206,0.22)",
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
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    benefit.accent === "gold"
                      ? "bg-gold/12 text-gold"
                      : "bg-blue-400/10 text-[#8ec8ff]"
                  }`}
                >
                  {benefit.kicker}
                </span>
                <h3 className="mt-4 text-base font-semibold leading-tight text-white">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
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
