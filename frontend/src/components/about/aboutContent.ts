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
  body: "I am Markie. I built this because degree planning should not feel like decoding CheckMarq, the bulletin, and one advisor email thread.",
} as const;

export const ABOUT_INTRO_LABELS = [
  "freshman",
  "insy major",
  "builder",
  "sleep-deprived",
] as const;

export const ABOUT_INTRO_COPY = {
  title: "Hey, I'm Markie.",
  paragraphOne:
    "I'm a freshman studying Information Systems at Marquette. I started MarqBot after spending an entire Sunday cross-checking the bulletin, CheckMarq, and advisor emails just to answer one course question. That felt unnecessary.",
  paragraphTwo:
    "So I built the tool I wanted in Raynor the week before registration: real rules, clear tradeoffs, and less time arguing with CheckMarq at 11:48 p.m.",
  note: "This was supposed to stay small. Then the edge cases showed up.",
} as const;

export const ABOUT_BUILD_CARDS: AboutBuildCard[] = [
  {
    eyebrow: "Building now",
    title: "Full policy documentation",
    body:
      "Documenting the edge-case policies Marquette actually enforces. The goal is fewer surprise blockers and fewer advisor-email archaeology sessions.",
  },
  {
    eyebrow: "Next up",
    title: "Semester offering awareness",
    body:
      "Right now MarqBot does not fully know when every course is offered. Soon it will stop acting like your ideal section exists every semester.",
  },
  {
    eyebrow: "Planned",
    title: "AI Advisor chatbot",
    body:
      "A chat layer where you can ask degree-plan questions in plain English with your courses, major, and progress already loaded.",
  },
  {
    eyebrow: "From you",
    title: "Bug reports and ideas",
    body:
      "Some of the best fixes have come from students finding the exact edge case I missed. If something feels off, use Feedback or message me directly. That signal is useful fast.",
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
