import pandas as pd

# Finance major track identifier (matches track_id in Excel)
TRACK_ID = "FIN_MAJOR"

# Maximum number of requirement buckets a single course can fill
MAX_BUCKETS_PER_COURSE = 2

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
