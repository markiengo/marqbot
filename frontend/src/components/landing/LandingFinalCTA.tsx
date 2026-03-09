"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Button } from "@/components/shared/Button";
import { AnchorLine } from "@/components/shared/AnchorLine";

export function LandingFinalCTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="py-24 band-blue-gold band-fade-top">
      <div className="mx-auto max-w-[96rem] px-5 sm:px-7 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="relative overflow-hidden rounded-3xl border px-10 py-[4.5rem] text-center md:px-[4.5rem]"
          style={{
            background:
              "linear-gradient(135deg, rgba(15,35,70,0.92) 0%, rgba(10,24,50,0.80) 50%, rgba(14,28,58,0.88) 100%)",
            borderColor: "rgba(255,255,255,0.09)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div
            className="absolute top-0 left-0 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "rgba(255,204,0,0.07)", filter: "blur(70px)" }}
          />
          <div
            className="absolute bottom-0 right-0 h-44 w-44 translate-x-1/3 translate-y-1/3 rounded-full"
            style={{ background: "rgba(24,68,160,0.12)", filter: "blur(60px)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />

          <div className="relative">
            <AnchorLine variant="gold" className="mb-9" />

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mx-auto max-w-[16ch] text-[2.8rem] font-bold leading-tight text-white md:text-[4rem]"
            >
              Your registration tab has asked
              <br />
              <span className="text-gold">enough of you.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.22 }}
              className="mx-auto mt-5 mb-10 max-w-[42rem] text-[1.15rem] leading-relaxed text-slate-300 sm:text-[1.35rem]"
            >
              Map out the rest of your semesters in a couple minutes. Then close the extra tabs and move on.
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
                    className="min-w-[220px] pulse-gold-soft shadow-[0_0_24px_rgba(255,204,0,0.22),0_0_48px_rgba(255,204,0,0.10)]"
                  >
                    Get My Plan
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
              <span className="rounded-full border border-white/8 px-3 py-1.5 float-soft">
                No account required
              </span>
              <span className="rounded-full border border-white/8 px-3 py-1.5 float-soft-delay">
                5,300+ courses tracked
              </span>
              <span className="rounded-full border border-white/8 px-3 py-1.5 float-soft">
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
