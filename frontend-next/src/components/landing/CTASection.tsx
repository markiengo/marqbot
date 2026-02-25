"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/shared/Button";

export function CTASection() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative bg-navy rounded-3xl px-8 py-14 md:px-16 text-center overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-gold/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-56 h-56 bg-white/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

          <div className="relative space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-sora)] text-white">
              Ready to plan your next semester?
            </h2>
            <p className="text-white/70 max-w-lg mx-auto">
              Tell us about your major and completed courses, and we&apos;ll build
              a personalized plan in seconds.
            </p>
            <Link href="/onboarding">
              <Button variant="gold" size="lg">
                Get Started Free
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
