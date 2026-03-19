import { AboutHero } from "@/components/about/AboutHero";
import { NowNextSection } from "@/components/about/NowNextSection";
import { AboutCTA } from "@/components/about/AboutCTA";
import { Doodles } from "@/components/about/Doodles";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <div className="bg-orbs relative" style={{
      background: "radial-gradient(ellipse 60% 25% at 50% 0%, rgba(24,68,160,0.18), transparent), radial-gradient(ellipse 50% 20% at 80% 50%, rgba(255,204,0,0.06), transparent), radial-gradient(ellipse 50% 20% at 20% 75%, rgba(0,114,206,0.08), transparent), linear-gradient(140deg, #071227, #0c1d38 50%, #0d203e)"
    }}>
      <Doodles />
      <AboutHero />
      <NowNextSection />
      <AboutCTA />
      <Footer />
    </div>
  );
}
