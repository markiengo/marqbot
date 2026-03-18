"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardLayout } from "@/components/onboarding/WizardLayout";
import { MajorStep } from "@/components/onboarding/MajorStep";
import { CoursesStep } from "@/components/onboarding/CoursesStep";
import { PreferencesStep } from "@/components/onboarding/PreferencesStep";
import { RoadmapStep } from "@/components/onboarding/RoadmapStep";
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
      <div className="warm-page warm-page-noise flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
        <div className="warm-card w-full max-w-md rounded-[2rem] p-8 text-center">
          <div className="onboarding-pill onboarding-pill-gold mx-auto flex h-14 w-14 items-center justify-center rounded-full">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b07b2b] border-t-transparent" />
          </div>
          <div className="mt-5 space-y-2">
            <h1 className="font-[family-name:var(--font-sora)] text-2xl font-semibold text-ink-primary">
              Loading your data.
            </h1>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Pulling 5,300+ courses. One sec.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="warm-page warm-page-noise flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
        <div className="warm-card w-full max-w-md rounded-[2rem] p-6 text-center">
          <div className="space-y-2">
            <h1 className="font-[family-name:var(--font-sora)] text-xl font-semibold text-ink-primary">
              Could not start setup
            </h1>
            <p className="text-sm text-ink-secondary">
              MarqBot needs course and program data before it can build a plan.
            </p>
            <p className="text-sm text-[#ffb7c0]">{bootstrapError}</p>
          </div>
          <div className="mt-5 flex justify-center">
            <Button variant="ink" onClick={handleRetry}>
              Reload Setup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleFinish = () => {
    complete();
    // Mark guide as seen so the planner doesn't show it again
    localStorage.setItem("marqbot_major_guide_seen", "true");
    router.push("/planner");
  };

  const nextLabel =
    currentStep === "majors"
      ? "Next: Add Courses"
      : currentStep === "courses"
        ? "Next: Preferences"
        : currentStep === "preferences"
          ? "Next: Your Roadmap"
          : "Continue";

  return (
    <WizardLayout stepKey={currentStep} currentStep={stepIndex} totalSteps={totalSteps}>
      <div className="space-y-5">
        {currentStep === "majors" && <MajorStep />}
        {currentStep === "courses" && <CoursesStep onWarningChange={setPrereqWarning} />}
        {currentStep === "preferences" && <PreferencesStep />}
        {currentStep === "roadmap" && <RoadmapStep />}

        <div className="space-y-3 border-t border-border-subtle pt-5">
          {currentStep === "majors" && onlySecondary() && (
            <div className="onboarding-panel-gold rounded-[1.45rem] px-4 py-4 text-sm leading-relaxed text-ink-primary">
              That selection still needs a primary major. Add one before MarqBot builds the roadmap.
            </div>
          )}

          {currentStep === "courses" && prereqWarning && (
            <div className="onboarding-panel-danger rounded-[1.45rem] px-4 py-4 text-sm leading-relaxed text-[#ffd5dc]">
              There is still a prereq mismatch in your course history. You can keep going, but fixing it
              now will make the roadmap cleaner.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-[3.5rem] items-center">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={back}
                  className="onboarding-ghost-button min-w-[8rem] rounded-xl"
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex w-full justify-end sm:w-auto">
              {isLast ? (
                <Button
                  variant="ink"
                  size="lg"
                  onClick={handleFinish}
                  className="w-full sm:min-w-[13rem]"
                >
                  Show My Plan
                </Button>
              ) : (
                <Button
                  variant="ink"
                  size="lg"
                  className="w-full sm:min-w-[13rem]"
                  onClick={next}
                  disabled={!canProceed()}
                >
                  {nextLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
