import type { Course } from "./types";

type LabelStore = Map<string, string> | Record<string, string> | null;

function mapLookup(store: LabelStore, key: string): string | null {
  if (!store || !key) return null;
  if (store instanceof Map) return store.get(key) || null;
  if (Object.prototype.hasOwnProperty.call(store, key))
    return (store as Record<string, string>)[key];
  return null;
}

export function prettifyIdentifier(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upperTokens = new Set([
    "ACCO", "AIM", "BCC", "BUAN", "BUS", "CB", "FIN", "FINA", "FP",
    "INSY", "IS", "OSCM", "REQ", "GPA", "MCC", "ESSV1", "ESSV2", "ESSV3", "CULM",
  ]);
  return raw
    .replace(/[-\s]+/g, "_")
    .split("_")
    .filter(Boolean)
    .map((part) => {
      const up = part.toUpperCase();
      if (upperTokens.has(up)) return up;
      if (/^[A-Z0-9]{2,5}$/.test(part)) return up;
      const lower = part.toLowerCase();
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

export function esc(str: string | null | undefined): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function courseDisplayName(
  courseCode: string,
  courseNameByCode: LabelStore = null,
): string {
  const normalized = String(courseCode || "").trim();
  if (!normalized) return "";
  return mapLookup(courseNameByCode, normalized) || normalized;
}

export function replaceCourseCodesInText(
  text: string | null | undefined,
  _courseNameByCode: LabelStore = null,
): string {
  return String(text || "");
}

export function bucketLabel(
  bucketId: string,
  programLabelMap: LabelStore = null,
): string {
  const raw = String(bucketId || "").trim();
  if (!raw) return "";

  let programId: string | null = null;
  let localId = raw;
  if (raw.includes("::")) {
    [programId, localId] = raw.split("::", 2);
  }

  const labels: Record<string, string> = {
    CORE: "Finance Required",
    FIN_CHOOSE_2: "Upper Division Finance Elective (Two)",
    FIN_CHOOSE_1: "Upper Division Finance Elective (One)",
    BUS_ELEC_4: "Business Electives",
    BUAN_BUS_ELEC_5: "Business Electives",
    INSY_BUS_ELEC_4: "Business Electives",
    AIM_NO_CONC_CORE: "AIM Core",
    AIM_NO_CONC_ELECTIVE_1: "AIM Elective",
    MCC_ESSV1: "MCC ESSV1",
    MCC_ESSV2: "MCC ESSV2",
    MCC_ESSV3: "MCC ESSV3",
    MCC_CULM: "MCC Culminating Experience",
    MCC_Foundation: "MCC Foundation",
  };

  const businessElectivePattern = /^[A-Z]+_BUS_ELEC_\d+$/;
  const localLabel =
    labels[localId] ||
    (businessElectivePattern.test(localId)
      ? "Business Electives"
      : prettifyIdentifier(localId));

  if (!programId) return localLabel;
  const programLabel = mapLookup(programLabelMap, programId);
  if (!programLabel) return localLabel;
  return `${programLabel}: ${localLabel}`;
}

export function colorizePrereq(
  str: string | null | undefined,
  _courseNameByCode: LabelStore = null,
): string {
  if (!str) return "";
  const check = "\u2713";
  const cross = "\u2717";
  return String(str)
    .replace(
      /([A-Z]{2,6} \d{4}[A-Za-z]?) \(in progress\) \u2713/g,
      (_, code: string) =>
        `<span class="text-amber-600 font-medium">${esc(code)} (in progress) ${check}</span>`,
    )
    .replace(
      /([A-Z]{2,6} \d{4}[A-Za-z]?) \u2713/g,
      (_, code: string) =>
        `<span class="text-green-600 font-medium">${esc(code)} ${check}</span>`,
    )
    .replace(
      /([A-Z]{2,6} \d{4}[A-Za-z]?) \u2717/g,
      (_, code: string) =>
        `<span class="text-red-500 font-medium">${esc(code)} ${cross}</span>`,
    );
}

export function formatCourseNotes(
  note: string | null | undefined,
  _courseNameByCode: LabelStore = null,
): string {
  const txt = String(note || "");
  if (
    txt.toLowerCase().includes("todo") &&
    txt.toLowerCase().includes("complex prereq")
  ) {
    const codes = txt.match(/[A-Z]{2,6}\s\d{4}[A-Za-z]?/g) || [];
    if (codes.length) return `Hard prereq codes: ${codes.join(", ")}`;
    return "Hard prereq codes: see catalog.";
  }
  return esc(txt);
}

export function filterCourses(
  query: string,
  excludeSet: Set<string>,
  courses: Course[],
): Course[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return courses
    .filter(
      (c) =>
        !excludeSet.has(c.course_code) &&
        c.course_code.toLowerCase().includes(q),
    )
    .sort((a, b) => {
      const aLevel = Number(a?.level);
      const bLevel = Number(b?.level);
      const aRank = Number.isFinite(aLevel) ? aLevel : Number.POSITIVE_INFINITY;
      const bRank = Number.isFinite(bLevel) ? bLevel : Number.POSITIVE_INFINITY;
      if (aRank !== bRank) return aRank - bRank;
      return String(a?.course_code || "").localeCompare(
        String(b?.course_code || ""),
      );
    })
    .slice(0, 12);
}
