"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { ProgressDashboard, useProgressMetrics } from "./ProgressDashboard";
import { ProgressModal } from "./ProgressModal";
import { SemesterModal } from "./SemesterModal";
import { EditPlanModal } from "./EditPlanModal";
import { ProfileModal } from "./ProfileModal";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { SemesterSelector } from "./SemesterSelector";
import { Skeleton } from "@/components/shared/Skeleton";
import { SavePlanModal } from "@/components/saved/SavePlanModal";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
import { CourseListModal } from "./CourseListModal";
import { FeedbackModal } from "./FeedbackModal";
import { MajorGuideModal } from "./MajorGuideModal";
import { PlannerPrioritiesModal } from "./PlannerPrioritiesModal";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { useAppContext } from "@/context/AppContext";
import { loadProgramBuckets, postReplan } from "@/lib/api";
import { buildRecommendationWarnings, getProgramLabelMap, sanitizeRecommendationWhy } from "@/lib/rendering";
import {
  getCurrentCourseLists,
  normalizeVisibleRecommendationData,
  stripAssumptionsFromCurrentProgress,
} from "@/lib/progressSources";
import { reconcileManualAddPins, updateManualAddPinsFromEdit } from "@/lib/plannerManualAdds";
import { buildSavedPlanInputsFromAppState, hashSavedPlanInputs } from "@/lib/savedPlans";
import { buildSavedPlanProgramLine } from "@/lib/savedPlanPresentation";
import { getStudentStageHistoryConflict, studentStageLabel, studentStageLevelLabel } from "@/lib/studentStage";
import type {
  Course,
  PlannerManualAddPin,
  ReplanResponse,
  ProgramBucketTree,
  RecommendationResponse,
  RecommendedCourse,
  SavePlanMode,
  SavePlanOverwriteOption,
  SavePlanSubmitParams,
  SemesterData,
} from "@/lib/types";

function formatPlanDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* Universal program IDs that every business student uses */
const UNIVERSAL_PROGRAM_IDS = [
  "BCC_CORE", "MCC_CULM", "MCC_DISC", "MCC_ESSV2", "MCC_FOUNDATION", "MCC_WRIT",
];

const MAJOR_GUIDE_SEEN_KEY = "marqbot_major_guide_seen";

export function PlannerLayout() {
  const { state, dispatch } = useAppContext();
  const { data, requestedCount, loading, error, fetchRecommendations, runRecommendationRequest, applyRecommendationData } =
    useRecommendations();
  const { hydrated: savedPlansReady, plans: savedPlans = [], createPlan, updatePlan } = useSavedPlans();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [majorGuideOpen, setMajorGuideOpen] = useState(false);
  const [majorGuideData, setMajorGuideData] = useState<ProgramBucketTree[]>([]);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [explainerStyle, setExplainerStyle] = useState(state.schedulingStyle);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [editPlanModalOpen, setEditPlanModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<{ name: string; mode: SavePlanMode } | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [semEditCandidates, setSemEditCandidates] = useState<RecommendedCourse[] | null>(null);
  const [semEditLoading, setSemEditLoading] = useState(false);
  const [semesterModalMode, setSemesterModalMode] = useState<"view" | "edit">("view");
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);
  const [courseListModal, setCourseListModal] = useState<"completed" | "in-progress" | null>(null);
  const [assumptionsOn, setAssumptionsOn] = useState(false);
  const [activeSemesterTab, setActiveSemesterTab] = useState(0);
  const metrics = useProgressMetrics(assumptionsOn);
  const didAutoFetch = useRef(false);
  const semEditAbortRef = useRef<AbortController | null>(null);
  const semEditRequestIdRef = useRef(0);
  const manualAddPinsRef = useRef<PlannerManualAddPin[]>([]);
  const hasProgram = state.selectedMajors.size > 0 || state.selectedTracks.length > 0;

  // Description lookup map from loaded courses
  const descriptionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of state.courses) {
      if (c.description) m.set(c.course_code, c.description);
    }
    return m;
  }, [state.courses]);
  const catalogCourseMap = useMemo(() => {
    const map = new Map<string, Course>();
    for (const course of state.courses) {
      map.set(course.course_code, course);
    }
    return map;
  }, [state.courses]);
  const courseCreditMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const course of state.courses) {
      map.set(course.course_code, Math.max(0, Number(course.credits) || 0));
    }
    return map;
  }, [state.courses]);

  useEffect(() => {
    if (!explainerOpen) {
      setExplainerStyle(state.schedulingStyle);
    }
  }, [explainerOpen, state.schedulingStyle]);

  const openFeedbackModal = useCallback(() => {
    setFeedbackSuccess(false);
    setFeedbackModalOpen(true);
  }, []);

  const handleFeedbackSubmitted = useCallback(() => {
    setFeedbackSuccess(true);
  }, []);

  const openProgressModal = useCallback(() => {
    setProgressModalOpen(true);
  }, []);

  const openCompletedCourseList = useCallback(() => {
    setCourseListModal("completed");
  }, []);

  const openInProgressCourseList = useCallback(() => {
    setCourseListModal("in-progress");
  }, []);

  // ── Major Guide ──────────────────────────────────────────────────
  const majorGuideSeen = useRef(
    typeof window !== "undefined" && localStorage.getItem(MAJOR_GUIDE_SEEN_KEY) === "true"
  );

  const openMajorGuide = useCallback(async (fallbackToRecs = false) => {
    const programIds = [
      ...state.selectedMajors,
      ...state.selectedTracks,
      ...state.selectedMinors,
      ...UNIVERSAL_PROGRAM_IDS,
    ];
    try {
      const trees = await loadProgramBuckets(programIds);
      setMajorGuideData(trees);
      setMajorGuideOpen(true);
    } catch {
      // Only fall back to recs when called from "Get My Plan" flow
      if (fallbackToRecs) fetchRecommendations();
    }
  }, [state.selectedMajors, state.selectedTracks, state.selectedMinors, fetchRecommendations]);

  const handleGuideFinish = useCallback(() => {
    majorGuideSeen.current = true;
    localStorage.setItem(MAJOR_GUIDE_SEEN_KEY, "true");
    setMajorGuideOpen(false);
    fetchRecommendations();
  }, [fetchRecommendations]);

  const programLabelMap = data?.selection_context
    ? getProgramLabelMap(data.selection_context)
    : undefined;
  const bucketLabelMap = useMemo(() => {
    const raw = state.programs.bucket_labels || {};
    const map = new Map<string, string>();
    Object.entries(raw).forEach(([bucketId, label]) => {
      const id = String(bucketId || "").trim();
      const txt = String(label || "").trim();
      if (id && txt) map.set(id, txt);
    });
    return map;
  }, [state.programs.bucket_labels]);

  const programOrder = data?.selection_context?.selected_program_ids ?? undefined;
  const currentCourseLists = useMemo(
    () => getCurrentCourseLists(data, state.completed, state.inProgress),
    [data, state.completed, state.inProgress],
  );
  const currentAssumptionNotes = useMemo(
    () => (currentCourseLists.inputsMatchState ? data?.current_assumption_notes : undefined),
    [currentCourseLists.inputsMatchState, data?.current_assumption_notes],
  );
  const canonicalCurrentProgress = useMemo(
    () => data?.current_progress,
    [data?.current_progress],
  );
  const activeCurrentProgress = useMemo(
    () => (
      assumptionsOn
        ? canonicalCurrentProgress
        : stripAssumptionsFromCurrentProgress(
            data,
            courseCreditMap,
          ) ?? canonicalCurrentProgress
    ),
    [
      assumptionsOn,
      canonicalCurrentProgress,
      courseCreditMap,
      data,
    ],
  );
  const visibleData = useMemo(
    () => normalizeVisibleRecommendationData(data) ?? null,
    [data],
  );
  const completedCourseCodes = useMemo(
    () => new Set(currentCourseLists.completed),
    [currentCourseLists.completed],
  );
  const inProgressCourseCodes = useMemo(
    () => new Set(currentCourseLists.inProgress),
    [currentCourseLists.inProgress],
  );
  const stageHistoryConflict = useMemo(() => {
    if (!state.studentStageIsExplicit) return null;
    return getStudentStageHistoryConflict({
      studentStage: state.studentStage,
      completed: state.completed,
      inProgress: state.inProgress,
      courses: state.courses,
    });
  }, [state.studentStage, state.studentStageIsExplicit, state.completed, state.inProgress, state.courses]);

  // Reverse map: course_code -> bucket IDs from current_progress allocations
  const courseBucketMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const progress = activeCurrentProgress;
    if (!progress) return map;
    for (const [bucketId, bp] of Object.entries(progress)) {
      for (const code of bp.completed_applied ?? []) {
        const existing = map.get(code);
        if (existing) existing.push(bucketId);
        else map.set(code, [bucketId]);
      }
      for (const code of bp.in_progress_applied ?? []) {
        const existing = map.get(code);
        if (existing) existing.push(bucketId);
        else map.set(code, [bucketId]);
      }
    }
    return map;
  }, [activeCurrentProgress]);
  const recommendedCourseMap = useMemo(() => {
    const map = new Map<string, RecommendedCourse>();
    for (const semester of visibleData?.semesters ?? []) {
      for (const course of semester.recommendations ?? []) {
        map.set(course.course_code, course);
      }
    }
    return map;
  }, [visibleData?.semesters]);
  const detailCourse = courseDetailCode ? recommendedCourseMap.get(courseDetailCode) : undefined;
  const fallbackCourse = courseDetailCode ? catalogCourseMap.get(courseDetailCode) : undefined;
  const detailBuckets = useMemo(
    () => (courseDetailCode ? detailCourse?.fills_buckets ?? courseBucketMap.get(courseDetailCode) : undefined),
    [courseDetailCode, detailCourse, courseBucketMap],
  );
  const detailWarnings = useMemo(
    () => buildRecommendationWarnings(detailCourse),
    [detailCourse],
  );
  const detailReason = useMemo(
    () => sanitizeRecommendationWhy(detailCourse?.why),
    [detailCourse],
  );

  const majorLabelById = useMemo(() => {
    const map = new Map<string, string>();
    state.programs.majors.forEach((m) => map.set(m.id, m.label));
    return map;
  }, [state.programs.majors]);
  const trackLabelById = useMemo(() => {
    const map = new Map<string, string>();
    state.programs.tracks.forEach((t) => map.set(t.id, t.label));
    return map;
  }, [state.programs.tracks]);

  const majorLabels = [...state.selectedMajors]
    .map((id) => majorLabelById.get(id))
    .filter(Boolean) as string[];
  const trackLabels = state.selectedTracks
    .map((tid) => trackLabelById.get(tid))
    .filter(Boolean) as string[];
  const primaryProgramLabel =
    majorLabels.length > 0 ? majorLabels.join(" & ") : trackLabels.join(" & ");
  const canSavePlan = Boolean(data && data.mode !== "error");
  const defaultSaveName = `${primaryProgramLabel || "Plan"} - ${state.targetSemester} - ${formatPlanDate(new Date())}`;
  const saveOverwriteOptions = useMemo<SavePlanOverwriteOption[]>(
    () => savedPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      notes: plan.notes,
      updatedAt: plan.updatedAt,
      programLine: buildSavedPlanProgramLine(plan, state.programs),
      targetSemester: plan.inputs.targetSemester,
    })),
    [savedPlans, state.programs],
  );
  const modalSemester =
    semesterModalIdx !== null ? visibleData?.semesters?.[semesterModalIdx] ?? null : null;
  const canOpenEditPlan = Boolean(visibleData?.semesters?.length);
  const semesters = visibleData?.semesters ?? [];
  const hasRecommendations = semesters.length > 0;
  const hasData = state.completed.size > 0 || state.inProgress.size > 0;
  const overallPct = Math.round(metrics.overallPercent);

  const handleSavePlan = ({ mode, targetPlanId, name, notes }: SavePlanSubmitParams) => {
    if (!data || data.mode === "error") {
      setSaveError("Generate recommendations before saving a plan.");
      return;
    }
    const snapshotData = visibleData ?? data;
    const inputs = buildSavedPlanInputsFromAppState(state);
    const generatedAt = new Date().toISOString();
    const resultsInputHash = hashSavedPlanInputs(inputs);
    const result = mode === "overwrite"
      ? (
        targetPlanId
          ? updatePlan(targetPlanId, {
            name,
            notes,
            inputs,
            manualAddPins: snapshotData.manual_add_pins ?? state.manualAddPins,
            recommendationData: snapshotData,
            lastRequestedCount: requestedCount,
            resultsInputHash,
            lastGeneratedAt: generatedAt,
          })
          : { ok: false, plans: savedPlans, error: "Choose a saved plan to overwrite." }
      )
      : createPlan({
        name,
        notes,
        inputs,
        manualAddPins: snapshotData.manual_add_pins ?? state.manualAddPins,
        recommendationData: snapshotData,
        lastRequestedCount: requestedCount,
      });
    if (!result.ok) {
      setSaveError(
        result.error || (mode === "overwrite" ? "Could not update this plan." : "Could not save this plan."),
      );
      return;
    }
    setSaveError(null);
    setSaveSuccess({ name: result.plan?.name || name, mode });
    setSaveModalOpen(false);
  };

  const resetSemesterEditFetch = useCallback((clearCandidates = true) => {
    semEditRequestIdRef.current += 1;
    semEditAbortRef.current?.abort();
    semEditAbortRef.current = null;
    setSemEditLoading(false);
    if (clearCandidates) setSemEditCandidates(null);
  }, []);

  useEffect(() => {
    if (semesterModalMode === "edit" && semesterModalIdx !== null) {
      return;
    }
    resetSemesterEditFetch();
  }, [resetSemesterEditFetch, semesterModalIdx, semesterModalMode]);

  useEffect(() => {
    return () => {
      semEditAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    manualAddPinsRef.current = data?.manual_add_pins ?? state.manualAddPins;
  }, [data?.manual_add_pins, state.manualAddPins]);

  const buildRecommendationPayload = useCallback((overrides: Record<string, unknown>) => {
    const majors = [...state.selectedMajors];
    const trackIds = [...state.selectedTracks];
    if (state.discoveryTheme && !trackIds.includes(state.discoveryTheme)) {
      trackIds.push(state.discoveryTheme);
    }

    const payload: Record<string, unknown> = {
      student_stage: state.studentStage,
      scheduling_style: state.schedulingStyle,
      ...overrides,
    };
    if (majors.length > 0) payload.declared_majors = majors;
    if (trackIds.length > 0) payload.track_ids = trackIds;
    if (state.selectedMinors.size > 0) payload.declared_minors = [...state.selectedMinors];
    if (state.discoveryTheme) payload.discovery_theme = state.discoveryTheme;
    if (state.includeSummer) payload.include_summer = true;
    if (state.isHonorsStudent) payload.is_honors_student = true;
    return payload;
  }, [
    state.discoveryTheme,
    state.includeSummer,
    state.isHonorsStudent,
    state.schedulingStyle,
    state.selectedMajors,
    state.selectedMinors,
    state.selectedTracks,
    state.studentStage,
  ]);

  const composeRecommendationData = useCallback((params: {
    baseData?: RecommendationResponse | null;
    rerunData: RecommendationResponse | ReplanResponse;
    semesters: SemesterData[];
    manualAddPins: PlannerManualAddPin[];
  }): RecommendationResponse => {
    const { baseData, rerunData, semesters, manualAddPins } = params;
    const rerunLike = rerunData as Partial<RecommendationResponse>;
    return {
      ...(baseData ?? {}),
      ...rerunData,
      semesters,
      manual_add_pins: manualAddPins,
      input_completed_courses: rerunLike.input_completed_courses ?? baseData?.input_completed_courses,
      input_in_progress_courses: rerunLike.input_in_progress_courses ?? baseData?.input_in_progress_courses,
      current_completed_courses: rerunLike.current_completed_courses ?? baseData?.current_completed_courses,
      current_in_progress_courses: rerunLike.current_in_progress_courses ?? baseData?.current_in_progress_courses,
      current_progress: rerunLike.current_progress ?? baseData?.current_progress,
      current_assumption_notes: rerunLike.current_assumption_notes ?? baseData?.current_assumption_notes,
      selection_context: rerunLike.selection_context ?? baseData?.selection_context,
    };
  }, []);

  const applyPinnedRecommendationResult = useCallback((params: {
    baseData?: RecommendationResponse | null;
    rerunData: RecommendationResponse;
    semesters: SemesterData[];
    pins: PlannerManualAddPin[];
    rerunStartIndex: number;
    count?: number;
  }) => {
    const { baseData, rerunData, semesters, pins, rerunStartIndex, count = Number(state.maxRecs) || 3 } = params;
    const reconciled = reconcileManualAddPins({
      semesters,
      pins,
      rerunStartIndex,
    });
    const nextData = composeRecommendationData({
      baseData,
      rerunData,
      semesters: reconciled.semesters,
      manualAddPins: reconciled.pins,
    });
    manualAddPinsRef.current = reconciled.pins;
    applyRecommendationData(nextData, count);
    return nextData;
  }, [applyRecommendationData, composeRecommendationData, state.maxRecs]);

  const handleProfileSubmitRecommendations = useCallback(async () => {
    const maxRecommendations = Number(state.maxRecs) || 3;
    const desiredSemesterCount = Math.max(1, Number(state.semesterCount) || 3);
    const payload = buildRecommendationPayload({
      completed_courses: [...state.completed].join(", "),
      in_progress_courses: [...state.inProgress].join(", "),
      target_semester: state.targetSemester,
      target_semester_primary: state.targetSemester,
      target_semester_count: desiredSemesterCount,
      max_recommendations: maxRecommendations,
    });

    const fresh = await runRecommendationRequest(payload);
    if (!fresh) return null;

    return applyPinnedRecommendationResult({
      baseData: data,
      rerunData: fresh,
      semesters: fresh.semesters ?? [],
      pins: state.manualAddPins.length > 0 ? state.manualAddPins : manualAddPinsRef.current,
      rerunStartIndex: 0,
      count: maxRecommendations,
    });
  }, [
    applyPinnedRecommendationResult,
    buildRecommendationPayload,
    data,
    runRecommendationRequest,
    state.completed,
    state.inProgress,
    state.manualAddPins,
    state.maxRecs,
    state.semesterCount,
    state.targetSemester,
  ]);

  const handleExplainerApply = useCallback(async () => {
    if (explainerStyle === state.schedulingStyle) {
      setExplainerOpen(false);
      return;
    }

    if (!hasProgram || state.courses.length === 0) {
      dispatch({ type: "SET_SCHEDULING_STYLE", payload: explainerStyle });
      setExplainerOpen(false);
      return;
    }

    const maxRecommendations = Number(state.maxRecs) || 3;
    const desiredSemesterCount = Math.max(1, Number(state.semesterCount) || 3);
    const payload = buildRecommendationPayload({
      completed_courses: [...state.completed].join(", "),
      in_progress_courses: [...state.inProgress].join(", "),
      target_semester: state.targetSemester,
      target_semester_primary: state.targetSemester,
      target_semester_count: desiredSemesterCount,
      max_recommendations: maxRecommendations,
      scheduling_style: explainerStyle,
    });

    const fresh = await runRecommendationRequest(payload);
    if (!fresh) return;

    dispatch({ type: "SET_SCHEDULING_STYLE", payload: explainerStyle });
    applyPinnedRecommendationResult({
      baseData: data,
      rerunData: fresh,
      semesters: fresh.semesters ?? [],
      pins: state.manualAddPins.length > 0 ? state.manualAddPins : manualAddPinsRef.current,
      rerunStartIndex: 0,
      count: maxRecommendations,
    });
    setExplainerOpen(false);
  }, [
    applyPinnedRecommendationResult,
    buildRecommendationPayload,
    data,
    dispatch,
    explainerStyle,
    hasProgram,
    runRecommendationRequest,
    state.completed,
    state.courses.length,
    state.inProgress,
    state.manualAddPins,
    state.maxRecs,
    state.schedulingStyle,
    state.semesterCount,
    state.targetSemester,
  ]);

  useEffect(() => {
    if (
      didAutoFetch.current ||
      !state.onboardingComplete ||
      state.lastRecommendationData ||
      !hasProgram ||
      state.courses.length === 0 ||
      loading
    ) return;
    didAutoFetch.current = true;
    void handleProfileSubmitRecommendations();
  }, [
    handleProfileSubmitRecommendations,
    hasProgram,
    loading,
    state.courses.length,
    state.lastRecommendationData,
    state.onboardingComplete,
  ]);

  const fetchCandidatesForSemester = useCallback(async (semIdx: number) => {
    if (!data?.semesters) return;
    const requestId = semEditRequestIdRef.current + 1;
    semEditRequestIdRef.current = requestId;
    semEditAbortRef.current?.abort();
    const controller = new AbortController();
    semEditAbortRef.current = controller;
    setSemEditLoading(true);
    setSemEditCandidates(null);
    try {
      const priorCourses = data.semesters
        .slice(0, semIdx)
        .flatMap((s) => (s.recommendations ?? []).map((r) => r.course_code));
      // Merge completed + in-progress + prior recs into one completed set.
      // In-progress are treated as done for this projection to avoid validation errors.
      const allCompleted = new Set([...state.completed, ...state.inProgress, ...priorCourses]);
      const extCompleted = [...allCompleted].join(", ");
      const majors = [...state.selectedMajors];
      const payload: Record<string, unknown> = {
        completed_courses: extCompleted,
        in_progress_courses: "",
        target_semester: data.semesters[semIdx]?.target_semester ?? state.targetSemester,
        target_semester_primary: data.semesters[semIdx]?.target_semester ?? state.targetSemester,
        target_semester_count: 1,
        max_recommendations: 15,
        student_stage: state.studentStage,
        scheduling_style: state.schedulingStyle,
      };
      if (majors.length > 0) payload.declared_majors = majors;
      const editTrackIds = [...state.selectedTracks];
      if (state.discoveryTheme && !editTrackIds.includes(state.discoveryTheme)) {
        editTrackIds.push(state.discoveryTheme);
      }
      if (editTrackIds.length > 0) payload.track_ids = editTrackIds;
      if (state.selectedMinors.size > 0) payload.declared_minors = [...state.selectedMinors];
      if (state.discoveryTheme) payload.discovery_theme = state.discoveryTheme;
      if (state.includeSummer) payload.include_summer = true;
      if (state.isHonorsStudent) payload.is_honors_student = true;
      const result = await postReplan(payload, { signal: controller.signal });
      if (controller.signal.aborted || requestId !== semEditRequestIdRef.current) return;
      setSemEditCandidates(
        result.semesters?.[0]?.eligible_swaps
        ?? result.semesters?.[0]?.recommendations
        ?? [],
      );
    } catch (error) {
      if (
        controller.signal.aborted ||
        requestId !== semEditRequestIdRef.current ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      setSemEditCandidates([]); // surface empty pool rather than leaving null
    } finally {
      if (requestId === semEditRequestIdRef.current) {
        setSemEditLoading(false);
      }
      if (semEditAbortRef.current === controller) {
        semEditAbortRef.current = null;
      }
    }
  }, [
    data?.semesters,
    state.completed,
    state.inProgress,
    state.targetSemester,
    state.selectedMajors,
    state.selectedTracks,
    state.selectedMinors,
    state.discoveryTheme,
    state.includeSummer,
    state.isHonorsStudent,
    state.studentStage,
    state.schedulingStyle,
  ]);

  const handleSemesterEditApply = useCallback(async (semIdx: number, chosenCourses: RecommendedCourse[]) => {
    if (!data?.semesters) return;
    const totalSems = data.semesters.length;
    const rerunCount = totalSems - semIdx;
    const lockedPrefix = data.semesters.slice(0, semIdx);
    const priorCourses = lockedPrefix.flatMap((s) => (s.recommendations ?? []).map((r) => r.course_code));
    const originalCourses = data.semesters[semIdx]?.recommendations ?? [];
    const editedCodes = chosenCourses.map((c) => c.course_code);
    const allCompleted = new Set([...state.completed, ...state.inProgress, ...priorCourses]);
    const extCompleted = [...allCompleted].join(", ");
    const rerunStart = data.semesters[semIdx]?.target_semester ?? state.targetSemester;
    const payload = buildRecommendationPayload({
      completed_courses: extCompleted,
      in_progress_courses: "",
      selected_courses: editedCodes,
      target_semester: rerunStart,
      target_semester_primary: rerunStart,
      target_semester_count: rerunCount,
      max_recommendations: Number(state.maxRecs) || 3,
    });

    const nextPins = updateManualAddPinsFromEdit({
      existingPins: data.manual_add_pins ?? manualAddPinsRef.current,
      semesterIndex: semIdx,
      originalCourses,
      chosenCourses,
    });

    const downstream = await postReplan(payload);
    applyPinnedRecommendationResult({
      baseData: data,
      rerunData: downstream,
      semesters: [
        ...lockedPrefix,
        ...(downstream.semesters ?? []),
      ],
      pins: nextPins,
      rerunStartIndex: semIdx,
      count: Number(state.maxRecs) || 3,
    });
    resetSemesterEditFetch();
  }, [
    applyPinnedRecommendationResult,
    buildRecommendationPayload,
    data,
    resetSemesterEditFetch,
    state.completed,
    state.inProgress,
    state.maxRecs,
    state.targetSemester,
    updateManualAddPinsFromEdit,
  ]);

  const handleSemesterEditClose = useCallback(() => {
    resetSemesterEditFetch();
    setSemesterModalIdx(null);
    setSemesterModalMode("view");
  }, [resetSemesterEditFetch]);

  const handleEditSemesterSelect = useCallback((index: number) => {
    resetSemesterEditFetch();
    setEditPlanModalOpen(false);
    setSemesterModalMode("edit");
    setSemesterModalIdx(index);
  }, [resetSemesterEditFetch]);

  const handleRequestSemesterCandidates = useCallback(() => {
    if (semesterModalIdx === null) return;
    void fetchCandidatesForSemester(semesterModalIdx);
  }, [fetchCandidatesForSemester, semesterModalIdx]);

  return (
    <div className="planner-shell bg-orbs">
      <div className="flex flex-col gap-4">

        {/* ── Progress Strip ── */}
        <div className="glass-card gradient-border rounded-2xl p-5 sm:p-7 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[1rem] font-bold font-[family-name:var(--font-sora)] text-ink">
              Degree Progress
            </h2>
            <div className="flex items-center gap-3 pt-1">
              <div className="relative h-2 w-36 rounded-full bg-ink-faint/12 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold transition-all duration-700"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <span className="text-sm font-bold tabular-nums text-gold">{overallPct}%</span>
              {hasData && (
                <button
                  type="button"
                  onClick={openProgressModal}
                  className="text-xs font-semibold text-gold bg-gold/8 border border-gold/20 rounded-lg px-3 py-1.5 hover:bg-gold/15 hover:border-gold/35 transition-all cursor-pointer whitespace-nowrap"
                >
                  View details →
                </button>
              )}
            </div>
          </div>
          <ProgressDashboard
            compact
            showAssumptions={assumptionsOn}
            onViewDetails={openProgressModal}
            onCompletedClick={openCompletedCourseList}
            onInProgressClick={openInProgressCourseList}
          />
        </div>

        {/* ── Plan Card ── */}
        <div className="glass-card gradient-border rounded-2xl p-5 sm:p-7 flex flex-col gap-5">
          {/* Card title */}
          <div className="flex flex-col gap-1">
            <h2 className="text-[1rem] font-bold font-[family-name:var(--font-sora)] text-ink">Your Plan</h2>
            {primaryProgramLabel && (
              <p className="text-[0.95rem] font-extrabold tracking-[0.01em] text-gold drop-shadow-[0_0_8px_rgba(255,204,0,0.22)]">
                {primaryProgramLabel}
              </p>
            )}
          </div>

          {/* Action buttons — responsive 5-button row with equal sizing */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <button
              type="button"
              onClick={() => setEditPlanModalOpen(true)}
              disabled={!canOpenEditPlan}
              className="group flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-[#0072CE]/30 bg-[#0072CE]/10 px-3 py-4 text-[#8ec8ff] transition-all duration-200 shadow-[0_0_18px_rgba(0,114,206,0.18),0_0_36px_rgba(0,114,206,0.07)] hover:shadow-[0_0_28px_rgba(0,114,206,0.35),0_0_56px_rgba(0,114,206,0.14)] hover:bg-[#0072CE]/16 hover:border-[#0072CE]/48 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-xs font-semibold text-center leading-tight">Some courses not available? Edit the plan!</span>
            </button>
            <button
              type="button"
              onClick={() => { setSaveError(null); setSaveSuccess(null); setSaveModalOpen(true); }}
              disabled={!savedPlansReady || !canSavePlan}
              className="group flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-gold/35 bg-gold/10 px-3 py-4 text-gold transition-all duration-200 shadow-[0_0_22px_rgba(255,204,0,0.26),0_0_44px_rgba(255,204,0,0.10)] hover:shadow-[0_0_32px_rgba(255,204,0,0.44),0_0_64px_rgba(255,204,0,0.18)] hover:bg-gold/16 hover:border-gold/52 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span className="text-xs font-semibold text-center leading-tight">Satisfied? Save plan!</span>
            </button>
            <button
              type="button"
              onClick={() => { setExplainerStyle(state.schedulingStyle); setExplainerOpen(true); }}
              className="group flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-[#1e9f61]/30 bg-[#1e9f61]/10 px-3 py-4 text-ok transition-all duration-200 shadow-[0_0_18px_rgba(30,159,97,0.18),0_0_36px_rgba(30,159,97,0.07)] hover:shadow-[0_0_28px_rgba(30,159,97,0.35),0_0_56px_rgba(30,159,97,0.14)] hover:bg-[#1e9f61]/16 hover:border-[#1e9f61]/48 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs font-semibold text-center leading-tight">Change your priorities</span>
            </button>
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="group flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-[#9a63ff]/30 bg-[#9a63ff]/10 px-3 py-4 text-[#d3bcff] transition-all duration-200 shadow-[0_0_18px_rgba(154,99,255,0.18),0_0_36px_rgba(154,99,255,0.07)] hover:shadow-[0_0_28px_rgba(154,99,255,0.35),0_0_56px_rgba(154,99,255,0.14)] hover:bg-[#9a63ff]/16 hover:border-[#9a63ff]/48 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-xs font-semibold text-center leading-tight">Change your preferences</span>
            </button>
            <button
              type="button"
              onClick={openFeedbackModal}
              className="group flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border border-[#ff6b8a]/30 bg-[#ff6b8a]/10 px-3 py-4 text-[#ff9fb3] transition-all duration-200 shadow-[0_0_18px_rgba(255,107,138,0.18),0_0_36px_rgba(255,107,138,0.07)] hover:shadow-[0_0_28px_rgba(255,107,138,0.35),0_0_56px_rgba(255,107,138,0.14)] hover:bg-[#ff6b8a]/16 hover:border-[#ff6b8a]/48 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-xs font-semibold text-center leading-tight">Feedback</span>
            </button>
          </div>

          {/* Alert messages */}
          {stageHistoryConflict && (
            <div className="rounded-xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold/85">
              History includes {studentStageLevelLabel(stageHistoryConflict)}-level coursework, but the planner is locked to {studentStageLabel(state.studentStage).toLowerCase()} recommendations. Recorded courses stay on your profile. Future recommendations and can-take checks stay in the {studentStageLevelLabel(state.studentStage)} band.
            </div>
          )}
          {saveSuccess && (
            <div className="rounded-xl border border-ok/20 bg-ok-light/40 px-4 py-3 text-sm text-ok flex flex-wrap items-center justify-between gap-3">
              <span>
                {saveSuccess.mode === "overwrite" ? "Updated" : "Saved"} &ldquo;{saveSuccess.name}&rdquo; in this browser.
              </span>
              <Link href="/saved" className="font-semibold underline underline-offset-2">
                View saved plans
              </Link>
            </div>
          )}
          {feedbackSuccess && (
            <div className="rounded-xl border border-ok/20 bg-ok-light/40 px-4 py-3 text-sm text-ok">
              Feedback sent. Your current planner snapshot went with it.
            </div>
          )}
          {error && (
            <div className="bg-bad-light rounded-xl p-4 text-sm text-bad">
              {error}
            </div>
          )}

          {/* Semester tabs + recommendations */}
          {hasProgram && data && (
            <>
              {hasRecommendations && (
                <div className="flex flex-col gap-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-1 px-1">
                    Recommended Semesters
                  </p>
                  <SemesterSelector
                    semesters={semesters}
                    selectedIdx={activeSemesterTab}
                    onSelect={setActiveSemesterTab}
                    onExpand={() => setSemesterModalIdx(activeSemesterTab)}
                  />
                </div>
              )}
              <RecommendationsPanel
                data={visibleData}
                selectedSemesterIdx={activeSemesterTab}
                onSemesterChange={setActiveSemesterTab}
                onExpandSemester={(idx) => {
                  setSemesterModalMode("view");
                  setSemesterModalIdx(idx);
                }}
                onCourseClick={setCourseDetailCode}
              />
            </>
          )}

          {/* Empty / loading states */}
          {!hasProgram && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center justify-center text-center px-4 py-8 space-y-4"
            >
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center pulse-gold-soft">
                <svg className="w-8 h-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-[0.88rem] font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
                  No profile loaded.
                </h2>
                <p className="text-sm text-ink-faint mt-1 max-w-sm mx-auto">
                  Open the profile panel, pick your program, add completed courses, then run the planner.
                </p>
              </div>
            </motion.div>
          )}

          {hasProgram && !data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center justify-center text-center px-4 py-8 space-y-4"
            >
              <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center border border-border-subtle float-soft">
                <svg className="w-8 h-8 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
                  Planner is ready.
                </h2>
                <p className="text-sm text-ink-faint mt-1">
                  Open Edit Profile to refresh recommendations, then save the version you want to keep here.
                </p>
              </div>
            </motion.div>
          )}

          {loading && !data && (
            <div className="flex flex-col gap-3 p-4 justify-center">
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <p className="text-xs text-ink-faint text-center mt-2">Crunching 5,300+ courses. One sec.</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <EditPlanModal
        open={editPlanModalOpen}
        onClose={() => setEditPlanModalOpen(false)}
        semesters={visibleData?.semesters ?? []}
        onEditSemester={handleEditSemesterSelect}
      />
      <ProgressModal
        open={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        metrics={metrics}
        currentProgress={activeCurrentProgress}
        assumptionNotes={currentAssumptionNotes}
        courses={state.courses}
        programLabelMap={programLabelMap}
        programOrder={programOrder}
        declaredMajors={[...state.selectedMajors]}
        declaredTracks={state.selectedTracks}
        declaredMinors={[...state.selectedMinors]}
        onCourseClick={setCourseDetailCode}
        rawCompleted={state.completed}
        rawInProgress={state.inProgress}
        assumptionsOn={assumptionsOn}
        onToggleAssumptions={() => setAssumptionsOn((prev) => !prev)}
      />
      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={handleSemesterEditClose}
        openMode={semesterModalMode}
        semester={modalSemester}
        index={semesterModalIdx ?? 0}
        totalCount={visibleData?.semesters?.length ?? 0}
        requestedCount={requestedCount}
        courses={state.courses}
        declaredMajors={[...state.selectedMajors]}
        onNext={() => setSemesterModalIdx(i => i !== null && i < (visibleData?.semesters?.length ?? 0) - 1 ? i + 1 : i)}
        onBack={() => setSemesterModalIdx(i => i !== null && i > 0 ? i - 1 : i)}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
        programOrder={programOrder}
        declaredTracks={state.selectedTracks}
        declaredMinors={[...state.selectedMinors]}
        candidatePool={semEditCandidates ?? undefined}
        candidatePoolLoading={semEditLoading}
        onRequestCandidates={handleRequestSemesterCandidates}
        onEditApply={(courses) => {
          if (semesterModalIdx === null) return Promise.resolve();
          return handleSemesterEditApply(semesterModalIdx, courses);
        }}
        onCourseClick={setCourseDetailCode}
      />
      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        loading={loading}
        error={error}
        onSubmitRecommendations={handleProfileSubmitRecommendations}
      />
      <MajorGuideModal
        open={majorGuideOpen}
        onClose={() => setMajorGuideOpen(false)}
        programs={majorGuideData}
        currentStyle={state.schedulingStyle}
        onFinish={handleGuideFinish}
      />
      <PlannerPrioritiesModal
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        currentStyle={explainerStyle}
        onStyleChange={setExplainerStyle}
        appliedStyle={state.schedulingStyle}
        onApply={() => { void handleExplainerApply(); }}
        isApplying={loading}
      />
      <CourseDetailModal
        open={courseDetailCode !== null}
        onClose={() => setCourseDetailCode(null)}
        courseCode={courseDetailCode ?? ""}
        courseName={detailCourse?.course_name ?? fallbackCourse?.course_name}
        credits={detailCourse?.credits ?? fallbackCourse?.credits}
        description={descriptionMap.get(courseDetailCode ?? "")}
        prereqRaw={fallbackCourse?.catalog_prereq_raw}
        buckets={detailBuckets}
        plannerReason={detailReason}
        plannerNotes={detailCourse?.notes}
        plannerWarnings={detailWarnings}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
      />
      <CourseListModal
        open={courseListModal !== null}
        onClose={() => setCourseListModal(null)}
        title={courseListModal === "completed" ? "Credits Completed" : "Credits In Progress"}
        courseCodes={courseListModal === "completed" ? completedCourseCodes : inProgressCourseCodes}
        courses={state.courses}
        assumptionNotes={
          courseListModal === "completed" && currentCourseLists.inputsMatchState
            ? currentAssumptionNotes
            : undefined
        }
        rawCourseCodes={courseListModal === "completed" ? state.completed : undefined}
        assumptionsOn={assumptionsOn}
        onToggleAssumptions={() => setAssumptionsOn((prev) => !prev)}
        onCourseClick={(code) => { setCourseListModal(null); setCourseDetailCode(code); }}
      />
      <SavePlanModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        defaultName={defaultSaveName}
        existingPlans={saveOverwriteOptions}
        defaultOverwriteTargetId={saveOverwriteOptions[0]?.id ?? null}
        onSave={handleSavePlan}
        error={saveError}
        disabled={!savedPlansReady || !canSavePlan}
      />
      <FeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmitted={handleFeedbackSubmitted}
      />
    </div>
  );
}
