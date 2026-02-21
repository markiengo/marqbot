import {
  esc,
  bucketLabel,
  colorizePrereq,
  formatCourseNotes,
} from "./utils.js";

/**
 * Rendering functions - all return HTML strings, never touch the DOM directly.
 */

export function getProgramLabelMap(selectionContext) {
  const map = new Map();
  if (!selectionContext) return map;
  const ids = Array.isArray(selectionContext.selected_program_ids)
    ? selectionContext.selected_program_ids
    : [];
  const labels = Array.isArray(selectionContext.selected_program_labels)
    ? selectionContext.selected_program_labels
    : [];
  ids.forEach((id, idx) => {
    const key = String(id || "").trim();
    const label = String(labels[idx] || "").trim();
    if (key && label) map.set(key, label);
  });
  return map;
}

function humanCourseText(text) {
  return esc(String(text || ""));
}

function minStandingWarning(minStanding) {
  const n = Number(minStanding);
  if (!Number.isFinite(n)) return "standing requirement";
  switch (n) {
    case 0:
      return "";
    case 1:
      return "enrolled standing required";
    case 2:
      return "sophomore standing required";
    case 3:
      return "junior standing required";
    case 4:
      return "senior standing required";
    default:
      return "standing requirement (see catalog)";
  }
}

function humanizeSoftWarningTag(tag, course = null) {
  const key = String(tag || "").trim().toLowerCase();
  if (!key) return "";
  if (key === "standing_requirement") {
    return minStandingWarning(course?.min_standing);
  }
  const mapped = {
    major_restriction: "major restriction",
    admitted_program: "admitted program required",
    instructor_consent: "instructor consent required",
    enrollment_requirement: "enrollment requirement",
    placement_required: "placement requirement",
    minimum_grade: "minimum grade requirement",
    minimum_gpa: "minimum GPA requirement",
  }[key];
  if (mapped) return mapped;
  return key.replace(/_/g, " ");
}

function localBucketId(bucketId) {
  const raw = String(bucketId || "").trim();
  if (!raw) return "";
  if (raw.includes("::")) {
    return raw.split("::", 2)[1];
  }
  return raw;
}

function sortProgressEntries(progressObj) {
  const entries = Object.entries(progressObj || {});
  const indexed = entries.map((entry, idx) => ({ entry, idx }));
  indexed.sort((a, b) => {
    const aLocal = localBucketId(a.entry[0]);
    const bLocal = localBucketId(b.entry[0]);
    const aRank = aLocal === "BCC_REQUIRED" ? 0 : 1;
    const bRank = bLocal === "BCC_REQUIRED" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return a.idx - b.idx;
  });
  return indexed.map(x => x.entry);
}

function compactKpiBucketLabel(label) {
  const raw = String(label || "");
  if (!raw) return "";
  return raw
    .replace(/AIM No Concentration Core/gi, "AIM Core (No Concentration)")
    .replace(/AIM No Concentration Elective\s*\(1\)/gi, "AIM Elective (No Concentration)")
    .replace(/\bNo Conc\b/gi, "No Concentration")
    .replace(/Information Systems Major/gi, "IS Major")
    .replace(/Business Analytics Major/gi, "BUAN Major")
    .replace(/Operations and Supply Chain Major/gi, "OSCM Major")
    .replace(/Accounting Major/gi, "ACCO Major")
    .replace(/Finance Major/gi, "FINA Major")
    .replace(/Operations and Supply Chain/gi, "OSCM")
    .replace(/Information Systems/gi, "IS")
    .replace(/Business Analytics/gi, "BUAN")
    .replace(/Accounting/gi, "ACCO")
    .replace(/Finance/gi, "FINA")
    .replace(/Supply Chain/gi, "OSCM")
    .replace(/\bOscm\b/g, "OSCM")
    .replace(/\bBuan\b/g, "BUAN")
    .replace(/\bInsy\b/g, "INSY")
    .replace(/\bFina\b/g, "FINA")
    .replace(/\bAcco\b/g, "ACCO")
    .replace(/\bAim\b/g, "AIM")
    .replace(/\bReq\b/g, "REQ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderCurrentProgressHtml(currentProgress, assumptionNotes = [], programLabelMap = null) {
  if (!currentProgress || !Object.keys(currentProgress).length) return "";

  let html = `<div class="section-title section-title-compact">Current Degree Progress</div>`;
  html += `<p class="progress-note"><strong class="progress-note-strong">Current snapshot:</strong> green = completed; yellow = in-progress assumed completed.</p>`;
  if (Array.isArray(assumptionNotes) && assumptionNotes.length) {
    html += `<ul class="assumption-notes">`;
    assumptionNotes.forEach((note) => {
      html += `<li>${esc(String(note || ""))}</li>`;
    });
    html += `</ul>`;
  }
  html += `<div class="progress-table" role="table" aria-label="Current degree progress by requirement bucket">`;

  for (const [bid, prog] of sortProgressEntries(currentProgress)) {
    const needed = Number(prog.needed || 0);
    const completedDone = Number(prog.completed_done || 0);
    const assumedDone = Number(prog.assumed_done || 0);
    const inProgressIncrement = Number(prog.in_progress_increment || 0);

    const cappedCompleted = needed > 0 ? Math.max(0, Math.min(needed, completedDone)) : 0;
    const cappedInProgress = needed > 0 ? Math.max(0, Math.min(needed - cappedCompleted, inProgressIncrement)) : 0;
    const remainder = needed > 0 ? Math.max(0, needed - cappedCompleted - cappedInProgress) : 0;
    const effectiveAssumed = needed > 0
      ? Math.max(0, Math.min(needed, assumedDone))
      : Math.max(0, assumedDone);

    const completedPct = needed > 0 ? (cappedCompleted / needed) * 100 : 0;
    const inProgressPct = needed > 0 ? (cappedInProgress / needed) * 100 : 0;
    const remainingPct = needed > 0 ? (remainder / needed) * 100 : 100;

    const label = compactKpiBucketLabel(prog.label || bucketLabel(bid, programLabelMap));
    const fracText = needed > 0 ? `${effectiveAssumed}/${needed}` : `${effectiveAssumed}/0`;
    const detailText = `With current in-progress: ${effectiveAssumed} of ${needed}`;
    const detailSubText = inProgressIncrement > 0
      ? `${cappedCompleted} completed + ${cappedInProgress} in progress`
      : `${cappedCompleted} completed`;

    html += `
      <div class="progress-row${prog.satisfied ? " is-done" : ""}" role="row">
        <div class="progress-row-head">
          <span class="progress-row-label">${esc(label)}</span>
          <span class="progress-row-frac">${esc(fracText)}</span>
        </div>
        <div class="progress-row-track" aria-label="Current progress for ${esc(label)}">
          <span class="progress-row-fill-done" style="width:${completedPct}%"></span>
          <span class="progress-row-fill-ip" style="width:${inProgressPct}%"></span>
          <span class="progress-row-fill-rem" style="width:${remainingPct}%"></span>
        </div>
        <div class="progress-row-sub">${esc(detailText)}</div>
        <div class="progress-row-sub">${esc(detailSubText)}</div>
      </div>`;
  }

  html += `</div>`;
  return html;
}

export function renderCard(c, options = {}) {
  const programLabelMap = options.programLabelMap || null;

  const bucketIds = c.fills_buckets || [];
  const bucketTags = bucketIds.map((bid, idx) => {
    const cls = idx === 0 ? "tag-bucket" : idx === 1 ? "tag-secondary" : "tag-gold";
    return `<span class="tag ${cls}">${esc(bucketLabel(bid, programLabelMap))}</span>`;
  }).join("");

  const prereqHtml = colorizePrereq(c.prereq_check || "");

  const unlocksHtml = c.unlocks?.length
    ? `<div class="unlocks-line">Unlocks: ${c.unlocks.map(esc).join(", ")}</div>` : "";

  const warningMessages = [];
  if (Array.isArray(c.soft_tags) && c.soft_tags.length) {
    const normalized = [...new Set(c.soft_tags.map(tag => humanizeSoftWarningTag(tag, c)).filter(Boolean))];
    warningMessages.push(...normalized);
  }
  if (c.low_confidence) {
    warningMessages.push("offering schedule may vary; confirm with registrar");
  }
  const warningStrip = warningMessages.length
    ? `<div class="warning-strip" role="alert">\u26a0 Warning: ${warningMessages.map(esc).join(" \u00b7 ")}</div>`
    : "";

  const courseNotes = c.notes
    ? `<div class="low-conf-warn">${formatCourseNotes(c.notes)}</div>` : "";

  const whyClass = (c.why || "").startsWith("This course advances your")
    ? "rec-card-why rec-card-why-gold"
    : "rec-card-why";

  const codePart = `<span class="course-code">${esc(c.course_code || "")}</span>`;
  const displayTitle = c.course_name
    ? `${codePart}<span class="title-sep">\u2014</span><span class="course-name">${esc(c.course_name)}</span>`
    : codePart;

  return `
    <div class="rec-card">
      <div class="rec-card-header">
        <div>
          <div class="rec-card-title">${displayTitle}</div>
          <div class="rec-card-sub">${c.credits || 3} credits</div>
        </div>
      </div>
      <div class="rec-card-tags">${bucketTags}</div>
      <div class="${whyClass}">${humanCourseText(c.why || "")}</div>
      <div class="prereq-line">${prereqHtml}</div>
      ${unlocksHtml}
      ${warningStrip}${courseNotes}
    </div>`;
}

export function renderErrorHtml(msg, errObj) {
  let html = `<div class="error-banner"><strong>Error:</strong> ${esc(msg)}`;
  if (errObj?.invalid_courses?.length) {
    html += `<div class="error-list">Invalid codes: ${errObj.invalid_courses.map(esc).join(", ")}</div>`;
  }
  if (errObj?.not_in_catalog?.length) {
    html += `<div class="error-list">Not in catalog: ${errObj.not_in_catalog.map(esc).join(", ")}</div>`;
  }
  html += `</div>`;
  return html;
}

export function renderCanTakeHtml(data, options = {}) {
  const statusClass = data.can_take === true ? "can-take-true"
    : data.can_take === false ? "can-take-false"
    : "can-take-null";

  const requested = String(data.requested_course || "");
  const statusText = data.can_take === true ? `Yes, you can take ${esc(requested)}`
    : data.can_take === false ? `Not yet: ${esc(requested)}`
    : `Manual review required: ${esc(requested)}`;

  let html = `
    <div class="can-take-banner ${statusClass}">
      <h3>${statusText}</h3>
      ${data.why_not ? `<p>${humanCourseText(data.why_not)}</p>` : ""}
      ${data.not_offered_this_term ? `<p>This course is not offered this term.</p>` : ""}
      ${data.missing_prereqs?.length ? `<p>Missing: ${data.missing_prereqs.map(esc).join(", ")}</p>` : ""}
    </div>`;

  if (data.next_best_alternatives?.length) {
    html += `<div class="section-title">Alternatives you can take instead</div>`;
    html += `<div class="rec-cards">` + data.next_best_alternatives.map(c => renderCard(c, options)).join("") + `</div>`;
  }

  return html;
}

export function renderSemesterHtml(data, index, requestedCount, options = {}) {
  const programLabelMap = options.programLabelMap || null;

  let html = "";

  if (data.not_in_catalog_warning?.length) {
    html += `<div class="catalog-warn warning-text">Warning: Some courses not found in catalog (ignored): ${data.not_in_catalog_warning.map(esc).join(", ")}</div>`;
  }

  if (data.recommendations?.length) {
    if ((data.eligible_count || 0) < requestedCount) {
      html += `<div class="warnings-box"><h4 class="heading-gold">Recommendation Count</h4><ul><li class="warning-text">You requested ${requestedCount}, but only ${data.eligible_count} eligible course(s) match your completed/in-progress courses for this term.</li></ul></div>`;
    }
    const semesterLabel = data.target_semester || "";
    html += `<div class="section-title section-title-semester">Semester ${index}: Recommended for ${esc(semesterLabel)}</div>`;
    html += `<div class="rec-cards">` + data.recommendations.map(c => renderCard(c, options)).join("") + `</div>`;
  }

  if (data.in_progress_note) {
    html += `<p class="warning-text" style="font-size:13px;margin-top:8px;">Warning: ${humanCourseText(data.in_progress_note)}</p>`;
  }

  const semesterProgress = data.projected_progress || data.progress;
  const semesterTimeline = data.projected_timeline || data.timeline;
  if (semesterProgress && Object.keys(semesterProgress).length) {
    html += `<div class="section-title">Degree Progress</div>`;
    if (data.projection_note) {
      html += `<p class="progress-note projection-note">${esc(data.projection_note)}</p>`;
    }
    html += `<p class="progress-note">Progress bars show completed courses applied to each requirement bucket.</p>`;
    if ((data.input_completed_count || 0) > 0 && (data.applied_completed_count || 0) === 0) {
      html += `<div class="catalog-warn warning-text">None of your completed courses currently map into tracked requirement buckets. They may still be valid prerequisites, but they do not move these specific progress bars.</div>`;
    }
    html += `<div class="progress-table" role="table" aria-label="Projected degree progress by requirement bucket">`;
    for (const [bid, prog] of sortProgressEntries(semesterProgress)) {
      const needed = prog.needed || 0;
      const done = prog.done_count || 0;
      const inProgressCount = Array.isArray(prog.in_progress_applied)
        ? prog.in_progress_applied.length
        : 0;
      const cappedDone = needed > 0 ? Math.max(0, Math.min(needed, done)) : 0;
      const cappedInProgress = needed > 0 ? Math.max(0, Math.min(needed - cappedDone, inProgressCount)) : 0;
      const remainder = needed > 0 ? Math.max(0, needed - cappedDone - cappedInProgress) : 0;
      const donePct = needed > 0 ? (cappedDone / needed) * 100 : 0;
      const inProgressPct = needed > 0 ? (cappedInProgress / needed) * 100 : 0;
      const remainingPct = needed > 0 ? (remainder / needed) * 100 : 100;
      const doneClass = prog.satisfied ? " is-done" : "";
      const ipCodes = prog.in_progress_applied || [];
      const progressLabel = compactKpiBucketLabel(prog.label || bucketLabel(bid, programLabelMap));
      const fracText = needed > 0 ? `${cappedDone}${cappedInProgress ? `+${cappedInProgress}` : ""}/${needed}` : `${cappedDone}/0`;
      html += `
        <div class="progress-row${doneClass}" role="row">
          <div class="progress-row-head">
            <span class="progress-row-label">${esc(progressLabel)}</span>
            <span class="progress-row-frac">${esc(fracText)}${prog.satisfied ? " (Done)" : ""}</span>
          </div>
          <div class="progress-row-track">
            <span class="progress-row-fill-done" style="width:${donePct}%"></span>
            <span class="progress-row-fill-ip" style="width:${inProgressPct}%"></span>
            <span class="progress-row-fill-rem" style="width:${remainingPct}%"></span>
          </div>
          ${ipCodes.length ? `<div class="progress-row-sub">+ ${ipCodes.map(esc).join(", ")} in progress</div>` : ""}
        </div>`;
    }
    html += `</div>`;
  }

  if (data.double_counted_courses?.length) {
    html += `<div class="section-title">Double-Counted Courses</div><ul class="notes-list">`;
    data.double_counted_courses.forEach(d => {
      const buckets = (d.buckets || []).map(bid => bucketLabel(bid, programLabelMap)).map(esc).join(" + ");
      html += `<li>${esc(d.course_code)} counts toward: ${buckets}</li>`;
    });
    html += `</ul>`;
  }

  if (data.allocation_notes?.length) {
    html += `<ul class="notes-list" style="margin-top:6px;">`;
    data.allocation_notes.forEach(n => { html += `<li>${humanCourseText(n)}</li>`; });
    html += `</ul>`;
  }

  if (data.manual_review_courses?.length) {
    html += `<p style="font-size:13px;color:var(--mu-muted);margin-top:10px;">
      Courses requiring manual prereq review (not shown above):
      ${data.manual_review_courses.map(esc).join(", ")}
    </p>`;
  }

  if (semesterTimeline) {
    const t = semesterTimeline;
    html += `
      <div class="timeline-box">
        <div class="timeline-stat">
          <div class="num">${t.remaining_slots_total}</div>
          <div class="lbl">Courses required remaining</div>
        </div>
        <div class="timeline-stat">
          <div class="num">${t.estimated_min_terms}</div>
          <div class="lbl">Est. terms to finish major</div>
        </div>
        <div class="timeline-disclaimer">${esc(t.disclaimer)}</div>
      </div>`;
  }

  return html;
}

export function renderRecommendationsHtml(data, requestedCount, options = {}) {
  const programLabelMap = getProgramLabelMap(data.selection_context);
  const renderOptions = { ...options, programLabelMap };

  let prefix = "";
  if (data.selection_context) {
    const majorLabels = Array.isArray(data.selection_context.declared_major_labels)
      ? data.selection_context.declared_major_labels
      : (data.selection_context.declared_majors || []).map(id => programLabelMap.get(id) || id);

    const selectedTrackId = data.selection_context.selected_track_id;
    const selectedTrackLabel = data.selection_context.selected_track_label
      || (selectedTrackId ? (programLabelMap.get(selectedTrackId) || selectedTrackId) : null);

    const majors = majorLabels.map(esc).join(", ");
    const track = selectedTrackLabel ? esc(selectedTrackLabel) : "None";

    prefix += `<div class="warnings-box"><h4 class="heading-gold">Plan Context</h4><ul><li>Majors: ${majors || "None"}</li><li>Track: ${track}</li></ul></div>`;
  }

  if (data.current_progress && Object.keys(data.current_progress).length) {
    prefix += renderCurrentProgressHtml(
      data.current_progress,
      data.current_assumption_notes || [],
      programLabelMap,
    );
  }

  if (Array.isArray(data.semesters) && data.semesters.length) {
    return prefix + data.semesters.map((sem, i) =>
      `<section class="semester-block">${renderSemesterHtml(sem, i + 1, requestedCount, renderOptions)}</section>`
    ).join("");
  }

  return prefix + renderSemesterHtml(data, 1, requestedCount, renderOptions);
}

/**
 * Renders an SVG progress ring.
 * @param {number} pct - Completed percentage 0-100
 * @param {number} [size=100] - Diameter in px
 * @param {number} [stroke=10] - Stroke width in px
 * @param {number} [inProgressPct=0] - In-progress percentage 0-100
 * @param {number|null} [displayPct=null] - Optional center text percentage.
 */
export function renderProgressRing(pct, size = 100, stroke = 10, inProgressPct = 0, displayPct = null) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const donePct = Math.min(100, Math.max(0, Number(pct) || 0));
  const ipPctRaw = Math.min(100, Math.max(0, Number(inProgressPct) || 0));
  const ipPct = Math.max(0, Math.min(100 - donePct, ipPctRaw));
  const centerPctRaw = displayPct == null ? donePct : Number(displayPct);
  const centerPct = Math.min(100, Math.max(0, Number.isFinite(centerPctRaw) ? centerPctRaw : donePct));
  const doneOffset = circ * (1 - donePct / 100);
  const ipOffset = circ * (1 - ipPct / 100);
  const ipRotation = -90 + (donePct * 3.6);
  const cx = size / 2;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="progress-ring" aria-label="${Math.round(centerPct)}% progress${ipPct ? ` (${Math.round(donePct)}% complete, ${Math.round(ipPct)}% in progress)` : ""}" role="img">
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
  <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--ok)" stroke-width="${stroke}"
    stroke-dasharray="${circ.toFixed(3)}" stroke-dashoffset="${doneOffset.toFixed(3)}"
    stroke-linecap="round" transform="rotate(-90 ${cx} ${cx})"/>
  ${ipPct > 0 ? `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--mu-gold)" stroke-width="${stroke}"
    stroke-dasharray="${circ.toFixed(3)}" stroke-dashoffset="${ipOffset.toFixed(3)}"
    stroke-linecap="round" transform="rotate(${ipRotation.toFixed(3)} ${cx} ${cx})"/>` : ""}
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" class="ring-pct">${Math.round(centerPct)}%</text>
</svg>`;
}

/**
 * Renders a row of KPI summary cards.
 */
export function renderKpiCardsHtml(done, remaining, inProgress) {
  return `<div class="kpi-cards">
  <div class="kpi-card kpi-done"><span class="kpi-value">${done}</span><span class="kpi-label">Completed</span></div>
  <div class="kpi-card kpi-ip"><span class="kpi-value">${inProgress}</span><span class="kpi-label">In Progress</span></div>
  <div class="kpi-card kpi-rem"><span class="kpi-value">${remaining}</span><span class="kpi-label">Remaining</span></div>
</div>`;
}

/**
 * Renders a compact degree summary for the right panel.
 * Shows each bucket label with done/needed fraction.
 * @param {Object} currentProgress - currentProgress map from /recommend response
 * @param {Map} [programLabelMap] - optional program label map
 */
export function renderDegreeSummaryHtml(currentProgress, programLabelMap = null) {
  if (!currentProgress || !Object.keys(currentProgress).length) return "";
  let html = `<div class="degree-summary">`;
  for (const [bid, prog] of sortProgressEntries(currentProgress)) {
    const needed = Number(prog.needed || 0);
    const done = Number(prog.completed_done || 0);
    const inProg = Number(prog.in_progress_increment || 0);
    const label = compactKpiBucketLabel(prog.label || bucketLabel(bid, programLabelMap));
    const satisfied = prog.satisfied || (needed > 0 && done >= needed);
    html += `<div class="summary-bucket${satisfied ? " summary-bucket--done" : ""}">
  <span class="summary-label">${esc(label)}</span>
  <span class="summary-frac">${done}${inProg ? `+${inProg}` : ""}/${needed}</span>
</div>`;
  }
  html += `</div>`;
  return html;
}

/**
 * Renders a compact inline can-take result for the right panel.
 * Simpler than renderCanTakeHtml — no full page element, right-panel sized.
 */
export function renderCanTakeInlineHtml(data) {
  if (!data || !data.requested_course) return "";
  const course = esc(String(data.requested_course));
  if (data.can_take === true) {
    return `<div class="can-take-inline can-take-inline--yes" role="status">
  <span class="ct-pill ct-pill--yes">Yes</span>
  <span class="ct-msg">You can take <strong>${course}</strong> next semester.</span>
</div>`;
  }
  if (data.can_take === false) {
    const whyNot = data.why_not ? `<p class="ct-reason">${esc(data.why_not)}</p>` : "";
    const missing = data.missing_prereqs?.length
      ? `<p class="ct-prereqs">Missing: ${data.missing_prereqs.map(esc).join(", ")}</p>`
      : "";
    return `<div class="can-take-inline can-take-inline--no" role="status">
  <span class="ct-pill ct-pill--no">Not yet</span>
  <span class="ct-msg"><strong>${course}</strong></span>
  ${whyNot}${missing}
</div>`;
  }
  // can_take === null (manual review)
  return `<div class="can-take-inline can-take-inline--review" role="status">
  <span class="ct-pill ct-pill--review">Review</span>
  <span class="ct-msg">Manual review required for <strong>${course}</strong>.</span>
  ${data.why_not ? `<p class="ct-reason">${esc(data.why_not)}</p>` : ""}
</div>`;
}
