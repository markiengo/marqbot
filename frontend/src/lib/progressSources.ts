import type { BucketProgress, RecommendationResponse } from "@/lib/types";

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

function buildProjectedProgressFromPlan(
  response: RecommendationResponse,
): Record<string, BucketProgress> | null {
  if (!response.current_progress) return null;

  const projected = Object.fromEntries(
    Object.entries(response.current_progress).map(([bucketId, progress]) => [bucketId, cloneBucketProgress(progress)]),
  ) as Record<string, BucketProgress>;

  const seenByBucket = new Map<string, Set<string>>();
  for (const [bucketId, progress] of Object.entries(projected)) {
    seenByBucket.set(
      bucketId,
      new Set([
        ...(progress.completed_applied ?? []).map((code) => String(code || "").trim()).filter(Boolean),
        ...(progress.in_progress_applied ?? []).map((code) => String(code || "").trim()).filter(Boolean),
      ]),
    );
  }

  for (const semester of response.semesters ?? []) {
    for (const course of semester.recommendations ?? []) {
      const courseCode = String(course.course_code || "").trim();
      if (!courseCode) continue;
      const fillsBuckets = Array.from(
        new Set((course.fills_buckets ?? []).map((bucketId) => String(bucketId || "").trim()).filter(Boolean)),
      );
      for (const bucketId of fillsBuckets) {
        const progress = projected[bucketId];
        if (!progress) continue;
        const seen = seenByBucket.get(bucketId) ?? new Set<string>();
        if (seen.has(courseCode)) {
          seenByBucket.set(bucketId, seen);
          continue;
        }
        seen.add(courseCode);
        seenByBucket.set(bucketId, seen);

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
  }

  return projected;
}

export function getPlanLevelProgress(
  response: RecommendationResponse | null | undefined,
): Record<string, BucketProgress> | null | undefined {
  if (!response?.current_progress) return response?.current_progress;

  return buildProjectedProgressFromPlan(response) ?? response.current_progress;
}
