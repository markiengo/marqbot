import { afterEach, describe, expect, it, vi } from "vitest";

import { postCanTake, postFeedback, postRecommend } from "@/lib/api";

describe("API error handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces nested JSON error messages for recommendation requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Planner backend unavailable" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(postRecommend({})).rejects.toThrow("Planner backend unavailable");
  });

  it("surfaces plain-text recommendation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Gateway timeout from upstream planner", {
          status: 504,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(postRecommend({})).rejects.toThrow("Gateway timeout from upstream planner");
  });

  it("keeps generic fallback messaging for HTML error pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><body>Bad gateway</body></html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(postRecommend({})).rejects.toThrow("Recommendation request failed: 502");
  });

  it("surfaces top-level string errors for can-take requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Program context required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(postCanTake({})).rejects.toThrow("Program context required");
  });

  it("surfaces top-level message fields for feedback requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Feedback service unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      postFeedback({
        rating: 4,
        message: "test",
        context: {
          source: "planner",
          route: "/planner",
          session_snapshot: {
            completed: [],
            inProgress: [],
            targetSemester: "Fall 2026",
            semesterCount: "3",
            maxRecs: "3",
            canTake: "",
            declaredMajors: [],
            declaredTracks: [],
            declaredMinors: [],
            discoveryTheme: "",
            activeNavTab: "planner",
            lastRequestedCount: 3,
          },
          recommendation_snapshot: null,
        },
      }),
    ).rejects.toThrow("Feedback service unavailable");
  });
});
