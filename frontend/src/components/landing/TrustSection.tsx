"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Button } from "@/components/shared/Button";
import { AnchorLine } from "@/components/shared/AnchorLine";

const proofCards = [
  {
    title: "Deterministic engine",
    body: "Same inputs = same outputs. No randomness. No vibes-based ranking.",
  },
  {
    title: "Actual degree logic",
    body: "The system is built around prereqs, standing, offerings, requirement buckets, and course chains.",
  },
  {
    title: "Real Marquette scope",
    body: "540 active courses, 12 majors, 8 tracks, and 688 course-to-requirement mappings.",
  },
];

const stats = [
  { value: "540", label: "active courses" },
  { value: "12", label: "business majors" },
  { value: "8", label: "built-in tracks" },
];

export function TrustSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="relative py-24 band-gold band-fade-top band-fade-bottom">
      <div className="max-w-[96rem] mx-auto px-5 sm:px-7 lg:px-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-sm uppercase tracking-widest font-semibold text-gold"
        >
          Why the logic is trustworthy
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mt-4 max-w-[44rem] text-[2.6rem] font-bold leading-tight text-white sm:text-[3.5rem]"
        >
          Student-built. Academically serious. Not pretending to be official advising.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="mt-4 max-w-[44rem] text-[1.1rem] leading-relaxed text-slate-400"
        >
          The product is funny when it earns it. The planning logic stays strict.
        </motion.p>

        <AnchorLine variant="gold" className="mt-12 mb-12 mx-0" />

        <div className="grid gap-6 md:grid-cols-3">
          {proofCards.map((card, idx) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 22 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.24 + idx * 0.08 }}
              className="rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6"
            >
              <div className="h-1 w-12 rounded-full bg-gold" />
              <h3 className="mt-5 text-[1.45rem] font-semibold text-white">
                {card.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-slate-400">
                {card.body}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="mt-8 grid gap-6 rounded-[2rem] border border-white/8 bg-[linear-gradient(145deg,rgba(15,35,70,0.88),rgba(8,20,42,0.70))] p-6 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="overflow-hidden rounded-[1.5rem] border border-white/8">
            <Image
              src="/assets/about/founder_pic.jpg"
              alt="MarqBot founder Markie Ngo"
              width={640}
              height={720}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-gold">
              Built by a Marquette student
            </p>
            <h3 className="mt-4 text-[2.1rem] font-bold leading-tight text-white">
              MarqBot exists because degree planning should not require a side spreadsheet.
            </h3>
            <p className="mt-4 max-w-[40rem] text-[1.05rem] leading-relaxed text-slate-300">
              It was built by someone dealing with the same requirement sheets, the
              same prereq pain, and the same registration window. That matters. The tone
              feels local because it is.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about">
                <Button
                  variant="secondary"
                  size="md"
                  className="border-white/10 bg-white/5 text-ink-primary hover:bg-white/8"
                >
                  Meet the Builder
                </Button>
              </Link>
              <div className="rounded-xl border border-white/8 px-4 py-3 text-sm leading-relaxed text-slate-400">
                Always double-check with your advisor before enrolling.
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-center"
                >
                  <div className="text-4xl font-bold leading-none text-gold">{stat.value}</div>
                  <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
