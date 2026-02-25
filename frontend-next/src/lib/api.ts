import type { Course, ProgramsData, RecommendationResponse, CanTakeResponse } from "./types";

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
  return {
    majors: (data.majors ?? []).map((m: Record<string, unknown>) => ({
      id: m.major_id ?? m.id,
      label: m.label,
    })),
    tracks: (data.tracks ?? []).map((t: Record<string, unknown>) => ({
      id: t.track_id ?? t.id,
      label: t.label,
      parent_major_id: t.parent_major_id,
    })),
    default_track_id: data.default_track_id ?? "",
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
