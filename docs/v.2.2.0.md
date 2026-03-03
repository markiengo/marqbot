# Saved Plans Feature — Ultra-Specific Implementation Plan (v2.2.0)

## Context
`/saved` is a `PlaceholderPage`. This plan turns it into a full saved-plans feature: save from Planner, browse on `/saved`, edit inputs, rerun recommendations, compare two plans, load back into live Planner. All browser-local. No backend changes.

---

## Step 1 — `frontend/src/lib/types.ts`

Append after `SessionSnapshot` (line ~72):

```ts
// ─── Saved Plans ─────────────────────────────────────────────────
export interface SavedPlanInputs {
  completed: string[];          // sorted array of completed course codes
  inProgress: string[];         // sorted array of in-progress course codes
  declaredMajors: string[];
  declaredTracks: string[];
  declaredMinors: string[];
  discoveryTheme: string;       // empty string if none
  targetSemester: string;       // e.g. "Fall 2025"
  semesterCount: string;        // e.g. "4"
  maxRecs: string;              // e.g. "5"
  includeSummer: boolean;
}

export interface SavedPlanRecord {
  id: string;                              // crypto.randomUUID()
  name: string;                            // user-provided, non-empty
  notes: string;                           // user-provided, may be ""
  createdAt: string;                       // ISO 8601
  updatedAt: string;                       // ISO 8601, bumped on every save
  inputs: SavedPlanInputs;
  recommendationData: RecommendationResponse | null;
  lastRequestedCount: number;              // mirrors AppState.lastRequestedCount
  inputHash: string;                       // djb2 hash of JSON.stringify(inputs)
  resultsInputHash: string | null;         // inputHash at time of last successful recommend
  lastGeneratedAt: string | null;          // ISO 8601 of last successful recommend
}

export interface SavedPlansStore {
  version: 1;
  plans: SavedPlanRecord[];
}

export type SavedPlanFreshness = "fresh" | "stale" | "missing";
```

---

## Step 2 — `frontend/src/lib/savedPlans.ts` (NEW)

### Constants
```ts
export const SAVED_PLANS_STORAGE_KEY = "marqbot_saved_plans_v1";
export const MAX_SAVED_PLANS = 25;
```

### Hash function
djb2 over a stable JSON string (keys sorted, arrays pre-sorted):
```ts
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep uint32
  }
  return hash;
}

export function hashInputs(inputs: SavedPlanInputs): string {
  const stable: SavedPlanInputs = {
    ...inputs,
    completed: [...inputs.completed].sort(),
    inProgress: [...inputs.inProgress].sort(),
    declaredMajors: [...inputs.declaredMajors].sort(),
    declaredTracks: [...inputs.declaredTracks].sort(),
    declaredMinors: [...inputs.declaredMinors].sort(),
  };
  return String(djb2(JSON.stringify(stable)));
}
```

### Freshness
```ts
export function computeFreshness(plan: SavedPlanRecord): SavedPlanFreshness {
  if (!plan.recommendationData) return "missing";
  if (plan.inputHash !== plan.resultsInputHash) return "stale";
  return "fresh";
}
```

### Storage read (with migration)
```ts
export function readStore(): SavedPlanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_PLANS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    // migration guard — expect { version: 1, plans: [...] }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("plans" in parsed) ||
      !Array.isArray((parsed as { plans: unknown }).plans)
    ) return [];
    const store = parsed as SavedPlansStore;
    // filter malformed records
    const valid = store.plans.filter(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.inputs === "object"
    );
    return [...valid].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}
```

### Storage write
```ts
export class StorageWriteError extends Error {}

export function writeStore(plans: SavedPlanRecord[]): void {
  if (typeof window === "undefined") return;
  const store: SavedPlansStore = { version: 1, plans };
  try {
    localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    throw new StorageWriteError(
      e instanceof Error ? e.message : "localStorage write failed"
    );
  }
}
```

### CRUD
```ts
export function createPlan(
  inputs: SavedPlanInputs,
  data: RecommendationResponse,
  lastCount: number,
  name: string,
  notes: string
): SavedPlanRecord {
  const now = new Date().toISOString();
  const hash = hashInputs(inputs);
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    notes: notes.trim(),
    createdAt: now,
    updatedAt: now,
    inputs,
    recommendationData: data,
    lastRequestedCount: lastCount,
    inputHash: hash,
    resultsInputHash: hash,     // fresh at creation
    lastGeneratedAt: now,
  };
}

export function updatePlan(
  plans: SavedPlanRecord[],
  patch: Partial<SavedPlanRecord> & { id: string }
): SavedPlanRecord[] {
  return plans.map((p) =>
    p.id === patch.id
      ? { ...p, ...patch, updatedAt: new Date().toISOString() }
      : p
  );
}

export function deletePlan(plans: SavedPlanRecord[], id: string): SavedPlanRecord[] {
  return plans.filter((p) => p.id !== id);
}
```

### Conversion helpers
```ts
import type { AppState, SessionSnapshot, SavedPlanInputs } from "./types";

export function planToInputs(state: AppState): SavedPlanInputs {
  return {
    completed: [...state.completed].sort(),
    inProgress: [...state.inProgress].sort(),
    declaredMajors: [...state.selectedMajors].sort(),
    declaredTracks: [...state.selectedTracks],
    declaredMinors: [...state.selectedMinors].sort(),
    discoveryTheme: state.discoveryTheme,
    targetSemester: state.targetSemester,
    semesterCount: state.semesterCount,
    maxRecs: state.maxRecs,
    includeSummer: state.includeSummer,
  };
}

export function inputsToSnapshot(record: SavedPlanRecord): SessionSnapshot {
  const { inputs } = record;
  return {
    completed: inputs.completed,
    inProgress: inputs.inProgress,
    targetSemester: inputs.targetSemester,
    semesterCount: inputs.semesterCount,
    maxRecs: inputs.maxRecs,
    includeSummer: inputs.includeSummer,
    canTake: "",
    declaredMajors: inputs.declaredMajors,
    declaredTracks: inputs.declaredTracks,
    declaredMinors: inputs.declaredMinors,
    discoveryTheme: inputs.discoveryTheme,
    activeNavTab: "plan",
    onboardingComplete: true,
    lastRecommendationData: record.recommendationData,
    lastRequestedCount: record.lastRequestedCount,
  };
}
```

---

## Step 3 — ProgressDashboard refactor (`frontend/src/components/planner/ProgressDashboard.tsx`)

### Change `useProgressMetrics`
Add optional `overrides` parameter:
```ts
export function useProgressMetrics(overrides?: {
  courses: Course[];
  completed: Set<string>;
  inProgress: Set<string>;
}): CreditKpiMetrics {
  const { state } = useAppContext();
  const courses = overrides?.courses ?? state.courses;
  const completed = overrides?.completed ?? state.completed;
  const inProgress = overrides?.inProgress ?? state.inProgress;
  // rest of existing computation unchanged
}
```

### Change component props
```ts
interface ProgressDashboardProps {
  onViewDetails?: () => void;
  // Optional overrides — when present, renders from these instead of AppContext:
  courses?: Course[];
  completed?: Set<string>;
  inProgress?: Set<string>;
}
```

Inside the component, pass the three props to `useProgressMetrics`:
```ts
const metrics = useProgressMetrics(
  props.courses !== undefined
    ? { courses: props.courses, completed: props.completed!, inProgress: props.inProgress! }
    : undefined
);
```

No changes to the planner (still calls `<ProgressDashboard onViewDetails={...} />` with no overrides).

---

## Step 4a — ProfileEditor extraction (`frontend/src/components/planner/InputSidebar.tsx`)

Add a new exported `ProfileEditor` component at module scope (NOT inside InputSidebar render). Move all JSX and logic from InputSidebar's return into ProfileEditor. InputSidebar becomes:

```ts
export function InputSidebar() {
  const { state, dispatch } = useAppContext();
  return (
    <ProfileEditor
      courses={state.courses}
      programs={state.programs}
      completed={state.completed}
      inProgress={state.inProgress}
      selectedMajors={state.selectedMajors}
      selectedTracks={state.selectedTracks}
      selectedMinors={state.selectedMinors}
      discoveryTheme={state.discoveryTheme}
      onAddCompleted={(code) => dispatch({ type: "ADD_COMPLETED", payload: code })}
      onRemoveCompleted={(code) => dispatch({ type: "REMOVE_COMPLETED", payload: code })}
      onAddInProgress={(code) => dispatch({ type: "ADD_IN_PROGRESS", payload: code })}
      onRemoveInProgress={(code) => dispatch({ type: "REMOVE_IN_PROGRESS", payload: code })}
      onAddMajor={(id) => dispatch({ type: "ADD_MAJOR", payload: id })}
      onRemoveMajor={(id) => dispatch({ type: "REMOVE_MAJOR", payload: id })}
      onSetTrack={(parentId, trackId) => dispatch({ type: "SET_TRACK", payload: { parentMajorId: parentId, trackId } })}
      onRemoveTrack={(id) => dispatch({ type: "REMOVE_TRACK", payload: id })}
      onSetDiscoveryTheme={(id) => dispatch({ type: "SET_DISCOVERY_THEME", payload: id })}
    />
  );
}
```

`ProfileEditor` interface:
```ts
export interface ProfileEditorProps {
  courses: Course[];
  programs: ProgramsData;
  completed: Set<string>;
  inProgress: Set<string>;
  selectedMajors: Set<string>;
  selectedTracks: string[];
  selectedMinors: Set<string>;
  discoveryTheme: string;
  onAddCompleted(code: string): void;
  onRemoveCompleted(code: string): void;
  onAddInProgress(code: string): void;
  onRemoveInProgress(code: string): void;
  onAddMajor(id: string): void;
  onRemoveMajor(id: string): void;
  onSetTrack(parentMajorId: string, trackId: string): void;
  onRemoveTrack(id: string): void;
  onSetDiscoveryTheme(id: string): void;
}
```

All existing validation logic (AIM CFA + Finance warning, MAX_MAJORS cap, requires_primary_major banner) stays inside `ProfileEditor` — it's pure prop-based now.

---

## Step 4b — PreferencesEditor extraction (`frontend/src/components/planner/PreferencesPanel.tsx`)

Add exported `PreferencesEditor` at module scope:

```ts
export interface PreferencesEditorProps {
  targetSemester: string;
  semesterCount: string;
  maxRecs: string;
  includeSummer: boolean;
  disabled?: boolean;
  onSetTargetSemester(v: string): void;
  onSetSemesterCount(v: string): void;
  onSetMaxRecs(v: string): void;
  onSetIncludeSummer(v: boolean): void;
  // optional submit button (omit to hide it)
  onSubmit?(): void;
  submitLabel?: string;
  isLoading?: boolean;
}
```

`PreferencesPanel` wrapper becomes:
```ts
export function PreferencesPanel() {
  const { state, dispatch } = useAppContext();
  const { fetchRecommendations, isLoading } = useRecommendations();
  const hasProgram = state.selectedMajors.size > 0;
  return (
    <PreferencesEditor
      targetSemester={state.targetSemester}
      semesterCount={state.semesterCount}
      maxRecs={state.maxRecs}
      includeSummer={state.includeSummer}
      disabled={!hasProgram}
      onSetTargetSemester={(v) => dispatch({ type: "SET_TARGET_SEMESTER", payload: v })}
      onSetSemesterCount={(v) => dispatch({ type: "SET_SEMESTER_COUNT", payload: v })}
      onSetMaxRecs={(v) => dispatch({ type: "SET_MAX_RECS", payload: v })}
      onSetIncludeSummer={(v) => dispatch({ type: "SET_INCLUDE_SUMMER", payload: v })}
      onSubmit={fetchRecommendations}
      submitLabel="Get My Plan"
      isLoading={isLoading}
    />
  );
}
```

---

## Step 5 — AppReducer: `APPLY_PLANNER_SNAPSHOT` (`frontend/src/context/AppReducer.ts`)

### New action type (add to AppAction union):
```ts
| { type: "APPLY_PLANNER_SNAPSHOT"; payload: SessionSnapshot }
```

### Shared helper (extract from RESTORE_SESSION):
```ts
function applySessionData(
  state: AppState,
  snap: SessionSnapshot
): Partial<AppState> {
  // same course/track/major validation as current RESTORE_SESSION case
  // validates completed/inProgress against state.courses catalog
  // sanitizes tracks against state.programs
  // calls sanitizeAimProgramSelections()
  // returns validated partial state (does NOT set onboardingComplete)
}
```

### RESTORE_SESSION case updated to use shared helper:
```ts
case "RESTORE_SESSION": {
  if (state.onboardingComplete) return state; // existing guard preserved
  if (state.courses.length === 0) return state;
  return { ...state, ...applySessionData(state, action.payload), onboardingComplete: action.payload.onboardingComplete ?? false };
}
```

### New APPLY_PLANNER_SNAPSHOT case:
```ts
case "APPLY_PLANNER_SNAPSHOT": {
  // No onboardingComplete guard — this is intentional replacement
  if (state.courses.length === 0) return state; // wait for catalog load
  return {
    ...state,
    ...applySessionData(state, action.payload),
    onboardingComplete: true,  // always true — loading a saved plan implies onboarding done
    lastRecommendationData: action.payload.lastRecommendationData ?? null,
    lastRequestedCount: action.payload.lastRequestedCount ?? 0,
    activeNavTab: "plan",
  };
}
```

---

## Step 6 — `frontend/src/hooks/useSavedPlans.ts` (NEW)

```ts
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  readStore, writeStore, createPlan, updatePlan, deletePlan,
  StorageWriteError, MAX_SAVED_PLANS,
} from "@/lib/savedPlans";
import type { SavedPlanRecord, SavedPlanInputs, RecommendationResponse } from "@/lib/types";

interface UseSavedPlansReturn {
  plans: SavedPlanRecord[];
  selectedPlanId: string | null;
  compareIds: string[];           // length 0, 1, or 2
  storageError: string | null;
  selectPlan(id: string | null): void;
  toggleCompare(id: string): void;
  createAndSave(
    inputs: SavedPlanInputs,
    data: RecommendationResponse,
    lastCount: number,
    name: string,
    notes: string
  ): "ok" | "cap_exceeded" | "write_error";
  updateAndSave(patch: Partial<SavedPlanRecord> & { id: string }): "ok" | "write_error";
  remove(id: string): void;
  loadPlan(id: string): SavedPlanRecord | null;
  clearStorageError(): void;
}

export function useSavedPlans(): UseSavedPlansReturn {
  const [plans, setPlans] = useState<SavedPlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Load on mount
  useEffect(() => { setPlans(readStore()); }, []);

  const selectPlan = useCallback((id: string | null) => {
    setSelectedPlanId(id);
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // drop oldest
      return [...prev, id];
    });
  }, []);

  const createAndSave = useCallback((
    inputs: SavedPlanInputs,
    data: RecommendationResponse,
    lastCount: number,
    name: string,
    notes: string
  ): "ok" | "cap_exceeded" | "write_error" => {
    const current = readStore();
    if (current.length >= MAX_SAVED_PLANS) return "cap_exceeded";
    const record = createPlan(inputs, data, lastCount, name, notes);
    const next = [record, ...current];
    try {
      writeStore(next);
      setPlans(next);
      return "ok";
    } catch (e) {
      setStorageError(e instanceof StorageWriteError ? e.message : "Save failed");
      return "write_error";
    }
  }, []);

  const updateAndSave = useCallback((
    patch: Partial<SavedPlanRecord> & { id: string }
  ): "ok" | "write_error" => {
    const current = readStore();
    const next = updatePlan(current, patch);
    try {
      writeStore(next);
      setPlans(next);
      return "ok";
    } catch (e) {
      setStorageError(e instanceof StorageWriteError ? e.message : "Save failed");
      return "write_error";
    }
  }, []);

  const remove = useCallback((id: string) => {
    const current = readStore();
    const next = deletePlan(current, id);
    try { writeStore(next); } catch { /* best-effort */ }
    setPlans(next);
    setSelectedPlanId((prev) => (prev === id ? null : prev));
    setCompareIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const loadPlan = useCallback((id: string) => {
    return plans.find((p) => p.id === id) ?? null;
  }, [plans]);

  const clearStorageError = useCallback(() => setStorageError(null), []);

  return {
    plans, selectedPlanId, compareIds, storageError,
    selectPlan, toggleCompare, createAndSave, updateAndSave, remove, loadPlan, clearStorageError,
  };
}
```

---

## Step 7a — `frontend/src/components/saved/SavePlanModal.tsx` (NEW)

```ts
interface SavePlanModalProps {
  open: boolean;
  defaultName: string;   // "<primary program label> — <targetSemester> — <date>"
  onSave(name: string, notes: string): void;
  onClose(): void;
  error?: string | null;   // shown when cap exceeded or write fails
}
```

Renders inside existing `Modal` shared component.

UI:
- Title: "Save Plan"
- `<label>Plan name *</label>` + `<input type="text" />` — required, trimmed, 100-char max
- `<label>Notes (optional)</label>` + `<textarea rows={3} />` — 500-char max
- Error banner (red, beneath inputs): shows `props.error` when truthy
- Buttons row: `Cancel` (ghost) | `Save` (primary gold) — Save disabled if name is empty

On submit: call `onSave(name.trim(), notes.trim())`.

---

## Step 7b — PlannerLayout changes (`frontend/src/components/planner/PlannerLayout.tsx`)

### Imports to add:
```ts
import { SavePlanModal } from "@/components/saved/SavePlanModal";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { planToInputs } from "@/lib/savedPlans";
```

### New state:
```ts
const [savePlanModalOpen, setSavePlanModalOpen] = useState(false);
const [savePlanError, setSavePlanError] = useState<string | null>(null);
const [saveSuccessBanner, setSaveSuccessBanner] = useState(false);
const { createAndSave } = useSavedPlans();
```

### Default plan name helper (inline):
```ts
function buildDefaultPlanName(): string {
  const primaryMajor = state.programs.majors.find((m) => state.selectedMajors.has(m.id));
  const label = primaryMajor?.label ?? "My Plan";
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${label} — ${state.targetSemester} — ${date}`;
}
```

### Header bar change:
Add "Save Plan" button **before** "Get My Plan":
```tsx
<button
  onClick={() => { setSavePlanError(null); setSavePlanModalOpen(true); }}
  disabled={!state.lastRecommendationData}
  className="btn-secondary text-sm"
  title={!state.lastRecommendationData ? "Run recommendations first" : "Save this plan"}
>
  Save Plan
</button>
```

### Modal wiring:
```tsx
<SavePlanModal
  open={savePlanModalOpen}
  defaultName={buildDefaultPlanName()}
  error={savePlanError}
  onClose={() => setSavePlanModalOpen(false)}
  onSave={(name, notes) => {
    if (!state.lastRecommendationData) return;
    const inputs = planToInputs(state);
    const result = createAndSave(inputs, state.lastRecommendationData, state.lastRequestedCount, name, notes);
    if (result === "ok") {
      setSavePlanModalOpen(false);
      setSaveSuccessBanner(true);
      setTimeout(() => setSaveSuccessBanner(false), 5000);
    } else if (result === "cap_exceeded") {
      setSavePlanError("You've reached the 25-plan limit. Delete an older plan on /saved to make room.");
    } else {
      setSavePlanError("Save failed — your browser may be blocking storage access.");
    }
  }}
/>
```

### Success banner (render near top of planner body):
```tsx
{saveSuccessBanner && (
  <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2">
    Plan saved! <Link href="/saved" className="underline font-medium">View on Saved Plans →</Link>
  </div>
)}
```

---

## Step 8 — Saved page components (`frontend/src/components/saved/`)

### 8a. `SavedPlansPage.tsx`

```ts
type SavedView = "detail" | "edit" | "compare";

export function SavedPlansPage() {
  const hook = useSavedPlans();
  const [view, setView] = useState<SavedView>("detail");

  const selectedPlan = hook.selectedPlanId ? hook.loadPlan(hook.selectedPlanId) : null;

  if (hook.plans.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full">
      {/* Left column — fixed width ~320px */}
      <SavedPlansList
        plans={hook.plans}
        selectedPlanId={hook.selectedPlanId}
        compareIds={hook.compareIds}
        onSelect={(id) => { hook.selectPlan(id); setView("detail"); }}
        onToggleCompare={hook.toggleCompare}
        onDelete={hook.remove}
        onCompare={() => setView("compare")}
      />
      {/* Right column — flex-1 */}
      <div className="flex-1 overflow-y-auto">
        {view === "compare" && hook.compareIds.length === 2 ? (
          <SavedPlanCompare
            planA={hook.loadPlan(hook.compareIds[0])!}
            planB={hook.loadPlan(hook.compareIds[1])!}
            onExit={() => setView("detail")}
          />
        ) : view === "edit" && selectedPlan ? (
          <SavedPlanEditor
            plan={selectedPlan}
            onSave={(patch) => { hook.updateAndSave(patch); setView("detail"); }}
            onCancel={() => setView("detail")}
          />
        ) : selectedPlan ? (
          <SavedPlanDetail
            plan={selectedPlan}
            onEdit={() => setView("edit")}
            onDelete={() => hook.remove(selectedPlan.id)}
          />
        ) : (
          <NoSelectionState />
        )}
      </div>
    </div>
  );
}
```

Empty state:
```tsx
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <p className="text-lg font-medium">No saved plans yet.</p>
      <p className="text-muted-foreground text-sm">Go to Planner, run recommendations, and hit "Save Plan".</p>
      <Link href="/planner" className="btn-primary">Go to Planner →</Link>
    </div>
  );
}
```

---

### 8b. `SavedPlansList.tsx`

Props:
```ts
interface SavedPlansListProps {
  plans: SavedPlanRecord[];
  selectedPlanId: string | null;
  compareIds: string[];
  onSelect(id: string): void;
  onToggleCompare(id: string): void;
  onDelete(id: string): void;
  onCompare(): void;    // enabled only when compareIds.length === 2
}
```

Each card shows:
- **Name** (bold, 1 line truncated)
- **Notes preview** (italic, 2 lines truncated, hidden if empty)
- **Freshness badge**: green `Fresh` / amber `Needs re-run` / gray `No recommendations` — computed via `computeFreshness(plan)`
- **Updated timestamp**: `"Updated Mar 3"` (short format)
- **Settings summary**: first major label + track label (truncated) + target semester
- **Counts**: `{completed.length} done · {inProgress.length} in progress`
- **Compare checkbox**: `<input type="checkbox" />` — checked when plan is in `compareIds`; disabled when compareIds has 2 others
- **Delete button**: trash icon, `onClick={onDelete}` with `stopPropagation`

"Compare (2)" button at top of list: enabled when `compareIds.length === 2`, calls `onCompare`.

---

### 8c. `SavedPlanDetail.tsx`

Props:
```ts
interface SavedPlanDetailProps {
  plan: SavedPlanRecord;
  onEdit(): void;
  onDelete(): void;
}
```

Structure:
1. **Header**: `<h2>{plan.name}</h2>` | freshness badge | `Updated {date}`
2. **Notes**: shown in subtle italic if non-empty
3. **Stale banner** (amber): "Inputs have changed since this plan was generated. Edit and re-run to refresh." — shown when `freshness === "stale"`
4. **Settings summary row**: majors (comma-separated labels), tracks, target semester, semesters, max courses, summer flag
5. **Progress snapshot**: `<ProgressDashboard courses={...} completed={new Set(plan.inputs.completed)} inProgress={new Set(plan.inputs.inProgress)} />` — no `onViewDetails` prop (no modal in saved view)
6. **Recommendations snapshot**: `<RecommendationsPanel data={plan.recommendationData} onExpandSemester={() => {}} />` — existing component, no changes
7. **Action buttons row**: `Edit` (secondary) | `Load into Planner` (primary) | `Delete` (destructive/ghost)

Load into Planner flow:
- Click opens `<Modal>` with confirmation: "This will replace your current live planner session on this device. Continue?"
- Confirm: call `dispatch({ type: "APPLY_PLANNER_SNAPSHOT", payload: inputsToSnapshot(plan) })` then `router.push("/planner")`
- Cancel: close modal

Import `useAppContext()` to get `state.programs` and `state.courses` for rendering the progress snapshot.

---

### 8d. `SavedPlanEditor.tsx`

Props:
```ts
interface SavedPlanEditorProps {
  plan: SavedPlanRecord;
  onSave(patch: Partial<SavedPlanRecord> & { id: string }): void;
  onCancel(): void;
}
```

Internal state:
```ts
const [draft, setDraft] = useState<SavedPlanInputs>(plan.inputs);
const [name, setName] = useState(plan.name);
const [notes, setNotes] = useState(plan.notes);
const [draftRecs, setDraftRecs] = useState<RecommendationResponse | null>(plan.recommendationData);
const [draftResultsHash, setDraftResultsHash] = useState<string | null>(plan.resultsInputHash);
const [isDirty, setIsDirty] = useState(false);
const [rerunLoading, setRerunLoading] = useState(false);
const [rerunError, setRerunError] = useState<string | null>(null);
```

Freshness of draft: `hashInputs(draft) !== draftResultsHash` → stale.

Field change handler:
```ts
function setDraftField<K extends keyof SavedPlanInputs>(key: K, value: SavedPlanInputs[K]) {
  setDraft((prev) => ({ ...prev, [key]: value }));
  setIsDirty(true);
  setDraftResultsHash(null); // mark recs stale
}
```

Re-run recommendations:
```ts
async function handleRerun() {
  setRerunLoading(true); setRerunError(null);
  try {
    const data = await postRecommend(buildRecommendPayload(draft));
    setDraftRecs(data);
    setDraftResultsHash(hashInputs(draft));
    setIsDirty(true);
  } catch (e) {
    setRerunError("Recommendation fetch failed. Check your connection and try again.");
  } finally {
    setRerunLoading(false);
  }
}
```

`buildRecommendPayload(inputs: SavedPlanInputs)` — mirrors `useRecommendations.ts` payload construction:
```ts
function buildRecommendPayload(inputs: SavedPlanInputs): Record<string, unknown> {
  return {
    completed_courses: inputs.completed.join(", "),
    in_progress_courses: inputs.inProgress.join(", "),
    target_semester: inputs.targetSemester,
    target_semester_primary: inputs.targetSemester.split(" ")[0],
    target_semester_count: Number(inputs.semesterCount),
    max_recommendations: Number(inputs.maxRecs),
    declared_majors: inputs.declaredMajors.length ? inputs.declaredMajors : undefined,
    track_ids: inputs.declaredTracks.length ? inputs.declaredTracks : undefined,
    declared_minors: inputs.declaredMinors.length ? inputs.declaredMinors : undefined,
    discovery_theme: inputs.discoveryTheme || undefined,
    include_summer: inputs.includeSummer,
  };
}
```

Save handler:
```ts
function handleSave() {
  const now = new Date().toISOString();
  onSave({
    id: plan.id,
    name: name.trim(),
    notes: notes.trim(),
    inputs: draft,
    recommendationData: draftRecs,
    lastRequestedCount: draftRecs?.semesters?.length ?? plan.lastRequestedCount,
    inputHash: hashInputs(draft),
    resultsInputHash: draftResultsHash,
    lastGeneratedAt: draftResultsHash ? now : plan.lastGeneratedAt,
  });
}
```

Uses `ProfileEditor` + `PreferencesEditor` (controlled variants from Step 4) bound to `draft` state.

Layout: two-column (editor left, preview right on desktop). Preview shows:
- Stale banner if draft recs are stale
- `RecommendationsPanel data={draftRecs}`
- `ProgressDashboard` with draft inputs

Action bar at bottom: `Re-run Recommendations` (primary, loading state) | `Save Changes` (disabled if !isDirty) | `Cancel` (ghost)

---

### 8e. `SavedPlanCompare.tsx`

Props:
```ts
interface SavedPlanCompareProps {
  planA: SavedPlanRecord;
  planB: SavedPlanRecord;
  onExit(): void;
}
```

Layout: "Exit Compare" button at top → two equal columns (flex-row on desktop, flex-col on mobile).

Each column:
- Name + freshness badge + updated time
- Settings summary (majors, tracks, semester)
- `ProgressDashboard` (props mode, read-only, no `onViewDetails`)
- `RecommendationsPanel` (read-only; pass `onExpandSemester={() => {}}`)

Purely presentational — no state mutations in compare mode.

---

## Step 9 — `frontend/src/app/saved/page.tsx`

Replace placeholder with:
```tsx
"use client";
import { SavedPlansPage } from "@/components/saved/SavedPlansPage";

export default function SavedPage() {
  return <SavedPlansPage />;
}
```

---

## Step 10 — `tests/frontend/savedPlans.test.ts` (NEW)

Using vitest. Import `savedPlans.ts` functions and `appReducer` + `initialState`.

### Test 1: Storage round trip
```
create a plan → writeStore → readStore → expect record fields to match exactly
```

### Test 2: Malformed localStorage falls back safely
```
localStorage.setItem(key, "not json") → readStore() → returns []
localStorage.setItem(key, JSON.stringify({ plans: "wrong type" })) → readStore() → returns []
```

### Test 3: Sorting by updatedAt desc
```
write 3 records with updatedAt: "2026-01-01", "2026-03-01", "2026-02-01"
readStore() → expect order: Mar, Feb, Jan
```

### Test 4: Freshness
```
plan with no recommendationData → "missing"
plan with recommendationData, inputHash === resultsInputHash → "fresh"
plan with recommendationData, inputHash !== resultsInputHash → "stale"
```

### Test 5: Create, update, delete
```
createPlan → expect id present, name trimmed, inputHash === resultsInputHash, lastGeneratedAt set
updatePlan → expect updatedAt bumped, patched fields applied, other fields unchanged
deletePlan → expect record removed, other records intact
```

### Test 6: Max-plan cap enforcement
```
write 25 plans → createAndSave returns "cap_exceeded" without writing a 26th
```

### Test 7: inputsToSnapshot transform
```
build a SavedPlanRecord → inputsToSnapshot → verify SessionSnapshot fields match inputs
verify: onboardingComplete === true, activeNavTab === "plan", canTake === ""
```

### Test 8: APPLY_PLANNER_SNAPSHOT replaces planner state
```
start with initialState (different majors/courses)
dispatch APPLY_PLANNER_SNAPSHOT with a snapshot that has specific majors + courses
expect state.selectedMajors, state.completed, state.inProgress to reflect snapshot
expect state.onboardingComplete === true regardless of prior value
```

### Test 9: Reducer sanitization removes invalid data
```
APPLY_PLANNER_SNAPSHOT with completed courses that don't exist in catalog → courses filtered out
APPLY_PLANNER_SNAPSHOT with track_id not in programs → track filtered out
```

---

## Critical Files Summary

| File | Action |
|------|--------|
| `frontend/src/lib/types.ts` | Add 4 types (SavedPlanInputs, SavedPlanRecord, SavedPlansStore, SavedPlanFreshness) |
| `frontend/src/lib/savedPlans.ts` | NEW — full storage service |
| `frontend/src/hooks/useSavedPlans.ts` | NEW — hook |
| `frontend/src/context/AppReducer.ts` | Add APPLY_PLANNER_SNAPSHOT + extract applySessionData helper |
| `frontend/src/components/planner/ProgressDashboard.tsx` | Add optional overrides to useProgressMetrics + component |
| `frontend/src/components/planner/InputSidebar.tsx` | Extract ProfileEditor; InputSidebar becomes thin wrapper |
| `frontend/src/components/planner/PreferencesPanel.tsx` | Extract PreferencesEditor; PreferencesPanel becomes thin wrapper |
| `frontend/src/components/planner/PlannerLayout.tsx` | Add Save button + SavePlanModal + success banner |
| `frontend/src/components/saved/SavePlanModal.tsx` | NEW |
| `frontend/src/components/saved/SavedPlansPage.tsx` | NEW |
| `frontend/src/components/saved/SavedPlansList.tsx` | NEW |
| `frontend/src/components/saved/SavedPlanDetail.tsx` | NEW |
| `frontend/src/components/saved/SavedPlanEditor.tsx` | NEW |
| `frontend/src/components/saved/SavedPlanCompare.tsx` | NEW |
| `frontend/src/app/saved/page.tsx` | Replace placeholder |
| `tests/frontend/savedPlans.test.ts` | NEW — 9 test scenarios |

No backend changes. No new npm packages (`crypto.randomUUID` built-in; all deps already present).

---

## Verification

1. `cd frontend && npm run test` → savedPlans.test.ts all 9 pass, prior tests unchanged
2. `npm run lint && npm run build` → zero errors, static export succeeds
3. Manual QA:
   - Planner → Run plan → "Save Plan" button enabled → save modal → fills name → save → success banner with link to /saved
   - Navigate to /saved → plan appears in list with correct freshness badge
   - Select plan → read view shows progress + recs → "Load into Planner" → confirm → navigated to /planner with session replaced
   - Edit plan → change a course → recs marked stale → "Re-run" → recs refresh → "Save changes" → read view returns with fresh badge
   - Select 2 plans → "Compare (2)" enabled → side-by-side view renders both
   - Fill 25 plans → 26th save → clear cap error message shown
4. `pytest tests/backend -q` → no regressions
