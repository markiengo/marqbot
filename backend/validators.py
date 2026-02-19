"""
Pure input-validation helpers for the /recommend endpoint.
No Flask or data_loader imports — safe to use in tests without side effects.
"""


def _get_all_required_prereqs(course_code: str, prereq_map: dict, visited: set = None) -> set:
    """
    Returns the set of all courses that are *definitively required* before
    course_code can be completed (transitive single/and prereq closure).

    Stops at "or" branches — we can't determine which path was taken, so
    we don't flag either branch to avoid false positives.
    Stops at "none" and "unsupported".
    Cycle-safe via visited set.
    """
    if visited is None:
        visited = set()
    if course_code in visited:
        return set()
    visited.add(course_code)

    parsed = prereq_map.get(course_code, {"type": "none"})
    t = parsed["type"]
    if t == "single":
        direct = [parsed["course"]]
    elif t == "and":
        direct = parsed["courses"]
    else:
        return set()  # "none", "or", "unsupported" — stop

    all_required = set(direct)
    for prereq in direct:
        all_required |= _get_all_required_prereqs(prereq, prereq_map, visited)
    return all_required


def expand_completed_with_prereqs(completed: list, prereq_map: dict) -> list:
    """
    Given a list of completed courses, returns an expanded list that also includes
    all transitively required prereqs (inferred as completed).

    Rationale: if a student completed FINA 3001, its prereq ACCO 1031 must have
    been completed first — even if the student didn't explicitly list it.
    Uses the same single/and transitive closure as the consistency check.
    """
    expanded = set(completed)
    for code in completed:
        expanded |= _get_all_required_prereqs(code, prereq_map)
    return list(expanded)


def find_inconsistent_completed_courses(
    completed: list, in_progress: list, prereq_map: dict
) -> list:
    """
    For each completed course, walks the full transitive prereq chain (single/and only).
    Returns a list of dicts for any completed course whose required prereqs are still
    in in_progress — a logical impossibility (can't complete before the prereq is done).

    Each entry: {"course_code": str, "prereqs_in_progress": [str]}
    """
    in_progress_set = set(in_progress)
    issues = []
    for code in completed:
        required = _get_all_required_prereqs(code, prereq_map)
        in_prog = sorted(p for p in required if p in in_progress_set)
        if in_prog:
            issues.append({"course_code": code, "prereqs_in_progress": in_prog})
    return issues
