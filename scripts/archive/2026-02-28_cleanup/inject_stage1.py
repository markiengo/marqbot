#!/usr/bin/env python3
"""
Stage 1 data injection script.

Parses docs/data_inject_stage1.txt and updates:
  data/courses.csv
  data/course_prereqs.csv
  data/course_offerings.csv

Rules (from docs/data_injection.md):
  - Existing rows: compare-and-update (only overwrite fields that differ)
  - New course codes: append at end
  - Idempotent: running twice changes nothing on second run

Usage:
  .venv/Scripts/python.exe scripts/inject_stage1.py [--dry-run]
"""

import re
import csv
import sys
from pathlib import Path

ROOT         = Path(__file__).parent.parent
TXT_PATH     = ROOT / "docs" / "data_inject_stage1.txt"
COURSES_CSV  = ROOT / "data" / "courses.csv"
PREREQS_CSV  = ROOT / "data" / "course_prereqs.csv"
OFFERINGS_CSV= ROOT / "data" / "course_offerings.csv"

DRY_RUN = "--dry-run" in sys.argv

BIZ_DEPTS = frozenset({
    "ACCO", "AIM", "BUAD", "BUAN", "BULA", "ECON", "ENTP", "FINA",
    "HURE", "INBU", "INSY", "LEAD", "MANA", "MARK", "OSCM", "REAL",
})

# ── Parsing ───────────────────────────────────────────────────────────────────

def get_section(text: str, label: str, next_labels: list) -> str:
    """
    Extract the content of a labeled catalog section.
    Stops at the next section header or end-of-string.
    Uses negative lookbehind (?<![A-Za-z]) to avoid matching
    mid-word colons (e.g. 'Curriculum:' inside note text).
    """
    esc = re.escape(label)
    if next_labels:
        next_pat = "|".join(re.escape(n) + ":" for n in next_labels)
        m = re.search(
            rf"(?<![A-Za-z]){esc}:\s*(.*?)(?=\s*(?:{next_pat})|\Z)",
            text, re.DOTALL,
        )
    else:
        m = re.search(rf"(?<![A-Za-z]){esc}:\s*(.*)", text, re.DOTALL)
    return m.group(1).strip() if m else ""


def parse_entry(block: str) -> dict | None:
    """Parse one soft-wrapped catalog block into a component dict."""
    text = " ".join(block.split())
    if not text:
        return None

    # Course code and title. Title may itself contain a colon
    # (e.g. "BUAD 1060: Business Applications: Basic Business Analytic Tools"),
    # so match up to the first occurrence of " Description:".
    header = re.match(
        r"^([A-Z]{2,7}I?\s+\d{4}H?)\s*:\s*(.*?)(?=\s+Description:)",
        text,
    )
    if not header:
        # Entry has no Description: section — extract what we can
        simple = re.match(r"^([A-Z]{2,7}I?\s+\d{4}H?)\s*:\s*(.*)", text)
        if not simple:
            return None
        return {
            "code": simple.group(1).strip(), "title": simple.group(2).strip(),
            "description": "", "prereq_raw": "", "coreq_raw": "",
            "notes_raw": "", "terms_raw": "",
        }

    code  = header.group(1).strip()
    title = header.group(2).strip()

    return {
        "code":        code,
        "title":       title,
        "description": get_section(text, "Description",
                                   ["Prereq", "Coreq", "Note", "Last four terms offered"]),
        "prereq_raw":  get_section(text, "Prereq",
                                   ["Coreq", "Note", "Last four terms offered"]),
        "coreq_raw":   get_section(text, "Coreq",
                                   ["Note", "Last four terms offered"]),
        "notes_raw":   get_section(text, "Note",
                                   ["Last four terms offered"]),
        "terms_raw":   get_section(text, "Last four terms offered", []),
    }


def parse_all_entries(text: str) -> list:
    blocks  = re.split(r"\n\s*\n", text.strip())
    entries = []
    seen    = set()
    for block in blocks:
        e = parse_entry(block)
        if e and e["code"] and e["code"] not in seen:
            entries.append(e)
            seen.add(e["code"])
    return entries


# ── Field derivation — courses.csv ────────────────────────────────────────────

def dept_of(code: str) -> str:
    """Return normalized dept prefix, stripping trailing I for int'l variants."""
    m = re.match(r"^([A-Z]+)", code)
    return m.group(1).rstrip("I") if m else ""


def derive_credits(entry: dict) -> int:
    title = entry["title"]
    full  = f"{title} {entry['description']} {entry['notes_raw']}"

    # S/U or explicit "Internship Work Period" title → 0 credits
    if re.search(r"\bS/U\b", full) or "Internship Work Period" in title:
        return 0

    # Variable credit range → minimum value  e.g. "1-3 cr." → 1
    var = re.search(r"(\d+)\s*[-\u2013]\s*(\d+)\s*(?:cr\.|credit hours?|credits?)",
                    full, re.IGNORECASE)
    if var:
        return int(var.group(1))

    # Explicit credit count
    explicit = re.search(r"(\d+)\s*(?:cr\.|credit hours?|credits?)", full, re.IGNORECASE)
    if explicit:
        n = int(explicit.group(1))
        if 1 <= n <= 6:
            return n

    return 3  # default


def derive_level(code: str) -> int:
    m = re.search(r"(\d{4})", code)
    return int(m.group(1)[0]) * 1000 if m else 1000


def derive_elective_pool_tag(code: str) -> str:
    return "biz_elective" if dept_of(code) in BIZ_DEPTS else ""


def derive_notes_courses(entry: dict) -> str:
    """Assemble the courses.csv notes field."""
    title      = entry["title"]
    desc       = entry["description"]
    notes_raw  = entry["notes_raw"]
    full       = f"{title} {desc} {notes_raw}"
    parts: list = []

    # S/U
    if re.search(r"\bS/U\b", full) or "Internship Work Period" in title:
        parts.append("S/U grade assessment.")

    # Variable credits
    var = re.search(r"(\d+)\s*[-\u2013]\s*(\d+)\s*(?:cr\.|credit hours?|credits?)",
                    f"{desc} {notes_raw}", re.IGNORECASE)
    if var:
        parts.append(f"Catalog credits range: {var.group(1)}-{var.group(2)}.")

    # MCC tag
    mcc = re.search(
        r"Marquette Core Curriculum:\s*([^.]+?)(?=\s*(?:Last four terms|\Z))",
        notes_raw,
    )
    if mcc:
        parts.append(f"Marquette Core Curriculum: {mcc.group(1).strip()}")

    # Enrollment restrictions from notes_raw
    for pat in [
        r"(REAP students only)",
        r"(Not available to students enrolled in[^.]+)",
        r"(Restricted to [^.;]+)",
        r"(Declared [A-Z]+ (?:major|minor) required)",
        r"(Not available to CBA[^.]*)",
    ]:
        m = re.search(pat, notes_raw, re.IGNORECASE)
        if m:
            clause = m.group(1).strip().rstrip(".")
            if clause:
                parts.append(clause + ".")
            break

    return "; ".join(p for p in parts if p)


# ── Field derivation — course_prereqs.csv ─────────────────────────────────────

COURSE_CODE_RE = re.compile(r"[A-Z]{2,7}I?\s+\d{4}H?")


def extract_codes(text: str) -> list:
    return COURSE_CODE_RE.findall(text)


def has_or_between_codes(text: str) -> bool:
    """True only when 'or' explicitly appears between two course code patterns."""
    return bool(re.search(
        r"[A-Z]{2,7}I?\s+\d{4}H?\s+or\s+[A-Z]{2,7}I?\s+\d{4}H?",
        text, re.IGNORECASE,
    ))


def derive_prereqs(entry: dict) -> dict:
    prereq_raw = entry["prereq_raw"]
    coreq_raw  = entry["coreq_raw"]
    notes_raw  = entry["notes_raw"]
    code       = entry["code"]

    codes       = extract_codes(prereq_raw)
    coreq_codes = extract_codes(coreq_raw)
    or_chain    = has_or_between_codes(prereq_raw)
    has_or      = bool(re.search(r"\bor\b", prereq_raw, re.IGNORECASE))
    enroll_text = (prereq_raw + " " + notes_raw).lower()

    # ── warnings ──────────────────────────────────────────────────────────────
    warnings: list = []

    if re.search(r"may be taken concurrently", prereq_raw, re.IGNORECASE) or coreq_raw:
        warnings.append("may_be_concurrent")

    # Major/enrollment restriction
    major_restricted = (
        re.search(r"\b(?:restricted to|college of business|enrolled in|not available)\b",
                  enroll_text)
        or re.search(r"[A-Z]{2,8} major\b", prereq_raw)   # e.g. "ACCO major"
        or re.search(r"\bdeclared\b", enroll_text)
    )
    if major_restricted:
        warnings.append("major_restriction")

    # Standing requirement  (e.g. "Sr. stndg.", "junior standing")
    standing_text = prereq_raw.lower()
    if (re.search(r"\b(?:sr\.?|senior)\b", standing_text)
            and re.search(r"\b(?:standing|stndg\.?)\b", standing_text)):
        warnings.append("standing_requirement")
    elif (re.search(r"\b(?:jr\.?|junior)\b", standing_text)
            and re.search(r"\b(?:standing|stndg\.?)\b", standing_text)):
        warnings.append("standing_requirement")
    elif re.search(r"\bsophomore\s+standing\b", standing_text):
        warnings.append("standing_requirement")

    # Instructor / department consent
    if re.search(
        r"\b(?:cons\.?|consent|instructor|faculty|dept\.?\s*ch\.?|prog\.?\s*dir\.?)\b",
        prereq_raw, re.IGNORECASE,
    ):
        warnings.append("instructor_consent")

    # Admitted to / accepted into program
    if re.search(r"\b(?:admitt?(?:ed|ance)|accepted into|acceptance)\b",
                 enroll_text, re.IGNORECASE):
        warnings.append("admitted_program")

    # OR chain / complex branching
    if or_chain or (codes and has_or):
        if "hard_prereq_complex" not in warnings:
            warnings.append("hard_prereq_complex")

    # Placement test
    if re.search(r"\bplacement\b", prereq_raw, re.IGNORECASE):
        warnings.append("placement_required")

    # ── prerequisites field ───────────────────────────────────────────────────
    if not codes:
        prerequisites = "none"
    elif or_chain:
        prerequisites = " or ".join(codes)
    elif has_or and len(codes) > 1:
        prerequisites = " or ".join(codes)
    else:
        prerequisites = ";".join(codes)

    # ── concurrent_with ───────────────────────────────────────────────────────
    concurrent_with = ""
    if "may_be_concurrent" in warnings:
        # Find code immediately before "may be taken concurrently"
        m = re.search(
            r"([A-Z]{2,7}I?\s+\d{4}H?)[^.]*?may be taken concurrently",
            prereq_raw, re.IGNORECASE,
        )
        concurrent_with = m.group(1).strip() if m else (codes[-1] if codes else "")
    if coreq_codes:
        concurrent_with = coreq_codes[0]

    # ── min_standing ──────────────────────────────────────────────────────────
    text_lower = (prereq_raw + " " + notes_raw).lower()
    if (re.search(r"\b(?:sr\.?|senior)\b", text_lower)
            and re.search(r"\b(?:standing|stndg)\b", text_lower)):
        min_standing = 4.0
    elif (re.search(r"\b(?:jr\.?|junior)\b", text_lower)
            and re.search(r"\b(?:standing|stndg)\b", text_lower)):
        min_standing = 3.0
    elif re.search(r"\bsophomore\s+standing\b", text_lower):
        min_standing = 2.0
    elif codes:
        levels = [
            int(re.search(r"\d{4}", c).group()[0]) * 1000
            for c in codes if re.search(r"\d{4}", c)
        ]
        min_standing = float(max(levels) // 1000) if levels else 0.0
    elif "standing_requirement" in warnings:
        # Standing required but no explicit level → infer from course level
        course_level = derive_level(code)
        min_standing = float(max(0, course_level // 1000 - 1))
    else:
        min_standing = 0.0

    # ── prereq notes ──────────────────────────────────────────────────────────
    prereq_notes = ""
    if "hard_prereq_complex" in warnings and codes:
        prereq_notes = f"TODO: complex prereq; extracted codes={', '.join(codes)}"

    return {
        "prerequisites":   prerequisites,
        "prereq_warnings": ",".join(warnings),
        "concurrent_with": concurrent_with,
        "min_standing":    min_standing,
        "notes":           prereq_notes,
        "warning_text":    "",  # never auto-generated; preserve existing value
    }


# ── Field derivation — course_offerings.csv ───────────────────────────────────

def derive_offerings(entry: dict) -> dict:
    terms = entry.get("terms_raw", "")
    return {
        "Spring 2025": str("2025 Spring Term" in terms),
        "Summer 2025": str("2025 Summer Term" in terms),
        "Fall 2025":   str("2025 Fall Term"   in terms),
    }


# ── CSV utilities ─────────────────────────────────────────────────────────────

def read_csv(path: Path) -> tuple:
    # utf-8-sig strips the BOM if present
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows   = list(reader)
        fields = list(reader.fieldnames or [])
    return rows, fields


def write_csv(path: Path, rows: list, fieldnames: list) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames,
                                extrasaction="ignore", restval="")
        writer.writeheader()
        writer.writerows(rows)


def merge_row(existing: dict, new_vals: dict) -> tuple:
    changed: list = []
    merged = dict(existing)
    for key, new_val in new_vals.items():
        old = str(existing.get(key, "")).strip()
        new = str(new_val).strip()
        if old != new:
            merged[key] = new
            changed.append(key)
    return merged, changed


def rebuild(idx: dict, orig_codes: list) -> list:
    """Preserve original row order, then append new codes at end."""
    seen = set(orig_codes)
    rows = [idx[c] for c in orig_codes if c in idx]
    for c in idx:
        if c not in seen:
            rows.append(idx[c])
    return rows


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"[inject_stage1] Reading {TXT_PATH.name} ...")
    text    = TXT_PATH.read_text(encoding="utf-8")
    entries = parse_all_entries(text)
    print(f"[inject_stage1] Parsed {len(entries)} entries.")

    course_rows, course_fields = read_csv(COURSES_CSV)
    prereq_rows, prereq_fields = read_csv(PREREQS_CSV)
    offer_rows,  offer_fields  = read_csv(OFFERINGS_CSV)

    course_idx = {r["course_code"].strip(): r for r in course_rows}
    prereq_idx = {r["course_code"].strip(): r for r in prereq_rows}
    offer_idx  = {r["course_code"].strip(): r for r in offer_rows}

    orig_course_codes = [r["course_code"].strip() for r in course_rows]
    orig_prereq_codes = [r["course_code"].strip() for r in prereq_rows]
    orig_offer_codes  = [r["course_code"].strip() for r in offer_rows]

    c_new = c_upd = p_new = p_upd = o_new = o_upd = 0

    for entry in entries:
        code = entry["code"]

        # ── courses.csv ───────────────────────────────────────────────────────
        new_course = {
            "course_code":       code,
            "course_name":       entry["title"],
            "credits":           str(derive_credits(entry)),
            "level":             str(derive_level(code)),
            "active":            "True",
            "notes":             derive_notes_courses(entry),
            "elective_pool_tag": derive_elective_pool_tag(code),
            "description":       "",
        }
        if code in course_idx:
            merged, changed = merge_row(course_idx[code], new_course)
            course_idx[code] = merged
            if changed:
                c_upd += 1
        else:
            course_idx[code] = new_course
            c_new += 1

        # ── course_prereqs.csv ────────────────────────────────────────────────
        new_prereq = {"course_code": code, **derive_prereqs(entry)}
        if code in prereq_idx:
            existing = prereq_idx[code]
            # Preserve hand-curated notes if our auto-output is just a TODO
            if (existing.get("notes", "").strip()
                    and new_prereq.get("notes", "").startswith("TODO:")):
                new_prereq["notes"] = existing["notes"]
            # Always preserve hand-curated warning_text
            if existing.get("warning_text", "").strip():
                new_prereq["warning_text"] = existing["warning_text"]
            merged, changed = merge_row(existing, new_prereq)
            prereq_idx[code] = merged
            if changed:
                p_upd += 1
        else:
            prereq_idx[code] = new_prereq
            p_new += 1

        # ── course_offerings.csv ──────────────────────────────────────────────
        new_offer = {"course_code": code, **derive_offerings(entry)}
        if code in offer_idx:
            merged, changed = merge_row(offer_idx[code], new_offer)
            offer_idx[code] = merged
            if changed:
                o_upd += 1
        else:
            offer_idx[code] = new_offer
            o_new += 1

    # Reconstruct ordered row lists
    new_course_rows = rebuild(course_idx, orig_course_codes)
    new_prereq_rows = rebuild(prereq_idx, orig_prereq_codes)
    new_offer_rows  = rebuild(offer_idx,  orig_offer_codes)

    if DRY_RUN:
        print("\n[DRY RUN — no files written]")
    else:
        write_csv(COURSES_CSV,   new_course_rows, course_fields)
        write_csv(PREREQS_CSV,   new_prereq_rows, prereq_fields)
        write_csv(OFFERINGS_CSV, new_offer_rows,  offer_fields)

    label = "(dry run)" if DRY_RUN else "Complete"
    print(f"\n=== Stage 1 Injection {label} ===")
    print(f"courses.csv:          {c_new:3d} new, {c_upd:3d} updated")
    print(f"course_prereqs.csv:   {p_new:3d} new, {p_upd:3d} updated")
    print(f"course_offerings.csv: {o_new:3d} new, {o_upd:3d} updated")


if __name__ == "__main__":
    main()
