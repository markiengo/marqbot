"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { AnchorLine } from "@/components/shared/AnchorLine";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden min-h-[86vh] flex items-center"
      style={{ background: "#07101e" }}
    >
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
            top: "15%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "700px",
            height: "400px",
            background: "radial-gradient(ellipse at center, rgba(255,204,0,0.08) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 w-full">
        <div className="max-w-3xl mx-auto text-center">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase border border-gold/25 bg-gold/8 text-gold">
              For Marquette Business Students
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl md:text-[68px] lg:text-[76px] font-bold font-[family-name:var(--font-sora)] text-white leading-[1.06] tracking-tight mb-6"
          >
            Stop spiraling.<br />
            Start{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #ffcc00 0%, #ffdd55 60%, #ffcc00 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              <em className="mu-accent">planning.</em>
            </span>
          </motion.h1>

          {/* Subline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.22, ease: "easeOut" }}
            className="text-lg sm:text-xl text-slate-400 max-w-[580px] mx-auto leading-relaxed mb-10"
          >
            MarqBot tells you exactly what to take next — based on your transcript,
            prereqs, and actual degree rules. No logins. No spreadsheets. No guessing.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
            className="flex flex-col items-center gap-4 mb-12"
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
              className="text-sm text-slate-500"
            >
              Built by a Marquette student. Powered by real degree rules.
            </motion.span>
          </motion.div>

          <AnchorLine variant="gold" />
        </div>
      </div>
    </section>
  );
}
