import { PLANNER_FEEDBACK_NUDGE_STORAGE_KEY } from "./constants";

export const PLANNER_FEEDBACK_INITIAL_DELAY_MS = 45_000;
export const PLANNER_FEEDBACK_IDLE_DELAY_MS = 12_000;
export const PLANNER_FEEDBACK_REPEAT_DELAY_MS = 180_000;
export const PLANNER_FEEDBACK_DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const PLANNER_FEEDBACK_SUBMIT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface PlannerFeedbackNudgeRecord {
  dismissedUntil?: number;
  submittedUntil?: number;
}

function normalizeTimestamp(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function readPlannerFeedbackNudgeRecord(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof window !== "undefined"
    ? window.localStorage
    : null,
): PlannerFeedbackNudgeRecord {
  if (!storage) return {};

  try {
    const raw = storage.getItem(PLANNER_FEEDBACK_NUDGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlannerFeedbackNudgeRecord | null;
    return {
      dismissedUntil: normalizeTimestamp(parsed?.dismissedUntil),
      submittedUntil: normalizeTimestamp(parsed?.submittedUntil),
    };
  } catch {
    return {};
  }
}

export function writePlannerFeedbackNudgeRecord(
  record: PlannerFeedbackNudgeRecord,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof window !== "undefined"
    ? window.localStorage
    : null,
): void {
  if (!storage) return;

  try {
    storage.setItem(
      PLANNER_FEEDBACK_NUDGE_STORAGE_KEY,
      JSON.stringify({
        dismissedUntil: normalizeTimestamp(record.dismissedUntil) ?? null,
        submittedUntil: normalizeTimestamp(record.submittedUntil) ?? null,
      }),
    );
  } catch {
    // Ignore storage failures in private mode or quota pressure.
  }
}

export function getPlannerFeedbackCooldownUntil(
  record: PlannerFeedbackNudgeRecord,
): number {
  return Math.max(record.dismissedUntil ?? 0, record.submittedUntil ?? 0);
}
