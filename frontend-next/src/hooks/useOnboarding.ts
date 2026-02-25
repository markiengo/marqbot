"use client";

import { useState, useCallback } from "react";
import { useAppContext } from "@/context/AppContext";

export type OnboardingStep = "majors" | "courses" | "preferences";
const STEPS: OnboardingStep[] = ["majors", "courses", "preferences"];

export function useOnboarding() {
  const { state, dispatch } = useAppContext();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("majors");

  const stepIndex = STEPS.indexOf(currentStep);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case "majors":
        return state.selectedMajors.size > 0;
      case "courses":
        return true; // courses are optional
      case "preferences":
        return !!state.targetSemester;
      default:
        return false;
    }
  }, [currentStep, state.selectedMajors.size, state.targetSemester]);

  const next = useCallback(() => {
    if (isLast || !canProceed()) return;
    setCurrentStep(STEPS[stepIndex + 1]);
  }, [isLast, canProceed, stepIndex]);

  const back = useCallback(() => {
    if (isFirst) return;
    setCurrentStep(STEPS[stepIndex - 1]);
  }, [isFirst, stepIndex]);

  const complete = useCallback(() => {
    dispatch({ type: "MARK_ONBOARDING_COMPLETE" });
  }, [dispatch]);

  return {
    currentStep,
    stepIndex,
    totalSteps: STEPS.length,
    isFirst,
    isLast,
    canProceed,
    next,
    back,
    complete,
  };
}
