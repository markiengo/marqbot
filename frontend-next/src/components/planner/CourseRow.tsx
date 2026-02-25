"use client";

import { motion } from "motion/react";
import type { RecommendedCourse } from "@/lib/types";
import { formatCourseNameLabel } from "@/lib/rendering";
import { esc } from "@/lib/utils";

interface CourseRowProps {
  course: RecommendedCourse;
}

export function CourseRow({ course }: CourseRowProps) {
  const c = course;
  const courseName = formatCourseNameLabel(c.course_name || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14 }}
      className="px-3 py-2 rounded-xl border border-border-subtle/60 bg-[#0e2a52]/45"
    >
      <div className="font-semibold text-ink-primary text-2xl leading-tight">
        {esc(c.course_code || "")}
      </div>
      {courseName && (
        <div className="text-ink-secondary text-lg leading-snug mt-0.5">
          {esc(courseName)}
        </div>
      )}
    </motion.div>
  );
}
