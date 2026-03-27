"use client";

import { memo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { RecommendationResponse, BucketProgress } from "@/lib/types";
import { esc } from "@/lib/utils";
import { CourseRow } from "./CourseRow";
import { SemesterSelector } from "./SemesterSelector";

interface RecommendationsPanelProps {
  data: RecommendationResponse | null;
  onExpandSemester: (index: number) => void;
  onCourseClick?: (courseCode: string) => void;
}

function RecommendationsPanelInner({
  data,
  onExpandSemester,
  onCourseClick,
}: RecommendationsPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const semesters = data?.semesters || [];

  if (!data) return null;

  if (data.mode === "error") {
    return (
      <div className="rounded-2xl border border-bad/20 bg-bad-light p-5">
        <h3 className="mb-2 font-semibold text-bad">Could not build recommendations</h3>
        <p className="text-sm text-bad/80">{esc(data.message || "Unknown error")}</p>
        {data.invalid_courses && data.invalid_courses.length > 0 && (
          <p className="mt-1 text-xs text-bad/60">
            Invalid: {data.invalid_courses.map(esc).join(", ")}
          </p>
        )}
        {data.not_in_catalog && data.not_in_catalog.length > 0 && (
          <p className="mt-1 text-xs text-bad/60">
            Not in catalog: {data.not_in_catalog.map(esc).join(", ")}
          </p>
        )}
      </div>
    );
  }

  if (semesters.length === 0) {
    return (
      <div className="py-10 text-center text-ink-faint">
        <p>No recommendations available yet. Run the planner again after updating your inputs.</p>
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
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-gold/30 p-8 text-center surface-depth-2">
        <div className="text-5xl" aria-hidden="true">🎓</div>
        <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-gold">
          Requirements cleared.
        </h2>
        <p className="max-w-xs text-sm text-ink-secondary">
          All tracked degree requirements are satisfied. Confirm it with your advisor, then enjoy the rare peace.
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
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl glass-card p-2">
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 92% 8%, rgba(255, 204, 0, 0.05), transparent), radial-gradient(ellipse 50% 40% at 8% 90%, rgba(0, 114, 206, 0.04), transparent)",
        }}
      />

      <div className="relative z-[1] flex h-full min-h-0 flex-col gap-3 lg:flex-row lg:gap-4">
        {semesters.length > 1 && (
          <div className="shrink-0 lg:h-full lg:min-h-0 lg:w-[210px]">
            <SemesterSelector
              semesters={semesters}
              selectedIndex={selectedIdx}
              onSelect={setSelectedIdx}
              onExpand={onExpandSemester}
            />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg glass-card">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gold/15 px-3 py-2">
            <h4 className="hash-mark font-[family-name:var(--font-sora)] text-[11px] font-bold leading-[1.25] tracking-[0.01em] text-gold md:text-[13px]">
              Semester {selectedIdx + 1}
              {activeSemester.target_semester && ` - ${activeSemester.target_semester}`}
            </h4>
            {activeRecs.length > 0 && (
              <button
                type="button"
                onClick={() => onExpandSemester(selectedIdx)}
                className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-gold/25 text-gold/70 transition-all hover:border-gold/50 hover:bg-gold/8 hover:text-gold"
                aria-label={`Expand semester ${selectedIdx + 1} details`}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                className={`flex h-full min-h-0 flex-col overflow-hidden ${listGapClass}`}
              >
                {activeRecs.length > 0 ? (
                  activeRecs.map((c, idx) => (
                    <CourseRow
                      key={c.course_code}
                      course={c}
                      courseCount={courseCount}
                      index={idx}
                      onClick={onCourseClick ? () => onCourseClick(c.course_code) : undefined}
                    />
                  ))
                ) : (() => {
                  const pp = activeSemester.projected_progress;
                  const isBucketSatisfied = (b: BucketProgress): boolean => {
                    if (b.satisfied) return true;
                    const nc = b.needed_count ?? 0;
                    if (nc > 0) {
                      const total = (b.completed_courses ?? 0) + (b.in_progress_courses ?? 0);
                      if (total >= nc) return true;
                    }
                    const needed = b.needed ?? 0;
                    if (needed > 0) {
                      const done = (b.completed_done ?? b.done_count ?? 0) + (b.in_progress_increment ?? 0);
                      if (done >= needed) return true;
                    }
                    return false;
                  };
                  const projectedGrad =
                    !!pp &&
                    Object.values(pp)
                      .filter((b) => (b.needed ?? 0) > 0 || (b.needed_count ?? 0) > 0)
                      .every(isBucketSatisfied);
                  return projectedGrad ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                      <div className="text-5xl" aria-hidden="true">🎓</div>
                      <p className="text-xl font-semibold text-gold">
                        Clean path. Nothing left to add.
                      </p>
                      <p className="max-w-xs text-sm leading-relaxed text-ink-faint">
                        All tracked requirements will be satisfied by this point. Keep the ending boring.
                      </p>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-[14px] italic leading-[1.3] text-ink-faint">
                      No eligible courses this term. Either you are done or the next move lives elsewhere.
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

export const RecommendationsPanel = memo(RecommendationsPanelInner);
RecommendationsPanel.displayName = "RecommendationsPanel";
