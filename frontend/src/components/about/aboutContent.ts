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
} as const;

export const ABOUT_INTRO_LABELS = [
  "freshman",
  "insy major",
  "builder",
  "lowkey lives in raynor",
] as const;

export const ABOUT_INTRO_COPY = {
  title: "Hey there, I\u2019m Markie.",
  paragraphOne:
    "I built this because no one should need six tabs, two emails, and a small existential crisis to figure out what to take next semester. I\u2019m a freshman studying Information Systems at Marquette. I started MarqBot after losing an entire Sunday to the bulletin, CheckMarq, and a chain of advisor emails \u2014 all to answer one question about one class. The system won that round.",
  paragraphTwo:
    "So I built MarqBot \u2014 the tool I wish existed. If you\u2019re interested in how it works, read ",
  paragraphTwoLinkText: "here",
  paragraphTwoLinkHref: "https://github.com/markiengo/marqbot",
  note: "This started as a \"quick side project.\" That was a lie and I fell for it.",
} as const;

export const ABOUT_KNOWN_ISSUES = {
  eyebrow: "Work in progress",
  title: "Sequenced-course recommendations",
  body:
    "MarqBot can sometimes suggest advanced language or theology courses to students who haven't taken the earlier classes in that sequence. I'm actively building out coverage to catch these and filter them from recommendations.",
  subheading: "Why does MarqBot sometimes suggest something weird?",
  detail:
    "Some courses have requirements the bulletin doesn\u2019t list clearly \u2014 instructor consent, college restrictions, advanced language proficiency, or implied sequences. MarqBot doesn\u2019t catch all of these yet. If you see a recommendation that doesn\u2019t make sense, hit Feedback so I can close the gap.",
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
