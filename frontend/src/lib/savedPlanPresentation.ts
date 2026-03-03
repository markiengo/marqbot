import type { ProgramsData, SavedPlanFreshness, SavedPlanRecord } from "./types";

export interface SavedPlanSortOption {
  value: "recent" | "oldest" | "name";
  label: string;
}

export const SAVED_PLAN_SORT_OPTIONS: SavedPlanSortOption[] = [
  { value: "recent", label: "Recently updated" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A-Z" },
];

export function formatSavedPlanDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(parsed));
}

export function resolveProgramLabels(ids: string[], collection: { id: string; label: string }[]): string[] {
  const labelById = new Map(collection.map((item) => [item.id, item.label]));
  return ids.map((id) => labelById.get(id) || id);
}

export function buildSavedPlanProgramLine(plan: SavedPlanRecord, programs: ProgramsData): string {
  const major = resolveProgramLabels(plan.inputs.declaredMajors.slice(0, 1), programs.majors)[0] || "";
  const track = resolveProgramLabels(plan.inputs.declaredTracks.slice(0, 1), programs.tracks)[0] || "";
  return [major, track].filter(Boolean).join(" / ");
}

export function getSavedPlanFreshnessCopy(freshness: SavedPlanFreshness): { label: string; reason: string } {
  switch (freshness) {
    case "fresh":
      return {
        label: "Current",
        reason: "The saved snapshot still matches these planner inputs.",
      };
    case "stale":
      return {
        label: "Inputs changed",
        reason: "The saved snapshot was generated from older inputs and should be refreshed in Planner.",
      };
    case "missing":
    default:
      return {
        label: "Snapshot missing",
        reason: "This plan has saved inputs but no recommendation snapshot attached.",
      };
  }
}

export function matchesSavedPlanQuery(plan: SavedPlanRecord, programs: ProgramsData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    plan.name,
    plan.notes,
    plan.inputs.targetSemester,
    ...resolveProgramLabels(plan.inputs.declaredMajors, programs.majors),
    ...resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks),
    ...plan.inputs.completed,
    ...plan.inputs.inProgress,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function sortSavedPlans(plans: SavedPlanRecord[], sort: "recent" | "oldest" | "name"): SavedPlanRecord[] {
  const next = plans.slice();
  if (sort === "name") {
    return next.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "oldest") {
    return next.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  }
  return next.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
