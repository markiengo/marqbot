"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import styles from "./about.module.css";
import { ABOUT_HERO_COPY, ABOUT_INTRO_COPY, ABOUT_INTRO_LABELS } from "./aboutContent";

export function AboutHero() {
  const reduce = useReducedMotion();
  const [headlineLead, headlineTail = ""] = ABOUT_HERO_COPY.headline.split("MarqBot");

  const ease = [0.22, 1, 0.36, 1] as const;

  const anim = (y: number, delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease },
        };

  const viewAnim = (y: number, delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" as const },
          transition: { duration: 0.5, delay, ease },
        };

  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "#07101e" }}>
      {/* Atmospheric layers */}
      <div className={styles.heroBackdrop} />
      <div className={styles.gridOverlay} />
      <div
        className={`${styles.sectionGlow} left-[12%] top-[14%] h-[18rem] w-[18rem]`}
        style={{ background: "rgba(255,204,0,0.08)" }}
      />
      <div
        className={`${styles.sectionGlow} right-[8%] top-[30%] h-[20rem] w-[20rem]`}
        style={{ background: "rgba(24,68,160,0.16)" }}
      />

      <div className="relative z-10 mx-auto max-w-[72rem] px-5 sm:px-7 lg:px-10">
        {/* ── Top: headline + eyebrow ─────────────────────────── */}
        <div className="mx-auto max-w-[46rem] text-center mb-16">
          <motion.div {...anim(10)} className="mb-8">
            <span className="inline-block rounded-full border border-gold/25 bg-gold/8 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-gold pulse-gold-soft">
              {ABOUT_HERO_COPY.eyebrow}
            </span>
          </motion.div>

          <motion.h1
            {...anim(20, 0.08)}
            className="font-[family-name:var(--font-sora)] text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl"
          >
            {headlineLead}
            <span className="text-emphasis-gold">MarqBot</span>
            {headlineTail}
          </motion.h1>

          <motion.p
            {...anim(14, 0.16)}
            className="mx-auto mt-6 max-w-[36rem] text-[1rem] leading-relaxed text-ink-muted sm:text-[1.08rem]"
          >
            {ABOUT_HERO_COPY.body}
          </motion.p>
        </div>

        {/* ── Founder card: photo sidebar + intro ─────────────── */}
        <motion.div
          {...viewAnim(24)}
          className="glass-card card-glow-hover rounded-[2rem] p-6 sm:p-8 relative overflow-hidden"
        >
          {/* Internal atmospheric glow */}
          <div className="absolute inset-0 rounded-[2rem] pointer-events-none" style={{
            background: "radial-gradient(ellipse 60% 50% at 85% 15%, rgba(255, 204, 0, 0.06), transparent), radial-gradient(ellipse 50% 40% at 10% 85%, rgba(0, 114, 206, 0.05), transparent)"
          }} />

          <div className="relative z-[1] grid gap-6 lg:grid-cols-[280px_1fr] items-start">
            {/* Photo card */}
            <div className="mx-auto lg:mx-0 w-full max-w-[280px]">
              <div className={`${styles.photoPanel} rounded-2xl overflow-hidden`}>
                <Image
                  src="/assets/about/founder_pic.jpg"
                  alt="Markie Ngo"
                  width={560}
                  height={680}
                  className="w-full object-cover aspect-[4/5]"
                />
              </div>
              {/* Name + pills under photo */}
              <div className="mt-4 text-center lg:text-left">
                <h3 className="font-[family-name:var(--font-sora)] text-lg font-bold text-white">
                  Markie Ngo
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5 justify-center lg:justify-start">
                  {ABOUT_INTRO_LABELS.map((label) => (
                    <span
                      key={label}
                      className={`${styles.miniPill} rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Intro text */}
            <div className="flex flex-col justify-center">
              <p className="section-kicker mb-4">
                Built by a Marquette student
              </p>

              <h2 className="font-[family-name:var(--font-sora)] text-[1.75rem] font-bold leading-tight text-white sm:text-[2.15rem]">
                {ABOUT_INTRO_COPY.title}
              </h2>

              <p className="mt-4 max-w-[39rem] text-[0.98rem] leading-relaxed text-ink-secondary sm:text-[1.03rem]">
                {ABOUT_INTRO_COPY.paragraphOne}
              </p>

              <p className="mt-4 max-w-[39rem] text-[0.98rem] leading-relaxed text-ink-secondary sm:text-[1.03rem]">
                {ABOUT_INTRO_COPY.paragraphTwo}
              </p>

              <div className="mt-6 inline-flex glass-card rounded-2xl px-4 py-3 max-w-fit">
                <p className="text-sm italic leading-relaxed text-gold/85">{ABOUT_INTRO_COPY.note}</p>
              </div>
            </div>
          </div>
        </motion.div>

        <AnchorLine variant="gold" className="mt-12" />
      </div>
    </section>
  );
}
