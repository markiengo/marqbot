// @vitest-environment jsdom

import "./setupTests";

import { createElement } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { MultiSelect } from "../src/components/shared/MultiSelect";
import { renderWithApp, makeAppState } from "./testUtils";

describe("MultiSelect component", () => {
  test("filters out selections from both selected and other sets, then adds a new course", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    const onRemove = vi.fn();

    renderWithApp(
      createElement(MultiSelect, {
        courses: [
          { course_code: "ACCO 1030", course_name: "Financial Accounting", credits: 3, level: 1000 },
          { course_code: "FINA 3001", course_name: "Financial Management", credits: 3, level: 3000 },
        ],
        selected: new Set(["MARK 3001"]),
        otherSet: new Set(["ACCO 1030"]),
        onAdd,
        onRemove,
      }),
      makeAppState(),
    );

    const input = screen.getByPlaceholderText(/search courses/i);

    await user.type(input, "acco");
    expect(screen.queryByText(/financial accounting/i)).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "fina");
    await user.click(await screen.findByText(/financial management/i));

    expect(onAdd).toHaveBeenCalledWith("FINA 3001");
    expect(input).toHaveValue("");
    expect(screen.getByText("MARK 3001")).toBeInTheDocument();
  });

  test("keeps the picker open after selecting with Enter", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    renderWithApp(
      createElement(MultiSelect, {
        courses: [
          { course_code: "AFAS 1011", course_name: "Department of the Air Force Professionalism", credits: 3, level: 1000 },
          { course_code: "AFAS 1012", course_name: "Department of the Air Force Competition and Security", credits: 3, level: 1000 },
        ],
        selected: new Set<string>(),
        otherSet: new Set<string>(),
        onAdd,
        onRemove: vi.fn(),
      }),
      makeAppState(),
    );

    const input = screen.getByPlaceholderText(/search courses/i);
    await user.click(input);
    await user.type(input, "a");
    await user.keyboard("{Enter}");

    expect(onAdd).toHaveBeenCalledWith("AFAS 1011");
    expect(input).toHaveValue("");
    expect(screen.getByText(/department of the air force competition and security/i)).toBeInTheDocument();
  });
});
