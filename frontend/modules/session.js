export const STORAGE_KEY = "marqbot_session_v1";

/**
 * Build a plain snapshot of current session state for serialization.
 * @param {{ completed: Set<string>, inProgress: Set<string> }} state
 * @param {{ targetSemester: Element|null, targetSemester2: Element|null, targetSemester3: Element|null, maxRecs: Element|null, canTake: Element|null }} elements
 */
export function getSessionSnapshot(state, elements) {
  const declaredMajors = elements.declaredMajors
    ? Array.from(elements.declaredMajors.selectedOptions || []).map(o => o.value).filter(Boolean)
    : [];
  const activeNavTab = typeof elements.getActiveNavTab === "function"
    ? String(elements.getActiveNavTab() || "nav-plan")
    : "nav-plan";
  return {
    completed: [...state.completed],
    inProgress: [...state.inProgress],
    targetSemester: elements.targetSemester?.value || "",
    targetSemester2: elements.targetSemester2?.value || "",
    targetSemester3: elements.targetSemester3?.value || "",
    maxRecs: elements.maxRecs?.value || "3",
    canTake: elements.canTake?.value || "",
    declaredMajors,
    declaredTrack: elements.declaredTrack?.value || "",
    activeNavTab,
  };
}

/**
 * Persist current session to localStorage.
 */
export function saveSession(state, elements) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSessionSnapshot(state, elements)));
  } catch (_) {
    // Ignore storage errors (private mode / quota exceeded)
  }
}

/**
 * Restore a previously saved session from localStorage.
 * @param {{ completed: Set<string>, inProgress: Set<string>, courses: Array }} state
 * @param {{ targetSemester: Element|null, targetSemester2: Element|null, targetSemester3: Element|null, maxRecs: Element|null, canTake: Element|null }} elements
 * @param {{ renderChipsCompleted: Function, renderChipsIp: Function }} callbacks
 */
export function restoreSession(state, elements, callbacks) {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (_) {
    return;
  }
  if (!raw) return;

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return;
  }

  const catalog = new Set(state.courses.map(c => c.course_code));
  const restoreCodes = (arr) =>
    (Array.isArray(arr) ? arr : []).filter(code => typeof code === "string" && catalog.has(code));

  const restoredCompleted = restoreCodes(parsed.completed);
  const restoredInProgress = restoreCodes(parsed.inProgress);

  // Do not replace Set objects: listeners hold references to these.
  state.completed.clear();
  state.inProgress.clear();
  restoredCompleted.forEach(code => state.completed.add(code));
  restoredInProgress
    .filter(code => !state.completed.has(code))
    .forEach(code => state.inProgress.add(code));

  callbacks.renderChipsCompleted();
  callbacks.renderChipsIp();

  if (elements.targetSemester && parsed.targetSemester) {
    const ok = Array.from(elements.targetSemester.options).some(o => o.value === parsed.targetSemester);
    if (ok) elements.targetSemester.value = parsed.targetSemester;
  }
  if (elements.targetSemester2 && parsed.targetSemester2 !== undefined) {
    const ok = Array.from(elements.targetSemester2.options).some(o => o.value === parsed.targetSemester2);
    if (ok) elements.targetSemester2.value = parsed.targetSemester2;
  }
  if (elements.targetSemester3 && parsed.targetSemester3 !== undefined) {
    const ok = Array.from(elements.targetSemester3.options).some(o => o.value === parsed.targetSemester3);
    if (ok) elements.targetSemester3.value = parsed.targetSemester3;
  }
  if (elements.maxRecs && parsed.maxRecs) {
    const ok = Array.from(elements.maxRecs.options).some(o => o.value === String(parsed.maxRecs));
    if (ok) elements.maxRecs.value = String(parsed.maxRecs);
  }
  if (elements.canTake && typeof parsed.canTake === "string") {
    elements.canTake.value = parsed.canTake;
  }
  if (elements.declaredMajors && Array.isArray(parsed.declaredMajors)) {
    const selected = new Set(parsed.declaredMajors.map(String));
    for (const option of Array.from(elements.declaredMajors.options || [])) {
      option.selected = selected.has(String(option.value));
    }
  }
  if (typeof elements.refreshProgramOptions === "function") {
    elements.refreshProgramOptions();
  }
  if (elements.declaredTrack && typeof parsed.declaredTrack === "string") {
    const ok = Array.from(elements.declaredTrack.options || []).some(
      o => String(o.value) === String(parsed.declaredTrack),
    );
    if (ok) elements.declaredTrack.value = parsed.declaredTrack;
  }
  if (typeof callbacks.restoreNavTab === "function") {
    const tabId = typeof parsed.activeNavTab === "string" ? parsed.activeNavTab : "nav-plan";
    callbacks.restoreNavTab(tabId);
  }
}
