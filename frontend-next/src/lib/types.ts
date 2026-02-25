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
}

export interface Track {
  id: string;
  label: string;
  parent_major_id?: string;
}

export interface ProgramsData {
  majors: Major[];
  tracks: Track[];
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
  selected_track_id?: string;
  selected_track_label?: string;
}

export interface SemesterData {
  target_semester?: string;
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
  canTake: string;
  declaredMajors: string[];
  declaredTrack: string;
  activeNavTab: string;
  onboardingComplete?: boolean;
}

export interface AppState {
  courses: Course[];
  programs: ProgramsData;
  completed: Set<string>;
  inProgress: Set<string>;
  selectedMajors: Set<string>;
  selectedTrack: string | null;
  targetSemester: string;
  semesterCount: string;
  maxRecs: string;
  canTakeQuery: string;
  activeNavTab: string;
  onboardingComplete: boolean;
  lastRecommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
}

export type NavTab = "home" | "plan" | "courses" | "saved" | "ai-advisor";
