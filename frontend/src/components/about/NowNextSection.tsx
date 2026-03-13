"use client";

import { motion, useReducedMotion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import styles from "./about.module.css";
import { ABOUT_BUILD_CARDS } from "./aboutContent";

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
      <div
        className={`${styles.sectionGlow} left-[12%] top-[24%] h-[16rem] w-[16rem]`}
        style={{ background: "rgba(255,204,0,0.05)" }}
      />
      <div
        className={`${styles.sectionGlow} right-[8%] bottom-[14%] h-[18rem] w-[18rem]`}
        style={{ background: "rgba(24,68,160,0.12)" }}
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
            Here are the stuff I have on my to-dos.
          </motion.h2>
          <motion.p
            {...viewAnim(10, 0.16)}
            className="mx-auto max-w-[38rem] text-[0.98rem] leading-relaxed text-ink-muted sm:text-[1.05rem]"
          >
            The backlog is longer than my transcript. These four are winning right now.
          </motion.p>
        </div>

        <AnchorLine variant="gold" className="mb-12" />

        <div className="grid gap-7 sm:grid-cols-2">
          {ABOUT_BUILD_CARDS.map((card, index) => (
            <motion.article
              key={card.title}
              {...viewAnim(22, 0.12 * index)}
              whileHover={reduce ? undefined : { y: -6, scale: 1.018 }}
              className="glass-card card-glow-hover relative overflow-hidden rounded-[1.75rem] p-7"
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
