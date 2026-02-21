import { esc } from "./modules/utils.js";
import { saveSession, restoreSession } from "./modules/session.js";
import { loadCourses, loadPrograms, postRecommend, postCanTake } from "./modules/api.js";
import {
  renderErrorHtml,
  renderCanTakeHtml,
  renderRecommendationsHtml,
  renderProgressRing,
  renderKpiCardsHtml,
  renderDegreeSummaryHtml,
  renderCanTakeInlineHtml,
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

/* -- Session refs ------------------------------------------------------ */
const sessionElements = {
  get targetSemester() { return document.getElementById("target-semester"); },
  get targetSemester2() { return document.getElementById("target-semester-2"); },
  get targetSemester3() { return document.getElementById("target-semester-3"); },
  get maxRecs() { return document.getElementById("max-recs"); },
  get canTake() { return canTakeInput; },
  get declaredMajors() { return declaredMajorsSelect; },
  get declaredTrack() { return declaredTrackSelect; },
  get refreshProgramOptions() { return () => refreshProgramOptions(false); },
};

/* -- Course chip helpers ---------------------------------------------- */
function renderCompletedChips() {
  renderChips(chipsCompleted, state.completed, code =>
    removeChip(code, state.completed, chipsCompleted, renderCompletedChips, onSave),
  );
  updateStepIndicator();
}

function renderIpChips() {
  renderChips(chipsIp, state.inProgress, code =>
    removeChip(code, state.inProgress, chipsIp, renderIpChips, onSave),
  );
  updateStepIndicator();
}

function onSave() {
  saveSession(state, sessionElements);
}

function clearResults() {
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

  // Show/hide track section based on whether the selected major(s) have tracks.
  const noTracksAvailable = state.selectedMajors.size > 0 && filteredTracks.length === 0;
  if (searchTrack) {
    searchTrack.disabled = noTracksAvailable;
    searchTrack.placeholder = noTracksAvailable
      ? "No concentrations for selected major(s)"
      : "Search tracks...";
  }
  if (trackFormGroup) {
    trackFormGroup.classList.toggle("track-unavailable", noTracksAvailable);
  }

  renderMajorChips();
  renderTrackChip();
  updateStepIndicator();

  if (clear) clearResults();
}

/* -- Step indicator --------------------------------------------------- */
function updateStepIndicator() {
  const step1Done = state.selectedMajors.size > 0;
  const step2Done = state.completed.size > 0 || state.inProgress.size > 0;
  const step3Done = resultsEl && !resultsEl.classList.contains("hidden") && resultsEl.innerHTML.trim() !== "";

  const steps = [step1Done, step2Done, step3Done];
  const indicators = document.querySelectorAll("#step-indicator .step");
  indicators.forEach((el, idx) => {
    el.classList.toggle("step--done", steps[idx]);
    el.classList.toggle("step--pending", !steps[idx]);
  });
}

/* -- Anchor navigation ------------------------------------------------- */
function setupAnchorNav() {
  const navItems = Array.from(document.querySelectorAll(".anchor-link"));
  const navIndicator = document.getElementById("nav-pill-indicator");
  const panelCenter = document.getElementById("panel-center");
  const navOrder = ["#section-progress", "#section-recommendations"];
  let currentInternalHref = "#section-progress";
  let activeNavEl = null;

  const playPanelSwipe = (fromHref, toHref) => {
    if (!panelCenter) return;
    const fromIdx = navOrder.indexOf(fromHref);
    const toIdx = navOrder.indexOf(toHref);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const cls = toIdx > fromIdx ? "panel-swipe-forward" : "panel-swipe-backward";
    panelCenter.classList.remove("panel-swipe-forward", "panel-swipe-backward");
    // Restart animation cleanly on repeated clicks.
    void panelCenter.offsetWidth;
    panelCenter.classList.add(cls);
      panelCenter.addEventListener("animationend", () => {
        panelCenter.classList.remove("panel-swipe-forward", "panel-swipe-backward");
      }, { once: true });
  };

  const moveNavIndicator = (el) => {
    if (!navIndicator) return;
    if (!el) {
      navIndicator.style.opacity = "0";
      navIndicator.style.width = "0px";
      return;
    }
    navIndicator.style.opacity = "1";
    navIndicator.style.width = `${el.offsetWidth}px`;
    navIndicator.style.transform = `translateX(${el.offsetLeft}px)`;
  };

  const setActiveNav = (el) => {
    activeNavEl = el || null;
    navItems.forEach((item) => item.classList.toggle("anchor-active", item === activeNavEl));
    moveNavIndicator(activeNavEl);
  };

  const navByHref = (href) =>
    navItems.find((item) => item.tagName === "A" && item.getAttribute("href") === href) || null;

  navItems.forEach(item => {
    item.addEventListener("click", e => {
      const href = item.tagName === "A" ? (item.getAttribute("href") || "") : "";
      const isInternal = href.startsWith("#");

      // Persistent active state: keep clicked nav item highlighted until another nav click.
      setActiveNav(item);

      if (isInternal) {
        e.preventDefault();
        playPanelSwipe(currentInternalHref, href);
        const targetId = href.slice(1);
        const target = targetId ? document.getElementById(targetId) : null;
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        currentInternalHref = href;
      }
    });
  });

  window.addEventListener("resize", () => {
    moveNavIndicator(activeNavEl);
  });

  const initial = navByHref("#section-progress");
  if (initial) setActiveNav(initial);
}

/* -- Progress dashboard ------------------------------------------------ */
function populateProgressDashboard(data) {
  if (!data.current_progress) return;

  // Aggregate totals
  let totalDone = 0;
  let totalInProg = 0;
  let totalNeeded = 0;
  for (const prog of Object.values(data.current_progress)) {
    totalDone += Number(prog.completed_done || 0);
    totalInProg += Number(prog.in_progress_increment || 0);
    totalNeeded += Number(prog.needed || 0);
  }
  const totalRemaining = Math.max(0, totalNeeded - totalDone - totalInProg);
  const totalUnits = totalDone + totalInProg + totalRemaining;
  const donePct = totalUnits > 0 ? Math.min(100, (totalDone / totalUnits) * 100) : 0;
  const inProgressPct = totalUnits > 0 ? Math.min(100, (totalInProg / totalUnits) * 100) : 0;
  const overallPct = totalUnits > 0 ? Math.min(100, ((totalDone + totalInProg) / totalUnits) * 100) : 0;

  const dashEl = document.getElementById("progress-dashboard");
  const ringWrap = document.getElementById("progress-ring-wrap");
  const kpiRow = document.getElementById("kpi-row");

  if (ringWrap) ringWrap.innerHTML = renderProgressRing(donePct, 100, 10, inProgressPct, overallPct);
  if (kpiRow) kpiRow.innerHTML = renderKpiCardsHtml(totalDone, totalRemaining, totalInProg);
  if (dashEl) dashEl.classList.remove("hidden");

  // Right-panel summary
  const rightSummary = document.getElementById("right-summary");
  const rightSummaryContent = document.getElementById("right-summary-content");
  if (rightSummaryContent) {
    rightSummaryContent.innerHTML = renderDegreeSummaryHtml(data.current_progress);
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
      target_semester: document.getElementById("target-semester")?.value || "Spring 2026",
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

/* -- Result dispatcher ------------------------------------------------- */
function renderResults(data) {
  resultsEl.innerHTML = "";
  resultsEl.classList.remove("hidden");

  if (data.mode === "error") {
    resultsEl.innerHTML = renderErrorHtml(data.error?.message || "An error occurred.", data.error);
    updateStepIndicator();
    return;
  }
  if (data.mode === "can_take") {
    resultsEl.innerHTML = renderCanTakeHtml(data);
    updateStepIndicator();
    return;
  }
  if (data.mode === "recommendations") {
    const requested = parseInt(sessionElements.maxRecs?.value || "3", 10);
    resultsEl.innerHTML = renderRecommendationsHtml(data, requested);
    populateProgressDashboard(data);
    updateStepIndicator();
    // Auto-scroll to progress dashboard after render
    requestAnimationFrame(() => {
      const progressEl = document.getElementById("section-progress");
      if (progressEl) progressEl.scrollIntoView({ behavior: "smooth" });
    });
  }
}

/* -- Form submit ------------------------------------------------------- */
form.addEventListener("submit", async e => {
  e.preventDefault();
  onSave();

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Analyzing…`;
  clearResults();

  const selectedMajors = getSelectedMajorIds();
  const selectedTrack = state.selectedTrack;

  const payload = {
    completed_courses: [...state.completed].join(", "),
    in_progress_courses: [...state.inProgress].join(", "),
    target_semester: sessionElements.targetSemester.value,
    target_semester_primary: sessionElements.targetSemester.value,
    target_semester_secondary: sessionElements.targetSemester2.value || null,
    target_semester_tertiary: sessionElements.targetSemester3.value || null,
    requested_course: canTakeInput.value.trim() || null,
    max_recommendations: parseInt(sessionElements.maxRecs.value, 10),
  };

  if (selectedMajors.length > 0) {
    payload.declared_majors = selectedMajors;
    payload.track_id = selectedTrack || null;
  } else if (selectedTrack) {
    payload.track_id = selectedTrack;
  }

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
  setupAnchorNav();
  setupCanTakeStandalone();

  restoreSession(state, sessionElements, {
    renderChipsCompleted: renderCompletedChips,
    renderChipsIp: renderIpChips,
  });
  refreshProgramOptions(false);
  updateStepIndicator();

  sessionElements.targetSemester?.addEventListener("change", onSave);
  sessionElements.targetSemester2?.addEventListener("change", onSave);
  sessionElements.targetSemester3?.addEventListener("change", onSave);
  sessionElements.maxRecs?.addEventListener("change", onSave);
  canTakeInput?.addEventListener("input", onSave);
  window.addEventListener("beforeunload", onSave);
}

init();
