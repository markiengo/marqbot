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

  // Check if only secondary majors are selected (no primary)
  const onlySecondary = useCallback(() => {
    if (state.selectedMajors.size === 0) return false;
    const selectedIds = [...state.selectedMajors];
    const hasPrimary = selectedIds.some((id) => {
      const m = state.programs.majors.find((maj) => maj.id === id);
      return m && !m.requires_primary_major;
    });
    return !hasPrimary;
  }, [state.selectedMajors, state.programs.majors]);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case "majors":
        return state.selectedMajors.size > 0 && !onlySecondary();
      case "courses":
        return true; // courses are optional
      case "preferences":
        return !!state.targetSemester;
      default:
        return false;
    }
  }, [currentStep, state.selectedMajors.size, state.targetSemester, onlySecondary]);

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
    onlySecondary,
    next,
    back,
    complete,
  };
}
