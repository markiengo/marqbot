import { describe, expect, test } from "vitest";

import {
  ABOUT_CONTACT_LINKS,
  ABOUT_HERO_COPY,
  ABOUT_INTRO_COPY,
  ABOUT_INTRO_LABELS,
  ABOUT_RECENT_CHANGES,
  ABOUT_TIMELINE,
} from "../../frontend/src/components/about/aboutContent";

describe("about content", () => {
  test("keeps hero and intro copy available", () => {
    expect(ABOUT_HERO_COPY.headline.length).toBeGreaterThan(0);
    expect(ABOUT_INTRO_COPY.title).toContain("Markie");
    expect(ABOUT_INTRO_LABELS).toHaveLength(4);
  });

  test("keeps timeline, recent changes, and contact links available", () => {
    expect(ABOUT_TIMELINE.length).toBeGreaterThanOrEqual(4);
    expect(ABOUT_TIMELINE.some((entry) => entry.status === "building")).toBe(true);
    expect(ABOUT_RECENT_CHANGES).toHaveLength(2);
    expect(ABOUT_RECENT_CHANGES.some((card) => card.title.includes("bucket"))).toBe(true);
    expect(ABOUT_CONTACT_LINKS).toHaveLength(4);
    expect(ABOUT_CONTACT_LINKS.some((link) => link.href.startsWith("mailto:"))).toBe(true);
  });
});
