"use client";

import { Modal } from "./Modal";
import { Tag } from "./Tag";
import { esc, recommendationBucketLabel } from "@/lib/utils";
import { sortBucketsByTier } from "@/lib/rendering";

interface CourseDetailModalProps {
  open: boolean;
  onClose: () => void;
  courseCode: string;
  courseName?: string;
  credits?: number;
  description?: string | null;
  prereqRaw?: string | null;
  buckets?: string[];
  bucketLabelOverrides?: Record<string, string>;
  plannerReason?: string | null;
  plannerNotes?: string | null;
  plannerWarnings?: string[];
  programLabelMap?: Map<string, string>;
  bucketLabelMap?: Map<string, string>;
}

export function CourseDetailModal({
  open,
  onClose,
  courseCode,
  courseName,
  credits,
  description,
  prereqRaw,
  buckets,
  bucketLabelOverrides,
  plannerReason,
  plannerNotes,
  plannerWarnings,
  programLabelMap,
  bucketLabelMap,
}: CourseDetailModalProps) {
  const warnings = open ? (plannerWarnings ?? []).filter(Boolean) : [];

  return (
    <Modal open={open} onClose={onClose} size="default">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[1.6rem] font-bold font-[family-name:var(--font-sora)] text-mu-blue leading-tight">
              {esc(courseCode)}
            </h3>
            {courseName && (
              <p className="text-[1.15rem] text-ink-primary mt-1">{esc(courseName)}</p>
            )}
          </div>
          {credits != null && (
            <div className="shrink-0 w-12 h-12 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
              <span className="text-lg font-bold text-gold" style={{ fontVariantNumeric: "tabular-nums" }}>
                {credits}
              </span>
            </div>
          )}
        </div>

        {/* Bucket tags */}
        {buckets && buckets.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {sortBucketsByTier(buckets).map((bid, idx) => {
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
                  {recommendationBucketLabel(
                    { bucket_label_overrides: bucketLabelOverrides },
                    bid,
                    programLabelMap,
                    bucketLabelMap,
                  )}
                </Tag>
              );
            })}
          </div>
        )}

        {(plannerReason || plannerNotes || warnings.length > 0) && (
          <div className="rounded-2xl border border-border-card bg-[linear-gradient(165deg,rgba(10,27,66,0.72),rgba(8,16,36,0.72))] px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="space-y-3">
              {plannerReason && (
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Why this showed up</p>
                  <p className="text-sm text-ink-secondary leading-relaxed">{esc(plannerReason)}</p>
                </div>
              )}
              {plannerNotes && (
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Planner note</p>
                  <p className="text-sm text-ink-secondary leading-relaxed">{esc(plannerNotes)}</p>
                </div>
              )}
              {warnings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Heads up</p>
                  <p className="text-sm text-bad leading-relaxed">{warnings.map((warning) => esc(warning)).join("; ")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prerequisites */}
        {prereqRaw && (
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wider mb-1">Prerequisites</p>
            <p className="text-sm text-ink-secondary leading-relaxed">{prereqRaw}</p>
          </div>
        )}

        <div className="divider-fade" />

        {/* Description */}
        {description ? (
          <p className="text-[1.05rem] text-ink-secondary leading-relaxed">
            {description}
          </p>
        ) : (
          <p className="text-[1.05rem] text-ink-faint italic">
            No description is loaded for this course yet.
          </p>
        )}
      </div>
    </Modal>
  );
}
