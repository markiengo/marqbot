"use client";

import { motion } from "motion/react";
import type { SemesterData } from "@/lib/types";

interface SemesterSelectorProps {
  semesters: SemesterData[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onExpand: (index: number) => void;
}

export function SemesterSelector({
  semesters,
  selectedIndex,
  onSelect,
  onExpand,
}: SemesterSelectorProps) {
  if (!semesters.length) return null;

  return (
    <div className="space-y-2" role="tablist" aria-label="Semester selector">
      {semesters.map((sem, idx) => {
        const active = idx === selectedIndex;
        const term = sem.target_semester || "Auto-selected";

        return (
          <motion.div
            key={idx}
            whileHover={{ y: -1 }}
            className={`relative rounded-xl border transition-colors ${
              active
                ? "bg-gradient-to-br from-[#344738]/65 to-[#223e5d]/70 border-gold"
                : "bg-[#14325b]/55 border-border-medium"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(idx)}
              role="tab"
              aria-selected={active}
              className="w-full text-left px-3 py-3 pr-10 cursor-pointer"
            >
              <div className="text-4xl font-bold font-[family-name:var(--font-sora)] text-white leading-none">
                Semester {idx + 1}
              </div>
              <div className={`text-3xl mt-1 ${active ? "text-ink-primary" : "text-ink-secondary"}`}>
                {term}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onExpand(idx)}
              className="absolute right-2 bottom-2 p-1.5 rounded-lg border border-border-medium text-ink-secondary hover:text-gold hover:border-gold/60 cursor-pointer"
              aria-label={`Expand semester ${idx + 1} details`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
