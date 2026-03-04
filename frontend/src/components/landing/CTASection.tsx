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
    <section ref={ref} className="py-24 band-blue-gold band-fade-top">
      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="relative rounded-3xl px-10 py-[4.5rem] md:px-[4.5rem] text-center overflow-hidden border"
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
            <AnchorLine variant="gold" className="mb-9" />

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="text-[2.8rem] md:text-[4rem] font-bold font-[family-name:var(--font-sora)] text-white leading-tight mb-5"
            >
              Build your next semester
              <br />
              <em className="mu-accent text-gold">before registration gets weird.</em>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.22 }}
              className="text-[1.2rem] sm:text-[1.45rem] text-slate-400 max-w-[42rem] mx-auto leading-relaxed mb-10"
            >
              Pick your major. Drop your courses. Get a ranked plan you can actually
              use. No logins. No spreadsheets. No guessing.
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
                    className="min-w-[220px] shadow-[0_0_24px_rgba(255,204,0,0.22),0_0_48px_rgba(255,204,0,0.10)] hover:shadow-[0_0_32px_rgba(255,204,0,0.34),0_0_60px_rgba(255,204,0,0.15)] transition-shadow duration-300"
                  >
                    Get My Plan
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
              <span className="rounded-full border border-white/8 px-3 py-1.5">
                No account required
              </span>
              <span className="rounded-full border border-white/8 px-3 py-1.5">
                540 active courses tracked
              </span>
              <span className="rounded-full border border-white/8 px-3 py-1.5">
                Double-check with your advisor
              </span>
            </div>

            <AnchorLine variant="fade" className="mt-10" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
