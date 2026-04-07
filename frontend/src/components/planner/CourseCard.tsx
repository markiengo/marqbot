"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import type { RecommendedCourse } from "@/lib/types";
import { Tag } from "@/components/shared/Tag";
import { colorizePrereq, esc, recommendationBucketLabel } from "@/lib/utils";
import {
  buildRecommendationWarnings,
  formatCourseNameLabel,
  sanitizeRecommendationWhy,
  sortBucketsByTier,
} from "@/lib/rendering";
import { useReducedEffects } from "@/hooks/useReducedEffects";
import { useTilt } from "@/hooks/useTilt";

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
  const reduceEffects = useReducedEffects();
  const { containerRef, rotateX, rotateY, onMouseMove: onTiltMouseMove, onMouseLeave: resetTilt } =
    useTilt({ maxDeg: variant === "compact" ? 4 : 5 });
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
  const baseGlow = variant === "compact" ? 0.42 : 0.5;
  const activeGlow = variant === "compact" ? 0.78 : 0.9;
  const glowLevel = useMotionValue(baseGlow);
  const glowOpacity = useSpring(glowLevel, { stiffness: 220, damping: 24 });
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

  const handleMouseEnter = () => {
    if (reduceEffects) return;
    glowLevel.set(activeGlow);
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (reduceEffects) return;
    onTiltMouseMove(event);
    glowLevel.set(activeGlow);
  };

  const handleMouseLeave = () => {
    if (reduceEffects) return;
    resetTilt();
    glowLevel.set(baseGlow);
  };

  if (variant === "compact") {
    return (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={reduceEffects ? undefined : { y: -3, scale: 1.01 }}
        onClick={onClick}
        onMouseEnter={reduceEffects ? undefined : handleMouseEnter}
        onMouseMove={reduceEffects ? undefined : handleMouseMove}
        onMouseLeave={reduceEffects ? undefined : handleMouseLeave}
        style={
          reduceEffects
            ? undefined
            : {
                rotateX,
                rotateY,
                transformPerspective: 900,
                willChange: "auto",
              }
        }
        className={`group relative h-full${onClick ? " cursor-pointer" : ""}`}
        {...interactiveProps}
      >
        <div
          className={`glass-card rounded-2xl px-4 py-4 accent-left-gold relative overflow-hidden h-full flex flex-col gap-3 ${
            reduceEffects ? "" : "card-glow-hover course-card-accent"
          }`}
        >
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              opacity: reduceEffects ? baseGlow : glowOpacity,
              background:
                "radial-gradient(ellipse 75% 55% at 88% 10%, rgba(255, 204, 0, 0.08), transparent)",
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
              {c.is_manual_add && (
                <Tag variant="gold">Manual add</Tag>
              )}
              {compactBucketIds.map((bid, idx) => {
                const isBcc = bid.includes("BCC_REQUIRED");
                const variantKey = isBcc
                  ? "bcc"
                  : idx === 0
                    ? "bucket"
                    : "secondary";
                return (
                  <Tag key={bid} variant={variantKey}>
                    {recommendationBucketLabel(c, bid, programLabelMap, bucketLabelMap, true)}
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
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceEffects ? undefined : { y: -6, scale: 1.012 }}
      onClick={onClick}
      onMouseEnter={reduceEffects ? undefined : handleMouseEnter}
      onMouseMove={reduceEffects ? undefined : handleMouseMove}
      onMouseLeave={reduceEffects ? undefined : handleMouseLeave}
      style={
        reduceEffects
          ? undefined
          : {
              rotateX,
              rotateY,
              transformPerspective: 900,
              willChange: "transform",
            }
      }
      className={`group relative${onClick ? " cursor-pointer" : ""}`}
      {...interactiveProps}
    >
      <div
        className={`glass-card rounded-2xl p-6 accent-left-gold relative overflow-hidden ${
          reduceEffects ? "" : "card-glow-hover course-card-accent"
        }`}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            opacity: reduceEffects ? baseGlow : glowOpacity,
            background:
              "radial-gradient(ellipse 70% 50% at 85% 10%, rgba(255, 204, 0, 0.08), transparent)",
          }}
        />

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
            <div className="shrink-0 w-11 h-11 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
              <span className="text-base font-bold text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {c.credits || 3}
              </span>
            </div>
          </div>
        </div>

        {bucketIds.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mb-5">
            {c.is_manual_add && (
              <Tag variant="gold">Manual add</Tag>
            )}
            {sortedBucketIds.map((bid, idx) => {
              const isBcc = bid.includes("BCC_REQUIRED");
              const tagVariant = isBcc
                ? "bcc"
                : idx === 0
                  ? "bucket"
                  : idx === 1
                    ? "secondary"
                    : "gold";
              return (
                <Tag key={bid} variant={tagVariant}>
                  {recommendationBucketLabel(c, bid, programLabelMap, bucketLabelMap, true)}
                </Tag>
              );
            })}
          </div>
        )}

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

        {prereqHtml && (
          <div
            className="text-[1.05rem] text-ink-secondary mb-3"
            dangerouslySetInnerHTML={{ __html: prereqHtml }}
          />
        )}

        {dedupedWarnings.length > 0 && (
          <div className="bg-bad-light rounded-lg px-4 py-3 text-[1.05rem] text-bad">
            Warning: {dedupedWarnings.map((w) => esc(w)).join("; ")}
          </div>
        )}
      </div>
    </motion.div>
  );
}
