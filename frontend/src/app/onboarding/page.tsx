"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

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
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 band-blue">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(18,33,63,0.92),rgba(10,24,50,0.85))] p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-gold/25 bg-gold/10 pulse-gold-soft">
            <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin" />
          </div>
          <div className="mt-5 space-y-2">
            <h1 className="text-2xl font-semibold text-ink-primary">Getting your setup ready.</h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              Pulling courses and programs so your plan starts with real data.
            </p>
          </div>
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
              Couldn&apos;t start setup
            </h1>
            <p className="text-sm text-ink-muted">
              MarqBot needs the course list and program list before it can build your plan.
            </p>
            <p className="text-sm text-bad">{bootstrapError}</p>
          </div>
          <Button variant="gold" onClick={handleRetry}>
            Reload Setup
          </Button>
        </div>
      </div>
    );
  }

  const handleFinish = () => {
    complete();
    router.push("/planner");
  };

  const nextLabel =
    currentStep === "majors"
      ? "Next: Classes"
      : currentStep === "courses"
        ? "Next: Plan"
        : "Continue";

  return (
    <WizardLayout stepKey={currentStep} currentStep={stepIndex} totalSteps={totalSteps}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          {currentStep === "majors" && <MajorStep />}
          {currentStep === "courses" && <CoursesStep onWarningChange={setPrereqWarning} />}
          {currentStep === "preferences" && <PreferencesStep />}
        </div>

        <div className="mt-4 space-y-3 border-t border-border-subtle/90 pt-4">
          {currentStep === "majors" && onlySecondary() && (
            <div className="rounded-[1.45rem] border border-warn/20 bg-warn-light p-4 text-sm leading-relaxed text-warn">
              That program cannot stand alone. Add a primary major like Finance or Marketing so MarqBot can build the right plan.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-[3.5rem] items-center">
              {!isFirst && (
                <Button variant="ghost" size="lg" onClick={back} className="min-w-[8rem]">
                  Back
                </Button>
              )}
            </div>
            <div className="flex w-full justify-end sm:w-auto">
              {isLast ? (
                <Button
                  variant="gold"
                  size="md"
                  onClick={handleFinish}
                  className="w-full sm:min-w-[12rem]"
                >
                  Show My Plan
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="pulse-blue-soft w-full sm:min-w-[12rem]"
                  onClick={next}
                  disabled={!canProceed() || (currentStep === "courses" && prereqWarning)}
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
