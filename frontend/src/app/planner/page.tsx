"use client";

import { Button } from "@/components/shared/Button";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSession } from "@/hooks/useSession";
import { PlannerLayout } from "@/components/planner/PlannerLayout";

function PlannerSessionPersistence() {
  useSession();
  return null;
}

export default function PlannerPage() {
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();

  const isLoading =
    coursesLoading ||
    programsLoading ||
    (!courses.length && !coursesError) ||
    (!programs.majors.length && !programsError);
  const bootstrapError =
    (!courses.length ? coursesError : null) ??
    (!programs.majors.length ? programsError : null);

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">Loading planner data...</p>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 rounded-2xl border border-border-subtle bg-surface-card/70 p-6">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold font-[family-name:var(--font-sora)] text-ink-primary">
              Couldn&apos;t load planner data
            </h1>
            <p className="text-sm text-ink-muted">
              MarqBot needs the course catalog and program list before the planner can run.
            </p>
            <p className="text-sm text-bad">{bootstrapError}</p>
          </div>
          <Button variant="gold" onClick={handleRetry}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PlannerSessionPersistence />
      <PlannerLayout />
    </>
  );
}
