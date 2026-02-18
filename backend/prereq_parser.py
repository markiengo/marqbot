import re
import pandas as pd
from normalizer import normalize_code

# Case-insensitive OR splitter — preserves token casing before normalize_code()
OR_SPLIT = re.compile(r'\s+or\s+', re.IGNORECASE)

# Signals that the prereq_hard string contains unsupported grammar
UNSUPPORTED_SIGNALS = [
    "(",
    ")",
    "permission",
    "concurrent",
    "minimum grade",
    "standing",
    "instructor",
    "co-req",
    "coreq",
    "admitted",
    "enrollment",
    "consent",
    "placement",
]

NONE_VALUES = {"none", "none listed", "n/a", ""}


def parse_prereqs(prereq_str) -> dict:
    """
    Parses the prereq_hard field (machine-parsable grammar only).

    Supported grammar:
      none / none listed       → {"type": "none"}
      CODE                     → {"type": "single", "course": "DEPT NNNN"}
      CODE;CODE;...            → {"type": "and", "courses": [...]}
      CODE or CODE             → {"type": "or", "courses": [...]}

    Anything else →            {"type": "unsupported", "raw": "<original string>"}

    OR uses case-insensitive regex; each token is normalized via normalize_code()
    so 'FINA-3001' or 'fina3001' in the sheet still maps to canonical 'FINA 3001'.
    """
    if prereq_str is None or (isinstance(prereq_str, float) and pd.isna(prereq_str)):
        return {"type": "none"}

    s = str(prereq_str).strip()

    if s.lower() in NONE_VALUES:
        return {"type": "none"}

    s_lower = s.lower()
    for signal in UNSUPPORTED_SIGNALS:
        if signal in s_lower:
            return {"type": "unsupported", "raw": s}

    if ";" in s:
        tokens = [normalize_code(c.strip()) or c.strip() for c in s.split(";")]
        tokens = [t for t in tokens if t]
        if len(tokens) == 1:
            return {"type": "single", "course": tokens[0]}
        return {"type": "and", "courses": tokens}

    if OR_SPLIT.search(s):
        tokens = [normalize_code(c.strip()) or c.strip() for c in OR_SPLIT.split(s)]
        tokens = [t for t in tokens if t]
        if len(tokens) == 1:
            return {"type": "single", "course": tokens[0]}
        return {"type": "or", "courses": tokens}

    normalized = normalize_code(s) or s
    return {"type": "single", "course": normalized}


def prereqs_satisfied(parsed_prereq: dict, satisfied_codes: set) -> bool:
    """
    Returns True if the parsed prerequisite is satisfied by the given set of codes.
    satisfied_codes = completed ∪ in_progress (for eligibility checking).
    """
    t = parsed_prereq["type"]
    if t == "none":
        return True
    if t == "single":
        return parsed_prereq["course"] in satisfied_codes
    if t == "and":
        return all(c in satisfied_codes for c in parsed_prereq["courses"])
    if t == "or":
        return any(c in satisfied_codes for c in parsed_prereq["courses"])
    # unsupported → always False (never auto-eligible)
    return False


def build_prereq_check_string(
    parsed_prereq: dict,
    completed: set,
    in_progress: set,
) -> str:
    """
    Returns a human-readable string showing which prereqs are satisfied and how.
    Examples:
      "FINA 3001 ✓"
      "ECON 1103 ✓; BUAD 1560 (in progress) ✓"
      "FINA 4001 or FINA 5001 ✓"
    """
    def label_code(code: str) -> str:
        if code in completed:
            return f"{code} ✓"
        if code in in_progress:
            return f"{code} (in progress) ✓"
        return f"{code} ✗"

    t = parsed_prereq["type"]
    if t == "none":
        return "No prerequisites"
    if t == "single":
        return label_code(parsed_prereq["course"])
    if t == "and":
        return "; ".join(label_code(c) for c in parsed_prereq["courses"])
    if t == "or":
        # Show which one satisfied it
        codes = parsed_prereq["courses"]
        satisfied = [c for c in codes if c in completed or c in in_progress]
        if satisfied:
            return f"{label_code(satisfied[0])} (or {' or '.join(c for c in codes if c != satisfied[0])})"
        return " or ".join(label_code(c) for c in codes)
    return "Manual review required"
