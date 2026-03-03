"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Button } from "@/components/shared/Button";
import { AnchorLine } from "@/components/shared/AnchorLine";

export function CTASection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-20 band-blue-gold band-fade-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="relative rounded-3xl px-8 py-14 md:px-14 text-center overflow-hidden border"
          style={{
            background: "linear-gradient(135deg, rgba(15,35,70,0.92) 0%, rgba(10,24,50,0.80) 50%, rgba(14,28,58,0.88) 100%)",
            borderColor: "rgba(255,255,255,0.09)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Gold glow — top left */}
          <div className="absolute top-0 left-0 w-52 h-52 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ background: "rgba(255,204,0,0.07)", filter: "blur(70px)" }} />
          {/* Blue glow — bottom right */}
          <div className="absolute bottom-0 right-0 w-44 h-44 rounded-full pointer-events-none translate-x-1/3 translate-y-1/3"
            style={{ background: "rgba(24,68,160,0.12)", filter: "blur(60px)" }} />

          <div className="relative">
            <AnchorLine variant="gold" className="mb-7" />

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight mb-4"
            >
              Stop spiraling.<br />
              <em className="mu-accent text-gold">Get a plan.</em>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.22 }}
              className="text-slate-400 max-w-md mx-auto leading-relaxed mb-8"
            >
              Drop your major. Drop your courses. MarqBot handles the rest.
              No logins. No spreadsheets.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.32 }}
            >
              <Link href="/onboarding">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="gold"
                    size="lg"
                    className="shadow-[0_0_24px_rgba(255,204,0,0.22),0_0_48px_rgba(255,204,0,0.10)] hover:shadow-[0_0_32px_rgba(255,204,0,0.34),0_0_60px_rgba(255,204,0,0.15)] transition-shadow duration-300"
                  >
                    Get My Plan
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <AnchorLine variant="fade" className="mt-8" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
