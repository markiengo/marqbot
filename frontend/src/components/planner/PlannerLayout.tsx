"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { ProgressDashboard, useProgressMetrics } from "./ProgressDashboard";
import { ProgressModal } from "./ProgressModal";
import { SemesterModal } from "./SemesterModal";
import { EditPlanModal } from "./EditPlanModal";
import { ProfileModal } from "./ProfileModal";
import { CanTakeSection } from "./CanTakeSection";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { Skeleton } from "@/components/shared/Skeleton";
import { SavePlanModal } from "@/components/saved/SavePlanModal";
import { CourseDetailModal } from "@/components/shared/CourseDetailModal";
import { CourseListModal } from "./CourseListModal";
import { FeedbackModal } from "./FeedbackModal";
import { MajorGuideModal, rankingExplainerItems, tierLadder } from "./MajorGuideModal";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { useAppContext } from "@/context/AppContext";
import { postRecommend, loadProgramBuckets } from "@/lib/api";
import {
  getPlannerFeedbackCooldownUntil,
  PLANNER_FEEDBACK_DISMISS_COOLDOWN_MS,
  PLANNER_FEEDBACK_IDLE_DELAY_MS,
  PLANNER_FEEDBACK_INITIAL_DELAY_MS,
  PLANNER_FEEDBACK_REPEAT_DELAY_MS,
  PLANNER_FEEDBACK_SUBMIT_COOLDOWN_MS,
  readPlannerFeedbackNudgeRecord,
  writePlannerFeedbackNudgeRecord,
} from "@/lib/plannerFeedbackNudge";
import { buildRecommendationWarnings, getProgramLabelMap, sanitizeRecommendationWhy } from "@/lib/rendering";
import { getCurrentCourseLists } from "@/lib/progressSources";
import { buildSavedPlanInputsFromAppState } from "@/lib/savedPlans";
import { getStudentStageHistoryConflict, studentStageLabel, studentStageLevelLabel } from "@/lib/studentStage";
import type { Course, RecommendedCourse, RecommendationResponse, SemesterData, ProgramBucketTree } from "@/lib/types";

function formatPlanDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFollowupSemesterLabel(currentLabel: string | undefined, includeSummer: boolean): string {
  const match = /^(Spring|Summer|Fall)\s+(\d{4})$/i.exec(String(currentLabel || "").trim());
  if (!match) return includeSummer ? "Summer 2026" : "Fall 2026";
  const term = match[1].toLowerCase();
  const year = Number(match[2]);
  if (term === "spring") return includeSummer ? `Summer ${year}` : `Fall ${year}`;
  if (term === "summer") return `Fall ${year}`;
  return `Spring ${year + 1}`;
}

/* Universal program IDs that every business student uses */
const UNIVERSAL_PROGRAM_IDS = [
  "BCC_CORE", "MCC_CULM", "MCC_DISC", "MCC_ESSV2", "MCC_FOUNDATION", "MCC_WRIT",
];

const MAJOR_GUIDE_SEEN_KEY = "marqbot_major_guide_seen";

export function PlannerLayout() {
  const { state } = useAppContext();
  const { data, requestedCount, loading, error, fetchRecommendations, runRecommendationRequest, applyRecommendationData } =
    useRecommendations();
  const { hydrated: savedPlansReady, createPlan } = useSavedPlans();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [majorGuideOpen, setMajorGuideOpen] = useState(false);
  const [majorGuideData, setMajorGuideData] = useState<ProgramBucketTree[]>([]);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [editPlanModalOpen, setEditPlanModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessName, setSaveSuccessName] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackCtaExpanded, setFeedbackCtaExpanded] = useState(false);
  const [canTakeFeedbackEligible, setCanTakeFeedbackEligible] = useState(false);
  const [semEditCandidates, setSemEditCandidates] = useState<RecommendedCourse[] | null>(null);
  const [semEditLoading, setSemEditLoading] = useState(false);
  const [semesterModalMode, setSemesterModalMode] = useState<"view" | "edit">("view");
  const [lockedSemesterCount, setLockedSemesterCount] = useState(0);
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);
  const [courseListModal, setCourseListModal] = useState<"completed" | "in-progress" | null>(null);
  const metrics = useProgressMetrics();
  const didAutoFetch = useRef(false);
  const plannerMountedAtRef = useRef(Date.now());
  const feedbackLastActiveAtRef = useRef(Date.now());
  const feedbackLastNudgedAtRef = useRef<number | null>(null);
  const feedbackNudgeRecordRef = useRef(readPlannerFeedbackNudgeRecord());
  const feedbackCtaExpandedRef = useRef(false);
  const semEditAbortRef = useRef<AbortController | null>(null);
  const semEditRequestIdRef = useRef(0);
  const hasProgram = state.selectedMajors.size > 0 || state.selectedTracks.length > 0;
  const hasMeaningfulPlannerUse = Boolean(state.lastRecommendationData) || canTakeFeedbackEligible;

  const setFeedbackCtaExpandedState = useCallback((expanded: boolean) => {
    feedbackCtaExpandedRef.current = expanded;
    setFeedbackCtaExpanded(expanded);
  }, []);

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

  // Auto-fetch once when arriving fresh from onboarding with no existing recs
  useEffect(() => {
    feedbackNudgeRecordRef.current = readPlannerFeedbackNudgeRecord();
  }, []);

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
    fetchRecommendations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.onboardingComplete, state.lastRecommendationData, hasProgram, state.courses.length]);

  useEffect(() => {
    const markActivity = () => {
      feedbackLastActiveAtRef.current = Date.now();
      if (feedbackCtaExpandedRef.current) {
        feedbackCtaExpandedRef.current = false;
        setFeedbackCtaExpanded(false);
      }
    };
    const captureOptions = { capture: true } as const;
    const passiveCaptureOptions = { capture: true, passive: true } as const;

    window.addEventListener("keydown", markActivity, captureOptions);
    window.addEventListener("pointerdown", markActivity, passiveCaptureOptions);
    window.addEventListener("touchstart", markActivity, passiveCaptureOptions);
    window.addEventListener("scroll", markActivity, passiveCaptureOptions);

    return () => {
      window.removeEventListener("keydown", markActivity, captureOptions);
      window.removeEventListener("pointerdown", markActivity, passiveCaptureOptions);
      window.removeEventListener("touchstart", markActivity, passiveCaptureOptions);
      window.removeEventListener("scroll", markActivity, passiveCaptureOptions);
    };
  }, []);

  useEffect(() => {
    if (!hasMeaningfulPlannerUse) return;

    const maybeOpenFeedbackNudge = () => {
      if (feedbackModalOpen) return;
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      const cooldownUntil = getPlannerFeedbackCooldownUntil(feedbackNudgeRecordRef.current);
      if (cooldownUntil > now) return;

      if (now - feedbackLastActiveAtRef.current < PLANNER_FEEDBACK_IDLE_DELAY_MS) return;

      const lastNudgedAt = feedbackLastNudgedAtRef.current;
      const nextEligibleAt = lastNudgedAt === null
        ? plannerMountedAtRef.current + PLANNER_FEEDBACK_INITIAL_DELAY_MS
        : lastNudgedAt + PLANNER_FEEDBACK_REPEAT_DELAY_MS;
      if (now < nextEligibleAt) return;

      feedbackLastNudgedAtRef.current = now;
      setFeedbackCtaExpandedState(true);
    };

    maybeOpenFeedbackNudge();
    const timer = window.setInterval(maybeOpenFeedbackNudge, 1000);
    return () => window.clearInterval(timer);
  }, [feedbackModalOpen, hasMeaningfulPlannerUse, setFeedbackCtaExpandedState]);

  const openFeedbackModal = useCallback(() => {
    setFeedbackSuccess(false);
    setFeedbackCtaExpandedState(false);
    setFeedbackModalOpen(true);
  }, [setFeedbackCtaExpandedState]);

  const dismissFeedbackNudge = useCallback(() => {
    const nextRecord = {
      ...feedbackNudgeRecordRef.current,
      dismissedUntil: Date.now() + PLANNER_FEEDBACK_DISMISS_COOLDOWN_MS,
    };
    feedbackNudgeRecordRef.current = nextRecord;
    writePlannerFeedbackNudgeRecord(nextRecord);
    setFeedbackCtaExpandedState(false);
  }, [setFeedbackCtaExpandedState]);

  const handleFeedbackSubmitted = useCallback(() => {
    const nextRecord = {
      ...feedbackNudgeRecordRef.current,
      submittedUntil: Date.now() + PLANNER_FEEDBACK_SUBMIT_COOLDOWN_MS,
    };
    feedbackNudgeRecordRef.current = nextRecord;
    writePlannerFeedbackNudgeRecord(nextRecord);
    setFeedbackSuccess(true);
    setFeedbackCtaExpandedState(false);
  }, [setFeedbackCtaExpandedState]);

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
    const progress = data?.current_progress;
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
  }, [data?.current_progress]);
  const recommendedCourseMap = useMemo(() => {
    const map = new Map<string, RecommendedCourse>();
    for (const semester of data?.semesters ?? []) {
      for (const course of semester.recommendations ?? []) {
        map.set(course.course_code, course);
      }
    }
    return map;
  }, [data?.semesters]);
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
  const modalSemester =
    semesterModalIdx !== null ? data?.semesters?.[semesterModalIdx] ?? null : null;
  const canOpenEditPlan = Boolean(data?.semesters?.length);

  const handleSavePlan = ({ name, notes }: { name: string; notes: string }) => {
    if (!data || data.mode === "error") {
      setSaveError("Generate recommendations before saving a plan.");
      return;
    }
    const result = createPlan({
      name,
      notes,
      inputs: buildSavedPlanInputsFromAppState(state),
      recommendationData: data,
      lastRequestedCount: requestedCount,
    });
    if (!result.ok) {
      setSaveError(result.error || "Could not save this plan.");
      return;
    }
    setSaveError(null);
    setSaveSuccessName(result.plan?.name || name);
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
    setLockedSemesterCount(0);
  }, [
    state.completed,
    state.inProgress,
    state.selectedMajors,
    state.selectedTracks,
    state.selectedMinors,
    state.discoveryTheme,
  ]);

  const handleProfileSubmitRecommendations = useCallback(async () => {
    const maxRecommendations = Number(state.maxRecs) || 3;
    const desiredSemesterCount = Math.max(1, Number(state.semesterCount) || 3);
    const lockedSemesters = data?.semesters?.slice(0, Math.min(lockedSemesterCount, desiredSemesterCount)) ?? [];

    if (lockedSemesters.length === 0) {
      const fresh = await fetchRecommendations();
      if (fresh) setLockedSemesterCount(0);
      return fresh;
    }

    const remainingCount = desiredSemesterCount - lockedSemesters.length;
    if (remainingCount <= 0) {
      const nextData: RecommendationResponse = {
        ...data!,
        semesters: lockedSemesters,
      };
      applyRecommendationData(nextData, maxRecommendations);
      setLockedSemesterCount(lockedSemesters.length);
      return nextData;
    }

    const lockedCourseCodes = lockedSemesters.flatMap(
      (semester) => (semester.recommendations ?? []).map((course) => course.course_code),
    );
    const completedCodes = new Set([
      ...state.completed,
      ...state.inProgress,
      ...lockedCourseCodes,
    ]);
    const downstreamStart =
      data?.semesters?.[lockedSemesters.length]?.target_semester ??
      getFollowupSemesterLabel(lockedSemesters[lockedSemesters.length - 1]?.target_semester, state.includeSummer);

    const majors = [...state.selectedMajors];
    const payload: Record<string, unknown> = {
      completed_courses: [...completedCodes].join(", "),
      in_progress_courses: "",
      target_semester: downstreamStart,
      target_semester_primary: downstreamStart,
      target_semester_count: remainingCount,
      max_recommendations: maxRecommendations,
      student_stage: state.studentStage,
      scheduling_style: state.schedulingStyle,
    };
    if (majors.length > 0) payload.declared_majors = majors;
    const trackIds = [...state.selectedTracks];
    if (state.discoveryTheme && !trackIds.includes(state.discoveryTheme)) {
      trackIds.push(state.discoveryTheme);
    }
    if (trackIds.length > 0) payload.track_ids = trackIds;
    if (state.selectedMinors.size > 0) payload.declared_minors = [...state.selectedMinors];
    if (state.discoveryTheme) payload.discovery_theme = state.discoveryTheme;
    if (state.includeSummer) payload.include_summer = true;
    if (state.isHonorsStudent) payload.is_honors_student = true;

    const downstream = await runRecommendationRequest(payload);
    if (!downstream) return null;

    const nextData: RecommendationResponse = {
      ...downstream,
      semesters: [
        ...lockedSemesters,
        ...(downstream.semesters ?? []),
      ],
    };
    applyRecommendationData(nextData, maxRecommendations);
    setLockedSemesterCount(lockedSemesters.length);
    return nextData;
  }, [
    applyRecommendationData,
    data,
    fetchRecommendations,
    lockedSemesterCount,
    runRecommendationRequest,
    state.completed,
    state.discoveryTheme,
    state.inProgress,
    state.includeSummer,
    state.isHonorsStudent,
    state.maxRecs,
    state.schedulingStyle,
    state.selectedMajors,
    state.selectedMinors,
    state.selectedTracks,
    state.semesterCount,
    state.studentStage,
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
      const result = await postRecommend(payload, { signal: controller.signal });
      if (controller.signal.aborted || requestId !== semEditRequestIdRef.current) return;
      setSemEditCandidates(result.semesters?.[0]?.recommendations ?? []);
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
    const remainingCount = totalSems - semIdx - 1;

    const originalSem = data.semesters[semIdx];
    const editedSem: SemesterData = {
      ...originalSem,
      recommendations: chosenCourses,
      projected_progress: undefined,
    };

    // Last semester: no downstream re-run needed, just splice the edit in
    if (remainingCount <= 0) {
      const newSemesters = [
        ...data.semesters.slice(0, semIdx),
        editedSem,
      ];
      const newData: RecommendationResponse = {
        ...data,
        semesters: newSemesters,
      };
      applyRecommendationData(newData, Number(state.maxRecs) || 3);
      setLockedSemesterCount(semIdx + 1);
      resetSemesterEditFetch();
      return;
    }

    const priorCourses = data.semesters
      .slice(0, semIdx)
      .flatMap((s) => (s.recommendations ?? []).map((r) => r.course_code));
    const editedCodes = chosenCourses.map((c) => c.course_code);
    // Merge original completed + in-progress + prior semester recs + edited courses
    // into a single completed set. In-progress courses are treated as done for
    // downstream projection, avoiding the "prereq still in-progress" validation error.
    const allCompleted = new Set([...state.completed, ...state.inProgress, ...priorCourses, ...editedCodes]);
    const extCompleted = [...allCompleted].join(", ");
    const majors = [...state.selectedMajors];
    const nextSemTarget = data.semesters[semIdx + 1]?.target_semester ?? state.targetSemester;
    const payload: Record<string, unknown> = {
      completed_courses: extCompleted,
      in_progress_courses: "",
      target_semester: nextSemTarget,
      target_semester_primary: nextSemTarget,
      target_semester_count: remainingCount,
      max_recommendations: Number(state.maxRecs) || 3,
      student_stage: state.studentStage,
      scheduling_style: state.schedulingStyle,
    };
    if (majors.length > 0) payload.declared_majors = majors;
    const rerunTrackIds = [...state.selectedTracks];
    if (state.discoveryTheme && !rerunTrackIds.includes(state.discoveryTheme)) {
      rerunTrackIds.push(state.discoveryTheme);
    }
    if (rerunTrackIds.length > 0) payload.track_ids = rerunTrackIds;
    if (state.selectedMinors.size > 0) payload.declared_minors = [...state.selectedMinors];
    if (state.discoveryTheme) payload.discovery_theme = state.discoveryTheme;
    if (state.includeSummer) payload.include_summer = true;
    if (state.isHonorsStudent) payload.is_honors_student = true;

    const downstream: RecommendationResponse = await postRecommend(payload);

    const newSemesters = [
      ...data.semesters.slice(0, semIdx),
      editedSem,
      ...(downstream.semesters ?? []),
    ];
    const newData: RecommendationResponse = {
      ...downstream,
      semesters: newSemesters,
    };
    applyRecommendationData(newData, Number(state.maxRecs) || 3);
    setLockedSemesterCount(semIdx + 1);
    resetSemesterEditFetch();
  }, [
    applyRecommendationData,
    data,
    resetSemesterEditFetch,
    state.completed,
    state.discoveryTheme,
    state.inProgress,
    state.includeSummer,
    state.isHonorsStudent,
    state.maxRecs,
    state.schedulingStyle,
    state.selectedMajors,
    state.selectedMinors,
    state.selectedTracks,
    state.studentStage,
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

  return (
    <div className="planner-shell bg-orbs">
      {/* ── Header bar ────────────────────────────────────────────── */}
      {hasProgram ? (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 rounded-[0.95rem] px-3 py-1.5 surface-depth-2 shine-sweep accent-top-gradient sm:px-3.5">
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            <span className="shrink-0 text-[0.68rem] text-ink-faint sm:text-[0.78rem]">Planning for:</span>
            <button
              type="button"
              onClick={() => openMajorGuide()}
              className="truncate text-[0.74rem] font-semibold font-[family-name:var(--font-sora)] text-gold hover:underline underline-offset-2 decoration-gold/50 transition-all cursor-pointer sm:text-[0.84rem]"
            >
              {primaryProgramLabel}
            </button>
            {majorLabels.length > 0 && trackLabels.length > 0 && (
              <span className="hidden truncate text-[0.78rem] text-ink-secondary sm:inline">
                &bull; {trackLabels.join(" & ")}
              </span>
            )}
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="shrink-0 p-1 rounded-md text-ink-faint hover:text-gold hover:bg-surface-hover transition-colors cursor-pointer"
              aria-label="Edit profile"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <Button
              variant="ink"
              size="xs"
              onClick={() => setEditPlanModalOpen(true)}
              disabled={!canOpenEditPlan}
              className="shrink-0 border-white/10"
            >
              Edit Plan
            </Button>
            <Button
              variant="gold"
              size="xs"
              onClick={() => {
                setSaveError(null);
                setSaveModalOpen(true);
              }}
              disabled={!savedPlansReady || !canSavePlan}
              className="shrink-0 bg-gold text-navy hover:bg-gold-light shadow-[0_0_24px_rgba(255,204,0,0.35),0_0_48px_rgba(255,204,0,0.15)]"
            >
              Save Plan
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-2 mb-2 rounded-xl surface-depth-2 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-faint">No program loaded</span>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="text-xs font-semibold text-gold hover:text-gold-light transition-colors cursor-pointer"
          >
            Add profile
          </button>
        </div>
      )}

      {stageHistoryConflict && (
        <div className="mb-3 rounded-xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold/85">
          History includes {studentStageLevelLabel(stageHistoryConflict)}-level coursework, but the planner is locked to {studentStageLabel(state.studentStage).toLowerCase()} recommendations. Recorded courses stay on your profile. Future recommendations and can-take checks stay in the {studentStageLevelLabel(state.studentStage)} band.
        </div>
      )}

      {saveSuccessName && (
        <div className="mb-3 rounded-xl border border-ok/20 bg-ok-light/40 px-4 py-3 text-sm text-ok flex flex-wrap items-center justify-between gap-3">
          <span>Saved &ldquo;{saveSuccessName}&rdquo; in this browser.</span>
          <Link href="/saved" className="font-semibold underline underline-offset-2">
            View saved plans
          </Link>
        </div>
      )}

      {feedbackSuccess && (
        <div className="mb-3 rounded-xl border border-ok/20 bg-ok-light/40 px-4 py-3 text-sm text-ok">
          Feedback sent. Your current planner snapshot went with it.
        </div>
      )}

      {/* ── Dual-column layout: Progress (40%) + Recommendations (60%) ── */}
      <div className="planner-columns">
        {/* LEFT: Progress (60%) + Can I Take (40%) */}
        <div className="planner-panel planner-left">
          <div className="lg:h-full lg:min-h-0 flex flex-col gap-3">
            <div className="lg:flex-[3] lg:min-h-0">
              <ProgressDashboard
                onViewDetails={openProgressModal}
                onCompletedClick={openCompletedCourseList}
                onInProgressClick={openInProgressCourseList}
              />
            </div>

            <div className="lg:flex-[2] lg:min-h-0">
              <CanTakeSection
                feedbackExpanded={feedbackCtaExpanded}
                onFeedbackOpen={openFeedbackModal}
                onFeedbackDismiss={dismissFeedbackNudge}
                onFeedbackNudgeEligibilityChange={setCanTakeFeedbackEligible}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Recommendations (60%) */}
        <div className="planner-panel planner-right">
          <div className="h-full min-h-0 flex flex-col">
            <div className="mb-2 rounded-[1.05rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[#8ec8ff]">
                Rule-aware ranking
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-[0.98rem] md:text-[1.08rem] font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
                    Your <span className="text-emphasis-blue">next</span> moves.
                  </h3>
                  <p className="mt-0.5 text-[0.7rem] text-ink-faint">
                    Eligibility, requirement value, and unlock impact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExplainerOpen(true)}
                  className="shrink-0 rounded-full border border-gold/20 bg-gold/10 px-2.5 py-0.5 text-[10px] text-gold transition-all hover:bg-gold/15 hover:border-gold/35"
                >
                  How ranking works
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-bad-light rounded-xl p-4 text-sm text-bad mb-3">
                {error}
              </div>
            )}

            {!hasProgram && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 space-y-4"
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
                className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 space-y-4"
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
              <div className="flex flex-col gap-3 p-4 h-full justify-center">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <p className="text-xs text-ink-faint text-center mt-2">Crunching 5,300+ courses. One sec.</p>
              </div>
            )}

            {hasProgram && data && (
              <div className="flex-1 min-h-0">
                <RecommendationsPanel
                  data={data}
                  onExpandSemester={(index) => {
                    setSemesterModalMode("view");
                    setSemesterModalIdx(index);
                  }}
                  onCourseClick={setCourseDetailCode}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      <EditPlanModal
        open={editPlanModalOpen}
        onClose={() => setEditPlanModalOpen(false)}
        semesters={data?.semesters ?? []}
        onEditSemester={handleEditSemesterSelect}
      />
      <ProgressModal
        open={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        metrics={metrics}
        currentProgress={data?.current_progress}
        assumptionNotes={data?.current_assumption_notes}
        courses={state.courses}
        programLabelMap={programLabelMap}
        programOrder={programOrder}
        declaredMajors={[...state.selectedMajors]}
        onCourseClick={setCourseDetailCode}
        rawCompleted={state.completed}
        rawInProgress={state.inProgress}
      />
      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={handleSemesterEditClose}
        openMode={semesterModalMode}
        semester={modalSemester}
        index={semesterModalIdx ?? 0}
        totalCount={data?.semesters?.length ?? 0}
        requestedCount={requestedCount}
        courses={state.courses}
        declaredMajors={[...state.selectedMajors]}
        onNext={() => setSemesterModalIdx(i => i !== null && i < (data?.semesters?.length ?? 0) - 1 ? i + 1 : i)}
        onBack={() => setSemesterModalIdx(i => i !== null && i > 0 ? i - 1 : i)}
        programLabelMap={programLabelMap}
        bucketLabelMap={bucketLabelMap}
        programOrder={programOrder}
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
        onFinish={handleGuideFinish}
      />
      <Modal
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        title="How MarqBot Ranks Courses"
        titleClassName="!text-[clamp(1.55rem,3.2vw,2.2rem)] font-semibold font-[family-name:var(--font-sora)] text-gold"
        size="planner-detail"
      >
        <div className="space-y-4 text-base text-ink-secondary">
          <div className="rounded-2xl border border-gold/20 bg-[linear-gradient(135deg,rgba(255,204,0,0.12),rgba(255,204,0,0.03))] px-4 py-3 sm:px-5 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 90% 50%, rgba(255,204,0,0.06), transparent)" }} aria-hidden />
            <p className="relative text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold/90">
              Fast Read
            </p>
            <p className="relative mt-1 text-[0.98rem] leading-relaxed text-ink-primary sm:text-[1.02rem]">
              MarqBot filters out what you can&rsquo;t take, respects the bucket-counting rules, then ranks the rest by priority and unlock potential.
            </p>
          </div>
          <ol className="grid list-none grid-cols-1 gap-3 sm:grid-cols-2">
            {rankingExplainerItems.map((item, idx) => (
              <li
                key={item.id}
                className="rounded-2xl border border-border-card bg-[linear-gradient(180deg,rgba(11,31,77,0.72),rgba(8,16,36,0.72))] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/18 text-xs font-bold text-gold shadow-[0_0_12px_rgba(255,204,0,0.14)]">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-[1rem] leading-snug">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[0.92rem] leading-relaxed text-ink-faint">
                      {item.detail}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {/* Tier ladder */}
          <div className="rounded-2xl border border-border-card bg-surface-card/40 px-4 py-3.5 sm:px-5 space-y-2.5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">Priority tiers (highest first)</p>
            <div className="space-y-1">
              {tierLadder.map((t, i) => (
                <div key={t.tier} className="flex items-center gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[0.7rem] font-bold tabular-nums"
                    style={{
                      background: `rgba(255,204,0,${0.18 - i * 0.025})`,
                      color: i < 2 ? "rgba(255,204,0,1)" : "rgba(255,204,0,0.7)",
                      border: `1px solid rgba(255,204,0,${0.25 - i * 0.035})`,
                    }}
                  >
                    {t.tier}
                  </span>
                  <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[0.88rem] font-semibold text-ink-primary leading-snug">{t.label}</span>
                    <span className="text-[0.78rem] text-ink-faint leading-snug">&mdash; {t.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[0.82rem] text-ink-faint leading-relaxed pt-1">
              Within a tier, courses that unblock deeper prereq chains, still help more than one allowed bucket, or sit at a lower course level are picked first.
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle/60 bg-surface-card/45 px-4 py-3 sm:px-5">
            <p className="text-[0.92rem] leading-relaxed text-ink-muted">
              Deterministic rules, not guesswork.{" "}
              <a
                href="https://github.com/markiengo/marqbot/blob/main/docs/memos/algorithm.md"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
              >
                Full technical breakdown here
              </a>
              .
            </p>
          </div>
        </div>
      </Modal>
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
            ? data?.current_assumption_notes
            : undefined
        }
        rawCourseCodes={courseListModal === "completed" ? state.completed : undefined}
        onCourseClick={(code) => { setCourseListModal(null); setCourseDetailCode(code); }}
      />
      <SavePlanModal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        defaultName={defaultSaveName}
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
