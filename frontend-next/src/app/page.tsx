"use client";

import { Hero } from "@/components/landing/Hero";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { SocialProof } from "@/components/landing/SocialProof";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeatureSection />
      <SocialProof />
      <CTASection />
      <Footer />
    </>
  );
}
