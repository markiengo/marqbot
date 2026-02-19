import pandas as pd

# Default track identifier — used as parameter default for backward compatibility
DEFAULT_TRACK_ID = "FIN_MAJOR"

# Maximum number of requirement buckets a single course can fill
MAX_BUCKETS_PER_COURSE = 6

# prereq_soft tags that surface as warnings but do NOT block eligibility
SOFT_WARNING_TAGS = {
    "instructor_consent",
    "admitted_program",
    "major_restriction",
    "standing_requirement",
    "enrollment_requirement",
    "placement_required",
    "minimum_grade",
    "minimum_gpa",
}

# prereq_soft tag that signals the hard prereq is too complex to parse
# → course goes to manual_review_courses list (same as unsupported prereq_hard)
COMPLEX_PREREQ_TAG = "hard_prereq_complex"

# prereq_soft tags indicating concurrent enrollment is allowed
CONCURRENT_TAGS = {"may_be_concurrent"}

# Minimum blocking threshold: warn if a CORE course blocks this many Finance electives
BLOCKING_WARNING_THRESHOLD = 2


def get_allowed_double_count_pairs(buckets_df: pd.DataFrame) -> set:
    """
    Returns a set of frozensets — each frozenset is a pair of bucket_ids
    that are allowed to double-count.

    Any two buckets where both have allow_double_count=True can form a pair.
    CORE (allow_double_count=False) is automatically excluded.
    """
    eligible = set(
        buckets_df.loc[buckets_df["allow_double_count"] == True, "bucket_id"].tolist()
    )
    eligible_list = sorted(eligible)
    pairs = set()
    for i in range(len(eligible_list)):
        for j in range(i + 1, len(eligible_list)):
            pairs.add(frozenset([eligible_list[i], eligible_list[j]]))
    return pairs


def get_bucket_by_role(buckets_df: pd.DataFrame, track_id: str, role: str) -> str | None:
    """Return the first bucket_id with the given role for a track, or None.

    Expects exactly one match per role per track. Logs a warning if multiple
    rows match (tie-break uses spreadsheet row order).
    """
    if "role" not in buckets_df.columns:
        return None
    rows = buckets_df[
        (buckets_df["track_id"] == track_id) & (buckets_df["role"] == role)
    ]
    if len(rows) == 0:
        print(f"[WARN] No bucket with role='{role}' found for track '{track_id}'. Feature disabled.")
        return None
    if len(rows) > 1:
        print(
            f"[WARN] Multiple buckets with role='{role}' for track '{track_id}': "
            f"{rows['bucket_id'].tolist()}. Using deterministic tie-break "
            "(priority asc, bucket_id asc)."
        )

    # Deterministic tie-break for malformed data:
    # 1) smallest priority value, 2) bucket_id alphabetical.
    rows = rows.copy()
    if "priority" in rows.columns:
        priority_sort = pd.to_numeric(rows["priority"], errors="coerce").fillna(10**9)
    else:
        priority_sort = pd.Series([10**9] * len(rows), index=rows.index)
    rows["_priority_sort"] = priority_sort
    rows["_bucket_sort"] = rows["bucket_id"].astype(str)
    rows = rows.sort_values(["_priority_sort", "_bucket_sort"], kind="stable")
    return rows.iloc[0]["bucket_id"]


def get_buckets_by_role(buckets_df: pd.DataFrame, track_id: str, role: str) -> list[str]:
    """Return all bucket_ids with the given role for a track."""
    if "role" not in buckets_df.columns:
        return []
    rows = buckets_df[
        (buckets_df["track_id"] == track_id) & (buckets_df["role"] == role)
    ]
    if len(rows) == 0:
        print(f"[WARN] No buckets with role='{role}' found for track '{track_id}'. Feature disabled.")
    return rows["bucket_id"].tolist()
