import math


def estimate_timeline(
    allocator_remaining: dict,
    courses_df=None,
    courses_per_term: int = 3,
) -> dict:
    """
    Rough graduation timeline estimate based on remaining requirement slots.

    Uses allocator_remaining slot counts (not a raw course list) so double-counted
    courses correctly reduce slots in both buckets.

    Args:
        allocator_remaining: dict from allocator output["remaining"]
            Each entry: {"slots_remaining": int, "needed": int, ...}
        courses_df: unused in MVP; reserved for credit-based calculation
        courses_per_term: assumption for courses/term (default 3)

    Returns:
        {
          "remaining_slots_total": 7,
          "estimated_min_terms": 3,
          "disclaimer": "..."
        }
    """
    total_slots = sum(
        b.get("slots_remaining", 0)
        for b in allocator_remaining.values()
    )

    estimated_terms = math.ceil(total_slots / courses_per_term) if total_slots > 0 else 0

    return {
        "remaining_slots_total": total_slots,
        "estimated_min_terms": estimated_terms,
        "disclaimer": (
            f"Rough estimate. Assumes {courses_per_term} major courses per term "
            "and all courses offered each term. Ignores actual offering schedules, "
            "prerequisites not yet satisfied, and non-major requirements."
        ),
    }
