import type { AppState, Course, ProgramsData, RecommendationResponse, SchedulingStyle, SessionSnapshot, StudentStage } from "@/lib/types";
import { resolveStudentStageSelection, syncStudentStageWithHistory } from "@/lib/studentStage";

import {
  DEFAULT_SEMESTER,
  DEFAULT_SEMESTER_COUNT,
  DEFAULT_MAX_RECS,
} from "@/lib/constants";

export type AppAction =
  | { type: "SET_COURSES"; payload: Course[] }
  | { type: "LOAD_COURSES_START" }
  | { type: "LOAD_COURSES_FAILURE"; payload: string }
  | { type: "SET_PROGRAMS"; payload: ProgramsData }
  | { type: "LOAD_PROGRAMS_START" }
  | { type: "LOAD_PROGRAMS_FAILURE"; payload: string }
  | { type: "ADD_MAJOR"; payload: string }
  | { type: "REMOVE_MAJOR"; payload: string }
  | { type: "ADD_TRACK"; payload: string }
  | { type: "SET_TRACK"; payload: { majorId: string; trackId: string | null } }
  | { type: "REMOVE_TRACK"; payload: string }
  | { type: "ADD_MINOR"; payload: string }
  | { type: "REMOVE_MINOR"; payload: string }
  | { type: "SET_DISCOVERY_THEME"; payload: string }
  | { type: "ADD_COMPLETED"; payload: string }
  | { type: "REMOVE_COMPLETED"; payload: string }
  | { type: "ADD_IN_PROGRESS"; payload: string }
  | { type: "REMOVE_IN_PROGRESS"; payload: string }
  | { type: "IMPORT_COURSES"; payload: { completed: string[]; inProgress: string[] } }
  | { type: "SET_TARGET_SEMESTER"; payload: string }
  | { type: "SET_SEMESTER_COUNT"; payload: string }
  | { type: "SET_MAX_RECS"; payload: string }
  | { type: "SET_INCLUDE_SUMMER"; payload: boolean }
  | { type: "SET_HONORS_STUDENT"; payload: boolean }
  | { type: "SET_SCHEDULING_STYLE"; payload: SchedulingStyle }
  | { type: "SET_STUDENT_STAGE"; payload: StudentStage }
  | { type: "SET_CAN_TAKE_QUERY"; payload: string }
  | { type: "SET_NAV_TAB"; payload: string }
  | { type: "SET_RECOMMENDATIONS"; payload: { data: RecommendationResponse; count: number } }
  | { type: "RESTORE_SESSION"; payload: SessionSnapshot }
  | { type: "APPLY_PLANNER_SNAPSHOT"; payload: SessionSnapshot }
  | { type: "MARK_ONBOARDING_COMPLETE" };

export const initialState: AppState = {
  courses: [],
  coursesLoadStatus: "idle",
  coursesLoadError: null,
  programs: { majors: [], tracks: [], minors: [], default_track_id: "" },
  programsLoadStatus: "idle",
  programsLoadError: null,
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
  isHonorsStudent: false,
  schedulingStyle: "grinder" as SchedulingStyle,
  studentStage: "undergrad",
  studentStageIsExplicit: false,
  canTakeQuery: "",
  activeNavTab: "plan",
  onboardingComplete: false,
  lastRecommendationData: null,
  lastRequestedCount: 3,
};

function getTrackById(programs: ProgramsData, trackId: string) {
  return programs.tracks.find((track) => track.id === trackId) || null;
}

function trackRequiredMajorId(programs: ProgramsData, trackId: string): string {
  return String(getTrackById(programs, trackId)?.required_major_id || "").trim();
}

function trackParentMajorId(programs: ProgramsData, trackId: string): string {
  return String(getTrackById(programs, trackId)?.parent_major_id || "").trim();
}

function canSelectTrack(
  programs: ProgramsData,
  selectedMajors: Set<string>,
  trackId: string,
): boolean {
  const requiredMajorId = trackRequiredMajorId(programs, trackId);
  return !requiredMajorId || selectedMajors.has(requiredMajorId);
}

interface NormalizedSessionPayload {
  completed: Set<string>;
  inProgress: Set<string>;
  selectedMajors: Set<string>;
  selectedTracks: string[];
  selectedMinors: Set<string>;
  discoveryTheme: string;
  targetSemester: string;
  semesterCount: string;
  maxRecs: string;
  includeSummer: boolean;
  isHonorsStudent: boolean;
  schedulingStyle: AppState["schedulingStyle"];
  studentStage: AppState["studentStage"];
  studentStageIsExplicit: boolean;
  canTakeQuery: string;
  activeNavTab: string;
  onboardingComplete: boolean;
  lastRecommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
}

function normalizeSessionSnapshot(
  state: AppState,
  snap: SessionSnapshot,
  options?: { forceOnboardingComplete?: boolean; activeNavTab?: string },
): NormalizedSessionPayload {
  const catalog = new Set(state.courses.map((c) => c.course_code));
  const validMajorIds = new Set(state.programs.majors.map((major) => major.id));
  const validTrackIds = new Set(state.programs.tracks.map((track) => track.id));
  const validMinorIds = new Set(state.programs.minors.map((minor) => minor.id));
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
    (snap.declaredMajors || []).filter(
      (majorId) => Boolean(majorId) && (validMajorIds.size === 0 || validMajorIds.has(majorId)),
    ),
  );
  const selectedTracks = Array.isArray(snap.declaredTracks)
    ? snap.declaredTracks.filter(Boolean)
    : (snap as unknown as { declaredTrack?: string }).declaredTrack
      ? [(snap as unknown as { declaredTrack: string }).declaredTrack]
      : [];
  const filteredTracks = selectedTracks.filter(
    (tid) =>
      (validTrackIds.size === 0 || validTrackIds.has(tid)) &&
      canSelectTrack(state.programs, selectedMajors, tid),
  );
  const selectedMinors = new Set(
    (snap.declaredMinors || []).filter(
      (minorId) => Boolean(minorId) && (validMinorIds.size === 0 || validMinorIds.has(minorId)),
    ),
  );
  const selectionWasSanitized =
    filteredTracks.length !== selectedTracks.length;
  const studentStageSelection = resolveStudentStageSelection({
    storedStage: snap.studentStage,
    storedStageIsExplicit: snap.studentStageIsExplicit,
    completed,
    inProgress,
    courses: state.courses,
  });

  return {
    completed,
    inProgress,
    selectedMajors,
    selectedTracks: filteredTracks,
    selectedMinors,
    discoveryTheme: snap.discoveryTheme || "",
    targetSemester: snap.targetSemester || DEFAULT_SEMESTER,
    semesterCount: snap.semesterCount || DEFAULT_SEMESTER_COUNT,
    maxRecs: snap.maxRecs || DEFAULT_MAX_RECS,
    includeSummer: snap.includeSummer ?? false,
    isHonorsStudent: snap.isHonorsStudent ?? false,
    schedulingStyle: (snap.schedulingStyle as SchedulingStyle) || "grinder",
    studentStage: studentStageSelection.studentStage,
    studentStageIsExplicit: studentStageSelection.studentStageIsExplicit,
    canTakeQuery: snap.canTake || "",
    activeNavTab: options?.activeNavTab || snap.activeNavTab || "plan",
    onboardingComplete: options?.forceOnboardingComplete ?? (snap.onboardingComplete || false),
    lastRecommendationData: selectionWasSanitized ? null : (snap.lastRecommendationData || null),
    lastRequestedCount: Number(snap.lastRequestedCount) || state.lastRequestedCount,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_COURSES":
      return {
        ...state,
        ...syncStudentStageWithHistory({
          studentStage: state.studentStage,
          studentStageIsExplicit: state.studentStageIsExplicit,
          completed: state.completed,
          inProgress: state.inProgress,
          courses: action.payload,
        }),
        courses: action.payload,
        coursesLoadStatus: "ready",
        coursesLoadError: null,
      };

    case "LOAD_COURSES_START":
      return {
        ...state,
        coursesLoadStatus: "loading",
        coursesLoadError: null,
      };

    case "LOAD_COURSES_FAILURE":
      return {
        ...state,
        coursesLoadStatus: "error",
        coursesLoadError: action.payload,
      };

    case "SET_PROGRAMS":
      return {
        ...state,
        programs: action.payload,
        programsLoadStatus: "ready",
        programsLoadError: null,
      };

    case "LOAD_PROGRAMS_START":
      return {
        ...state,
        programsLoadStatus: "loading",
        programsLoadError: null,
      };

    case "LOAD_PROGRAMS_FAILURE":
      return {
        ...state,
        programsLoadStatus: "error",
        programsLoadError: action.payload,
      };

    case "ADD_MAJOR": {
      const next = new Set(state.selectedMajors);
      next.add(action.payload);
      return { ...state, selectedMajors: next, lastRecommendationData: null };
    }

    case "REMOVE_MAJOR": {
      const next = new Set(state.selectedMajors);
      next.delete(action.payload);
      const nextTracks = state.selectedTracks.filter((tid) => {
        const parentMajorId = trackParentMajorId(state.programs, tid);
        const requiredMajorId = trackRequiredMajorId(state.programs, tid);
        return parentMajorId !== action.payload && requiredMajorId !== action.payload;
      });
      return { ...state, selectedMajors: next, selectedTracks: nextTracks, lastRecommendationData: null };
    }

    case "ADD_TRACK": {
      const trackId = action.payload;
      if (!canSelectTrack(state.programs, state.selectedMajors, trackId)) {
        return state;
      }
      if (state.selectedTracks.includes(trackId)) {
        return state;
      }
      const nextTracks = [...state.selectedTracks, trackId];
      return { ...state, selectedTracks: nextTracks, lastRecommendationData: null };
    }

    case "SET_TRACK": {
      const { majorId, trackId } = action.payload;
      if (trackId && !canSelectTrack(state.programs, state.selectedMajors, trackId)) {
        return state;
      }
      // Discovery and other single-slot selectors replace the existing track in that family.
      const filtered = state.selectedTracks.filter((tid) => {
        return trackParentMajorId(state.programs, tid) !== majorId;
      });
      const nextTracks = trackId ? [...filtered, trackId] : filtered;
      return { ...state, selectedTracks: nextTracks, lastRecommendationData: null };
    }

    case "REMOVE_TRACK":
      return {
        ...state,
        selectedTracks: state.selectedTracks.filter((tid) => tid !== action.payload),
        lastRecommendationData: null,
      };

    case "ADD_MINOR": {
      const next = new Set(state.selectedMinors);
      next.add(action.payload);
      return { ...state, selectedMinors: next, lastRecommendationData: null };
    }

    case "REMOVE_MINOR": {
      const next = new Set(state.selectedMinors);
      next.delete(action.payload);
      return { ...state, selectedMinors: next, lastRecommendationData: null };
    }

    case "SET_DISCOVERY_THEME":
      return { ...state, discoveryTheme: action.payload, lastRecommendationData: null };

    case "ADD_COMPLETED": {
      const nextCompleted = new Set(state.completed);
      const nextIp = new Set(state.inProgress);
      nextIp.delete(action.payload);
      nextCompleted.add(action.payload);
      return {
        ...state,
        ...syncStudentStageWithHistory({
          studentStage: state.studentStage,
          studentStageIsExplicit: state.studentStageIsExplicit,
          completed: nextCompleted,
          inProgress: nextIp,
          courses: state.courses,
        }),
        completed: nextCompleted,
        inProgress: nextIp,
        lastRecommendationData: null,
      };
    }

    case "REMOVE_COMPLETED": {
      const next = new Set(state.completed);
      next.delete(action.payload);
      return {
        ...state,
        ...syncStudentStageWithHistory({
          studentStage: state.studentStage,
          studentStageIsExplicit: state.studentStageIsExplicit,
          completed: next,
          inProgress: state.inProgress,
          courses: state.courses,
        }),
        completed: next,
        lastRecommendationData: null,
      };
    }

    case "ADD_IN_PROGRESS": {
      const nextIp = new Set(state.inProgress);
      const nextCompleted = new Set(state.completed);
      nextCompleted.delete(action.payload);
      nextIp.add(action.payload);
      return {
        ...state,
        ...syncStudentStageWithHistory({
          studentStage: state.studentStage,
          studentStageIsExplicit: state.studentStageIsExplicit,
          completed: nextCompleted,
          inProgress: nextIp,
          courses: state.courses,
        }),
        inProgress: nextIp,
        completed: nextCompleted,
        lastRecommendationData: null,
      };
    }

    case "REMOVE_IN_PROGRESS": {
      const next = new Set(state.inProgress);
      next.delete(action.payload);
      return {
        ...state,
        ...syncStudentStageWithHistory({
          studentStage: state.studentStage,
          studentStageIsExplicit: state.studentStageIsExplicit,
          completed: state.completed,
          inProgress: next,
          courses: state.courses,
        }),
        inProgress: next,
        lastRecommendationData: null,
      };
    }

    case "IMPORT_COURSES": {
      const nextCompleted = new Set(state.completed);
      const nextIp = new Set(state.inProgress);
      for (const code of action.payload.completed) {
        nextIp.delete(code);
        nextCompleted.add(code);
      }
      for (const code of action.payload.inProgress) {
        nextCompleted.delete(code);
        nextIp.add(code);
      }
      return {
        ...state,
        ...syncStudentStageWithHistory({
          studentStage: state.studentStage,
          studentStageIsExplicit: state.studentStageIsExplicit,
          completed: nextCompleted,
          inProgress: nextIp,
          courses: state.courses,
        }),
        completed: nextCompleted,
        inProgress: nextIp,
        lastRecommendationData: null,
      };
    }

    case "SET_TARGET_SEMESTER":
      return { ...state, targetSemester: action.payload };

    case "SET_SEMESTER_COUNT":
      return { ...state, semesterCount: action.payload };

    case "SET_MAX_RECS":
      return { ...state, maxRecs: action.payload };

    case "SET_INCLUDE_SUMMER":
      return { ...state, includeSummer: action.payload };

    case "SET_HONORS_STUDENT":
      return { ...state, isHonorsStudent: action.payload };

    case "SET_SCHEDULING_STYLE":
      return { ...state, schedulingStyle: action.payload, lastRecommendationData: null };

    case "SET_STUDENT_STAGE":
      return {
        ...state,
        studentStage: action.payload,
        studentStageIsExplicit: true,
        lastRecommendationData: null,
      };

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
      const next = normalizeSessionSnapshot(state, snap);

      return {
        ...state,
        ...next,
      };
    }

    case "APPLY_PLANNER_SNAPSHOT": {
      const snap = action.payload;
      if (!Array.isArray(state.courses) || state.courses.length === 0) return state;
      const next = normalizeSessionSnapshot(state, snap, {
        forceOnboardingComplete: true,
        activeNavTab: "plan",
      });
      return {
        ...state,
        ...next,
      };
    }

    case "MARK_ONBOARDING_COMPLETE":
      return { ...state, onboardingComplete: true, lastRecommendationData: null };

    default:
      return state;
  }
}
