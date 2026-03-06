"use client";

import { Modal } from "./Modal";
import { Tag } from "./Tag";
import { bucketLabel, esc } from "@/lib/utils";

interface CourseDetailModalProps {
  open: boolean;
  onClose: () => void;
  courseCode: string;
  courseName?: string;
  credits?: number;
  description?: string | null;
  buckets?: string[];
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
  buckets,
  programLabelMap,
  bucketLabelMap,
}: CourseDetailModalProps) {
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
            {buckets.map((bid, idx) => {
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
                  {bucketLabel(bid, programLabelMap, bucketLabelMap)}
                </Tag>
              );
            })}
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
            No description available for this course.
          </p>
        )}
      </div>
    </Modal>
  );
}
