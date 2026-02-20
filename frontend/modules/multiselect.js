import { esc, filterCourses } from "./utils.js";

function clampIndex(idx, length) {
  if (length <= 0) return -1;
  if (idx < 0) return 0;
  if (idx >= length) return length - 1;
  return idx;
}

function getOptionEls(dropdownEl) {
  return Array.from(dropdownEl.querySelectorAll(".ms-option"));
}

function setActiveOption(dropdownEl, activeIndex) {
  const options = getOptionEls(dropdownEl);
  options.forEach((opt, idx) => opt.classList.toggle("active", idx === activeIndex));
  const activeEl = options[activeIndex];
  if (activeEl && typeof activeEl.scrollIntoView === "function") {
    activeEl.scrollIntoView({ block: "nearest" });
  }
}

export function renderDropdown(dropdownEl, items, onSelect, activeIndex = 0) {
  dropdownEl.innerHTML = "";
  if (items.length === 0) {
    dropdownEl.innerHTML = `<div class="ms-option-empty">No results</div>`;
    dropdownEl.classList.add("open");
    return;
  }
  const safeActive = clampIndex(activeIndex, items.length);
  items.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = `ms-option${idx === safeActive ? " active" : ""}`;
    div.innerHTML = `<span><span class="opt-code">${esc(c.course_code)}</span><span class="opt-name">${esc(c.course_name || "")}</span></span>`;
    div.addEventListener("mousedown", e => { e.preventDefault(); onSelect(c); });
    dropdownEl.appendChild(div);
  });
  dropdownEl.classList.add("open");
  setActiveOption(dropdownEl, safeActive);
}

export function closeDropdowns(...dropdownEls) {
  dropdownEls.forEach(el => el.classList.remove("open"));
}

export function renderChips(chipsEl, set, onRemove, resolveLabel = code => code) {
  chipsEl.innerHTML = "";
  set.forEach(code => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${esc(resolveLabel(code))}<button class="chip-remove" title="Remove">x</button>`;
    chip.querySelector(".chip-remove").addEventListener("click", () => onRemove(code));
    chipsEl.appendChild(chip);
  });
}

export function addChip(code, targetSet, chipsEl, otherSet, otherChipsEl, onRenderChips, onSave) {
  if (targetSet.has(code)) return;
  otherSet.delete(code); // can't be in both
  targetSet.add(code);
  onRenderChips();
  onSave();
}

export function removeChip(code, targetSet, chipsEl, onRenderChips, onSave) {
  targetSet.delete(code);
  onRenderChips();
  onSave();
}

export function setupMultiselect(searchEl, dropdownEl, targetSet, courses, onSelect, onClose) {
  let matches = [];
  let activeIndex = -1;

  const close = () => {
    matches = [];
    activeIndex = -1;
    onClose();
  };

  const selectActive = () => {
    if (activeIndex < 0 || activeIndex >= matches.length) return;
    const selected = matches[activeIndex];
    onSelect(selected);
    searchEl.value = "";
    close();
    searchEl.focus();
  };

  searchEl.addEventListener("input", () => {
    matches = filterCourses(searchEl.value, targetSet, courses);
    if (searchEl.value.trim().length < 2) {
      close();
      return;
    }
    activeIndex = matches.length ? 0 : -1;
    renderDropdown(dropdownEl, matches, c => {
      onSelect(c);
      searchEl.value = "";
      close();
      searchEl.focus();
    }, activeIndex);
  });

  searchEl.addEventListener("blur", () => setTimeout(close, 150));
  searchEl.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      close();
      searchEl.value = "";
      return;
    }
    if (!dropdownEl.classList.contains("open") || matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = clampIndex(activeIndex + 1, matches.length);
      setActiveOption(dropdownEl, activeIndex);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = clampIndex(activeIndex - 1, matches.length);
      setActiveOption(dropdownEl, activeIndex);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      selectActive();
    }
  });
}

export function setupSingleSelectInput(searchEl, dropdownEl, courses, onSelect, onClose) {
  let matches = [];
  let activeIndex = -1;

  const close = () => {
    matches = [];
    activeIndex = -1;
    onClose();
  };

  const selectActive = () => {
    if (activeIndex < 0 || activeIndex >= matches.length) return;
    const selected = matches[activeIndex];
    onSelect(selected);
    close();
    searchEl.focus();
  };

  searchEl.addEventListener("input", () => {
    matches = filterCourses(searchEl.value, new Set(), courses);
    if (searchEl.value.trim().length < 2) {
      close();
      return;
    }
    activeIndex = matches.length ? 0 : -1;
    renderDropdown(dropdownEl, matches, c => {
      onSelect(c);
      close();
      searchEl.focus();
    }, activeIndex);
  });

  searchEl.addEventListener("blur", () => setTimeout(close, 150));
  searchEl.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      close();
      searchEl.value = "";
      return;
    }
    if (!dropdownEl.classList.contains("open") || matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = clampIndex(activeIndex + 1, matches.length);
      setActiveOption(dropdownEl, activeIndex);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = clampIndex(activeIndex - 1, matches.length);
      setActiveOption(dropdownEl, activeIndex);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      selectActive();
    }
  });
}

export function setupPasteFallback(toggleBtnId, pasteId, applyBtnId, errorsId, targetSet, otherSet, courses, onAddChip, onClose) {
  const toggle = document.getElementById(toggleBtnId);
  const textarea = document.getElementById(pasteId);
  const applyBtn = document.getElementById(applyBtnId);
  const errorsEl = document.getElementById(errorsId);

  toggle.addEventListener("click", () => {
    textarea.classList.toggle("hidden");
    applyBtn.classList.toggle("hidden");
    errorsEl.classList.add("hidden");
  });

  applyBtn.addEventListener("click", () => {
    const raw = textarea.value;
    const tokens = raw.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean);
    const notFound = [];
    const catalogMap = Object.fromEntries(courses.map(c => [c.course_code.toUpperCase(), c.course_code]));

    tokens.forEach(token => {
      const norm = token.toUpperCase().replace(/\s*-\s*/, " ").replace(/([A-Z]+)\s*(\d{4})/, "$1 $2");
      if (catalogMap[norm]) {
        onAddChip(catalogMap[norm]);
      } else {
        notFound.push(token);
      }
    });

    textarea.value = "";
    textarea.classList.add("hidden");
    applyBtn.classList.add("hidden");

    if (notFound.length) {
      errorsEl.textContent = `Not found in catalog: ${notFound.join(", ")}`;
      errorsEl.classList.remove("hidden");
    } else {
      errorsEl.classList.add("hidden");
    }
  });
}
