"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Button } from "@/components/shared/Button";

export function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-18">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="relative bg-surface-card/80 backdrop-blur-[2px] rounded-3xl px-8 py-12 md:px-14 text-center border border-border-subtle"
        >
          <div className="absolute top-0 left-0 w-40 h-40 bg-gold/8 rounded-full blur-[60px] -translate-x-1/2 -translate-y-1/2" />

          <div className="relative space-y-5">
            <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
              Ready to plan your next semester?
            </h2>
            <p className="text-ink-secondary max-w-lg mx-auto leading-relaxed">
              Tell us about your major and completed courses, and we will build
              a personalized plan in seconds.
            </p>
            <div className="pt-1">
              <Link href="/onboarding">
                <Button variant="gold" size="lg" className="shadow-[0_0_18px_rgba(255,204,0,0.18)]">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
