"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { RecommendationResponse } from "@/lib/types";
import { esc } from "@/lib/utils";
import { CourseRow } from "./CourseRow";
import { SemesterSelector } from "./SemesterSelector";

interface RecommendationsPanelProps {
  data: RecommendationResponse | null;
  onExpandSemester: (index: number) => void;
}

export function RecommendationsPanel({
  data,
  onExpandSemester,
}: RecommendationsPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const semesters = data?.semesters || [];

  if (!data) return null;

  if (data.mode === "error") {
    return (
      <div className="bg-bad-light rounded-2xl p-5 border border-bad/20">
        <h3 className="font-semibold text-bad mb-2">Error</h3>
        <p className="text-sm text-bad/80">{esc(data.message || "Unknown error")}</p>
        {data.invalid_courses && data.invalid_courses.length > 0 && (
          <p className="text-xs text-bad/60 mt-1">
            Invalid: {data.invalid_courses.map(esc).join(", ")}
          </p>
        )}
        {data.not_in_catalog && data.not_in_catalog.length > 0 && (
          <p className="text-xs text-bad/60 mt-1">
            Not in catalog: {data.not_in_catalog.map(esc).join(", ")}
          </p>
        )}
      </div>
    );
  }

  if (semesters.length === 0) {
    return (
      <div className="text-center py-10 text-ink-faint">
        <p>No recommendations available. Try submitting your courses.</p>
      </div>
    );
  }

  const currentProgress = data.current_progress;
  const allSatisfied =
    !!currentProgress &&
    Object.values(currentProgress)
      .filter((p) => (p.needed ?? 0) > 0)
      .every((p) => p.satisfied);

  if (allSatisfied) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 rounded-xl border border-gold/30 bg-[#0c2348]/55 p-8 text-center">
        <div className="text-5xl">🎓</div>
        <h2 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-gold">
          You&apos;ve Graduated!
        </h2>
        <p className="text-ink-secondary text-sm max-w-xs">
          All degree requirements are satisfied. Congratulations on completing
          your Marquette business degree!
        </p>
        <p className="text-[10px] text-ink-faint/60 mt-1">
          Note: ESSV2, WRIT, and Discovery courses are not yet considered.
        </p>
      </div>
    );
  }

  const activeSemester = semesters[selectedIdx] || semesters[0];
  const activeRecs = activeSemester?.recommendations || [];
  const courseCount = Math.max(1, Math.min(6, activeRecs.length || 1));
  const listGapClass =
    courseCount >= 6 ? "gap-0.5" : courseCount >= 5 ? "gap-1" : courseCount >= 4 ? "gap-1.5" : "gap-2";
  const listPadClass =
    courseCount >= 6 ? "px-1.5 py-1.5" : courseCount >= 5 ? "px-2 py-1.5" : "px-2 py-2";

  return (
    <div className="h-full min-h-0 rounded-xl border border-border-subtle/70 bg-[#0c2348]/55 shadow-[inset_0_1px_0_rgba(122,179,255,0.08)] p-2">
      <div className="h-full min-h-0 flex flex-col lg:flex-row gap-3">
        {semesters.length > 1 && (
          <div className="lg:w-[210px] h-full min-h-0 shrink-0">
            <SemesterSelector
              semesters={semesters}
              selectedIndex={selectedIdx}
              onSelect={setSelectedIdx}
              onExpand={onExpandSemester}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 min-h-0 rounded-lg bg-[#0b2143]/55 shadow-[inset_0_0_0_1px_rgba(141,170,224,0.2)] flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle/60">
            <h3 className="text-[16px] md:text-[18px] font-bold font-[family-name:var(--font-sora)] text-gold leading-[1.25] tracking-[0.01em]">
              Semester {selectedIdx + 1}
              {activeSemester.target_semester && ` - ${activeSemester.target_semester}`}
            </h3>
            {activeRecs.length > 0 && (
              <button
                type="button"
                onClick={() => onExpandSemester(selectedIdx)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-border-medium text-ink-secondary hover:text-gold hover:border-gold/70 cursor-pointer"
                aria-label={`Expand semester ${selectedIdx + 1} details`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className={`flex-1 min-h-0 overflow-hidden ${listPadClass}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedIdx}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.14 }}
                className={`h-full min-h-0 flex flex-col ${listGapClass} overflow-hidden`}
              >
                {activeRecs.length > 0 ? (
                  activeRecs.map((c) => (
                    <CourseRow key={c.course_code} course={c} courseCount={courseCount} />
                  ))
                ) : (() => {
                  const pp = activeSemester.projected_progress;
                  const projectedGrad =
                    !!pp &&
                    Object.values(pp)
                      .filter((b) => (b.needed ?? 0) > 0)
                      .every((b) => b.satisfied);
                  return projectedGrad ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                      <div className="text-4xl">🎓</div>
                      <p className="text-[15px] font-semibold text-gold">
                        You will have graduated!
                      </p>
                      <p className="text-xs text-ink-faint max-w-xs leading-relaxed">
                        Based on your current plan, all tracked degree requirements
                        will be satisfied by this point.
                      </p>
                      <p className="text-[10px] text-ink-faint/60 mt-1">
                        Note: ESSV2, WRIT, and Discovery courses are not yet considered.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[14px] text-ink-faint italic py-4 text-center leading-[1.3]">
                      No eligible courses for this semester.
                    </p>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

    </div>
  );
}
