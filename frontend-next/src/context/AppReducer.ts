import type { AppState, Course, ProgramsData, RecommendationResponse, SessionSnapshot } from "@/lib/types";
import { DEFAULT_SEMESTER, DEFAULT_SEMESTER_COUNT, DEFAULT_MAX_RECS } from "@/lib/constants";

export type AppAction =
  | { type: "SET_COURSES"; payload: Course[] }
  | { type: "SET_PROGRAMS"; payload: ProgramsData }
  | { type: "ADD_MAJOR"; payload: string }
  | { type: "REMOVE_MAJOR"; payload: string }
  | { type: "SET_TRACK"; payload: string | null }
  | { type: "ADD_COMPLETED"; payload: string }
  | { type: "REMOVE_COMPLETED"; payload: string }
  | { type: "ADD_IN_PROGRESS"; payload: string }
  | { type: "REMOVE_IN_PROGRESS"; payload: string }
  | { type: "SET_TARGET_SEMESTER"; payload: string }
  | { type: "SET_SEMESTER_COUNT"; payload: string }
  | { type: "SET_MAX_RECS"; payload: string }
  | { type: "SET_CAN_TAKE_QUERY"; payload: string }
  | { type: "SET_NAV_TAB"; payload: string }
  | { type: "SET_RECOMMENDATIONS"; payload: { data: RecommendationResponse; count: number } }
  | { type: "RESTORE_SESSION"; payload: SessionSnapshot }
  | { type: "MARK_ONBOARDING_COMPLETE" };

export const initialState: AppState = {
  courses: [],
  programs: { majors: [], tracks: [], default_track_id: "FIN_MAJOR" },
  completed: new Set<string>(),
  inProgress: new Set<string>(),
  selectedMajors: new Set<string>(),
  selectedTrack: null,
  targetSemester: DEFAULT_SEMESTER,
  semesterCount: DEFAULT_SEMESTER_COUNT,
  maxRecs: DEFAULT_MAX_RECS,
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
      return { ...state, selectedMajors: next };
    }

    case "SET_TRACK":
      return { ...state, selectedTrack: action.payload };

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

      return {
        ...state,
        completed,
        inProgress,
        selectedMajors,
        selectedTrack: snap.declaredTrack || null,
        targetSemester: snap.targetSemester || DEFAULT_SEMESTER,
        semesterCount: snap.semesterCount || DEFAULT_SEMESTER_COUNT,
        maxRecs: snap.maxRecs || DEFAULT_MAX_RECS,
        canTakeQuery: snap.canTake || "",
        activeNavTab: snap.activeNavTab || "plan",
        onboardingComplete: snap.onboardingComplete || false,
      };
    }

    case "MARK_ONBOARDING_COMPLETE":
      return { ...state, onboardingComplete: true };

    default:
      return state;
  }
}
