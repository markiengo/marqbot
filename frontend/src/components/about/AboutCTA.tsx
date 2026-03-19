"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import styles from "./about.module.css";
import { ABOUT_CONTACT_LINKS } from "./aboutContent";
import type { AboutContactLink } from "./aboutContent";

function ContactIcon({ icon }: { icon: AboutContactLink["icon"] }) {
  const cls = "w-5 h-5";
  switch (icon) {
    case "email":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="m2 7 10 6 10-6" />
        </svg>
      );
    case "github":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      );
    case "instagram":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      );
  }
}

export function AboutCTA() {
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
    <section className="relative py-24 band-blue-gold band-fade-top overflow-hidden">
      {/* Section-level gradient mesh */}
      <div className={styles.sectionMesh} />
      <div className="mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <motion.div
          {...viewAnim(24)}
          className="relative overflow-hidden rounded-3xl glass-card px-8 py-12 text-center shadow-[0_8px_40px_rgba(0,0,0,0.28),0_0_60px_rgba(255,204,0,0.04)] md:px-12"
        >
          {/* Aurora gradient behind card content */}
          <div className={styles.ctaAurora} />
          <div
            className={`${styles.sectionGlow} -left-16 -top-16 h-72 w-72`}
            style={{ background: "rgba(255,204,0,0.08)" }}
          />
          <div
            className={`${styles.sectionGlow} -bottom-12 -right-10 h-64 w-64`}
            style={{ background: "rgba(24,68,160,0.14)" }}
          />
          <div
            className={`${styles.sectionGlow} left-[40%] top-[60%] h-48 w-48`}
            style={{ background: "rgba(0,51,102,0.06)" }}
          />

          <div className="relative z-10">
            <AnchorLine variant="gold" className="mb-8" />

            <motion.p
              {...viewAnim(8, 0.08)}
              className="section-kicker justify-center"
            >
              Reach out
            </motion.p>

            <motion.h2
              {...viewAnim(12, 0.14)}
              className="mx-auto mt-4 max-w-[36rem] font-[family-name:var(--font-sora)] text-[2rem] font-bold leading-tight text-white sm:text-[2.6rem]"
            >
              Found a bug? Have a feature idea? Need to vent?
            </motion.h2>

            <motion.p
              {...viewAnim(10, 0.22)}
              className="mx-auto mt-4 max-w-[34rem] text-[0.98rem] leading-relaxed text-ink-muted sm:text-[1.05rem]"
            >
              Bug reports, feature ideas, prereq corrections -- all of it is useful. I read everything.
            </motion.p>

            <motion.p
              {...viewAnim(10, 0.25)}
              className="mx-auto mt-3 max-w-[34rem] text-sm leading-relaxed text-ink-secondary"
            >
              Fastest route: hit the Feedback button inside the planner. If CheckMarq and MarqBot disagree, definitely send it, one of us is wrong and I&apos;d rather know.
            </motion.p>

            <motion.div
              {...viewAnim(10, 0.28)}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <Link
                href="/onboarding"
                className="inline-flex min-w-[170px] items-center justify-center rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-navy-dark shadow-[0_0_24px_rgba(255,204,0,0.22)] transition-colors hover:bg-gold-light pulse-gold-soft"
              >
                Try MarqBot
              </Link>
              <a
                href="mailto:markie.ngo@marquette.edu"
                className="inline-flex min-w-[170px] items-center justify-center rounded-xl glass-card px-5 py-3 text-sm font-medium text-ink-primary transition-all hover:border-gold/25"
              >
                Email Markie
              </a>
            </motion.div>

            <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ABOUT_CONTACT_LINKS.map((link, index) => {
                const external = link.href.startsWith("http");
                return (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    {...viewAnim(18, 0.34 + 0.06 * index)}
                    className="glass-card card-glow-hover flex items-center gap-3 rounded-2xl px-4 py-4 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-gold/80">
                      <ContactIcon icon={link.icon} />
                    </div>
                    <div className="min-w-0">
                      <p className="section-kicker !text-[10px]">{link.label}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">{link.handle}</p>
                    </div>
                  </motion.a>
                );
              })}
            </div>

            <p className="mt-8 text-sm leading-relaxed text-ink-muted">
              Pro tip: include the course code and what you expected to happen. Screenshots are an automatic W.
            </p>

            <AnchorLine variant="fade" className="mt-8" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
