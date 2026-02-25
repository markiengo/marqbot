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
    <div
      className="h-full min-h-0 flex flex-col gap-3 overflow-y-auto pr-1"
      role="tablist"
      aria-label="Semester selector"
    >
      {semesters.map((sem, idx) => {
        const active = idx === selectedIndex;
        const term = sem.target_semester || "Auto-selected";

        return (
          <motion.div
            key={idx}
            whileHover={{ y: -1 }}
            className={`relative flex-1 min-h-[72px] max-h-[160px] rounded-xl border transition-colors ${
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
              className="w-full h-full text-left px-2.5 py-2 pr-8 cursor-pointer"
            >
              <div className="text-[15px] font-bold font-[family-name:var(--font-sora)] text-white leading-[1.22]">
                Semester {idx + 1}
              </div>
              <div className={`text-[14px] mt-1 leading-[1.25] ${active ? "text-ink-primary" : "text-ink-secondary"}`}>
                {term}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onExpand(idx)}
              className="absolute right-1.5 top-1.5 h-6 w-6 inline-flex items-center justify-center rounded-md border border-border-medium text-ink-secondary hover:text-gold hover:border-gold/60 cursor-pointer"
              aria-label={`Expand semester ${idx + 1} details`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
