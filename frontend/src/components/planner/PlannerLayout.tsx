"use client";

import { useState } from "react";
import { ProgressDashboard, useProgressMetrics } from "./ProgressDashboard";
import { ProgressModal } from "./ProgressModal";
import { SemesterModal } from "./SemesterModal";
import { DegreeSummary } from "./DegreeSummary";
import { CanTakeSection } from "./CanTakeSection";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { InputSidebar } from "./InputSidebar";
import { PreferencesPanel } from "./PreferencesPanel";
import { useRecommendations } from "@/hooks/useRecommendations";
import { useAppContext } from "@/context/AppContext";
import { getProgramLabelMap } from "@/lib/rendering";

export function PlannerLayout() {
  const { state } = useAppContext();
  const { data, requestedCount, loading, error, fetchRecommendations } =
    useRecommendations();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [semesterModalIdx, setSemesterModalIdx] = useState<number | null>(null);
  const metrics = useProgressMetrics();

  const programLabelMap = data?.selection_context
    ? getProgramLabelMap(data.selection_context)
    : undefined;

  const hasMajor = state.selectedMajors.size > 0;

  const majorLabels = [...state.selectedMajors]
    .map((id) => state.programs.majors.find((m) => m.id === id)?.label)
    .filter(Boolean);
  const trackLabel = state.selectedTrack
    ? state.programs.tracks.find((t) => t.id === state.selectedTrack)?.label
    : null;
  const modalSemester =
    semesterModalIdx !== null ? data?.semesters?.[semesterModalIdx] ?? null : null;

  return (
    <div className="planner-shell">
      {hasMajor && (
        <div className="px-4 py-2 mb-2 rounded-xl bg-surface-card/60 border border-border-subtle/50">
          <span className="text-sm text-ink-faint">Planning for: </span>
          <span className="text-sm font-semibold font-[family-name:var(--font-sora)] text-gold">
            {majorLabels.join(" & ")}
          </span>
          {trackLabel && (
            <span className="text-sm text-ink-secondary"> &bull; {trackLabel}</span>
          )}
        </div>
      )}

      <div className="planner-grid">
        <div className="planner-quad planner-quad-tl">
          <InputSidebar />
        </div>

        <div className="planner-quad planner-quad-tr">
          <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-3">
            <div className="min-h-0">
              <ProgressDashboard onViewDetails={() => setProgressModalOpen(true)} />
            </div>

            <div className="min-h-0">
              {data?.current_progress ? (
                <DegreeSummary
                  currentProgress={data.current_progress}
                  programLabelMap={programLabelMap}
                />
              ) : (
                <div className="h-full rounded-2xl border border-border-subtle bg-gradient-to-br from-[#0f2a52]/70 to-[#10284a]/55 p-4 flex items-center justify-center text-center">
                  <p className="text-sm text-ink-faint">
                    Degree summary appears after recommendations are generated.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="planner-quad planner-quad-bl">
          <div className="space-y-5 h-full overflow-y-auto pr-1">
            <PreferencesPanel onSubmit={fetchRecommendations} loading={loading} />
            <div className="pt-3 border-t border-border-subtle">
              <CanTakeSection />
            </div>
          </div>
        </div>

        <div className="planner-quad planner-quad-br">
          <div className="h-full min-h-0 flex flex-col">
            <div className="mb-2">
              <p className="text-xs font-semibold text-gold leading-tight">
                Expand each semester to view recommendations in more details.
              </p>
              <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-sora)] text-white mt-2 leading-tight">
                Recommendations
              </h3>
            </div>

            {error && (
              <div className="bg-bad-light rounded-xl p-4 text-sm text-bad mb-3">
                {error}
              </div>
            )}

            {!hasMajor && !data && (
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
                    Pick your major to get started
                  </h2>
                  <p className="text-sm text-ink-faint mt-1 max-w-sm">
                    Select your major in the panel to the left, add your completed
                    courses, then hit &ldquo;Get Recommendations&rdquo; to unlock your
                    personalized semester plan.
                  </p>
                </div>
              </div>
            )}

            {hasMajor && !data && !loading && (
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
                    Ready to plan
                  </h2>
                  <p className="text-sm text-ink-faint mt-1">
                    Click &ldquo;Get Recommendations&rdquo; to see your semester plan.
                  </p>
                </div>
              </div>
            )}

            {loading && !data && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-10 h-10 border-3 border-gold border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-ink-faint mt-4">Generating recommendations...</p>
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

      <ProgressModal
        open={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
        metrics={metrics}
        currentProgress={data?.current_progress}
        assumptionNotes={data?.current_assumption_notes}
        programLabelMap={programLabelMap}
      />
      <SemesterModal
        open={semesterModalIdx !== null && modalSemester !== null}
        onClose={() => setSemesterModalIdx(null)}
        semester={modalSemester}
        index={semesterModalIdx ?? 0}
        requestedCount={requestedCount}
        programLabelMap={programLabelMap}
      />
    </div>
  );
}
