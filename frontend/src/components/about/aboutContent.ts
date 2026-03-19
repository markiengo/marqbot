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

export const ABOUT_HERO_COPY = {
  eyebrow: "About",
  headline: "The student behind MarqBot.",
  body: "I'm Markie. I built this because no one should need six tabs, two emails, and a small existential crisis to figure out what to take next semester.",
} as const;

export const ABOUT_INTRO_LABELS = [
  "freshman",
  "insy major",
  "builder",
  "lowkey lives in raynor",
] as const;

export const ABOUT_INTRO_COPY = {
  title: "Hey, I'm Markie.",
  paragraphOne:
    "I'm a freshman studying Information Systems at Marquette. I started MarqBot after losing an entire Sunday to the bulletin, CheckMarq, and a chain of advisor emails — all to answer one question about one class. The system won that round.",
  paragraphTwo:
    "So I built the tool I wish existed: real rules, clear tradeoffs, and zero late-night fights with CheckMarq. Most of it was written in Raynor the week before registration, The coffee-to-code ratio was concerning.",
  note: "This started as a \"quick side project.\" That was a lie and I fell for it.",
} as const;

export const ABOUT_KNOWN_ISSUES = {
  eyebrow: "Work in progress",
  title: "Sequenced-course recommendations",
  body:
    "MarqBot can sometimes suggest advanced language or theology courses to students who haven't taken the earlier classes in that sequence. I'm actively building out coverage to catch these and filter them from recommendations.",
  subheading: "What are soft-prereqs?",
  detail:
    "Many courses have implied requirements the bulletin never lists. SPAN 2013 has no official prerequisite, but it obviously expects SPAN 1001 and 1002. MarqBot calls these \"soft-prereqs\" — and until they're mapped, a student who's never taken Spanish might get SPAN 2013 suggested just because it fills a bucket. If you spot one of these, hit Feedback — it helps me find the gaps faster.",
} as const;

export const ABOUT_RECENT_CHANGES: AboutBuildCard[] = [
  {
    eyebrow: "New",
    title: "Screenshot import",
    body:
      "Upload a CheckMarq screenshot and MarqBot reads your course history locally — no typing, no external servers. OCR runs entirely in your browser. The era of manual entry is over.",
  },
  {
    eyebrow: "New",
    title: "Your Build",
    body:
      "Pick Grinder, Explorer, or Mixer to control how MarqBot balances core and discovery courses each semester. Explorer reserves two discovery slots. Mixer alternates. Prerequisites still run the show.",
  },
];

export const ABOUT_BUILD_CARDS: AboutBuildCard[] = [
  {
    eyebrow: "Building now",
    title: "Full policy documentation",
    body:
      "Some courses have hidden rules the bulletin doesn't make obvious — like the CFA AIM track requiring a Finance major, or certain upper-levels being restricted to specific colleges. I'm documenting these so MarqBot can flag them before you find out the hard way during registration.",
  },
  {
    eyebrow: "Next up",
    title: "Semester offering awareness",
    body:
      "Right now MarqBot doesn't always know when a course is offered. Soon it'll stop confidently suggesting classes that only exist in the spring. We've all been hurt before.",
  },
  {
    eyebrow: "Planned",
    title: "AI Advisor chatbot",
    body:
      "A chat layer where you can ask degree questions in plain English — with your courses, major, and progress already loaded. Like texting your advisor, except it responds at 2 a.m. from Club Raynor.",
  },
  {
    eyebrow: "From you",
    title: "Bug reports and ideas",
    body:
      "Some of the best fixes came from students finding the exact edge case I missed. If something looks wrong, hit Feedback or DM me. You're doing QA and I genuinely appreciate it. That's a W.",
  },
];

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
