"use client";

import { motion, useReducedMotion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import styles from "./about.module.css";
import {
  ABOUT_BUILD_CARDS,
  ABOUT_KNOWN_ISSUES,
  ABOUT_RECENT_CHANGES,
} from "./aboutContent";

export function NowNextSection() {
  const reduce = useReducedMotion();

  const ease = [0.22, 1, 0.36, 1] as const;

  const viewAnim = (y: number, delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" as const },
          transition: { duration: 0.48, delay, ease },
        };

  return (
    <section className="relative overflow-hidden py-24 band-blue band-fade-top">
      {/* Gradient mesh layer */}
      <div className={styles.sectionMesh} />
      <div
        className={`${styles.sectionGlow} left-[12%] top-[24%] h-[16rem] w-[16rem]`}
        style={{ background: "rgba(255,204,0,0.05)" }}
      />
      <div
        className={`${styles.sectionGlow} right-[8%] bottom-[14%] h-[18rem] w-[18rem]`}
        style={{ background: "rgba(24,68,160,0.12)" }}
      />
      {/* Additional depth orbs */}
      <div
        className={`${styles.sectionGlow} left-[40%] top-[8%] h-[22rem] w-[22rem]`}
        style={{ background: "rgba(0,51,102,0.06)" }}
      />
      <div
        className={`${styles.sectionGlow} right-[25%] bottom-[5%] h-[14rem] w-[14rem]`}
        style={{ background: "rgba(255,204,0,0.04)" }}
      />

      <div className="relative z-10 mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <div className="mb-14 space-y-3 text-center">
          <motion.p
            {...viewAnim(8)}
            className="section-kicker justify-center"
          >
            What&apos;s next
          </motion.p>
          <motion.h2
            {...viewAnim(14, 0.08)}
            className="font-[family-name:var(--font-sora)] text-[2rem] font-bold leading-tight text-white md:text-[2.8rem]"
          >
            Here&apos;s what&apos;s on the roadmap.
          </motion.h2>
        </div>

        <AnchorLine variant="gold" className="mb-12" />

        {/* Recently shipped */}
        <div className="mb-10 space-y-3">
          <motion.p
            {...viewAnim(8)}
            className="section-kicker"
          >
            Recently shipped
          </motion.p>
          <motion.h3
            {...viewAnim(12, 0.06)}
            className="font-[family-name:var(--font-sora)] text-[1.6rem] font-bold text-white md:text-[1.9rem]"
          >
            What just dropped.
          </motion.h3>
          <motion.p
            {...viewAnim(10, 0.12)}
            className="max-w-[34rem] text-[0.95rem] leading-relaxed text-ink-muted"
          >
            New stuff that actually made it out of the backlog.
          </motion.p>
        </div>

        <div className="grid gap-7 sm:grid-cols-2 mb-14">
          {ABOUT_RECENT_CHANGES.map((card, index) => (
            <motion.article
              key={card.title}
              {...viewAnim(22, 0.12 * index)}
              whileHover={reduce ? undefined : { y: -6, scale: 1.018 }}
              className="glass-card card-glow-hover hover-ripple relative overflow-hidden rounded-[1.75rem] p-7"
            >
              <div className="absolute top-0 left-1/2 h-[2px] w-12 -translate-x-1/2 rounded-full bg-gold/70" />
              <div
                className="absolute inset-0 rounded-[1.75rem] pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, rgba(255, 204, 0, 0.06) 0%, transparent 70%)",
                }}
              />
              <p className="section-kicker relative z-[1] !text-[11px]">{card.eyebrow}</p>
              <h3 className="relative z-[1] mt-5 font-[family-name:var(--font-sora)] text-[1.28rem] font-semibold text-white">
                {card.title}
              </h3>
              <p className="relative z-[1] mt-3 text-[1rem] leading-relaxed text-ink-muted">{card.body}</p>
            </motion.article>
          ))}
        </div>

        <AnchorLine variant="gold" className="mb-12" />

        {/* In-progress fixes */}
        <div className="mb-10 space-y-3">
          <motion.p
            {...viewAnim(8)}
            className="section-kicker"
          >
            In progress
          </motion.p>
          <motion.h3
            {...viewAnim(12, 0.06)}
            className="font-[family-name:var(--font-sora)] text-[1.6rem] font-bold text-white md:text-[1.9rem]"
          >
            Still cooking.
          </motion.h3>
          <motion.p
            {...viewAnim(10, 0.12)}
            className="max-w-[34rem] text-[0.95rem] leading-relaxed text-ink-muted"
          >
            Known issues I&apos;m actively working on.
          </motion.p>
        </div>

        {/* Known issue + soft-prereqs explainer */}
        <motion.div
          {...viewAnim(18)}
          whileHover={reduce ? undefined : { y: -6, scale: 1.018 }}
          className="glass-card card-glow-hover hover-ripple relative overflow-hidden rounded-[1.75rem] border-l-[3px] border-l-amber-400/60 p-7 sm:p-9 mb-10"
        >
          <p className="section-kicker !text-[11px]">{ABOUT_KNOWN_ISSUES.eyebrow}</p>
          <h3 className="mt-4 font-[family-name:var(--font-sora)] text-[1.2rem] font-semibold text-white">
            {ABOUT_KNOWN_ISSUES.title}
          </h3>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-ink-muted">
            {ABOUT_KNOWN_ISSUES.body}
          </p>
          <h4 className="mt-5 font-[family-name:var(--font-sora)] text-[1rem] font-semibold text-gold">
            {ABOUT_KNOWN_ISSUES.subheading}
          </h4>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-muted">
            {ABOUT_KNOWN_ISSUES.detail}
          </p>
        </motion.div>

        <div className="grid gap-7 sm:grid-cols-2">
          {ABOUT_BUILD_CARDS.map((card, index) => (
            <motion.article
              key={card.title}
              {...viewAnim(22, 0.12 * index)}
              whileHover={reduce ? undefined : { y: -6, scale: 1.018 }}
              className="glass-card card-glow-hover hover-ripple relative overflow-hidden rounded-[1.75rem] p-7"
            >
              <div className="absolute top-0 left-1/2 h-[2px] w-12 -translate-x-1/2 rounded-full bg-gold/70" />
              <div
                className="absolute inset-0 rounded-[1.75rem] pointer-events-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, rgba(255, 204, 0, 0.06) 0%, transparent 70%)",
                }}
              />
              <p className="section-kicker relative z-[1] !text-[11px]">{card.eyebrow}</p>
              <h3 className="relative z-[1] mt-5 font-[family-name:var(--font-sora)] text-[1.28rem] font-semibold text-white">
                {card.title}
              </h3>
              <p className="relative z-[1] mt-3 text-[1rem] leading-relaxed text-ink-muted">{card.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
