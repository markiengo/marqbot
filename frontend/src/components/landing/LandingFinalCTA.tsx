"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";
import { useReducedEffects } from "@/hooks/useReducedEffects";

export function LandingFinalCTA() {
  const reduceEffects = useReducedEffects();

  return (
    <section
      data-testid="landing-final-cta"
      className="relative isolate z-10 overflow-hidden bg-[linear-gradient(180deg,#071426_0%,#081b31_100%)] pb-10 pt-18 sm:pb-12 sm:pt-22"
    >
      <div className="absolute inset-0 bg-[#071426]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,204,0,0.12),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(0,114,206,0.10),transparent_30%)]" />

      <div className="relative mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <motion.div
          initial={reduceEffects ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: reduceEffects ? 0.18 : 0.38 }}
          className="relative overflow-hidden rounded-[2.3rem] border border-white/10 bg-[linear-gradient(180deg,#0a1b32,#081527)] px-6 py-12 text-center shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:px-10 sm:py-16"
        >
          <div className="landing-hero-grid absolute inset-0 opacity-[0.06]" />
          <div className="pointer-events-none absolute left-1/2 top-7 h-px w-56 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.95),transparent)]" />
          <div className="pointer-events-none absolute bottom-7 left-1/2 h-px w-56 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,204,0,0.55),transparent)]" />

          <div className="relative">
            <h2 className="mx-auto max-w-[12ch] text-[clamp(2.9rem,7vw,5.8rem)] font-bold leading-[0.92] tracking-[-0.055em] text-white">
              Plan your semesters.
              <span className="block text-gold-light">Close the tabs.</span>
            </h2>

            <p className="mx-auto mt-5 max-w-[34rem] text-[1.06rem] leading-relaxed text-slate-300">
              Takes a few minutes. No account needed.
            </p>

            <div className="mt-8 flex justify-center">
              <Button
                asChild
                variant="gold"
                size="lg"
                className="min-h-[78px] min-w-[280px] rounded-[1.9rem] px-10 text-[clamp(1.45rem,3vw,2rem)] font-semibold shadow-[0_24px_70px_rgba(0,0,0,0.30)]"
              >
                <Link href="/onboarding">Get My Plan</Link>
              </Button>
            </div>

            <p className="mt-6 text-sm text-slate-400">Double-check with your advisor before registration.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
