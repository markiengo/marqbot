"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { RecommendationResponse } from "@/lib/types";
import { getProgramLabelMap } from "@/lib/rendering";
import { esc } from "@/lib/utils";
import { CourseCard } from "./CourseCard";
import { SemesterSelector } from "./SemesterSelector";
import { SemesterPreview } from "./SemesterPreview";
import { SemesterModal } from "./SemesterModal";

interface RecommendationsPanelProps {
  data: RecommendationResponse | null;
  requestedCount: number;
}

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

  // Error mode
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
      <div className="text-center py-12 text-ink-faint">
        <p>No recommendations available. Try submitting your courses.</p>
      </div>
    );
  }

  const activeSemester = semesters[selectedIdx] || semesters[0];
  const activeRecs = activeSemester?.recommendations || [];

  return (
    <div className="space-y-6">
      {/* Plan context */}
      {data.selection_context && (
        <div className="bg-gold/10 rounded-xl p-4 text-sm">
          <span className="font-semibold text-gold">Plan Context: </span>
          <span className="text-ink-secondary">
            {data.selection_context.declared_major_labels?.join(", ") || "No majors"}
            {data.selection_context.selected_track_label &&
              ` \u2022 ${data.selection_context.selected_track_label}`}
          </span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Semester selector sidebar */}
        {semesters.length > 1 && (
          <div className="lg:w-56 shrink-0">
            <SemesterSelector
              semesters={semesters}
              selectedIndex={selectedIdx}
              onSelect={setSelectedIdx}
              onExpand={setModalIdx}
            />
          </div>
        )}

        {/* Active semester cards */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink-secondary">
              Semester {selectedIdx + 1}
              {activeSemester.target_semester &&
                ` \u2014 ${activeSemester.target_semester}`}
            </h3>
            {semesters.length <= 1 && activeRecs.length > 0 && (
              <button
                type="button"
                onClick={() => setModalIdx(selectedIdx)}
                className="text-xs text-gold hover:underline cursor-pointer"
              >
                Expand
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedIdx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {activeRecs.length > 0 ? (
                activeRecs.map((c) => (
                  <CourseCard
                    key={c.course_code}
                    course={c}
                    programLabelMap={programLabelMap}
                  />
                ))
              ) : (
                <p className="text-sm text-ink-faint italic py-8 text-center">
                  No eligible courses for this semester.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Semester previews (right) */}
        {semesters.length > 1 && (
          <div className="hidden xl:block w-48 shrink-0 space-y-4">
            {semesters
              .filter((_, i) => i !== selectedIdx)
              .map((sem, i) => {
                const origIdx = i >= selectedIdx ? i + 1 : i;
                return (
                  <SemesterPreview
                    key={origIdx}
                    semester={sem}
                    index={origIdx}
                  />
                );
              })}
          </div>
        )}
      </div>

      {/* Modal */}
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
