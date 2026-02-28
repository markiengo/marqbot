import type { BucketProgress, Course, CreditKpiMetrics, SelectionContext } from "./types";
import { bucketLabel } from "./utils";

export const MIN_GRAD_CREDITS = 124;

export function getProgramLabelMap(
  selectionContext: SelectionContext | null | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!selectionContext) return map;
  const ids = Array.isArray(selectionContext.selected_program_ids)
    ? selectionContext.selected_program_ids
    : [];
  const labels = Array.isArray(selectionContext.selected_program_labels)
    ? selectionContext.selected_program_labels
    : [];
  ids.forEach((id, idx) => {
    const key = String(id || "").trim();
    const label = String(labels[idx] || "").trim();
    if (key && label) map.set(key, label);
  });
  return map;
}

export function formatCourseNameLabel(name: string | null | undefined): string {
  const raw = String(name || "").trim();
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => {
          const trimmed = String(part || "");
          if (!trimmed) return trimmed;
          if (/^[A-Z0-9&]+$/.test(trimmed) && trimmed.length >= 2)
            return trimmed;
          const lower = trimmed.toLowerCase();
          return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
        })
        .join("-"),
    )
    .join(" ");
}

function minStandingWarning(minStanding: number | null | undefined): string {
  const n = Number(minStanding);
  if (!Number.isFinite(n) || n <= 1) return "";
  switch (n) {
    case 2:
      return "sophomore standing required";
    case 3:
      return "junior standing required";
    case 4:
    case 5:
      return "senior standing required";
    default:
      return "";
  }
}

export function humanizeSoftWarningTag(
  tag: string,
  course?: { min_standing?: number } | null,
): string {
  const key = String(tag || "").trim().toLowerCase();
  if (!key) return "";
  if (key === "standing_requirement")
    return minStandingWarning(course?.min_standing);
  const mapped: Record<string, string> = {
    major_restriction: "major restriction",
    admitted_program: "admitted program required",
    instructor_consent: "instructor consent required",
    placement_required: "placement requirement",
    minimum_grade: "minimum grade requirement",
    minimum_gpa: "minimum GPA requirement",
    not_frequently_offered:
      "not offered every semester; confirm availability",
  };
  if (mapped[key]) return mapped[key];
  return key.replace(/_/g, " ");
}

export function normalizeWarningTextMessages(warningText: string): string[] {
  const raw = String(warningText || "").trim();
  if (!raw) return [];
  return raw
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function localBucketId(bucketId: string): string {
  const raw = String(bucketId || "").trim();
  if (!raw) return "";
  if (raw.includes("::")) return raw.split("::", 2)[1];
  return raw;
}

export function sortProgressEntries(
  progressObj: Record<string, BucketProgress> | null | undefined,
): [string, BucketProgress][] {
  const entries = Object.entries(progressObj || {}) as [string, BucketProgress][];
  const indexed = entries.map((entry, idx) => ({ entry, idx }));
  indexed.sort((a, b) => {
    const aLocal = localBucketId(a.entry[0]);
    const bLocal = localBucketId(b.entry[0]);
    const aRank = aLocal === "BCC_REQUIRED" ? 0 : 1;
    const bRank = bLocal === "BCC_REQUIRED" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.idx - b.idx;
  });
  return indexed.map((x) => x.entry);
}

// ── Bucket grouping ───────────────────────────────────────────────────────────

/** Parent bucket IDs that are data-model-only; never shown in any progress view. */
const HIDDEN_PARENT_IDS = new Set(["MCC_ESSV2", "MCC_WRIT"]);

const PARENT_LABEL_FALLBACKS: Record<string, string> = {
  BCC: "Business Core (BCC)",
  MCC_FOUNDATION: "MCC Foundation",
  MCC_CULM: "MCC Culminating",
  MCC_DISC: "MCC Discovery",
  MCC_DISC_CMI: "Discovery: Cognition, Memory & Intelligence",
  MCC_DISC_BNJ: "Discovery: Basic Needs and Justice",
  MCC_DISC_CB: "Discovery: Crossing Boundaries",
  MCC_DISC_EOH: "Discovery: Expanding Our Horizons",
  MCC_DISC_IC: "Discovery: Individuals and Communities",
};

export interface ProgressGroup {
  parentId: string;
  label: string;
  entries: [string, BucketProgress][];
}

/**
 * Groups progress entries by parent bucket ID, filtering hidden buckets.
 * Preserves the sort order from sortProgressEntries() within each group.
 */
export function groupProgressByParent(
  progressObj: Record<string, BucketProgress> | null | undefined,
  programLabelMap?: Map<string, string>,
): ProgressGroup[] {
  const sorted = sortProgressEntries(progressObj);
  const groups = new Map<string, ProgressGroup>();
  const order: string[] = [];

  for (const [bid, prog] of sorted) {
    const parentId = bid.includes("::") ? bid.split("::", 2)[0] : bid;
    if (HIDDEN_PARENT_IDS.has(parentId)) continue;
    if (!groups.has(parentId)) {
      const label =
        programLabelMap?.get(parentId) ??
        PARENT_LABEL_FALLBACKS[parentId] ??
        parentId.replace(/_/g, " ");
      groups.set(parentId, { parentId, label, entries: [] });
      order.push(parentId);
    }
    groups.get(parentId)!.entries.push([bid, prog]);
  }

  return order.map((id) => groups.get(id)!);
}

export function compactKpiBucketLabel(label: string): string {
  const raw = String(label || "");
  if (!raw) return "";
  return raw
    .replace(/AIM No Concentration Core/gi, "AIM Core")
    .replace(/AIM No Concentration Elective\s*\(1\)/gi, "AIM Elective")
    .replace(/\s*\(No Concentration\)/gi, "")
    .replace(/\bNo Conc(?:entration)?\b/gi, "")
    .replace(/Information Systems Major/gi, "IS Major")
    .replace(/Business Analytics Major/gi, "BUAN Major")
    .replace(/Operations and Supply Chain Major/gi, "OSCM Major")
    .replace(/Accounting Major/gi, "ACCO Major")
    .replace(/Finance Major/gi, "FINA Major")
    .replace(/Operations and Supply Chain/gi, "OSCM")
    .replace(/Information Systems/gi, "IS")
    .replace(/Business Analytics/gi, "BUAN")
    .replace(/Accounting/gi, "ACCO")
    .replace(/Finance/gi, "FINA")
    .replace(/Supply Chain/gi, "OSCM")
    .replace(/\bOscm\b/g, "OSCM")
    .replace(/\bBuan\b/g, "BUAN")
    .replace(/\bInsy\b/g, "INSY")
    .replace(/\bFina\b/g, "FINA")
    .replace(/\bAcco\b/g, "ACCO")
    .replace(/\bAim\b/g, "AIM")
    .replace(/\bReq\b/g, "REQ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getBucketDisplay(prog: BucketProgress): {
  done: number;
  inProg: number;
  needed: number;
  unit: "cr" | "courses";
} {
  if (prog.requirement_mode === "credits_pool") {
    return {
      done: prog.completed_done ?? prog.done_count ?? 0,
      inProg: prog.in_progress_increment ?? 0,
      needed: prog.needed ?? 0,
      unit: "cr",
    };
  }
  return {
    done: prog.completed_courses ?? 0,
    inProg: prog.in_progress_courses ?? 0,
    needed: prog.needed_count ?? prog.needed ?? 0,
    unit: "courses",
  };
}

export function buildCourseCreditMap(courses: Course[]): Map<string, number> {
  const map = new Map<string, number>();
  (Array.isArray(courses) ? courses : []).forEach((course) => {
    const code = String(course?.course_code || "").trim();
    const rawCredits = Number(course?.credits);
    if (!code) return;
    if (!Number.isFinite(rawCredits)) {
      map.set(code, 0);
      return;
    }
    map.set(code, Math.max(0, Math.round(rawCredits)));
  });
  return map;
}

export function sumCreditsForCourseCodes(
  courseCodes: Iterable<string> | null | undefined,
  creditMap: Map<string, number>,
): number {
  const map = creditMap instanceof Map ? creditMap : new Map<string, number>();
  const seen = new Set<string>();
  let total = 0;
  for (const rawCode of courseCodes || []) {
    const code = String(rawCode || "").trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    total += Number(map.get(code) || 0);
  }
  return Math.max(0, total);
}

export function deriveStandingFromCredits(earnedCredits: number): string {
  const credits = Math.max(0, Number(earnedCredits) || 0);
  if (credits >= 90) return "Senior Standing";
  if (credits >= 60) return "Junior Standing";
  if (credits >= 24) return "Sophomore Standing";
  return "Freshman Standing";
}

export function computeCreditKpiMetrics(
  completedCredits: number,
  inProgressCredits: number,
  minGradCredits: number = MIN_GRAD_CREDITS,
): CreditKpiMetrics {
  const gradTarget = Math.max(1, Number(minGradCredits) || MIN_GRAD_CREDITS);
  const completed = Math.max(0, Number(completedCredits) || 0);
  const inProgress = Math.max(0, Number(inProgressCredits) || 0);
  const remaining = Math.max(0, gradTarget - (completed + inProgress));
  const donePct = Math.max(0, Math.min(100, (completed / gradTarget) * 100));
  const inProgressPctRaw = Math.max(
    0,
    Math.min(100, (inProgress / gradTarget) * 100),
  );
  const inProgressPct = Math.max(0, Math.min(100 - donePct, inProgressPctRaw));
  const overallPct = Math.max(
    0,
    Math.min(100, ((completed + inProgress) / gradTarget) * 100),
  );
  return {
    minGradCredits: gradTarget,
    completedCredits: completed,
    inProgressCredits: inProgress,
    remainingCredits: remaining,
    standingLabel: deriveStandingFromCredits(completed),
    donePercent: donePct,
    inProgressPercent: inProgressPct,
    overallPercent: overallPct,
  };
}
