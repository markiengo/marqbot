"use client";

export function scrollToSection(sectionId: string, extraOffset = 16) {
  if (typeof window === "undefined") {
    return false;
  }

  const section = document.getElementById(sectionId);
  if (!section) {
    return false;
  }

  const nav = document.querySelector('nav[aria-label="Primary"]');
  const navHeight = nav instanceof HTMLElement ? nav.getBoundingClientRect().height : 0;
  const top = section.getBoundingClientRect().top + window.scrollY - navHeight - extraOffset;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth",
  });

  return true;
}
