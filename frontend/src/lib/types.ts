export interface Course {
  course_code: string;
  course_name: string;
  credits: number;
  level?: number | null;
  prereq_level?: number | null;
  description?: string | null;
  catalog_prereq_raw?: string | null;
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
  required_major_id?: string;
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
  bucket_labels?: Record<string, string>;
}

export interface RecommendedCourse {
  course_code: string;
  course_name?: string;
  credits?: number;
  why?: string;
  prereq_check?: string;
  fills_buckets?: string[];
  bucket_label_overrides?: Record<string, string>;
  equivalent_to_courses?: string[];
  conflicts_with_courses?: string[];
  warning_text?: string;
  soft_tags?: string[];
  notes?: string;
  low_confidence?: boolean;
  min_standing?: number;
  is_manual_add?: boolean;
}

export interface PlannerManualAddPin {
  course_code: string;
  semester_index: number;
  course_snapshot: RecommendedCourse;
  pinned_at: number;
}

export interface BucketProgress {
  needed: number;
  completed_done?: number;
  assumed_done?: number;
  in_progress_increment?: number;
  done_count?: number;
  completed_applied?: string[];
  in_progress_applied?: string[];
  satisfied?: boolean;
  label?: string;
  requirement_mode?: string;
  needed_count?: number;
  completed_courses?: number;
  in_progress_courses?: number;
  recommendation_tier?: number;
  section_key?: string;
  section_label?: string;
  section_rank?: number;
  planner_bucket_rank?: number;
  group_parent_id?: string;
  group_parent_label?: string;
  parent_bucket_id?: string;
  parent_bucket_label?: string;
  display_parent_alias?: string;
}

export type StudentStage = "undergrad" | "graduate" | "doctoral";

export type BucketDetailMode = "current" | "projected";

export interface BucketDetailState {
  bucketId: string;
  bucketLabel: string;
  mode: BucketDetailMode;
  completedCodes: string[];
  inProgressCodes: string[];
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
  eligible_swaps?: RecommendedCourse[];
  eligible_count?: number;
  not_in_catalog_warning?: string[];
  in_progress_note?: string;
  projected_progress?: Record<string, BucketProgress>;
  progress?: Record<string, BucketProgress>;
  projection_note?: string;
  input_completed_count?: number;
  applied_completed_count?: number;
  semester_warnings?: string[];
}

export interface RecommendationResponse {
  mode: "recommendations" | "error" | "can_take";
  semesters?: SemesterData[];
  manual_add_pins?: PlannerManualAddPin[];
  input_completed_courses?: string[];
  input_in_progress_courses?: string[];
  current_completed_courses?: string[];
  current_in_progress_courses?: string[];
  current_progress?: Record<string, BucketProgress>;
  current_assumption_notes?: string[];
  selection_context?: SelectionContext;
  message?: string;
  invalid_courses?: string[];
  not_in_catalog?: string[];
}

export interface FeedbackSessionSnapshot {
  completed: string[];
  in_progress: string[];
  declared_majors: string[];
  declared_tracks: string[];
  declared_minors: string[];
  discovery_theme: string;
  target_semester: string;
  semester_count: string;
  max_recs: string;
  include_summer: boolean;
  is_honors_student: boolean;
  scheduling_style: import("./schedulingStyle").SchedulingStyle;
  student_stage: StudentStage;
  active_nav_tab: string;
  onboarding_complete: boolean;
  last_requested_count: number;
}

export interface FeedbackContext {
  source: "planner";
  route: string;
  session_snapshot: FeedbackSessionSnapshot;
  recommendation_snapshot: RecommendationResponse | null;
}

export interface FeedbackPayload {
  rating: number;
  message: string;
  context: FeedbackContext;
}

export interface FeedbackResponse {
  ok: true;
  feedback_id: string;
  submitted_at: string;
}

export type ImportStatus = "idle" | "preprocessing" | "parsing" | "parsed" | "failed";

export type ImportRowStatus = "completed" | "in_progress" | "ignored" | "unmatched";

export interface ImportRow {
  course_code?: string;
  source_text: string;
  term: string;
  status: ImportRowStatus;
  confidence: number;
  suggested_matches?: string[];
  reason?: string;
}

export interface ImportResult {
  completed_matches: ImportRow[];
  in_progress_matches: ImportRow[];
  unmatched_rows: ImportRow[];
  ignored_rows: ImportRow[];
  summary: {
    completed_count: number;
    in_progress_count: number;
    unmatched_count: number;
    ignored_count: number;
    total_rows: number;
  };
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
  isHonorsStudent?: boolean;
  schedulingStyle?: import("./schedulingStyle").SchedulingStyle;
  studentStage?: StudentStage;
  studentStageIsExplicit?: boolean;
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

export interface SavedPlanInputs {
  completed: string[];
  inProgress: string[];
  declaredMajors: string[];
  declaredTracks: string[];
  declaredMinors: string[];
  discoveryTheme: string;
  targetSemester: string;
  semesterCount: string;
  maxRecs: string;
  includeSummer: boolean;
  schedulingStyle?: import("./schedulingStyle").SchedulingStyle;
  studentStage: StudentStage;
  studentStageIsExplicit?: boolean;
}

export interface SavedPlanRecord {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  inputs: SavedPlanInputs;
  recommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
  inputHash: string;
  resultsInputHash: string | null;
  lastGeneratedAt: string | null;
}

export type SavePlanMode = "create" | "overwrite";

export interface SavePlanOverwriteOption {
  id: string;
  name: string;
  notes: string;
  updatedAt: string;
  programLine: string;
  targetSemester: string;
}

export interface SavePlanSubmitParams {
  mode: SavePlanMode;
  targetPlanId: string | null;
  name: string;
  notes: string;
}

export interface SavedPlansStore {
  version: 1;
  plans: SavedPlanRecord[];
}

export type SavedPlanFreshness = "fresh" | "stale" | "missing";
export type NavItemStatus = "live" | "soon";

export type LoadStatus = "idle" | "loading" | "ready" | "error";
export type { SchedulingStyle } from "./schedulingStyle";

export interface AppState {
  courses: Course[];
  coursesLoadStatus: LoadStatus;
  coursesLoadError: string | null;
  programs: ProgramsData;
  programsLoadStatus: LoadStatus;
  programsLoadError: string | null;
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
  isHonorsStudent: boolean;
  schedulingStyle: import("./schedulingStyle").SchedulingStyle;
  studentStage: StudentStage;
  studentStageIsExplicit: boolean;
  canTakeQuery: string;
  activeNavTab: string;
  onboardingComplete: boolean;
  lastRecommendationData: RecommendationResponse | null;
  lastRequestedCount: number;
}

export interface BucketSlot {
  bucket_id: string;
  label: string;
  requirement_mode: "required" | "choose_n" | "credits_pool";
  courses_required: number | null;
  credits_required: number | null;
  course_count: number;
  min_level: number | null;
  sample_courses: string[];
}

export interface ProgramBucketTree {
  program_id: string;
  program_label: string;
  type: "major" | "track" | "minor" | "universal";
  buckets: BucketSlot[];
}

export type NavTab = "home" | "plan" | "courses" | "saved" | "ai-advisor" | "about";

export interface NavItem {
  id: NavTab;
  label: string;
  href: string;
  status?: NavItemStatus;
  badgeLabel?: string;
}
