"use client";

import { motion } from "motion/react";
import type { RecommendedCourse } from "@/lib/types";
import { Tag } from "@/components/shared/Tag";
import { bucketLabel, colorizePrereq, formatCourseNotes, esc } from "@/lib/utils";
import {
  formatCourseNameLabel,
  humanizeSoftWarningTag,
  normalizeWarningTextMessages,
} from "@/lib/rendering";

interface CourseCardProps {
  course: RecommendedCourse;
  programLabelMap?: Map<string, string>;
}

export function CourseCard({ course, programLabelMap }: CourseCardProps) {
  const c = course;
  const bucketIds = c.fills_buckets || [];

  // Build warning messages
  const warningMessages: string[] = [];
  if (c.warning_text) {
    warningMessages.push(...normalizeWarningTextMessages(c.warning_text));
  }
  if (Array.isArray(c.soft_tags) && c.soft_tags.length) {
    const normalized = [
      ...new Set(
        c.soft_tags
          .map((tag) => humanizeSoftWarningTag(tag, c))
          .filter(Boolean),
      ),
    ];
    warningMessages.push(...normalized);
  }
  const dedupedWarnings = [...new Set(warningMessages.filter(Boolean))];
  if (c.low_confidence) {
    dedupedWarnings.push("offering schedule may vary; confirm with registrar");
  }

  const courseName = formatCourseNameLabel(c.course_name || "");
  const prereqHtml = colorizePrereq(c.prereq_check || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 8px 25px -5px rgba(0,0,0,0.3)" }}
      className="bg-surface-card/80 backdrop-blur-sm rounded-2xl border border-border-subtle p-5 transition-shadow"
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-semibold text-[#7ab3ff] text-base">
              {esc(c.course_code || "")}
            </span>
            {courseName && (
              <>
                <span className="text-ink-faint mx-1.5">&mdash;</span>
                <span className="text-ink-primary text-base">{esc(courseName)}</span>
              </>
            )}
          </div>
          <span className="text-sm text-ink-faint shrink-0">
            {c.credits || 3} cr
          </span>
        </div>
      </div>

      {/* Bucket tags */}
      {bucketIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
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

      {/* Why recommendation */}
      {c.why && (
        <p
          className={`text-sm leading-relaxed mb-2 ${
            c.why.startsWith("This course advances your")
              ? "text-gold-dark font-medium"
              : "text-ink-muted"
          }`}
        >
          {esc(c.why)}
        </p>
      )}

      {/* Prerequisites */}
      {prereqHtml && (
        <div
          className="text-sm text-ink-secondary mb-2"
          dangerouslySetInnerHTML={{ __html: prereqHtml }}
        />
      )}

      {/* Unlocks */}
      {c.unlocks && c.unlocks.length > 0 && (
        <p className="text-sm text-ink-faint mb-2">
          Unlocks: {c.unlocks.map(esc).join(", ")}
        </p>
      )}

      {/* Warnings */}
      {dedupedWarnings.length > 0 && (
        <div className="bg-bad-light rounded-lg px-3 py-2 text-sm text-bad">
          {dedupedWarnings.map((w) => `Warning: ${esc(w)}`).join(" \u00b7 ")}
        </div>
      )}

      {/* Notes */}
      {c.notes && (
        <p className="text-sm text-ink-faint mt-2 italic">
          {formatCourseNotes(c.notes)}
        </p>
      )}
    </motion.div>
  );
}
