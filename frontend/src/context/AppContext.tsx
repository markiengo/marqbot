"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
} from "react";
import type { AppState } from "@/lib/types";
import { appReducer, initialState, type AppAction } from "./AppReducer";

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export interface CatalogContextValue {
  courses: AppState["courses"];
  coursesLoadStatus: AppState["coursesLoadStatus"];
  coursesLoadError: AppState["coursesLoadError"];
  programs: AppState["programs"];
  programsLoadStatus: AppState["programsLoadStatus"];
  programsLoadError: AppState["programsLoadError"];
  dispatch: Dispatch<AppAction>;
}

export interface CourseHistoryContextValue {
  completed: AppState["completed"];
  inProgress: AppState["inProgress"];
  dispatch: Dispatch<AppAction>;
}

export interface ProgramSelectionContextValue {
  selectedMajors: AppState["selectedMajors"];
  selectedTracks: AppState["selectedTracks"];
  selectedMinors: AppState["selectedMinors"];
  discoveryTheme: AppState["discoveryTheme"];
  dispatch: Dispatch<AppAction>;
}

export interface PreferencesContextValue {
  targetSemester: AppState["targetSemester"];
  semesterCount: AppState["semesterCount"];
  maxRecs: AppState["maxRecs"];
  includeSummer: AppState["includeSummer"];
  isHonorsStudent: AppState["isHonorsStudent"];
  schedulingStyle: AppState["schedulingStyle"];
  studentStage: AppState["studentStage"];
  studentStageIsExplicit: AppState["studentStageIsExplicit"];
  dispatch: Dispatch<AppAction>;
}

export interface UiContextValue {
  canTakeQuery: AppState["canTakeQuery"];
  activeNavTab: AppState["activeNavTab"];
  onboardingComplete: AppState["onboardingComplete"];
  dispatch: Dispatch<AppAction>;
}

export interface RecommendationContextValue {
  manualAddPins: AppState["manualAddPins"];
  lastRecommendationData: AppState["lastRecommendationData"];
  lastRequestedCount: AppState["lastRequestedCount"];
  dispatch: Dispatch<AppAction>;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);
const CourseHistoryContext = createContext<CourseHistoryContextValue | null>(null);
const ProgramSelectionContext = createContext<ProgramSelectionContextValue | null>(null);
const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const UiContext = createContext<UiContextValue | null>(null);
const RecommendationContext = createContext<RecommendationContextValue | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  initialStateValue?: AppState;
}

export function AppProvider({ children, initialStateValue }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialStateValue ?? initialState);

  const catalogValue = useMemo<CatalogContextValue>(
    () => ({
      courses: state.courses,
      coursesLoadStatus: state.coursesLoadStatus,
      coursesLoadError: state.coursesLoadError,
      programs: state.programs,
      programsLoadStatus: state.programsLoadStatus,
      programsLoadError: state.programsLoadError,
      dispatch,
    }),
    [
      state.courses,
      state.coursesLoadStatus,
      state.coursesLoadError,
      state.programs,
      state.programsLoadStatus,
      state.programsLoadError,
      dispatch,
    ],
  );

  const courseHistoryValue = useMemo<CourseHistoryContextValue>(
    () => ({
      completed: state.completed,
      inProgress: state.inProgress,
      dispatch,
    }),
    [state.completed, state.inProgress, dispatch],
  );

  const programSelectionValue = useMemo<ProgramSelectionContextValue>(
    () => ({
      selectedMajors: state.selectedMajors,
      selectedTracks: state.selectedTracks,
      selectedMinors: state.selectedMinors,
      discoveryTheme: state.discoveryTheme,
      dispatch,
    }),
    [
      state.selectedMajors,
      state.selectedTracks,
      state.selectedMinors,
      state.discoveryTheme,
      dispatch,
    ],
  );

  const preferencesValue = useMemo<PreferencesContextValue>(
    () => ({
      targetSemester: state.targetSemester,
      semesterCount: state.semesterCount,
      maxRecs: state.maxRecs,
      includeSummer: state.includeSummer,
      isHonorsStudent: state.isHonorsStudent,
      schedulingStyle: state.schedulingStyle,
      studentStage: state.studentStage,
      studentStageIsExplicit: state.studentStageIsExplicit,
      dispatch,
    }),
    [
      state.targetSemester,
      state.semesterCount,
      state.maxRecs,
      state.includeSummer,
      state.isHonorsStudent,
      state.schedulingStyle,
      state.studentStage,
      state.studentStageIsExplicit,
      dispatch,
    ],
  );

  const uiValue = useMemo<UiContextValue>(
    () => ({
      canTakeQuery: state.canTakeQuery,
      activeNavTab: state.activeNavTab,
      onboardingComplete: state.onboardingComplete,
      dispatch,
    }),
    [
      state.canTakeQuery,
      state.activeNavTab,
      state.onboardingComplete,
      dispatch,
    ],
  );

  const recommendationValue = useMemo<RecommendationContextValue>(
    () => ({
      manualAddPins: state.manualAddPins,
      lastRecommendationData: state.lastRecommendationData,
      lastRequestedCount: state.lastRequestedCount,
      dispatch,
    }),
    [state.manualAddPins, state.lastRecommendationData, state.lastRequestedCount, dispatch],
  );

  return (
    <CatalogContext.Provider value={catalogValue}>
      <CourseHistoryContext.Provider value={courseHistoryValue}>
        <ProgramSelectionContext.Provider value={programSelectionValue}>
          <PreferencesContext.Provider value={preferencesValue}>
            <UiContext.Provider value={uiValue}>
              <RecommendationContext.Provider value={recommendationValue}>
                {children}
              </RecommendationContext.Provider>
            </UiContext.Provider>
          </PreferencesContext.Provider>
        </ProgramSelectionContext.Provider>
      </CourseHistoryContext.Provider>
    </CatalogContext.Provider>
  );
}

export function useCatalogContext(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalogContext must be used within AppProvider");
  return ctx;
}

export function useCourseHistoryContext(): CourseHistoryContextValue {
  const ctx = useContext(CourseHistoryContext);
  if (!ctx) throw new Error("useCourseHistoryContext must be used within AppProvider");
  return ctx;
}

export function useProgramSelectionContext(): ProgramSelectionContextValue {
  const ctx = useContext(ProgramSelectionContext);
  if (!ctx) throw new Error("useProgramSelectionContext must be used within AppProvider");
  return ctx;
}

export function usePreferencesContext(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferencesContext must be used within AppProvider");
  return ctx;
}

export function useUiContext(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUiContext must be used within AppProvider");
  return ctx;
}

export function useRecommendationContext(): RecommendationContextValue {
  const ctx = useContext(RecommendationContext);
  if (!ctx) throw new Error("useRecommendationContext must be used within AppProvider");
  return ctx;
}

export function useAppContext(): AppContextValue {
  const catalog = useCatalogContext();
  const courseHistory = useCourseHistoryContext();
  const programSelection = useProgramSelectionContext();
  const preferences = usePreferencesContext();
  const ui = useUiContext();
  const recommendation = useRecommendationContext();

  return {
    state: {
      courses: catalog.courses,
      coursesLoadStatus: catalog.coursesLoadStatus,
      coursesLoadError: catalog.coursesLoadError,
      programs: catalog.programs,
      programsLoadStatus: catalog.programsLoadStatus,
      programsLoadError: catalog.programsLoadError,
      completed: courseHistory.completed,
      inProgress: courseHistory.inProgress,
      selectedMajors: programSelection.selectedMajors,
      selectedTracks: programSelection.selectedTracks,
      selectedMinors: programSelection.selectedMinors,
      discoveryTheme: programSelection.discoveryTheme,
      targetSemester: preferences.targetSemester,
      semesterCount: preferences.semesterCount,
      maxRecs: preferences.maxRecs,
      includeSummer: preferences.includeSummer,
      isHonorsStudent: preferences.isHonorsStudent,
      schedulingStyle: preferences.schedulingStyle,
      studentStage: preferences.studentStage,
      studentStageIsExplicit: preferences.studentStageIsExplicit,
      canTakeQuery: ui.canTakeQuery,
      activeNavTab: ui.activeNavTab,
      onboardingComplete: ui.onboardingComplete,
      manualAddPins: recommendation.manualAddPins,
      lastRecommendationData: recommendation.lastRecommendationData,
      lastRequestedCount: recommendation.lastRequestedCount,
    },
    dispatch: ui.dispatch,
  };
}
