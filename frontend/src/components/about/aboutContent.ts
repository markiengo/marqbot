export type AboutBuildCard = {
  eyebrow: string;
  title: string;
  body: string;
};

export type AboutContactLink = {
  label: string;
  handle: string;
  href: string;
  icon: "email" | "github" | "linkedin" | "instagram";
};

export type TimelineEntry = {
  status: "shipped" | "building" | "planned";
  title: string;
  body: string;
  detail: string;
};

export const ABOUT_HERO_COPY = {
  eyebrow: "About",
  headline: "The student behind MarqBot.",
} as const;

export const ABOUT_INTRO_LABELS = [
  "freshman",
  "information systems",
  "builder",
  "lowkey lives in raynor",
] as const;

export const ABOUT_INTRO_COPY = {
  title: "I'm Markie.",
  paragraphOne:
    "I'm a freshman studying Information Systems at Marquette. I built this because I'm bored, and I hate picking courses each semester.",
  paragraphTwo:
    "If you're interested in the technical aspects, read ",
  paragraphTwoLinkText: "here",
  paragraphTwoLinkHref: "https://github.com/markiengo/marqbot",
  note: "If not, enjoy the tool and give me feedback. There's more to come, and even more with your thoughts.",
} as const;

export const ABOUT_TIMELINE: TimelineEntry[] = [
  {
    status: "shipped",
    title: "Policy and restriction enforcement",
    body: "College restrictions, major gates, and credit-load rules are now enforced.",
    detail: "MarqBot now enforces college and major restrictions when the bulletin language is clear, warns about credit overloads and business-minor conflicts, and documents 76 Marquette policies with machine-readable status tracking. Hidden sequences and edge cases are caught before they surprise you.",
  },
  {
    status: "building",
    title: "Semester offering awareness",
    body: "No more suggesting spring-only classes in fall.",
    detail: "Right now MarqBot doesn\u2019t always know when a course is offered. Soon it\u2019ll check the semester before recommending \u2014 so you stop planning around a class that doesn\u2019t exist this term.",
  },
  {
    status: "planned",
    title: "AI Advisor chatbot",
    body: "Ask degree questions in plain English.",
    detail: "A chat layer where your courses, major, and progress are already loaded. Ask \u201cwhy is this course recommended?\u201d or \u201cwhat happens if I drop this?\u201d \u2014 like texting your advisor at 2 a.m. from Club Raynor.",
  },
  {
    status: "planned",
    title: "Bug reports and ideas",
    body: "Your edge cases make the tool better.",
    detail: "Some of the best fixes came from students finding the exact scenario I missed. If something looks wrong, hit Feedback or DM me. You\u2019re doing QA and I genuinely appreciate it.",
  },
];

// Legacy exports kept for any remaining references
export const ABOUT_RECENT_CHANGES: AboutBuildCard[] = [
  {
    eyebrow: "new",
    title: "Adaptive reduced-effects mode",
    body:
      "MarqBot now keeps the richer look on capable machines and automatically falls back to a lighter planner, onboarding, and modal rendering path on weaker browsers. You can also override it in planner preferences.",
  },
  {
    eyebrow: "new",
    title: "Smarter bucket counting",
    body:
      "Required buckets now beat broad elective pools when the same course could fill both. If two finished classes overfill one slot, MarqBot can still reuse the extra one in electives when the rules allow it.",
  },
];
export const ABOUT_BUILD_CARDS: AboutBuildCard[] = [];

export const ABOUT_CONTACT_LINKS: AboutContactLink[] = [
  {
    label: "Email",
    handle: "markie.ngo@marquette.edu",
    href: "mailto:markie.ngo@marquette.edu",
    icon: "email",
  },
  {
    label: "GitHub",
    handle: "markiengo",
    href: "https://github.com/markiengo",
    icon: "github",
  },
  {
    label: "LinkedIn",
    handle: "Markie Ngo",
    href: "https://www.linkedin.com/in/markiengo/",
    icon: "linkedin",
  },
  {
    label: "Instagram",
    handle: "@_markie.tan",
    href: "https://www.instagram.com/_markie.tan/",
    icon: "instagram",
  },
];
