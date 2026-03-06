#!/usr/bin/env python3
"""One-time injection script: parse bucket_injections.md and append discovery
theme course mappings to data/master_bucket_courses.csv.

ESSV2 and WRIT mappings are already present in the CSV. This script only
processes the Discovery Tiers section.

Archive to scripts/archive/ after use.
"""

import csv
import re
import sys
from pathlib import Path

# Archived under scripts/archive/, so repo root is three levels up.
ROOT = Path(__file__).resolve().parents[2]
INJECTIONS_MD = ROOT / "bucket_injections.md"
MASTER_CSV = ROOT / "data" / "master_bucket_courses.csv"
COURSES_CSV = ROOT / "data" / "courses.csv"

THEME_MAP = {
    "Basic Needs and Justice": "MCC_DISC_BNJ",
    "Cognition, Memory and Intelligence": "MCC_DISC_CMI",
    "Crossing Boundaries": "MCC_DISC_CB",
    "Expanding Our Horizons": "MCC_DISC_EOH",
    "Individuals and Communities": "MCC_DISC_IC",
}

AREA_SUFFIX = {
    "HUM": "_HUM",
    "NSM": "_NSM",
    "SSC": "_SSC",
}

COURSE_CODE_RE = re.compile(r"^([A-Z]{2,5}I?)\s+(\d{4}[A-Z]?)$")


def load_valid_courses() -> set[str]:
    codes = set()
    with open(COURSES_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            codes.add(row["course_code"].strip())
    return codes


def load_existing_mappings() -> set[tuple[str, str, str]]:
    existing = set()
    with open(MASTER_CSV, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            existing.add((
                row["parent_bucket_id"].strip(),
                row["child_bucket_id"].strip(),
                row["course_code"].strip(),
            ))
    return existing


def parse_discovery_themes(text: str) -> list[tuple[str, str, str]]:
    """Parse discovery theme sections, returning (parent_id, child_id, course_code) tuples."""
    rows = []
    current_theme = None
    current_area = None

    lines = text.split("\n")
    in_discovery = False

    for line in lines:
        stripped = line.strip()

        # Detect start of Discovery Tiers section
        if stripped.startswith("## Discovery Tiers"):
            in_discovery = True
            continue

        if not in_discovery:
            continue

        # Detect theme headers (## Theme Name or bare theme name)
        candidate = stripped.lstrip("# ").strip()
        # Handle "Crossing Boundaries: The Movement of People, Goods and Ideas"
        if "Crossing Boundaries" in candidate:
            candidate = "Crossing Boundaries"
        if candidate in THEME_MAP:
            current_theme = THEME_MAP[candidate]
            current_area = None
            continue

        # Detect area sub-headers
        if current_theme:
            if stripped.startswith("Humanities (HUM)") or stripped == "Humanities (HUM)\t3":
                current_area = "HUM"
                continue
            if stripped.startswith("Natural Science") and ("NSM" in stripped or "Mathematics" in stripped):
                current_area = "NSM"
                continue
            if stripped.startswith("Social Sciences (SSC)") or stripped == "Social Sciences (SSC)\t3":
                current_area = "SSC"
                continue
            if stripped.startswith("Elective (ELE)"):
                current_area = None  # Stop parsing area courses
                continue
            if stripped.startswith("Total Credit Hours"):
                current_area = None
                continue

        # Parse course codes
        if current_theme and current_area:
            # Handle special codes
            # "MARQ 1005" followed by "& MARQ 3005" on next line
            if stripped.startswith("& "):
                code_part = stripped[2:].strip()
                # Extract just the course code
                m = COURSE_CODE_RE.match(code_part.split("\t")[0].split("(")[0].strip())
                if m:
                    code = f"{m.group(1)} {m.group(2)}"
                    child_area = current_theme + AREA_SUFFIX[current_area]
                    child_elec = current_theme + "_ELEC"
                    rows.append((current_theme, child_area, code))
                    rows.append((current_theme, child_elec, code))
                continue

            # Try matching a course code at start of line
            parts = stripped.split("\t")[0].split("(")[0].strip()

            # Handle "EXPH 4189/7189" -> two codes
            slash_match = re.match(r"^([A-Z]{2,5}I?)\s+(\d{4})/(\d{4})$", parts)
            if slash_match:
                dept = slash_match.group(1)
                for num in [slash_match.group(2), slash_match.group(3)]:
                    code = f"{dept} {num}"
                    child_area = current_theme + AREA_SUFFIX[current_area]
                    child_elec = current_theme + "_ELEC"
                    rows.append((current_theme, child_area, code))
                    rows.append((current_theme, child_elec, code))
                continue

            m = COURSE_CODE_RE.match(parts)
            if m:
                code = f"{m.group(1)} {m.group(2)}"
                child_area = current_theme + AREA_SUFFIX[current_area]
                child_elec = current_theme + "_ELEC"
                rows.append((current_theme, child_area, code))
                rows.append((current_theme, child_elec, code))

    return rows


def main():
    if not INJECTIONS_MD.exists():
        print(f"[FATAL] {INJECTIONS_MD} not found")
        sys.exit(1)

    text = INJECTIONS_MD.read_text(encoding="utf-8")
    valid_courses = load_valid_courses()
    existing = load_existing_mappings()

    discovery_rows = parse_discovery_themes(text)

    # Deduplicate and filter
    new_rows = []
    seen = set()
    missing_courses = set()
    for parent, child, code in discovery_rows:
        key = (parent, child, code)
        if key in seen or key in existing:
            continue
        seen.add(key)
        if code not in valid_courses:
            missing_courses.add(code)
            continue
        new_rows.append(key)

    if missing_courses:
        print(f"[WARN] {len(missing_courses)} courses not in courses.csv (skipped):")
        for c in sorted(missing_courses):
            print(f"  {c}")

    if not new_rows:
        print("[OK] No new rows to append.")
        return

    # Append to CSV
    with open(MASTER_CSV, "a", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        for parent, child, code in new_rows:
            writer.writerow([parent, child, code, ""])

    print(f"[OK] Appended {len(new_rows)} new rows to {MASTER_CSV.name}")

    # Summary by theme
    from collections import Counter
    theme_counts = Counter(r[0] for r in new_rows)
    for theme, count in sorted(theme_counts.items()):
        print(f"  {theme}: {count} rows")


if __name__ == "__main__":
    main()
