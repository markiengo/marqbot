"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import styles from "./about.module.css";
import { ABOUT_INTRO_COPY, ABOUT_INTRO_LABELS } from "./aboutContent";

export function FounderIntro() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative py-20 band-gold band-fade-top band-fade-bottom">
      <div
        className={`${styles.sectionGlow} left-[8%] top-[18%] h-[14rem] w-[14rem]`}
        style={{ background: "rgba(255,204,0,0.06)" }}
      />
      <div
        className={`${styles.sectionGlow} right-[10%] bottom-[12%] h-[16rem] w-[16rem]`}
        style={{ background: "rgba(24,68,160,0.12)" }}
      />

      <div className="relative z-10 mx-auto max-w-[92rem] px-5 sm:px-7 lg:px-10">
        <div className="grid gap-6 rounded-[2rem] border border-white/8 bg-[linear-gradient(145deg,rgba(15,35,70,0.88),rgba(8,20,42,0.70))] p-6 lg:grid-cols-[0.92fr_1.08fr]">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={shouldReduceMotion ? undefined : { duration: 0.48 }}
            className={`${styles.photoPanel} rounded-[1.6rem]`}
          >
            <div className="overflow-hidden rounded-[1.45rem] border border-white/8">
              <Image
                src="/assets/about/founder_pic.jpg"
                alt="Markie Ngo"
                width={720}
                height={880}
                className="h-full w-full object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 24 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={shouldReduceMotion ? undefined : { duration: 0.5, delay: 0.05 }}
            className="flex flex-col justify-center"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">
              Built by a Marquette student
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {ABOUT_INTRO_LABELS.map((label) => (
                <span
                  key={label}
                  className={`${styles.miniPill} rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]`}
                >
                  {label}
                </span>
              ))}
            </div>

            <h2 className="mt-5 font-[family-name:var(--font-sora)] text-[1.9rem] font-bold leading-tight text-white sm:text-[2.35rem]">
              {ABOUT_INTRO_COPY.title}
            </h2>

            <p className="mt-4 max-w-[39rem] text-[0.98rem] leading-relaxed text-slate-300 sm:text-[1.03rem]">
              {ABOUT_INTRO_COPY.paragraphOne}
            </p>

            <p className="mt-4 max-w-[39rem] text-[0.98rem] leading-relaxed text-slate-300 sm:text-[1.03rem]">
              {ABOUT_INTRO_COPY.paragraphTwo}
            </p>

            <div className="mt-6 inline-flex rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
              <p className="text-sm italic leading-relaxed text-gold/85">{ABOUT_INTRO_COPY.note}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
