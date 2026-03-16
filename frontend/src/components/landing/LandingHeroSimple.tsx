"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";

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

const previewSignal = "Counts now. Unlocks later. No hand-waving.";

export function LandingHeroSimple() {
  return (
    <section className="relative overflow-hidden band-deep" style={{ background: "#07101e" }}>
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 120% 60% at 20% 0%, rgba(0,114,206,0.22) 0%, transparent 58%), radial-gradient(ellipse 75% 50% at 82% 18%, rgba(255,204,0,0.12) 0%, transparent 52%)",
          }}
        />
        <div
          className="absolute left-[6%] top-[8%] h-[28rem] w-[28rem] rounded-full parallax-slow"
          style={{
            background: "radial-gradient(circle, rgba(255,204,0,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute -right-20 top-24 h-[24rem] w-[24rem] rounded-full parallax-fast"
          style={{
            background: "radial-gradient(circle, rgba(0,114,206,0.18) 0%, transparent 72%)",
            filter: "blur(52px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <div className="mx-auto max-w-[96rem] px-5 py-20 sm:px-7 sm:py-24 lg:px-10 lg:py-28">
        <div className="grid items-center gap-10 xl:grid-cols-[minmax(0,1.22fr)_minmax(360px,0.78fr)] xl:gap-8">
          <div className="relative z-10 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="inline-block rounded-full border border-gold/25 bg-gold/8 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-gold">
                For Marquette Business Students
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-8 max-w-[15.5ch] text-5xl font-bold leading-[0.95] tracking-tight text-white sm:max-w-[16.5ch] sm:text-6xl md:max-w-[17ch] md:text-[5.2rem] lg:mx-0 xl:text-[6rem]"
            >
              <span className="whitespace-nowrap">Know what to take next.</span>
              <span className="mt-3 block text-emphasis-blue">
                Before CheckMarq turns registration
              </span>
              <span className="block text-gradient-gold">into a six-tab side quest.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16 }}
              className="mt-7 text-sm font-semibold uppercase tracking-[0.24em] text-gold/85"
            >
              {previewSignal}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="mx-auto mt-5 max-w-[42rem] text-[1.14rem] leading-relaxed text-slate-300 sm:text-[1.28rem] lg:mx-0"
            >
              MarqBot ranks the classes that actually move your plan.
              <br className="hidden sm:block" />
              Raynor does not need another six-tab crisis.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start"
            >
              <Link href="/onboarding">
                <Button
                  variant="gold"
                  size="lg"
                  className="min-w-[220px] border border-gold/60 pulse-gold-soft shadow-[0_0_28px_rgba(255,204,0,0.24)]"
                >
                  Get My Plan
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-w-[220px] border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,114,206,0.10))] text-white shadow-[0_0_26px_rgba(0,114,206,0.14)] hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.10),rgba(0,114,206,0.14))]"
                >
                  See How It Works
                </Button>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.42, duration: 0.35 }}
              className="mt-6 text-sm text-slate-400 sm:text-base"
            >
              Built by a Marquette student. <span className="text-gold">Mildly over CheckMarq.</span>
            </motion.p>

          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            className="relative mx-auto w-full max-w-[36rem] lg:mr-0 xl:-ml-4"
          >
            <div className="absolute -inset-8 rounded-[2.5rem] bg-[radial-gradient(circle_at_20%_20%,rgba(255,204,0,0.12),transparent_34%),radial-gradient(circle_at_85%_15%,rgba(0,114,206,0.18),transparent_38%)] opacity-80 blur-2xl" />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, rotate: 4 }}
              animate={{ opacity: 1, scale: 1, rotate: 4 }}
              transition={{ duration: 0.5, delay: 0.42 }}
              className="absolute -right-2 top-5 hidden rounded-[1.3rem] border border-gold/20 bg-[linear-gradient(135deg,rgba(20,31,58,0.96),rgba(13,24,46,0.88))] px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:block"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold/75">
                Proof
              </p>
              <p className="mt-1 text-sm font-semibold text-white">5,300+ course records wired in</p>
            </motion.div>

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 gradient-border bg-[linear-gradient(145deg,rgba(10,24,50,0.96),rgba(8,19,39,0.90))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.30)] sm:p-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,0,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(0,114,206,0.10),transparent_34%)] opacity-80" />

              <div className="relative flex items-center justify-between gap-3 rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Ranked plan preview
                  </p>
                  <p className="mt-1 text-base font-semibold text-white">Next term, with receipts.</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Spring
                </span>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.34 }}
                className="relative mt-4 rounded-[1.6rem] border border-gold/25 bg-[linear-gradient(160deg,rgba(255,204,0,0.10),rgba(17,30,55,0.78))] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">
                      Top move
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-navy-dark">
                        #1
                      </span>
                      <p className="text-xl font-bold tracking-tight text-white">{topCourse.code}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-100">{topCourse.title}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Ranked first
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {topCourse.tags.map((tag, index) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.46 + index * 0.08 }}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        index === 0
                          ? "border-gold/30 bg-gold/12 text-gold"
                          : "border-white/10 bg-white/[0.05] text-slate-200"
                      }`}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>

                <p className="mt-4 max-w-[24rem] text-sm leading-relaxed text-slate-200">
                  {topCourse.detail}
                </p>
              </motion.div>

              <div className="relative mt-4 space-y-3">
                {nextCourses.map((course, index) => (
                  <motion.div
                    key={course.code}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.42, delay: 0.48 + index * 0.1 }}
                    className="flex items-start justify-between gap-4 rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {String(index + 2).padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">{course.code}</p>
                      <p className="mt-1 text-sm text-slate-300">{course.title}</p>
                    </div>
                    <p className="max-w-[12rem] text-right text-sm leading-relaxed text-slate-400">
                      {course.detail}
                    </p>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.66 }}
                className="relative mt-4 rounded-[1.3rem] border border-white/8 bg-black/12 px-4 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Why it feels calmer
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  Same inputs, same plan. No bulletin archaeology after dark.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
