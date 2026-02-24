import { esc } from "./modules/utils.js";
import { saveSession, restoreSession } from "./modules/session.js";
import { loadCourses, loadPrograms, postRecommend, postCanTake, postFeedback } from "./modules/api.js";
import {
  renderErrorHtml,
  renderCanTakeHtml,
  renderCurrentProgressHtml,
  renderSemesterSelectorHtml,
  renderSemesterPreviewHtml,
  getProgramLabelMap,
  renderProgressRing,
  renderKpiCardsHtml,
  buildCourseCreditMap,
  sumCreditsForCourseCodes,
  computeCreditKpiMetrics,
  renderDegreeSummaryHtml,
  renderCanTakeInlineHtml,
  renderSemesterHtml,
} from "./modules/rendering.js";
import {
  renderChips,
  addChip,
  removeChip,
  setupMultiselect,
  setupSingleSelectInput,
  setupPasteFallback,
  closeDropdowns,
} from "./modules/multiselect.js";

/* -- State ------------------------------------------------------------- */
const state = {
  courses: [],
  programs: { majors: [], tracks: [], defaultTrackId: "FIN_MAJOR" },
  completed: new Set(),
  inProgress: new Set(),
  selectedMajors: new Set(),
  selectedTrack: null,
  activeNavTab: "nav-plan",
  selectedSemesterIndex: 0,
  lastRecommendationData: null,
  lastRequestedCount: 3,
  modalTriggerEl: null,
};

/* -- DOM refs ---------------------------------------------------------- */
const form = document.getElementById("advisor-form");
const submitBtn = document.getElementById("submit-btn");
const resultsEl = document.getElementById("results");

const searchCompleted = document.getElementById("search-completed");
const dropdownCompleted = document.getElementById("dropdown-completed");
const chipsCompleted = document.getElementById("chips-completed");

const searchIp = document.getElementById("search-ip");
const dropdownIp = document.getElementById("dropdown-ip");
const chipsIp = document.getElementById("chips-ip");

const canTakeInput = document.getElementById("can-take-input");
const dropdownCanTake = document.getElementById("dropdown-can-take");

const declaredMajorsSelect = document.getElementById("declared-majors");
const declaredTrackSelect = document.getElementById("declared-track");

const searchMajors = document.getElementById("search-majors");
const dropdownMajors = document.getElementById("dropdown-majors");
const chipsMajors = document.getElementById("chips-majors");

const searchTrack = document.getElementById("search-track");
const dropdownTrack = document.getElementById("dropdown-track");
const chipsTrack = document.getElementById("chips-track");
const trackFormGroup = document.getElementById("track-form-group");
const majorFormGroup = document.getElementById("major-form-group");
const appShell = document.getElementById("app-shell");
const placeholderScreens = Array.from(document.querySelectorAll(".placeholder-screen"));
const semesterModal = document.getElementById("semester-modal");
const semesterModalBody = document.getElementById("semester-modal-body");
const semesterModalTitle = document.getElementById("semester-modal-title");
const semesterModalCloseBtn = document.getElementById("semester-modal-close");
const progressExpandBtn = document.getElementById("progress-expand");

/* -- Session refs ------------------------------------------------------ */
const sessionElements = {
  get targetSemester() { return document.getElementById("target-semester"); },
  get semesterCount() { return document.getElementById("semester-count"); },
  get maxRecs() { return document.getElementById("max-recs"); },
  get canTake() { return canTakeInput; },
  get declaredMajors() { return declaredMajorsSelect; },
  get declaredTrack() { return declaredTrackSelect; },
  get refreshProgramOptions() { return () => refreshProgramOptions(false); },
  getActiveNavTab() { return state.activeNavTab || "nav-plan"; },
};

/* -- Course chip helpers ---------------------------------------------- */
function renderCompletedChips() {
  renderChips(chipsCompleted, state.completed, code =>
    removeChip(code, state.completed, chipsCompleted, renderCompletedChips, onSave),
  );
}

function renderIpChips() {
  renderChips(chipsIp, state.inProgress, code =>
    removeChip(code, state.inProgress, chipsIp, renderIpChips, onSave),
  );
}

function onSave() {
  saveSession(state, sessionElements);
}

function clearResults() {
  closeSemesterModal();
  state.lastRecommendationData = null;
  state.selectedSemesterIndex = 0;
  if (progressExpandBtn) progressExpandBtn.disabled = true;

  resultsEl.innerHTML = "";
  resultsEl.classList.add("hidden");
  // Also reset progress dashboard and right-panel summary
  const progressDash = document.getElementById("progress-dashboard");
  if (progressDash) progressDash.classList.add("hidden");
  const ringWrap = document.getElementById("progress-ring-wrap");
  if (ringWrap) ringWrap.innerHTML = "";
  const kpiRow = document.getElementById("kpi-row");
  if (kpiRow) kpiRow.innerHTML = "";
  const rightSummary = document.getElementById("right-summary");
  if (rightSummary) rightSummary.classList.add("hidden");
  const rightSummaryContent = document.getElementById("right-summary-content");
  if (rightSummaryContent) rightSummaryContent.innerHTML = "";
  const canTakeResult = document.getElementById("can-take-result");
  if (canTakeResult) {
    canTakeResult.innerHTML = "";
    canTakeResult.classList.add("hidden");
  }
}

function getPrimaryTargetSemester() {
  const selectEl = sessionElements.targetSemester;
  if (!selectEl) return "Spring 2026";
  const raw = String(selectEl.value || "").trim();
  if (raw) return raw;
  const fallback = Array.from(selectEl.options || [])
    .map(opt => String(opt.value || "").trim())
    .find(Boolean);
  return fallback || "Spring 2026";
}

function getTargetSemesterCount() {
  const selectEl = sessionElements.semesterCount;
  const raw = Number.parseInt(String(selectEl?.value || "3"), 10);
  if (!Number.isFinite(raw)) return 3;
  return Math.min(4, Math.max(1, raw));
}

/* -- Program selector helpers ----------------------------------------- */
function majorLabel(majorId) {
  const row = (state.programs.majors || []).find(m => m.major_id === majorId);
  if (!row) return majorId;
  return row.label;
}

function majorDropdownLabel(majorId, fallbackLabel = "") {
  const id = String(majorId || "").trim().toUpperCase();
  const mapped = {
    ACCO_MAJOR: "Accounting Major",
    AIM_MAJOR: "Accelerating Ingenuity in Markets Major",
    BUAN_MAJOR: "Business Analytics Major",
    FIN_MAJOR: "Finance Major",
    HURE_MAJOR: "Human Resources Major",
    INSY_MAJOR: "Information Systems Major",
    OSCM_MAJOR: "Operations and Supply Chain Major",
  }[id];
  return mapped || String(fallbackLabel || majorId || "").trim();
}

function trackLabel(trackId) {
  const row = (state.programs.tracks || []).find(t => t.track_id === trackId);
  if (!row) return trackId;
  return row.label;
}

function clampIndex(idx, length) {
  if (length <= 0) return -1;
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

function setActiveProgramOption(dropdownEl, activeIndex) {
  const options = Array.from(dropdownEl.querySelectorAll(".ms-option"));
  options.forEach((opt, idx) => opt.classList.toggle("active", idx === activeIndex));
  const activeEl = options[activeIndex];
  if (activeEl && typeof activeEl.scrollIntoView === "function") {
    activeEl.scrollIntoView({ block: "nearest" });
  }
}

function renderProgramDropdown(dropdownEl, items, onSelect, activeIndex = 0) {
  dropdownEl.innerHTML = "";
  if (!items.length) {
    dropdownEl.innerHTML = `<div class="ms-option-empty">No results</div>`;
    dropdownEl.classList.add("open");
    return;
  }
  const safeActive = clampIndex(activeIndex, items.length);
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = `ms-option${idx === safeActive ? " active" : ""}`;
    if (item.hideCode) {
      div.innerHTML = `<span class="opt-name-only">${esc(item.label)}</span>`;
    } else {
      div.innerHTML = `<span><span class="opt-code">${esc(item.id)}</span><span class="opt-name">${esc(item.label)}</span></span>`;
    }
    div.addEventListener("mousedown", e => {
      e.preventDefault();
      onSelect(item);
    });
    dropdownEl.appendChild(div);
  });
  dropdownEl.classList.add("open");
  setActiveProgramOption(dropdownEl, safeActive);
}

function filterProgramOptions(query, options, excludeIds = new Set()) {
  const q = String(query || "").trim().toLowerCase();
  const filtered = options
    .filter(o => !excludeIds.has(o.id) && (
      !q || o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    ))
    .sort((a, b) => {
      const byId = String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: "base" });
      if (byId !== 0) return byId;
      return String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" });
    });
  return filtered;
}

function syncStateFromHiddenSelectors() {
  const majorIds = Array.from(declaredMajorsSelect?.selectedOptions || [])
    .map(o => String(o.value || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  state.selectedMajors = new Set(majorIds);

  const trackId = String(declaredTrackSelect?.value || "").trim();
  state.selectedTrack = trackId || null;
}

function syncHiddenMajorsFromState() {
  for (const opt of Array.from(declaredMajorsSelect?.options || [])) {
    opt.selected = state.selectedMajors.has(String(opt.value));
  }
}

function getFilteredTracks() {
  const tracks = state.programs.tracks || [];
  if (state.selectedMajors.size === 0) {
    return tracks;
  }
  return tracks.filter(t => {
    const parent = String(t.parent_major_id || "").trim();
    return !parent || state.selectedMajors.has(parent);
  });
}

function rebuildHiddenTrackSelect(filteredTracks) {
  if (!declaredTrackSelect) return;

  const previous = state.selectedTrack;
  declaredTrackSelect.innerHTML = `<option value="">None</option>`;
  for (const t of filteredTracks) {
    const opt = document.createElement("option");
    opt.value = t.track_id;
    opt.textContent = trackLabel(t.track_id);
    declaredTrackSelect.appendChild(opt);
  }

  if (previous && filteredTracks.some(t => t.track_id === previous)) {
    declaredTrackSelect.value = previous;
    state.selectedTrack = previous;
  } else {
    declaredTrackSelect.value = "";
    state.selectedTrack = null;
  }
}

function renderMajorChips() {
  chipsMajors.innerHTML = "";
  for (const majorId of state.selectedMajors) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${esc(majorLabel(majorId))}<button class="chip-remove" title="Remove">x</button>`;
    chip.querySelector(".chip-remove")?.addEventListener("click", () => {
      state.selectedMajors.delete(majorId);
      syncHiddenMajorsFromState();
      refreshProgramOptions(true);
      onSave();
    });
    chipsMajors.appendChild(chip);
  }
}

function renderTrackChip() {
  chipsTrack.innerHTML = "";
  if (!state.selectedTrack) return;
  const chip = document.createElement("span");
  chip.className = "chip";
  chip.innerHTML = `${esc(trackLabel(state.selectedTrack))}<button class="chip-remove" title="Remove">x</button>`;
  chip.querySelector(".chip-remove")?.addEventListener("click", () => {
    state.selectedTrack = null;
    if (declaredTrackSelect) declaredTrackSelect.value = "";
    renderTrackChip();
    clearResults();
    onSave();
  });
  chipsTrack.appendChild(chip);
}

function refreshProgramOptions(clear = false) {
  syncStateFromHiddenSelectors();

  if (state.selectedMajors.size > 2) {
    state.selectedMajors = new Set(Array.from(state.selectedMajors).slice(0, 2));
    syncHiddenMajorsFromState();
  }

  const filteredTracks = getFilteredTracks();
  if (state.selectedTrack && !filteredTracks.some(t => t.track_id === state.selectedTrack)) {
    state.selectedTrack = null;
  }

  rebuildHiddenTrackSelect(filteredTracks);

  // Enforce double-major limit: disable major input when 2 are already selected.
  const majorLimitReached = state.selectedMajors.size >= 2;
  if (searchMajors) {
    searchMajors.disabled = majorLimitReached;
    searchMajors.placeholder = majorLimitReached
      ? "Double major limit reached"
      : "Search majors...";
  }
  if (majorFormGroup) {
    majorFormGroup.classList.toggle("major-limit-reached", majorLimitReached);
  }

  // Disable track input when no major is selected, or when selected major(s) have no tracks.
  const noMajorSelected = state.selectedMajors.size === 0;
  const noTracksAvailable = state.selectedMajors.size > 0 && filteredTracks.length === 0;
  const trackDisabled = noMajorSelected || noTracksAvailable;
  if (searchTrack) {
    searchTrack.disabled = trackDisabled;
    searchTrack.placeholder = noMajorSelected
      ? "Select a major first"
      : noTracksAvailable
        ? "No concentrations for selected major(s)"
        : "Search tracks...";
  }
  if (trackFormGroup) {
    trackFormGroup.classList.toggle("track-unavailable", trackDisabled);
  }

  renderMajorChips();
  renderTrackChip();

  if (clear) clearResults();
}

/* -- Navigation and modal --------------------------------------------- */
const NAV_ORDER = [
  "nav-home",
  "nav-plan",
  "nav-courses",
  "nav-saved",
  "nav-ai-advisor",
  "nav-avatar",
];

const PLACEHOLDER_MAP = {
  "nav-home": "placeholder-home",
  "nav-courses": "placeholder-courses",
  "nav-saved": "placeholder-saved",
  "nav-ai-advisor": "placeholder-ai",
  "nav-avatar": "placeholder-avatar",
};

function getNavIndex(navId) {
  return NAV_ORDER.indexOf(navId);
}

function applyDirectionalTransition(targetEl, direction) {
  if (!targetEl) return;
  targetEl.classList.remove("transition-up", "transition-down");
  void targetEl.offsetWidth;
  targetEl.classList.add(direction === "down" ? "transition-down" : "transition-up");
  window.setTimeout(() => {
    targetEl.classList.remove("transition-up", "transition-down");
  }, 340);
}

function hideAllPlaceholders() {
  placeholderScreens.forEach((screen) => {
    screen.classList.remove("active", "transition-up", "transition-down");
  });
}

function showAppShell(direction) {
  document.body.classList.remove("placeholder-mode");
  hideAllPlaceholders();
  if (appShell) {
    appShell.classList.remove("app-shell-hidden");
    applyDirectionalTransition(appShell, direction);
  }
}

function showPlaceholder(screenId, direction) {
  const screen = document.getElementById(screenId);
  if (!screen) return;
  document.body.classList.add("placeholder-mode");
  if (appShell) appShell.classList.add("app-shell-hidden");
  hideAllPlaceholders();
  screen.classList.add("active");
  applyDirectionalTransition(screen, direction);
}

function closeSemesterModal() {
  if (!semesterModal) return;
  semesterModal.classList.remove("is-open");
  semesterModal.setAttribute("aria-hidden", "true");
  if (semesterModalBody) semesterModalBody.innerHTML = "";

  if (state.modalTriggerEl && typeof state.modalTriggerEl.focus === "function") {
    state.modalTriggerEl.focus();
  }
  state.modalTriggerEl = null;
}

function openModalContent(title, html, triggerEl = null) {
  if (!semesterModal) return;
  if (semesterModalTitle) semesterModalTitle.textContent = title;
  if (semesterModalBody) semesterModalBody.innerHTML = html || "";
  state.modalTriggerEl = triggerEl;
  semesterModal.classList.add("is-open");
  semesterModal.setAttribute("aria-hidden", "false");

  const focusables = getFocusableElements(semesterModal.querySelector(".semester-modal-card"));
  if (focusables.length) {
    focusables[0].focus();
  } else if (semesterModalCloseBtn) {
    semesterModalCloseBtn.focus();
  }
}

function getFocusableElements(rootEl) {
  if (!rootEl) return [];
  const selectors = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ];
  return Array.from(rootEl.querySelectorAll(selectors.join(",")))
    .filter((el) => !el.hasAttribute("hidden"));
}

function onModalKeydown(e) {
  if (!semesterModal || !semesterModal.classList.contains("is-open")) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeSemesterModal();
    return;
  }
  if (e.key !== "Tab") return;

  const card = semesterModal.querySelector(".semester-modal-card");
  const focusables = getFocusableElements(card);
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function openSemesterModal(semesterIdx, triggerEl = null) {
  if (!semesterModal || !state.lastRecommendationData) return;
  const semesters = Array.isArray(state.lastRecommendationData.semesters) && state.lastRecommendationData.semesters.length
    ? state.lastRecommendationData.semesters
    : [state.lastRecommendationData];
  const safeIndex = clampIndex(semesterIdx, semesters.length);
  if (safeIndex < 0) return;

  const requested = Number.isFinite(state.lastRequestedCount) ? state.lastRequestedCount : 3;
  const programLabelMap = getProgramLabelMap(state.lastRecommendationData.selection_context);
  const semester = semesters[safeIndex];
  const termLabel = semester?.target_semester ? ` - ${semester.target_semester}` : "";
  openModalContent(
    `Semester ${safeIndex + 1}${termLabel}`,
    renderSemesterHtml(semester, safeIndex + 1, requested, { programLabelMap }),
    triggerEl,
  );
}

function openProgressModal(triggerEl = null) {
  if (!state.lastRecommendationData) return;
  const data = state.lastRecommendationData;
  const programLabelMap = getProgramLabelMap(data.selection_context);
  const progressHtml = renderCurrentProgressHtml(
    data.current_progress || {},
    data.current_assumption_notes || [],
    programLabelMap,
    {},
  );
  const fullHtml = `
    <div class="dashboard-modal-content">
      ${progressHtml}
    </div>
  `;
  openModalContent("Degree Progress", fullHtml, triggerEl);
}

function wireSemesterInteractions() {
  const selectorRoot = resultsEl.querySelector("#semester-selector");
  const detailPane = resultsEl.querySelector("#semester-detail-pane");
  if (!selectorRoot || !detailPane || !state.lastRecommendationData) return;

  const semesterData = Array.isArray(state.lastRecommendationData.semesters) && state.lastRecommendationData.semesters.length
    ? state.lastRecommendationData.semesters
    : [state.lastRecommendationData];

  const updateSelectedSemester = (newIndex, options = {}) => {
    const safe = clampIndex(newIndex, semesterData.length);
    if (safe < 0) return;
    state.selectedSemesterIndex = safe;

    const tabs = Array.from(selectorRoot.querySelectorAll(".semester-tab"));
    tabs.forEach((tab, idx) => {
      const selected = idx === safe;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", selected ? "true" : "false");
      tab.tabIndex = selected ? 0 : -1;
    });

    detailPane.innerHTML = renderSemesterPreviewHtml(semesterData[safe], safe + 1);

    if (options.focusTab) {
      const active = tabs[safe];
      if (active && typeof active.focus === "function") active.focus();
    }
  };

  selectorRoot.querySelectorAll(".semester-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      updateSelectedSemester(Number(btn.dataset.semesterIndex || "0"));
    });
    btn.addEventListener("keydown", (e) => {
      const current = Number(btn.dataset.semesterIndex || "0");
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        updateSelectedSemester((current + 1) % semesterData.length, { focusTab: true });
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        updateSelectedSemester((current - 1 + semesterData.length) % semesterData.length, { focusTab: true });
      } else if (e.key === "Home") {
        e.preventDefault();
        updateSelectedSemester(0, { focusTab: true });
      } else if (e.key === "End") {
        e.preventDefault();
        updateSelectedSemester(semesterData.length - 1, { focusTab: true });
      }
    });
  });

  selectorRoot.querySelectorAll("[data-semester-expand]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.semesterExpand || "0");
      openSemesterModal(idx, btn);
    });
  });

  updateSelectedSemester(state.selectedSemesterIndex);
}

function setupModalBindings() {
  if (!semesterModal) return;
  semesterModal.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.modalClose === "backdrop") {
      closeSemesterModal();
    }
  });
  semesterModalCloseBtn?.addEventListener("click", closeSemesterModal);
  progressExpandBtn?.addEventListener("click", () => {
    if (progressExpandBtn.disabled) return;
    openProgressModal(progressExpandBtn);
  });
  document.addEventListener("keydown", onModalKeydown);
}

function setupRailNavigation() {
  const navItems = NAV_ORDER
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const setActiveNavById = (navId, opts = {}) => {
    const targetId = NAV_ORDER.includes(navId) ? navId : "nav-plan";
    const previous = state.activeNavTab || "nav-plan";
    const previousIndex = getNavIndex(previous);
    const nextIndex = getNavIndex(targetId);
    const direction = opts.direction || (nextIndex >= previousIndex ? "up" : "down");
    state.activeNavTab = targetId;

    navItems.forEach((item) => {
      const isActive = item.id === targetId;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-selected", isActive ? "true" : "false");
      item.tabIndex = isActive ? 0 : -1;
    });

    const placeholderId = PLACEHOLDER_MAP[targetId];
    if (placeholderId) {
      showPlaceholder(placeholderId, direction);
    } else {
      showAppShell(direction);
    }

    if (opts.persist !== false) onSave();
  };

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      setActiveNavById(item.id);
    });
    item.addEventListener("keydown", (e) => {
      const currentIndex = NAV_ORDER.indexOf(item.id);
      if (currentIndex < 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = NAV_ORDER[(currentIndex + 1) % NAV_ORDER.length];
        const nextEl = document.getElementById(next);
        if (nextEl) nextEl.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = NAV_ORDER[(currentIndex - 1 + NAV_ORDER.length) % NAV_ORDER.length];
        const prevEl = document.getElementById(prev);
        if (prevEl) prevEl.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = document.getElementById(NAV_ORDER[0]);
        if (first) first.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        const last = document.getElementById(NAV_ORDER[NAV_ORDER.length - 1]);
        if (last) last.focus();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActiveNavById(item.id);
      }
    });
  });

  setActiveNavById(state.activeNavTab, { persist: false, direction: "up" });
  return { setActiveNavById };
}

/* -- Progress dashboard ------------------------------------------------ */
function populateProgressDashboard(data) {
  if (!data.current_progress) return;

  // KPI metrics are credit-based from user-entered course chips only.
  const creditMap = buildCourseCreditMap(state.courses);
  const completedCredits = sumCreditsForCourseCodes(state.completed, creditMap);
  const inProgressCredits = sumCreditsForCourseCodes(state.inProgress, creditMap);
  const creditKpis = computeCreditKpiMetrics(completedCredits, inProgressCredits);

  const dashEl = document.getElementById("progress-dashboard");
  const ringWrap = document.getElementById("progress-ring-wrap");
  const kpiRow = document.getElementById("kpi-row");
  const programLabelMap = getProgramLabelMap(data.selection_context);

  if (ringWrap) {
    ringWrap.innerHTML = renderProgressRing(
      creditKpis.donePercent,
      72,
      8,
      creditKpis.inProgressPercent,
      creditKpis.overallPercent,
    );
  }
  if (kpiRow) {
    kpiRow.innerHTML = renderKpiCardsHtml(creditKpis);
  }
  if (dashEl) dashEl.classList.remove("hidden");

  // Upper-right degree summary (moved from settings pane)
  const rightSummary = document.getElementById("right-summary");
  const rightSummaryContent = document.getElementById("right-summary-content");
  if (rightSummaryContent) {
    rightSummaryContent.innerHTML = renderDegreeSummaryHtml(
      data.current_progress,
      programLabelMap,
    );
  }
  if (rightSummary) rightSummary.classList.remove("hidden");
}

/* -- Standalone can-take handler --------------------------------------- */
function setupCanTakeStandalone() {
  const canTakeInputEl = document.getElementById("can-take-input");
  const canTakeResultEl = document.getElementById("can-take-result");
  if (!canTakeInputEl || !canTakeResultEl) return;

  canTakeInputEl.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;
    // Prevent full form submission
    e.preventDefault();
    e.stopPropagation();

    const requestedCourse = canTakeInputEl.value.trim();
    if (!requestedCourse) return;

    canTakeResultEl.innerHTML = `<div style="color:var(--ink-500);font-size:var(--text-xs);padding:4px 0;">Checking…</div>`;
    canTakeResultEl.classList.remove("hidden");

    const payload = {
      completed_courses: [...state.completed].join(", "),
      in_progress_courses: [...state.inProgress].join(", "),
      target_semester: getPrimaryTargetSemester(),
      requested_course: requestedCourse,
      declared_majors: [...state.selectedMajors],
      track_id: state.selectedTrack || null,
    };

    try {
      const data = await postCanTake(payload);
      canTakeResultEl.innerHTML = renderCanTakeInlineHtml(data);
    } catch (err) {
      canTakeResultEl.innerHTML = `<div class="can-take-inline can-take-inline--no" role="alert">
        <span class="ct-pill ct-pill--no">Error</span>
        <span class="ct-msg">Network error: ${esc(err.message)}</span>
      </div>`;
    }
    canTakeResultEl.classList.remove("hidden");
  });
}

function populateProgramSelectors(data) {
  state.programs = {
    majors: data.majors || [],
    tracks: data.tracks || [],
    defaultTrackId: data.default_track_id || "FIN_MAJOR",
  };

  if (declaredMajorsSelect) {
    declaredMajorsSelect.innerHTML = "";
    for (const major of state.programs.majors) {
      const opt = document.createElement("option");
      opt.value = major.major_id;
      opt.textContent = majorLabel(major.major_id);
      declaredMajorsSelect.appendChild(opt);
    }
  }

  refreshProgramOptions(false);
}

function setupProgramSelectors() {
  let majorMatches = [];
  let majorActiveIndex = -1;
  let trackMatches = [];
  let trackActiveIndex = -1;

  const closeProgramDropdowns = () => {
    majorMatches = [];
    majorActiveIndex = -1;
    trackMatches = [];
    trackActiveIndex = -1;
    closeDropdowns(dropdownMajors, dropdownTrack);
  };

  const selectActiveMajor = () => {
    if (majorActiveIndex < 0 || majorActiveIndex >= majorMatches.length) return;
    const item = majorMatches[majorActiveIndex];
    if (!state.selectedMajors.has(item.id) && state.selectedMajors.size >= 2) {
      return;
    }
    state.selectedMajors.add(item.id);
    syncHiddenMajorsFromState();
    refreshProgramOptions(true);
    onSave();
    searchMajors.value = "";
    closeProgramDropdowns();
    searchMajors.focus();
  };

  const selectActiveTrack = () => {
    if (trackActiveIndex < 0 || trackActiveIndex >= trackMatches.length) return;
    const item = trackMatches[trackActiveIndex];
    state.selectedTrack = item.id;
    if (declaredTrackSelect) declaredTrackSelect.value = item.id;
    renderTrackChip();
    clearResults();
    onSave();
    searchTrack.value = "";
    closeProgramDropdowns();
    searchTrack.focus();
  };

  const majorOptions = () => (state.programs.majors || []).map(m => ({
    id: String(m.major_id),
    label: majorDropdownLabel(m.major_id, majorLabel(m.major_id)),
    hideCode: true,
  }));

  const trackOptions = () => getFilteredTracks().map(t => ({
    id: String(t.track_id),
    label: trackLabel(t.track_id),
  }));

  const renderMajorMatches = query => {
    majorMatches = filterProgramOptions(query, majorOptions(), state.selectedMajors);
    majorActiveIndex = majorMatches.length ? 0 : -1;
    renderProgramDropdown(dropdownMajors, majorMatches, item => {
      if (!state.selectedMajors.has(item.id) && state.selectedMajors.size >= 2) {
        return;
      }
      state.selectedMajors.add(item.id);
      syncHiddenMajorsFromState();
      refreshProgramOptions(true);
      onSave();
      searchMajors.value = "";
      closeProgramDropdowns();
      searchMajors.focus();
    }, majorActiveIndex);
  };

  const renderTrackMatches = query => {
    const exclude = state.selectedTrack ? new Set([state.selectedTrack]) : new Set();
    trackMatches = filterProgramOptions(query, trackOptions(), exclude);
    trackActiveIndex = trackMatches.length ? 0 : -1;
    renderProgramDropdown(dropdownTrack, trackMatches, item => {
      state.selectedTrack = item.id;
      if (declaredTrackSelect) declaredTrackSelect.value = item.id;
      renderTrackChip();
      clearResults();
      onSave();
      searchTrack.value = "";
      closeProgramDropdowns();
      searchTrack.focus();
    }, trackActiveIndex);
  };

  searchMajors?.addEventListener("input", () => {
    renderMajorMatches(searchMajors.value);
  });

  searchMajors?.addEventListener("focus", () => {
    if (searchMajors.disabled) return;
    renderMajorMatches("");
  });

  searchTrack?.addEventListener("input", () => {
    renderTrackMatches(searchTrack.value);
  });

  searchTrack?.addEventListener("focus", () => {
    if (searchTrack.disabled) return;
    renderTrackMatches("");
  });

  searchMajors?.addEventListener("blur", () => setTimeout(closeProgramDropdowns, 150));
  searchTrack?.addEventListener("blur", () => setTimeout(closeProgramDropdowns, 150));

  searchMajors?.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && dropdownMajors?.classList.contains("open")) {
      e.preventDefault();
      majorActiveIndex = clampIndex(majorActiveIndex + 1, majorMatches.length);
      setActiveProgramOption(dropdownMajors, majorActiveIndex);
      return;
    }
    if (e.key === "ArrowUp" && dropdownMajors?.classList.contains("open")) {
      e.preventDefault();
      majorActiveIndex = clampIndex(majorActiveIndex - 1, majorMatches.length);
      setActiveProgramOption(dropdownMajors, majorActiveIndex);
      return;
    }
    if (e.key === "Enter" && dropdownMajors?.classList.contains("open")) {
      e.preventDefault();
      selectActiveMajor();
      return;
    }
    if (e.key === "Escape") {
      closeProgramDropdowns();
      searchMajors.value = "";
    }
  });
  searchTrack?.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && dropdownTrack?.classList.contains("open")) {
      e.preventDefault();
      trackActiveIndex = clampIndex(trackActiveIndex + 1, trackMatches.length);
      setActiveProgramOption(dropdownTrack, trackActiveIndex);
      return;
    }
    if (e.key === "ArrowUp" && dropdownTrack?.classList.contains("open")) {
      e.preventDefault();
      trackActiveIndex = clampIndex(trackActiveIndex - 1, trackMatches.length);
      setActiveProgramOption(dropdownTrack, trackActiveIndex);
      return;
    }
    if (e.key === "Enter" && dropdownTrack?.classList.contains("open")) {
      e.preventDefault();
      selectActiveTrack();
      return;
    }
    if (e.key === "Escape") {
      closeProgramDropdowns();
      searchTrack.value = "";
    }
  });
}

function getSelectedMajorIds() {
  return Array.from(state.selectedMajors);
}

/* -- Feedback handlers ------------------------------------------------- */
function generateSessionId() {
  const major = [...state.selectedMajors].sort().join(",");
  const completed = [...state.completed].sort().join(",");
  try {
    return btoa(major + completed).slice(0, 8);
  } catch (_) {
    return "anon";
  }
}

function wireFeedbackHandlers(container) {
  if (!container) return;
  const sessionId = generateSessionId();
  container.querySelectorAll(".feedback-strip").forEach(strip => {
    const course = strip.dataset.course;
    const semester = strip.dataset.semester;
    const rank = parseInt(strip.dataset.rank, 10) || 0;
    const tier = parseInt(strip.dataset.tier, 10) || 0;
    const fillsBuckets = String(strip.dataset.fills || "")
      .split(",")
      .map(v => String(v || "").trim())
      .filter(Boolean);
    strip.querySelectorAll(".fb-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (strip.classList.contains("fb-submitted")) return;
        const rating = btn.classList.contains("fb-up") ? 1 : -1;
        strip.classList.add("fb-submitted");
        strip.querySelectorAll(".fb-btn").forEach(b => { b.disabled = true; });
        postFeedback({
          course_code: course,
          semester,
          rating,
          rank,
          fills_buckets: fillsBuckets,
          tier,
          session_id: sessionId,
          major: [...state.selectedMajors][0] || "",
          track: state.selectedTrack || "",
        }).catch(() => {});
      });
    });
  });
}

/* -- Result dispatcher ------------------------------------------------- */
function renderResults(data) {
  state.lastRecommendationData = null;
  resultsEl.innerHTML = "";
  resultsEl.classList.remove("hidden");

  if (data.mode === "error") {
    resultsEl.innerHTML = renderErrorHtml(data.error?.message || "An error occurred.", data.error);
    return;
  }
  if (data.mode === "can_take") {
    resultsEl.innerHTML = renderCanTakeHtml(data);
    return;
  }
  if (data.mode === "recommendations") {
    state.lastRecommendationData = data;
    const parsedRequestedCount = parseInt(sessionElements.maxRecs?.value || "3", 10);
    state.lastRequestedCount = Number.isFinite(parsedRequestedCount)
      ? Math.min(6, Math.max(1, parsedRequestedCount))
      : 3;
    state.selectedSemesterIndex = 0;
    if (progressExpandBtn) progressExpandBtn.disabled = false;

    const semesters = Array.isArray(data.semesters) && data.semesters.length
      ? data.semesters
      : [data];
    const safeIdx = clampIndex(state.selectedSemesterIndex, semesters.length);
    state.selectedSemesterIndex = safeIdx < 0 ? 0 : safeIdx;
    const selected = semesters[state.selectedSemesterIndex] || semesters[0];
    const selectorHtml = renderSemesterSelectorHtml(semesters, state.selectedSemesterIndex);
    const detailHtml = selected
      ? renderSemesterPreviewHtml(selected, state.selectedSemesterIndex + 1)
      : `<div class="semester-preview-empty">No semester recommendations available.</div>`;
    const semesterCountClass = `recommendation-workspace--${Math.min(4, Math.max(1, semesters.length))}`;
    const densityClass = state.lastRequestedCount >= 6 ? "recommendation-workspace--dense" : "";

    resultsEl.innerHTML = `
      <div class="recommendation-workspace recommendation-workspace--preview ${semesterCountClass} ${densityClass}">
        <div class="recommendation-interactive">
          ${selectorHtml}
          <section id="semester-detail-pane" class="semester-detail-pane semester-detail-pane--preview${state.lastRequestedCount >= 6 ? " semester-detail-pane--dense" : ""}" aria-live="polite">${detailHtml}</section>
        </div>
      </div>
    `;
    wireSemesterInteractions();
    populateProgressDashboard(data);
    wireFeedbackHandlers(resultsEl);
  }
}

/* -- Form submit ------------------------------------------------------- */
form.addEventListener("submit", async e => {
  e.preventDefault();
  onSave();

  const selectedMajors = getSelectedMajorIds();
  const selectedTrack = state.selectedTrack;
  if (!selectedMajors.length) {
    clearResults();
    resultsEl.classList.remove("hidden");
    resultsEl.innerHTML = renderErrorHtml("Please select at least one declared major before requesting recommendations.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Analyzing…`;
  clearResults();

  const payload = {
    completed_courses: [...state.completed].join(", "),
    in_progress_courses: [...state.inProgress].join(", "),
    target_semester: getPrimaryTargetSemester(),
    target_semester_primary: getPrimaryTargetSemester(),
    target_semester_count: getTargetSemesterCount(),
    requested_course: canTakeInput.value.trim() || null,
    max_recommendations: (() => {
      const parsed = parseInt(sessionElements.maxRecs.value, 10);
      return Number.isFinite(parsed) ? Math.min(6, Math.max(1, parsed)) : 3;
    })(),
  };

  payload.declared_majors = selectedMajors;
  payload.track_id = selectedTrack || null;

  try {
    const data = await postRecommend(payload);
    renderResults(data);
  } catch (err) {
    resultsEl.classList.remove("hidden");
    resultsEl.innerHTML = renderErrorHtml(`Network error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Get Recommendations";
  }
});

/* -- Init -------------------------------------------------------------- */
async function init() {
  try {
    const data = await loadCourses();
    state.courses = data.courses || [];
  } catch (e) {
    console.warn("Could not load course list:", e);
  }

  try {
    const programs = await loadPrograms();
    populateProgramSelectors(programs || {});
  } catch (e) {
    console.warn("Could not load program catalog:", e);
  }

  const onCloseAll = () => closeDropdowns(dropdownCompleted, dropdownIp, dropdownCanTake);

  setupMultiselect(
    searchCompleted,
    dropdownCompleted,
    state.completed,
    state.courses,
    c => addChip(
      c.course_code,
      state.completed,
      chipsCompleted,
      state.inProgress,
      chipsIp,
      () => { renderCompletedChips(); renderIpChips(); },
      onSave,
    ),
    onCloseAll,
  );

  setupMultiselect(
    searchIp,
    dropdownIp,
    state.inProgress,
    state.courses,
    c => addChip(
      c.course_code,
      state.inProgress,
      chipsIp,
      state.completed,
      chipsCompleted,
      () => { renderIpChips(); renderCompletedChips(); },
      onSave,
    ),
    onCloseAll,
  );

  setupPasteFallback(
    "toggle-paste-completed", "paste-completed", "apply-paste-completed", "paste-errors-completed",
    state.completed, state.inProgress, state.courses,
    code => addChip(
      code,
      state.completed,
      chipsCompleted,
      state.inProgress,
      chipsIp,
      () => { renderCompletedChips(); renderIpChips(); },
      onSave,
    ),
    onCloseAll,
  );

  setupPasteFallback(
    "toggle-paste-ip", "paste-ip", "apply-paste-ip", "paste-errors-ip",
    state.inProgress, state.completed, state.courses,
    code => addChip(
      code,
      state.inProgress,
      chipsIp,
      state.completed,
      chipsCompleted,
      () => { renderIpChips(); renderCompletedChips(); },
      onSave,
    ),
    onCloseAll,
  );

  setupSingleSelectInput(
    canTakeInput,
    dropdownCanTake,
    state.courses,
    c => {
      canTakeInput.value = c.course_code;
      onSave();
    },
    onCloseAll,
  );

  setupProgramSelectors();
  const railApi = setupRailNavigation();
  setupModalBindings();
  setupCanTakeStandalone();

  restoreSession(state, sessionElements, {
    renderChipsCompleted: renderCompletedChips,
    renderChipsIp: renderIpChips,
    restoreNavTab: (tabId) => {
      railApi?.setActiveNavById?.(tabId, { persist: false });
    },
  });
  refreshProgramOptions(false);

  sessionElements.targetSemester?.addEventListener("change", onSave);
  sessionElements.semesterCount?.addEventListener("change", onSave);
  sessionElements.maxRecs?.addEventListener("change", onSave);
  canTakeInput?.addEventListener("input", onSave);
  window.addEventListener("beforeunload", onSave);
}

init();
