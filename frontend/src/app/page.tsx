"use client";

import { LandingHeroSimple } from "@/components/landing/LandingHeroSimple";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { HowItWorksClear } from "@/components/landing/HowItWorksClear";
import { LandingFinalCTA } from "@/components/landing/LandingFinalCTA";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeroSimple />
      <BenefitsSection />
      <ProofSection />
      <HowItWorksClear />
      <LandingFinalCTA />
      <Footer />
    </>
  );
}
