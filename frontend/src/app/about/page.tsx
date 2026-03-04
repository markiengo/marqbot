import { AboutHero } from "@/components/about/AboutHero";
import { NowNextSection } from "@/components/about/NowNextSection";
import { AboutCTA } from "@/components/about/AboutCTA";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <div className="bg-orbs">
      <AboutHero />
      <NowNextSection />
      <AboutCTA />
      <Footer />
    </div>
  );
}
