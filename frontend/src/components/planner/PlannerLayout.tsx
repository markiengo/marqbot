"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import { ProgressDashboard, useProgressMetrics } from "./ProgressDashboard";
import { ProgressModal } from "./ProgressModal";
import { SemesterModal } from "./SemesterModal";
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
import { useRecommendations } from "@/hooks/useRecommendations";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import { useAppContext } from "@/context/AppContext";
import { postRecommend } from "@/lib/api";
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
import type { RecommendedCourse, RecommendationResponse, SemesterData } from "@/lib/types";

function formatPlanDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const rankingExplainerItems = [
  {
    id: "1",
    title: "Can you take it now?",
    detail: "If a class is locked, it drops out of the list.",
  },
  {
    id: "2",
    title: "Is it an important class?",
    detail: "Core and major requirements go before extra coverage.",
  },
  {
    id: "3",
    title: "Does it help right away?",
    detail: "A class that counts now beats one that only helps later.",
  },
  {
    id: "4",
    title: "Does it open more doors?",
    detail: "If one class unlocks several later classes, it moves up.",
  },
  {
    id: "5",
    title: "Does it check two boxes?",
    detail: "A class that helps more than one requirement gets a boost.",
  },
  {
    id: "6",
    title: "Is it too hard too soon?",
    detail: "Earlier students get more foundation classes first.",
  },
  {
    id: "7",
    title: "Does it need a partner?",
    detail: "If two classes work better together, MarqBot tries to keep them together.",
  },
  {
    id: "8",
    title: "Requirement diversity",
    detail: "It tries not to fill your whole plan with one kind of requirement.",
  },
  {
    id: "9",
    title: "Does it fit your main path?",
    detail: "It keeps enough picks aimed at the major or track you chose.",
  },
] as const;

export function PlannerLayout() {
  const { state, dispatch } = useAppContext();
  const { data, requestedCount, loading, error, fetchRecommendations } =
    useRecommendations();
  const { hydrated: savedPlansReady, createPlan } = useSavedPlans();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessName, setSaveSuccessName] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackCtaExpanded, setFeedbackCtaExpanded] = useState(false);
  const [canTakeFeedbackEligible, setCanTakeFeedbackEligible] = useState(false);
  const [semEditCandidates, setSemEditCandidates] = useState<RecommendedCourse[] | null>(null);
  const [semEditLoading, setSemEditLoading] = useState(false);
  const [courseDetailCode, setCourseDetailCode] = useState<string | null>(null);
  const [courseListModal, setCourseListModal] = useState<"completed" | "in-progress" | null>(null);
  const closeExplainer = useCallback(() => setExplainerOpen(false), []);
  const metrics = useProgressMetrics();
  const didAutoFetch = useRef(false);
  const plannerMountedAtRef = useRef(Date.now());
  const feedbackLastActiveAtRef = useRef(Date.now());
  const feedbackLastNudgedAtRef = useRef<number | null>(null);
  const feedbackNudgeRecordRef = useRef(readPlannerFeedbackNudgeRecord());
  const hasProgram = state.selectedMajors.size > 0 || state.selectedTracks.length > 0;
  const hasMeaningfulPlannerUse = Boolean(state.lastRecommendationData) || canTakeFeedbackEligible;

  // Description lookup map from loaded courses
  const descriptionMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of state.courses) {
      if (c.description) m.set(c.course_code, c.description);
    }
    return m;
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
      setFeedbackCtaExpanded(false);
    };

    window.addEventListener("keydown", markActivity, true);
    window.addEventListener("pointerdown", markActivity, true);
    window.addEventListener("touchstart", markActivity, true);
    window.addEventListener("scroll", markActivity, true);

    return () => {
      window.removeEventListener("keydown", markActivity, true);
      window.removeEventListener("pointerdown", markActivity, true);
      window.removeEventListener("touchstart", markActivity, true);
      window.removeEventListener("scroll", markActivity, true);
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
      setFeedbackCtaExpanded(true);
    };

    maybeOpenFeedbackNudge();
    const timer = window.setInterval(maybeOpenFeedbackNudge, 1000);
    return () => window.clearInterval(timer);
  }, [feedbackModalOpen, hasMeaningfulPlannerUse]);

  const openFeedbackModal = useCallback(() => {
    setFeedbackSuccess(false);
    setFeedbackCtaExpanded(false);
    setFeedbackModalOpen(true);
  }, []);

  const dismissFeedbackNudge = useCallback(() => {
    const nextRecord = {
      ...feedbackNudgeRecordRef.current,
      dismissedUntil: Date.now() + PLANNER_FEEDBACK_DISMISS_COOLDOWN_MS,
    };
    feedbackNudgeRecordRef.current = nextRecord;
    writePlannerFeedbackNudgeRecord(nextRecord);
    setFeedbackCtaExpanded(false);
  }, []);

  const handleFeedbackSubmitted = useCallback(() => {
    const nextRecord = {
      ...feedbackNudgeRecordRef.current,
      submittedUntil: Date.now() + PLANNER_FEEDBACK_SUBMIT_COOLDOWN_MS,
    };
    feedbackNudgeRecordRef.current = nextRecord;
    writePlannerFeedbackNudgeRecord(nextRecord);
    setFeedbackSuccess(true);
    setFeedbackCtaExpanded(false);
  }, []);

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

  const fetchCandidatesForSemester = async (semIdx: number) => {
    if (!data?.semesters) return;
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
      const result = await postRecommend(payload);
      setSemEditCandidates(result.semesters?.[0]?.recommendations ?? []);
    } catch {
      setSemEditCandidates([]); // surface empty pool rather than leaving null
    } finally {
      setSemEditLoading(false);
    }
  };

  const handleSemesterEditApply = async (semIdx: number, chosenCourses: RecommendedCourse[]) => {
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
      dispatch({
        type: "SET_RECOMMENDATIONS",
        payload: { data: newData, count: Number(state.maxRecs) || 3 },
      });
      setSemEditCandidates(null);
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
    dispatch({
      type: "SET_RECOMMENDATIONS",
      payload: { data: newData, count: Number(state.maxRecs) || 3 },
    });
    setSemEditCandidates(null);
  };

  return (
    <div className="planner-shell bg-orbs">
      {/* ── Header bar ────────────────────────────────────────────── */}
      {hasProgram ? (
        <div className="px-3 sm:px-4 py-2 mb-2 rounded-xl surface-depth-2 shine-sweep flex flex-wrap items-center justify-between gap-2 accent-top-gradient">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm text-ink-faint shrink-0">Planning for:</span>
            <span className="text-xs sm:text-sm font-semibold font-[family-name:var(--font-sora)] text-gold truncate">
              {primaryProgramLabel}
            </span>
            {majorLabels.length > 0 && trackLabels.length > 0 && (
              <span className="hidden sm:inline text-sm text-ink-secondary truncate">
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
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSaveError(null);
                setSaveModalOpen(true);
              }}
              disabled={!savedPlansReady || !canSavePlan}
              className="shrink-0"
            >
              Save Plan
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={fetchRecommendations}
              disabled={loading || !hasProgram}
              className="shrink-0 shadow-[0_0_24px_rgba(255,204,0,0.35),0_0_48px_rgba(255,204,0,0.15)]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-navy border-t-transparent rounded-full animate-spin" />
                  Loading...
                </span>
              ) : (
                "Get My Plan"
              )}
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
                onViewDetails={() => setProgressModalOpen(true)}
                onCompletedClick={() => setCourseListModal("completed")}
                onInProgressClick={() => setCourseListModal("in-progress")}
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
            <div className="mb-2">
              <p className="section-kicker">
                Ranked by eligibility, requirement value, and what each course opens next.
              </p>
              <div className="flex items-center justify-between gap-2 mt-2">
                <h3 className="text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
                  Here&apos;s what to take next.
                </h3>
                <button
                  type="button"
                  onClick={() => setExplainerOpen(true)}
                  className="shrink-0 text-[11px] text-gold bg-gold/8 border border-gold/20 rounded-full px-3 py-1 hover:bg-gold/15 hover:border-gold/35 transition-all"
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
                    Add your profile to get recommendations.
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
                    Hit &ldquo;Get My Plan&rdquo; when you want a ranked next-term view.
                  </p>
                </div>
              </motion.div>
            )}

            {loading && !data && (
              <div className="flex flex-col gap-3 p-4 h-full justify-center">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <p className="text-xs text-ink-faint text-center mt-2">Running the rules. One sec.</p>
              </div>
            )}

            {hasProgram && data && (
              <div className="flex-1 min-h-0">
                <RecommendationsPanel
                  data={data}
                  onExpandSemester={setSemesterModalIdx}
                  onCourseClick={setCourseDetailCode}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
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
      />
      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={() => { setSemesterModalIdx(null); setSemEditCandidates(null); }}
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
        onRequestCandidates={() => { if (semesterModalIdx !== null) fetchCandidatesForSemester(semesterModalIdx); }}
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
        onSubmitRecommendations={fetchRecommendations}
      />
      <Modal
        open={explainerOpen}
        onClose={closeExplainer}
        title="How MarqBot Ranks Courses"
        titleClassName="!text-[clamp(1.55rem,3.2vw,2.2rem)] font-semibold font-[family-name:var(--font-sora)] text-gold"
        size="planner-detail"
      >
        <div className="space-y-4 text-base text-ink-secondary">
          <div className="rounded-2xl border border-gold/20 bg-[linear-gradient(135deg,rgba(255,204,0,0.12),rgba(255,204,0,0.03))] px-4 py-3 sm:px-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold/90">
              Fast Read
            </p>
            <p className="mt-1 text-[0.98rem] leading-relaxed text-ink-primary sm:text-[1.02rem]">
              First, MarqBot removes classes you cannot take yet. Then it sorts what is left by requirement value and unlock potential.
            </p>
          </div>
          <ol className="grid list-none grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="rounded-2xl border border-border-subtle/60 bg-surface-card/45 px-4 py-3 sm:px-5">
            <p className="text-[0.92rem] leading-relaxed text-ink-faint">
              MarqBot assumes you pass the classes in your plan. If your classes change, run it again.
            </p>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-muted">
              This is rule-based, not guesswork. Some catalog rows are still messy, so when the data is unclear, MarqBot plays it safe. Full picture{" "}
              <a
                href="https://github.com/markiengo/marqbot/blob/main/docs/algorithm.md"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
              >
                here
              </a>
              .
            </p>
          </div>
        </div>
      </Modal>
      {(() => {
        const allRecs = data?.semesters?.flatMap(s => s.recommendations ?? []) ?? [];
        const detailCourse = allRecs.find(c => c.course_code === courseDetailCode);
        const fallbackCourse = state.courses.find(c => c.course_code === courseDetailCode);
        const detailBuckets = detailCourse?.fills_buckets ?? courseBucketMap.get(courseDetailCode ?? "");
        return (
          <CourseDetailModal
            open={courseDetailCode !== null}
            onClose={() => setCourseDetailCode(null)}
            courseCode={courseDetailCode ?? ""}
            courseName={detailCourse?.course_name ?? fallbackCourse?.course_name}
            credits={detailCourse?.credits ?? fallbackCourse?.credits}
            description={descriptionMap.get(courseDetailCode ?? "")}
            prereqRaw={fallbackCourse?.catalog_prereq_raw}
            buckets={detailBuckets}
            plannerReason={sanitizeRecommendationWhy(detailCourse?.why)}
            plannerNotes={detailCourse?.notes}
            plannerWarnings={buildRecommendationWarnings(detailCourse)}
            programLabelMap={programLabelMap}
            bucketLabelMap={bucketLabelMap}
          />
        );
      })()}
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
