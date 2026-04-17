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
        row: "min-h-[63px] px-2.5 py-1",
        code: "text-[15px] leading-[1.2]",
        name: "text-[15px] leading-[1.2]",
      };
    }
    if (count === 5) {
      return {
        row: "min-h-[74px] px-2.5 py-1.5",
        code: "text-[16px] leading-[1.22]",
        name: "text-[15px] leading-[1.22]",
      };
    }
    if (count === 4) {
      return {
        row: "min-h-[87px] px-3 py-1.5",
        code: "text-[17px] leading-[1.24]",
        name: "text-[16px] leading-[1.25]",
      };
    }
    if (count === 3) {
      return {
        row: "min-h-[102px] px-3 py-2",
        code: "text-[18px] leading-[1.25]",
        name: "text-[16px] leading-[1.28]",
      };
    }
    return {
      row: "min-h-[141px] px-3 py-3",
      code: "text-[19px] leading-[1.25]",
      name: "text-[17px] leading-[1.28]",
    };
  })();

  return (
    <div
      onClick={onClick}
      className={`flex-none ${density.row} rounded-xl glass-card card-glow-hover overflow-hidden flex items-center border border-gold/10 border-l-2 border-l-gold/55 transition-[border-color,box-shadow,transform] duration-200 hover:border-gold/25 hover:shadow-[0_0_18px_rgba(255,204,0,0.12)]${onClick ? " cursor-pointer" : ""}`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-2.5">
        <span className={`shrink-0 font-bold text-gold ${density.code}`}>
          {esc(c.course_code || "")}
        </span>
        {courseName && (
          <span className={`min-w-0 truncate whitespace-nowrap text-ink-secondary ${density.name}`}>
            {esc(courseName)}
          </span>
        )}
        {!courseName && <span className="text-ink-faint text-[13px]">-</span>}
        {c.is_manual_add && (
          <span className="shrink-0 rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            Manual add
          </span>
        )}
      </div>
      <span className="shrink-0 text-xs font-bold text-gold tabular-nums mr-1" style={{ fontVariantNumeric: "tabular-nums" }}>
        {c.credits || 3}cr
      </span>
    </div>
  );
}
