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
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xs font-semibold text-ink-secondary">
          Semester {index + 1}
          {term && ` \u2014 ${term}`}
        </span>
        {semester.standing_label && (
          <span className="text-[10px] font-medium text-gold/80">
            {semester.standing_label}
          </span>
        )}
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
      ) : (() => {
        const pp = semester.projected_progress;
        const projectedGrad =
          !!pp &&
          Object.values(pp)
            .filter((b) => (b.needed ?? 0) > 0)
            .every((b) => b.satisfied);
        return projectedGrad ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span>🎓</span>
            <span className="text-gold font-medium">Graduated</span>
          </div>
        ) : (
          <p className="text-xs text-ink-faint italic">
            No eligible courses for this semester.
          </p>
        );
      })()}
    </div>
  );
}
