"use client";

import { LandingHeroSimple } from "@/components/landing/LandingHeroSimple";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { HowItWorksClear } from "@/components/landing/HowItWorksClear";
import { ProofSection } from "@/components/landing/ProofSection";
import { LandingFinalCTA } from "@/components/landing/LandingFinalCTA";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeroSimple />
      <BenefitsSection />
      <HowItWorksClear />
      <ProofSection />
      <LandingFinalCTA />
      <Footer />
    </>
  );
}
