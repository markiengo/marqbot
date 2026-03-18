"use client";

import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function CoursesPage() {
  return (
    <PlaceholderPage
      eyebrow="Soon"
      title="Course Explorer"
      description="Browse prereqs, requirements, and offerings in one place."
      bullets={[
        "Search courses without digging through CheckMarq",
        "See which requirement a class satisfies",
        "Jump back to the planner to lock it in",
      ]}
      coverImage="/assets/covers/screen_courses_cover.jpg"
      primaryHref="/planner"
      primaryLabel="Back to Planner"
      secondaryHref="/about"
      secondaryLabel="What's shipping"
    />
  );
}
