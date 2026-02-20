import { esc, bucketLabel, colorizePrereq, formatCourseNotes } from "./utils.js";

/**
 * Rendering functions — all return HTML strings, never touch the DOM directly.
 */

export function renderCard(c) {
  const bucketIds = c.fills_buckets || [];
  const bucketTags = bucketIds.map((bid, idx) => {
    const cls = idx === 0 ? "tag-bucket" : idx === 1 ? "tag-secondary" : "tag-gold";
    return `<span class="tag ${cls}">${esc(bucketLabel(bid))}</span>`;
  }).join("");

  const prereqHtml = colorizePrereq(c.prereq_check || "");

  const unlocksHtml = c.unlocks?.length
    ? `<div class="unlocks-line">Unlocks: ${c.unlocks.map(esc).join(", ")}</div>` : "";
  const bucketsHtml = bucketIds.length
    ? `<div class="unlocks-line">Counts toward: ${bucketIds.map(bucketLabel).map(esc).join(", ")}</div>` : "";

  const softWarn = c.soft_tags?.length
    ? `<div class="soft-warn">⚠ ${c.soft_tags.join(", ").replace(/_/g, " ")}</div>` : "";

  const lowConf = c.low_confidence
    ? `<div class="low-conf-warn">Note: offering schedule may vary — confirm with registrar.</div>` : "";

  const courseNotes = c.notes
    ? `<div class="low-conf-warn">${formatCourseNotes(c.notes)}</div>` : "";

  const whyClass = (c.why || "").startsWith("This course advances your Finance major path")
    ? "rec-card-why rec-card-why-gold"
    : "rec-card-why";

  return `
    <div class="rec-card">
      <div class="rec-card-header">
        <div>
          <div class="rec-card-title">${esc(c.course_code)} — ${esc(c.course_name)}</div>
          <div class="rec-card-sub">${c.credits || 3} credits</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${bucketTags}</div>
      </div>
      <div class="${whyClass}">${esc(c.why || "")}</div>
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

export function renderCanTakeHtml(data) {
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

  return html;
}

export function renderSemesterHtml(data, index, requestedCount) {
  let html = "";

  if (data.not_in_catalog_warning?.length) {
    html += `<div class="catalog-warn">⚠ Some courses not found in catalog (ignored): ${data.not_in_catalog_warning.map(esc).join(", ")}</div>`;
  }

  if (data.blocking_warnings?.length) {
    html += `<div class="warnings-box"><h4>Sequencing Heads-Up</h4><ul>`;
    data.blocking_warnings.forEach(w => { html += `<li>${esc(w)}</li>`; });
    html += `</ul></div>`;
  }

  if (data.recommendations?.length) {
    if ((data.eligible_count || 0) < requestedCount) {
      html += `<div class="warnings-box"><h4>Recommendation Count</h4><ul><li>You requested ${requestedCount}, but only ${data.eligible_count} eligible course(s) match your completed/in-progress courses for this term.</li></ul></div>`;
    }
    const semesterLabel = data.target_semester || "";
    html += `<div class="section-title">Semester ${index}: Recommended for ${esc(semesterLabel)}</div>`;
    html += `<div class="rec-cards">` + data.recommendations.map(renderCard).join("") + `</div>`;
  }

  if (data.in_progress_note) {
    html += `<p style="font-size:13px;color:var(--amber);margin-top:8px;">⚠ ${esc(data.in_progress_note)}</p>`;
  }

  if (data.progress && Object.keys(data.progress).length) {
    html += `<div class="section-title">Degree Progress</div>`;
    html += `<p style="font-size:13px;color:var(--ink-500);margin:0 0 10px;">Progress bars show completed courses applied to each requirement bucket. In-progress courses are listed separately and do not count as completed yet.</p>`;
    if ((data.input_completed_count || 0) > 0 && (data.applied_completed_count || 0) === 0) {
      html += `<div class="catalog-warn">None of your completed courses currently map into tracked requirement buckets. They may still be valid prerequisites, but they do not move these specific progress bars.</div>`;
    }
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
          <div class="progress-label">Completed ${done} of ${needed}${prog.satisfied ? " (Done)" : ""}</div>
          ${ipCodes.length ? `<div class="in-progress-badge">+ ${ipCodes.join(", ")} in progress</div>` : ""}
        </div>`;
    }
    html += `</div>`;
  }

  if (data.double_counted_courses?.length) {
    html += `<div class="section-title">Double-Counted Courses</div><ul class="notes-list">`;
    data.double_counted_courses.forEach(d => {
      html += `<li>${esc(d.course_code)} counts toward: ${d.buckets.map(bucketLabel).map(esc).join(" + ")}</li>`;
    });
    html += `</ul>`;
  }

  if (data.allocation_notes?.length) {
    html += `<ul class="notes-list" style="margin-top:6px;">`;
    data.allocation_notes.forEach(n => { html += `<li>${esc(n)}</li>`; });
    html += `</ul>`;
  }

  if (data.manual_review_courses?.length) {
    html += `<p style="font-size:13px;color:var(--mu-muted);margin-top:10px;">
      Courses requiring manual prereq review (not shown above):
      ${data.manual_review_courses.map(esc).join(", ")}
    </p>`;
  }

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
          <div class="lbl">Est. terms to finish major</div>
        </div>
        <div class="timeline-disclaimer">${esc(t.disclaimer)}</div>
      </div>`;
  }

  return html;
}

export function renderRecommendationsHtml(data, requestedCount) {
  let prefix = "";
  if (data.selection_context) {
    const majors = (data.selection_context.declared_majors || []).map(esc).join(", ");
    const track = data.selection_context.selected_track_id
      ? esc(data.selection_context.selected_track_id)
      : "None";
    prefix += `<div class="warnings-box"><h4>Plan Context</h4><ul><li>Majors: ${majors || "None"}</li><li>Track: ${track}</li></ul></div>`;
  }
  if (data.program_warnings?.length) {
    prefix += `<div class="warnings-box"><h4>Program Warnings</h4><ul>`;
    data.program_warnings.forEach(w => { prefix += `<li>${esc(w)}</li>`; });
    prefix += `</ul></div>`;
  }
  if (Array.isArray(data.semesters) && data.semesters.length) {
    return prefix + data.semesters.map((sem, i) =>
      `<section class="semester-block">${renderSemesterHtml(sem, i + 1, requestedCount)}</section>`
    ).join("");
  }
  return prefix + renderSemesterHtml(data, 1, requestedCount);
}
