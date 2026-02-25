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
    <div className="space-y-1.5" role="tablist" aria-label="Semester selector">
      {semesters.map((sem, idx) => {
        const active = idx === selectedIndex;
        const term = sem.target_semester || "";
        const recCount = sem.recommendations?.length || 0;

        return (
          <div key={idx} className="relative">
            <button
              type="button"
              onClick={() => onSelect(idx)}
              role="tab"
              aria-selected={active}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer ${
                active
                  ? "bg-navy text-white shadow-sm"
                  : "bg-surface-card text-ink-secondary hover:bg-surface-hover border border-border-subtle"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    Semester {idx + 1}
                  </div>
                  <div className={`text-xs ${active ? "text-white/70" : "text-ink-faint"}`}>
                    {term || "Auto-selected"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${active ? "text-white/70" : "text-ink-faint"}`}>
                    {recCount} course{recCount !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpand(idx);
                    }}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      active ? "hover:bg-white/10" : "hover:bg-surface-hover"
                    }`}
                    aria-label={`Expand semester ${idx + 1} details`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>
              </div>
            </button>
            {active && (
              <motion.div
                layoutId="semester-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gold rounded-full"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
