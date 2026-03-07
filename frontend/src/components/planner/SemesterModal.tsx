"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import type { SemesterData, RecommendedCourse } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { CourseCard } from "./CourseCard";
import { Tag } from "@/components/shared/Tag";
import { groupProgressByTierWithMajors, sortBucketsByTier } from "@/lib/rendering";
import { getSemesterQuip } from "@/lib/quips";
import { BucketProgressGrid } from "./BucketProgressGrid";
import { bucketLabel, esc } from "@/lib/utils";

interface SemesterModalProps {
  open: boolean;
  onClose: () => void;
  semester: SemesterData | null;
  index: number;
  totalCount: number;
  requestedCount: number;
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
  programOrder?: string[];
  // Navigation
  onNext?(): void;
  onBack?(): void;
  // Edit mode props — omit to hide edit button
  candidatePool?: RecommendedCourse[];
  candidatePoolLoading?: boolean;
  onRequestCandidates?(): void;
  onEditApply?(chosenCourses: RecommendedCourse[]): Promise<void>;
  onCourseClick?: (courseCode: string) => void;
}

export function SemesterModal({
  open,
  onClose,
  semester,
  index,
  totalCount,
  requestedCount,
  programLabelMap,
  bucketLabelMap,
  programOrder,
  onNext,
  onBack,
  candidatePool,
  candidatePoolLoading,
  onRequestCandidates,
  onEditApply,
  onCourseClick,
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
      titleClassName="text-[1.7rem] font-semibold font-[family-name:var(--font-sora)] text-ink-primary"
      titleExtra={semester.standing_label ? (
        <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-gold/15 text-gold border border-gold/30 shadow-[0_0_10px_rgba(255,204,0,0.12)] pulse-gold-soft whitespace-nowrap">
          {semester.standing_label} Standing
        </span>
      ) : undefined}
    >
      <div className="space-y-8">
        {/* Quip + navigation + edit button row */}
        {!editMode ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {editApplied && (
                  <span className="text-sm font-medium px-3 py-1.5 rounded-full bg-ok/15 text-ok border border-ok/30 shrink-0">
                    Updated
                  </span>
                )}
                <p className="text-[1.05rem] text-ink-muted italic truncate">
                  {getSemesterQuip({ semester, index, requestedCount })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {index > 0 && onBack && (
                  <Button variant="secondary" size="sm" onClick={onBack}>
                    Back
                  </Button>
                )}
                {index < totalCount - 1 && onNext && (
                  <Button variant="secondary" size="sm" onClick={onNext}>
                    Next
                  </Button>
                )}
                {canEdit && !editApplied && (
                  <Button variant="secondary" size="sm" onClick={handleEnterEdit}>
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="divider-fade" />
          </>
        ) : null}

        {/* Warnings — view mode only */}
        {!editMode && (
          <>
            {semester.not_in_catalog_warning && semester.not_in_catalog_warning.length > 0 && (
              <div className="bg-bad-light rounded-xl p-4 text-[1.05rem] text-bad">
                Warning: Some courses not found in catalog:{" "}
                {semester.not_in_catalog_warning.map(esc).join(", ")}
              </div>
            )}

            {(semester.eligible_count || 0) < requestedCount && recs.length > 0 &&
              !semester.target_semester?.toLowerCase().includes("summer") && (
              <div className="bg-bad-light rounded-xl p-4 text-[1.05rem] text-bad">
                Warning: You requested {requestedCount}, but only {semester.eligible_count}{" "}
                eligible course(s) match for this term.
              </div>
            )}

            {/* Balance policy notes */}
            {semester.balance_policy && recs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {!semester.balance_policy.declared_min_relaxed && (semester.balance_policy.declared_min_achieved ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-ok/10 text-ok border border-ok/20">
                    Major/track progress prioritized
                  </span>
                )}
                {semester.balance_policy.declared_min_relaxed && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">
                    Limited major/track courses eligible this term
                  </span>
                )}
                {semester.balance_policy.family_cap_relaxed && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">
                    Family balance relaxed (few eligible families)
                  </span>
                )}
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
            bucketLabelMap={bucketLabelMap}
            onRemove={handleRemoveCourse}
            onAdd={handleAddCourse}
            onApply={handleApply}
            onCancel={() => setEditMode(false)}
            applyLoading={applyLoading}
            onCourseClick={onCourseClick}
          />
        ) : (
          <>
            {/* ── View mode: course cards ───────────────────────── */}
            {recs.length > 0 ? (
              <div className="space-y-4">
                {recs.map((c, idx) => (
                  <motion.div
                    key={c.course_code}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <CourseCard
                      course={c}
                      programLabelMap={programLabelMap}
                      bucketLabelMap={bucketLabelMap}
                      onClick={onCourseClick ? () => onCourseClick(c.course_code) : undefined}
                    />
                  </motion.div>
                ))}
              </div>
            ) : null}

            {/* In-progress note */}
            {semester.in_progress_note && (
              <p className="text-[1.05rem] text-bad">
                Warning: {esc(semester.in_progress_note)}
              </p>
            )}

            {/* Summer note */}
            {semester.target_semester && semester.target_semester.toLowerCase().includes("summer") && (
              <div className="rounded-lg bg-gold/10 border border-gold/25 px-4 py-3 text-sm text-gold/80 leading-relaxed">
                Summer semesters are capped at <span className="font-semibold text-gold">4 courses (max 12 credits)</span>. Only courses with confirmed summer availability are shown.
              </div>
            )}

            {/* Projected progress */}
            {semesterProgress && Object.keys(semesterProgress).length > 0 && (
              <>
              <div className="divider-fade" />
              <div className="space-y-5">
                <h3 className="text-[1.05rem] font-semibold text-gold uppercase tracking-wider hash-mark">
                  Projected Progress
                </h3>
                {semester.projection_note && (
                  <p className="text-[1.05rem] text-ink-faint">{esc(semester.projection_note)}</p>
                )}
                <div className="space-y-7">
                  {groupProgressByTierWithMajors(semesterProgress, programLabelMap, programOrder).map((section) => (
                    <div key={section.sectionKey} className="space-y-4">
                      <h4 className="text-[1.05rem] font-bold text-mu-blue uppercase tracking-wider border-b border-border-subtle/30 pb-1.5">
                        {section.label}
                      </h4>
                      {section.subGroups ? (
                        <div className="space-y-6">
                          {section.subGroups.map((group) => (
                            <div key={group.parentId} className="space-y-3">
                              <p className="text-sm font-semibold text-ink-secondary uppercase tracking-wider pl-1">
                                {group.label}
                              </p>
                              <BucketProgressGrid entries={group.entries} programLabelMap={programLabelMap} animate={false} stripParentPrefix />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <BucketProgressGrid entries={section.entries} programLabelMap={programLabelMap} animate={false} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              </>
            )}

            {/* Done button after edit applied */}
            {editApplied && (
              <>
              <div className="divider-fade" />
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-ink-faint">
                  Downstream semesters have been re-generated.
                </p>
                <Button variant="gold" size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
              </>
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
  bucketLabelMap,
  onRemove,
  onAdd,
  onApply,
  onCancel,
  applyLoading,
  onCourseClick,
}: {
  editCourses: RecommendedCourse[];
  candidatePool?: RecommendedCourse[];
  candidatePoolLoading?: boolean;
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
  onRemove(code: string): void;
  onAdd(course: RecommendedCourse): void;
  onApply(): void;
  onCancel(): void;
  applyLoading: boolean;
  onCourseClick?: (courseCode: string) => void;
}) {
  const editCodes = useMemo(
    () => new Set(editCourses.map((c) => c.course_code)),
    [editCourses],
  );
  const available = (candidatePool ?? []).filter((c) => !editCodes.has(c.course_code));

  return (
    <div className="space-y-8">
      {/* Selected courses */}
      <div className="space-y-4">
        <h3 className="text-[1.05rem] font-semibold text-gold uppercase tracking-wider hash-mark">
          Selected Courses ({editCourses.length})
        </h3>
        {editCourses.length === 0 ? (
          <p className="text-[1.05rem] text-ink-faint italic">No courses selected.</p>
        ) : (
          <div className="space-y-4">
            {editCourses.map((c) => (
              <EditCourseRow
                key={c.course_code}
                course={c}
                programLabelMap={programLabelMap}
                bucketLabelMap={bucketLabelMap}
                action="remove"
                onAction={() => onRemove(c.course_code)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available alternatives */}
      <div className="space-y-4">
        <h3 className="text-[1.05rem] font-semibold text-gold uppercase tracking-wider hash-mark">
          Add a Course
        </h3>
        {candidatePoolLoading ? (
          <div className="flex items-center gap-3 px-2 py-5">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-[1.05rem] text-ink-faint">Loading eligible courses...</span>
          </div>
        ) : available.length === 0 ? (
          <p className="text-[1.05rem] text-ink-faint italic">No additional eligible courses.</p>
        ) : (
          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {available.map((c) => (
              <EditCourseRow
                key={c.course_code}
                course={c}
                programLabelMap={programLabelMap}
                bucketLabelMap={bucketLabelMap}
                action="add"
                onAction={() => onAdd(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="divider-fade mt-2" />
      <div className="flex items-center justify-end gap-3 pt-3">
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
  bucketLabelMap,
  action,
  onAction,
}: {
  course: RecommendedCourse;
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
  action: "add" | "remove";
  onAction(): void;
}) {
  const bucketIds = course.fills_buckets ?? [];
  return (
    <div className={`flex items-center gap-4 glass-card card-glow-hover rounded-2xl p-5 ${action === "remove" ? "border-l-2 border-l-ok/50" : "border-l-2 border-l-mu-blue/50"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            {/* Use the token, not a hardcoded hex */}
            <span className="font-semibold text-mu-blue text-[1.05rem]">
              {course.course_code}
            </span>
            {course.course_name && (
              <>
                <span className="text-ink-faint mx-1.5">&mdash;</span>
                <span className="text-ink-primary text-[1.05rem]">{course.course_name}</span>
              </>
            )}
          </div>
        </div>
        {bucketIds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sortBucketsByTier(bucketIds).map((bid, idx) => {
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
                  {bucketLabel(bid, programLabelMap, bucketLabelMap, true)}
                </Tag>
              );
            })}
          </div>
        )}
      </div>
      {/* 44×44 minimum touch target */}
      <button
        type="button"
        onClick={onAction}
        className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold transition-colors ${
          action === "remove"
            ? "text-bad hover:bg-bad-light/30"
            : "text-ok hover:bg-ok/10"
        }`}
        aria-label={action === "remove" ? `Remove ${course.course_code}` : `Add ${course.course_code}`}
      >
        {action === "remove" ? "\u00d7" : "+"}
      </button>
    </div>
  );
}

