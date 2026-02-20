import {
  setupMultiselect,
  setupSingleSelectInput,
  closeDropdowns,
} from "../../frontend/modules/multiselect.js";

function keydown(el, key) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function input(el, value) {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function activeCode(dropdownEl) {
  const active = dropdownEl.querySelector(".ms-option.active .opt-code");
  return active ? active.textContent : null;
}

describe("multiselect keyboard navigation", () => {
  const courses = [
    { course_code: "ECON 1103", course_name: "Microeconomics", prereq_level: 1 },
    { course_code: "ECON 1104", course_name: "Macroeconomics", prereq_level: 2 },
    { course_code: "ECON 3004", course_name: "Intermediate Macro", prereq_level: 3 },
  ];

  test("ArrowUp/ArrowDown + Enter selects active option", () => {
    const searchEl = document.createElement("input");
    const dropdownEl = document.createElement("div");
    const selected = [];
    const onClose = () => closeDropdowns(dropdownEl);

    setupMultiselect(
      searchEl,
      dropdownEl,
      new Set(),
      courses,
      c => selected.push(c.course_code),
      onClose,
    );

    input(searchEl, "econ");
    expect(dropdownEl.classList.contains("open")).toBe(true);
    expect(activeCode(dropdownEl)).toBe("ECON 1103");

    keydown(searchEl, "ArrowDown");
    expect(activeCode(dropdownEl)).toBe("ECON 1104");

    keydown(searchEl, "Enter");
    expect(selected).toEqual(["ECON 1104"]);
    expect(searchEl.value).toBe("");
    expect(dropdownEl.classList.contains("open")).toBe(false);
  });

  test("no wrap at top/bottom boundaries", () => {
    const searchEl = document.createElement("input");
    const dropdownEl = document.createElement("div");
    const onClose = () => closeDropdowns(dropdownEl);

    setupMultiselect(
      searchEl,
      dropdownEl,
      new Set(),
      courses,
      () => {},
      onClose,
    );

    input(searchEl, "econ");
    expect(activeCode(dropdownEl)).toBe("ECON 1103");

    keydown(searchEl, "ArrowUp");
    expect(activeCode(dropdownEl)).toBe("ECON 1103");

    keydown(searchEl, "ArrowDown");
    keydown(searchEl, "ArrowDown");
    expect(activeCode(dropdownEl)).toBe("ECON 3004");

    keydown(searchEl, "ArrowDown");
    expect(activeCode(dropdownEl)).toBe("ECON 3004");
  });

  test("Escape closes dropdown and clears input", () => {
    const searchEl = document.createElement("input");
    const dropdownEl = document.createElement("div");
    const onClose = () => closeDropdowns(dropdownEl);

    setupMultiselect(
      searchEl,
      dropdownEl,
      new Set(),
      courses,
      () => {},
      onClose,
    );

    input(searchEl, "econ");
    expect(dropdownEl.classList.contains("open")).toBe(true);

    keydown(searchEl, "Escape");
    expect(dropdownEl.classList.contains("open")).toBe(false);
    expect(searchEl.value).toBe("");
  });

  test("single-select input supports keyboard selection", () => {
    const searchEl = document.createElement("input");
    const dropdownEl = document.createElement("div");
    const selected = [];
    const onClose = () => closeDropdowns(dropdownEl);

    setupSingleSelectInput(
      searchEl,
      dropdownEl,
      courses,
      c => selected.push(c.course_code),
      onClose,
    );

    input(searchEl, "econ");
    keydown(searchEl, "ArrowDown");
    keydown(searchEl, "Enter");

    expect(selected).toEqual(["ECON 1104"]);
    expect(dropdownEl.classList.contains("open")).toBe(false);
  });
});
