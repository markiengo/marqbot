"use client";

import type { RecommendedCourse } from "@/lib/types";
import { formatCourseNameLabel } from "@/lib/rendering";
import { esc } from "@/lib/utils";

interface CourseRowProps {
  course: RecommendedCourse;
  courseCount: number;
  index?: number;
  onClick?: () => void;
}

export function CourseRow({ course, courseCount, onClick }: CourseRowProps) {
  const c = course;
  const courseName = formatCourseNameLabel(c.course_name || "");
  const count = Math.max(1, Math.min(6, courseCount));

  const density = (() => {
    if (count >= 6) {
      return {
        row: "min-h-[34px] px-2 py-1",
        code: "text-[16px] leading-[1.2]",
        name: "text-[16px] leading-[1.2]",
      };
    }
    if (count === 5) {
      return {
        row: "min-h-[40px] px-2.5 py-1.5",
        code: "text-[17px] leading-[1.22]",
        name: "text-[16px] leading-[1.22]",
      };
    }
    if (count === 4) {
      return {
        row: "min-h-[48px] px-2.5 py-1.5",
        code: "text-[18px] leading-[1.24]",
        name: "text-[17px] leading-[1.25]",
      };
    }
    if (count === 3) {
      return {
        row: "min-h-[58px] px-3 py-2",
        code: "text-[19px] leading-[1.25]",
        name: "text-[17px] leading-[1.28]",
      };
    }
    return {
      row: "min-h-[92px] px-3 py-3",
      code: "text-[20px] leading-[1.25]",
      name: "text-[18px] leading-[1.3]",
    };
  })();

  return (
    <div
      onClick={onClick}
      className={`flex-none lg:flex-1 ${density.row} rounded-lg glass-card card-glow-hover overflow-hidden flex items-center border-l-2 border-l-gold/50${onClick ? " cursor-pointer" : ""}`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-1.5 sm:gap-2">
        <span className={`shrink-0 font-semibold text-ink-primary ${density.code}`}>
          {esc(c.course_code || "")}
        </span>
        {courseName && (
          <span className={`min-w-0 truncate whitespace-nowrap text-ink-secondary ${density.name}`}>
            {esc(courseName)}
          </span>
        )}
        {!courseName && <span className="text-ink-faint text-[13px]">-</span>}
      </div>
      <span className="shrink-0 text-xs font-bold text-gold tabular-nums mr-1" style={{ fontVariantNumeric: "tabular-nums" }}>
        {c.credits || 3}cr
      </span>
    </div>
  );
}
