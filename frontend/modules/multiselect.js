import { esc, filterCourses } from "./utils.js";

export function renderDropdown(dropdownEl, items, onSelect) {
  dropdownEl.innerHTML = "";
  if (items.length === 0) {
    dropdownEl.innerHTML = `<div class="ms-option-empty">No results</div>`;
    dropdownEl.classList.add("open");
    return;
  }
  items.forEach(c => {
    const div = document.createElement("div");
    div.className = "ms-option";
    div.innerHTML = `<span><span class="opt-code">${c.course_code}</span><span class="opt-name">${c.course_name || ""}</span></span>`;
    div.addEventListener("mousedown", e => { e.preventDefault(); onSelect(c); });
    dropdownEl.appendChild(div);
  });
  dropdownEl.classList.add("open");
}

export function closeDropdowns(...dropdownEls) {
  dropdownEls.forEach(el => el.classList.remove("open"));
}

export function renderChips(chipsEl, set, onRemove) {
  chipsEl.innerHTML = "";
  set.forEach(code => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${code}<button class="chip-remove" title="Remove">×</button>`;
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
  searchEl.addEventListener("input", () => {
    const matches = filterCourses(searchEl.value, targetSet, courses);
    if (searchEl.value.trim().length < 2) { onClose(); return; }
    renderDropdown(dropdownEl, matches, c => {
      onSelect(c);
      searchEl.value = "";
      onClose();
      searchEl.focus();
    });
  });
  searchEl.addEventListener("blur", () => setTimeout(onClose, 150));
  searchEl.addEventListener("keydown", e => {
    if (e.key === "Escape") { onClose(); searchEl.value = ""; }
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
