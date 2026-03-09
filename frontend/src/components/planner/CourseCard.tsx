"use client";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion } from "motion/react";
import type { RecommendedCourse } from "@/lib/types";
import { Tag } from "@/components/shared/Tag";
import { bucketLabel, colorizePrereq, esc } from "@/lib/utils";
import {
  buildRecommendationWarnings,
  formatCourseNameLabel,
  sanitizeRecommendationWhy,
  sortBucketsByTier,
} from "@/lib/rendering";

interface CourseCardProps {
  course: RecommendedCourse;
  onClick?: () => void;
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
  variant?: "default" | "compact";
}

function hasNoPrereqs(prereqCheck: string | null | undefined): boolean {
  const raw = String(prereqCheck || "").trim();
  if (!raw) return true;
  return /^no prereq/i.test(raw);
}

export function CourseCard({
  course,
  programLabelMap,
  bucketLabelMap,
  onClick,
  variant = "default",
}: CourseCardProps) {
  const c = course;
  const bucketIds = c.fills_buckets || [];
  const sortedBucketIds = sortBucketsByTier(bucketIds);
  const dedupedWarnings = buildRecommendationWarnings(c);
  const courseName = formatCourseNameLabel(c.course_name || "");
  const cleanedWhy = sanitizeRecommendationWhy(c.why);
  const prereqCheck = String(c.prereq_check || "").trim();
  const prereqHtml = colorizePrereq(prereqCheck);
  const compactBucketIds = sortedBucketIds.slice(0, 2);
  const extraBucketCount = Math.max(0, sortedBucketIds.length - compactBucketIds.length);
  const compactFacts = [
    hasNoPrereqs(prereqCheck) ? "No prereqs" : "Needs prereqs",
    ...(dedupedWarnings.length > 0 ? ["Heads up"] : []),
  ];
  const interactiveProps = onClick
    ? {
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        },
        "aria-label": `View details for ${c.course_code}`,
      }
    : {};

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
        onClick={onClick}
        className={`group glass-card card-glow-hover course-card-accent rounded-2xl px-4 py-4 accent-left-gold relative overflow-hidden h-full flex flex-col gap-3${onClick ? " cursor-pointer" : ""}`}
        style={{ willChange: "transform" }}
        {...interactiveProps}
      >
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-55"
          style={{
            background: "radial-gradient(ellipse 75% 55% at 88% 10%, rgba(255, 204, 0, 0.06), transparent)",
          }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-bold text-mu-blue text-[1.1rem] leading-none">
                {esc(c.course_code || "")}
              </span>
              {courseName && (
                <span className="text-[1.08rem] leading-snug text-ink-primary">
                  {esc(courseName)}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/15">
            <span className="text-sm font-bold text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {c.credits || 3}
            </span>
          </div>
        </div>

        {compactBucketIds.length > 0 && (
          <div className="relative flex flex-wrap gap-1.5">
            {compactBucketIds.map((bid, idx) => {
              const isBcc = bid.includes("BCC_REQUIRED");
              const variantKey = isBcc
                ? "bcc"
                : idx === 0
                  ? "bucket"
                  : "secondary";
              return (
                <Tag key={bid} variant={variantKey}>
                  {bucketLabel(bid, programLabelMap, bucketLabelMap, true)}
                </Tag>
              );
            })}
            {extraBucketCount > 0 && (
              <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-ink-faint">
                +{extraBucketCount} more
              </span>
            )}
          </div>
        )}

        <div className="relative mt-auto flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {compactFacts.map((fact) => (
              <span
                key={fact}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.72rem] font-medium uppercase tracking-[0.12em] text-ink-faint"
              >
                {fact}
              </span>
            ))}
          </div>
          {onClick && (
            <span className="text-[0.78rem] font-semibold text-gold/80 transition-colors group-hover:text-gold">
              View details
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
      onClick={onClick}
      className={`glass-card card-glow-hover course-card-accent rounded-2xl p-6 accent-left-gold relative overflow-hidden${onClick ? " cursor-pointer" : ""}`}
      style={{ willChange: "transform" }}
      {...interactiveProps}
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
          {sortedBucketIds.map((bid, idx) => {
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
      {cleanedWhy && (
        <p
          className={`text-[1.05rem] leading-relaxed mb-3 ${
            cleanedWhy.startsWith("This course")
              ? "text-gold-dark font-medium"
              : "text-ink-muted"
          }`}
        >
          {esc(cleanedWhy)}
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
