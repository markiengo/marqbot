/**
 * Pure utility functions — no DOM, no state dependencies.
 * Safe to import and test in isolation.
 */

export function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function bucketLabel(bucketId) {
  const raw = String(bucketId || "");
  const [, localId] = raw.includes("::")
    ? raw.split("::", 2)
    : [null, raw];
  const labels = {
    CORE: "Finance Required",
    FIN_CHOOSE_2: "Upper Division Finance Elective (Two)",
    FIN_CHOOSE_1: "Upper Division Finance Elective (One)",
    BUS_ELEC_4: "Business Electives",
  };
  return labels[localId] || String(localId || "").replace(/_/g, " ");
}

export function colorizePrereq(str) {
  if (!str) return "";
  return str
    .replace(/([A-Z]{2,6} \d{4}[A-Za-z]?) ✓/g, (_, code) => `<span class="check">${esc(code)} ✓</span>`)
    .replace(/([A-Z]{2,6} \d{4}[A-Za-z]?) \(in progress\) ✓/g, (_, code) =>
      `<span class="ip">${esc(code)} (in progress) ✓</span>`)
    .replace(/([A-Z]{2,6} \d{4}[A-Za-z]?) ✗/g, (_, code) => `<span class="miss">${esc(code)} ✗</span>`);
}

export function formatCourseNotes(note) {
  const txt = String(note || "");
  if (txt.toLowerCase().includes("todo") && txt.toLowerCase().includes("complex prereq")) {
    const codes = txt.match(/[A-Z]{2,6}\s\d{4}[A-Za-z]?/g) || [];
    if (codes.length) return `Hard prereq codes: ${codes.join(", ")}`;
    return "Hard prereq codes: see catalog.";
  }
  return esc(txt);
}

/**
 * Filter courses by query string, excluding already-selected codes.
 * @param {string} query
 * @param {Set<string>} excludeSet
 * @param {Array<{course_code: string, course_name: string}>} courses
 * @returns {Array}
 */
export function filterCourses(query, excludeSet, courses) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return courses
    .filter(c => !excludeSet.has(c.course_code) &&
      (c.course_code.toLowerCase().includes(q) ||
       (c.course_name || "").toLowerCase().includes(q)))
    .slice(0, 12);
}
