import { describe, expect, test } from "vitest";

import { groupProgressByTierWithMajors } from "../src/lib/rendering";
import type { BucketProgress } from "../src/lib/types";

function makeBucketProgress(label: string): BucketProgress {
  return {
    label,
    needed: 1,
    needed_count: 1,
    completed_applied: [],
    in_progress_applied: [],
    completed_done: 0,
    in_progress_increment: 0,
    completed_courses: 0,
    in_progress_courses: 0,
    requirement_mode: "required",
  };
}

describe("groupProgressByTierWithMajors", () => {
  test("splits majors, tracks, and minors into separate ordered sections", () => {
    const sections = groupProgressByTierWithMajors(
      {
        MCC_CORE: makeBucketProgress("MCC Core"),
        BCC_REQUIRED: makeBucketProgress("Business Core Required"),
        "FIN_MAJOR::fin-core": makeBucketProgress("Finance Major: Core"),
        "CB_TRACK::cb-core": makeBucketProgress("Commercial Banking Track: Core"),
        "ENTP_MINOR::entp-core": makeBucketProgress("Entrepreneurship Minor: Core"),
      },
      new Map([
        ["FIN_MAJOR", "Finance"],
        ["CB_TRACK", "Commercial Banking Track"],
        ["ENTP_MINOR", "Entrepreneurship Minor"],
      ]),
      ["FIN_MAJOR", "CB_TRACK", "ENTP_MINOR"],
      {
        declaredTracks: ["CB_TRACK"],
        declaredMinors: ["ENTP_MINOR"],
      },
    );

    expect(sections.map((section) => section.label)).toEqual([
      "MCC",
      "BCC",
      "Majors",
      "Tracks",
      "Minors",
    ]);
    expect(sections.find((section) => section.sectionKey === "major")?.entries).toHaveLength(1);
    expect(sections.find((section) => section.sectionKey === "track")?.entries).toHaveLength(1);
    expect(sections.find((section) => section.sectionKey === "minor")?.entries).toHaveLength(1);
  });

  test("keeps major progression grouped by major inside the majors section", () => {
    const sections = groupProgressByTierWithMajors(
      {
        "FIN_MAJOR::fin-core": makeBucketProgress("Finance Major: Core"),
        "ACCO_MAJOR::acco-core": makeBucketProgress("Accounting Major: Core"),
      },
      new Map([
        ["FIN_MAJOR", "Finance"],
        ["ACCO_MAJOR", "Accounting"],
      ]),
      ["FIN_MAJOR", "ACCO_MAJOR"],
      {
        declaredTracks: [],
        declaredMinors: [],
      },
    );

    expect(sections.find((section) => section.sectionKey === "major")?.subGroups).toEqual([
      expect.objectContaining({ parentId: "FIN_MAJOR", label: "Finance" }),
      expect.objectContaining({ parentId: "ACCO_MAJOR", label: "Accounting" }),
    ]);
  });

  test("adds empty track and minor sections when nothing is declared", () => {
    const sections = groupProgressByTierWithMajors(
      {
        MCC_CORE: makeBucketProgress("MCC Core"),
        BCC_REQUIRED: makeBucketProgress("Business Core Required"),
        "FIN_MAJOR::fin-core": makeBucketProgress("Finance Major: Core"),
      },
      new Map([["FIN_MAJOR", "Finance"]]),
      ["FIN_MAJOR"],
      {
        declaredTracks: [],
        declaredMinors: [],
      },
    );

    expect(sections.find((section) => section.sectionKey === "track")).toMatchObject({
      label: "Tracks",
      entries: [],
      emptyMessage: "No track selected. Add one in Edit Profile to see track progress here.",
    });
    expect(sections.find((section) => section.sectionKey === "minor")).toMatchObject({
      label: "Minors",
      entries: [],
      emptyMessage: "No minor selected. Add one in Edit Profile to see minor progress here.",
    });
  });
});
