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
  body: "I'm Markie. I built this.",
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
    "I'm a freshman studying Information Systems at Marquette. I started MarqBot because I spent an entire Sunday cross-referencing the bulletin, a spreadsheet, and two advisor emails just to figure out if I could take one class. That felt like it should be easier.",
  paragraphTwo:
    "So I did what any reasonable person would do: I vibe-coded and built a whole degree planner instead of doing my actual homework. MarqBot is still growing. If you find a bug, that's honestly expected — I'm one person running on The Brew's coffee and the Marquette wifi that cuts out every 40 minutes.",
  note: "This started as a 'quick side project.' I have since learned that those don't exist.",
} as const;

export const ABOUT_BUILD_CARDS: AboutBuildCard[] = [
  {
    eyebrow: "Building now",
    title: "Course equivalencies",
    body:
      "Some courses satisfy the same prereq but MarqBot doesn't know that yet. So it gaslights you into thinking you haven't done something you definitely did. Fixing that.",
  },
  {
    eyebrow: "Next up",
    title: "ESSv2, Minors, Discovery",
    body:
      "Adding the new ESS v2 requirements, full minor support, and MCC Discovery Themes. Basically all the programs MarqBot currently pretends don't exist.",
  },
  {
    eyebrow: "Planned",
    title: "AI Advisor chatbot",
    body:
      "A chat feature where you can ask MarqBot questions about your degree plan in plain English. It knows your courses, your major, and your progress — no copy-pasting required.",
  },
  {
    eyebrow: "From you",
    title: "Bug reports and ideas",
    body:
      "Some of the best fixes came from students breaking things I was sure were unbreakable. If something's weird, tell me. You're doing QA and I can't afford to pay you.",
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
