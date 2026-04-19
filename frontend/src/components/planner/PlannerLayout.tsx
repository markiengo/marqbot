"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { Modal } from "@/components/shared/Modal";
import { useProgressMetrics } from "./ProgressDashboard";
import { ProgressModal } from "./ProgressModal";
import { SemesterModal } from "./SemesterModal";
import { EditPlanModal } from "./EditPlanModal";
import { ProfileModal } from "./ProfileModal";
import type { ProfileModalTabKey } from "./ProfileModal";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { SemesterSelector } from "./SemesterSelector";
import { Skeleton } from "@/components/shared/Skeleton";
import { SavePlanModal } from "@/components/saved/SavePlanModal";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
import { CourseListModal } from "./CourseListModal";
import { FeedbackModal } from "./FeedbackModal";
import { MajorGuideModal } from "./MajorGuideModal";
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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [editPlanModalOpen, setEditPlanModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [standingGuideOpen, setStandingGuideOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<ProfileModalTabKey | undefined>(undefined);
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
  const semesters = useMemo(() => visibleData?.semesters ?? [], [visibleData]);
  const hasRecommendations = semesters.length > 0;
  const hasData = state.completed.size > 0 || state.inProgress.size > 0;
  const overallPct = Number.isFinite(metrics.overallPercent)
    ? Math.max(0, Math.min(100, Math.round(metrics.overallPercent)))
    : 0;
  const completedCredits = Number.isFinite(metrics.completedCredits) ? metrics.completedCredits : 0;
  const inProgressCredits = Number.isFinite(metrics.inProgressCredits) ? metrics.inProgressCredits : 0;
  const remainingCredits = Number.isFinite(metrics.remainingCredits) ? metrics.remainingCredits : 0;
  const standingLabel = metrics.standingLabel || "Standing pending";
  const activeSemester = semesters[activeSemesterTab] ?? null;
  const activeSemesterCourses = activeSemester?.recommendations ?? [];
  const activeSemesterCourseCount = activeSemesterCourses.length;
  const activeSemesterCredits = activeSemesterCourses.reduce(
    (sum, course) => sum + Math.max(0, Number(course.credits) || 0),
    0,
  );
  const plannerTermCount = semesters.length || Math.max(0, Number(state.semesterCount) || 0);
  const plannerFocusLabel = activeSemester?.target_semester ?? state.targetSemester;

  const projectedSemesterStanding = useMemo(() => {
    const priorCredits = semesters
      .slice(0, activeSemesterTab)
      .reduce((sum, sem) => sum + (sem.recommendations ?? []).reduce((s, c) => s + Math.max(0, Number(c.credits) || 0), 0), 0);
    const total = completedCredits + inProgressCredits + priorCredits;
    if (total >= 90) return { label: "Senior", color: "text-[#ff9f7a]", border: "border-[#ff9f7a]/30", bg: "bg-[#ff9f7a]/[0.07]" };
    if (total >= 60) return { label: "Junior", color: "text-gold", border: "border-gold/30", bg: "bg-gold/[0.07]" };
    if (total >= 24) return { label: "Sophomore", color: "text-ok", border: "border-ok/30", bg: "bg-ok/[0.07]" };
    return { label: "Freshman", color: "text-[#8ec8ff]", border: "border-[#8ec8ff]/30", bg: "bg-[#8ec8ff]/[0.07]" };
  }, [semesters, activeSemesterTab, completedCredits, inProgressCredits]);
  const schedulingStyleLabel = `${state.schedulingStyle.charAt(0).toUpperCase()}${state.schedulingStyle.slice(1)}`;

  useEffect(() => {
    if (semesters.length === 0) {
      if (activeSemesterTab !== 0) setActiveSemesterTab(0);
      return;
    }
    if (activeSemesterTab > semesters.length - 1) {
      setActiveSemesterTab(semesters.length - 1);
    }
  }, [activeSemesterTab, semesters.length]);

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

  const handleOpenSettings = useCallback(() => {
    setProfileInitialTab("preferences");
    setProfileModalOpen(true);
  }, []);

  const handleOpenFeedback = useCallback(() => {
    openFeedbackModal();
  }, [openFeedbackModal]);

  const handlePrevSemester = useCallback(() => {
    setActiveSemesterTab((current) => Math.max(0, current - 1));
  }, []);

  const handleNextSemester = useCallback(() => {
    setActiveSemesterTab((current) => Math.min(Math.max(semesters.length - 1, 0), current + 1));
  }, [semesters.length]);

  return (
    <div className="planner-shell bg-orbs">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 lg:gap-3">
        <section
          data-testid="planner-progress-strip"
          className="rounded-[1.35rem] border border-white/8 px-4 py-3 shadow-[0_14px_36px_rgba(0,0,0,0.18)] sm:px-5 sm:py-3.5"
          style={{ background: "radial-gradient(ellipse 60% 90% at 95% 0%, rgba(255,204,0,0.07), transparent), radial-gradient(ellipse 45% 70% at 0% 100%, rgba(0,114,206,0.08), transparent), linear-gradient(180deg, rgba(14,28,52,0.92) 0%, rgba(9,20,40,0.97) 100%)" }}
        >
          <div className="flex flex-col gap-2.5">
            {/* Label row + progress bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">Degree Progress</span>
                {primaryProgramLabel && (
                  <span className="hidden text-[11px] text-ink-faint/70 sm:inline">{primaryProgramLabel}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-2 w-28 overflow-hidden rounded-full bg-white/8 sm:w-36">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,rgba(255,204,0,0.76),rgba(255,204,0,1))] transition-all duration-700"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <span className="min-w-[2.5rem] text-right text-sm font-bold tabular-nums text-gold">{overallPct}%</span>
                <button
                  type="button"
                  onClick={openProgressModal}
                  className="rounded-full border border-gold/20 px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:border-gold/35 hover:bg-gold/[0.08] cursor-pointer"
                >
                  View details
                </button>
              </div>
            </div>
            {/* 4 stat cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <button
                type="button"
                onClick={openCompletedCourseList}
                aria-label="Open completed courses"
                className="flex flex-col gap-1 rounded-[0.9rem] border border-ok/20 bg-ok/[0.07] px-3 py-2 text-left transition-colors hover:border-ok/38 hover:bg-ok/[0.12] cursor-pointer"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ok/75">Done</span>
                <span className="text-[1.05rem] font-bold tabular-nums leading-tight text-ok">
                  {completedCredits}<span className="ml-0.5 text-[0.78rem] font-semibold">cr</span>
                </span>
              </button>
              <button
                type="button"
                onClick={openInProgressCourseList}
                aria-label="Open in progress courses"
                className="flex flex-col gap-1 rounded-[0.9rem] border border-gold/20 bg-gold/[0.07] px-3 py-2 text-left transition-colors hover:border-gold/38 hover:bg-gold/[0.12] cursor-pointer"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/75">Active</span>
                <span className="text-[1.05rem] font-bold tabular-nums leading-tight text-gold">
                  {inProgressCredits}<span className="ml-0.5 text-[0.78rem] font-semibold">cr</span>
                </span>
              </button>
              <button
                type="button"
                aria-label="View standing thresholds"
                onClick={() => setStandingGuideOpen(true)}
                className="flex w-full flex-col gap-1 rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06] cursor-pointer"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Standing</span>
                <span className="text-[1.05rem] font-bold leading-tight text-ink">{standingLabel}</span>
              </button>
              <div className="flex flex-col gap-1 rounded-[0.9rem] border border-white/8 bg-white/[0.03] px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Left</span>
                <span className="text-[1.05rem] font-bold tabular-nums leading-tight text-ink">
                  {remainingCredits}<span className="ml-0.5 text-[0.78rem] font-semibold">cr</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          data-testid="planner-semester-card"
          className="flex min-h-0 flex-1 flex-col rounded-[1.75rem] border border-white/8 px-4 py-2.5 shadow-[0_22px_56px_rgba(0,0,0,0.24)] sm:px-5 sm:py-3"
          style={{ background: "radial-gradient(ellipse 55% 45% at 90% 4%, rgba(255,204,0,0.055), transparent), radial-gradient(ellipse 48% 55% at -3% 45%, rgba(0,114,206,0.09), transparent), radial-gradient(ellipse 40% 50% at 55% 98%, rgba(155,126,219,0.055), transparent), linear-gradient(180deg, rgba(12,24,46,0.95) 0%, rgba(7,15,32,0.99) 100%)" }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                    {primaryProgramLabel || "Planner"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                    <span>{plannerTermCount > 0 ? `${plannerTermCount} terms` : "No terms yet"}</span>
                    <span className="text-ink-muted">&middot;</span>
                    <span>{schedulingStyleLabel} mode</span>
                  </div>
                </div>
                <div className="hidden items-center gap-2 md:flex">
                  <span className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.25 text-[11px] font-semibold text-ink-primary shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                    Semester {Math.min(activeSemesterTab + 1, Math.max(plannerTermCount, 1))}
                  </span>
                  <span className="rounded-full border border-white/14 bg-white/[0.06] px-3 py-1.25 text-[11px] font-semibold text-ink-primary shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                    {plannerFocusLabel}
                  </span>
                  {hasRecommendations && (
                    <span className={`rounded-full border px-3 py-1.25 text-[11px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.18)] ${projectedSemesterStanding.color} ${projectedSemesterStanding.border} ${projectedSemesterStanding.bg}`}>
                      {projectedSemesterStanding.label}
                    </span>
                  )}
                </div>
              </div>

              {hasRecommendations && (
                <>
                  <div className="hidden md:block">
                    <SemesterSelector
                      semesters={semesters}
                      selectedIdx={activeSemesterTab}
                      onSelect={setActiveSemesterTab}
                      onExpand={() => setSemesterModalIdx(activeSemesterTab)}
                      variant="filmstrip"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-[1rem] border border-white/6 bg-white/[0.025] px-3 py-1.5 md:hidden">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                        Current term
                      </p>
                      <p className="mt-1 text-sm font-semibold text-ink-primary">
                        Semester {activeSemesterTab + 1} of {Math.max(plannerTermCount, 1)}
                      </p>
                    </div>
                    <p className="text-xs text-ink-faint">Swipe or use arrows</p>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5 border-b border-white/6 pb-2 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    {hasRecommendations ? `Semester ${activeSemesterTab + 1}` : "Semester workspace"}
                  </p>
                  <h2 className="mt-0.5 !text-[clamp(1.225rem,2.45vw,1.925rem)] font-bold tracking-[-0.02em] text-ink">
                    {hasRecommendations ? (activeSemester?.target_semester || plannerFocusLabel) : "Keep the plan in view."}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {hasRecommendations && (
                    <>
                      <span className="rounded-full border border-gold/18 bg-gold/[0.06] px-3 py-1.25 text-[11px] font-semibold text-gold">
                        {activeSemesterCourseCount} courses <span aria-hidden="true">&middot;</span> {activeSemesterCredits}cr
                      </span>
                      <button
                        type="button"
                        onClick={handlePrevSemester}
                        disabled={activeSemesterTab === 0}
                        aria-label="Previous semester"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-ink-secondary transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextSemester}
                        disabled={activeSemesterTab >= semesters.length - 1}
                        aria-label="Next semester"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-ink-secondary transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSemesterModalMode("view");
                          setSemesterModalIdx(activeSemesterTab);
                        }}
                        aria-label={`Expand semester ${activeSemesterTab + 1} details`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-ink-secondary transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-ink cursor-pointer"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3m16 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3m-16 0v3a2 2 0 002 2h3" />
                        </svg>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    aria-label="Edit the plan"
                    onClick={() => setEditPlanModalOpen(true)}
                    disabled={!canOpenEditPlan}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-[#2f7fd3]/40 bg-[#0f284d] px-4 text-sm font-semibold text-[#a9d3ff] transition-colors hover:border-[#2f7fd3]/60 hover:bg-[#16335f] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label="Save plan"
                    onClick={() => { setSaveError(null); setSaveSuccess(null); setSaveModalOpen(true); }}
                    disabled={!savedPlansReady || !canSavePlan}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-gold/35 bg-gold/[0.1] px-4 text-sm font-semibold text-gold transition-colors hover:border-gold/55 hover:bg-gold/[0.16] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>

              {(stageHistoryConflict || saveSuccess || feedbackSuccess || error) && (
                <div className="space-y-2">
                  {stageHistoryConflict && (
                    <div className="rounded-[1rem] border border-gold/18 bg-gold/[0.08] px-4 py-3 text-sm text-gold/90">
                      History includes {studentStageLevelLabel(stageHistoryConflict)}-level coursework, but the planner is locked to {studentStageLabel(state.studentStage).toLowerCase()} recommendations. Recorded courses stay on your profile. Future recommendations and can-take checks stay in the {studentStageLevelLabel(state.studentStage)} band.
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-ok/18 bg-ok-light/40 px-4 py-3 text-sm text-ok">
                      <span>
                        {saveSuccess.mode === "overwrite" ? "Updated" : "Saved"} &ldquo;{saveSuccess.name}&rdquo; in this browser.
                      </span>
                      <Link href="/saved" className="font-semibold underline underline-offset-2">
                        View saved plans
                      </Link>
                    </div>
                  )}
                  {feedbackSuccess && (
                    <div className="rounded-[1rem] border border-ok/18 bg-ok-light/40 px-4 py-3 text-sm text-ok">
                      Feedback sent. Your current planner snapshot went with it.
                    </div>
                  )}
                  {error && (
                    <div className="rounded-[1rem] bg-bad-light px-4 py-3 text-sm text-bad">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {!hasProgram && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-1 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10">
                    <svg className="h-8 w-8 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-primary">No profile loaded.</h3>
                  <p className="mt-2 max-w-sm text-sm text-ink-faint">
                    Open Preferences, pick your program, add completed courses, then run the planner.
                  </p>
                </motion.div>
              )}

              {loading && !data && (
                <div className="flex flex-1 flex-col justify-center gap-3 rounded-[1.25rem] border border-white/6 bg-white/[0.02] p-4">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <p className="mt-2 text-center text-xs text-ink-faint">Crunching 5,300+ courses. One sec.</p>
                </div>
              )}

              {hasProgram && !data && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-1 flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border-subtle bg-surface-card">
                    <svg className="h-8 w-8 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-primary">Planner is ready.</h3>
                  <p className="mt-2 max-w-sm text-sm text-ink-faint">
                    Open Edit to refresh recommendations, then save the version you want to keep here.
                  </p>
                </motion.div>
              )}

              {data && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <RecommendationsPanel
                    embedded
                    compactRows
                    hideHeader
                    hideNavigation
                    data={visibleData ?? data}
                    selectedSemesterIdx={activeSemesterTab}
                    onSemesterChange={setActiveSemesterTab}
                    onExpandSemester={(idx) => {
                      setSemesterModalMode("view");
                      setSemesterModalIdx(idx);
                    }}
                    onCourseClick={setCourseDetailCode}
                  />
                </div>
              )}
            </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-1.5">
              <button
                type="button"
                onClick={handleOpenFeedback}
                className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[14px] font-medium text-ink-secondary shadow-[0_0_12px_rgba(255,255,255,0.06)] transition-all hover:border-white/22 hover:bg-white/[0.08] hover:text-ink hover:shadow-[0_0_18px_rgba(255,255,255,0.10)] cursor-pointer"
              >
                Feedback
              </button>
              <button
                type="button"
                aria-label="Settings"
                onClick={handleOpenSettings}
                className="inline-flex h-[41px] items-center gap-2 rounded-full border border-white/18 bg-white/[0.05] px-[18px] text-[14px] font-semibold text-ink-secondary shadow-[0_0_16px_rgba(255,255,255,0.08),0_0_32px_rgba(255,255,255,0.04)] transition-all hover:border-white/28 hover:bg-white/[0.09] hover:text-ink hover:shadow-[0_0_22px_rgba(255,255,255,0.14),0_0_44px_rgba(255,255,255,0.07)] cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317a1 1 0 011.35-.936l.625.252a1 1 0 00.7 0l.625-.252a1 1 0 011.35.936l.05.675a1 1 0 00.43.74l.553.386a1 1 0 01.21 1.474l-.403.544a1 1 0 000 .84l.403.544a1 1 0 01-.21 1.474l-.553.386a1 1 0 00-.43.74l-.05.675a1 1 0 01-1.35.936l-.625-.252a1 1 0 00-.7 0l-.625.252a1 1 0 01-1.35-.936l-.05-.675a1 1 0 00-.43-.74l-.553-.386a1 1 0 01-.21-1.474l.403-.544a1 1 0 000-.84l-.403-.544a1 1 0 01.21-1.474l.553-.386a1 1 0 00.43-.74l.05-.675z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
            </div>
          </div>
        </section>
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
        onCompletedClick={openCompletedCourseList}
        onInProgressClick={openInProgressCourseList}
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
        onClose={() => { setProfileModalOpen(false); setProfileInitialTab(undefined); }}
        loading={loading}
        error={error}
        onSubmitRecommendations={handleProfileSubmitRecommendations}
        initialTab={profileInitialTab}
      />
      <MajorGuideModal
        open={majorGuideOpen}
        onClose={() => setMajorGuideOpen(false)}
        programs={majorGuideData}
        currentStyle={state.schedulingStyle}
        onFinish={handleGuideFinish}
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
      <Modal
        open={standingGuideOpen}
        onClose={() => setStandingGuideOpen(false)}
        title="Standing by Credits"
      >
        <div className="px-6 pb-6 space-y-3">
          <p className="text-sm text-ink-faint">Based on completed credits earned.</p>
          <div className="space-y-2">
            {(
              [
                { label: "Freshman", range: "0 – 23 cr", valueClass: "text-[#8ec8ff]", borderClass: "border-[#8ec8ff]/30" },
                { label: "Sophomore", range: "24 – 59 cr", valueClass: "text-ok", borderClass: "border-ok/30" },
                { label: "Junior", range: "60 – 89 cr", valueClass: "text-gold", borderClass: "border-gold/30" },
                { label: "Senior", range: "90+ cr", valueClass: "text-[#ff9f7a]", borderClass: "border-[#ff9f7a]/30" },
              ] as const
            ).map(({ label, range, valueClass, borderClass }) => {
              const active = standingLabel.startsWith(label);
              return (
                <div
                  key={label}
                  className={`flex items-center justify-between rounded-[1rem] border px-4 py-3 transition-colors ${
                    active ? `${borderClass} bg-white/[0.05]` : "border-white/8"
                  }`}
                >
                  <span className={`text-sm font-semibold ${active ? valueClass : "text-ink-secondary"}`}>{label}</span>
                  <span className={`text-sm tabular-nums ${active ? `font-bold ${valueClass}` : "text-ink-faint"}`}>{range}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
