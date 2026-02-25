"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-0 w-96 h-96 bg-navy-light/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <span className="inline-block px-4 py-1.5 bg-gold/15 text-gold rounded-full text-sm font-medium">
              For Marquette Finance Students
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-[family-name:var(--font-sora)] text-ink-primary leading-tight">
              Plan your Marquette{" "}
              <span className="text-gold">journey</span>
            </h1>
            <p className="text-lg sm:text-xl text-ink-muted max-w-2xl mx-auto leading-relaxed">
              Smart course recommendations powered by your degree requirements,
              prerequisites, and progress. Get a personalized semester plan in
              seconds.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/onboarding">
              <Button variant="gold" size="lg">
                Get Started
              </Button>
            </Link>
            <Link href="/planner">
              <Button variant="secondary" size="lg">
                Jump to Planner
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
