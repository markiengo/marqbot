"use client";

import { LandingHeroSimple } from "@/components/landing/LandingHeroSimple";
import { HowItWorksClear } from "@/components/landing/HowItWorksClear";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { LandingFaqSection } from "@/components/landing/LandingFaqSection";
import { LandingFinalCTA } from "@/components/landing/LandingFinalCTA";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeroSimple />
      <HowItWorksClear />
      <BenefitsSection />
      <ProofSection />
      <LandingFaqSection />
      <LandingFinalCTA />
      <Footer variant="marketing" />
    </>
  );
}
