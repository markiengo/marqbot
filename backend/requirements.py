import pandas as pd

# Default track identifier used as parameter default for backward compatibility.
DEFAULT_TRACK_ID = "FIN_MAJOR"

# Maximum number of requirement buckets a single course can fill.
MAX_BUCKETS_PER_COURSE = 6

# prereq_soft tags that surface as warnings but do NOT block eligibility.
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

# prereq_soft tag that signals the hard prereq is too complex to parse.
COMPLEX_PREREQ_TAG = "hard_prereq_complex"

# prereq_soft tags indicating concurrent enrollment is allowed.
CONCURRENT_TAGS = {"may_be_concurrent"}

# Minimum blocking threshold: warn if a CORE course blocks this many Finance electives.
BLOCKING_WARNING_THRESHOLD = 2


def _build_parent_bucket_map(track_buckets_df: pd.DataFrame) -> dict[str, str]:
    """
    Map runtime bucket_id -> parent bucket_id when available.

    In V2-derived runtime data, `parent_bucket_id` exists for sub-buckets.
    In legacy data, this map is empty.
    """
    if "parent_bucket_id" not in track_buckets_df.columns or "bucket_id" not in track_buckets_df.columns:
        return {}
    out: dict[str, str] = {}
    for _, row in track_buckets_df.iterrows():
        child = str(row.get("bucket_id", "") or "").strip()
        parent = str(row.get("parent_bucket_id", "") or "").strip()
        if child and parent:
            out[child] = parent
    return out


def _canon_node_pair(type_a: str, id_a: str, type_b: str, id_b: str) -> tuple[str, str, str, str]:
    a = (str(type_a).strip().lower(), str(id_a).strip())
    b = (str(type_b).strip().lower(), str(id_b).strip())
    if a <= b:
        return (a[0], a[1], b[0], b[1])
    return (b[0], b[1], a[0], a[1])


def _build_policy_lookup(
    double_count_policy_df: pd.DataFrame,
    program_id: str,
) -> dict[tuple[str, str, str, str], bool]:
    """
    Build canonical lookup:
      (node_type_a, node_id_a, node_type_b, node_id_b) -> allow_double_count (bool)
    """
    if double_count_policy_df is None or len(double_count_policy_df) == 0:
        return {}
    if "program_id" not in double_count_policy_df.columns:
        return {}

    policy = double_count_policy_df[
        double_count_policy_df["program_id"].astype(str).str.strip().str.upper()
        == str(program_id).strip().upper()
    ].copy()
    if len(policy) == 0:
        return {}

    # Compatibility fallback: old-style policy can omit node_type columns.
    if "node_type_a" not in policy.columns:
        policy["node_type_a"] = "bucket"
    if "node_type_b" not in policy.columns:
        policy["node_type_b"] = "bucket"
    if "node_id_a" not in policy.columns and "bucket_id_a" in policy.columns:
        policy["node_id_a"] = policy["bucket_id_a"]
    if "node_id_b" not in policy.columns and "bucket_id_b" in policy.columns:
        policy["node_id_b"] = policy["bucket_id_b"]

    required_cols = {"node_type_a", "node_id_a", "node_type_b", "node_id_b", "allow_double_count"}
    if not required_cols.issubset(set(policy.columns)):
        return {}

    lookup: dict[tuple[str, str, str, str], bool] = {}
    for _, row in policy.iterrows():
        key = _canon_node_pair(
            row.get("node_type_a", ""),
            row.get("node_id_a", ""),
            row.get("node_type_b", ""),
            row.get("node_id_b", ""),
        )
        allow = row.get("allow_double_count", False)
        if isinstance(allow, str):
            allow = allow.strip().lower() in {"1", "true", "yes", "y"}
        else:
            allow = bool(allow)
        lookup[key] = allow
    return lookup


def _policy_pair_allowed(
    bucket_a: str,
    bucket_b: str,
    parent_bucket_map: dict[str, str],
    policy_lookup: dict[tuple[str, str, str, str], bool],
) -> bool:
    """
    Resolution precedence:
      1) sub_bucket <-> sub_bucket
      2) bucket <-> bucket (using parent_bucket_id)
      3) no rule => DENY
    """
    sub_key = _canon_node_pair("sub_bucket", bucket_a, "sub_bucket", bucket_b)
    if sub_key in policy_lookup:
        return bool(policy_lookup[sub_key])

    parent_a = parent_bucket_map.get(bucket_a)
    parent_b = parent_bucket_map.get(bucket_b)
    if parent_a and parent_b:
        bucket_key = _canon_node_pair("bucket", parent_a, "bucket", parent_b)
        if bucket_key in policy_lookup:
            return bool(policy_lookup[bucket_key])

    return False


def get_allowed_double_count_pairs(
    buckets_df: pd.DataFrame,
    track_id: str | None = None,
    double_count_policy_df: pd.DataFrame | None = None,
) -> set[frozenset[str]]:
    """
    Return allowed bucket pairs for the current runtime track/program.

    Policy-only behavior:
    - Use policy resolution (sub-bucket rule > bucket rule > deny).
    - If no applicable policy rows are present, all pairs are denied.
    """
    if buckets_df is None or len(buckets_df) == 0:
        return set()

    if track_id is None:
        # Legacy callers pass already filtered bucket rows.
        track_buckets = buckets_df.copy()
        inferred_track_id = None
    else:
        if "track_id" in buckets_df.columns:
            track_buckets = buckets_df[
                buckets_df["track_id"].astype(str).str.strip().str.upper()
                == str(track_id).strip().upper()
            ].copy()
        else:
            track_buckets = buckets_df.copy()
        inferred_track_id = str(track_id).strip().upper()

    if len(track_buckets) == 0 or "bucket_id" not in track_buckets.columns:
        return set()

    if not inferred_track_id or double_count_policy_df is None or len(double_count_policy_df) == 0:
        return set()

    policy_lookup = _build_policy_lookup(double_count_policy_df, inferred_track_id)
    if len(policy_lookup) == 0:
        return set()

    parent_map = _build_parent_bucket_map(track_buckets)
    bucket_ids = sorted(
        {
            str(b).strip()
            for b in track_buckets["bucket_id"].tolist()
            if str(b).strip()
        }
    )
    allowed_pairs: set[frozenset[str]] = set()
    for i in range(len(bucket_ids)):
        for j in range(i + 1, len(bucket_ids)):
            a = bucket_ids[i]
            b = bucket_ids[j]
            if _policy_pair_allowed(a, b, parent_map, policy_lookup):
                allowed_pairs.add(frozenset([a, b]))
    return allowed_pairs


def get_bucket_by_role(buckets_df: pd.DataFrame, track_id: str, role: str) -> str | None:
    """Return the first bucket_id with the given role for a track, or None.

    Expects exactly one match per role per track. Logs a warning if multiple
    rows match (tie-break uses deterministic order).
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
