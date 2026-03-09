// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SemesterModal } from "../src/components/planner/SemesterModal";
import { CourseDetailModal } from "../src/components/shared/CourseDetailModal";

describe("SemesterModal balance policy notes", () => {
  test("renders balance-policy chips from semester metadata", () => {
    render(
      createElement(SemesterModal, {
        open: true,
        onClose: () => {},
        semester: {
          target_semester: "Fall 2026",
          standing_label: "Sophomore",
          recommendations: [
            {
              course_code: "FINA 3001",
              course_name: "Finance Core",
              credits: 3,
              fills_buckets: ["FIN_MAJOR::FIN_CORE"],
            },
          ],
          eligible_count: 1,
          balance_policy: {
            declared_min_achieved: 1,
            declared_min_relaxed: false,
            family_cap_relaxed: true,
          },
        },
        index: 0,
        totalCount: 1,
        requestedCount: 5,
        courses: [
          {
            course_code: "FINA 3001",
            course_name: "Finance Core",
            credits: 3,
            level: 3000,
          },
        ],
      }),
    );

    expect(screen.getByText("Major or track progress prioritized")).toBeInTheDocument();
    expect(screen.getByText("Family balance relaxed because the pool was thin")).toBeInTheDocument();
    expect(screen.queryByText("Limited major or track options this term")).not.toBeInTheDocument();
  });

  test("uses compact recommendation cards and hides boilerplate why text", () => {
    render(
      createElement(SemesterModal, {
        open: true,
        onClose: () => {},
        semester: {
          target_semester: "Fall 2026",
          recommendations: [
            {
              course_code: "FINA 4050",
              course_name: "Applied Financial Modeling",
              credits: 3,
              why: "This course advances your declared degree path and counts toward 5 unmet requirement bucket(s).",
              prereq_check: "No prerequisites",
              fills_buckets: [
                "FIN_MAJOR::FIN_ELECTIVE_A",
                "FIN_MAJOR::FIN_ELECTIVE_B",
                "FIN_MAJOR::FIN_ELECTIVE_C",
              ],
            },
          ],
        },
        index: 0,
        totalCount: 1,
        requestedCount: 3,
        courses: [
          {
            course_code: "FINA 4050",
            course_name: "Applied Financial Modeling",
            credits: 3,
            level: 4000,
          },
        ],
        onCourseClick: () => {},
      }),
    );

    expect(screen.queryByText(/This course advances your declared degree path/i)).not.toBeInTheDocument();
    expect(screen.getByText("No prereqs")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.getByText("View details")).toBeInTheDocument();
  });
});

describe("CourseDetailModal planner context", () => {
  test("renders expanded planner details in the course detail view", () => {
    render(
      createElement(CourseDetailModal, {
        open: true,
        onClose: () => {},
        courseCode: "FINA 4050",
        courseName: "Applied Financial Modeling",
        credits: 3,
        description: "Builds spreadsheet and forecasting skills for finance majors.",
        plannerReason: "This one opens later finance electives and helps your main path.",
        plannerNotes: "Take it after ACCO 1030 if you can.",
        plannerWarnings: ["junior standing required"],
      }),
    );

    expect(screen.getByText("Why this showed up")).toBeInTheDocument();
    expect(screen.getByText("This one opens later finance electives and helps your main path.")).toBeInTheDocument();
    expect(screen.getByText("Planner note")).toBeInTheDocument();
    expect(screen.getByText("Take it after ACCO 1030 if you can.")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("junior standing required")).toBeInTheDocument();
  });
});
