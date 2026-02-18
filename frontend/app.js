/* ── State ──────────────────────────────────────────────────────────────── */
const state = {
  courses: [],         // [{course_code, course_name, credits}]
  completed: new Set(),
  inProgress: new Set(),
};

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const form           = document.getElementById("advisor-form");
const submitBtn      = document.getElementById("submit-btn");
const resultsEl      = document.getElementById("results");

const searchCompleted = document.getElementById("search-completed");
const dropdownCompleted = document.getElementById("dropdown-completed");
const chipsCompleted = document.getElementById("chips-completed");

const searchIp       = document.getElementById("search-ip");
const dropdownIp     = document.getElementById("dropdown-ip");
const chipsIp        = document.getElementById("chips-ip");

const canTakeInput   = document.getElementById("can-take-input");

/* ── Fetch course list on load ───────────────────────────────────────────── */
async function loadCourses() {
  try {
    const res = await fetch("/courses");
    const data = await res.json();
    state.courses = data.courses || [];
  } catch (e) {
    console.warn("Could not load course list:", e);
  }
}

/* ── Multiselect helpers ─────────────────────────────────────────────────── */
function filterCourses(query, excludeSet) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return state.courses
    .filter(c => !excludeSet.has(c.course_code) &&
      (c.course_code.toLowerCase().includes(q) ||
       (c.course_name || "").toLowerCase().includes(q)))
    .slice(0, 12);
}

function renderDropdown(dropdownEl, items, onSelect) {
  dropdownEl.innerHTML = "";
  if (items.length === 0) {
    dropdownEl.innerHTML = `<div class="ms-option-empty">No results</div>`;
    dropdownEl.classList.add("open");
    return;
  }
  items.forEach(c => {
    const div = document.createElement("div");
    div.className = "ms-option";
    div.innerHTML = `<span><span class="opt-code">${c.course_code}</span><span class="opt-name">${c.course_name || ""}</span></span>`;
    div.addEventListener("mousedown", e => { e.preventDefault(); onSelect(c); });
    dropdownEl.appendChild(div);
  });
  dropdownEl.classList.add("open");
}

function closeDropdowns() {
  dropdownCompleted.classList.remove("open");
  dropdownIp.classList.remove("open");
}

function addChip(code, targetSet, chipsEl, otherSet) {
  if (targetSet.has(code)) return;
  otherSet.delete(code); // can't be in both
  targetSet.add(code);
  renderChips(chipsEl, targetSet);
  // Re-render other chips too in case we removed a code
  if (otherSet === state.completed) renderChips(chipsCompleted, state.completed);
  if (otherSet === state.inProgress) renderChips(chipsIp, state.inProgress);
}

function removeChip(code, targetSet, chipsEl) {
  targetSet.delete(code);
  renderChips(chipsEl, targetSet);
}

function renderChips(chipsEl, set) {
  chipsEl.innerHTML = "";
  set.forEach(code => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${code}<button class="chip-remove" title="Remove">×</button>`;
    chip.querySelector(".chip-remove").addEventListener("click", () => {
      const isCompleted = (chipsEl === chipsCompleted);
      removeChip(code, isCompleted ? state.completed : state.inProgress, chipsEl);
    });
    chipsEl.appendChild(chip);
  });
}

function setupMultiselect(searchEl, dropdownEl, chipsEl, targetSet, otherSet) {
  searchEl.addEventListener("input", () => {
    const matches = filterCourses(searchEl.value, targetSet);
    if (searchEl.value.trim().length < 2) { closeDropdowns(); return; }
    renderDropdown(dropdownEl, matches, c => {
      addChip(c.course_code, targetSet, chipsEl, otherSet);
      searchEl.value = "";
      closeDropdowns();
      searchEl.focus();
    });
  });
  searchEl.addEventListener("blur", () => setTimeout(closeDropdowns, 150));
  searchEl.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeDropdowns(); searchEl.value = ""; }
  });
}

/* ── Paste fallback ──────────────────────────────────────────────────────── */
function setupPasteFallback(toggleBtnId, pasteId, applyBtnId, errorsId, targetSet, chipsEl, otherSet) {
  const toggle = document.getElementById(toggleBtnId);
  const textarea = document.getElementById(pasteId);
  const applyBtn = document.getElementById(applyBtnId);
  const errorsEl = document.getElementById(errorsId);

  toggle.addEventListener("click", () => {
    textarea.classList.toggle("hidden");
    applyBtn.classList.toggle("hidden");
    errorsEl.classList.add("hidden");
  });

  applyBtn.addEventListener("click", () => {
    const raw = textarea.value;
    const tokens = raw.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean);
    const notFound = [];
    const catalogMap = Object.fromEntries(state.courses.map(c => [c.course_code.toUpperCase(), c.course_code]));

    tokens.forEach(token => {
      // Normalize: uppercase, collapse spaces around hyphen
      const norm = token.toUpperCase().replace(/\s*-\s*/, " ").replace(/([A-Z]+)\s*(\d{4})/, "$1 $2");
      if (catalogMap[norm]) {
        addChip(catalogMap[norm], targetSet, chipsEl, otherSet);
      } else {
        notFound.push(token);
      }
    });

    textarea.value = "";
    textarea.classList.add("hidden");
    applyBtn.classList.add("hidden");

    if (notFound.length) {
      errorsEl.textContent = `Not found in catalog: ${notFound.join(", ")}`;
      errorsEl.classList.remove("hidden");
    } else {
      errorsEl.classList.add("hidden");
    }
  });
}

/* ── Form submit ─────────────────────────────────────────────────────────── */
form.addEventListener("submit", async e => {
  e.preventDefault();

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span> Analyzing…`;
  resultsEl.classList.add("hidden");
  resultsEl.innerHTML = "";

  const payload = {
    completed_courses: [...state.completed].join(", "),
    in_progress_courses: [...state.inProgress].join(", "),
    target_semester: document.getElementById("target-semester").value,
    requested_course: canTakeInput.value.trim() || null,
    max_recommendations: parseInt(document.getElementById("max-recs").value),
  };

  try {
    const res = await fetch("/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    renderResults(data);
  } catch (err) {
    renderError(`Network error: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Get Recommendations";
  }
});

/* ── Render ──────────────────────────────────────────────────────────────── */
function renderResults(data) {
  resultsEl.innerHTML = "";
  resultsEl.classList.remove("hidden");

  if (data.mode === "error") {
    renderError(data.error?.message || "An error occurred.", data.error);
    return;
  }
  if (data.mode === "can_take") {
    renderCanTake(data);
    return;
  }
  if (data.mode === "recommendations") {
    renderRecommendations(data);
    return;
  }
}

function renderError(msg, errObj) {
  let html = `<div class="error-banner"><strong>Error:</strong> ${esc(msg)}`;
  if (errObj?.invalid_courses?.length) {
    html += `<div class="error-list">Invalid codes: ${errObj.invalid_courses.map(esc).join(", ")}</div>`;
  }
  if (errObj?.not_in_catalog?.length) {
    html += `<div class="error-list">Not in catalog: ${errObj.not_in_catalog.map(esc).join(", ")}</div>`;
  }
  html += `</div>`;
  resultsEl.innerHTML = html;
}

function renderCanTake(data) {
  const statusClass = data.can_take === true ? "can-take-true"
    : data.can_take === false ? "can-take-false"
    : "can-take-null";

  const statusText = data.can_take === true ? `✓ Yes, you can take ${esc(data.requested_course)}`
    : data.can_take === false ? `✗ Not yet: ${esc(data.requested_course)}`
    : `⚠ Manual review required: ${esc(data.requested_course)}`;

  let html = `
    <div class="can-take-banner ${statusClass}">
      <h3>${statusText}</h3>
      ${data.why_not ? `<p>${esc(data.why_not)}</p>` : ""}
      ${data.not_offered_this_term ? `<p>This course is not offered this term.</p>` : ""}
      ${data.missing_prereqs?.length ? `<p>Missing: ${data.missing_prereqs.map(esc).join(", ")}</p>` : ""}
    </div>`;

  if (data.next_best_alternatives?.length) {
    html += `<div class="section-title">Alternatives you can take instead</div>`;
    html += `<div class="rec-cards">` + data.next_best_alternatives.map(renderCard).join("") + `</div>`;
  }

  resultsEl.innerHTML = html;
}

function renderRecommendations(data) {
  let html = "";

  // Not-in-catalog warning
  if (data.not_in_catalog_warning?.length) {
    html += `<div class="catalog-warn">⚠ Some courses not found in catalog (ignored): ${data.not_in_catalog_warning.map(esc).join(", ")}</div>`;
  }

  // Blocking warnings
  if (data.blocking_warnings?.length) {
    html += `<div class="warnings-box"><h4>Sequencing Heads-Up</h4><ul>`;
    data.blocking_warnings.forEach(w => { html += `<li>${esc(w)}</li>`; });
    html += `</ul></div>`;
  }

  // Recommendations
  if (data.recommendations?.length) {
    html += `<div class="section-title">Recommended for ${esc(document.getElementById("target-semester").value)}</div>`;
    html += `<div class="rec-cards">` + data.recommendations.map(renderCard).join("") + `</div>`;
  }

  // in_progress note
  if (data.in_progress_note) {
    html += `<p style="font-size:13px;color:var(--amber);margin-top:8px;">⚠ ${esc(data.in_progress_note)}</p>`;
  }

  // Progress
  if (data.progress && Object.keys(data.progress).length) {
    html += `<div class="section-title">Degree Progress</div>`;
    html += `<div class="progress-grid">`;
    for (const [bid, prog] of Object.entries(data.progress)) {
      const needed = prog.needed || 0;
      const done = prog.done_count || 0;
      const pct = needed > 0 ? Math.min(100, Math.round((done / needed) * 100)) : 0;
      const doneClass = prog.satisfied ? "done" : "";
      const ipCodes = prog.in_progress_applied || [];
      html += `
        <div class="progress-card">
          <h4>${esc(prog.label || bid)}</h4>
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${doneClass}" style="width:${pct}%"></div>
          </div>
          <div class="progress-label">${done} / ${needed} ${prog.satisfied ? "✓ Done" : "remaining"}</div>
          ${ipCodes.length ? `<div class="in-progress-badge">+ ${ipCodes.join(", ")} in progress</div>` : ""}
        </div>`;
    }
    html += `</div>`;
  }

  // Double-count notes
  if (data.double_counted_courses?.length) {
    html += `<div class="section-title">Double-Counted Courses</div><ul class="notes-list">`;
    data.double_counted_courses.forEach(d => {
      html += `<li>${esc(d.course_code)} counts toward: ${d.buckets.map(esc).join(" + ")}</li>`;
    });
    html += `</ul>`;
  }

  if (data.allocation_notes?.length) {
    html += `<ul class="notes-list" style="margin-top:6px;">`;
    data.allocation_notes.forEach(n => { html += `<li>${esc(n)}</li>`; });
    html += `</ul>`;
  }

  // Manual review courses
  if (data.manual_review_courses?.length) {
    html += `<p style="font-size:13px;color:var(--mu-muted);margin-top:10px;">
      Courses requiring manual prereq review (not shown above):
      ${data.manual_review_courses.map(esc).join(", ")}
    </p>`;
  }

  // Timeline
  if (data.timeline) {
    const t = data.timeline;
    html += `
      <div class="timeline-box">
        <div class="timeline-stat">
          <div class="num">${t.remaining_slots_total}</div>
          <div class="lbl">Slots remaining</div>
        </div>
        <div class="timeline-stat">
          <div class="num">${t.estimated_min_terms}</div>
          <div class="lbl">Est. terms to finish</div>
        </div>
        <div class="timeline-disclaimer">${esc(t.disclaimer)}</div>
      </div>`;
  }

  resultsEl.innerHTML = html;
}

function renderCard(c) {
  const bucketTag = c.requirement_bucket
    ? `<span class="tag tag-bucket">${esc(c.requirement_bucket)}</span>` : "";

  const multiTag = c.fills_buckets?.length > 1
    ? `<span class="tag tag-gold">Fills ${c.fills_buckets.length} buckets</span>` : "";

  // Color-coded prereq string
  const prereqHtml = colorizePrereq(c.prereq_check || "");

  const unlocksHtml = c.unlocks?.length
    ? `<div class="unlocks-line">Unlocks: ${c.unlocks.map(esc).join(", ")}</div>` : "";

  const softWarn = c.soft_tags?.length
    ? `<div class="soft-warn">⚠ ${c.soft_tags.join(", ").replace(/_/g, " ")}</div>` : "";

  const lowConf = c.low_confidence
    ? `<div class="low-conf-warn">Note: offering schedule may vary — confirm with registrar.</div>` : "";

  const courseNotes = c.notes
    ? `<div class="low-conf-warn">${esc(c.notes)}</div>` : "";

  return `
    <div class="rec-card">
      <div class="rec-card-header">
        <div>
          <div class="rec-card-title">${esc(c.course_code)} — ${esc(c.course_name)}</div>
          <div class="rec-card-sub">${c.credits || 3} credits</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${bucketTag}${multiTag}
        </div>
      </div>
      <div class="rec-card-why">${esc(c.why || "")}</div>
      <div class="prereq-line">${prereqHtml}</div>
      ${unlocksHtml}
      ${softWarn}${lowConf}${courseNotes}
    </div>`;
}

function colorizePrereq(str) {
  if (!str) return "";
  return str
    .replace(/([A-Z]{2,6} \d{4}[A-Za-z]?) ✓/g, (_, code) => `<span class="check">${esc(code)} ✓</span>`)
    .replace(/([A-Z]{2,6} \d{4}[A-Za-z]?) \(in progress\) ✓/g, (_, code) =>
      `<span class="ip">${esc(code)} (in progress) ✓</span>`)
    .replace(/([A-Z]{2,6} \d{4}[A-Za-z]?) ✗/g, (_, code) => `<span class="miss">${esc(code)} ✗</span>`);
}

/* ── Escape helper ───────────────────────────────────────────────────────── */
function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Init ────────────────────────────────────────────────────────────────── */
async function init() {
  await loadCourses();
  setupMultiselect(searchCompleted, dropdownCompleted, chipsCompleted, state.completed, state.inProgress);
  setupMultiselect(searchIp, dropdownIp, chipsIp, state.inProgress, state.completed);
  setupPasteFallback(
    "toggle-paste-completed", "paste-completed", "apply-paste-completed", "paste-errors-completed",
    state.completed, chipsCompleted, state.inProgress
  );
  setupPasteFallback(
    "toggle-paste-ip", "paste-ip", "apply-paste-ip", "paste-errors-ip",
    state.inProgress, chipsIp, state.completed
  );
}

init();
