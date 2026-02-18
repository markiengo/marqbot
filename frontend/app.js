import { filterCourses } from "./modules/utils.js";
import { saveSession, restoreSession } from "./modules/session.js";
import { loadCourses, postRecommend } from "./modules/api.js";
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
  setupPasteFallback,
  closeDropdowns,
} from "./modules/multiselect.js";

/* ── State ───────────────────────────────────────────────────────────────── */
const state = {
  courses: [],
  completed: new Set(),
  inProgress: new Set(),
};

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const form            = document.getElementById("advisor-form");
const submitBtn       = document.getElementById("submit-btn");
const resultsEl       = document.getElementById("results");

const searchCompleted  = document.getElementById("search-completed");
const dropdownCompleted = document.getElementById("dropdown-completed");
const chipsCompleted   = document.getElementById("chips-completed");

const searchIp        = document.getElementById("search-ip");
const dropdownIp      = document.getElementById("dropdown-ip");
const chipsIp         = document.getElementById("chips-ip");

const canTakeInput    = document.getElementById("can-take-input");

/* ── Session element refs (passed to session helpers) ────────────────────── */
const sessionElements = {
  get targetSemester()  { return document.getElementById("target-semester"); },
  get targetSemester2() { return document.getElementById("target-semester-2"); },
  get maxRecs()         { return document.getElementById("max-recs"); },
  get canTake()         { return canTakeInput; },
};

/* ── Chip render helpers (bound to DOM) ──────────────────────────────────── */
function renderCompletedChips() {
  renderChips(chipsCompleted, state.completed, code =>
    removeChip(code, state.completed, chipsCompleted, renderCompletedChips, onSave)
  );
}

function renderIpChips() {
  renderChips(chipsIp, state.inProgress, code =>
    removeChip(code, state.inProgress, chipsIp, renderIpChips, onSave)
  );
}

function onSave() {
  saveSession(state, sessionElements);
}

/* ── Result dispatcher ───────────────────────────────────────────────────── */
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

/* ── Form submit ─────────────────────────────────────────────────────────── */
form.addEventListener("submit", async e => {
  e.preventDefault();
  onSave();

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Analyzing…`;
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";

  const payload = {
    completed_courses: [...state.completed].join(", "),
    in_progress_courses: [...state.inProgress].join(", "),
    target_semester: sessionElements.targetSemester.value,
    target_semester_primary: sessionElements.targetSemester.value,
    target_semester_secondary: sessionElements.targetSemester2.value || null,
    requested_course: canTakeInput.value.trim() || null,
    max_recommendations: parseInt(sessionElements.maxRecs.value),
  };

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

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  try {
    const data = await loadCourses();
    state.courses = data.courses || [];
  } catch (e) {
    console.warn("Could not load course list:", e);
  }

  const onCloseAll = () => closeDropdowns(dropdownCompleted, dropdownIp);

  setupMultiselect(
    searchCompleted, dropdownCompleted,
    state.completed, state.courses,
    c => addChip(c.course_code, state.completed, chipsCompleted, state.inProgress, chipsIp,
      () => { renderCompletedChips(); renderIpChips(); }, onSave),
    onCloseAll,
  );

  setupMultiselect(
    searchIp, dropdownIp,
    state.inProgress, state.courses,
    c => addChip(c.course_code, state.inProgress, chipsIp, state.completed, chipsCompleted,
      () => { renderIpChips(); renderCompletedChips(); }, onSave),
    onCloseAll,
  );

  setupPasteFallback(
    "toggle-paste-completed", "paste-completed", "apply-paste-completed", "paste-errors-completed",
    state.completed, state.inProgress, state.courses,
    code => addChip(code, state.completed, chipsCompleted, state.inProgress, chipsIp,
      () => { renderCompletedChips(); renderIpChips(); }, onSave),
    onCloseAll,
  );

  setupPasteFallback(
    "toggle-paste-ip", "paste-ip", "apply-paste-ip", "paste-errors-ip",
    state.inProgress, state.completed, state.courses,
    code => addChip(code, state.inProgress, chipsIp, state.completed, chipsCompleted,
      () => { renderIpChips(); renderCompletedChips(); }, onSave),
    onCloseAll,
  );

  restoreSession(state, sessionElements, {
    renderChipsCompleted: renderCompletedChips,
    renderChipsIp: renderIpChips,
  });

  sessionElements.targetSemester?.addEventListener("change", onSave);
  sessionElements.targetSemester2?.addEventListener("change", onSave);
  sessionElements.maxRecs?.addEventListener("change", onSave);
  canTakeInput?.addEventListener("input", onSave);
  window.addEventListener("beforeunload", onSave);
}

init();
