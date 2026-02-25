"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { RecommendationResponse } from "@/lib/types";
import { getProgramLabelMap } from "@/lib/rendering";
import { esc } from "@/lib/utils";
import { CourseRow } from "./CourseRow";
import { SemesterSelector } from "./SemesterSelector";
import { SemesterModal } from "./SemesterModal";

interface RecommendationsPanelProps {
  data: RecommendationResponse | null;
  requestedCount: number;
}

const PREVIEW_ROW_LIMIT = 6;

export function RecommendationsPanel({
  data,
  requestedCount,
}: RecommendationsPanelProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  const semesters = data?.semesters || [];
  const programLabelMap = useMemo(
    () => getProgramLabelMap(data?.selection_context),
    [data?.selection_context],
  );

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

  const activeSemester = semesters[selectedIdx] || semesters[0];
  const activeRecs = activeSemester?.recommendations || [];
  const previewRows = activeRecs.slice(0, PREVIEW_ROW_LIMIT);
  const hiddenCount = Math.max(0, activeRecs.length - PREVIEW_ROW_LIMIT);

  return (
    <div className="h-full min-h-0 rounded-2xl border border-border-subtle bg-gradient-to-br from-[#0f2a52]/70 to-[#10284a]/55 p-2">
      <div className="h-full min-h-0 flex flex-col lg:flex-row gap-2">
        {semesters.length > 1 && (
          <div className="lg:w-72 shrink-0">
            <SemesterSelector
              semesters={semesters}
              selectedIndex={selectedIdx}
              onSelect={setSelectedIdx}
              onExpand={setModalIdx}
            />
          </div>
        )}

        <div className="flex-1 min-w-0 min-h-0 rounded-xl border border-border-medium bg-[#0b2143]/70 p-2 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2 px-1">
            <h3 className="text-3xl font-bold font-[family-name:var(--font-sora)] text-gold leading-tight">
              Semester {selectedIdx + 1}
              {activeSemester.target_semester && ` - ${activeSemester.target_semester}`}
            </h3>
            {activeRecs.length > 0 && (
              <button
                type="button"
                onClick={() => setModalIdx(selectedIdx)}
                className="text-xs font-semibold text-gold hover:underline cursor-pointer"
              >
                Expand
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.16 }}
              className="space-y-1.5"
            >
              {previewRows.length > 0 ? (
                previewRows.map((c) => <CourseRow key={c.course_code} course={c} />)
              ) : (
                <p className="text-sm text-ink-faint italic py-8 text-center">
                  No eligible courses for this semester.
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          {hiddenCount > 0 && (
            <p className="text-xs text-ink-faint mt-2 px-1">
              +{hiddenCount} more course{hiddenCount !== 1 ? "s" : ""}. Use Expand to view details.
            </p>
          )}
        </div>
      </div>

      <SemesterModal
        open={modalIdx !== null}
        onClose={() => setModalIdx(null)}
        semester={modalIdx !== null ? semesters[modalIdx] : null}
        index={modalIdx ?? 0}
        requestedCount={requestedCount}
        programLabelMap={programLabelMap}
      />
    </div>
  );
}
