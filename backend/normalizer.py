import re

# Matches: DEPT NNNN, DEPT-NNNN, DEPTNNN, FINAI 4931, AIM 4400, etc.
CANONICAL = re.compile(r'^([A-Za-z]{2,6})\s*[-]?\s*(\d{4}[A-Za-z]?)$')


def normalize_code(raw: str) -> str | None:
    """
    Normalizes a course code to canonical 'DEPT NNNN' format.
    Handles: 'fina3001', 'FINA-3001', 'FINA 3001', 'FINAI 4931', 'AIM 4440'
    Returns None if the string cannot be parsed as a course code.
    """
    if not raw or not raw.strip():
        return None
    m = CANONICAL.match(raw.strip())
    if m:
        dept = m.group(1).upper()
        num = m.group(2)
        return f"{dept} {num}"
    return None


def normalize_input(raw_str: str, catalog_codes: set) -> dict:
    """
    Splits comma/newline/semicolon-separated input and normalizes each code.

    Returns:
      {
        "valid":         ["FINA 3001", "ECON 1103"],   # normalized + found in catalog
        "invalid":       ["asdfasdf"],                  # failed regex
        "not_in_catalog": ["FINA 9999"]                # valid format but unknown course
      }
    """
    if not raw_str or not raw_str.strip():
        return {"valid": [], "invalid": [], "not_in_catalog": []}

    tokens = re.split(r'[,\n;]+', raw_str)
    valid = []
    invalid = []
    not_in_catalog = []
    seen: set[str] = set()

    for token in tokens:
        token = token.strip()
        if not token:
            continue
        normalized = normalize_code(token)
        if normalized is None:
            if token not in seen:
                invalid.append(token)
                seen.add(token)
        elif normalized in seen:
            pass  # deduplicate silently
        elif normalized not in catalog_codes:
            not_in_catalog.append(normalized)
            seen.add(normalized)
        else:
            valid.append(normalized)
            seen.add(normalized)

    return {"valid": valid, "invalid": invalid, "not_in_catalog": not_in_catalog}
