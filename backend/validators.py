"""
Pure input-validation helpers for the /recommend endpoint.
No Flask or data-loader imports.
"""

from typing import Dict, List, Optional, Set


def _get_all_required_prereqs(
    course_code: str,
    prereq_map: Dict[str, dict],
    visited: Optional[Set[str]] = None,
) -> Set[str]:
    """
    Return all transitively required prerequisites for course_code.

    Traverses only required branches:
      - type == "single"
      - type == "and"

    Stops at:
      - type == "none"
      - type == "or"
      - type == "unsupported"
      - unknown course
    """
    if visited is None:
        visited = set()

    if course_code in visited:
        return set()
    visited.add(course_code)

    parsed = prereq_map.get(course_code, {"type": "none"})
    prereq_type = parsed.get("type", "none")

    if prereq_type == "single":
        course = parsed.get("course")
        direct = [course] if isinstance(course, str) and course.strip() else []
    elif prereq_type == "and":
        courses = parsed.get("courses", [])
        direct = [c for c in courses if isinstance(c, str) and c.strip()]
    else:
        return set()

    all_required = set(direct)
    for prereq in direct:
        all_required |= _get_all_required_prereqs(prereq, prereq_map, visited)
    return all_required


def find_inconsistent_completed_courses(
    completed: List[str],
    in_progress: List[str],
    prereq_map: Dict[str, dict],
) -> List[dict]:
    """
    Return detailed inconsistency objects for completed courses that still have
    required prereqs in-progress.

    Each item:
      {"course_code": str, "prereqs_in_progress": List[str]}
    """
    in_progress_set = set(in_progress)
    issues: List[dict] = []

    for course_code in completed:
        required = _get_all_required_prereqs(course_code, prereq_map)
        in_prog = sorted(p for p in required if p in in_progress_set)
        if in_prog:
            issues.append(
                {
                    "course_code": course_code,
                    "prereqs_in_progress": in_prog,
                }
            )
    return issues


def expand_completed_with_prereqs(
    completed: List[str],
    prereq_map: Dict[str, dict],
) -> List[str]:
    """
    Expand completed with transitively required prereqs and return a
    deterministic deduplicated list.
    """
    expanded_set = set(completed)
    for course_code in completed:
        expanded_set |= _get_all_required_prereqs(course_code, prereq_map)

    if not completed:
        return []

    ordered_completed = list(dict.fromkeys(completed))
    inferred_sorted = sorted(expanded_set - set(ordered_completed))
    return ordered_completed + inferred_sorted
