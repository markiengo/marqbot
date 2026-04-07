import { buildSavedPlanProgramLine } from "./savedPlanPresentation";
import { bucketLabel, formatCourseNotes } from "./utils";
import type {
  Course,
  ProgramsData,
  RecommendedCourse,
  SavedPlanRecord,
} from "./types";

export interface SavedPlanExportCourseItem {
  courseCode: string;
  courseName: string;
  credits: number | null;
  prereqText: string;
  semesterLabel: string | null;
  bucketLabels: string[];
}

export interface SavedPlanSemesterExport {
  targetSemester: string;
  standingLabel: string | null;
  courses: SavedPlanExportCourseItem[];
}

export interface SavedPlanExportData {
  planName: string;
  planNotes: string;
  targetSemester: string;
  updatedAt: string;
  programLine: string;
  semesters: SavedPlanSemesterExport[];
}

function makeCourseCatalogMap(courses: Course[]): Map<string, Course> {
  const map = new Map<string, Course>();
  for (const course of courses) {
    map.set(course.course_code, course);
  }
  return map;
}

function makeProgramLabelMap(programs: ProgramsData): Map<string, string> {
  const map = new Map<string, string>();
  programs.majors.forEach((item) => map.set(item.id, item.label));
  programs.tracks.forEach((item) => map.set(item.id, item.label));
  programs.minors.forEach((item) => map.set(item.id, item.label));
  return map;
}

function makeBucketLabelMap(programs: ProgramsData): Map<string, string> {
  const map = new Map<string, string>();
  Object.entries(programs.bucket_labels || {}).forEach(([bucketId, label]) => {
    const id = String(bucketId || "").trim();
    const txt = String(label || "").trim();
    if (id && txt) map.set(id, txt);
  });
  return map;
}

function normalizePrereqText(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^(none|no prereq(?:uisites?)?|no prerequisites?)$/i.test(raw)) return "None";
  if (/^no prereq/i.test(raw)) return "None";
  return formatCourseNotes(raw);
}

function buildPrereqText(
  catalogCourse: Course | undefined,
  recommendedCourse?: RecommendedCourse | null,
): string {
  return (
    normalizePrereqText(catalogCourse?.catalog_prereq_raw)
    ?? normalizePrereqText(recommendedCourse?.prereq_check)
    ?? "None"
  );
}

function buildCourseItem(
  courseCode: string,
  catalogMap: Map<string, Course>,
  programLabelMap: Map<string, string>,
  bucketLabelMap: Map<string, string>,
  semesterLabel: string | null = null,
  recommendedCourse?: RecommendedCourse | null,
): SavedPlanExportCourseItem {
  const normalizedCode = String(courseCode || "").trim();
  const catalogCourse = catalogMap.get(normalizedCode);
  const bucketLabels = Array.from(
    new Set(
      (recommendedCourse?.fills_buckets ?? [])
        .map((bucketId) => String(bucketId || "").trim())
        .filter(Boolean)
        .map((bucketId) => bucketLabel(bucketId, programLabelMap, bucketLabelMap, true))
        .filter(Boolean),
    ),
  );
  return {
    courseCode: normalizedCode,
    courseName:
      String(recommendedCourse?.course_name || catalogCourse?.course_name || normalizedCode).trim() || normalizedCode,
    credits:
      recommendedCourse?.credits
      ?? (typeof catalogCourse?.credits === "number" ? catalogCourse.credits : null),
    prereqText: buildPrereqText(catalogCourse, recommendedCourse),
    semesterLabel,
    bucketLabels,
  };
}

export function buildSavedPlanExportData(
  plan: SavedPlanRecord,
  courses: Course[],
  programs: ProgramsData,
): SavedPlanExportData | null {
  if (!plan.recommendationData) return null;

  const recommendationData = plan.recommendationData;
  const catalogMap = makeCourseCatalogMap(courses);
  const programLabelMap = makeProgramLabelMap(programs);
  const bucketLabelMap = makeBucketLabelMap(programs);
  const programOrder = [
    ...plan.inputs.declaredMajors,
    ...plan.inputs.declaredTracks,
    ...plan.inputs.declaredMinors,
  ];
  void programOrder;

  const rawSemesters: SavedPlanSemesterExport[] = (recommendationData.semesters ?? []).map((semester, index) => ({
    targetSemester: String(semester.target_semester || `Semester ${index + 1}`),
    standingLabel: semester.standing_label || null,
    courses: (semester.recommendations ?? []).map((course) =>
      buildCourseItem(
        course.course_code,
        catalogMap,
        programLabelMap,
        bucketLabelMap,
        String(semester.target_semester || `Semester ${index + 1}`),
        course,
      ),
    ),
  }));
  const lastNonEmptySemesterIndex = rawSemesters.reduce(
    (lastIndex, semester, index) => (semester.courses.length > 0 ? index : lastIndex),
    -1,
  );
  const semesters = lastNonEmptySemesterIndex >= 0
    ? rawSemesters.slice(0, lastNonEmptySemesterIndex + 1)
    : [];

  return {
    planName: plan.name,
    planNotes: plan.notes,
    targetSemester: plan.inputs.targetSemester,
    updatedAt: plan.updatedAt,
    programLine: buildSavedPlanProgramLine(plan, programs),
    semesters,
  };
}
