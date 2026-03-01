/**
 * Contextual quip system — deterministic one-liner selection for modals.
 *
 * Picks a quip based on a stable context hash (djb2). Same student data =
 * same quip every time. No Math.random(), no external API.
 *
 * Tone reference: docs/branding.md
 *   70% dry · 20% witty · 10% slightly chaotic (rare)
 */

import type { CreditKpiMetrics, BucketProgress, SemesterData } from "./types";
import { QUIP_BANK } from "./quipBank.generated";
import type { QuipEntry } from "./quipBank.generated";

// ── Public API ──────────────────────────────────────────────────────────────

export interface ProgressQuipInput {
  metrics: CreditKpiMetrics;
  currentProgress: Record<string, BucketProgress> | null;
}

export interface SemesterQuipInput {
  semester: SemesterData;
  index: number;
  requestedCount: number;
}

export function getProgressQuip(input: ProgressQuipInput): string {
  const dims = resolveProgressDimensions(input);
  return pick(dims, "progress");
}

export function getSemesterQuip(input: SemesterQuipInput): string {
  const dims = resolveSemesterDimensions(input);
  return pick(dims, "semester");
}

// ── Dimension resolution ────────────────────────────────────────────────────

type DimensionMap = Record<string, string>;

function resolveProgressDimensions(input: ProgressQuipInput): DimensionMap {
  const { metrics, currentProgress } = input;
  return {
    standing: resolveStanding(metrics.standingLabel),
    progress: resolveProgress(metrics.donePercent),
    remaining: resolveRemaining(metrics.remainingCredits),
    inProgress: resolveInProgress(metrics.inProgressCredits),
    bucketHealth: resolveBucketHealth(currentProgress),
  };
}

function resolveSemesterDimensions(input: SemesterQuipInput): DimensionMap {
  const { semester, index } = input;
  const recs = semester.recommendations || [];
  return {
    season: resolveSeason(semester.target_semester),
    semesterIndex: resolveSemesterIndex(index),
    recCount: resolveRecCount(recs.length),
    multiBucket: resolveMultiBucket(recs),
    hasWarnings: resolveHasWarnings(recs),
    standing: resolveStanding(semester.standing_label || ""),
    bucketHealth: resolveBucketHealth(semester.projected_progress || semester.progress || null),
    progress: "building", // not available in semester context; neutral default
    remaining: "chunk",   // not available in semester context; neutral default
    inProgress: "none",   // not available in semester context; neutral default
  };
}

// ── Individual resolvers ────────────────────────────────────────────────────

function resolveStanding(label: string): string {
  const l = (label || "").toLowerCase();
  if (l.includes("senior")) return "senior";
  if (l.includes("junior")) return "junior";
  if (l.includes("sophomore")) return "sophomore";
  return "freshman";
}

function resolveProgress(pct: number): string {
  if (pct >= 100) return "done";
  if (pct >= 86) return "nearDone";
  if (pct >= 66) return "homestretch";
  if (pct >= 41) return "midway";
  if (pct >= 16) return "building";
  return "early";
}

function resolveRemaining(credits: number): string {
  if (credits <= 0) return "zero";
  if (credits < 25) return "handful";
  if (credits < 50) return "manageable";
  if (credits <= 80) return "chunk";
  return "mountain";
}

function resolveInProgress(credits: number): string {
  if (credits <= 0) return "none";
  if (credits < 10) return "light";
  if (credits < 19) return "moderate";
  return "heavy";
}

function resolveSeason(semester?: string): string {
  const s = (semester || "").toLowerCase();
  if (s.includes("summer")) return "summer";
  if (s.includes("spring")) return "spring";
  return "fall";
}

function resolveSemesterIndex(index: number): string {
  if (index === 0) return "first";
  if (index <= 5) return "middle";
  return "deep";
}

function resolveRecCount(count: number): string {
  if (count === 0) return "empty";
  if (count <= 2) return "light";
  if (count <= 4) return "normal";
  return "heavy";
}

interface RecLike {
  fills_buckets?: string[];
  warning_text?: string;
  soft_tags?: string[];
}

function resolveMultiBucket(recs: RecLike[]): string {
  const count = recs.filter((r) => (r.fills_buckets?.length ?? 0) >= 2).length;
  if (count >= 3) return "many";
  if (count >= 1) return "some";
  return "none";
}

function resolveHasWarnings(recs: RecLike[]): string {
  const warned = recs.some(
    (r) => (r.warning_text && r.warning_text.trim() !== "") || (r.soft_tags && r.soft_tags.length > 0),
  );
  return warned ? "warned" : "clean";
}

// ── Bucket health (OR-logic matching RecommendationsPanel) ──────────────────

function isBucketSatisfied(b: BucketProgress): boolean {
  if (b.satisfied) return true;
  const nc = b.needed_count ?? 0;
  if (nc > 0) {
    const total = (b.completed_courses ?? 0) + (b.in_progress_courses ?? 0);
    if (total >= nc) return true;
  }
  const needed = b.needed ?? 0;
  if (needed > 0) {
    const done = (b.completed_done ?? b.done_count ?? 0) + (b.in_progress_increment ?? 0);
    if (done >= needed) return true;
  }
  return false;
}

function resolveBucketHealth(progress: Record<string, BucketProgress> | null): string {
  if (!progress) return "earlyDays";
  const entries = Object.values(progress).filter(
    (b) => (b.needed ?? 0) > 0 || (b.needed_count ?? 0) > 0,
  );
  if (entries.length === 0) return "earlyDays";
  const satisfied = entries.filter(isBucketSatisfied).length;
  const ratio = satisfied / entries.length;
  if (ratio >= 1) return "allSatisfied";
  if (ratio > 0.75) return "mostDone";
  if (ratio >= 0.4) return "halfDone";
  return "earlyDays";
}

// ── Compound condition definitions ──────────────────────────────────────────

interface CompoundRule {
  id: string;
  priority: number;
  match: Record<string, string>;
  /** If a match key has "!" prefix on value, it means "not equal". */
}

function rule(id: string, priority: number, match: Record<string, string>): CompoundRule {
  return { id, priority, match };
}

const COMPOUND_RULES: CompoundRule[] = [
  rule("easter_egg_complete",   20, { progress: "done", bucketHealth: "allSatisfied" }),
  rule("easter_egg_full_plan",  18, { semesterIndex: "deep" }),
  rule("freshman_mountain",     10, { standing: "freshman", progress: "early" }),
  rule("senior_homestretch",    10, { standing: "senior", progress: "homestretch" }),
  rule("senior_done",           10, { standing: "senior", progress: "done" }),
  rule("almost_clean",          9,  { remaining: "handful", bucketHealth: "mostDone" }),
  rule("summer_grind",          9,  { season: "summer", recCount: "!empty" }),
  rule("summer_empty",          9,  { season: "summer", recCount: "empty" }),
  rule("sophomore_building",    8,  { standing: "sophomore", progress: "building" }),
  rule("junior_midway",         8,  { standing: "junior", progress: "midway" }),
  rule("first_semester_heavy",  8,  { semesterIndex: "first", recCount: "heavy" }),
  rule("heavy_warned",          7,  { recCount: "heavy", hasWarnings: "warned" }),
  rule("deep_planning",         7,  { semesterIndex: "deep" }),
  rule("multibucket_stacking",  6,  { multiBucket: "many" }),
].sort((a, b) => b.priority - a.priority);

// ── Dimension fallback priority ─────────────────────────────────────────────

const DIMENSION_PRIORITY = [
  "progress",
  "standing",
  "season",
  "remaining",
  "recCount",
  "inProgress",
  "bucketHealth",
  "semesterIndex",
  "multiBucket",
  "hasWarnings",
] as const;

// ── djb2 hash ───────────────────────────────────────────────────────────────

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash;
}

// ── Weighted expansion ──────────────────────────────────────────────────────

function expandWeighted(pool: QuipEntry[]): QuipEntry[] {
  const expanded: QuipEntry[] = [];
  // Normalize: multiply all weights by 10, round, use as repeat count
  // This gives weight=0.1 → 1 slot, weight=1 → 10 slots, weight=2 → 20 slots
  for (const entry of pool) {
    const slots = Math.max(1, Math.round(entry.weight * 10));
    for (let i = 0; i < slots; i++) {
      expanded.push(entry);
    }
  }
  return expanded;
}

// ── Core selection ──────────────────────────────────────────────────────────

const ULTIMATE_FALLBACK = "We move.";

function filterByTarget(pool: QuipEntry[], modal: "progress" | "semester"): QuipEntry[] {
  return pool.filter((e) => e.target === modal || e.target === "both");
}

function pick(dims: DimensionMap, modal: "progress" | "semester"): string {
  // Build context signature for hashing
  const sig = Object.keys(dims)
    .sort()
    .map((k) => `${k}=${dims[k]}`)
    .join("|");
  const hash = djb2(sig);

  // Try compounds first
  for (const rule of COMPOUND_RULES) {
    const matched = Object.entries(rule.match).every(([dim, expected]) => {
      if (expected.startsWith("!")) {
        return dims[dim] !== expected.slice(1);
      }
      return dims[dim] === expected;
    });
    if (!matched) continue;

    const pool = QUIP_BANK.compounds[rule.id];
    if (!pool || pool.length === 0) continue;

    const filtered = filterByTarget(pool, modal);
    if (filtered.length === 0) continue;

    const expanded = expandWeighted(filtered);
    return expanded[hash % expanded.length].text;
  }

  // Dimension fallback
  for (const dim of DIMENSION_PRIORITY) {
    const slot = dims[dim];
    if (!slot) continue;

    const dimPool = QUIP_BANK.dimensions[dim];
    if (!dimPool) continue;

    const slotPool = dimPool[slot];
    if (!slotPool || slotPool.length === 0) continue;

    const filtered = filterByTarget(slotPool, modal);
    if (filtered.length === 0) continue;

    const expanded = expandWeighted(filtered);
    return expanded[hash % expanded.length].text;
  }

  return ULTIMATE_FALLBACK;
}
