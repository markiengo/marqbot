import { AboutHero } from "@/components/about/AboutHero";
import { NowNextSection } from "@/components/about/NowNextSection";
import { AboutCTA } from "@/components/about/AboutCTA";
import { Doodles } from "@/components/about/Doodles";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <div className="bg-orbs relative">
      <Doodles />
      <AboutHero />
      <NowNextSection />
      <AboutCTA />
      <Footer />
    </div>
  );
}
