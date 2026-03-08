"""
One-time discovery script: scan data/ CSVs for candidate equivalency groups.

Outputs CSV-formatted rows to stdout for review before adding to
data/course_equivalencies.csv.

Usage:
    python scripts/discover_equivalencies.py
"""

import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_csv(filename):
    path = DATA_DIR / filename
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _parse_code(code):
    """Split 'DEPT NNNN' into (dept, number_str) or None."""
    m = re.match(r"^([A-Z]{2,5})\s+(\d{3,5}[A-Z]?)$", code.strip())
    if m:
        return m.group(1), m.group(2)
    return None


# ── Pass 1: Honors variants ──────────────────────────────────────────────

def find_honors_pairs(courses, mapped_codes):
    """Find DEPT NNNN / DEPT NNNNH pairs where at least one is bucket-mapped."""
    codes = {r["course_code"].strip() for r in courses}
    pairs = []
    for code in sorted(codes):
        parsed = _parse_code(code)
        if not parsed:
            continue
        dept, num = parsed
        if num.endswith("H"):
            continue  # we'll find the base and look for the H variant
        h_code = f"{dept} {num}H"
        if h_code in codes:
            if code in mapped_codes or h_code in mapped_codes:
                pairs.append((code, h_code))
    return pairs


# ── Pass 2: Undergrad/grad level pairs ───────────────────────────────────

def find_level_pairs(courses, mapped_codes):
    """Find courses with same dept, same last 3 digits, different level, matching title.

    Only includes groups where at least one member is in mapped_codes
    (appears in master_bucket_courses.csv).
    """
    by_key = defaultdict(list)
    for r in courses:
        code = r["course_code"].strip()
        name = r.get("course_name", "").strip().lower()
        parsed = _parse_code(code)
        if not parsed or not name:
            continue
        dept, num_str = parsed
        # strip trailing letters for base comparison
        num_clean = re.sub(r"[A-Z]+$", "", num_str)
        if len(num_clean) < 4:
            continue
        last3 = num_clean[-3:]
        level = num_clean[:-3]
        by_key[(dept, last3, name)].append((code, int(level) if level.isdigit() else 0))

    groups = []
    for (dept, last3, name), members in sorted(by_key.items()):
        if len(members) < 2:
            continue
        levels = {lvl for _, lvl in members}
        if len(levels) < 2:
            continue
        codes = sorted([c for c, _ in members])
        # only keep if at least one member is mapped to a bucket
        if not any(c in mapped_codes for c in codes):
            continue
        groups.append(codes)
    return groups


# ── Pass 3: Cross-listed pairs ───────────────────────────────────────────

_XLIST_PAT = re.compile(
    r"(?:cross[- ]?listed\s+(?:with|as)|same\s+(?:course\s+)?as)\s+"
    r"([A-Z]{2,5}\s+\d{3,5}[A-Z]?)",
    re.IGNORECASE,
)


def find_cross_listed(courses, soft_prereqs):
    """Find cross-listed pairs from description and catalog_prereq_raw."""
    pairs = set()
    catalog_codes = {r["course_code"].strip() for r in courses}

    for r in courses:
        code = r["course_code"].strip()
        desc = r.get("description", "") or ""
        for m in _XLIST_PAT.finditer(desc):
            ref = m.group(1).strip().upper()
            if ref != code and ref in catalog_codes:
                pair = tuple(sorted([code, ref]))
                pairs.add(pair)

    for r in soft_prereqs:
        code = r["course_code"].strip()
        raw = r.get("catalog_prereq_raw", "") or ""
        other = r.get("soft_prereq_other_requirements", "") or ""
        notes = r.get("notes", "") or ""
        for text in [raw, other, notes]:
            for m in _XLIST_PAT.finditer(text):
                ref = m.group(1).strip().upper()
                if ref != code and ref in catalog_codes:
                    pair = tuple(sorted([code, ref]))
                    pairs.add(pair)

    return sorted(pairs)


# ── Pass 4: No-double-count pairs ────────────────────────────────────────

_NDC_PAT = re.compile(
    r"(?:may\s+not\s+be\s+taken\s+for\s+credit|"
    r"not\s+to\s+be\s+taken\s+for\s+credit|"
    r"credit\s+not\s+awarded|"
    r"cannot\s+be\s+taken\s+for\s+credit|"
    r"not\s+open\s+to\s+students\s+who\s+have\s+(?:completed|earned\s+credit\s+for))"
    r".*?([A-Z]{2,5}\s+\d{3,5}[A-Z]?)",
    re.IGNORECASE,
)

_NDC_MULTI_PAT = re.compile(r"([A-Z]{2,5}\s+\d{3,5}[A-Z]?)", re.IGNORECASE)


def _extract_ndc_refs(text):
    """Extract course codes referenced in no-double-count language."""
    refs = []
    # first check if the text contains NDC trigger language
    trigger = re.search(
        r"(?:may\s+not\s+be\s+taken\s+for\s+credit|"
        r"not\s+to\s+be\s+taken\s+for\s+credit|"
        r"credit\s+not\s+awarded|"
        r"cannot\s+be\s+taken\s+for\s+credit|"
        r"not\s+open\s+to\s+students\s+who\s+have\s+(?:completed|earned\s+credit\s+for))",
        text,
        re.IGNORECASE,
    )
    if not trigger:
        return refs
    # extract all course codes after the trigger
    after = text[trigger.start():]
    for m in _NDC_MULTI_PAT.finditer(after):
        refs.append(m.group(1).strip().upper())
    return refs


def find_no_double_count(courses, soft_prereqs):
    """Find no-double-count pairs from description and catalog_prereq_raw."""
    pairs = set()
    catalog_codes = {r["course_code"].strip() for r in courses}

    for r in courses:
        code = r["course_code"].strip()
        desc = r.get("description", "") or ""
        for ref in _extract_ndc_refs(desc):
            if ref != code and ref in catalog_codes:
                pair = tuple(sorted([code, ref]))
                pairs.add(pair)

    for r in soft_prereqs:
        code = r["course_code"].strip()
        raw = r.get("catalog_prereq_raw", "") or ""
        other = r.get("soft_prereq_other_requirements", "") or ""
        notes = r.get("notes", "") or ""
        for text in [raw, other, notes]:
            for ref in _extract_ndc_refs(text):
                if ref != code and ref in catalog_codes:
                    pair = tuple(sorted([code, ref]))
                    pairs.add(pair)

    return sorted(pairs)


# ── Output ────────────────────────────────────────────────────────────────

def main():
    courses = _load_csv("courses.csv")
    soft_prereqs = _load_csv("course_soft_prereqs.csv")
    mbc = _load_csv("master_bucket_courses.csv")
    mapped_codes = {r["course_code"].strip() for r in mbc if r.get("course_code", "").strip()}

    writer = csv.writer(sys.stdout)
    writer.writerow(["id", "course_1", "course_2", "course_3", "type", "parent_bucket", "child_bucket", "notes"])

    row_id = 0
    counts = {"equivalent": 0, "cross_listed": 0, "no_double_count": 0}

    def _write_group(codes, rtype, notes, parent_bucket=""):
        nonlocal row_id
        row_id += 1
        c1 = codes[0] if len(codes) > 0 else ""
        c2 = codes[1] if len(codes) > 1 else ""
        c3 = codes[2] if len(codes) > 2 else ""
        writer.writerow([row_id, c1, c2, c3, rtype, parent_bucket, "", notes])

    # Pass 1: Honors (filtered to bucket-mapped courses)
    print("# ── Pass 1: Honors variants (bucket-mapped only) ──", file=sys.stderr)
    honors = find_honors_pairs(courses, mapped_codes)
    for base, h_variant in honors:
        _write_group([base, h_variant], "equivalent", "honors variant")
        counts["equivalent"] += 1
    print(f"  Found {len(honors)} honors pairs", file=sys.stderr)

    # Pass 2: Level pairs (filtered to bucket-mapped courses)
    print("# ── Pass 2: Undergrad/grad level pairs (bucket-mapped only) ──", file=sys.stderr)
    level_groups = find_level_pairs(courses, mapped_codes)
    for group in level_groups:
        _write_group(group, "equivalent", "same title, different level")
        counts["equivalent"] += 1
    print(f"  Found {len(level_groups)} level-pair groups", file=sys.stderr)

    # Pass 3: Cross-listed
    print("# ── Pass 3: Cross-listed pairs ──", file=sys.stderr)
    xlist = find_cross_listed(courses, soft_prereqs)
    for a, b in xlist:
        _write_group([a, b], "cross_listed", "cross-listed")
        counts["cross_listed"] += 1
    print(f"  Found {len(xlist)} cross-listed pairs", file=sys.stderr)

    # Pass 4: No-double-count
    print("# ── Pass 4: No-double-count pairs ──", file=sys.stderr)
    ndc = find_no_double_count(courses, soft_prereqs)
    for a, b in ndc:
        _write_group([a, b], "no_double_count", "credit restriction")
        counts["no_double_count"] += 1
    print(f"  Found {len(ndc)} no-double-count pairs", file=sys.stderr)

    # Summary
    print(f"\n# ── Summary ──", file=sys.stderr)
    for rtype, count in counts.items():
        print(f"  {rtype}: {count} groups", file=sys.stderr)
    print(f"  Total: {sum(counts.values())} groups", file=sys.stderr)


if __name__ == "__main__":
    main()
