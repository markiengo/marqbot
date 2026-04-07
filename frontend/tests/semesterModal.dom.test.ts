// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { SemesterModal } from "../src/components/planner/SemesterModal";
import { CourseDetailModal } from "../src/components/shared/CourseDetailModal";
import { renderWithApp, makeAppState } from "./testUtils";

const state = makeAppState();

describe("SemesterModal planner copy", () => {
  test("does not render retired balance-policy chips", () => {
    renderWithApp(
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
      state,
    );

    expect(screen.queryByText("Limited major or track options this term")).not.toBeInTheDocument();
    expect(screen.queryByText("Major or track progress prioritized")).not.toBeInTheDocument();
    expect(screen.queryByText("Family balance relaxed because the pool was thin")).not.toBeInTheDocument();
  });

  test("uses compact recommendation cards and hides boilerplate why text", () => {
    renderWithApp(
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
      state,
    );

    expect(screen.queryByText(/This course advances your declared degree path/i)).not.toBeInTheDocument();
    expect(screen.getByText("No prereqs")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.getByText("View details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view details for fina 4050/i })).toBeInTheDocument();
  });

  test("replaces conflicting equivalent selections during semester edits", async () => {
    const user = userEvent.setup();
    const onEditApply = vi.fn(async () => {});

    renderWithApp(
      createElement(SemesterModal, {
        open: true,
        openMode: "edit",
        onClose: () => {},
        onEditApply,
        onRequestCandidates: () => {},
        semester: {
          target_semester: "Fall 2026",
          recommendations: [
            {
              course_code: "MATH 3570",
              course_name: "Introduction to Data Science",
              credits: 3,
              fills_buckets: ["DS_MAJOR::DS_REQ_MATH"],
              conflicts_with_courses: ["COSC 3570"],
            },
          ],
        },
        candidatePool: [
          {
            course_code: "COSC 3570",
            course_name: "Introduction to Data Science",
            credits: 3,
            fills_buckets: ["DS_MAJOR::DS_REQ_MATH"],
            equivalent_to_courses: ["MATH 3570"],
            conflicts_with_courses: ["MATH 3570"],
          },
        ],
        candidatePoolLoading: false,
        index: 0,
        totalCount: 1,
        requestedCount: 4,
        courses: [
          {
            course_code: "MATH 3570",
            course_name: "Introduction to Data Science",
            credits: 3,
            level: 3000,
          },
          {
            course_code: "COSC 3570",
            course_name: "Introduction to Data Science",
            credits: 3,
            level: 3000,
          },
        ],
      }),
      state,
    );

    await user.click(screen.getByRole("button", { name: /add cosc 3570/i }));
    await user.click(screen.getByRole("button", { name: /apply swaps/i }));

    await waitFor(() => expect(onEditApply).toHaveBeenCalledTimes(1));
    const chosenCourses = onEditApply.mock.calls[0][0];
    expect(chosenCourses.map((course: { course_code: string }) => course.course_code)).toEqual(["COSC 3570"]);
  });
});

describe("CourseDetailModal planner context", () => {
  test("renders expanded planner details in the course detail view", () => {
    renderWithApp(
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
      state,
    );

    expect(screen.getByText("Why this showed up")).toBeInTheDocument();
    expect(screen.getByText("This one opens later finance electives and helps your main path.")).toBeInTheDocument();
    expect(screen.getByText("Planner note")).toBeInTheDocument();
    expect(screen.getByText("Take it after ACCO 1030 if you can.")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("junior standing required")).toBeInTheDocument();
  });

  test("renders plain text course names without double-escaped ampersands", () => {
    renderWithApp(
      createElement(CourseDetailModal, {
        open: true,
        onClose: () => {},
        courseCode: "COSC 3820",
        courseName: "Professional Ethics in Computer & Data Science",
        credits: 3,
        description: "Covers ethics in computer and data science practice.",
      }),
      state,
    );

    expect(
      screen.getByText("Professional Ethics in Computer & Data Science"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Professional Ethics in Computer &amp; Data Science"),
    ).not.toBeInTheDocument();
  });
});
