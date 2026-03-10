import type { Course, StudentStage } from "./types";

export const STUDENT_STAGE_OPTIONS: { value: StudentStage; label: string; helper: string }[] = [
  { value: "undergrad", label: "Undergrad", helper: "Only 1000-4000 level courses." },
  { value: "graduate", label: "Graduate", helper: "Only 5000-7999 level courses." },
  { value: "doctoral", label: "Doctoral", helper: "Only 8000+ level courses." },
];

const STAGE_RANK: Record<StudentStage, number> = {
  undergrad: 0,
  graduate: 1,
  doctoral: 2,
};

const COURSE_NUMBER_RE = /\b(\d{4})\b/;

export function normalizeStudentStage(rawValue: unknown): StudentStage | null {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "undergrad" || value === "graduate" || value === "doctoral") {
    return value;
  }
  return null;
}

export function studentStageLabel(stage: StudentStage): string {
  if (stage === "graduate") return "Graduate";
  if (stage === "doctoral") return "Doctoral";
  return "Undergraduate";
}

export function studentStageLevelLabel(stage: StudentStage): string {
  if (stage === "graduate") return "5000-7999";
  if (stage === "doctoral") return "8000+";
  return "1000-4000";
}

export function coerceCourseLevel(rawLevel: unknown, courseCode = ""): number | null {
  const numericLevel = Number(rawLevel);
  if (Number.isFinite(numericLevel) && numericLevel > 0) {
    return Math.trunc(numericLevel);
  }

  const match = COURSE_NUMBER_RE.exec(String(courseCode || "").toUpperCase());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCourseLevelMap(courses: Course[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  courses.forEach((course) => {
    const code = String(course.course_code || "").trim().toUpperCase();
    if (!code || map.has(code)) return;
    map.set(code, coerceCourseLevel(course.level, code));
  });
  return map;
}

export function inferStudentStageFromCourseCodes(
  courseCodes: Iterable<string>,
  courses: Course[] = [],
): StudentStage {
  const levelMap = buildCourseLevelMap(courses);
  let highestLevel = 0;
  Array.from(courseCodes).forEach((rawCode) => {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) return;
    const level = coerceCourseLevel(levelMap.get(code), code);
    if (level && level > highestLevel) highestLevel = level;
  });
  if (highestLevel >= 8000) return "doctoral";
  if (highestLevel >= 5000) return "graduate";
  return "undergrad";
}

export function resolveStudentStageSelection(options: {
  storedStage?: unknown;
  storedStageIsExplicit?: boolean;
  completed: Iterable<string>;
  inProgress: Iterable<string>;
  courses?: Course[];
}): { studentStage: StudentStage; studentStageIsExplicit: boolean } {
  const normalizedStoredStage = normalizeStudentStage(options.storedStage);
  const explicit =
    typeof options.storedStageIsExplicit === "boolean"
      ? options.storedStageIsExplicit
      : normalizedStoredStage !== null;

  if (normalizedStoredStage && explicit) {
    return { studentStage: normalizedStoredStage, studentStageIsExplicit: true };
  }

  return {
    studentStage: inferStudentStageFromCourseCodes(
      [...Array.from(options.completed), ...Array.from(options.inProgress)],
      options.courses ?? [],
    ),
    studentStageIsExplicit: false,
  };
}

export function syncStudentStageWithHistory(options: {
  studentStage: StudentStage;
  studentStageIsExplicit: boolean;
  completed: Iterable<string>;
  inProgress: Iterable<string>;
  courses?: Course[];
}): { studentStage: StudentStage; studentStageIsExplicit: boolean } {
  if (options.studentStageIsExplicit) {
    return {
      studentStage: options.studentStage,
      studentStageIsExplicit: true,
    };
  }

  return {
    studentStage: inferStudentStageFromCourseCodes(
      [...Array.from(options.completed), ...Array.from(options.inProgress)],
      options.courses ?? [],
    ),
    studentStageIsExplicit: false,
  };
}

export function getStudentStageHistoryConflict(options: {
  studentStage: StudentStage;
  completed: Iterable<string>;
  inProgress: Iterable<string>;
  courses?: Course[];
}): StudentStage | null {
  const inferredStage = inferStudentStageFromCourseCodes(
    [...Array.from(options.completed), ...Array.from(options.inProgress)],
    options.courses ?? [],
  );
  return STAGE_RANK[inferredStage] > STAGE_RANK[options.studentStage] ? inferredStage : null;
}
