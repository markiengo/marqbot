"use client";

import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function AiAdvisorPage() {
  return (
    <PlaceholderPage
      eyebrow="Soon"
      title="AI Advisor"
      description="Ask degree questions in plain English. Your courses, major, and progress are already loaded."
      detail="This needs the same discipline as the planner itself: answers should stay grounded in visible rules and clear caveats, No confident guessing. No main character energy."
      bullets={[
        "Explain why a course is recommended or blocked",
        "Answer requirement questions against your current plan",
        "Stay honest about uncertainty and advisor double-checks",
      ]}
      coverImage="/assets/covers/screen_aiadvisor_cover.jpg"
      primaryHref="/planner"
      primaryLabel="Back to Planner"
      secondaryHref="/about"
      secondaryLabel="Read the product direction"
    />
  );
}
