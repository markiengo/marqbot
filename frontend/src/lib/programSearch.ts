import type { Major } from "./types";

const MAJOR_CODE_ALIASES: Record<string, string[]> = {
  ACCO_MAJOR: ["ACCO"],
  AIM_MAJOR: ["AIM"],
  BUAN_MAJOR: ["BUAN"],
  ENTP_MAJOR: ["ENTP"],
  FIN_MAJOR: ["FIN", "FINA"],
  HURE_MAJOR: ["HURE"],
  INBU_MAJOR: ["INBU"],
  INSY_MAJOR: ["INSY", "IS"],
  MANA_MAJOR: ["MANA"],
  MARK_MAJOR: ["MARK"],
  MCC_DISC: ["DISC"],
  OSCM_MAJOR: ["OSCM", "SCM"],
  REAL_MAJOR: ["REAL"],
};

function normalizeSearchText(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ");
}

function majorSearchTokens(major: Major): string[] {
  const majorId = String(major.id || "").trim().toUpperCase();
  const majorLabel = String(major.label || "").trim();
  const derivedIdToken = majorId.replace(/_MAJOR$/i, "").trim();

  return [majorLabel, majorId, derivedIdToken, ...(MAJOR_CODE_ALIASES[majorId] ?? [])].filter(Boolean);
}

export function majorMatchesQuery(major: Major, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  return majorSearchTokens(major).some((token) => normalizeSearchText(token).includes(normalizedQuery));
}
