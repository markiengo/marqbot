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
  body: "I'm Markie. I built this because no one should need six browser tabs, two email threads, and a prayer to figure out what to take next semester.",
} as const;

export const ABOUT_INTRO_LABELS = [
  "freshman",
  "insy major",
  "builder",
  "probably in raynor rn",
] as const;

export const ABOUT_INTRO_COPY = {
  title: "Hey, I'm Markie.",
  paragraphOne:
    "I'm a freshman studying Information Systems at Marquette. I started MarqBot after losing an entire Sunday to the bulletin, CheckMarq, and a chain of advisor emails — all to answer one question about one class. That felt like a personal attack from the registrar.",
  paragraphTwo:
    "So I built the tool I wish existed: real rules, clear tradeoffs, and zero late-night fights with CheckMarq. Most of it was written in Raynor the week before registration, fueled by questionable amounts of coffee.",
  note: "This started out as a \"quick side project\". I've learned those don't really exist.",
} as const;

export const ABOUT_BUILD_CARDS: AboutBuildCard[] = [
  {
    eyebrow: "Building now",
    title: "Full policy documentation",
    body:
      "Mapping out the edge-case policies Marquette actually enforces. The goal: fewer surprise blockers and fewer \"wait, since when?\" moments at the advisor's office.",
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
      "A chat layer where you can ask degree questions in plain English — with your courses, major, and progress already loaded. Like texting your advisor, except it responds at 2 a.m.",
  },
  {
    eyebrow: "From you",
    title: "Bug reports and ideas",
    body:
      "Some of the best fixes came from students finding the exact edge case I missed. If something looks wrong, hit Feedback or DM me. You're doing QA and I appreciate it deeply.",
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
