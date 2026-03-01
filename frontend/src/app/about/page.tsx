"use client";

import { AboutHero } from "@/components/about/AboutHero";
import { FounderIntro } from "@/components/about/FounderIntro";
import { SocialLinks } from "@/components/about/SocialLinks";
import { RoadmapBoard } from "@/components/about/RoadmapBoard";
import { AboutCTA } from "@/components/about/AboutCTA";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <FounderIntro />
      <SocialLinks />
      <RoadmapBoard />
      <AboutCTA />
      <Footer />
    </>
  );
}
