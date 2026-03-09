import type { RecommendationResponse } from "@/lib/types";

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
