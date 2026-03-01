"use client";

import { motion, AnimatePresence } from "motion/react";
import { StepIndicator } from "./StepIndicator";

interface WizardLayoutProps {
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
}

export function WizardLayout({ currentStep, totalSteps, children }: WizardLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-8 band-blue">
      <div className="w-full max-w-[800px] space-y-10">
        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
        <div className="anchor-fade w-full max-w-[400px] mx-auto" />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="bg-surface-card/80 backdrop-blur-sm rounded-2xl shadow-sm border border-border-subtle p-11 accent-top-gold"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
