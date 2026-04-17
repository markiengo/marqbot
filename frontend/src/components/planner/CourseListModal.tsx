"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Modal } from "@/components/shared/Modal";
import type { Course } from "@/lib/types";

interface CourseListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  courseCodes: Set<string>;
  courses: Course[];
  assumptionNotes?: string[] | null;
  rawCourseCodes?: Set<string>;
  assumptionsOn?: boolean;
  onToggleAssumptions?: () => void;
  onCourseClick?: (courseCode: string) => void;
}

export function CourseListModal({
  open,
  onClose,
  title,
  courseCodes,
  courses,
  assumptionNotes,
  rawCourseCodes,
  assumptionsOn = false,
  onToggleAssumptions,
  onCourseClick,
}: CourseListModalProps) {
  const courseMap = useMemo(() => {
    if (!open) return new Map<string, Course>();
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.course_code, c);
    return m;
  }, [open, courses]);

  const notes = useMemo(
    () => (open ? (assumptionNotes || []).map((note) => note.trim()).filter(Boolean) : []),
    [open, assumptionNotes],
  );
  const scopeNote = useMemo(
    () => notes.find((note) => note.startsWith("Inference scope:")) ?? null,
    [notes],
  );
  const detailNotes = useMemo(
    () => notes.filter((note) => note !== scopeNote),
    [notes, scopeNote],
  );

  const hasAssumptions = notes.length > 0 && rawCourseCodes !== undefined;
  const activeCodes = hasAssumptions && !assumptionsOn ? rawCourseCodes : courseCodes;

  const sorted = useMemo(
    () => (open ? [...activeCodes].sort((a, b) => a.localeCompare(b)) : []),
    [open, activeCodes],
  );

  return (
    <Modal open={open} onClose={onClose} size="default" title={`${title} (${activeCodes.size})`}>
      <div className="space-y-5">
        {hasAssumptions && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-ink-muted">
              Prereq assumptions
            </p>
            <button
              type="button"
              onClick={onToggleAssumptions}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                assumptionsOn
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-border-medium bg-surface-card text-ink-faint"
              }`}
            >
              <span
                className={`inline-block h-2 w-2 rounded-full transition-colors ${
                  assumptionsOn ? "bg-gold" : "bg-ink-faint/40"
                }`}
              />
              {assumptionsOn ? "On" : "Off"}
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {assumptionsOn && notes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-gold/20 bg-gold/8 px-4 py-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-gold">
                  Assumptions Applied
                </p>
                <div className="mt-2 space-y-2">
                  {detailNotes.map((note) => (
                    <p key={note} className="text-sm text-ink-secondary leading-relaxed">
                      {note}
                    </p>
                  ))}
                  {scopeNote && (
                    <p className="text-xs text-ink-faint leading-relaxed">
                      {scopeNote}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {sorted.length === 0 ? (
          <p className="text-[1.05rem] text-ink-faint italic">No courses in this list yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sorted.map((code, idx) => {
              const course = courseMap.get(code);
              return (
                <motion.button
                  key={code}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.4) }}
                  onClick={() => onCourseClick?.(code)}
                  className="glass-card card-glow-hover rounded-xl p-4 text-left cursor-pointer transition-colors hover:border-gold/30 border border-border-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-mu-blue truncate">{code}</p>
                      {course?.course_name && (
                        <p className="text-xs text-ink-primary mt-0.5 truncate">{course.course_name}</p>
                      )}
                    </div>
                    {course?.credits != null && (
                      <span className="shrink-0 text-xs font-bold text-gold tabular-nums">
                        {course.credits}cr
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
