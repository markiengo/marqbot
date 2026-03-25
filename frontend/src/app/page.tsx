"use client";

import { LandingHeroSimple } from "@/components/landing/LandingHeroSimple";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { HowItWorksClear } from "@/components/landing/HowItWorksClear";
import { LandingFinalCTA } from "@/components/landing/LandingFinalCTA";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeroSimple />
      <BenefitsSection />
      <HowItWorksClear />
      <LandingFinalCTA />
      <Footer />
    </>
  );
}
