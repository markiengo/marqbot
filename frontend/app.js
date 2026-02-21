import { esc } from "./modules/utils.js";
import { saveSession, restoreSession } from "./modules/session.js";
import { loadCourses, loadPrograms, postRecommend } from "./modules/api.js";
import {
  renderErrorHtml,
  renderCanTakeHtml,
  renderRecommendationsHtml,
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

/* -- Session refs ------------------------------------------------------ */
const sessionElements = {
  get targetSemester() { return document.getElementById("target-semester"); },
  get targetSemester2() { return document.getElementById("target-semester-2"); },
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
  resultsEl.innerHTML = "";
  resultsEl.classList.add("hidden");
}

/* -- Program selector helpers ----------------------------------------- */
function majorLabel(majorId) {
  const row = (state.programs.majors || []).find(m => m.major_id === majorId);
  if (!row) return majorId;
  return row.label;
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
    div.innerHTML = `<span><span class="opt-code">${esc(item.id)}</span><span class="opt-name">${esc(item.label)}</span></span>`;
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
  if (!q) return [];
  return options
    .filter(o => !excludeIds.has(o.id) && (
      o.id.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)
    ))
    .slice(0, 12);
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

  if (clear) clearResults();
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

  const hasMajorSelected = Array.from(declaredMajorsSelect?.selectedOptions || []).length > 0;
  if (!hasMajorSelected && (state.programs.majors || []).length > 0) {
    const defaultMajorId =
      state.programs.majors.find(m => m.major_id === state.programs.defaultTrackId)?.major_id
      || state.programs.majors.find(m => m.active !== false)?.major_id
      || state.programs.majors[0]?.major_id
      || "";
    if (defaultMajorId) {
      for (const opt of Array.from(declaredMajorsSelect.options)) {
        opt.selected = opt.value === defaultMajorId;
      }
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

  searchMajors?.addEventListener("input", () => {
    const options = (state.programs.majors || []).map(m => ({
      id: String(m.major_id),
      label: majorLabel(m.major_id),
    }));
    majorMatches = filterProgramOptions(searchMajors.value, options, state.selectedMajors);
    if (String(searchMajors.value || "").trim().length < 1) {
      closeProgramDropdowns();
      return;
    }
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
  });

  searchTrack?.addEventListener("input", () => {
    const options = getFilteredTracks().map(t => ({
      id: String(t.track_id),
      label: trackLabel(t.track_id),
    }));
    const exclude = state.selectedTrack ? new Set([state.selectedTrack]) : new Set();
    trackMatches = filterProgramOptions(searchTrack.value, options, exclude);
    if (String(searchTrack.value || "").trim().length < 1) {
      closeProgramDropdowns();
      return;
    }
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
    return;
  }
  if (data.mode === "can_take") {
    resultsEl.innerHTML = renderCanTakeHtml(data);
    return;
  }
  if (data.mode === "recommendations") {
    const requested = parseInt(sessionElements.maxRecs?.value || "3", 10);
    resultsEl.innerHTML = renderRecommendationsHtml(data, requested);
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

  restoreSession(state, sessionElements, {
    renderChipsCompleted: renderCompletedChips,
    renderChipsIp: renderIpChips,
  });
  refreshProgramOptions(false);

  sessionElements.targetSemester?.addEventListener("change", onSave);
  sessionElements.targetSemester2?.addEventListener("change", onSave);
  sessionElements.maxRecs?.addEventListener("change", onSave);
  canTakeInput?.addEventListener("input", onSave);
  window.addEventListener("beforeunload", onSave);
}

init();


