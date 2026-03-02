import re
import pandas as pd
from normalizer import normalize_code

# Case-insensitive OR splitter — preserves token casing before normalize_code()
OR_SPLIT = re.compile(r'\s+or\s+', re.IGNORECASE)
CHOOSE_N_FROM_RE = re.compile(
    r'^(?:any\s+)?(?P<count>\d+|one|two|three|four|five)\s+courses?\s+from\s*:?\s*(?P<options>.+)$',
    re.IGNORECASE,
)
CHOOSE_N_SHORT_RE = re.compile(
    r'^choose\s+(?P<count>\d+|one|two|three|four|five)\s+from\s*:?\s*(?P<options>.+)$',
    re.IGNORECASE,
)

# Regex to strip parenthetical annotation clauses, e.g. "(may be concurrent)"
ANNOTATION_RE = re.compile(r'\s*\([^)]*\)')

# Signals that the prereq_hard string contains unsupported grammar.
# Note: "(" and ")" are NOT in this list — parenthetical annotations are
# handled by _strip_annotations() before this list is checked.
UNSUPPORTED_SIGNALS = [
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
COUNT_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
}


def _parse_count_token(token: str) -> int | None:
    raw = str(token or "").strip().lower()
    if raw.isdigit():
        return int(raw)
    return COUNT_WORDS.get(raw)


def _parse_choose_n_from(s: str) -> dict | None:
    for pattern in (CHOOSE_N_FROM_RE, CHOOSE_N_SHORT_RE):
        match = pattern.match(s)
        if not match:
            continue
        count = _parse_count_token(match.group("count"))
        options_raw = str(match.group("options") or "").strip().rstrip(".")
        tokens = [normalize_code(c.strip()) or c.strip() for c in OR_SPLIT.split(options_raw)]
        tokens = [t for t in tokens if t]
        if count is None or count <= 0 or len(tokens) < count:
            return {"type": "unsupported", "raw": s}
        if count == 1 and len(tokens) == 1:
            return {"type": "single", "course": tokens[0]}
        return {"type": "choose_n", "count": count, "courses": tokens}
    return None


def prereq_course_codes(parsed_prereq: dict) -> list[str]:
    t = parsed_prereq.get("type")
    if t == "single":
        course = parsed_prereq.get("course")
        return [course] if course else []
    if t in {"and", "or", "choose_n"}:
        result = []
        for c in parsed_prereq.get("courses", []):
            if isinstance(c, dict):
                result.extend(prereq_course_codes(c))
            elif c:
                result.append(c)
        return result
    return []


def _strip_annotations(s: str) -> str:
    """Remove parenthetical annotation clauses, e.g. '(may be concurrent)'."""
    return ANNOTATION_RE.sub('', s).strip()


def parse_prereqs(prereq_str) -> dict:
    """
    Parses the prereq_hard field (machine-parsable grammar only).

    Supported grammar:
      none / none listed       → {"type": "none"}
      CODE                     → {"type": "single", "course": "DEPT NNNN"}
      CODE;CODE;...            → {"type": "and", "courses": [...]}
      CODE or CODE             → {"type": "or", "courses": [...]}
      Two courses from: ...    → {"type": "choose_n", "count": 2, "courses": [...]}

    Parenthetical annotations (e.g. "(may be concurrent)") are stripped before
    parsing, so "FINA 3001 (may be concurrent)" → {"type": "single", "course": "FINA 3001"}.

    Anything else →            {"type": "unsupported", "raw": "<original string>"}

    OR uses case-insensitive regex; each token is normalized via normalize_code()
    so 'FINA-3001' or 'fina3001' in the sheet still maps to canonical 'FINA 3001'.
    """
    if prereq_str is None or (isinstance(prereq_str, float) and pd.isna(prereq_str)):
        return {"type": "none"}

    s = str(prereq_str).strip()

    if s.lower() in NONE_VALUES:
        return {"type": "none"}

    # If parentheses are present, try stripping annotation clauses first.
    # If the stripped string is clean and parseable, use it.
    if "(" in s:
        stripped = _strip_annotations(s)
        if stripped and not any(sig in stripped.lower() for sig in UNSUPPORTED_SIGNALS):
            return parse_prereqs(stripped)
        return {"type": "unsupported", "raw": s}

    s_lower = s.lower()
    for signal in UNSUPPORTED_SIGNALS:
        if signal in s_lower:
            return {"type": "unsupported", "raw": s}

    choose_n = _parse_choose_n_from(s)
    if choose_n is not None:
        return choose_n

    if ";" in s:
        raw_tokens = [c.strip() for c in s.split(";")]
        clauses = []
        for tok in raw_tokens:
            if not tok:
                continue
            if OR_SPLIT.search(tok):
                # Nested OR clause within an AND prereq
                or_parts = [normalize_code(p.strip()) or p.strip() for p in OR_SPLIT.split(tok)]
                or_parts = [p for p in or_parts if p]
                if len(or_parts) == 1:
                    clauses.append(or_parts[0])
                else:
                    clauses.append({"type": "or", "courses": or_parts})
            else:
                clauses.append(normalize_code(tok) or tok)
        if len(clauses) == 1:
            if isinstance(clauses[0], dict):
                return clauses[0]
            return {"type": "single", "course": clauses[0]}
        return {"type": "and", "courses": clauses}

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
        for clause in parsed_prereq["courses"]:
            if isinstance(clause, dict):
                if not prereqs_satisfied(clause, satisfied_codes):
                    return False
            elif clause not in satisfied_codes:
                return False
        return True
    if t == "or":
        return any(c in satisfied_codes for c in parsed_prereq["courses"])
    if t == "choose_n":
        return sum(1 for c in parsed_prereq["courses"] if c in satisfied_codes) >= parsed_prereq["count"]
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
        parts = []
        for clause in parsed_prereq["courses"]:
            if isinstance(clause, dict):
                parts.append(build_prereq_check_string(clause, completed, in_progress))
            else:
                parts.append(label_code(clause))
        return "; ".join(parts)
    if t == "or":
        # Show which one satisfied it
        codes = parsed_prereq["courses"]
        satisfied = [c for c in codes if c in completed or c in in_progress]
        if satisfied:
            return f"{label_code(satisfied[0])} (or {' or '.join(c for c in codes if c != satisfied[0])})"
        return " or ".join(label_code(c) for c in codes)
    if t == "choose_n":
        codes = parsed_prereq["courses"]
        count = parsed_prereq["count"]
        satisfied_count = sum(1 for c in codes if c in completed or c in in_progress)
        return f"{satisfied_count}/{count} required: " + "; ".join(label_code(c) for c in codes)
    return "Manual review required"
