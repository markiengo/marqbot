import type { SemesterData } from "@/lib/types";
import { formatCourseNameLabel } from "@/lib/rendering";

interface SemesterPreviewProps {
  semester: SemesterData;
  index: number;
}

export function SemesterPreview({ semester, index }: SemesterPreviewProps) {
  const rows = semester.recommendations || [];
  const term = semester.target_semester || "";

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-ink-secondary">
        Semester {index + 1}
        {term && ` \u2014 ${term}`}
      </div>
      {rows.length > 0 ? (
        <div className="space-y-1">
          {rows.map((course) => (
            <div
              key={course.course_code}
              className="flex items-center gap-2 text-xs"
            >
              <span className="font-medium text-[#7ab3ff]">
                {course.course_code}
              </span>
              <span className="text-ink-faint truncate">
                {formatCourseNameLabel(course.course_name || "")}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-faint italic">
          No eligible courses for this semester.
        </p>
      )}
    </div>
  );
}
