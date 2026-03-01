"use client";

import { motion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import { StampBadge, WashiTape, DoodleStar, DoodleSparkle, DoodleHeart, DoodleSquiggle, DoodleUnderline } from "./ScrapbookElements";

export function AboutHero() {
  return (
    <section className="relative overflow-hidden band-deep py-20 sm:py-28">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(800px 400px at 30% 20%, rgba(255,204,0,0.08), transparent 60%), radial-gradient(600px 350px at 75% 60%, rgba(0,114,206,0.06), transparent 55%)",
        }}
      />

      {/* Washi tape decor */}
      <WashiTape className="hidden md:block -top-1 left-[12%] rotate-[-8deg]" />
      <WashiTape
        color="blue"
        className="hidden md:block top-6 right-[8%] rotate-[5deg]"
      />

      {/* Big bold doodles */}
      <DoodleStar className="hidden lg:block absolute top-14 left-[8%] text-gold" size={36} />
      <DoodleSparkle className="hidden lg:block absolute bottom-12 right-[9%] text-gold" size={34} />
      <DoodleHeart className="hidden md:block absolute top-20 right-[16%] text-gold" size={26} />
      <DoodleHeart filled className="hidden lg:block absolute bottom-20 left-[14%] text-gold/60" size={20} />
      <DoodleSquiggle className="hidden lg:block absolute bottom-16 left-[5%] text-gold/50" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="space-y-5"
        >
          <motion.div
            initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.15, type: "spring", stiffness: 140, damping: 12 }}
            className="inline-block"
          >
            <StampBadge text="est. 2026" />
          </motion.div>

          <div className="relative">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold font-[family-name:var(--font-sora)] text-ink-primary leading-[1.08] tracking-tight"
            >
              Meet the{" "}
              <span className="text-gold">
                <em className="mu-accent">Builder.</em>
              </span>
            </h1>
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="flex justify-center mt-1"
              style={{ transformOrigin: "left" }}
            >
              <DoodleUnderline className="text-gold" width={160} />
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="text-base sm:text-lg text-ink-secondary max-w-[520px] mx-auto"
          >
            The story behind MarqBot — and where it&apos;s headed next.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <AnchorLine variant="gold" className="mt-10" />
        </motion.div>
      </div>
    </section>
  );
}
