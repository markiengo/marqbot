import type { NavTab } from "./types";

export const STORAGE_KEY = "marqbot_session_v1";

export const NAV_ITEMS: { id: NavTab; label: string; href: string }[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "plan", label: "Planner", href: "/planner" },
  { id: "courses", label: "Courses", href: "/courses" },
  { id: "saved", label: "Saved", href: "/saved" },
  { id: "ai-advisor", label: "AI Advisor", href: "/ai-advisor" },
];

export const SEMESTER_OPTIONS = [
  { value: "Fall 2025", label: "Fall 2025" },
  { value: "Spring 2026", label: "Spring 2026" },
  { value: "Summer 2026", label: "Summer 2026" },
  { value: "Fall 2026", label: "Fall 2026" },
  { value: "Spring 2027", label: "Spring 2027" },
];

export const SEMESTER_COUNT_OPTIONS = [
  { value: "1", label: "1 semester" },
  { value: "2", label: "2 semesters" },
  { value: "3", label: "3 semesters" },
  { value: "4", label: "4 semesters" },
  { value: "5", label: "5 semesters" },
  { value: "6", label: "6 semesters" },
  { value: "7", label: "7 semesters" },
  { value: "8", label: "8 semesters" },
];

export const MAX_RECS_OPTIONS = [
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" },
];

export const DEFAULT_SEMESTER = "Fall 2025";
export const DEFAULT_SEMESTER_COUNT = "3";
export const DEFAULT_MAX_RECS = "3";
export const MAX_MAJORS = 3;
export const MAX_MINORS = 2;

export const FIN_MAJOR_ID = "FIN_MAJOR";
export const AIM_CFA_TRACK_ID = "AIM_CFA_TRACK";
export const AIM_CFA_FINANCE_RULE_MSG =
  "Students in the AIM CFA: Investments Concentration must also have a declared primary major in Finance.";
