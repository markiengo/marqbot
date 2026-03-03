"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/onboarding/WizardLayout";
import { MajorStep } from "@/components/onboarding/MajorStep";
import { CoursesStep } from "@/components/onboarding/CoursesStep";
import { PreferencesStep } from "@/components/onboarding/PreferencesStep";
import { Button } from "@/components/shared/Button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";

export default function OnboardingPage() {
  const router = useRouter();
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();
  const [prereqWarning, setPrereqWarning] = useState(false);
  const {
    currentStep,
    stepIndex,
    totalSteps,
    isFirst,
    isLast,
    canProceed,
    onlySecondary,
    next,
    back,
    complete,
  } = useOnboarding();

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
          <p className="text-sm text-ink-muted">Pulling course data. One sec.</p>
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
              Couldn&apos;t start onboarding
            </h1>
            <p className="text-sm text-ink-muted">
              Marqbot needs the course catalog and program list before you can set up your plan.
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

  const handleFinish = () => {
    complete();
    router.push("/planner");
  };

  return (
    <WizardLayout currentStep={stepIndex} totalSteps={totalSteps}>
      {currentStep === "majors" && <MajorStep />}
      {currentStep === "courses" && <CoursesStep onWarningChange={setPrereqWarning} />}
      {currentStep === "preferences" && <PreferencesStep />}

      {/* Secondary-only warning */}
      {currentStep === "majors" && onlySecondary() && (
        <div className="bg-warn-light rounded-xl p-4 mt-4 text-base text-warn">
          This major must be paired with a primary major. Please add a primary major to continue.
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border-subtle">
        <div>
          {!isFirst && (
            <Button variant="ghost" size="lg" onClick={back}>
              Back
            </Button>
          )}
        </div>
        <div>
          {isLast ? (
            <Button variant="gold" size="lg" onClick={handleFinish}>
              Let&apos;s Go
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={next}
              disabled={!canProceed() || (currentStep === "courses" && prereqWarning)}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </WizardLayout>
  );
}
