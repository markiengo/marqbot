"use client";

import type { SemesterData, BucketProgress } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { CourseCard } from "./CourseCard";
import { groupProgressByTierSections, compactKpiBucketLabel, getBucketDisplay } from "@/lib/rendering";
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
      size="planner-detail"
      title={`Semester ${index + 1}${semester.target_semester ? ` \u2014 ${semester.target_semester}` : ""}`}
    >
      <div className="space-y-6">
        {/* Standing badge */}
        {semester.standing_label && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30">
              {semester.standing_label} Standing
            </span>
          </div>
        )}

        {/* Warnings */}
        {semester.not_in_catalog_warning && semester.not_in_catalog_warning.length > 0 && (
          <div className="bg-bad-light rounded-xl p-3 text-sm text-bad">
            Warning: Some courses not found in catalog:{" "}
            {semester.not_in_catalog_warning.map(esc).join(", ")}
          </div>
        )}

        {(semester.eligible_count || 0) < requestedCount && recs.length > 0 &&
          !semester.target_semester?.toLowerCase().includes("summer") && (
          <div className="bg-bad-light rounded-xl p-3 text-sm text-bad">
            Warning: You requested {requestedCount}, but only {semester.eligible_count}{" "}
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
          <p className="text-base text-ink-faint italic">
            No recommendations for this semester.
          </p>
        )}

        {/* In-progress note */}
        {semester.in_progress_note && (
          <p className="text-sm text-bad">
            Warning: {esc(semester.in_progress_note)}
          </p>
        )}

        {/* Summer note */}
        {semester.target_semester && semester.target_semester.toLowerCase().includes("summer") && (
          <div className="rounded-lg bg-gold/10 border border-gold/25 px-3 py-2 text-xs text-gold/80 leading-relaxed">
            Summer semesters are capped at <span className="font-semibold text-gold">4 courses (max 12 credits)</span>. Only courses with confirmed summer availability are shown.
          </div>
        )}

        {/* Projected progress */}
        {semesterProgress && Object.keys(semesterProgress).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gold uppercase tracking-wider">
              Projected Progress
            </h3>
            <p className="text-sm text-ink-faint">
              Progress bars show applied credits or course counts for each requirement bucket.
            </p>
            {semester.projection_note && (
              <p className="text-sm text-ink-faint">{esc(semester.projection_note)}</p>
            )}
            <div className="space-y-5">
              {groupProgressByTierSections(semesterProgress).map((section) => (
                <div key={section.sectionKey} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gold/70 uppercase tracking-wider border-b border-border-subtle/30 pb-1">
                    {section.label}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {section.entries.map(([bid, prog]: [string, BucketProgress]) => {
                      const { done, inProg, needed, unit } = getBucketDisplay(prog);
                      const ipCodes = prog.in_progress_applied || [];
                      const label = compactKpiBucketLabel(
                        prog.label || bucketLabel(bid, programLabelMap),
                      );
                      const creditNeeded = Number(prog.needed || 0);
                      const creditDone = Number(prog.completed_done ?? prog.done_count ?? 0);
                      const creditInProg = Number(prog.in_progress_increment ?? 0);
                      const donePct = creditNeeded > 0 ? (creditDone / creditNeeded) * 100 : 0;
                      const totalPct = creditNeeded > 0 ? ((creditDone + creditInProg) / creditNeeded) * 100 : 0;

                      return (
                        <div
                          key={bid}
                          className="rounded-xl border border-border-subtle/60 bg-[#0e2a52]/45 p-3"
                        >
                          <div className="flex justify-between items-baseline gap-3 text-sm mb-2">
                            <span className="text-ink-primary font-semibold leading-tight">{label}</span>
                            <span className="text-ink-faint shrink-0 font-semibold">
                              {done}
                              {inProg > 0 && <span className="text-gold">+{inProg}</span>}/{needed} {unit}
                            </span>
                          </div>
                          <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                            <div className="h-full flex">
                              <div
                                className="h-full bg-ok rounded-full"
                                style={{ width: `${Math.min(100, donePct)}%` }}
                              />
                              {inProg > 0 && (
                                <div
                                  className="h-full bg-gold rounded-full"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, totalPct) - Math.min(100, donePct))}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          {ipCodes.length > 0 && (
                            <p className="text-sm text-ink-faint mt-1.5 leading-snug">
                              In progress courses: {ipCodes.join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
