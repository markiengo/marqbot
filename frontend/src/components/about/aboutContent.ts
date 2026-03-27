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
  note: "This started as a \u201cquick side project.\u201d That was a lie and I fell for it.",
} as const;

export const ABOUT_KNOWN_ISSUES = {
  eyebrow: "Work in progress",
  title: "Sequenced-course recommendations",
  body:
    "MarqBot sometimes suggests advanced courses to students who haven\u2019t taken the earlier classes in that sequence. Actively fixing.",
  detail:
    "Some courses have requirements the bulletin doesn\u2019t list clearly \u2014 instructor consent, college restrictions, or implied sequences. MarqBot doesn\u2019t catch all of these yet. If you see something off, hit Feedback so I can close the gap.",
} as const;

export const ABOUT_TIMELINE: TimelineEntry[] = [
  {
    status: "building",
    title: "Sequenced-course fixes",
    body: "Catching courses that skip the line.",
    detail: "MarqBot sometimes suggests advanced courses to students who haven\u2019t taken the earlier classes in that sequence. Some courses have requirements the bulletin doesn\u2019t list clearly \u2014 instructor consent, college restrictions, or implied sequences. If you see something off, hit Feedback so I can close the gap.",
  },
  {
    status: "building",
    title: "Full policy documentation",
    body: "Hidden rules, documented before they surprise you.",
    detail: "Some courses have rules the bulletin doesn\u2019t make obvious \u2014 like the CFA AIM track requiring a Finance major, or certain upper-levels being restricted to specific colleges. Documenting these so MarqBot catches them first.",
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
    title: "Planner performance cleanup",
    body:
      "Reduced planner rerenders, lighter session persistence, and faster modal opens when you check degree progress or course details.",
  },
  {
    eyebrow: "new",
    title: "Lower-power browser pass",
    body:
      "Cut always-on page effects and lazy-loaded screenshot OCR so the site does less work before you even ask it to build a plan.",
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
