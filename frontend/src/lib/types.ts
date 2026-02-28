export interface Course {
  course_code: string;
  course_name: string;
  credits: number;
  level?: number | null;
  prereq_level?: number | null;
}

export interface Major {
  id: string;
  label: string;
  tracks?: Track[];
  requires_primary_major?: boolean;
}

export interface Track {
  id: string;
  label: string;
  parent_major_id?: string;
}

export interface Minor {
  id: string;
  label: string;
  active?: boolean;
}

export interface ProgramsData {
  majors: Major[];
  tracks: Track[];
  minors: Minor[];
  default_track_id: string;
}

export interface RecommendedCourse {
  course_code: string;
  course_name?: string;
  credits?: number;
  why?: string;
  prereq_check?: string;
  fills_buckets?: string[];
  unlocks?: string[];
  warning_text?: string;
  soft_tags?: string[];
  notes?: string;
  low_confidence?: boolean;
  min_standing?: number;
}

export interface BucketProgress {
  needed: number;
  completed_done?: number;
  assumed_done?: number;
  in_progress_increment?: number;
  done_count?: number;
  in_progress_applied?: string[];
  satisfied?: boolean;
  label?: string;
}

export interface SelectionContext {
  selected_program_ids?: string[];
  selected_program_labels?: string[];
  declared_majors?: string[];
  declared_major_labels?: string[];
  declared_minors?: string[];
  declared_minor_labels?: string[];
  discovery_theme?: string | null;
  selected_track_id?: string;
  selected_track_label?: string;
}

export interface SemesterData {
  target_semester?: string;
  standing?: number;
  standing_label?: string;
  recommendations?: RecommendedCourse[];
  eligible_count?: number;
  not_in_catalog_warning?: string[];
  in_progress_note?: string;
  projected_progress?: Record<string, BucketProgress>;
  progress?: Record<string, BucketProgress>;
  projection_note?: string;
  input_completed_count?: number;
  applied_completed_count?: number;
}

export interface RecommendationResponse {
  mode: "recommendations" | "error" | "can_take";
  semesters?: SemesterData[];
  current_progress?: Record<string, BucketProgress>;
  current_assumption_notes?: string[];
  selection_context?: SelectionContext;
  message?: string;
  invalid_courses?: string[];
  not_in_catalog?: string[];
}

export interface CanTakeResponse {
  can_take: boolean | null;
  requested_course: string;
  why_not?: string;
  not_offered_this_term?: boolean;
  missing_prereqs?: string[];
  next_best_alternatives?: RecommendedCourse[];
}

export interface CreditKpiMetrics {
  minGradCredits: number;
  completedCredits: number;
  inProgressCredits: number;
  remainingCredits: number;
  standingLabel: string;
  donePercent: number;
  inProgressPercent: number;
  overallPercent: number;
}

export interface SessionSnapshot {
  completed: string[];
  inProgress: string[];
  targetSemester: string;
  semesterCount: string;
  maxRecs: string;
  includeSummer?: boolean;
  canTake: string;
  declaredMajors: string[];
  declaredTracks: string[];
  declaredMinors: string[];
  discoveryTheme: string;
  activeNavTab: string;
  onboardingComplete?: boolean;
  lastRecommendationData?: RecommendationResponse | null;
  lastRequestedCount?: number;
}

export interface AppState {
  courses: Course[];
  programs: ProgramsData;
  completed: Set<string>;
  inProgress: Set<string>;
  selectedMajors: Set<string>;
  selectedTracks: string[];
  selectedMinors: Set<string>;
  discoveryTheme: string;
  targetSemester: string;
  semesterCount: string;
  maxRecs: string;
  includeSummer: boolean;
  canTakeQuery: string;
  activeNavTab: string;
  onboardingComplete: boolean;
  lastRecommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
}

export type NavTab = "home" | "plan" | "courses" | "saved" | "ai-advisor";
