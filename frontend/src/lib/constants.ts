import type { NavItem } from "./types";

export const STORAGE_KEY = "marqbot_session_v1";
export const SESSION_RECOMMENDATION_STORAGE_KEY = "marqbot_session_recommendation_v1";
export const SAVED_PLANS_STORAGE_KEY = "marqbot_saved_plans_v1";
export const PLANNER_FEEDBACK_NUDGE_STORAGE_KEY = "marqbot_planner_feedback_nudge_v1";
export const MAX_SAVED_PLANS = 25;

export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "plan", label: "Planner", href: "/planner" },
  { id: "saved", label: "Saved", href: "/saved" },
  { id: "courses", label: "Courses", href: "/courses", status: "soon", badgeLabel: "Soon" },
  { id: "ai-advisor", label: "AI Advisor", href: "/ai-advisor", status: "soon", badgeLabel: "Soon" },
  { id: "about", label: "About", href: "/about" },
];

export const SEMESTER_OPTIONS = [
  { value: "Spring 2026", label: "Spring 2026" },
  { value: "Summer 2026", label: "Summer 2026" },
  { value: "Fall 2026", label: "Fall 2026" },
  { value: "Spring 2027", label: "Spring 2027" },
  { value: "Summer 2027", label: "Summer 2027" },
  { value: "Fall 2027", label: "Fall 2027" },
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

export const DEFAULT_SEMESTER = "Fall 2026";
export const DEFAULT_SEMESTER_COUNT = "3";
export const DEFAULT_MAX_RECS = "3";
export const MAX_MAJORS = 3;
export const MAX_MINORS = 2;
