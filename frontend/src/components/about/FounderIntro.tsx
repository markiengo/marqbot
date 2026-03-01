"use client";

import Image from "next/image";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import {
  PolaroidFrame,
  StickyNote,
  WashiTape,
  DoodleLabel,
  DoodleHeart,
  DoodleSparkle,
  DoodleSmiley,
  DoodleLeaf,
  DoodleStar,
} from "./ScrapbookElements";

export function FounderIntro() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="relative band-blue py-16 sm:py-24 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Polaroid photo + floating annotations */}
          <motion.div
            initial={{ opacity: 0, rotate: -8, y: 20 }}
            animate={inView ? { opacity: 1, rotate: -3, y: 0 } : {}}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative shrink-0"
          >
            <WashiTape className="hidden md:block -top-3 left-4 rotate-[-12deg]" />
            <WashiTape
              color="blue"
              className="hidden md:block -bottom-2 right-2 rotate-[6deg]"
            />

            {/* Hand-drawn labels around photo — desktop only */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 1 } : {}}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <DoodleLabel
                text="freshman"
                arrow="down"
                rotate={-5}
                className="hidden lg:flex -top-10 left-0 text-gold"
              />
              <DoodleLabel
                text="insy major"
                arrow="left"
                rotate={3}
                className="hidden lg:flex -top-14 -right-20 text-ink-secondary"
              />
              <DoodleLabel
                text="builder"
                arrow="right"
                rotate={-4}
                className="hidden lg:flex top-1/2 -left-28 text-gold"
              />
              <DoodleLabel
                text="coffee addict"
                arrow="none"
                rotate={6}
                className="hidden lg:flex -bottom-14 right-0 text-ink-muted"
              />
            </motion.div>

            {/* Floating doodles near photo */}
            <DoodleHeart filled className="hidden lg:block absolute -top-6 right-4 text-gold" size={22} />
            <DoodleSparkle className="hidden lg:block absolute -bottom-8 -left-6 text-gold" size={26} />
            <DoodleStar className="hidden lg:block absolute top-2 -right-10 text-gold/60" size={20} />

            <PolaroidFrame rotate={0} caption="marquette, 29'">
              <Image
                src="/assets/about/founder_pic.jpg"
                alt="Markie Ngo"
                width={260}
                height={330}
                className="object-cover rounded-sm"
                style={{ width: 260, height: 330 }}
              />
            </PolaroidFrame>
          </motion.div>

          {/* Bio text */}
          <div className="space-y-5 text-center lg:text-left max-w-lg relative lg:ml-[5%]">
            {/* Decorative doodles near text */}
            <DoodleSmiley className="hidden lg:block absolute -top-4 -right-8 text-gold" size={32} />
            <DoodleLeaf className="hidden lg:block absolute -bottom-6 -right-4 text-ink-faint" size={28} />

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-[family-name:var(--font-sora)] text-3xl sm:text-4xl font-bold text-ink-primary"
            >
              Hey, I&apos;m{" "}
              <span className="text-gold">Markie.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-ink-secondary leading-relaxed"
            >
              Me? Freshman, majoring Information Systems at Marquette&apos;s
              College of Business. Why MarqBot? Our course system was designed
              to &ldquo;let anyone graduate with at least two majors.&rdquo;
              Well that&apos;s the problem :) IMO, figuring out what courses to
              take next shouldn&apos;t require a spreadsheet, three advisor
              emails, and keeping the bulletin as a bookmark.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-ink-secondary leading-relaxed"
            >
              MarqBot tells you exactly what, why, when you should take. Ofc,
              there are useful tools on Checkmarq too, so use those as
              references. If you&apos;re here and you&apos;re reading this,
              congrats, I still have the time and energy to listen. Found a
              bug? Have an idea? Feedback is always welcome.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
              animate={inView ? { opacity: 1, scale: 1, rotate: 2 } : {}}
              transition={{
                duration: 0.45,
                delay: 0.4,
                type: "spring",
                stiffness: 120,
                damping: 14,
              }}
            >
              <StickyNote rotation={0} className="inline-block max-w-sm">
                <p className="text-sm text-gold/90 italic">
                  &ldquo;tldr: i accidentally bought too many AI subscriptions
                  and I realized my inner power&rdquo;
                </p>
              </StickyNote>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
