"use client";

import { motion } from "motion/react";
import { AnchorLine } from "@/components/shared/AnchorLine";
import { DoodleStar, DoodleHeart, DoodleSparkle, DoodleSquiggle, DoodleSmiley, DoodleLeaf } from "./ScrapbookElements";

export function AboutCTA() {
  return (
    <section className="relative band-deep py-16 sm:py-20 overflow-hidden">
      {/* Big bold doodles */}
      <DoodleStar className="hidden md:block absolute top-6 left-[14%] text-gold" size={34} />
      <DoodleHeart filled className="hidden md:block absolute top-10 right-[16%] text-gold/60" size={24} />
      <DoodleSparkle className="hidden lg:block absolute bottom-10 left-[8%] text-gold" size={30} />
      <DoodleSquiggle className="hidden lg:block absolute top-4 right-[25%] text-gold/40" />
      <DoodleSmiley className="hidden lg:block absolute bottom-8 right-[10%] text-gold/50" size={32} />
      <DoodleLeaf className="hidden lg:block absolute bottom-14 left-[22%] text-ink-faint" size={26} />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <AnchorLine variant="fade" className="mb-6" />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5 }}
          className="text-2xl sm:text-3xl text-ink-secondary leading-relaxed"
        >
          Built with coffee, curiosity, and{" "}
          <em className="mu-accent text-gold">way too many spreadsheets.</em>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-lg sm:text-xl text-ink-faint pt-2"
        >
          If MarqBot helped you out, send it to your groupchat. Deal?
        </motion.p>
      </div>
    </section>
  );
}
