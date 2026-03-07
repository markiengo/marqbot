"use client";

import { motion } from "motion/react";
import type { RecommendedCourse } from "@/lib/types";
import { Tag } from "@/components/shared/Tag";
import { bucketLabel, colorizePrereq, esc } from "@/lib/utils";
import {
  formatCourseNameLabel,
  humanizeSoftWarningTag,
  normalizeWarningTextMessages,
  sortBucketsByTier,
} from "@/lib/rendering";

interface CourseCardProps {
  course: RecommendedCourse;
  onClick?: () => void;
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
}

export function CourseCard({ course, programLabelMap, bucketLabelMap, onClick }: CourseCardProps) {
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
      whileHover={{ y: -4, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
      onClick={onClick}
      className={`glass-card card-glow-hover course-card-accent rounded-2xl p-6 accent-left-gold relative overflow-hidden${onClick ? " cursor-pointer" : ""}`}
      style={{ willChange: "transform" }}
    >
      {/* Subtle radial glow overlay */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-60" style={{
        background: "radial-gradient(ellipse 70% 50% at 85% 10%, rgba(255, 204, 0, 0.06), transparent)"
      }} />

      {/* Header */}
      <div className="mb-4 relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-bold text-mu-blue text-[1.35rem]">
              {esc(c.course_code || "")}
            </span>
            {courseName && (
              <>
                <span className="text-ink-faint mx-1.5">&mdash;</span>
                <span className="text-ink-primary text-[1.35rem]">{esc(courseName)}</span>
              </>
            )}
          </div>
          <div className="shrink-0 w-11 h-11 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center pulse-gold-soft">
            <span className="text-base font-bold text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {c.credits || 3}
            </span>
          </div>
        </div>
      </div>

      {/* Bucket tags */}
      {bucketIds.length > 0 && (
        <div className="flex flex-wrap gap-2.5 mb-5">
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

      {/* Why recommendation */}
      {c.why && (
        <p
          className={`text-[1.05rem] leading-relaxed mb-3 ${
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
          className="text-[1.05rem] text-ink-secondary mb-3"
          dangerouslySetInnerHTML={{ __html: prereqHtml }}
        />
      )}

      {/* Warnings */}
      {dedupedWarnings.length > 0 && (
        <div className="bg-bad-light rounded-lg px-4 py-3 text-[1.05rem] text-bad">
          Warning: {dedupedWarnings.map((w) => esc(w)).join("; ")}
        </div>
      )}

    </motion.div>
  );
}
