// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import PlannerPage from "../src/app/planner/page";

vi.mock("@/hooks/useCourses", () => ({
  useCourses: () => ({
    courses: [{ course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3 }],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePrograms", () => ({
  usePrograms: () => ({
    programs: {
      majors: [{ id: "FIN_MAJOR", label: "Finance", requires_primary_major: false }],
    },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/components/planner/PlannerLayout", () => ({
  PlannerLayout: () => createElement("div", { "data-testid": "planner-layout" }, "Planner"),
}));

vi.mock("@/components/shared/Button", () => ({
  Button: ({ children, ...props }: any) => createElement("button", props, children),
}));

describe("PlannerPage", () => {
  test("keeps the planner route scrollable below desktop breakpoints", () => {
    render(createElement(PlannerPage));

    const shell = screen.getByTestId("planner-layout").parentElement;
    const classNames = shell?.className.split(/\s+/) ?? [];

    expect(classNames).toContain("min-h-[calc(100dvh-4rem)]");
    expect(classNames).not.toContain("lg:h-[calc(100dvh-4rem)]");
    expect(classNames).not.toContain("lg:overflow-hidden");
  });
});
