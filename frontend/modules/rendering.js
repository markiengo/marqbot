import {
  esc,
  bucketLabel,
  colorizePrereq,
  formatCourseNotes,
} from "./utils.js";

/**
 * Rendering functions - all return HTML strings, never touch the DOM directly.
 */

function getProgramLabelMap(selectionContext) {
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

function renderCurrentProgressHtml(currentProgress, assumptionNotes = [], programLabelMap = null) {
  if (!currentProgress || !Object.keys(currentProgress).length) return "";

  let html = `<div class="section-title">Current Degree Progress</div>`;
  html += `<p class="progress-note">Current snapshot: green is completed; yellow assumes current in-progress courses are completed.</p>`;
  if (Array.isArray(assumptionNotes) && assumptionNotes.length) {
    html += `<ul class="assumption-notes">`;
    assumptionNotes.forEach((note) => {
      html += `<li>${esc(String(note || ""))}</li>`;
    });
    html += `</ul>`;
  }
  html += `<div class="progress-grid">`;

  for (const [bid, prog] of Object.entries(currentProgress)) {
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

    const label = prog.label || bucketLabel(bid, programLabelMap);
    html += `
      <div class="progress-card">
        <h4>${esc(label)}</h4>
        <div class="progress-bar-stacked" aria-label="Current progress for ${esc(label)}">
          <span class="progress-segment-completed" style="width:${completedPct}%"></span>
          <span class="progress-segment-in-progress" style="width:${inProgressPct}%"></span>
          <span class="progress-segment-remaining" style="width:${remainingPct}%"></span>
        </div>
        <div class="progress-label">Completed ${cappedCompleted} of ${needed}</div>
        <div class="progress-label">With current in-progress: ${effectiveAssumed} of ${needed}</div>
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
  const bucketsHtml = bucketIds.length
    ? `<div class="unlocks-line">Counts toward: ${bucketIds.map(bid => esc(bucketLabel(bid, programLabelMap))).join(", ")}</div>` : "";

  const softWarn = c.soft_tags?.length
    ? `<div class="soft-warn warning-text">Warning: ${c.soft_tags.join(", ").replace(/_/g, " ")}</div>` : "";

  const lowConf = c.low_confidence
    ? `<div class="low-conf-warn">Note: offering schedule may vary; confirm with registrar.</div>` : "";

  const courseNotes = c.notes
    ? `<div class="low-conf-warn">${formatCourseNotes(c.notes)}</div>` : "";

  const whyClass = (c.why || "").startsWith("This course advances your Finance major path")
    ? "rec-card-why rec-card-why-gold"
    : "rec-card-why";

  const displayTitle = c.course_name
    ? `${esc(c.course_code)} - ${esc(c.course_name)}`
    : esc(c.course_code || "");

  return `
    <div class="rec-card">
      <div class="rec-card-header">
        <div>
          <div class="rec-card-title">${displayTitle}</div>
          <div class="rec-card-sub">${c.credits || 3} credits</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${bucketTags}</div>
      </div>
      <div class="${whyClass}">${humanCourseText(c.why || "")}</div>
      <div class="prereq-line">${prereqHtml}</div>
      ${bucketsHtml}
      ${unlocksHtml}
      ${softWarn}${lowConf}${courseNotes}
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

  if (data.blocking_warnings?.length) {
    html += `<div class="warnings-box"><h4 class="heading-gold">Sequencing Heads-Up</h4><ul>`;
    data.blocking_warnings.forEach(w => { html += `<li class="sequencing-item">${humanCourseText(w)}</li>`; });
    html += `</ul></div>`;
  }

  if (data.recommendations?.length) {
    if ((data.eligible_count || 0) < requestedCount) {
      html += `<div class="warnings-box"><h4 class="heading-gold">Recommendation Count</h4><ul><li class="warning-text">You requested ${requestedCount}, but only ${data.eligible_count} eligible course(s) match your completed/in-progress courses for this term.</li></ul></div>`;
    }
    const semesterLabel = data.target_semester || "";
    html += `<div class="section-title">Semester ${index}: Recommended for ${esc(semesterLabel)}</div>`;
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
    html += `<div class="progress-grid">`;
    for (const [bid, prog] of Object.entries(semesterProgress)) {
      const needed = prog.needed || 0;
      const done = prog.done_count || 0;
      const pct = needed > 0 ? Math.min(100, Math.round((done / needed) * 100)) : 0;
      const doneClass = prog.satisfied ? "done" : "";
      const ipCodes = prog.in_progress_applied || [];
      const progressLabel = prog.label || bucketLabel(bid, programLabelMap);
      html += `
        <div class="progress-card">
          <h4>${esc(progressLabel)}</h4>
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${doneClass}" style="width:${pct}%"></div>
          </div>
          <div class="progress-label">Completed ${done} of ${needed}${prog.satisfied ? " (Done)" : ""}</div>
          ${ipCodes.length ? `<div class="in-progress-badge">+ ${ipCodes.map(esc).join(", ")} in progress</div>` : ""}
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
