"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "motion/react";
import type { BucketDetailState, Course, RecommendedCourse, SemesterData } from "@/lib/types";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
import { CourseCard } from "./CourseCard";
import { Tag } from "@/components/shared/Tag";
import { groupProgressByTierWithMajors, sortBucketsByTier } from "@/lib/rendering";
import { getSemesterQuip } from "@/lib/quips";
import { BucketSectionTabs } from "./BucketSectionTabs";
import { BucketCourseModal } from "./BucketCourseModal";
import { bucketLabel, esc } from "@/lib/utils";

interface SemesterModalProps {
  open: boolean;
  onClose: () => void;
  openMode?: "view" | "edit";
  semester: SemesterData | null;
  index: number;
  totalCount: number;
  requestedCount: number;
  courses: Course[];
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
  programOrder?: string[];
  // Navigation
  onNext?(): void;
  onBack?(): void;
  declaredMajors?: string[];
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
  openMode = "view",
  semester,
  index,
  totalCount,
  requestedCount,
  courses,
  declaredMajors,
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
  const [bucketDetail, setBucketDetail] = useState<BucketDetailState | null>(null);
  const [editDetailCode, setEditDetailCode] = useState<string | null>(null);
  const bucketTriggerRef = useRef<HTMLButtonElement | null>(null);
  const autoEnteredEditRef = useRef(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      autoEnteredEditRef.current = false;
      setEditMode(false);
      setEditCourses([]);
      setApplyLoading(false);
      setEditApplied(false);
      setBucketDetail(null);
      setEditDetailCode(null);
    }
  }, [open]);

  const recs = useMemo(() => semester?.recommendations ?? [], [semester]);
  const semesterProgress = semester?.projected_progress || semester?.progress;
  const canEdit = Boolean(onEditApply) && recs.length > 0;
  const catalogCourseMap = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((course) => map.set(course.course_code, course));
    return map;
  }, [courses]);
  const editRecommendedMap = useMemo(() => {
    const map = new Map<string, RecommendedCourse>();
    [...recs, ...(candidatePool ?? []), ...editCourses].forEach((course) => {
      map.set(course.course_code, course);
    });
    return map;
  }, [candidatePool, editCourses, recs]);
  const editDetailCourse = editDetailCode ? editRecommendedMap.get(editDetailCode) : undefined;
  const editFallbackCourse = editDetailCode ? catalogCourseMap.get(editDetailCode) : undefined;

  useEffect(() => {
    if (!open || openMode !== "edit" || autoEnteredEditRef.current || !semester) return;
    autoEnteredEditRef.current = true;
    setEditApplied(false);
    setEditCourses([...(semester.recommendations ?? [])]);
    setEditMode(true);
    onRequestCandidates?.();
  }, [open, openMode, onRequestCandidates, semester]);

  if (!semester) return null;

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

  const closeBucketDetail = () => {
    setBucketDetail(null);
    window.setTimeout(() => {
      bucketTriggerRef.current?.focus();
    }, 0);
  };

  const openBucketDetail = (bucket: {
    bucketId: string;
    bucketLabel: string;
    progress: { completed_applied?: string[]; in_progress_applied?: string[] };
    triggerEl: HTMLButtonElement;
  }) => {
    bucketTriggerRef.current = bucket.triggerEl;
    setBucketDetail({
      bucketId: bucket.bucketId,
      bucketLabel: bucket.bucketLabel,
      mode: "projected",
      completedCodes: bucket.progress.completed_applied ?? [],
      inProgressCodes: bucket.progress.in_progress_applied ?? [],
    });
  };

  const handleBucketCourseClick = (courseCode: string) => {
    setBucketDetail(null);
    onCourseClick?.(courseCode);
  };

  return (
    <>
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
        <div className="space-y-6">
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
                <p className="text-[0.98rem] text-ink-muted italic truncate">
                  {getSemesterQuip({ semester, index, requestedCount, declaredMajors })}
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
                {canEdit && (
                  <Button variant="secondary" size="sm" onClick={handleEnterEdit}>
                    Edit Semester
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
                Some courses were not found in the catalog:{" "}
                {semester.not_in_catalog_warning.map(esc).join(", ")}
              </div>
            )}

            {(semester.eligible_count || 0) < requestedCount && recs.length > 0 &&
              !semester.target_semester?.toLowerCase().includes("summer") && (
              <div className="bg-bad-light rounded-xl p-4 text-[1.05rem] text-bad">
                You asked for {requestedCount}, but only {semester.eligible_count} eligible course(s) fit this term.
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
            onCourseOpen={setEditDetailCode}
          />
        ) : (
          <>
            {/* ── View mode: course cards ───────────────────────── */}
              {recs.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {recs.map((c, idx) => (
                    <motion.div
                      key={c.course_code}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full"
                    >
                      <CourseCard
                        course={c}
                        programLabelMap={programLabelMap}
                        bucketLabelMap={bucketLabelMap}
                        variant="compact"
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
              <div className="space-y-4">
                <h3 className="text-[0.98rem] font-semibold text-gold uppercase tracking-wider hash-mark">
                  Projected Progress
                </h3>
                {semester.projection_note && (
                  <p className="text-[0.92rem] text-ink-faint">{esc(semester.projection_note)}</p>
                )}
                <BucketSectionTabs
                  sections={groupProgressByTierWithMajors(semesterProgress, programLabelMap, programOrder)}
                  programLabelMap={programLabelMap}
                  animate={false}
                  onBucketClick={openBucketDetail}
                  layoutId="semester-projected-sections"
                />
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
      {bucketDetail && (
        <BucketCourseModal
          open={bucketDetail !== null}
          onClose={closeBucketDetail}
          bucketLabel={bucketDetail.bucketLabel}
          mode={bucketDetail.mode}
          completedCodes={bucketDetail.completedCodes}
          inProgressCodes={bucketDetail.inProgressCodes}
          courses={courses}
          onCourseClick={handleBucketCourseClick}
        />
      )}
      <CourseDetailModal
        open={editDetailCode !== null}
        onClose={() => setEditDetailCode(null)}
        courseCode={editDetailCode ?? ""}
        courseName={editDetailCourse?.course_name ?? editFallbackCourse?.course_name}
        credits={editDetailCourse?.credits ?? editFallbackCourse?.credits}
        description={editFallbackCourse?.description}
        prereqRaw={editFallbackCourse?.catalog_prereq_raw}
        buckets={editDetailCourse?.fills_buckets}
        plannerReason={editDetailCourse?.why}
        plannerNotes={editDetailCourse?.notes}
        plannerWarnings={editDetailCourse?.warning_text ? [editDetailCourse.warning_text] : undefined}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
      />
    </>
  );
}

/* ── Edit mode content — two-column swap layout ────────────── */

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
  onCourseOpen,
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
  onCourseOpen(code: string): void;
}) {
  const [mobileTab, setMobileTab] = useState<"selected" | "swaps">("selected");
  const [swapFilter, setSwapFilter] = useState("");
  const trimmedFilter = swapFilter.trim();
  const editCodes = useMemo(
    () => new Set(editCourses.map((c) => c.course_code)),
    [editCourses],
  );
  const available = useMemo(() => {
    const pool = (candidatePool ?? []).filter((c) => !editCodes.has(c.course_code));
    if (!trimmedFilter) return pool;
    const q = trimmedFilter.toLowerCase();
    return pool.filter(
      (c) =>
        c.course_code.toLowerCase().includes(q) ||
        (c.course_name && c.course_name.toLowerCase().includes(q)),
    );
  }, [candidatePool, editCodes, trimmedFilter]);

  const activeMobileTab = editCourses.length === 0 ? "swaps" : mobileTab;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="inline-flex rounded-full border border-border-subtle bg-surface-sunken p-1">
          <button
            type="button"
            onClick={() => setMobileTab("selected")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
              activeMobileTab === "selected" ? "bg-gold/16 text-gold-light" : "text-ink-muted"
            }`}
          >
            Your Courses ({editCourses.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("swaps")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
              activeMobileTab === "swaps" ? "bg-mu-blue/18 text-ink-accent-blue" : "text-ink-muted"
            }`}
          >
            Eligible Swaps ({available.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className={`${activeMobileTab === "selected" ? "flex" : "hidden"} flex-col rounded-[1.2rem] border border-border-subtle bg-[rgba(7,18,39,0.44)] p-3 md:flex`}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light">Selected</p>
              <h3 className="mt-1 text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
                Your Courses
              </h3>
            </div>
            <span className="text-sm font-semibold text-gold-light">{editCourses.length}</span>
          </div>
          <div className="max-h-[min(44vh,24rem)] min-h-[12rem] space-y-2 overflow-y-auto pr-1 md:max-h-[26rem]">
            {editCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium text-ink-secondary">No courses selected</p>
                <p className="text-xs text-ink-faint mt-1">Add courses from the right panel.</p>
              </div>
            ) : (
              editCourses.map((c) => (
                <EditCourseRow
                  key={c.course_code}
                  course={c}
                  programLabelMap={programLabelMap}
                  bucketLabelMap={bucketLabelMap}
                  action="remove"
                  onAction={() => onRemove(c.course_code)}
                  onOpen={() => onCourseOpen(c.course_code)}
                />
              ))
            )}
          </div>
        </section>

        <section className={`${activeMobileTab === "swaps" ? "flex" : "hidden"} flex-col rounded-[1.2rem] border border-border-subtle bg-[rgba(7,18,39,0.44)] p-3 md:flex`}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-accent-blue">Swap Pool</p>
              <h3 className="mt-1 text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
                Eligible Swaps
              </h3>
            </div>
            <span className="text-sm font-semibold text-ink-accent-blue">{available.length}</span>
          </div>
          <input
            type="text"
            value={swapFilter}
            onChange={(e) => setSwapFilter(e.target.value)}
            placeholder="Filter courses..."
            className="mb-2 w-full rounded-lg border border-border-medium bg-surface-input px-3 py-2 text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-gold/40"
          />
          {candidatePoolLoading ? (
            <div className="flex items-center gap-3 py-6 justify-center">
              <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-ink-faint">Loading eligible courses...</span>
            </div>
          ) : available.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-ink-secondary">
                {trimmedFilter ? "No matches" : "No eligible courses"}
              </p>
              <p className="text-xs text-ink-faint mt-1">
                {trimmedFilter ? "Try a different search." : "All eligible courses are already selected."}
              </p>
            </div>
          ) : (
            <div className="max-h-[min(44vh,24rem)] space-y-2 overflow-y-auto pr-1 md:max-h-[26rem]">
              {available.map((c) => (
                <EditCourseRow
                  key={c.course_code}
                  course={c}
                  programLabelMap={programLabelMap}
                  bucketLabelMap={bucketLabelMap}
                  action="add"
                  onAction={() => onAdd(c)}
                  onOpen={() => onCourseOpen(c.course_code)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="divider-fade" />
      <div className="sticky bottom-0 -mx-1 mt-1 flex items-center justify-end gap-3 rounded-b-[1.1rem] border-t border-border-subtle bg-[rgba(7,18,39,0.96)] px-1 pb-1 pt-3">
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
            "Apply swaps"
          )}
        </Button>
      </div>
    </div>
  );
}

/* ── Compact course row (used in swap mode) ───────────────── */

function EditCourseRow({
  course,
  programLabelMap,
  bucketLabelMap,
  action,
  onAction,
  onOpen,
}: {
  course: RecommendedCourse;
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
  action: "add" | "remove";
  onAction(): void;
  onOpen(): void;
}) {
  const bucketIds = course.fills_buckets ?? [];
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
      action === "remove"
        ? "glass-card border-l-2 border-l-ok/50"
        : "border border-border-medium hover:border-mu-blue/30 hover:bg-[rgba(0,114,206,0.04)]"
    }`}>
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
      >
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-mu-blue text-sm whitespace-nowrap">
            {course.course_code}
          </span>
          {course.course_name && (
            <span className="text-ink-primary text-sm truncate">{course.course_name}</span>
          )}
        </div>
        {bucketIds.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {sortBucketsByTier(bucketIds).slice(0, 3).map((bid, idx) => {
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
            {bucketIds.length > 3 && (
              <span className="text-[10px] text-ink-faint self-center">+{bucketIds.length - 3}</span>
            )}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onAction}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition-colors ${
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

