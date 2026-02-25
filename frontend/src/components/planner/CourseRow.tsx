"use client";

import { motion } from "motion/react";
import type { RecommendedCourse } from "@/lib/types";
import { formatCourseNameLabel } from "@/lib/rendering";
import { esc } from "@/lib/utils";

interface CourseRowProps {
  course: RecommendedCourse;
  courseCount: number;
}

export function CourseRow({ course, courseCount }: CourseRowProps) {
  const c = course;
  const courseName = formatCourseNameLabel(c.course_name || "");
  const count = Math.max(1, Math.min(6, courseCount));

  const density = (() => {
    if (count >= 6) {
      return {
        row: "min-h-[34px] px-2 py-1",
        code: "text-[13px] leading-[1.2]",
        name: "text-[13px] leading-[1.2]",
      };
    }
    if (count === 5) {
      return {
        row: "min-h-[40px] px-2.5 py-1.5",
        code: "text-[14px] leading-[1.22]",
        name: "text-[13px] leading-[1.22]",
      };
    }
    if (count === 4) {
      return {
        row: "min-h-[48px] px-2.5 py-1.5",
        code: "text-[15px] leading-[1.24]",
        name: "text-[14px] leading-[1.25]",
      };
    }
    if (count === 3) {
      return {
        row: "min-h-[58px] px-3 py-2",
        code: "text-[16px] leading-[1.25]",
        name: "text-[14px] leading-[1.28]",
      };
    }
    return {
      row: "min-h-[92px] px-3 py-3",
      code: "text-[17px] leading-[1.25]",
      name: "text-[15px] leading-[1.3]",
    };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      className={`flex-1 ${density.row} rounded-lg border border-border-subtle/60 bg-[#0e2a52]/45 overflow-hidden flex items-center`}
    >
      <div className="min-w-0 flex items-center gap-2">
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
    </motion.div>
  );
}
