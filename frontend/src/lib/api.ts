import type {
  Course,
  ProgramsData,
  RecommendationResponse,
  CanTakeResponse,
  FeedbackPayload,
  FeedbackResponse,
} from "./types";

const API_BASE = typeof window !== "undefined" ? "" : "http://localhost:5000";


export async function loadCourses(): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/api/courses`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load courses: ${res.status}`);
  const data = await res.json();
  return data.courses ?? data;
}

export async function loadPrograms(): Promise<ProgramsData> {
  const res = await fetch(`${API_BASE}/api/programs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load programs: ${res.status}`);
  const data = await res.json();
  const rawBucketLabels =
    data && typeof data.bucket_labels === "object" && data.bucket_labels
      ? (data.bucket_labels as Record<string, unknown>)
      : {};
  const bucket_labels = Object.fromEntries(
    Object.entries(rawBucketLabels)
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => key.length > 0 && value.length > 0),
  ) as Record<string, string>;
  return {
    majors: (data.majors ?? []).map((m: Record<string, unknown>) => ({
      id: String(m.major_id || m.id || ""),
      label: String(m.label || m.major_id || m.id || ""),
      requires_primary_major: Boolean(m.requires_primary_major),
    })),
    tracks: (data.tracks ?? []).map((t: Record<string, unknown>) => ({
      id: t.track_id ?? t.id,
      label: t.label,
      parent_major_id: t.parent_major_id,
      required_major_id: t.required_major_id,
    })),
    minors: (data.minors ?? []).map((m: Record<string, unknown>) => ({
      id: String(m.minor_id || m.id || ""),
      label: String(m.label || m.minor_id || m.id || ""),
      active: m.active !== false,
    })),
    default_track_id: data.default_track_id ?? "",
    bucket_labels,
  };
}

export async function postRecommend(
  payload: Record<string, unknown>,
): Promise<RecommendationResponse> {
  const res = await fetch(`${API_BASE}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Recommendation request failed: ${res.status}`);
  }
  return res.json();
}

export async function postValidatePrereqs(
  payload: Record<string, unknown>,
): Promise<{ inconsistencies: { course_code: string; prereqs_in_progress: string[] }[] }> {
  const res = await fetch(`${API_BASE}/api/validate-prereqs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { inconsistencies: [] };
  return res.json();
}

export async function postCanTake(
  payload: Record<string, unknown>,
): Promise<CanTakeResponse> {
  const res = await fetch(`${API_BASE}/api/can-take`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || body?.error || `Can-take request failed: ${res.status}`);
  }
  return res.json();
}

export async function postFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Feedback request failed: ${res.status}`);
  }
  return res.json();
}
