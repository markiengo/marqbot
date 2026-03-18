import {
  DEFAULT_MAX_RECS,
  DEFAULT_SEMESTER,
  DEFAULT_SEMESTER_COUNT,
  MAX_SAVED_PLANS,
  SAVED_PLANS_STORAGE_KEY,
} from "./constants";
import { inferStudentStageFromCourseCodes, normalizeStudentStage } from "./studentStage";
import type {
  AppState,
  RecommendationResponse,
  SavedPlanFreshness,
  SavedPlanInputs,
  SavedPlanRecord,
  SavedPlansStore,
  SessionSnapshot,
} from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SavedPlanMutationResult {
  ok: boolean;
  plans: SavedPlanRecord[];
  plan?: SavedPlanRecord;
  error?: string;
}

export interface CreateSavedPlanParams {
  name: string;
  notes?: string;
  inputs: SavedPlanInputs;
  recommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
}

export interface UpdateSavedPlanParams {
  name: string;
  notes?: string;
  inputs: SavedPlanInputs;
  recommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
  resultsInputHash?: string | null;
  lastGeneratedAt?: string | null;
}

const STORE_VERSION = 1;

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function normalizeSavedPlanInputs(inputs: Partial<SavedPlanInputs> | null | undefined): SavedPlanInputs {
  const completed = normalizeStringArray(inputs?.completed);
  const inProgress = normalizeStringArray(inputs?.inProgress).filter(
    (code) => !completed.includes(code),
  );
  const normalizedStudentStage = normalizeStudentStage(inputs?.studentStage);
  return {
    completed,
    inProgress,
    declaredMajors: normalizeStringArray(inputs?.declaredMajors),
    declaredTracks: normalizeStringArray(inputs?.declaredTracks),
    declaredMinors: normalizeStringArray(inputs?.declaredMinors),
    discoveryTheme: String(inputs?.discoveryTheme || "").trim(),
    targetSemester: String(inputs?.targetSemester || DEFAULT_SEMESTER).trim() || DEFAULT_SEMESTER,
    semesterCount: String(inputs?.semesterCount || DEFAULT_SEMESTER_COUNT).trim() || DEFAULT_SEMESTER_COUNT,
    maxRecs: String(inputs?.maxRecs || DEFAULT_MAX_RECS).trim() || DEFAULT_MAX_RECS,
    includeSummer: Boolean(inputs?.includeSummer),
    schedulingStyle: (inputs?.schedulingStyle as "grinder" | "explorer" | "mixer") || "grinder",
    studentStage: normalizedStudentStage || inferStudentStageFromCourseCodes([...completed, ...inProgress]),
    studentStageIsExplicit:
      typeof inputs?.studentStageIsExplicit === "boolean"
        ? inputs.studentStageIsExplicit
        : normalizedStudentStage !== null,
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableSerialize(inner)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashSavedPlanInputs(inputs: SavedPlanInputs): string {
  return hashString(stableSerialize(normalizeSavedPlanInputs(inputs)));
}

export function computeSavedPlanFreshness(plan: SavedPlanRecord): SavedPlanFreshness {
  if (!plan.recommendationData) return "missing";
  return plan.resultsInputHash && plan.resultsInputHash === plan.inputHash ? "fresh" : "stale";
}

function sortPlansByUpdatedAt(plans: SavedPlanRecord[]): SavedPlanRecord[] {
  return plans
    .slice()
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function coerceRecommendationResponse(value: unknown): RecommendationResponse | null {
  if (!value || typeof value !== "object") return null;
  const mode = String((value as { mode?: string }).mode || "");
  if (!mode) return null;
  return value as RecommendationResponse;
}

function sanitizeSavedPlanRecord(value: unknown): SavedPlanRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<SavedPlanRecord>;
  const id = String(raw.id || "").trim();
  const name = String(raw.name || "").trim();
  if (!id || !name) return null;
  const inputs = normalizeSavedPlanInputs(raw.inputs);
  const inputHash = String(raw.inputHash || "").trim() || hashSavedPlanInputs(inputs);
  const recommendationData = coerceRecommendationResponse(raw.recommendationData);
  const resultsInputHash = recommendationData
    ? String(raw.resultsInputHash || "").trim() || inputHash
    : null;
  const createdAt = String(raw.createdAt || "").trim() || new Date(0).toISOString();
  const updatedAt = String(raw.updatedAt || "").trim() || createdAt;
  return {
    id,
    name,
    notes: String(raw.notes || ""),
    createdAt,
    updatedAt,
    inputs,
    recommendationData,
    lastRequestedCount: Math.max(1, Number(raw.lastRequestedCount) || Number(inputs.maxRecs) || 1),
    inputHash,
    resultsInputHash,
    lastGeneratedAt: recommendationData ? String(raw.lastGeneratedAt || "").trim() || updatedAt : null,
  };
}

export function readSavedPlansStore(storage: StorageLike | null = getBrowserStorage()): SavedPlansStore {
  if (!storage) return { version: STORE_VERSION, plans: [] };
  try {
    const raw = storage.getItem(SAVED_PLANS_STORAGE_KEY);
    if (!raw) return { version: STORE_VERSION, plans: [] };
    const parsed = JSON.parse(raw) as Partial<SavedPlansStore>;
    const plans = Array.isArray(parsed?.plans)
      ? parsed.plans.map(sanitizeSavedPlanRecord).filter((plan): plan is SavedPlanRecord => Boolean(plan))
      : [];
    return {
      version: STORE_VERSION,
      plans: sortPlansByUpdatedAt(plans),
    };
  } catch {
    return { version: STORE_VERSION, plans: [] };
  }
}

function writeSavedPlansStore(
  store: SavedPlansStore,
  storage: StorageLike | null = getBrowserStorage(),
): SavedPlanMutationResult {
  const plans = sortPlansByUpdatedAt(store.plans);
  if (!storage) {
    return { ok: false, plans, error: "Saved plans are only available in the browser." };
  }
  try {
    storage.setItem(
      SAVED_PLANS_STORAGE_KEY,
      JSON.stringify({ version: STORE_VERSION, plans }),
    );
    return { ok: true, plans };
  } catch (error) {
    return {
      ok: false,
      plans,
      error: error instanceof Error ? error.message : "Could not write saved plans to local storage.",
    };
  }
}

function createPlanId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `plan_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function buildSavedPlanRecord(params: CreateSavedPlanParams): SavedPlanRecord {
  const now = new Date().toISOString();
  const inputs = normalizeSavedPlanInputs(params.inputs);
  const inputHash = hashSavedPlanInputs(inputs);
  return {
    id: createPlanId(),
    name: String(params.name || "").trim(),
    notes: String(params.notes || ""),
    createdAt: now,
    updatedAt: now,
    inputs,
    recommendationData: params.recommendationData,
    lastRequestedCount: Math.max(1, Number(params.lastRequestedCount) || Number(inputs.maxRecs) || 1),
    inputHash,
    resultsInputHash: params.recommendationData ? inputHash : null,
    lastGeneratedAt: params.recommendationData ? now : null,
  };
}

export function listSavedPlans(storage: StorageLike | null = getBrowserStorage()): SavedPlanRecord[] {
  return readSavedPlansStore(storage).plans;
}

export function createSavedPlan(
  params: CreateSavedPlanParams,
  storage: StorageLike | null = getBrowserStorage(),
): SavedPlanMutationResult {
  const existing = readSavedPlansStore(storage).plans;
  const name = String(params.name || "").trim();
  if (!name) {
    return { ok: false, plans: existing, error: "Plan name is required." };
  }
  if (existing.length >= MAX_SAVED_PLANS) {
    return {
      ok: false,
      plans: existing,
      error: `You can save up to ${MAX_SAVED_PLANS} plans. Delete an older plan first.`,
    };
  }

  const plan = buildSavedPlanRecord(params);
  const result = writeSavedPlansStore({ version: STORE_VERSION, plans: [plan, ...existing] }, storage);
  return { ...result, plan };
}

export function updateSavedPlan(
  planId: string,
  params: UpdateSavedPlanParams,
  storage: StorageLike | null = getBrowserStorage(),
): SavedPlanMutationResult {
  const existing = readSavedPlansStore(storage).plans;
  const target = existing.find((plan) => plan.id === planId);
  if (!target) {
    return { ok: false, plans: existing, error: "Saved plan not found." };
  }
  const name = String(params.name || "").trim();
  if (!name) {
    return { ok: false, plans: existing, error: "Plan name is required." };
  }

  const updatedAt = new Date().toISOString();
  const inputs = normalizeSavedPlanInputs(params.inputs);
  const inputHash = hashSavedPlanInputs(inputs);
  const plan: SavedPlanRecord = {
    ...target,
    name,
    notes: String(params.notes || ""),
    updatedAt,
    inputs,
    recommendationData: params.recommendationData,
    lastRequestedCount: Math.max(1, Number(params.lastRequestedCount) || Number(inputs.maxRecs) || 1),
    inputHash,
    resultsInputHash: params.recommendationData ? params.resultsInputHash ?? target.resultsInputHash ?? null : null,
    lastGeneratedAt: params.recommendationData ? params.lastGeneratedAt ?? target.lastGeneratedAt ?? updatedAt : null,
  };
  const nextPlans = existing.map((entry) => (entry.id === planId ? plan : entry));
  const result = writeSavedPlansStore({ version: STORE_VERSION, plans: nextPlans }, storage);
  return { ...result, plan };
}

export function deleteSavedPlan(
  planId: string,
  storage: StorageLike | null = getBrowserStorage(),
): SavedPlanMutationResult {
  const existing = readSavedPlansStore(storage).plans;
  const nextPlans = existing.filter((plan) => plan.id !== planId);
  if (nextPlans.length === existing.length) {
    return { ok: false, plans: existing, error: "Saved plan not found." };
  }
  return writeSavedPlansStore({ version: STORE_VERSION, plans: nextPlans }, storage);
}

export function buildSavedPlanInputsFromAppState(state: AppState): SavedPlanInputs {
  return normalizeSavedPlanInputs({
    completed: [...state.completed],
    inProgress: [...state.inProgress],
    declaredMajors: [...state.selectedMajors],
    declaredTracks: state.selectedTracks,
    declaredMinors: [...state.selectedMinors],
    discoveryTheme: state.discoveryTheme,
    targetSemester: state.targetSemester,
    semesterCount: state.semesterCount,
    maxRecs: state.maxRecs,
    includeSummer: state.includeSummer,
    studentStage: state.studentStage,
    studentStageIsExplicit: state.studentStageIsExplicit,
  });
}

export function buildSessionSnapshotFromSavedPlan(plan: SavedPlanRecord): SessionSnapshot {
  return {
    completed: plan.inputs.completed,
    inProgress: plan.inputs.inProgress,
    targetSemester: plan.inputs.targetSemester,
    semesterCount: plan.inputs.semesterCount,
    maxRecs: plan.inputs.maxRecs,
    includeSummer: plan.inputs.includeSummer,
    studentStage: plan.inputs.studentStage,
    studentStageIsExplicit: plan.inputs.studentStageIsExplicit,
    canTake: "",
    declaredMajors: plan.inputs.declaredMajors,
    declaredTracks: plan.inputs.declaredTracks,
    declaredMinors: plan.inputs.declaredMinors,
    discoveryTheme: plan.inputs.discoveryTheme,
    activeNavTab: "plan",
    onboardingComplete: true,
    lastRecommendationData: plan.recommendationData,
    lastRequestedCount: plan.lastRequestedCount,
  };
}

export function buildRecommendPayloadFromSavedPlanInputs(inputs: SavedPlanInputs): Record<string, unknown> {
  const normalized = normalizeSavedPlanInputs(inputs);
  const payload: Record<string, unknown> = {
    completed_courses: normalized.completed.join(", "),
    in_progress_courses: normalized.inProgress.join(", "),
    target_semester: normalized.targetSemester,
    target_semester_primary: normalized.targetSemester,
    target_semester_count: Number(normalized.semesterCount) || 3,
    max_recommendations: Number(normalized.maxRecs) || 3,
  };
  if (normalized.declaredMajors.length > 0) payload.declared_majors = normalized.declaredMajors;
  if (normalized.declaredTracks.length > 0) payload.track_ids = normalized.declaredTracks;
  if (normalized.declaredMinors.length > 0) payload.declared_minors = normalized.declaredMinors;
  if (normalized.discoveryTheme) payload.discovery_theme = normalized.discoveryTheme;
  if (normalized.includeSummer) payload.include_summer = true;
  payload.student_stage = normalized.studentStage;
  return payload;
}
