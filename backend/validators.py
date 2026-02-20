"""
Pure input-validation helpers for the /recommend endpoint.
No Flask or data-loader imports.
"""

from typing import Dict, List, Optional, Set, Tuple


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
    expanded_completed, _ = expand_completed_with_prereqs_with_provenance(completed, prereq_map)
    return expanded_completed


def expand_completed_with_prereqs_with_provenance(
    completed: List[str],
    prereq_map: Dict[str, dict],
) -> Tuple[List[str], List[dict]]:
    """
    Expand completed with transitively required prereqs and return deterministic
    provenance rows for inferred assumptions.

    Returns:
      (expanded_completed, assumption_rows)

    assumption_rows item shape:
      {
        "source_completed": str,
        "assumed_prereqs": List[str],
        "already_completed_prereqs": List[str],
      }
    """
    ordered_completed = list(dict.fromkeys(completed))
    completed_set = set(ordered_completed)
    inferred_global: Set[str] = set()
    assumption_rows: List[dict] = []

    for source_course in ordered_completed:
        required = _get_all_required_prereqs(source_course, prereq_map)
        already_completed = sorted([c for c in required if c in completed_set])
        assumed = sorted([c for c in required if c not in completed_set])

        if assumed:
            assumption_rows.append({
                "source_completed": source_course,
                "assumed_prereqs": assumed,
                "already_completed_prereqs": already_completed,
            })
            inferred_global.update(assumed)

    expanded_completed = ordered_completed + sorted(inferred_global - completed_set)
    return expanded_completed, assumption_rows


def expand_in_progress_with_prereqs(
    in_progress: List[str],
    completed: List[str],
    prereq_map: Dict[str, dict],
) -> Tuple[List[str], List[dict]]:
    """
    Expand in-progress with transitively required prereqs while preserving
    deterministic ordering and provenance.

    Returns:
      (expanded_in_progress, assumption_rows)

    assumption_rows item shape:
      {
        "source_in_progress": str,
        "assumed_prereqs": List[str],
        "already_completed_prereqs": List[str],
      }
    """
    ordered_in_progress = list(dict.fromkeys(in_progress))
    completed_set = set(completed)
    in_progress_set = set(ordered_in_progress)
    inferred_global: Set[str] = set()
    assumption_rows: List[dict] = []

    for source_course in ordered_in_progress:
        required = _get_all_required_prereqs(source_course, prereq_map)
        already_completed = sorted([c for c in required if c in completed_set])
        assumed = sorted([
            c for c in required
            if c not in completed_set and c not in in_progress_set
        ])

        if assumed:
            assumption_rows.append({
                "source_in_progress": source_course,
                "assumed_prereqs": assumed,
                "already_completed_prereqs": already_completed,
            })
            inferred_global.update(assumed)

    expanded_in_progress = ordered_in_progress + sorted(inferred_global - in_progress_set)
    return expanded_in_progress, assumption_rows
