"use client";

import type { SemesterData, BucketProgress } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { CourseCard } from "./CourseCard";
import { sortProgressEntries, compactKpiBucketLabel } from "@/lib/rendering";
import { bucketLabel, esc } from "@/lib/utils";

interface SemesterModalProps {
  open: boolean;
  onClose: () => void;
  semester: SemesterData | null;
  index: number;
  requestedCount: number;
  programLabelMap?: Map<string, string>;
}

export function SemesterModal({
  open,
  onClose,
  semester,
  index,
  requestedCount,
  programLabelMap,
}: SemesterModalProps) {
  if (!semester) return null;

  const recs = semester.recommendations || [];
  const semesterProgress = semester.projected_progress || semester.progress;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Semester ${index + 1}${semester.target_semester ? ` \u2014 ${semester.target_semester}` : ""}`}
    >
      <div className="space-y-6">
        {/* Warnings */}
        {semester.not_in_catalog_warning && semester.not_in_catalog_warning.length > 0 && (
          <div className="bg-warn-light rounded-xl p-3 text-xs text-warn">
            Warning: Some courses not found in catalog:{" "}
            {semester.not_in_catalog_warning.map(esc).join(", ")}
          </div>
        )}

        {(semester.eligible_count || 0) < requestedCount && recs.length > 0 && (
          <div className="bg-warn-light rounded-xl p-3 text-xs text-warn">
            You requested {requestedCount}, but only {semester.eligible_count}{" "}
            eligible course(s) match for this term.
          </div>
        )}

        {/* Course cards */}
        {recs.length > 0 ? (
          <div className="space-y-3">
            {recs.map((c) => (
              <CourseCard
                key={c.course_code}
                course={c}
                programLabelMap={programLabelMap}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-faint italic">
            No recommendations for this semester.
          </p>
        )}

        {/* In-progress note */}
        {semester.in_progress_note && (
          <p className="text-xs text-warn">
            Warning: {esc(semester.in_progress_note)}
          </p>
        )}

        {/* Projected progress */}
        {semesterProgress && Object.keys(semesterProgress).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-secondary">
              Projected Progress
            </h3>
            {semester.projection_note && (
              <p className="text-xs text-ink-faint">{esc(semester.projection_note)}</p>
            )}
            <div className="space-y-2">
              {sortProgressEntries(semesterProgress).map(
                ([bid, prog]: [string, BucketProgress]) => {
                  const needed = Number(prog.needed || 0);
                  const done = Number(prog.done_count || 0);
                  const ipCodes = prog.in_progress_applied || [];
                  const label = compactKpiBucketLabel(
                    prog.label || bucketLabel(bid, programLabelMap),
                  );
                  const pct = needed > 0 ? (done / needed) * 100 : 0;

                  return (
                    <div key={bid}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ink-secondary">{label}</span>
                        <span className="text-ink-faint">
                          {done}
                          {ipCodes.length > 0 && `+${ipCodes.length}`}/{needed}
                          {prog.satisfied && " (Done)"}
                        </span>
                      </div>
                      <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ok rounded-full"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
