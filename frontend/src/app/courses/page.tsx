"use client";

import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function CoursesPage() {
  return (
    <PlaceholderPage
      eyebrow="Soon"
      title="Course Explorer"
      description="Browse prereqs, requirement mappings, and offering context. No five-tab dig required."
      detail="The planner is already good at telling you what to take next. The next step is a calmer browser for understanding the course universe around that recommendation."
      bullets={[
        "Search courses without the CheckMarq runaround",
        "See what bucket or requirement a class actually satisfies",
        "Jump back to the planner when you're ready to lock in",
      ]}
      coverImage="/assets/covers/screen_courses_cover.jpg"
      primaryHref="/planner"
      primaryLabel="Back to Planner"
      secondaryHref="/about"
      secondaryLabel="See what is shipping"
    />
  );
}
