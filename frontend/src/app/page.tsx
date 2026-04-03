"use client";

import { LandingHeroSimple } from "@/components/landing/LandingHeroSimple";
import { HowItWorksClear } from "@/components/landing/HowItWorksClear";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { ProofSection } from "@/components/landing/ProofSection";
import { LandingFaqSection } from "@/components/landing/LandingFaqSection";
import { LandingFinalCTA } from "@/components/landing/LandingFinalCTA";
import { Footer } from "@/components/layout/Footer";
import { ReactivePageShell } from "@/components/shared/ReactivePageShell";

export default function LandingPage() {
  return (
    <ReactivePageShell>
      <LandingHeroSimple />
      <div className="home-lower-scale">
        <HowItWorksClear />
        <BenefitsSection />
        <ProofSection />
        <LandingFaqSection />
        <LandingFinalCTA />
        <Footer variant="marketing" />
      </div>
    </ReactivePageShell>
  );
}
