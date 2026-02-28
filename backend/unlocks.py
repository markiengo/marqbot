import pandas as pd
from prereq_parser import prereqs_satisfied


def build_reverse_prereq_map(
    courses_df: pd.DataFrame,
    prereq_map: dict,
) -> dict[str, list[str]]:
    """
    Builds a reverse prerequisite map: for each course, which courses directly
    list it as a prerequisite.

    Returns: {"FINA 3001": ["FINA 4001", "FINA 4011", "FINA 4050"], ...}

    Only direct prerequisites (one level deep). No transitive graph traversal.
    """
    reverse: dict[str, list[str]] = {}

    for course_code in courses_df["course_code"]:
        parsed = prereq_map.get(course_code, {"type": "none"})
        t = parsed.get("type")

        prereq_codes: list[str] = []
        if t == "single":
            prereq_codes = [parsed["course"]]
        elif t == "and":
            prereq_codes = parsed["courses"]
        elif t == "or":
            prereq_codes = parsed["courses"]

        for prereq_code in prereq_codes:
            reverse.setdefault(prereq_code, [])
            if course_code not in reverse[prereq_code]:
                reverse[prereq_code].append(course_code)

    return reverse


def compute_chain_depths(
    reverse_map: dict[str, list[str]],
) -> dict[str, int]:
    """
    Compute the longest downstream prerequisite chain depth for every course.

    A course with no downstream dependents has depth 0.
    FINA 3001 -> FINA 4075 -> AIM 4410 -> AIM 4420 -> AIM 4430
    gives FINA 3001 depth 4.

    Computed once at data load. O(V+E) with memoization.
    """
    memo: dict[str, int] = {}
    in_stack: set[str] = set()

    def _depth(course: str) -> int:
        if course in memo:
            return memo[course]
        if course in in_stack:
            return 0  # cycle guard
        in_stack.add(course)
        children = reverse_map.get(course, [])
        result = (1 + max(_depth(c) for c in children)) if children else 0
        in_stack.discard(course)
        memo[course] = result
        return result

    for course in reverse_map:
        _depth(course)

    return memo


def get_direct_unlocks(
    course_code: str,
    reverse_map: dict[str, list[str]],
    limit: int = 3,
) -> list[str]:
    """
    Returns up to `limit` courses directly unlocked by completing `course_code`.
    A course is "unlocked" if it lists `course_code` as a direct prerequisite.
    """
    return reverse_map.get(course_code, [])[:limit]


def get_blocking_warnings(
    core_remaining: list[str],
    reverse_map: dict[str, list[str]],
    finance_elective_courses: list[str],
    completed: list[str],
    in_progress: list[str],
    threshold: int = 2,
) -> list[str]:
    """
    For each incomplete CORE course, counts how many UNMET Finance elective courses
    it directly blocks (i.e., lists it as a prereq and the student hasn't taken it).

    "UNMET" = in the finance elective pool AND not in completed AND not in in_progress.

    Returns warning strings for CORE courses blocking >= threshold unmet electives.

    Example: "Completing FINA 3001 would unlock 5 Finance electives you can't yet take."
    """
    completed_set = set(completed)
    in_progress_set = set(in_progress)
    unmet_electives = set(
        c for c in finance_elective_courses
        if c not in completed_set and c not in in_progress_set
    )

    warnings: list[str] = []
    for core_course in core_remaining:
        directly_unlocked = reverse_map.get(core_course, [])
        blocked_unmet = [c for c in directly_unlocked if c in unmet_electives]
        if len(blocked_unmet) >= threshold:
            warnings.append(
                f"Completing {core_course} would unlock "
                f"{len(blocked_unmet)} Finance electives you can't yet take."
            )

    return warnings
