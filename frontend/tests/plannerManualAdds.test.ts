import { describe, expect, test } from "vitest";

import { reconcileManualAddPins, updateManualAddPinsFromEdit } from "../src/lib/plannerManualAdds";
import type { PlannerManualAddPin, RecommendedCourse, SemesterData } from "../src/lib/types";

function makeCourse(course_code: string, fills_buckets: string[] = []): RecommendedCourse {
  return {
    course_code,
    course_name: course_code,
    credits: 3,
    fills_buckets,
  };
}

describe("plannerManualAdds", () => {
  test("re-homes an added course to an earlier semester", () => {
    const laterPins = updateManualAddPinsFromEdit({
      semesterIndex: 3,
      originalCourses: [makeCourse("MANA 3001")],
      chosenCourses: [makeCourse("MANA 3001"), makeCourse("BUAN 3065")],
      now: 100,
    });

    const earlierPins = updateManualAddPinsFromEdit({
      existingPins: laterPins,
      semesterIndex: 1,
      originalCourses: [makeCourse("INSY 4055")],
      chosenCourses: [makeCourse("INSY 4055"), makeCourse("BUAN 3065")],
      now: 200,
    });

    expect(earlierPins).toHaveLength(1);
    expect(earlierPins[0].course_code).toBe("BUAN 3065");
    expect(earlierPins[0].semester_index).toBe(1);
    expect(earlierPins[0].pinned_at).toBe(200);
  });

  test("removing a pinned course from its semester deletes the pin", () => {
    const pins: PlannerManualAddPin[] = [
      {
        course_code: "BUAN 3065",
        semester_index: 2,
        course_snapshot: makeCourse("BUAN 3065"),
        pinned_at: 100,
      },
    ];

    const nextPins = updateManualAddPinsFromEdit({
      existingPins: pins,
      semesterIndex: 2,
      originalCourses: [makeCourse("BUAN 3065")],
      chosenCourses: [],
      now: 200,
    });

    expect(nextPins).toEqual([]);
  });

  test("preserves pinned courses after rerun and displaces a generated course", () => {
    const semesters: SemesterData[] = [
      {
        target_semester: "Fall 2027",
        recommendations: [makeCourse("BULA 3001", ["BCC::ANALYTICS"])],
      },
      {
        target_semester: "Spring 2028",
        recommendations: [makeCourse("INSY 4054"), makeCourse("COSC 4600")],
      },
      {
        target_semester: "Fall 2028",
        recommendations: [makeCourse("MANA 4101")],
      },
    ];

    const pins: PlannerManualAddPin[] = [
      {
        course_code: "BUAN 3065",
        semester_index: 1,
        course_snapshot: makeCourse("BUAN 3065", ["BCC::ANALYTICS"]),
        pinned_at: 10,
      },
    ];

    const reconciled = reconcileManualAddPins({
      semesters,
      pins,
      rerunStartIndex: 0,
    });

    expect(reconciled.semesters[1].recommendations?.map((course) => course.course_code)).toEqual([
      "INSY 4054",
      "BUAN 3065",
    ]);
    expect(reconciled.semesters[2].recommendations?.map((course) => course.course_code)).toEqual([
      "MANA 4101",
    ]);
    expect(reconciled.semesters[1].recommendations?.find((course) => course.course_code === "BUAN 3065")?.is_manual_add).toBe(true);
    expect(reconciled.semesters[1].semester_warnings).toContain("Manual adds in this semester were preserved during rerun.");
    expect(reconciled.semesters[2].semester_warnings).toContain("COSC 4600 was pushed out of the visible plan to keep your manual adds in place.");
  });

  test("removes equivalent conflicts when a pinned course is reapplied after rerun", () => {
    const semesters: SemesterData[] = [
      {
        target_semester: "Fall 2027",
        recommendations: [
          makeCourse("MATH 3570", ["DS_MAJOR::DS_REQ_MATH"]),
          makeCourse("MANA 3001"),
        ],
      },
      {
        target_semester: "Spring 2028",
        recommendations: [makeCourse("COSC 4600")],
      },
    ];

    const pins: PlannerManualAddPin[] = [
      {
        course_code: "COSC 3570",
        semester_index: 0,
        course_snapshot: {
          ...makeCourse("COSC 3570", ["DS_MAJOR::DS_REQ_MATH"]),
          conflicts_with_courses: ["MATH 3570"],
        },
        pinned_at: 10,
      },
    ];

    semesters[0].recommendations![0].conflicts_with_courses = ["COSC 3570"];

    const reconciled = reconcileManualAddPins({
      semesters,
      pins,
      rerunStartIndex: 0,
    });

    expect(reconciled.semesters[0].recommendations?.map((course) => course.course_code)).toEqual([
      "MANA 3001",
      "COSC 3570",
    ]);
  });
});
