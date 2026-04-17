import type { BucketProgress, RecommendationResponse, RecommendedCourse, SemesterData } from "@/lib/types";

function toCodeSet(codes: Iterable<string> | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const raw of codes || []) {
    const code = String(raw || "").trim();
    if (code) out.add(code);
  }
  return out;
}

function haveSameCodes(
  a: Iterable<string> | null | undefined,
  b: Iterable<string> | null | undefined,
): boolean {
  const setA = toCodeSet(a);
  const setB = toCodeSet(b);
  if (setA.size !== setB.size) return false;
  for (const code of setA) {
    if (!setB.has(code)) return false;
  }
  return true;
}

export function getCurrentCourseLists(
  response: RecommendationResponse | null | undefined,
  completedState: Iterable<string> | null | undefined,
  inProgressState: Iterable<string> | null | undefined,
) {
  const inputCompleted = response?.input_completed_courses;
  const inputInProgress = response?.input_in_progress_courses;
  const inputsMatchState =
    Array.isArray(inputCompleted) &&
    Array.isArray(inputInProgress) &&
    haveSameCodes(inputCompleted, completedState) &&
    haveSameCodes(inputInProgress, inProgressState);

  return {
    inputsMatchState,
    completed:
      inputsMatchState && Array.isArray(response?.current_completed_courses)
        ? response.current_completed_courses
        : [...(completedState || [])],
    inProgress:
      inputsMatchState && Array.isArray(response?.current_in_progress_courses)
        ? response.current_in_progress_courses
        : [...(inProgressState || [])],
  };
}

function cloneBucketProgress(progress: BucketProgress): BucketProgress {
  return {
    ...progress,
    completed_applied: [...(progress.completed_applied ?? [])],
    in_progress_applied: [...(progress.in_progress_applied ?? [])],
  };
}

function cloneCourse(course: RecommendedCourse): RecommendedCourse {
  return {
    ...course,
    fills_buckets: [...(course.fills_buckets ?? [])],
    equivalent_to_courses: [...(course.equivalent_to_courses ?? [])],
    conflicts_with_courses: [...(course.conflicts_with_courses ?? [])],
    bucket_label_overrides: course.bucket_label_overrides
      ? { ...course.bucket_label_overrides }
      : undefined,
  };
}

function cloneSemester(semester: SemesterData): SemesterData {
  return {
    ...semester,
    recommendations: (semester.recommendations ?? []).map(cloneCourse),
    eligible_swaps: semester.eligible_swaps?.map(cloneCourse),
    semester_warnings: [...(semester.semester_warnings ?? [])],
  };
}

function resetProjectedBucketProgress(progress: BucketProgress): BucketProgress {
  const next = cloneBucketProgress(progress);
  next.in_progress_applied = [];
  next.in_progress_increment = 0;
  next.in_progress_courses = 0;
  markProgressSatisfied(next);
  return next;
}

function markProgressSatisfied(progress: BucketProgress) {
  const neededCount = Number(progress.needed_count ?? 0);
  const completedCourses = Number(progress.completed_courses ?? 0);
  const inProgressCourses = Number(progress.in_progress_courses ?? 0);
  if (neededCount > 0) {
    progress.satisfied = completedCourses + inProgressCourses >= neededCount;
    return;
  }

  const neededUnits = Number(progress.needed ?? 0);
  const completedUnits = Number(progress.completed_done ?? progress.done_count ?? 0);
  const inProgressUnits = Number(progress.in_progress_increment ?? 0);
  if (neededUnits > 0) {
    progress.satisfied = completedUnits + inProgressUnits >= neededUnits;
  }
}

function bucketHasRemainingCapacity(progress: BucketProgress): boolean {
  if (progress.requirement_mode === "credits_pool") {
    const neededUnits = Math.max(0, Number(progress.needed ?? 0));
    if (neededUnits <= 0) return true;
    const completedUnits = Math.max(0, Number(progress.completed_done ?? progress.done_count ?? 0));
    const inProgressUnits = Math.max(0, Number(progress.in_progress_increment ?? 0));
    return completedUnits + inProgressUnits < neededUnits;
  }

  const neededCount = Math.max(0, Number(progress.needed_count ?? progress.needed ?? 0));
  if (neededCount <= 0) return true;
  const completedCourses = Math.max(0, Number(progress.completed_courses ?? 0));
  const inProgressCourses = Math.max(0, Number(progress.in_progress_courses ?? 0));
  return completedCourses + inProgressCourses < neededCount;
}

function cloneProgressMap(
  progressMap: Record<string, BucketProgress>,
): Record<string, BucketProgress> {
  return Object.fromEntries(
    Object.entries(progressMap).map(([bucketId, progress]) => [bucketId, cloneBucketProgress(progress)]),
  ) as Record<string, BucketProgress>;
}

function getAssumedCompletedCodes(
  response: RecommendationResponse | null | undefined,
): Set<string> {
  const inputCompleted = toCodeSet(response?.input_completed_courses);
  const currentCompleted = toCodeSet(response?.current_completed_courses);
  const assumed = new Set<string>();
  for (const code of currentCompleted) {
    if (!inputCompleted.has(code)) assumed.add(code);
  }
  return assumed;
}

function sumCredits(
  codes: Iterable<string>,
  creditMap?: Map<string, number>,
): number {
  let total = 0;
  for (const code of codes) {
    total += Math.max(0, Number(creditMap?.get(code) ?? 0));
  }
  return total;
}

export function stripAssumptionsFromCurrentProgress(
  response: RecommendationResponse | null | undefined,
  creditMap?: Map<string, number>,
): Record<string, BucketProgress> | null | undefined {
  if (!response?.current_progress) return response?.current_progress;

  const assumedCompletedCodes = getAssumedCompletedCodes(response);
  if (assumedCompletedCodes.size === 0) return response.current_progress;

  const nextProgress = cloneProgressMap(response.current_progress);

  for (const progress of Object.values(nextProgress)) {
    const completedApplied = progress.completed_applied ?? [];
    const removedCodes = completedApplied.filter((code) => assumedCompletedCodes.has(String(code || "").trim()));
    if (removedCodes.length === 0) continue;

    const decrement = progress.requirement_mode === "credits_pool"
      ? sumCredits(removedCodes, creditMap)
      : removedCodes.length;

    progress.completed_applied = completedApplied.filter(
      (code) => !assumedCompletedCodes.has(String(code || "").trim()),
    );
    progress.completed_courses = progress.completed_applied.length;
    progress.completed_done = Math.max(0, Number(progress.completed_done ?? 0) - decrement);
    progress.assumed_done = Math.max(0, Number(progress.assumed_done ?? progress.completed_done ?? 0) - decrement);
    if (progress.done_count !== undefined) {
      progress.done_count = Math.max(0, Number(progress.done_count ?? 0) - decrement);
    }
    markProgressSatisfied(progress);
  }

  return nextProgress;
}

function localBucketId(bucketId: string): string {
  const raw = String(bucketId || "").trim();
  if (!raw) return "";
  return raw.includes("::") ? raw.split("::", 2)[1] : raw;
}

function discoveryFamilyKey(bucketId: string): string {
  const localId = localBucketId(bucketId).toUpperCase();
  if (/_ELEC$/.test(localId)) return localId.slice(0, -5);
  if (/(?:_HUM|_NSM|_SSC)$/.test(localId)) return localId.slice(0, -4);
  return "";
}

function isDiscoveryElectiveBucket(bucketId: string): boolean {
  return /_ELEC$/i.test(localBucketId(bucketId));
}

function isDiscoveryRequiredBucket(bucketId: string): boolean {
  return /(?:_HUM|_NSM|_SSC)$/i.test(localBucketId(bucketId));
}

function dedupeBucketIds(bucketIds: string[]): string[] {
  return Array.from(new Set(bucketIds.map((bucketId) => String(bucketId || "").trim()).filter(Boolean)));
}

function countedBucketsForCourse(
  course: RecommendedCourse,
  progressMap: Record<string, BucketProgress>,
): string[] {
  const rawBuckets = dedupeBucketIds(course.fills_buckets ?? []);
  if (rawBuckets.length === 0) return [];

  const requiredDiscoveryFamilies = new Set(
    rawBuckets
      .filter((bucketId) => isDiscoveryRequiredBucket(bucketId) && bucketHasRemainingCapacity(progressMap[bucketId]))
      .map(discoveryFamilyKey)
      .filter(Boolean),
  );

  return rawBuckets.filter((bucketId) => {
    const progress = progressMap[bucketId];
    if (!progress || !bucketHasRemainingCapacity(progress)) return false;
    if (isDiscoveryElectiveBucket(bucketId)) {
      const family = discoveryFamilyKey(bucketId);
      if (family && requiredDiscoveryFamilies.has(family)) return false;
    }
    return true;
  });
}

function applyCourseToBucketProgress(
  course: RecommendedCourse,
  countedBuckets: string[],
  progressMap: Record<string, BucketProgress>,
) {
  const courseCode = String(course.course_code || "").trim();
  if (!courseCode) return;

  for (const bucketId of countedBuckets) {
    const progress = progressMap[bucketId];
    if (!progress) continue;
    const existing = new Set(
      [
        ...(progress.completed_applied ?? []),
        ...(progress.in_progress_applied ?? []),
      ].map((code) => String(code || "").trim()).filter(Boolean),
    );
    if (existing.has(courseCode)) continue;

    progress.in_progress_applied = [...(progress.in_progress_applied ?? []), courseCode];
    if (progress.requirement_mode === "credits_pool") {
      const credits = Math.max(0, Number(course.credits) || 0);
      progress.in_progress_increment = Number(progress.in_progress_increment ?? 0) + credits;
    } else {
      progress.in_progress_increment = Number(progress.in_progress_increment ?? 0) + 1;
      progress.in_progress_courses = Number(progress.in_progress_courses ?? 0) + 1;
    }
    markProgressSatisfied(progress);
  }
}

function buildVisiblePlanProjection(
  response: RecommendationResponse,
): {
  semesters: SemesterData[];
  finalProgress: Record<string, BucketProgress> | null;
} | null {
  if (!response.current_progress) return null;

  const projected = Object.fromEntries(
    Object.entries(response.current_progress).map(([bucketId, progress]) => [bucketId, resetProjectedBucketProgress(progress)]),
  ) as Record<string, BucketProgress>;
  const normalizedSemesters: SemesterData[] = [];

  for (const semester of response.semesters ?? []) {
    const nextSemester = cloneSemester(semester);
    const recommendations = [...(nextSemester.recommendations ?? [])];
    const processingOrder = [...recommendations].sort((left, right) => {
      const leftManual = left.is_manual_add ? 0 : 1;
      const rightManual = right.is_manual_add ? 0 : 1;
      if (leftManual !== rightManual) return leftManual - rightManual;
      return recommendations.indexOf(left) - recommendations.indexOf(right);
    });

    const countedByCode = new Map<string, string[]>();
    for (const course of processingOrder) {
      const countedBuckets = countedBucketsForCourse(course, projected);
      countedByCode.set(String(course.course_code || "").trim(), countedBuckets);
      applyCourseToBucketProgress(course, countedBuckets, projected);
    }

    nextSemester.recommendations = recommendations.map((course) => {
      const code = String(course.course_code || "").trim();
      const countedBuckets = countedByCode.get(code) ?? [];
      return {
        ...cloneCourse(course),
        fills_buckets: countedBuckets,
      };
    });
    nextSemester.projected_progress = cloneProgressMap(projected);
    normalizedSemesters.push(nextSemester);
  }

  return {
    semesters: normalizedSemesters,
    finalProgress: projected,
  };
}

export function normalizeVisibleRecommendationData(
  response: RecommendationResponse | null | undefined,
): RecommendationResponse | null | undefined {
  if (!response?.current_progress) return response;
  const projection = buildVisiblePlanProjection(response);
  if (!projection) return response;
  return {
    ...response,
    semesters: projection.semesters,
  };
}

export function getPlanLevelProgress(
  response: RecommendationResponse | null | undefined,
): Record<string, BucketProgress> | null | undefined {
  if (!response?.current_progress) return response?.current_progress;

  return buildVisiblePlanProjection(response)?.finalProgress ?? response.current_progress;
}
