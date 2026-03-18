"use client";

import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function AiAdvisorPage() {
  return (
    <PlaceholderPage
      eyebrow="Soon"
      title="AI Advisor"
      description="Ask degree questions in plain English. Your plan is already loaded."
      bullets={[
        "Why a course is recommended or blocked",
        "Check requirements against your current plan",
        "Honest about what it doesn't know",
      ]}
      coverImage="/assets/covers/screen_aiadvisor_cover.jpg"
      primaryHref="/planner"
      primaryLabel="Back to Planner"
      secondaryHref="/about"
      secondaryLabel="Product direction"
    />
  );
}
