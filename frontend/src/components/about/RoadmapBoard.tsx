"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { StickyNote, WashiTape, DoodleSparkle, DoodleX, DoodleCircle, DoodleArrow, DoodleLeaf, DoodleStar } from "./ScrapbookElements";

const ROADMAP_ITEMS = [
  {
    title: "Course Equivalencies",
    body: "Some courses count for the same prereq (like BUAD 1560 and MATH 1700). Building a smarter system so MarqBot recognizes when you've already covered it, just through a different class.",
    status: "in progress" as const,
    rotation: -1.5,
  },
  {
    title: "Expanding the Course Database",
    body: "Adding ESSv2, WRIT requirements, and full Discovery theme courses so MarqBot covers way more of your degree.",
    status: "planned" as const,
    rotation: 2,
  },
  {
    title: "Save Your Plans",
    body: "Right now your plan disappears when you close the tab. Working on letting you save, edit, and come back to your plans.",
    status: "planned" as const,
    rotation: -2,
  },
  {
    title: "Bug Fixes from You",
    body: "You report it, I fix it. Keeping MarqBot accurate based on real student feedback.",
    status: "in progress" as const,
    rotation: 1.5,
  },
];

function StatusTag({ status }: { status: "planned" | "in progress" }) {
  const styles =
    status === "in progress"
      ? "bg-ok/15 text-ok border-ok/30"
      : "bg-gold/10 text-gold border-gold/25";
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles}`}
    >
      {status}
    </span>
  );
}

export function RoadmapBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="relative band-blue py-16 sm:py-24 overflow-hidden">
      {/* Big bold doodles */}
      <DoodleSparkle className="hidden lg:block absolute top-10 right-[7%] text-gold" size={34} />
      <DoodleX className="hidden lg:block absolute top-20 left-[4%] text-ink-muted" size={24} />
      <DoodleCircle className="hidden lg:block absolute bottom-12 right-[4%] text-gold/50" size={48} />
      <DoodleArrow direction="down" className="hidden lg:block absolute bottom-20 left-[7%] text-gold/60" />
      <DoodleStar className="hidden lg:block absolute bottom-28 right-[15%] text-gold/50" size={28} />
      <DoodleLeaf className="hidden lg:block absolute top-16 left-[12%] text-ink-faint" size={36} />
      <WashiTape className="hidden lg:block top-1 right-[10%] rotate-[-6deg]" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h3
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="hash-mark text-xl sm:text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary mb-10 justify-center"
        >
          What&apos;s Next
        </motion.h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-9">
          {ROADMAP_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.1 * i,
                type: "spring",
                stiffness: 120,
                damping: 14,
              }}
            >
              <StickyNote
                rotation={item.rotation}
                className="h-full"
              >
                <WashiTape className="hidden sm:block -top-3 left-6 rotate-[-4deg] w-[80px]" />
                <div className="space-y-4 pt-3 p-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-lg font-bold text-ink-primary font-[family-name:var(--font-sora)]">
                      {item.title}
                    </h4>
                    <StatusTag status={item.status} />
                  </div>
                  <p className="text-base text-ink-secondary leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </StickyNote>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
