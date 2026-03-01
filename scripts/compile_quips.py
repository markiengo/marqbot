"""
Compile data/quips.csv into frontend/src/lib/quipBank.generated.ts.

Usage:
    python scripts/compile_quips.py

Reads the CSV, validates every row, and writes a typed TypeScript constant.
Exits with code 1 if any validation errors are found (all errors printed).
"""

import csv
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = REPO_ROOT / "data" / "quips.csv"
OUT_PATH = REPO_ROOT / "frontend" / "src" / "lib" / "quipBank.generated.ts"

# ── Known IDs ────────────────────────────────────────────────────────────────

DIMENSION_SLOTS: dict[str, set[str]] = {
    "standing":      {"freshman", "sophomore", "junior", "senior"},
    "progress":      {"early", "building", "midway", "homestretch", "nearDone", "done"},
    "remaining":     {"mountain", "chunk", "manageable", "handful", "zero"},
    "inProgress":    {"none", "light", "moderate", "heavy"},
    "bucketHealth":  {"allSatisfied", "mostDone", "halfDone", "earlyDays"},
    "season":        {"fall", "spring", "summer"},
    "semesterIndex": {"first", "middle", "deep"},
    "recCount":      {"empty", "light", "normal", "heavy"},
    "multiBucket":   {"none", "some", "many"},
    "hasWarnings":   {"clean", "warned"},
}

COMPOUND_IDS = {
    "easter_egg_complete",
    "easter_egg_full_plan",
    "freshman_mountain",
    "senior_homestretch",
    "senior_done",
    "almost_clean",
    "summer_grind",
    "summer_empty",
    "sophomore_building",
    "junior_midway",
    "first_semester_heavy",
    "heavy_warned",
    "deep_planning",
    "multibucket_stacking",
}

VALID_TARGETS = {"progress", "semester", "both"}
MAX_TEXT_LEN = 120

# ── Validation ───────────────────────────────────────────────────────────────

def validate(rows: list[dict[str, str]]) -> list[str]:
    """Return a list of error strings.  Empty means all good."""
    errors: list[str] = []
    seen_texts: dict[str, int] = {}

    for i, row in enumerate(rows, start=2):  # line 1 is header
        pt = row.get("pool_type", "").strip()
        pid = row.get("pool_id", "").strip()
        slot = row.get("slot", "").strip()
        target = row.get("target", "").strip()
        weight_s = row.get("weight", "").strip()
        text = row.get("text", "").strip()

        # pool_type
        if pt not in ("dimension", "compound"):
            errors.append(f"Line {i}: invalid pool_type \"{pt}\"")
            continue  # can't validate further without valid type

        # pool_id
        if pt == "dimension":
            if pid not in DIMENSION_SLOTS:
                errors.append(f"Line {i}: unknown pool_id \"{pid}\"")
            elif not slot:
                errors.append(f"Line {i}: dimension row missing slot")
            elif slot not in DIMENSION_SLOTS[pid]:
                errors.append(f"Line {i}: unknown slot \"{slot}\" for dimension \"{pid}\"")
        else:
            if pid not in COMPOUND_IDS:
                errors.append(f"Line {i}: unknown pool_id \"{pid}\"")
            if slot:
                errors.append(f"Line {i}: compound row should not have slot")

        # target
        if target not in VALID_TARGETS:
            errors.append(f"Line {i}: invalid target \"{target}\"")

        # weight
        try:
            w = float(weight_s) if weight_s else 1.0
            if w <= 0:
                errors.append(f"Line {i}: invalid weight \"{weight_s}\"")
        except ValueError:
            errors.append(f"Line {i}: invalid weight \"{weight_s}\"")

        # text
        if not text:
            errors.append(f"Line {i}: empty text")
        elif len(text) > MAX_TEXT_LEN:
            errors.append(f"Line {i}: text exceeds {MAX_TEXT_LEN} chars (len={len(text)})")

        # duplicates
        if text:
            if text in seen_texts:
                errors.append(f"Line {i}: duplicate text (first seen line {seen_texts[text]})")
            else:
                seen_texts[text] = i

    return errors

# ── Code generation ──────────────────────────────────────────────────────────

def escape_ts(s: str) -> str:
    """Escape a string for use in a TypeScript string literal (double-quoted)."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def generate_ts(rows: list[dict[str, str]]) -> str:
    """Produce the TypeScript source for quipBank.generated.ts."""
    # Organize into structures
    dims: dict[str, dict[str, list[dict]]] = {}
    comps: dict[str, list[dict]] = {}

    for row in rows:
        pt = row["pool_type"].strip()
        pid = row["pool_id"].strip()
        slot = row.get("slot", "").strip()
        target = row["target"].strip()
        weight_s = row.get("weight", "").strip()
        text = row["text"].strip()
        weight = float(weight_s) if weight_s else 1.0

        entry = {"text": text, "target": target, "weight": weight}

        if pt == "dimension":
            dims.setdefault(pid, {}).setdefault(slot, []).append(entry)
        else:
            comps.setdefault(pid, []).append(entry)

    lines: list[str] = [
        "// AUTO-GENERATED by scripts/compile_quips.py from data/quips.csv",
        "// Do not edit manually. Re-run: python scripts/compile_quips.py",
        "",
        "export type QuipTarget = \"progress\" | \"semester\" | \"both\";",
        "",
        "export interface QuipEntry {",
        "  text: string;",
        "  target: QuipTarget;",
        "  weight: number;",
        "}",
        "",
        "export interface QuipBank {",
        "  dimensions: Record<string, Record<string, QuipEntry[]>>;",
        "  compounds: Record<string, QuipEntry[]>;",
        "}",
        "",
        "export const QUIP_BANK: QuipBank = {",
    ]

    # dimensions
    lines.append("  dimensions: {")
    for dim_id in sorted(dims.keys()):
        lines.append(f"    {dim_id}: {{")
        for slot_id in sorted(dims[dim_id].keys()):
            lines.append(f"      {slot_id}: [")
            for e in dims[dim_id][slot_id]:
                lines.append(
                    f'        {{ text: "{escape_ts(e["text"])}", '
                    f'target: "{e["target"]}", weight: {e["weight"]} }},'
                )
            lines.append("      ],")
        lines.append("    },")
    lines.append("  },")

    # compounds
    lines.append("  compounds: {")
    for comp_id in sorted(comps.keys()):
        lines.append(f"    {comp_id}: [")
        for e in comps[comp_id]:
            lines.append(
                f'      {{ text: "{escape_ts(e["text"])}", '
                f'target: "{e["target"]}", weight: {e["weight"]} }},'
            )
        lines.append("    ],")
    lines.append("  },")

    lines.append("};")
    lines.append("")
    return "\n".join(lines)

# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    if not CSV_PATH.exists():
        print(f"[FATAL] CSV not found: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("[FATAL] CSV is empty", file=sys.stderr)
        sys.exit(1)

    errors = validate(rows)
    if errors:
        print(f"[FAIL] {len(errors)} validation error(s):", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        sys.exit(1)

    ts_source = generate_ts(rows)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(ts_source, encoding="utf-8")
    print(f"[OK] Generated {OUT_PATH} ({len(rows)} quips)")


if __name__ == "__main__":
    main()
