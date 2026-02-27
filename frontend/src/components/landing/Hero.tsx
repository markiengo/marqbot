"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";

export function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[86vh] flex items-center">
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 520px at 15% 0%, rgba(56,124,210,0.24), transparent 62%), radial-gradient(900px 460px at 85% 10%, rgba(255,204,0,0.14), transparent 66%), linear-gradient(180deg, rgba(20,64,124,0.25) 0%, rgba(9,28,58,0.10) 60%, rgba(7,18,39,0.04) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,204,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,204,0,0.3) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />
        <motion.div
          animate={{ scale: [1, 1.03, 1], opacity: [0.09, 0.14, 0.09] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] bg-gold/15 rounded-full blur-[90px]"
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center -z-[5] pointer-events-none">
        <div className="w-[min(940px,96vw)] h-[min(620px,82vh)] rounded-3xl bg-white/[0.02] backdrop-blur-[2px] border border-white/[0.05] shadow-[0_6px_24px_rgba(0,0,0,0.22)]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 w-full">
        <div className="max-w-3xl mx-auto text-center space-y-7">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="space-y-4"
          >
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="inline-block px-4 py-1.5 bg-gold/12 text-gold rounded-full text-xs sm:text-sm font-semibold tracking-widest uppercase border border-gold/20"
            >
              For Marquette Business Students
            </motion.span>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-bold font-[family-name:var(--font-sora)] text-ink-primary leading-[1.08] tracking-tight">
              Plan your Marquette <span className="text-gold">journey</span>
            </h1>

            <p className="text-base sm:text-lg text-ink-secondary max-w-[620px] mx-auto leading-relaxed">
              Smart course recommendations powered by your degree requirements,
              prerequisites, and progress. Get a personalized semester plan in
              seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center justify-center"
          >
            <Link href="/onboarding">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant="gold"
                  size="lg"
                  className="min-w-[220px] shadow-[0_0_16px_rgba(255,204,0,0.2)] hover:shadow-[0_0_22px_rgba(255,204,0,0.28)] transition-shadow"
                >
                  Get Started
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-xs text-ink-faint"
          >
            No sign-up required &middot; Works instantly
          </motion.p>
        </div>
      </div>
    </section>
  );
}
