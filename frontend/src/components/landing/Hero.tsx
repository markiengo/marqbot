"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { AnchorLine } from "@/components/shared/AnchorLine";

const trustPills = ["540 active courses", "12 business majors", "8 built-in tracks"];

const heroStats = [
  { value: "688", label: "requirement mappings" },
  { value: "449", label: "classes tied to requirements" },
  { value: "29", label: "top-level requirement groups" },
];

const heroChecks = [
  "If you cannot take it yet, it drops.",
  "Classes that unlock more classes move up.",
  "Classes that count for real requirements move up.",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden band-deep" style={{ background: "#07101e" }}>
      {/* Single aurora — one clean bloom at top-center, nothing competing */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 110% 55% at 50% -5%, rgba(24,68,160,0.50) 0%, transparent 68%)",
          }}
        />
        {/* Subtle gold warmth under the headline */}
        <div
          className="absolute"
          style={{
            top: "10%",
            left: "12%",
            width: "520px",
            height: "520px",
            background: "radial-gradient(circle, rgba(255,204,0,0.08) 0%, transparent 68%)",
            filter: "blur(36px)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <div
          className="absolute -right-24 top-28 h-[26rem] w-[26rem] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,114,206,0.18) 0%, transparent 72%)",
            filter: "blur(48px)",
          }}
        />
      </div>

      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10 py-20 sm:py-24 w-full">
        <div className="max-w-[58rem] mx-auto text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-11"
          >
            <span className="inline-block px-5 py-2 rounded-full text-sm font-semibold tracking-widest uppercase border border-gold/25 bg-gold/8 text-gold">
              For Marquette Business Students
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-6xl sm:text-7xl md:text-[95px] lg:text-[106px] font-bold font-[family-name:var(--font-sora)] text-white leading-[1.04] tracking-tight mb-8"
          >
            Know <span className="text-emphasis-gold">what to take next.</span>
            <br />
            <span className="text-emphasis-blue">Before registration sneaks up on you.</span>
          </motion.h1>

          {/* Subline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease: "easeOut" }}
            className="text-[1.55rem] sm:text-[1.7rem] text-slate-400 max-w-[820px] mx-auto leading-relaxed mb-14"
          >
            MarqBot tells you exactly what to take next — based on your transcript,
            prereqs, and actual degree rules. No logins. No spreadsheets. No guessing.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            className="flex flex-col items-center gap-5 mb-16"
          >
            <Link href="/onboarding">
              <motion.div whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}>
                <Button
                  variant="gold"
                  size="lg"
                  className="min-w-[200px] shadow-[0_0_28px_rgba(255,204,0,0.25)] hover:shadow-[0_0_40px_rgba(255,204,0,0.35)] transition-shadow duration-300"
                >
                  Get My Plan
                </Button>
              </motion.div>
            </Link>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="text-base text-slate-500"
            >
              Built by a Marquette student. Powered by real degree rules.
            </motion.span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.45 }}
            className="grid gap-3 sm:grid-cols-3 mb-10"
          >
            {trustPills.map((pill) => (
              <div
                key={pill}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200 backdrop-blur"
              >
                {pill}
              </div>
            ))}
          </motion.div>

          <AnchorLine variant="gold" />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.5 }}
            className="mt-10 rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(12,29,56,0.95),rgba(10,24,50,0.82))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.24)] text-left"
          >
            <div className="flex items-center justify-between rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_14px_rgba(255,204,0,0.45)]" />
                Planning engine snapshot
              </div>
              <div className="rounded-full border border-white/8 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                Real product scope
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4 text-center"
                >
                  <div className="text-4xl font-bold leading-none text-gold">{stat.value}</div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
              <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  What the engine prioritizes
                </p>
                <div className="mt-4 space-y-3">
                  {heroChecks.map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/8 bg-black/10 px-3 py-3 text-sm leading-relaxed text-slate-200"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[1.5rem] border border-white/8 bg-gold/[0.06] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-gold/80">
                    Coverage
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">
                    Business core, majors, tracks, and MCC requirement buckets.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Enough structure to be useful. Clear enough to stay fast.
                  </p>
                </div>

                <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Guarantee
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-white">
                    Ranked by actual degree logic. Not guesswork.
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    Same inputs in. Same plan out.
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
