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

interface ParsedBucketId {
  raw: string;
  programId: string | null;
  localId: string;
}

function parseBucketId(bucketId: string): ParsedBucketId {
  const raw = String(bucketId || "").trim();
  if (!raw) {
    return { raw: "", programId: null, localId: "" };
  }
  if (!raw.includes("::")) {
    return { raw, programId: null, localId: raw };
  }
  const [programId, localId] = raw.split("::", 2);
  return {
    raw,
    programId: String(programId || "").trim() || null,
    localId: String(localId || "").trim(),
  };
}

function lookupDetailedBucketLabel(
  parsed: ParsedBucketId,
  bucketLabelMap: Map<string, string>,
): string {
  return bucketLabelMap.get(parsed.raw) || bucketLabelMap.get(parsed.localId) || "";
}

function stripProgramPrefix(
  label: string,
  parsed: ParsedBucketId,
  programLabelMap: Map<string, string>,
): string {
  const trimmed = String(label || "").trim();
  if (!trimmed) return "";
  if (!parsed.programId) return trimmed;
  const programLabel = String(programLabelMap.get(parsed.programId) || "").trim();
  if (!programLabel) return trimmed;
  const prefix = `${programLabel}: `;
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length).trim() : trimmed;
}

function extractChildLabelForMatching(
  detailedLabel: string,
  parsed: ParsedBucketId,
  programLabelMap: Map<string, string>,
): string {
  const withoutProgramPrefix = stripProgramPrefix(detailedLabel, parsed, programLabelMap);
  if (!withoutProgramPrefix) return "";
  const segments = withoutProgramPrefix.split(": ").map((segment) => segment.trim()).filter(Boolean);
  return segments[segments.length - 1] || withoutProgramPrefix;
}

function bucketOwnerCode(programId: string | null): string {
  return String(programId || "")
    .trim()
    .replace(/_(?:MAJOR|TRACK|MINOR)$/i, "");
}

function formatDiscoveryKind(kind: string): string {
  const normalized = String(kind || "").trim().toUpperCase();
  switch (normalized) {
    case "HUM":
      return "Humanities";
    case "NSM":
      return "Natural Science & Mathematics";
    case "SSC":
      return "Social Science";
    case "ELEC":
      return "Elective";
    default:
      return normalized;
  }
}

function formatExportBucketLabel(
  bucketId: string,
  programLabelMap: Map<string, string>,
  bucketLabelMap: Map<string, string>,
): string {
  const parsed = parseBucketId(bucketId);
  if (!parsed.localId) return "";

  const detailedLabel = lookupDetailedBucketLabel(parsed, bucketLabelMap);
  const childLabel = extractChildLabelForMatching(detailedLabel, parsed, programLabelMap);
  const shortFallback = bucketLabel(parsed.raw, programLabelMap, bucketLabelMap, true);

  if (/Business Electives/i.test(detailedLabel) || /Business Electives/i.test(childLabel)) {
    return "Business Electives";
  }

  if (parsed.localId === "BCC_REQUIRED") {
    return "Business Core Required";
  }

  if (/^BCC_/i.test(parsed.localId)) {
    const bccType = childLabel
      .replace(/^BCC\s+/i, "")
      .trim();
    return bccType ? `Business Core - ${bccType}` : "Business Core";
  }

  if (parsed.localId === "MCC_CORE") {
    return "Marquette Core";
  }

  const discoveryMatch = /^MCC_DISC_([A-Z0-9]+)_([A-Z]+)$/i.exec(parsed.localId);
  if (discoveryMatch) {
    const theme = String(discoveryMatch[1] || "").trim().toUpperCase();
    const kind = formatDiscoveryKind(discoveryMatch[2]);
    return `Marquette Core - Discovery ${theme} ${kind}`.trim();
  }

  const typedMccMap: Record<string, string> = {
    MCC_ESSV1: "ESSV1",
    MCC_ESSV2: "ESSV2",
    MCC_ESSV3: "ESSV3",
    MCC_WRIT: "WRIT",
    MCC_CULM: "CULM",
  };
  if (typedMccMap[parsed.localId]) {
    return `Marquette Core - ${typedMccMap[parsed.localId]}`;
  }

  if (parsed.programId) {
    const chooseMatch = /\bChoose\s+(\d+)\b/i.exec(childLabel);
    const ownerCode = bucketOwnerCode(parsed.programId);
    if (chooseMatch && ownerCode) {
      const count = Number.parseInt(chooseMatch[1], 10);
      if (Number.isFinite(count) && count > 0) {
        const courseLabel = count === 1 ? "course" : "courses";
        return `${ownerCode} - Electives (${count} ${courseLabel})`;
      }
    }
  }

  return shortFallback;
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
        .map((bucketId) => formatExportBucketLabel(bucketId, programLabelMap, bucketLabelMap))
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
