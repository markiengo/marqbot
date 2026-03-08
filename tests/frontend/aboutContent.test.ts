import { describe, expect, test } from "vitest";

import {
  ABOUT_BUILD_CARDS,
  ABOUT_CONTACT_LINKS,
  ABOUT_HERO_COPY,
  ABOUT_INTRO_COPY,
  ABOUT_INTRO_LABELS,
} from "../../frontend/src/components/about/aboutContent";

describe("about content", () => {
  test("keeps hero and intro copy available", () => {
    expect(ABOUT_HERO_COPY.headline.length).toBeGreaterThan(0);
    expect(ABOUT_INTRO_COPY.title).toContain("Markie");
    expect(ABOUT_INTRO_LABELS).toHaveLength(4);
  });

  test("keeps build cards and contact links available", () => {
    expect(ABOUT_BUILD_CARDS).toHaveLength(4);
    expect(ABOUT_BUILD_CARDS.some((card) => card.body.includes("Feedback"))).toBe(true);
    expect(ABOUT_CONTACT_LINKS).toHaveLength(4);
    expect(ABOUT_CONTACT_LINKS.some((link) => link.href.startsWith("mailto:"))).toBe(true);
  });
});
