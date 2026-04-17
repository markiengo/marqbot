import { describe, expect, test } from "vitest";

import { buildSavedPlanExportData } from "../src/lib/savedPlanExport";
import type { ProgramsData, SavedPlanRecord } from "../src/lib/types";

const programs: ProgramsData = {
  majors: [
    { id: "FIN_MAJOR", label: "Finance", requires_primary_major: false },
    { id: "INSY_MAJOR", label: "Information Systems", requires_primary_major: false },
  ],
  tracks: [],
  minors: [],
  default_track_id: "FIN_MAJOR",
  bucket_labels: {
    CORE: "Finance: Finance Core",
    BCC_REQUIRED: "Business Core Courses: Business Core Required",
    BCC_ANALYTICS: "Business Core Courses: BCC Analytics",
    BCC_ENHANCE: "Business Core Courses: BCC Core Enhancement",
    BCC_ETHICS: "Business Core Courses: BCC Ethics",
    MCC_CORE: "MCC Foundation: MCC Core",
    MCC_WRIT: "MCC: Writing Intensive: MCC Writing Intensive",
    MCC_ESSV2: "MCC: Engaging Social Systems & Values 2: MCC Engaging Social Systems & Values 2",
    MCC_CULM: "MCC: Culminating Course: MCC Culminating Course",
    MCC_DISC_CMI_HUM: "MCC Discovery: Cognition Memory & Intelligence: Discovery Humanities",
    "insy-choose-2": "Information Systems: Choose 2",
    "choose-1": "Finance: Choose 1",
    "insy-elec-4": "Information Systems: 4 Business Electives (12 credits)",
    "fina-elec-4": "Finance: 4 Business Electives (12 credits)",
  },
};

const courses = [
  { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000, catalog_prereq_raw: "ACCO 1031" },
  { course_code: "MANA 3001", course_name: "Behavior and Organization", credits: 3, level: 3000, catalog_prereq_raw: "none" },
  { course_code: "BUAN 3065", course_name: "Unlocking Business Insights through Predictive Analytics", credits: 3, level: 3000, catalog_prereq_raw: "none" },
  { course_code: "ENTP 3001", course_name: "Entrepreneurship", credits: 3, level: 3000, catalog_prereq_raw: "none" },
  { course_code: "BULA 3001", course_name: "Legal and Ethical Environment of Business", credits: 3, level: 3000, catalog_prereq_raw: "none" },
  { course_code: "PHIL 1001", course_name: "Foundations in Philosophy", credits: 3, level: 1000, catalog_prereq_raw: "none" },
  { course_code: "ENGL 3250", course_name: "Life-Writing, Creativity and Community", credits: 3, level: 3000, catalog_prereq_raw: "none" },
  { course_code: "INSY 4055", course_name: "Web-based Applications", credits: 3, level: 4000, catalog_prereq_raw: "INSY 4051" },
  { course_code: "FINA 4100", course_name: "Applied Finance Lab", credits: 3, level: 4000, catalog_prereq_raw: "FINA 3001" },
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
    declaredMajors: ["FIN_MAJOR", "INSY_MAJOR"],
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
  manualAddPins: [],
  recommendationData: {
    mode: "recommendations",
    current_progress: {},
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
          {
            course_code: "MANA 3001",
            course_name: "Behavior and Organization",
            credits: 3,
            fills_buckets: ["BCC::BCC_REQUIRED"],
          },
          {
            course_code: "BUAN 3065",
            course_name: "Unlocking Business Insights through Predictive Analytics",
            credits: 3,
            fills_buckets: ["BCC::BCC_ANALYTICS"],
          },
          {
            course_code: "ENTP 3001",
            course_name: "Entrepreneurship",
            credits: 3,
            fills_buckets: ["BCC::BCC_ENHANCE"],
          },
          {
            course_code: "BULA 3001",
            course_name: "Legal and Ethical Environment of Business",
            credits: 3,
            fills_buckets: ["BCC::BCC_ETHICS"],
          },
          {
            course_code: "PHIL 1001",
            course_name: "Foundations in Philosophy",
            credits: 3,
            fills_buckets: ["MCC::MCC_CORE"],
          },
          {
            course_code: "ENGL 3250",
            course_name: "Life-Writing, Creativity and Community",
            credits: 3,
            fills_buckets: ["MCC::MCC_WRIT", "MCC::MCC_ESSV2", "MCC::MCC_CULM", "MCC::MCC_DISC_CMI_HUM"],
          },
          {
            course_code: "INSY 4055",
            course_name: "Web-based Applications",
            credits: 3,
            fills_buckets: ["INSY_MAJOR::insy-choose-2"],
          },
          {
            course_code: "FINA 4100",
            course_name: "Applied Finance Lab",
            credits: 3,
            fills_buckets: ["FIN_MAJOR::choose-1", "INSY_MAJOR::insy-elec-4", "FIN_MAJOR::fina-elec-4"],
          },
        ],
      },
      {
        target_semester: "Spring 2027",
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
  test("trims trailing empty semesters and standardizes PDF satisfy labels", () => {
    const exportData = buildSavedPlanExportData(plan, courses, programs);

    expect(exportData).not.toBeNull();
    expect(exportData?.semesters.map((semester) => semester.targetSemester)).toEqual(["Fall 2026"]);
    expect(exportData?.semesters[0].courses).toEqual([
      {
        courseCode: "FINA 3001",
        courseName: "Financial Management",
        credits: 3,
        prereqText: "ACCO 1031",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Finance Core"],
      },
      {
        courseCode: "MANA 3001",
        courseName: "Behavior and Organization",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Business Core Required"],
      },
      {
        courseCode: "BUAN 3065",
        courseName: "Unlocking Business Insights through Predictive Analytics",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Business Core - Analytics"],
      },
      {
        courseCode: "ENTP 3001",
        courseName: "Entrepreneurship",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Business Core - Core Enhancement"],
      },
      {
        courseCode: "BULA 3001",
        courseName: "Legal and Ethical Environment of Business",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Business Core - Ethics"],
      },
      {
        courseCode: "PHIL 1001",
        courseName: "Foundations in Philosophy",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Fall 2026",
        bucketLabels: ["Marquette Core"],
      },
      {
        courseCode: "ENGL 3250",
        courseName: "Life-Writing, Creativity and Community",
        credits: 3,
        prereqText: "None",
        semesterLabel: "Fall 2026",
        bucketLabels: [
          "Marquette Core - WRIT",
          "Marquette Core - ESSV2",
          "Marquette Core - CULM",
          "Marquette Core - Discovery CMI Humanities",
        ],
      },
      {
        courseCode: "INSY 4055",
        courseName: "Web-based Applications",
        credits: 3,
        prereqText: "INSY 4051",
        semesterLabel: "Fall 2026",
        bucketLabels: ["INSY - Electives (2 courses)"],
      },
      {
        courseCode: "FINA 4100",
        courseName: "Applied Finance Lab",
        credits: 3,
        prereqText: "FINA 3001",
        semesterLabel: "Fall 2026",
        bucketLabels: ["FIN - Electives (1 course)", "Business Electives"],
      },
    ]);
  });
});
