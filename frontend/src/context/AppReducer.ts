import type { AppState, Course, ProgramsData, RecommendationResponse, SessionSnapshot } from "@/lib/types";

import {
  DEFAULT_SEMESTER,
  DEFAULT_SEMESTER_COUNT,
  DEFAULT_MAX_RECS,
  AIM_CFA_TRACK_ID,
  FIN_MAJOR_ID,
} from "@/lib/constants";

export type AppAction =
  | { type: "SET_COURSES"; payload: Course[] }
  | { type: "SET_PROGRAMS"; payload: ProgramsData }
  | { type: "ADD_MAJOR"; payload: string }
  | { type: "REMOVE_MAJOR"; payload: string }
  | { type: "SET_TRACK"; payload: { majorId: string; trackId: string | null } }
  | { type: "ADD_MINOR"; payload: string }
  | { type: "REMOVE_MINOR"; payload: string }
  | { type: "SET_DISCOVERY_THEME"; payload: string }
  | { type: "ADD_COMPLETED"; payload: string }
  | { type: "REMOVE_COMPLETED"; payload: string }
  | { type: "ADD_IN_PROGRESS"; payload: string }
  | { type: "REMOVE_IN_PROGRESS"; payload: string }
  | { type: "SET_TARGET_SEMESTER"; payload: string }
  | { type: "SET_SEMESTER_COUNT"; payload: string }
  | { type: "SET_MAX_RECS"; payload: string }
  | { type: "SET_INCLUDE_SUMMER"; payload: boolean }
  | { type: "SET_CAN_TAKE_QUERY"; payload: string }
  | { type: "SET_NAV_TAB"; payload: string }
  | { type: "SET_RECOMMENDATIONS"; payload: { data: RecommendationResponse; count: number } }
  | { type: "RESTORE_SESSION"; payload: SessionSnapshot }
  | { type: "MARK_ONBOARDING_COMPLETE" }
  | { type: "CLEAR_RECOMMENDATIONS" };

export const initialState: AppState = {
  courses: [],
  programs: { majors: [], tracks: [], minors: [], default_track_id: "FIN_MAJOR" },
  completed: new Set<string>(),
  inProgress: new Set<string>(),
  selectedMajors: new Set<string>(),
  selectedTracks: [],
  selectedMinors: new Set<string>(),
  discoveryTheme: "",
  targetSemester: DEFAULT_SEMESTER,
  semesterCount: DEFAULT_SEMESTER_COUNT,
  maxRecs: DEFAULT_MAX_RECS,
  includeSummer: false,
  canTakeQuery: "",
  activeNavTab: "plan",
  onboardingComplete: false,
  lastRecommendationData: null,
  lastRequestedCount: 3,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_COURSES":
      return { ...state, courses: action.payload };

    case "SET_PROGRAMS":
      return { ...state, programs: action.payload };

    case "ADD_MAJOR": {
      const next = new Set(state.selectedMajors);
      next.add(action.payload);
      return { ...state, selectedMajors: next };
    }

    case "REMOVE_MAJOR": {
      const next = new Set(state.selectedMajors);
      next.delete(action.payload);
      // Also clear any track whose parent_major_id matches the removed major
      let nextTracks = state.selectedTracks.filter((tid) => {
        const tr = state.programs.tracks.find((t) => t.id === tid);
        return tr?.parent_major_id !== action.payload;
      });
      // AIM CFA track requires Finance major.
      if (action.payload === FIN_MAJOR_ID) {
        nextTracks = nextTracks.filter((tid) => tid !== AIM_CFA_TRACK_ID);
      }
      return { ...state, selectedMajors: next, selectedTracks: nextTracks };
    }

    case "SET_TRACK": {
      const { majorId, trackId } = action.payload;
      if (trackId === AIM_CFA_TRACK_ID && !state.selectedMajors.has(FIN_MAJOR_ID)) {
        return state;
      }
      // Remove any existing track for this major, then add the new one
      const filtered = state.selectedTracks.filter((tid) => {
        const tr = state.programs.tracks.find((t) => t.id === tid);
        return tr?.parent_major_id !== majorId;
      });
      const nextTracks = trackId ? [...filtered, trackId] : filtered;
      return { ...state, selectedTracks: nextTracks };
    }

    case "ADD_MINOR": {
      const next = new Set(state.selectedMinors);
      next.add(action.payload);
      return { ...state, selectedMinors: next };
    }

    case "REMOVE_MINOR": {
      const next = new Set(state.selectedMinors);
      next.delete(action.payload);
      return { ...state, selectedMinors: next };
    }

    case "SET_DISCOVERY_THEME":
      return { ...state, discoveryTheme: action.payload };

    case "ADD_COMPLETED": {
      const nextCompleted = new Set(state.completed);
      const nextIp = new Set(state.inProgress);
      nextIp.delete(action.payload);
      nextCompleted.add(action.payload);
      return { ...state, completed: nextCompleted, inProgress: nextIp };
    }

    case "REMOVE_COMPLETED": {
      const next = new Set(state.completed);
      next.delete(action.payload);
      return { ...state, completed: next };
    }

    case "ADD_IN_PROGRESS": {
      const nextIp = new Set(state.inProgress);
      const nextCompleted = new Set(state.completed);
      nextCompleted.delete(action.payload);
      nextIp.add(action.payload);
      return { ...state, inProgress: nextIp, completed: nextCompleted };
    }

    case "REMOVE_IN_PROGRESS": {
      const next = new Set(state.inProgress);
      next.delete(action.payload);
      return { ...state, inProgress: next };
    }

    case "SET_TARGET_SEMESTER":
      return { ...state, targetSemester: action.payload };

    case "SET_SEMESTER_COUNT":
      return { ...state, semesterCount: action.payload };

    case "SET_MAX_RECS":
      return { ...state, maxRecs: action.payload };

    case "SET_INCLUDE_SUMMER":
      return { ...state, includeSummer: action.payload };

    case "SET_CAN_TAKE_QUERY":
      return { ...state, canTakeQuery: action.payload };

    case "SET_NAV_TAB":
      return { ...state, activeNavTab: action.payload };

    case "SET_RECOMMENDATIONS":
      return {
        ...state,
        lastRecommendationData: action.payload.data,
        lastRequestedCount: action.payload.count,
      };

    case "RESTORE_SESSION": {
      // If the user just completed onboarding in this session, don't
      // overwrite their fresh selections with stale localStorage data.
      if (state.onboardingComplete) return state;

      const snap = action.payload;
      if (!Array.isArray(state.courses) || state.courses.length === 0) return state;
      const catalog = new Set(state.courses.map((c) => c.course_code));
      const validCode = (code: string) =>
        typeof code === "string" && catalog.has(code);

      const completed = new Set(
        (snap.completed || []).filter(validCode),
      );
      const inProgress = new Set(
        (snap.inProgress || []).filter(
          (code) => validCode(code) && !completed.has(code),
        ),
      );
      const selectedMajors = new Set(
        (snap.declaredMajors || []).filter(Boolean),
      );
      // Support new declaredTracks array; fall back to legacy declaredTrack string
      const selectedTracks = Array.isArray(snap.declaredTracks)
        ? snap.declaredTracks.filter(Boolean)
        : (snap as unknown as { declaredTrack?: string }).declaredTrack
          ? [(snap as unknown as { declaredTrack: string }).declaredTrack]
          : [];
      const sanitizedTracks = selectedTracks.filter(
        (tid) => tid !== AIM_CFA_TRACK_ID || selectedMajors.has(FIN_MAJOR_ID),
      );

      const selectedMinors = new Set(
        (snap.declaredMinors || []).filter(Boolean),
      );

      return {
        ...state,
        completed,
        inProgress,
        selectedMajors,
        selectedTracks: sanitizedTracks,
        selectedMinors,
        discoveryTheme: snap.discoveryTheme || "",
        targetSemester: snap.targetSemester || DEFAULT_SEMESTER,
        semesterCount: snap.semesterCount || DEFAULT_SEMESTER_COUNT,
        maxRecs: snap.maxRecs || DEFAULT_MAX_RECS,
        includeSummer: snap.includeSummer ?? false,
        canTakeQuery: snap.canTake || "",
        activeNavTab: snap.activeNavTab || "plan",
        onboardingComplete: snap.onboardingComplete || false,
        lastRecommendationData: snap.lastRecommendationData || null,
        lastRequestedCount: Number(snap.lastRequestedCount) || state.lastRequestedCount,
      };
    }

    case "CLEAR_RECOMMENDATIONS":
      return { ...state, lastRecommendationData: null };

    case "MARK_ONBOARDING_COMPLETE":
      return { ...state, onboardingComplete: true, lastRecommendationData: null };

    default:
      return state;
  }
}
