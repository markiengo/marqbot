"use client";

import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function CoursesPage() {
  return (
    <PlaceholderPage
      eyebrow="Soon"
      title="Course Explorer"
      description="Browse prerequisites, requirement mappings, and offering context without opening five tabs."
      detail="The planner is already good at telling you what to take next. The next step is a calmer browser for understanding the course universe around that recommendation."
      bullets={[
        "Search courses with clearer prerequisite context",
        "See what bucket or requirement a class actually satisfies",
        "Return to the planner when you are ready to act on it",
      ]}
      coverImage="/assets/covers/screen_courses_cover.jpg"
      primaryHref="/planner"
      primaryLabel="Back to Planner"
      secondaryHref="/about"
      secondaryLabel="See what is shipping"
    />
  );
}
