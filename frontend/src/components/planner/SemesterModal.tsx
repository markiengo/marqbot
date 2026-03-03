"use client";

import { useState, useEffect, useMemo } from "react";
import type { SemesterData, BucketProgress, RecommendedCourse } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { CourseCard } from "./CourseCard";
import { Tag } from "@/components/shared/Tag";
import { groupProgressByTierWithMajors, compactKpiBucketLabel, getBucketDisplay } from "@/lib/rendering";
import { getSemesterQuip } from "@/lib/quips";
import { bucketLabel, esc } from "@/lib/utils";

interface SemesterModalProps {
  open: boolean;
  onClose: () => void;
  semester: SemesterData | null;
  index: number;
  requestedCount: number;
  programLabelMap?: Map<string, string>;
  programOrder?: string[];
  // Edit mode props — omit to hide edit button
  candidatePool?: RecommendedCourse[];
  candidatePoolLoading?: boolean;
  onRequestCandidates?(): void;
  onEditApply?(chosenCourses: RecommendedCourse[]): Promise<void>;
}

export function SemesterModal({
  open,
  onClose,
  semester,
  index,
  requestedCount,
  programLabelMap,
  programOrder,
  candidatePool,
  candidatePoolLoading,
  onRequestCandidates,
  onEditApply,
}: SemesterModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [editCourses, setEditCourses] = useState<RecommendedCourse[]>([]);
  const [applyLoading, setApplyLoading] = useState(false);
  const [editApplied, setEditApplied] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setEditMode(false);
      setEditCourses([]);
      setApplyLoading(false);
      setEditApplied(false);
    }
  }, [open]);

  if (!semester) return null;

  const recs = semester.recommendations || [];
  const semesterProgress = semester.projected_progress || semester.progress;
  const canEdit = Boolean(onEditApply) && recs.length > 0;

  const handleEnterEdit = () => {
    setEditCourses([...recs]);
    setEditMode(true);
    onRequestCandidates?.();
  };

  const handleRemoveCourse = (code: string) => {
    setEditCourses((prev) => prev.filter((c) => c.course_code !== code));
  };

  const handleAddCourse = (course: RecommendedCourse) => {
    setEditCourses((prev) => {
      if (prev.some((c) => c.course_code === course.course_code)) return prev;
      return [...prev, course];
    });
  };

  const handleApply = async () => {
    if (!onEditApply) return;
    setApplyLoading(true);
    try {
      await onEditApply(editCourses);
      setEditApplied(true);
    } finally {
      setApplyLoading(false);
      setEditMode(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="planner-detail"
      title={`Semester ${index + 1}${semester.target_semester ? ` \u2014 ${semester.target_semester}` : ""}`}
      titleClassName="text-[13px] font-semibold font-[family-name:var(--font-sora)] text-ink-primary"
    >
      <div className="space-y-6">
        {/* Standing badge + edit button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {semester.standing_label && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30">
                {semester.standing_label} Standing
              </span>
            )}
            {editApplied && !editMode && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-ok/15 text-ok border border-ok/30">
                Updated
              </span>
            )}
          </div>
          {canEdit && !editMode && !editApplied && (
            <Button variant="secondary" size="sm" onClick={handleEnterEdit}>
              Edit
            </Button>
          )}
        </div>

        {/* Contextual quip — view mode only */}
        {!editMode && (
          <p className="text-center text-sm text-ink-muted italic py-1.5">
            {getSemesterQuip({ semester, index, requestedCount })}
          </p>
        )}

        {/* Warnings — view mode only */}
        {!editMode && (
          <>
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
          </>
        )}

        {/* ── Edit mode ─────────────────────────────────────────── */}
        {editMode ? (
          <EditModeContent
            editCourses={editCourses}
            candidatePool={candidatePool}
            candidatePoolLoading={candidatePoolLoading}
            programLabelMap={programLabelMap}
            onRemove={handleRemoveCourse}
            onAdd={handleAddCourse}
            onApply={handleApply}
            onCancel={() => setEditMode(false)}
            applyLoading={applyLoading}
          />
        ) : (
          <>
            {/* ── View mode: course cards ───────────────────────── */}
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
                Nothing to recommend this semester. Respectfully... later.
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
                <h3 className="text-sm font-semibold text-gold uppercase tracking-wider hash-mark">
                  Projected Progress
                </h3>
                {semester.projection_note && (
                  <p className="text-sm text-ink-faint">{esc(semester.projection_note)}</p>
                )}
                <div className="space-y-6">
                  {groupProgressByTierWithMajors(semesterProgress, programLabelMap, programOrder).map((section) => (
                    <div key={section.sectionKey} className="space-y-3">
                      <h4 className="text-sm font-bold text-mu-blue uppercase tracking-wider border-b border-border-subtle/30 pb-1">
                        {section.label}
                      </h4>
                      {section.subGroups ? (
                        <div className="space-y-5">
                          {section.subGroups.map((group) => (
                            <div key={group.parentId} className="space-y-2">
                              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider pl-1">
                                {group.label}
                              </p>
                              <SemesterBucketGrid entries={group.entries} programLabelMap={programLabelMap} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <SemesterBucketGrid entries={section.entries} programLabelMap={programLabelMap} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Done button after edit applied */}
            {editApplied && (
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle/40">
                <p className="text-xs text-ink-faint">
                  Downstream semesters have been re-generated.
                </p>
                <Button variant="gold" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Edit mode content ──────────────────────────────────────── */

function EditModeContent({
  editCourses,
  candidatePool,
  candidatePoolLoading,
  programLabelMap,
  onRemove,
  onAdd,
  onApply,
  onCancel,
  applyLoading,
}: {
  editCourses: RecommendedCourse[];
  candidatePool?: RecommendedCourse[];
  candidatePoolLoading?: boolean;
  programLabelMap?: Map<string, string>;
  onRemove(code: string): void;
  onAdd(course: RecommendedCourse): void;
  onApply(): void;
  onCancel(): void;
  applyLoading: boolean;
}) {
  const editCodes = useMemo(
    () => new Set(editCourses.map((c) => c.course_code)),
    [editCourses],
  );
  const available = (candidatePool ?? []).filter((c) => !editCodes.has(c.course_code));

  return (
    <div className="space-y-6">
      {/* Selected courses */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gold uppercase tracking-wider hash-mark">
          Selected Courses ({editCourses.length})
        </h3>
        {editCourses.length === 0 ? (
          <p className="text-sm text-ink-faint italic">No courses selected.</p>
        ) : (
          <div className="space-y-3">
            {editCourses.map((c) => (
              <EditCourseRow
                key={c.course_code}
                course={c}
                programLabelMap={programLabelMap}
                action="remove"
                onAction={() => onRemove(c.course_code)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available alternatives */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gold uppercase tracking-wider hash-mark">
          Add a Course
        </h3>
        {candidatePoolLoading ? (
          <div className="flex items-center gap-2 px-2 py-4">
            <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-ink-faint">Loading eligible courses...</span>
          </div>
        ) : available.length === 0 ? (
          <p className="text-sm text-ink-faint italic">No additional eligible courses.</p>
        ) : (
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {available.map((c) => (
              <EditCourseRow
                key={c.course_code}
                course={c}
                programLabelMap={programLabelMap}
                action="add"
                onAction={() => onAdd(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle/40">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={applyLoading}>
          Cancel
        </Button>
        <Button variant="gold" size="sm" onClick={onApply} disabled={applyLoading || editCourses.length === 0}>
          {applyLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
              Re-running...
            </span>
          ) : (
            "Apply Changes"
          )}
        </Button>
      </div>
    </div>
  );
}

/* ── Single course row (used in edit mode) ──────────────────── */

function EditCourseRow({
  course,
  programLabelMap,
  action,
  onAction,
}: {
  course: RecommendedCourse;
  programLabelMap?: Map<string, string>;
  action: "add" | "remove";
  onAction(): void;
}) {
  const bucketIds = course.fills_buckets ?? [];
  return (
    <div className="flex items-center gap-3 bg-surface-card/80 rounded-2xl border border-border-subtle p-4 accent-left-gold">
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <span className="font-semibold text-[#7ab3ff] text-sm">
              {course.course_code}
            </span>
            {course.course_name && (
              <>
                <span className="text-ink-faint mx-1.5">&mdash;</span>
                <span className="text-ink-primary text-sm">{course.course_name}</span>
              </>
            )}
          </div>
        </div>
        {bucketIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bucketIds.map((bid, idx) => {
              const isBcc = bid.includes("BCC_REQUIRED");
              const variant = isBcc
                ? "bcc"
                : idx === 0
                  ? "bucket"
                  : idx === 1
                    ? "secondary"
                    : "gold";
              return (
                <Tag key={bid} variant={variant}>
                  {bucketLabel(bid, programLabelMap)}
                </Tag>
              );
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onAction}
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base font-bold transition-colors ${
          action === "remove"
            ? "text-bad hover:bg-bad-light/30"
            : "text-ok hover:bg-ok/10"
        }`}
        aria-label={action === "remove" ? "Remove course" : "Add course"}
      >
        {action === "remove" ? "\u00d7" : "+"}
      </button>
    </div>
  );
}

/* ── Bucket progress grid (unchanged) ───────────────────────── */

function SemesterBucketGrid({
  entries,
  programLabelMap,
}: {
  entries: [string, BucketProgress][];
  programLabelMap?: Map<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {entries.map(([bid, prog]: [string, BucketProgress]) => {
        const { done, inProg, needed, unit } = getBucketDisplay(prog);
        const ipCodes = prog.in_progress_applied || [];
        const label = compactKpiBucketLabel(
          prog.label || bucketLabel(bid, programLabelMap),
        );
        const creditNeeded = Number(prog.needed || 0);
        const creditDone = Number(prog.completed_done ?? prog.done_count ?? 0);
        const creditInProg = Number(prog.in_progress_increment ?? 0);
        const pct = creditNeeded > 0 ? (creditDone / creditNeeded) * 100 : 0;
        const totalPct = creditNeeded > 0 ? ((creditDone + creditInProg) / creditNeeded) * 100 : 0;
        const satisfied = prog.satisfied || (creditNeeded > 0 && creditDone >= creditNeeded);

        return (
          <div
            key={bid}
            className={`rounded-xl border border-border-subtle/50 p-4 h-full ${satisfied ? "opacity-60" : ""}`}
          >
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-medium text-ink-primary">
                {label}
              </span>
              <span className="text-xs text-ink-faint">
                {done}
                {inProg > 0 && (
                  <span className="text-gold">+{inProg}</span>
                )}
                /{needed} {unit}
                {satisfied && (
                  <span className="text-ok ml-1">(Done)</span>
                )}
              </span>
            </div>
            <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="h-full bg-ok rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
                {inProg > 0 && (
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100 - Math.min(100, pct), totalPct - pct)}%`,
                    }}
                  />
                )}
              </div>
            </div>
            {ipCodes.length > 0 && (
              <p className="text-xs text-gold/70 mt-1.5">
                In progress courses: {ipCodes.join(", ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
