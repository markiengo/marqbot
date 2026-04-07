import { describe, expect, test } from "vitest";

import { buildSavedPlanExportData } from "../src/lib/savedPlanExport";
import type { ProgramsData, SavedPlanRecord } from "../src/lib/types";

const programs: ProgramsData = {
  majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
  tracks: [],
  minors: [],
  default_track_id: "FIN_MAJOR",
  bucket_labels: {
    "FIN_MAJOR::CORE": "Finance: Finance Core",
    "MCC::MCC_WRIT": "MCC: Writing Intensive",
  },
};

const courses = [
  { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000, catalog_prereq_raw: "none" },
  { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000, catalog_prereq_raw: "ACCO 1031" },
  { course_code: "ENGL 3250", course_name: "Professional Writing", credits: 3, level: 3000, catalog_prereq_raw: "none" },
];

const plan: SavedPlanRecord = {
  id: "plan-1",
  name: "Finance Sprint",
  notes: "Recruiting semester",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-02T10:00:00.000Z",
  inputs: {
    completed: ["ACCO 1030"],
    inProgress: [],
    declaredMajors: ["FIN_MAJOR"],
    declaredTracks: [],
    declaredMinors: [],
    discoveryTheme: "",
    targetSemester: "Fall 2026",
    semesterCount: "4",
    maxRecs: "5",
    includeSummer: false,
    studentStage: "undergrad",
    studentStageIsExplicit: false,
  },
  recommendationData: {
    mode: "recommendations",
    current_progress: {
      "MCC::MCC_WRIT": {
        needed: 1,
        completed_applied: [],
        in_progress_applied: [],
        satisfied: false,
        label: "Writing Intensive",
      },
      "FIN_MAJOR::CORE": {
        needed: 2,
        completed_applied: ["ACCO 1030"],
        in_progress_applied: ["FINA 3001"],
        satisfied: false,
        label: "Finance Core",
      },
    },
    semesters: [
      {
        target_semester: "Fall 2026",
        recommendations: [
          {
            course_code: "FINA 3001",
            course_name: "Financial Management",
            credits: 3,
            fills_buckets: ["FIN_MAJOR::CORE"],
          },
        ],
      },
      {
        target_semester: "Spring 2027",
        recommendations: [
          {
            course_code: "FINA 3001",
            course_name: "Financial Management",
            credits: 3,
            fills_buckets: ["FIN_MAJOR::CORE"],
          },
          {
            course_code: "ENGL 3250",
            course_name: "Professional Writing",
            credits: 3,
            fills_buckets: ["MCC::MCC_WRIT", "FIN_MAJOR::CORE"],
          },
        ],
      },
      {
        target_semester: "Fall 2027",
        recommendations: [],
      },
    ],
  },
  lastRequestedCount: 5,
  inputHash: "abc",
  resultsInputHash: "abc",
  lastGeneratedAt: "2026-03-02T10:00:00.000Z",
};

describe("buildSavedPlanExportData", () => {
  test("trims trailing empty semesters and adds bucket labels to each planned course", () => {
    const exportData = buildSavedPlanExportData(plan, courses, programs);

    expect(exportData).not.toBeNull();
    expect(exportData?.semesters.map((semester) => semester.targetSemester)).toEqual([
      "Fall 2026",
      "Spring 2027",
    ]);
    expect(exportData?.semesters[0].courses).toEqual([
      {
        courseCode: "FINA 3001",
        courseName: "Financial Management",
        credits: 3,
        prereqText: "ACCO 1031",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Finance Core"],
      },
    ]);
    expect(exportData?.semesters[1].courses).toEqual([
      {
        courseCode: "FINA 3001",
        courseName: "Financial Management",
        credits: 3,
        prereqText: "ACCO 1031",
        semesterLabel: "Spring 2027",
        bucketLabels: ["Finance Core"],
      },
      {
        courseCode: "ENGL 3250",
        courseName: "Professional Writing",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Spring 2027",
        bucketLabels: ["Writing Intensive", "Finance Core"],
      },
    ]);
  });
});
