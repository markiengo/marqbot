import type { PlannerManualAddPin, RecommendedCourse, SemesterData } from "@/lib/types";

const PRESERVED_WARNING = "Manual adds in this semester were preserved during rerun.";
const DISPLACED_WARNING = "Manual adds were preserved here, so some rerun courses moved later.";

function normalizeCourseCode(raw: string | null | undefined): string {
  return String(raw || "").trim().toUpperCase();
}

function getCourseConflictCodes(course: RecommendedCourse): Set<string> {
  return new Set(
    [
      ...(course.conflicts_with_courses ?? []),
      ...(course.equivalent_to_courses ?? []),
    ]
      .map((code) => normalizeCourseCode(code))
      .filter(Boolean),
  );
}

function coursesConflict(left: RecommendedCourse, right: RecommendedCourse): boolean {
  const leftCode = normalizeCourseCode(left.course_code);
  const rightCode = normalizeCourseCode(right.course_code);
  if (!leftCode || !rightCode) return false;
  if (leftCode === rightCode) return true;
  return (
    getCourseConflictCodes(left).has(rightCode)
    || getCourseConflictCodes(right).has(leftCode)
  );
}

function cloneCourse(course: RecommendedCourse): RecommendedCourse {
  return {
    ...course,
    course_code: normalizeCourseCode(course.course_code),
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

function appendWarning(semester: SemesterData, warning: string) {
  const text = String(warning || "").trim();
  if (!text) return;
  const next = [...(semester.semester_warnings ?? [])];
  if (!next.includes(text)) next.push(text);
  semester.semester_warnings = next;
}

function mergeSnapshots(
  pin: PlannerManualAddPin,
  freshCourse?: RecommendedCourse,
): RecommendedCourse {
  return {
    ...cloneCourse(pin.course_snapshot),
    ...(freshCourse ? cloneCourse(freshCourse) : {}),
    course_code: normalizeCourseCode(pin.course_code),
    is_manual_add: true,
  };
}

function sortPins(pins: PlannerManualAddPin[]): PlannerManualAddPin[] {
  return [...pins].sort((left, right) => {
    if (left.semester_index !== right.semester_index) {
      return left.semester_index - right.semester_index;
    }
    return left.pinned_at - right.pinned_at;
  });
}

export function updateManualAddPinsFromEdit(params: {
  existingPins?: PlannerManualAddPin[];
  semesterIndex: number;
  originalCourses?: RecommendedCourse[];
  chosenCourses: RecommendedCourse[];
  now?: number;
}): PlannerManualAddPin[] {
  const {
    existingPins = [],
    semesterIndex,
    originalCourses = [],
    chosenCourses,
    now = Date.now(),
  } = params;
  const pinMap = new Map<string, PlannerManualAddPin>();

  for (const pin of existingPins) {
    const code = normalizeCourseCode(pin.course_code);
    if (!code) continue;
    pinMap.set(code, {
      ...pin,
      course_code: code,
      course_snapshot: cloneCourse(pin.course_snapshot),
    });
  }

  const originalCodes = new Set(
    originalCourses
      .map((course) => normalizeCourseCode(course.course_code))
      .filter(Boolean),
  );
  const chosenMap = new Map<string, RecommendedCourse>();
  for (const course of chosenCourses) {
    const code = normalizeCourseCode(course.course_code);
    if (!code) continue;
    chosenMap.set(code, course);
  }

  for (const [code, pin] of [...pinMap.entries()]) {
    if (pin.semester_index === semesterIndex && !chosenMap.has(code)) {
      pinMap.delete(code);
    }
  }

  let offset = 0;
  for (const [code, course] of chosenMap.entries()) {
    if (originalCodes.has(code)) continue;
    pinMap.set(code, {
      course_code: code,
      semester_index: semesterIndex,
      course_snapshot: {
        ...cloneCourse(course),
        course_code: code,
        is_manual_add: true,
      },
      pinned_at: now + offset,
    });
    offset += 1;
  }

  return sortPins([...pinMap.values()]);
}

export function reconcileManualAddPins(params: {
  semesters: SemesterData[];
  pins?: PlannerManualAddPin[];
  rerunStartIndex: number;
}): {
  semesters: SemesterData[];
  pins: PlannerManualAddPin[];
} {
  const { semesters, pins = [], rerunStartIndex } = params;
  const nextSemesters = semesters.map(cloneSemester);
  if (nextSemesters.length === 0) {
    return { semesters: nextSemesters, pins: [] };
  }

  const validPins = sortPins(
    [...pins]
      .map((pin) => ({
        ...pin,
        course_code: normalizeCourseCode(pin.course_code),
        course_snapshot: cloneCourse(pin.course_snapshot),
      }))
      .filter((pin) => (
        pin.course_code &&
        Number.isInteger(pin.semester_index) &&
        pin.semester_index >= 0 &&
        pin.semester_index < nextSemesters.length
      )),
  );

  const capacities = nextSemesters.map((semester, index) => (
    index >= rerunStartIndex ? (semester.recommendations ?? []).length : 0
  ));
  const seenCodes = new Set<string>();

  for (let index = 0; index < rerunStartIndex; index += 1) {
    for (const course of nextSemesters[index]?.recommendations ?? []) {
      const code = normalizeCourseCode(course.course_code);
      if (!code) continue;
      seenCodes.add(code);
      for (const conflictCode of getCourseConflictCodes(course)) {
        seenCodes.add(conflictCode);
      }
    }
  }

  for (let index = rerunStartIndex; index < nextSemesters.length; index += 1) {
    const filtered: RecommendedCourse[] = [];
    for (const course of nextSemesters[index]?.recommendations ?? []) {
      const code = normalizeCourseCode(course.course_code);
      if (!code || seenCodes.has(code)) continue;
      seenCodes.add(code);
      for (const conflictCode of getCourseConflictCodes(course)) {
        seenCodes.add(conflictCode);
      }
      filtered.push({
        ...cloneCourse(course),
        course_code: code,
        is_manual_add: false,
      });
    }
    nextSemesters[index].recommendations = filtered;
    nextSemesters[index].semester_warnings = [];
  }

  const rerunPins = validPins.filter((pin) => pin.semester_index >= rerunStartIndex);
  const pinnedSemesters = new Set<number>();

  const displaceOverflow = (startIndex: number) => {
    for (let index = startIndex; index < nextSemesters.length; index += 1) {
      const recommendations = nextSemesters[index].recommendations ?? [];
      const capacity = capacities[index];
      if (capacity < 0 || recommendations.length <= capacity) return;

      const displacedIndex = recommendations.findLastIndex((course) => !course.is_manual_add);
      if (displacedIndex < 0) {
        appendWarning(nextSemesters[index], PRESERVED_WARNING);
        return;
      }

      const [displacedCourse] = recommendations.splice(displacedIndex, 1);
      appendWarning(nextSemesters[index], DISPLACED_WARNING);

      if (index + 1 >= nextSemesters.length) {
        appendWarning(
          nextSemesters[index],
          `${displacedCourse.course_code} was pushed out of the visible plan to keep your manual adds in place.`,
        );
        return;
      }

      nextSemesters[index + 1].recommendations = [
        ...(nextSemesters[index + 1].recommendations ?? []),
        {
          ...cloneCourse(displacedCourse),
          is_manual_add: false,
        },
      ];
    }
  };

  for (const pin of rerunPins) {
    let freshestCourse: RecommendedCourse | undefined;
    for (let index = rerunStartIndex; index < nextSemesters.length; index += 1) {
      const recommendations = nextSemesters[index].recommendations ?? [];
      nextSemesters[index].recommendations = recommendations.filter((course) => {
        const matches = coursesConflict(course, pin.course_snapshot)
          || normalizeCourseCode(course.course_code) === pin.course_code;
        if (matches && !freshestCourse) {
          freshestCourse = course;
        }
        return !matches;
      });
    }

    const targetSemester = nextSemesters[pin.semester_index];
    if (!targetSemester) continue;
    targetSemester.recommendations = [
      ...(targetSemester.recommendations ?? []),
      mergeSnapshots(pin, freshestCourse),
    ];
    pinnedSemesters.add(pin.semester_index);
    displaceOverflow(pin.semester_index);
  }

  for (const semesterIndex of pinnedSemesters) {
    appendWarning(nextSemesters[semesterIndex], PRESERVED_WARNING);
  }

  return {
    semesters: nextSemesters,
    pins: validPins,
  };
}
