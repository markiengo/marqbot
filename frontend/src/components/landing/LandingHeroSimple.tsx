"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { useReducedEffects } from "@/hooks/useReducedEffects";

const topCourse = {
  code: "ACCO 3001",
  title: "Intermediate Accounting I",
  detail: "Starts a real sequence before the prereq chain gets ideas.",
  tags: ["Counts now", "Unlocks ACCO 4020", "Open this term"],
};

const nextCourses = [
  {
    code: "BULA 3001",
    title: "Legal and Ethical Environment of Business",
    detail: "Real requirement. Not a side quest.",
  },
  {
    code: "FINA 3001",
    title: "Intro to Finance",
    detail: "Opens a longer chain. Handle it before it handles you.",
  },
];

const heroProof = [
  {
    label: "5,300+ course records wired in",
    className:
      "float-soft border-gold/30 bg-gold/12 text-gold shadow-[0_0_24px_rgba(255,204,0,0.14)]",
  },
  {
    label: "Rules-based ranking",
    className:
      "float-soft-delay border-[#8ec8ff]/22 bg-[#8ec8ff]/10 text-[#8ec8ff] shadow-[0_0_24px_rgba(0,114,206,0.12)]",
  },
  {
    label: "Built for Marquette Business",
    className: "border-white/10 bg-white/[0.04] text-slate-200",
  },
];

export function LandingHeroSimple() {
  const reduceEffects = useReducedEffects();

  return (
    <section
      id="landing-hero"
      data-testid="landing-hero"
      data-reduced-motion={reduceEffects ? "true" : "false"}
      className="landing-hero-shell relative overflow-hidden band-deep"
      style={{ background: "#07101e" }}
    >
      <div className="landing-hero-ambient pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_88%_62%_at_50%_0%,rgba(0,114,206,0.2),transparent_58%),radial-gradient(ellipse_74%_48%_at_78%_22%,rgba(255,204,0,0.14),transparent_56%),radial-gradient(ellipse_54%_40%_at_20%_78%,rgba(0,114,206,0.16),transparent_62%)]" />
        {!reduceEffects && (
          <>
            <div className="absolute left-[4%] top-[10%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(255,204,0,0.12),rgba(255,204,0,0.04)_46%,transparent_74%)] opacity-90" />
            <div className="absolute right-[-6rem] top-[14%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(0,114,206,0.18),rgba(0,114,206,0.06)_42%,transparent_76%)] opacity-95" />
            <div className="landing-hero-grid absolute inset-0 opacity-[0.045]" />
          </>
        )}
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[92rem] flex-col items-center justify-center px-5 pb-14 pt-24 sm:px-7 lg:px-10">
        <motion.div
          initial={reduceEffects ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceEffects ? 0.18 : 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[44rem] text-center"
        >
          <span className="inline-flex items-center justify-center rounded-full border border-gold/25 bg-gold/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-gold">
            For Marquette Business Students
          </span>

          <h1 className="mt-6 text-center text-[clamp(3rem,7vw,5.9rem)] font-bold leading-[0.92] tracking-[-0.04em] text-white">
            <span className="block -translate-x-4 text-center sm:whitespace-nowrap">Know what to take next.</span>
            <span className="mt-2 block text-center text-emphasis-blue">Before registration</span>
            <span className="block text-center text-gradient-gold">turns into a side quest.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-[36rem] text-[1rem] leading-relaxed text-slate-300 sm:text-[1.05rem]">
            MarqBot reads the degree rules and tells you what to take next.
          </p>

          <div className="landing-hero-cta mx-auto mt-8 grid w-full max-w-[34rem] grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/onboarding" className="flex w-full">
              <Button
                variant="gold"
                size="lg"
                className="w-full justify-center border border-gold/60 pulse-gold-soft shadow-[0_0_30px_rgba(255,204,0,0.22)]"
              >
                Get My Plan
              </Button>
            </Link>
            <Link href="#how-it-works" className="flex w-full">
              <Button
                variant="secondary"
                size="lg"
                className="w-full justify-center border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,114,206,0.10))] text-white shadow-[0_0_26px_rgba(0,114,206,0.14)] hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,114,206,0.14))]"
              >
                See How It Works
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {heroProof.map((item, index) => (
              <motion.span
                key={item.label}
                initial={reduceEffects ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceEffects ? 0.18 : 0.35, delay: reduceEffects ? 0 : 0.42 + index * 0.08 }}
                className={`rounded-full border px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${item.className}`}
              >
                {item.label}
              </motion.span>
            ))}
          </div>

          <p className="mt-4 text-xs text-slate-400 sm:text-sm">Built by a Marquette student.</p>
        </motion.div>

        <motion.div
          initial={reduceEffects ? false : { opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: reduceEffects ? 0.18 : 0.58,
            delay: reduceEffects ? 0 : 0.14,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="landing-hero-stage relative mt-10 w-full max-w-[54rem]"
        >
          {!reduceEffects && (
            <>
              <div className="absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_20%,rgba(255,204,0,0.12),transparent_34%),radial-gradient(circle_at_85%_15%,rgba(0,114,206,0.18),transparent_38%)] opacity-80 blur-2xl" />
              <div className="absolute left-1/2 top-[4.75rem] hidden h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,204,0,0.12),rgba(255,204,0,0.02)_58%,transparent_76%)] lg:block" />
              <div className="absolute bottom-[-2rem] left-1/2 hidden h-10 w-[68%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(5,11,24,0.78),transparent_72%)] blur-2xl lg:block" />
            </>
          )}

          {!reduceEffects && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, rotate: 4 }}
              animate={{ opacity: 1, scale: 1, rotate: 4 }}
              transition={{ duration: 0.5, delay: 0.42 }}
              className="absolute -right-2 top-5 hidden rounded-xl border border-gold/20 bg-[linear-gradient(135deg,rgba(20,31,58,0.96),rgba(13,24,46,0.88))] px-3 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:block"
            >
              <p className="text-[10px] font-semibold text-gold">5,300+ courses wired in</p>
            </motion.div>
          )}

          {!reduceEffects && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -18, y: 18, rotate: -7 }}
                animate={{ opacity: 1, x: 0, y: 0, rotate: -7 }}
                transition={{ duration: 0.48, delay: 0.5 }}
                className="absolute -left-10 top-28 hidden w-48 rounded-[1.2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(13,27,52,0.96),rgba(10,20,39,0.88))] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.26)] lg:block"
              >
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[#8ec8ff]">
                  Also visible
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{nextCourses[0].code}</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-300">
                  {nextCourses[0].title}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 18, y: -14, rotate: 6 }}
                animate={{ opacity: 1, x: 0, y: 0, rotate: 6 }}
                transition={{ duration: 0.48, delay: 0.58 }}
                className="absolute -right-10 bottom-20 hidden w-52 rounded-[1.2rem] border border-gold/18 bg-[linear-gradient(145deg,rgba(20,30,56,0.96),rgba(13,24,46,0.9))] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.26)] lg:block"
              >
                <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold">
                  Coming up
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{nextCourses[1].code}</p>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-300">
                  {nextCourses[1].title}
                </p>
              </motion.div>
            </>
          )}

          <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 gradient-border bg-[linear-gradient(145deg,rgba(10,24,50,0.96),rgba(8,19,39,0.9))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.3)] sm:p-5 lg:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.10),transparent_34%)] opacity-80" />

            <div className="relative flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Plan preview
                </p>
                <p className="mt-0.5 text-sm font-semibold text-white">Next term</p>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Spring
              </span>
            </div>

            <motion.div
              initial={reduceEffects ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceEffects ? 0.2 : 0.5, delay: reduceEffects ? 0 : 0.34 }}
              className="relative mt-4 rounded-[1.6rem] border border-gold/25 bg-[linear-gradient(160deg,rgba(255,204,0,0.10),rgba(17,30,55,0.78))] p-5 lg:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-navy-dark">
                      #1
                    </span>
                    <p className="text-[1.1rem] font-bold tracking-tight text-white sm:text-[1.4rem]">{topCourse.code}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-100 sm:text-[0.95rem]">{topCourse.title}</p>
                </div>
                <span className="hidden rounded-full border border-gold/24 bg-gold/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-gold sm:inline-flex">
                  Best next move
                </span>
              </div>

              <p className="mt-4 max-w-[34rem] text-sm leading-relaxed text-slate-200 sm:text-[0.92rem]">{topCourse.detail}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {topCourse.tags.map((tag, index) => (
                  <motion.span
                    key={tag}
                    initial={reduceEffects ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceEffects ? 0.18 : 0.35, delay: reduceEffects ? 0 : 0.46 + index * 0.08 }}
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
                      index === 0
                        ? "border-gold/30 bg-gold/12 text-gold"
                        : "border-white/10 bg-white/[0.05] text-slate-200"
                    }`}
                  >
                    {tag}
                  </motion.span>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] px-3 py-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">Why now</p>
                  <p className="mt-2 text-sm font-medium text-white">Counts this term and keeps the sequence moving.</p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] px-3 py-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">What it unlocks</p>
                  <p className="mt-2 text-sm font-medium text-white">Avoids later bottlenecks before registration gets weird.</p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] px-3 py-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-400">What stays visible</p>
                  <p className="mt-2 text-sm font-medium text-white">Major, track, and requirement buckets stay attached.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Scroll cue — pinned to bottom of first viewport, hidden on mobile */}
        <Link
          href="#feature-spotlight"
          className="landing-scroll-cue absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2.5 sm:flex"
          aria-label="Continue to features"
        >
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-300">
            What it does
          </span>
          <motion.span
            animate={reduceEffects ? {} : { y: [0, 3, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="leading-none text-slate-400"
          >
            ↓
          </motion.span>
        </Link>
      </div>
    </section>
  );
}
