"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { AnchorLine } from "@/components/shared/AnchorLine";

const pills = ["540 active courses", "12 majors", "8 tracks"];

const checks = [
  "Can you take it right now?",
  "Does it unlock more classes?",
  "Does it count toward real requirements?",
];

const stats = [
  { value: "540", label: "course records" },
  { value: "688", label: "requirement links" },
  { value: "29", label: "requirement groups" },
];

export function LandingHeroSimple() {
  return (
    <section className="relative overflow-hidden band-deep" style={{ background: "#07101e" }}>
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 55% at 50% -5%, rgba(24,68,160,0.50) 0%, transparent 68%)",
          }}
        />
        <div
          className="absolute left-[8%] top-[10%] h-[28rem] w-[28rem] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,204,0,0.08) 0%, transparent 68%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="absolute -right-24 top-28 h-[26rem] w-[26rem] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,114,206,0.18) 0%, transparent 72%)",
            filter: "blur(48px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
      </div>

      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10 py-20 sm:py-24 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-8"
            >
              <span className="inline-block rounded-full border border-gold/25 bg-gold/8 px-5 py-2 text-sm font-semibold tracking-widest uppercase text-gold">
                For Marquette Business Students
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl md:text-[5.5rem] font-bold leading-[1.02] tracking-tight text-white"
            >
              Know <span className="text-gold">what classes</span> to take next.
              <br />
              <span className="text-emphasis-blue">Before registration gets weird.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-7 max-w-[44rem] text-[1.2rem] sm:text-[1.38rem] leading-relaxed text-slate-300 mx-auto lg:mx-0"
            >
              Pick your major. Add your classes. MarqBot shows what to take next
              using real degree rules. No spreadsheets. No guessing. No &ldquo;wait,
              can I even take that?&rdquo;
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.28 }}
              className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start"
            >
              <Link href="/onboarding">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="gold"
                    size="lg"
                    className="min-w-[220px] pulse-gold-soft shadow-[0_0_28px_rgba(255,204,0,0.22)]"
                  >
                    Get My Plan
                  </Button>
                </motion.div>
              </Link>
              <Link href="#how-it-works">
                <Button
                  variant="secondary"
                  size="lg"
                  className="min-w-[220px] border-white/10 bg-white/5 text-ink-primary hover:bg-white/8"
                >
                  See How It Works
                </Button>
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              className="mt-5 text-sm sm:text-base text-slate-400"
            >
              Built by a Marquette student. <span className="text-gold">Rules, not vibes.</span>
            </motion.p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {pills.map((pill, index) => (
                <motion.div
                  key={pill}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.36 + index * 0.08 }}
                  className={`rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200 backdrop-blur ${
                    index === 1 ? "float-soft-delay" : "float-soft"
                  }`}
                >
                  {pill}
                </motion.div>
              ))}
            </div>

            <AnchorLine variant="gold" className="mt-10 mx-auto lg:mx-0" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2.25rem] opacity-70 blur-xl bg-[radial-gradient(circle_at_20%_20%,rgba(255,204,0,0.16),transparent_35%),radial-gradient(circle_at_80%_15%,rgba(0,114,206,0.16),transparent_40%)]" />

            <div className="relative rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(12,29,56,0.96),rgba(10,24,50,0.84))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)] float-soft-lg">
              <div className="flex items-center justify-between rounded-[1.25rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_14px_rgba(255,204,0,0.45)]" />
                  What MarqBot checks
                </div>
                <span className="rounded-full border border-white/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                  Real data
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {stats.map((stat, index) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.45, delay: 0.32 + index * 0.08 }}
                    className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-4 text-center shine-sweep"
                  >
                    <div className="text-4xl font-bold leading-none text-gold">{stat.value}</div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Why classes move up
                </p>
                <div className="mt-4 space-y-3">
                  {checks.map((item, index) => (
                    <motion.div
                      key={item}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.4 + index * 0.08 }}
                      className={`rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-sm leading-relaxed text-slate-200 ${
                        index === 0 ? "pulse-gold-soft" : ""
                      }`}
                    >
                      {item}
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/8 bg-gold/[0.06] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold/80">
                    Coverage
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    Core, major, track, and MCC progress in one place.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Promise
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    Same inputs, <span className="text-gold">same plan.</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
