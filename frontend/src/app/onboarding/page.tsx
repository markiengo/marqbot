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
  const courses = useCourses();
  const programs = usePrograms();
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

  const isLoading = !courses?.length || !programs?.majors?.length;

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
