import type * as Tesseract from "tesseract.js";
import type { Course, ImportResult, ImportStatus } from "./types";

const PASSING_GRADES = new Set([
  "TC",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "SNC",
]);

const KNOWN_TYPES = ["TE", "EN", "IP"] as const;
const KNOWN_GRADES = [...PASSING_GRADES, "W", "IP"] as const;
const MAX_IMAGE_LONG_EDGE = 2200;

type ImportStage = Extract<ImportStatus, "preprocessing" | "parsing">;
type KnownType = (typeof KNOWN_TYPES)[number];
type KnownGrade = (typeof KNOWN_GRADES)[number];

export interface CourseHistoryImportOptions {
  onStageChange?: (stage: ImportStage) => void;
}

export interface CourseHistoryOcrBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface CourseHistoryOcrLine {
  text: string;
  confidence: number;
  bbox: CourseHistoryOcrBBox;
}

type TesseractWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>;

interface HeaderAnchors {
  headerBottom: number;
  term: number;
  subject: number;
  number: number;
  title: number;
  mid: number;
  final: number;
  credits: number;
  gpa: number;
  type: number;
  note: number;
}

interface TokenGroup {
  centerY: number;
  lines: CourseHistoryOcrLine[];
}

interface ExtractedRow {
  subject: string;
  number: string;
  title: string;
  term: string;
  final_grade: string;
  type_col: string;
  credits: string;
  confidence: number;
  _source_index: number;
}

type RowDisposition = "completed" | "in_progress" | "ignored" | "unmatched";

interface ClassifiedRow {
  status: RowDisposition;
  reason?: string;
  inferred?: boolean;
}

let tesseractWorkerPromise: Promise<TesseractWorker> | null = null;

export async function parseCourseHistoryScreenshot(
  file: File,
  courses: Course[],
  options: CourseHistoryImportOptions = {},
): Promise<ImportResult> {
  options.onStageChange?.("preprocessing");
  const preprocessed = await preprocessCourseHistoryScreenshot(file);
  options.onStageChange?.("parsing");
  const ocrLines = await recognizeCourseHistory(preprocessed);
  return parseCourseHistoryTokens(ocrLines, courses);
}

export function parseCourseHistoryTokens(
  ocrLines: CourseHistoryOcrLine[],
  courses: Course[],
): ImportResult {
  const normalizedLines = ocrLines
    .map((line) => ({
      text: normalizeWhitespace(line.text),
      confidence: Number.isFinite(line.confidence) ? Number(line.confidence) : 0,
      bbox: line.bbox,
    }))
    .filter((line) => line.text.length > 0)
    .sort(compareByVisualOrder);

  const anchors = findHeaderAnchors(normalizedLines);
  const footerTop = findFooterTop(normalizedLines, anchors.headerBottom);
  const bodyLines = normalizedLines.filter((line) => {
    const centerY = verticalCenter(line.bbox);
    return centerY > anchors.headerBottom && centerY < footerTop;
  });

  if (bodyLines.length === 0) {
    throw new Error("The screenshot did not contain any course rows.");
  }

  const catalogCodes = new Set(courses.map((course) => normalizeCourseCode(course.course_code)));
  const departmentCodes = buildDepartmentCodes(courses);
  const rawRows = extractRows(bodyLines, anchors, departmentCodes);
  if (rawRows.length === 0) {
    throw new Error("Could not reconstruct any course rows from the screenshot.");
  }

  return processImportRows(rawRows, catalogCodes, departmentCodes);
}

export function flattenOcrLines(page: Tesseract.Page): CourseHistoryOcrLine[] {
  const lines: CourseHistoryOcrLine[] = [];
  for (const block of page.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        const text = normalizeWhitespace(line.text);
        if (!text || !line.bbox) continue;
        lines.push({
          text,
          confidence: Number.isFinite(line.confidence) ? Number(line.confidence) : 0,
          bbox: line.bbox,
        });
      }
    }
  }
  return lines.sort(compareByVisualOrder);
}

async function preprocessCourseHistoryScreenshot(file: File): Promise<Blob> {
  const image = await loadRenderableImage(file);
  const { width: srcWidth, height: srcHeight } = getRenderableImageDimensions(image);
  const scale = Math.min(1, MAX_IMAGE_LONG_EDGE / Math.max(srcWidth, srcHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(srcWidth * scale));
  canvas.height = Math.max(1, Math.round(srcHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("This browser could not create an image processing canvas.");
  }

  ctx.drawImage(image as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const luminance = (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
    const contrasted = clamp((luminance - 128) * 1.38 + 128, 0, 255);
    const thresholded = contrasted > 210 ? 255 : contrasted < 112 ? 0 : contrasted;
    data[index] = thresholded;
    data[index + 1] = thresholded;
    data[index + 2] = thresholded;
    data[index + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  if ("close" in image && typeof image.close === "function") {
    image.close();
  }

  const blob = await canvasToBlob(canvas, "image/png");
  if (!blob) {
    throw new Error("Could not prepare the screenshot for OCR.");
  }
  return blob;
}

async function recognizeCourseHistory(image: Blob): Promise<CourseHistoryOcrLine[]> {
  const worker = await getTesseractWorker();
  const result = await worker.recognize(
    image,
    {},
    {
      blocks: true,
      hocr: false,
      tsv: false,
      text: true,
    },
  );
  return flattenOcrLines(result.data);
}

async function getTesseractWorker(): Promise<TesseractWorker> {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = (async () => {
      const tesseract = await import("tesseract.js");
      const worker = await tesseract.createWorker("eng", tesseract.OEM.LSTM_ONLY);
      await worker.setParameters({
        tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT,
        preserve_interword_spaces: "1",
        user_defined_dpi: "144",
      });
      return worker;
    })().catch((error) => {
      tesseractWorkerPromise = null;
      throw error;
    });
  }

  return tesseractWorkerPromise;
}

function findHeaderAnchors(lines: CourseHistoryOcrLine[]): HeaderAnchors {
  const sortedLines = [...lines].sort(compareByVisualOrder);
  const firstBodyToken = sortedLines.find((line) => looksLikeTerm(line.text));
  if (!firstBodyToken) {
    throw new Error("Could not detect the CheckMarq course-history table.");
  }

  const headerLines = sortedLines.filter((line) => line.bbox.y1 <= firstBodyToken.bbox.y0 - 2);
  const headerBottom = Math.max(...headerLines.map((line) => line.bbox.y1));

  const termCandidates = headerLines.filter((line) => normalizeAlpha(line.text) === "TERM");
  const subjectCandidates = headerLines.filter((line) => normalizeAlpha(line.text).startsWith("SUBJ"));
  const numberCandidates = headerLines.filter((line) => normalizeAlpha(line.text) === "NBR");
  const titleCandidates = headerLines.filter((line) => normalizeAlpha(line.text) === "TITLE");
  const midCandidates = headerLines.filter((line) => normalizeAlpha(line.text).startsWith("MID"));
  const finalCandidates = headerLines.filter((line) => {
    const normalized = normalizeAlpha(line.text);
    return normalized === "FINAL" || normalized === "GRADE";
  });
  const creditCandidates = headerLines.filter((line) => normalizeAlpha(line.text) === "CR");
  const gpaCandidates = headerLines.filter((line) => normalizeAlpha(line.text) === "GPA");
  const typeCandidates = headerLines.filter((line) => normalizeAlpha(line.text) === "TYPE");
  const noteCandidates = headerLines.filter((line) => normalizeAlpha(line.text).startsWith("NOTE"));

  const term = minX(termCandidates);
  const subject = minX(subjectCandidates);
  const number = minX(numberCandidates);
  const title = minX(titleCandidates);
  const mid = minX(midCandidates);
  const final = minX(finalCandidates.filter((line) => line.bbox.x0 > mid - 20));
  const credits = minX(creditCandidates);
  const gpa = minX(gpaCandidates);
  const type = minX(typeCandidates);
  const note = noteCandidates.length > 0 ? minX(noteCandidates) : type + 120;

  if ([term, subject, number, title, mid, final, credits, gpa, type].some((value) => !Number.isFinite(value))) {
    throw new Error("Could not detect the CheckMarq table headers. Use a tighter crop of the table.");
  }

  return { headerBottom, term, subject, number, title, mid, final, credits, gpa, type, note };
}

function findFooterTop(lines: CourseHistoryOcrLine[], minY: number): number {
  const footerStart = lines
    .filter((line) => line.bbox.y0 > minY && /^\*?NOTE\b/i.test(line.text))
    .sort((left, right) => left.bbox.y0 - right.bbox.y0)[0];
  return footerStart ? footerStart.bbox.y0 : Number.POSITIVE_INFINITY;
}

function extractRows(
  lines: CourseHistoryOcrLine[],
  anchors: HeaderAnchors,
  departmentCodes: string[],
): ExtractedRow[] {
  const groups = groupLinesIntoRows(lines);
  const rows: ExtractedRow[] = [];
  let pendingRow: ExtractedRow | null = null;

  groups.forEach((group, index) => {
    const columns = assignGroupToColumns(group.lines, anchors);
    const parsed = normalizeColumns(columns, departmentCodes, index);

    if (startsNewRow(parsed)) {
      if (pendingRow) rows.push(pendingRow);
      pendingRow = parsed;
      return;
    }

    if (isTitleContinuation(parsed) && pendingRow) {
      pendingRow.title = normalizeWhitespace(`${pendingRow.title} ${parsed.title}`);
      pendingRow.confidence = Math.min(0.99, (pendingRow.confidence + parsed.confidence) / 2);
    }
  });

  if (pendingRow) rows.push(pendingRow);
  return rows.filter((row) => row.subject || row.number || row.title);
}

function groupLinesIntoRows(lines: CourseHistoryOcrLine[]): TokenGroup[] {
  const sorted = [...lines].sort(compareByVisualOrder);
  const heights = sorted.map((line) => Math.max(1, line.bbox.y1 - line.bbox.y0));
  const tolerance = Math.max(7, median(heights) * 0.62);
  const groups: TokenGroup[] = [];

  for (const line of sorted) {
    const centerY = verticalCenter(line.bbox);
    const previous = groups[groups.length - 1];

    if (previous && Math.abs(centerY - previous.centerY) <= tolerance) {
      previous.lines.push(line);
      previous.centerY = average(previous.lines.map((entry) => verticalCenter(entry.bbox)));
      continue;
    }

    groups.push({ centerY, lines: [line] });
  }

  return groups;
}

function assignGroupToColumns(lines: CourseHistoryOcrLine[], anchors: HeaderAnchors) {
  const sorted = [...lines].sort((left, right) => left.bbox.x0 - right.bbox.x0);
  const boundaries = {
    term: midpoint(anchors.term, anchors.subject),
    subject: midpoint(anchors.subject, anchors.number),
    number: midpoint(anchors.number, anchors.title),
    title: midpoint(anchors.title, anchors.mid),
    mid: midpoint(anchors.mid, anchors.final),
    final: midpoint(anchors.final, anchors.credits),
    credits: midpoint(anchors.credits, anchors.gpa),
    gpa: midpoint(anchors.gpa, anchors.type),
    type: midpoint(anchors.type, anchors.note),
  };

  const cells = {
    term: [] as CourseHistoryOcrLine[],
    subject: [] as CourseHistoryOcrLine[],
    number: [] as CourseHistoryOcrLine[],
    title: [] as CourseHistoryOcrLine[],
    final: [] as CourseHistoryOcrLine[],
    credits: [] as CourseHistoryOcrLine[],
    type: [] as CourseHistoryOcrLine[],
  };

  for (const line of sorted) {
    const centerX = horizontalCenter(line.bbox);
    if (centerX < boundaries.term) {
      cells.term.push(line);
    } else if (centerX < boundaries.subject) {
      cells.subject.push(line);
    } else if (centerX < boundaries.number) {
      cells.number.push(line);
    } else if (centerX < boundaries.title) {
      cells.title.push(line);
    } else if (centerX < boundaries.mid) {
      continue;
    } else if (centerX < boundaries.final) {
      cells.final.push(line);
    } else if (centerX < boundaries.credits) {
      cells.credits.push(line);
    } else if (centerX < boundaries.gpa) {
      continue;
    } else if (centerX < boundaries.type) {
      cells.type.push(line);
    }
  }

  return cells;
}

function normalizeColumns(
  columns: ReturnType<typeof assignGroupToColumns>,
  departmentCodes: string[],
  sourceIndex: number,
): ExtractedRow {
  const termText = joinCellText(columns.term);
  const numberText = joinCellText(columns.number);
  const titleText = joinCellText(columns.title);
  const creditsText = joinCellText(columns.credits);

  const subjectInfo = normalizeSubject(joinCellText(columns.subject), numberText, departmentCodes);
  const typeInfo = normalizeShortToken(joinCellText(columns.type), KNOWN_TYPES);
  const gradeInfo = normalizeShortToken(joinCellText(columns.final), KNOWN_GRADES);

  let confidence = average([
    averageConfidence(columns.term),
    averageConfidence(columns.subject),
    averageConfidence(columns.number),
    averageConfidence(columns.title),
    averageConfidence(columns.credits),
    averageConfidence(columns.type),
    averageConfidence(columns.final),
  ].filter((value) => value > 0));

  if (subjectInfo.repaired) confidence = Math.min(confidence, 0.76);
  if (typeInfo.repaired) confidence = Math.min(confidence, 0.76);
  if (gradeInfo.repaired) confidence = Math.min(confidence, 0.76);

  return {
    subject: subjectInfo.value,
    number: normalizeCourseNumber(numberText),
    title: normalizeTitle(titleText),
    term: normalizeTerm(termText),
    final_grade: gradeInfo.value,
    type_col: typeInfo.value,
    credits: normalizeCredits(creditsText),
    confidence: clamp(confidence, 0.1, 0.99),
    _source_index: sourceIndex,
  };
}

function startsNewRow(row: ExtractedRow): boolean {
  return Boolean(row.term || row.subject || row.number);
}

function isTitleContinuation(row: ExtractedRow): boolean {
  return Boolean(
    row.title &&
      !row.term &&
      !row.subject &&
      !row.number &&
      !row.final_grade &&
      !row.credits &&
      !row.type_col,
  );
}

function processImportRows(
  rows: ExtractedRow[],
  catalogCodes: Set<string>,
  departmentCodes: string[],
): ImportResult {
  const matchedCandidates: Array<{
    course_code: string;
    source_text: string;
    term: string;
    status: "completed" | "in_progress";
    confidence: number;
    _source_index: number;
  }> = [];
  const unmatchedRows: ImportResult["unmatched_rows"] = [];
  const ignoredRows: ImportResult["ignored_rows"] = [];

  rows.forEach((row, index) => {
    const normalizedRow = { ...row, _source_index: row._source_index ?? index };
    const sourceText = sourceTextFromRow(normalizedRow);
    const classification = classifyRow(normalizedRow);
    let confidence = clamp(normalizedRow.confidence, 0, 0.99);

    if (classification.inferred) {
      confidence = Math.min(confidence, classification.status === "ignored" ? 0.78 : 0.82);
    }

    if (classification.status === "ignored") {
      ignoredRows.push({
        source_text: sourceText,
        term: normalizedRow.term,
        status: "ignored",
        reason: classification.reason || "ignored",
        confidence,
      });
      return;
    }

    if (classification.status === "unmatched") {
      unmatchedRows.push({
        source_text: sourceText,
        term: normalizedRow.term,
        status: "unmatched",
        suggested_matches: suggestMatches(sourceText, catalogCodes),
        confidence,
        reason: classification.reason || "unmatched",
      });
      return;
    }

    const courseCode = courseCodeFromRow(normalizedRow);
    if (!courseCode) {
      unmatchedRows.push({
        source_text: sourceText,
        term: normalizedRow.term,
        status: classification.status,
        suggested_matches: suggestMatches(sourceText, catalogCodes),
        confidence,
        reason: "invalid_code",
      });
      return;
    }

    if (!catalogCodes.has(courseCode)) {
      unmatchedRows.push({
        source_text: sourceText,
        term: normalizedRow.term,
        status: classification.status,
        suggested_matches: suggestMatches(courseCode, catalogCodes),
        confidence,
        reason: "not_in_catalog",
      });
      return;
    }

    matchedCandidates.push({
      course_code: courseCode,
      source_text: sourceText,
      term: normalizedRow.term,
      status: classification.status,
      confidence,
      _source_index: normalizedRow._source_index,
    });
  });

  const grouped = new Map<string, typeof matchedCandidates>();
  for (const row of matchedCandidates) {
    const existing = grouped.get(row.course_code) || [];
    existing.push(row);
    grouped.set(row.course_code, existing);
  }

  const chosenRows = [...grouped.entries()].map(([courseCode, courseRows]) => {
    const completedRows = courseRows.filter((row) => row.status === "completed");
    const pool = completedRows.length > 0 ? completedRows : courseRows;
    const chosen = pool.reduce((best, candidate) => {
      const bestKey = rowSortKey(best.term, best._source_index);
      const candidateKey = rowSortKey(candidate.term, candidate._source_index);
      return compareRowKeys(candidateKey, bestKey) > 0 ? candidate : best;
    });

    return {
      course_code: courseCode,
      source_text: chosen.source_text,
      term: chosen.term,
      status: chosen.status,
      confidence: chosen.confidence,
    };
  });

  chosenRows.sort((left, right) => compareRowKeys(rowSortKey(left.term), rowSortKey(right.term)));

  const completedMatches = chosenRows.filter((row) => row.status === "completed");
  const inProgressMatches = chosenRows.filter((row) => row.status === "in_progress");

  return {
    completed_matches: completedMatches,
    in_progress_matches: inProgressMatches,
    unmatched_rows: unmatchedRows,
    ignored_rows: ignoredRows,
    summary: {
      completed_count: completedMatches.length,
      in_progress_count: inProgressMatches.length,
      unmatched_count: unmatchedRows.length,
      ignored_count: ignoredRows.length,
      total_rows: rows.length,
    },
  };
}

function classifyRow(row: ExtractedRow): ClassifiedRow {
  const finalGrade = normalizeWhitespace(row.final_grade).toUpperCase();
  const typeCol = normalizeWhitespace(row.type_col).toUpperCase();
  const numericCredits = parseNumericCredits(row.credits);

  if (finalGrade === "W") {
    return { status: "ignored", reason: "withdrawn" };
  }

  if (!finalGrade && typeCol === "EN" && numericCredits === 0) {
    return { status: "ignored", reason: "withdrawn", inferred: true };
  }

  if (finalGrade === "IP" || typeCol === "IP") {
    return { status: "in_progress" };
  }

  if (PASSING_GRADES.has(finalGrade)) {
    return { status: "completed" };
  }

  if (!finalGrade && (typeCol === "TE" || (typeCol === "EN" && numericCredits > 0))) {
    return { status: "completed", reason: "grade_missing_inferred", inferred: true };
  }

  if (!finalGrade) {
    return { status: "unmatched", reason: "missing_grade" };
  }

  return { status: "unmatched", reason: "unrecognized_grade" };
}

function courseCodeFromRow(row: Pick<ExtractedRow, "subject" | "number">): string | null {
  const subject = normalizeWhitespace(row.subject).toUpperCase();
  const number = normalizeWhitespace(row.number).toUpperCase();
  if (!subject || !number) return null;
  return `${subject} ${number}`;
}

function sourceTextFromRow(row: ExtractedRow): string {
  return [row.subject, row.number, row.title, row.term, row.final_grade]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(" | ");
}

function rowSortKey(term: string, sourceIndex = 0): [number, number, number] {
  const match = normalizeWhitespace(term).toUpperCase().match(/(\d{4})\s+([A-Z]+)/);
  if (!match) return [0, -1, sourceIndex];
  const year = Number(match[1]);
  const normalizedTerm = normalizeTerm(match[2]);
  const termRank = normalizedTerm.endsWith("WINTER")
    ? 0
    : normalizedTerm.endsWith("SPRING")
      ? 1
      : normalizedTerm.endsWith("SUMMER")
        ? 2
        : normalizedTerm.endsWith("FALL")
          ? 3
          : -1;
  return [year, termRank, sourceIndex];
}

function compareRowKeys(left: [number, number, number], right: [number, number, number]): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] - right[1];
  return left[2] - right[2];
}

function suggestMatches(sourceText: string, catalogCodes: Set<string>, limit = 5): string[] {
  const query = extractCodeLikeText(sourceText) || normalizeWhitespace(sourceText).toUpperCase();
  if (!query) return [];
  const queryDept = query.match(/^([A-Z]{2,6})\s+\d{4}[A-Z]?$/)?.[1] || query.match(/^([A-Z]{2,6})\b/)?.[1] || "";
  const queryNumber = query.match(/\b(\d{4})[A-Z]?\b/)?.[1] || "";
  const pool = [...catalogCodes];

  return pool
    .map((candidate) => ({
      candidate,
      score: scoreSuggestion(query, queryDept, queryNumber, candidate),
    }))
    .sort((left, right) => right.score - left.score || left.candidate.localeCompare(right.candidate))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function scoreSuggestion(query: string, queryDept: string, queryNumber: string, candidate: string): number {
  const candidateDept = candidate.split(" ")[0] || "";
  const candidateNumber = candidate.split(" ")[1] || "";
  let score = -levenshteinDistance(query.replace(/\s+/g, ""), candidate.replace(/\s+/g, ""));

  if (queryDept && candidateDept === queryDept) {
    score += 10;
  } else if (queryDept && candidateDept.startsWith(queryDept)) {
    score += 6;
  }

  if (queryNumber && /^\d+$/.test(queryNumber) && /^\d+$/.test(candidateNumber.replace(/[A-Z]$/, ""))) {
    const numberDistance = Math.abs(Number(queryNumber) - Number(candidateNumber.replace(/[A-Z]$/, "")));
    score += Math.max(0, 4 - Math.floor(numberDistance / 100));
  }

  return score;
}

function extractCodeLikeText(text: string): string | null {
  const match = normalizeWhitespace(text).toUpperCase().match(/\b([A-Z]{2,6})\s+(\d{4}[A-Z]?)\b/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function normalizeCourseCode(code: string): string {
  const match = normalizeWhitespace(code).toUpperCase().match(/^([A-Z]{2,6})\s*(\d{4}[A-Z]?)$/);
  if (!match) return normalizeWhitespace(code).toUpperCase();
  return `${match[1]} ${match[2]}`;
}

function buildDepartmentCodes(courses: Course[]): string[] {
  return [...new Set(
    courses
      .map((course) => normalizeCourseCode(course.course_code).split(" ")[0])
      .filter(Boolean),
  )].sort();
}

function normalizeSubject(
  value: string,
  number: string,
  departmentCodes: string[],
): { value: string; repaired: boolean } {
  const cleaned = normalizeAlphaNumeric(value)
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S")
    .replace(/[^A-Z]/g, "");
  if (!cleaned) return { value: "", repaired: false };
  if (departmentCodes.includes(cleaned)) return { value: cleaned, repaired: false };

  const bestMatch = departmentCodes
    .map((candidate) => ({
      candidate,
      score: scoreDepartmentCandidate(cleaned, number, candidate),
    }))
    .sort((left, right) => right.score - left.score || left.candidate.localeCompare(right.candidate))[0];

  if (!bestMatch || bestMatch.score < 2) {
    return { value: cleaned, repaired: false };
  }

  return { value: bestMatch.candidate, repaired: bestMatch.candidate !== cleaned };
}

function scoreDepartmentCandidate(rawSubject: string, number: string, candidate: string): number {
  let score = -levenshteinDistance(rawSubject, candidate);
  if (candidate.startsWith(rawSubject) || rawSubject.startsWith(candidate)) score += 4;
  if (number) score += Math.max(0, 2 - Math.abs(candidate.length - rawSubject.length));
  return score;
}

function normalizeShortToken<T extends readonly string[]>(
  value: string,
  allowed: T,
): { value: T[number] | ""; repaired: boolean } {
  const cleaned = normalizeAlphaNumeric(value)
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/;/g, "")
    .replace(/[|]/g, "I");

  if (!cleaned) return { value: "", repaired: false };
  if ((allowed as readonly string[]).includes(cleaned)) {
    return { value: cleaned as T[number], repaired: false };
  }

  const best = [...allowed]
    .map((candidate) => ({
      candidate,
      distance: levenshteinDistance(cleaned, candidate),
    }))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate))[0];

  if (!best || best.distance > 1) {
    return { value: "", repaired: false };
  }

  return { value: best.candidate as T[number], repaired: true };
}

function normalizeCourseNumber(value: string): string {
  const match = normalizeWhitespace(value).toUpperCase().match(/\b(\d{4}[A-Z]?)\b/);
  return match ? match[1] : "";
}

function normalizeTerm(value: string): string {
  const match = normalizeWhitespace(value).toUpperCase().match(/(\d{4})\s+([A-Z]+)/);
  if (!match) return normalizeWhitespace(value);
  const term = match[2].startsWith("FAL")
    ? "Fall"
    : match[2].startsWith("SUM")
      ? "Sum"
      : match[2].startsWith("SPR")
        ? "Sprg"
        : match[2].startsWith("WIN")
          ? "Winter"
          : toTitleCase(match[2]);
  return `${match[1]} ${term}`;
}

function normalizeTitle(value: string): string {
  return normalizeWhitespace(value).replace(/\s+([/&:])/g, "$1");
}

function normalizeCredits(value: string): string {
  const match = normalizeWhitespace(value).match(/\d+\.\d{2}/);
  return match ? match[0] : "";
}

function parseNumericCredits(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function looksLikeTerm(text: string): boolean {
  return /\b20\d{2}\s+(FALL|SPRG|SPRING|SUM|SUMMER|WINTER)\b/i.test(normalizeWhitespace(text));
}

function joinCellText(lines: CourseHistoryOcrLine[]): string {
  return normalizeWhitespace(
    lines
      .slice()
      .sort((left, right) => left.bbox.x0 - right.bbox.x0)
      .map((line) => line.text)
      .join(" "),
  );
}

function averageConfidence(lines: CourseHistoryOcrLine[]): number {
  if (lines.length === 0) return 0;
  return clamp(average(lines.map((line) => line.confidence / 100)), 0, 1);
}

function normalizeWhitespace(value: string | null | undefined): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeAlpha(value: string): string {
  return normalizeWhitespace(value).toUpperCase().replace(/[^A-Z]/g, "");
}

function normalizeAlphaNumeric(value: string): string {
  return normalizeWhitespace(value).toUpperCase().replace(/[^A-Z0-9+\-;]/g, "");
}

function compareByVisualOrder(left: CourseHistoryOcrLine, right: CourseHistoryOcrLine): number {
  if (left.bbox.y0 !== right.bbox.y0) return left.bbox.y0 - right.bbox.y0;
  return left.bbox.x0 - right.bbox.x0;
}

function horizontalCenter(bbox: CourseHistoryOcrBBox): number {
  return (bbox.x0 + bbox.x1) / 2;
}

function verticalCenter(bbox: CourseHistoryOcrBBox): number {
  return (bbox.y0 + bbox.y1) / 2;
}

function minX(lines: CourseHistoryOcrLine[]): number {
  return Math.min(...lines.map((line) => line.bbox.x0));
}

function midpoint(left: number, right: number): number {
  return left + ((right - left) / 2);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));

  for (let row = 0; row <= left.length; row += 1) matrix[row][0] = row;
  for (let column = 0; column <= right.length; column += 1) matrix[0][column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function toTitleCase(value: string): string {
  const lower = value.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

async function loadRenderableImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the screenshot image."));
    };
    image.src = url;
  });
}

function getRenderableImageDimensions(image: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    return { width: image.width, height: image.height };
  }

  const htmlImage = image as HTMLImageElement;
  return {
    width: htmlImage.naturalWidth,
    height: htmlImage.naturalHeight,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, 0.92);
  });
}
