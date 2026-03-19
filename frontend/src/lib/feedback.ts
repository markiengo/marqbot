import type { AppState, FeedbackPayload } from "./types";

export const FEEDBACK_MIN_MESSAGE_LENGTH = 10;
export const FEEDBACK_MAX_MESSAGE_LENGTH = 2000;

function sortStrings(values: Iterable<string>): string[] {
  return Array.from(
    new Set(
      Array.from(values)
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function normalizeFeedbackMessage(message: string): string {
  return String(message || "").trim();
}

export function getFeedbackMessageError(message: string): string | null {
  const normalized = normalizeFeedbackMessage(message);
  if (!normalized) return "Tell me what happened first.";
  if (normalized.length < FEEDBACK_MIN_MESSAGE_LENGTH) {
    return `Give me at least ${FEEDBACK_MIN_MESSAGE_LENGTH} characters so I can actually use it.`;
  }
  if (normalized.length > FEEDBACK_MAX_MESSAGE_LENGTH) {
    return `Keep feedback under ${FEEDBACK_MAX_MESSAGE_LENGTH} characters.`;
  }
  return null;
}

export function buildFeedbackPayload(
  state: AppState,
  route: string,
  rating: number,
  message: string,
): FeedbackPayload {
  return {
    rating,
    message: normalizeFeedbackMessage(message),
    context: {
      source: "planner",
      route: String(route || "/planner").trim() || "/planner",
      session_snapshot: {
        completed: sortStrings(state.completed),
        in_progress: sortStrings(state.inProgress),
        declared_majors: sortStrings(state.selectedMajors),
        declared_tracks: sortStrings(state.selectedTracks),
        declared_minors: sortStrings(state.selectedMinors),
        discovery_theme: String(state.discoveryTheme || "").trim(),
        target_semester: String(state.targetSemester || "").trim(),
        semester_count: String(state.semesterCount || "").trim(),
        max_recs: String(state.maxRecs || "").trim(),
        include_summer: Boolean(state.includeSummer),
        is_honors_student: Boolean(state.isHonorsStudent),
        scheduling_style: state.schedulingStyle,
        student_stage: state.studentStage,
        active_nav_tab: String(state.activeNavTab || "").trim(),
        onboarding_complete: Boolean(state.onboardingComplete),
        last_requested_count: Number(state.lastRequestedCount) || 0,
      },
      recommendation_snapshot: state.lastRecommendationData ?? null,
    },
  };
}
