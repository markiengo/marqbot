import { AboutHero } from "@/components/about/AboutHero";
import { NowNextSection } from "@/components/about/NowNextSection";
import { AboutCTA } from "@/components/about/AboutCTA";
import { Doodles } from "@/components/about/Doodles";
import { Footer } from "@/components/layout/Footer";
import { ReactivePageShell } from "@/components/shared/ReactivePageShell";

export default function AboutPage() {
  return (
    <ReactivePageShell
      className="relative overflow-hidden"
    >
      <div className="landing-hero-grid pointer-events-none absolute inset-0 opacity-[0.03]" />
      <Doodles />
      <AboutHero />
      <NowNextSection />
      <AboutCTA />
      <Footer variant="marketing" />
    </ReactivePageShell>
  );
}
