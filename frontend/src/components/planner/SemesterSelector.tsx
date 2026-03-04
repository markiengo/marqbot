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
      className="flex flex-row lg:flex-col gap-2 lg:gap-3 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:h-full lg:min-h-0 lg:pr-1 pb-1 lg:pb-0"
      role="tablist"
      aria-label="Semester selector"
    >
      {semesters.map((sem, idx) => {
        const active = idx === selectedIndex;
        const term = sem.target_semester || "Auto-selected";

        return (
          <motion.div
            key={idx}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className={`relative shrink-0 lg:flex-1 lg:min-h-0 rounded-xl overflow-hidden ${
              active ? "semester-tab-active" : "semester-tab-idle"
            }`}
          >
            {/* Animated active indicator */}
            {active && (
              <motion.div
                layoutId="semester-indicator"
                className="absolute inset-0 rounded-xl semester-tab-active"
                style={{ zIndex: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}

            <button
              type="button"
              onClick={() => onSelect(idx)}
              role="tab"
              aria-selected={active}
              className="relative z-[1] w-full h-full text-left px-2.5 py-1.5 lg:py-2 lg:pr-8 cursor-pointer whitespace-nowrap lg:whitespace-normal"
            >
              <div className={`text-[13px] lg:text-[15px] font-bold font-[family-name:var(--font-sora)] leading-[1.22] ${
                active ? "text-gold" : "text-white"
              }`}>
                <span className="lg:hidden">S{idx + 1}</span>
                <span className="hidden lg:inline">Semester {idx + 1}</span>
              </div>
              <div className={`text-[12px] lg:text-[14px] mt-0.5 lg:mt-1 leading-[1.25] ${active ? "text-ink-primary" : "text-ink-faint"}`}>
                {term}
              </div>
            </button>

            <button
              type="button"
              onClick={() => onExpand(idx)}
              className={`hidden lg:inline-flex absolute right-1.5 top-1.5 z-[2] h-6 w-6 items-center justify-center rounded-md cursor-pointer transition-colors ${
                active
                  ? "border border-gold/40 text-gold hover:bg-gold/10"
                  : "border border-border-medium text-ink-secondary hover:text-gold hover:border-gold/60"
              }`}
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
