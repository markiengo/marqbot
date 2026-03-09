"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Modal } from "@/components/shared/Modal";
import type { BucketDetailMode, Course } from "@/lib/types";

interface BucketCourseModalProps {
  open: boolean;
  onClose: () => void;
  bucketLabel: string;
  mode: BucketDetailMode;
  completedCodes: string[];
  inProgressCodes: string[];
  courses: Course[];
  onCourseClick?: (courseCode: string) => void;
}

function dedupeCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of codes) {
    const code = String(raw || "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    ordered.push(code);
  }
  return ordered;
}

export function BucketCourseModal({
  open,
  onClose,
  bucketLabel,
  mode,
  completedCodes,
  inProgressCodes,
  courses,
  onCourseClick,
}: BucketCourseModalProps) {
  const courseMap = useMemo(() => {
    const map = new Map<string, Course>();
    for (const course of courses) {
      map.set(course.course_code, course);
    }
    return map;
  }, [courses]);

  const takenCodes = useMemo(
    () => dedupeCodes(completedCodes),
    [completedCodes],
  );
  const inProgressOnlyCodes = useMemo(() => {
    const takenSet = new Set(takenCodes);
    return dedupeCodes(inProgressCodes).filter((code) => !takenSet.has(code));
  }, [inProgressCodes, takenCodes]);

  const totalCount = takenCodes.length + inProgressOnlyCodes.length;
  const inProgressLabel = mode === "projected" ? "In Progress / Planned" : "In Progress";

  const handleCourseClick = (courseCode: string) => {
    onClose();
    onCourseClick?.(courseCode);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="default"
      title={`${bucketLabel} (${totalCount})`}
    >
      <div className="space-y-4">
        {takenCodes.length === 0 && inProgressOnlyCodes.length === 0 ? (
          <p className="text-sm text-ink-faint italic">No courses are counting here yet.</p>
        ) : (
          <>
            {takenCodes.length > 0 && (
              <BucketCourseSection
                title="Taken / Counted"
                count={takenCodes.length}
                tone="green"
                courseCodes={takenCodes}
                courseMap={courseMap}
                onCourseClick={handleCourseClick}
              />
            )}
            {inProgressOnlyCodes.length > 0 && (
              <BucketCourseSection
                title={inProgressLabel}
                count={inProgressOnlyCodes.length}
                tone="yellow"
                courseCodes={inProgressOnlyCodes}
                courseMap={courseMap}
                onCourseClick={handleCourseClick}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function BucketCourseSection({
  title,
  count,
  tone,
  courseCodes,
  courseMap,
  onCourseClick,
}: {
  title: string;
  count: number;
  tone: "green" | "yellow";
  courseCodes: string[];
  courseMap: Map<string, Course>;
  onCourseClick: (courseCode: string) => void;
}) {
  const sectionTone =
    tone === "green"
      ? {
          wrapper: "border-ok/20 bg-ok/8",
          heading: "text-ok",
          badge: "bg-ok/14 text-ok border-ok/20",
        }
      : {
          wrapper: "border-gold/20 bg-gold/8",
          heading: "text-gold",
          badge: "bg-gold/14 text-gold border-gold/20",
        };

  return (
    <section className={`rounded-xl border px-4 py-3 ${sectionTone.wrapper}`}>
      <div className="flex items-center justify-between gap-3">
        <h4 className={`text-xs font-semibold uppercase tracking-[0.22em] ${sectionTone.heading}`}>
          {title}
        </h4>
        <span className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${sectionTone.badge}`}>
          {count}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {courseCodes.map((code, idx) => {
          const course = courseMap.get(code);
          return (
            <motion.button
              key={code}
              type="button"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, delay: Math.min(idx * 0.025, 0.2) }}
              onClick={() => onCourseClick(code)}
              className="glass-card card-glow-hover rounded-xl border border-border-card px-3.5 py-3 text-left transition-colors hover:border-gold/30 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-mu-blue truncate">{code}</p>
                  {course?.course_name && (
                    <p className="mt-0.5 text-xs text-ink-primary truncate">{course.course_name}</p>
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
    </section>
  );
}
