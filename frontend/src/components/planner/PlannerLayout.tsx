"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ProgressDashboard, useProgressMetrics } from "./ProgressDashboard";
import { ProgressModal } from "./ProgressModal";
import { SemesterModal } from "./SemesterModal";
import { ProfileModal } from "./ProfileModal";
import { CanTakeSection } from "./CanTakeSection";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useAppContext } from "@/context/AppContext";
import { getProgramLabelMap } from "@/lib/rendering";

export function PlannerLayout() {
  const { state } = useAppContext();
  const { data, requestedCount, loading, error, fetchRecommendations } =
    useRecommendations();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const closeExplainer = useCallback(() => setExplainerOpen(false), []);
  const metrics = useProgressMetrics();
  const didAutoFetch = useRef(false);
  const hasProgram = state.selectedMajors.size > 0 || state.selectedTracks.length > 0;

  // Auto-fetch once when arriving fresh from onboarding with no existing recs
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

  const programLabelMap = data?.selection_context
    ? getProgramLabelMap(data.selection_context)
    : undefined;

  const programOrder = data?.selection_context?.selected_program_ids ?? undefined;

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
  const modalSemester =
    semesterModalIdx !== null ? data?.semesters?.[semesterModalIdx] ?? null : null;

  return (
    <div className="planner-shell">
      {/* ── Header bar ────────────────────────────────────────────── */}
      {hasProgram ? (
        <div className="px-3 sm:px-4 py-2 mb-2 rounded-xl bg-surface-card/60 border border-border-subtle/50 flex flex-wrap items-center justify-between gap-2 accent-top-gold">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs sm:text-sm text-ink-faint shrink-0">Planning for: </span>
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
          <Button
            variant="gold"
            size="sm"
            onClick={fetchRecommendations}
            disabled={loading || !hasProgram}
            className="shrink-0"
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
      ) : (
        <div className="px-4 py-2 mb-2 rounded-xl bg-surface-card/60 border border-border-subtle/50 flex items-center justify-between gap-3">
          <span className="text-sm text-ink-faint">No program selected</span>
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="text-xs font-semibold text-gold hover:text-gold-light transition-colors cursor-pointer"
          >
            Edit Profile
          </button>
        </div>
      )}

      {/* ── Dual-column layout: Progress (40%) + Recommendations (60%) ── */}
      <div className="planner-columns">
        {/* LEFT: Progress (60%) + Can I Take (40%) */}
        <div className="planner-panel planner-left">
          <div className="lg:h-full lg:min-h-0 flex flex-col gap-3">
            <div className="lg:flex-[3] lg:min-h-0">
              <ProgressDashboard onViewDetails={() => setProgressModalOpen(true)} />
            </div>

            <div className="lg:flex-[2] lg:min-h-0">
              <CanTakeSection />
            </div>
          </div>
        </div>

        {/* RIGHT: Recommendations (60%) */}
        <div className="planner-panel planner-right">
          <div className="h-full min-h-0 flex flex-col">
            <div className="mb-2">
              <p className="text-xs font-semibold text-gold leading-tight">
                Ranked by actual degree logic. Expand each semester for details.
              </p>
              <div className="flex items-center justify-between gap-2 mt-2">
                <h3 className="text-lg md:text-xl font-bold font-[family-name:var(--font-sora)] text-white leading-tight">
                  Here&apos;s what to take next.
                </h3>
                <button
                  type="button"
                  onClick={() => setExplainerOpen(true)}
                  className="shrink-0 text-[11px] text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
                >
                  How Marqbot recommends
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-bad-light rounded-xl p-4 text-sm text-bad mb-3">
                {error}
              </div>
            )}

            {!hasProgram && !data && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-4">
                <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center">
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
                  <h2 className="text-lg font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
                    Drop your major to get started.
                  </h2>
                  <p className="text-sm text-ink-faint mt-1 max-w-sm">
                    Hit the edit icon above, pick your major, add your completed courses, then
                    hit &ldquo;Get My Plan.&rdquo; We&apos;ll handle the rest.
                  </p>
                </div>
              </div>
            )}

            {hasProgram && !data && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8 space-y-4">
                <div className="w-16 h-16 bg-surface-card rounded-2xl flex items-center justify-center border border-border-subtle">
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
                    Ready when you are.
                  </h2>
                  <p className="text-sm text-ink-faint mt-1">
                    Hit &ldquo;Get My Plan&rdquo; and let&apos;s build your plan.
                  </p>
                </div>
              </div>
            )}

            {loading && !data && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-ink-faint mt-4">Running the rules. One sec.</p>
              </div>
            )}

            {data && (
              <div className="flex-1 min-h-0">
                <RecommendationsPanel
                  data={data}
                  onExpandSemester={setSemesterModalIdx}
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
        programLabelMap={programLabelMap}
        programOrder={programOrder}
      />
      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={() => setSemesterModalIdx(null)}
        semester={modalSemester}
        index={semesterModalIdx ?? 0}
        requestedCount={requestedCount}
        programLabelMap={programLabelMap}
        programOrder={programOrder}
      />
      <ProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
      <Modal
        open={explainerOpen}
        onClose={closeExplainer}
        title="How Marqbot Recommends Courses"
        titleClassName="!text-[clamp(1.25rem,2.5vw,1.75rem)] font-semibold font-[family-name:var(--font-sora)] text-gold"
        size="planner-detail"
      >
        <div className="space-y-4 text-[16px] text-ink-secondary">
          <div className="space-y-4">
            <p className="text-ink-faint text-[14px]">
              Here&apos;s the simple version: I only show classes that make sense right now, then I put the best ones at the top.
            </p>
            <ol className="space-y-3 list-none">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">1</span>
                <div>
                  <p className="font-semibold text-white text-[16px]">Can you take it right now?</p>
                  <p className="text-ink-faint text-[14px] mt-0.5">If not, I hide it. No prereq? Not offered this term? Not enough credits yet? Then it does not make the list.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">2</span>
                <div>
                  <p className="font-semibold text-white text-[16px]">Does it help with required stuff?</p>
                  <p className="text-ink-faint text-[14px] mt-0.5">Classes that fill required boxes usually come before random extras. Core first. Major next. Flexible stuff later.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">3</span>
                <div>
                  <p className="font-semibold text-white text-[16px]">Is it blocking other classes?</p>
                  <p className="text-ink-faint text-[14px] mt-0.5">Some classes unlock a bunch of other classes. If one class is blocking the road, I push it up.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">4</span>
                <div>
                  <p className="font-semibold text-white text-[16px]">Do you need to start it early?</p>
                  <p className="text-ink-faint text-[14px] mt-0.5">Some classes are step 1 of a long path. If waiting would mess up later semesters, I move that class higher now.</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">5</span>
                <div>
                  <p className="font-semibold text-white text-[16px]">Does one class count for two things?</p>
                  <p className="text-ink-faint text-[14px] mt-0.5">If one class helps with more than one requirement, that&apos;s a great deal. Those usually move up.</p>
                </div>
              </li>
            </ol>
            <p className="text-ink-faint text-[14px] pt-1 border-t border-border-subtle/40">
              I assume you pass the classes in your plan. If your courses change, update them here.
            </p>
            <p className="text-ink-muted text-[13px]">
              This is strong, not perfect. Some rules are still being added. Full picture{" "}
              <a
                href="/about"
                className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
              >
                here
              </a>
              .
            </p>
          </div>
          <div className="hidden">
          <p className="text-ink-faint text-[14px]">
            Hey! Here&apos;s how I pick your courses. No guessing — just rules, top to bottom:
          </p>
          <ol className="space-y-3 list-none">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-semibold text-white text-[16px]">Can you actually take it?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">First, I remove anything you can&apos;t register for. Missing a prereq? Not offered this semester? Not enough credits to qualify? It&apos;s gone. I only show you courses you can actually sign up for.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-semibold text-white text-[16px]">What does it count toward?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">University requirements (PHIL, THEO, ENGL) and business core (BUAD, ECON, ACCO) come first. Then your major. Then your track or concentration. Electives come last. I knock out the important stuff before the flexible stuff.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-semibold text-white text-[16px]">Is it blocking you?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">Some courses are gatekeepers — you can&apos;t take a bunch of other classes until you finish them. I find those bottlenecks and push them to the front so you don&apos;t get stuck later.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">4</span>
              <div>
                <p className="font-semibold text-white text-[16px]">How long is the chain?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">Some courses kick off a sequence that takes multiple semesters to finish. The longer that chain, the earlier you need to start. I make sure you&apos;re not scrambling senior year because you started a 4-course sequence too late.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gold/20 text-gold text-[14px] font-bold flex items-center justify-center">5</span>
              <div>
                <p className="font-semibold text-white text-[16px]">Does it knock out multiple requirements?</p>
                <p className="text-ink-faint text-[14px] mt-0.5">If one course counts toward your major AND your business core at the same time, that&apos;s a two-for-one. Those move up the list because they save you time and credits.</p>
              </div>
            </li>
          </ol>
          <p className="text-ink-faint text-[14px] pt-1 border-t border-border-subtle/40">
            I assume you&apos;ll pass everything. Keep your courses updated so I don&apos;t accidentally plan your downfall.
          </p>
          <p className="text-ink-muted text-[13px]">
            Good, not perfect — some factors aren&apos;t in the engine yet. Full picture{" "}
            <a
              href="/about"
              className="text-gold underline underline-offset-2 hover:text-gold/80 transition-colors"
            >
              here
            </a>
            .
          </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
