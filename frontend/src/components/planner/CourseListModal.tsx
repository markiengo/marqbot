"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Modal } from "@/components/shared/Modal";
import type { Course } from "@/lib/types";

interface CourseListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  courseCodes: Set<string>;
  courses: Course[];
  onCourseClick?: (courseCode: string) => void;
}

export function CourseListModal({
  open,
  onClose,
  title,
  courseCodes,
  courses,
  onCourseClick,
}: CourseListModalProps) {
  const courseMap = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of courses) m.set(c.course_code, c);
    return m;
  }, [courses]);

  const sorted = useMemo(
    () => [...courseCodes].sort((a, b) => a.localeCompare(b)),
    [courseCodes],
  );

  return (
    <Modal open={open} onClose={onClose} size="default" title={`${title} (${courseCodes.size})`}>
      {sorted.length === 0 ? (
        <p className="text-[1.05rem] text-ink-faint italic">No courses.</p>
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
    </Modal>
  );
}
