"use client";

import type { SemesterData } from "@/lib/types";

interface SemesterSelectorProps {
  semesters: SemesterData[];
  selectedIdx: number;
  onSelect: (index: number) => void;
  onExpand: (index: number) => void;
}

export function SemesterSelector({
  semesters,
  selectedIdx,
  onSelect,
}: SemesterSelectorProps) {
  if (!semesters.length) return null;

  return (
    <div
      className="grid w-full gap-2 rounded-xl border border-gold/10 bg-white/[0.015] p-1.5"
      style={{ gridTemplateColumns: `repeat(${semesters.length}, minmax(0, 1fr))` }}
      role="tablist"
      aria-label="Semester selector"
    >
      {semesters.map((sem, idx) => {
        const active = idx === selectedIdx;
        const term = sem.target_semester || "Auto-selected";

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            role="tab"
            aria-selected={active}
            className={`relative min-w-0 overflow-hidden rounded-lg px-2 py-2.5 text-center transition-all duration-200 ${
              active
                ? "bg-gold/[0.12] text-gold shadow-[0_0_0_1px_rgba(255,204,0,0.32),0_0_18px_rgba(255,204,0,0.22),0_0_36px_rgba(255,204,0,0.10)]"
                : "text-ink-faint hover:bg-white/[0.04] hover:text-ink/85"
            }`}
          >
            <div
              className={`truncate text-[12px] font-[family-name:var(--font-sora)] font-semibold leading-[1.2] md:text-[13px] ${
                active ? "drop-shadow-[0_0_7px_rgba(255,204,0,0.72)]" : ""
              }`}
            >
              Semester {idx + 1}
            </div>
            <div
              className={`mt-1 truncate text-[10px] leading-[1.2] md:text-[11px] ${
                active ? "text-gold/85" : "text-ink-faint/80"
              }`}
            >
              {term}
            </div>
            {active && (
              <div className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-gold shadow-[0_0_10px_rgba(255,204,0,0.92),0_0_22px_rgba(255,204,0,0.38)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
