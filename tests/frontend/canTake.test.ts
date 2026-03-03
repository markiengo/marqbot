import { describe, expect, test } from "vitest";

import { isCanTakeResultForQuery } from "../../frontend/src/hooks/useCanTake";

describe("useCanTake result matching", () => {
  test("matches the active query case-insensitively", () => {
    expect(
      isCanTakeResultForQuery("fina 3001", {
        can_take: true,
        requested_course: "FINA 3001",
      }),
    ).toBe(true);
  });

  test("hides stale results for a different course", () => {
    expect(
      isCanTakeResultForQuery("MANA 4101", {
        can_take: false,
        requested_course: "FINA 3001",
      }),
    ).toBe(false);
  });

  test("does not match an empty query", () => {
    expect(
      isCanTakeResultForQuery("   ", {
        can_take: true,
        requested_course: "FINA 3001",
      }),
    ).toBe(false);
  });
});
