import pandas as pd

from requirements import (
    DEFAULT_TRACK_ID,
    MAX_BUCKETS_PER_COURSE,
    get_allowed_double_count_pairs,
)


def _safe_int(val, default=None):
    try:
        if pd.isna(val):
            return default
        return int(val)
    except (TypeError, ValueError):
        return default


def _expand_map_with_equivalencies(
    track_map: pd.DataFrame,
    equivalencies_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Expand course-bucket mappings via equivalency groups.

    If a row has constraints='equiv_group:<ID>', all members of that group are
    mapped to the same bucket.
    """
    if equivalencies_df is None or len(equivalencies_df) == 0 or len(track_map) == 0:
        return track_map

    equiv_groups: dict[str, list[str]] = {}
    for _, row in equivalencies_df.iterrows():
        gid = str(row.get("equiv_group_id", "") or "").strip()
        code = str(row.get("course_code", "") or "").strip()
        if gid and code:
            equiv_groups.setdefault(gid, []).append(code)

    extra_rows = []
    for _, row in track_map.iterrows():
        constraints = str(row.get("constraints", "") or "")
        if "equiv_group:" not in constraints:
            continue
        gid = constraints.split("equiv_group:")[1].strip()
        members = equiv_groups.get(gid, [])
        for member in members:
            if member != row["course_code"]:
                new_row = row.copy()
                new_row["course_code"] = member
                extra_rows.append(new_row)

    if not extra_rows:
        return track_map

    expanded = pd.concat([track_map, pd.DataFrame(extra_rows)], ignore_index=True)
    dedupe_cols = [c for c in ["track_id", "bucket_id", "course_code"] if c in expanded.columns]
    if dedupe_cols:
        expanded = expanded.drop_duplicates(subset=dedupe_cols)
    return expanded


def allocate_courses(
    completed: list[str],
    in_progress: list[str],
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    equivalencies_df: pd.DataFrame = None,
    track_id: str = DEFAULT_TRACK_ID,
    double_count_policy_df: pd.DataFrame | None = None,
) -> dict:
    """
    Deterministically allocate completed courses to requirement buckets.

    completed courses count toward satisfaction.
    in_progress courses are display-only and do not fill buckets.
    """
    if buckets_df is None or len(buckets_df) == 0:
        return {
            "applied_by_bucket": {},
            "double_counted_courses": [],
            "remaining": {},
            "notes": [],
            "bucket_order": [],
        }

    # Filter to requested track/program.
    track_key = str(track_id).strip().upper()
    track_buckets = buckets_df[
        buckets_df["track_id"].astype(str).str.strip().str.upper() == track_key
    ].copy()
    track_map = course_bucket_map_df[
        course_bucket_map_df["track_id"].astype(str).str.strip().str.upper() == track_key
    ].copy()
    track_map = _expand_map_with_equivalencies(track_map, equivalencies_df)

    # Allowed double-count pairs from policy engine (or legacy fallback).
    allowed_pairs = get_allowed_double_count_pairs(
        track_buckets,
        track_id=track_key,
        double_count_policy_df=double_count_policy_df,
    )

    # Priority order: smaller value first.
    if "priority" in track_buckets.columns:
        sort_priority = pd.to_numeric(track_buckets["priority"], errors="coerce").fillna(99)
        track_buckets = track_buckets.assign(_priority_sort=sort_priority).sort_values(
            ["_priority_sort", "bucket_id"], kind="stable"
        )
    else:
        track_buckets = track_buckets.sort_values("bucket_id", kind="stable")
    bucket_order = track_buckets["bucket_id"].astype(str).tolist()

    # Bucket metadata.
    bucket_meta: dict[str, dict] = {}
    for _, row in track_buckets.iterrows():
        bid = str(row["bucket_id"])
        needed_count = _safe_int(row.get("needed_count"))
        needed_credits = _safe_int(row.get("needed_credits"))
        min_level = _safe_int(row.get("min_level"))
        bucket_meta[bid] = {
            "label": str(row.get("bucket_label", bid)),
            "priority": _safe_int(row.get("priority"), 99),
            "needed_count": needed_count,
            "needed_credits": needed_credits,
            "min_level": min_level,
            "parent_bucket_id": str(row.get("parent_bucket_id", "") or "").strip(),
            # mutable tracking:
            "slots_used": 0,
            "credits_used": 0,
        }

    def get_course_row(course_code: str):
        rows = courses_df[courses_df["course_code"] == course_code]
        return rows.iloc[0] if len(rows) > 0 else None

    def get_course_credits(course_code: str) -> int:
        row = get_course_row(course_code)
        if row is not None:
            return _safe_int(row.get("credits"), 3)
        return 3

    def get_course_level(course_code: str) -> int | None:
        row = get_course_row(course_code)
        if row is not None:
            return _safe_int(row.get("level"))
        return None

    def get_eligible_buckets_for_course(course_code: str) -> list[dict]:
        rows = track_map[track_map["course_code"] == course_code]
        result = []
        course_level = get_course_level(course_code)

        for _, row in rows.iterrows():
            bid = str(row.get("bucket_id", ""))
            if bid not in bucket_meta:
                continue
            min_lvl = bucket_meta[bid].get("min_level")
            if min_lvl is not None and course_level is not None and course_level < min_lvl:
                continue
            result.append({"bucket_id": bid})

        result.sort(key=lambda b: bucket_meta.get(b["bucket_id"], {}).get("priority", 99))
        return result

    def slots_remaining(bid: str) -> int:
        meta = bucket_meta[bid]
        if meta["needed_count"] is not None:
            return max(0, meta["needed_count"] - meta["slots_used"])
        if meta["needed_credits"] is not None:
            return max(0, meta["needed_credits"] - meta["credits_used"])
        return 0

    def is_full(bid: str) -> bool:
        return slots_remaining(bid) <= 0

    applied: dict[str, dict] = {
        bid: {
            "completed_applied": [],
            "in_progress_applied": [],
            "credits_applied": 0,
            "satisfied": False,
        }
        for bid in bucket_meta
    }
    double_counted: list[dict] = []
    notes: list[str] = []

    def update_satisfied(bid: str):
        meta = bucket_meta[bid]
        if meta["needed_count"] is not None:
            applied[bid]["satisfied"] = (
                len(applied[bid]["completed_applied"]) >= meta["needed_count"]
            )
        elif meta["needed_credits"] is not None:
            applied[bid]["satisfied"] = (
                applied[bid]["credits_applied"] >= meta["needed_credits"]
            )

    def assign_completed_to_bucket(course_code: str, bid: str, credits: int):
        applied[bid]["completed_applied"].append(course_code)
        applied[bid]["credits_applied"] += credits
        bucket_meta[bid]["slots_used"] += 1
        bucket_meta[bid]["credits_used"] += credits
        update_satisfied(bid)

    # Step 1: sort by constrained courses first.
    completed_with_buckets = []
    for code in completed:
        eligible_buckets = get_eligible_buckets_for_course(code)
        completed_with_buckets.append((code, eligible_buckets))
    completed_with_buckets.sort(key=lambda x: len(x[1]))

    # Step 2: assign completed courses.
    for course_code, eligible_buckets in completed_with_buckets:
        if not eligible_buckets:
            continue
        credits = get_course_credits(course_code)
        assigned_to: list[str] = []

        # Primary assignment: first eligible non-full bucket.
        for bucket_info in eligible_buckets:
            bid = bucket_info["bucket_id"]
            if is_full(bid):
                continue
            assign_completed_to_bucket(course_code, bid, credits)
            assigned_to.append(bid)
            break

        if not assigned_to:
            continue

        # N-way assignment: each additional bucket must be pairwise-compatible
        # with all already-assigned buckets.
        for bucket_info in eligible_buckets:
            if len(assigned_to) >= MAX_BUCKETS_PER_COURSE:
                break

            bid = bucket_info["bucket_id"]
            if bid in assigned_to:
                continue

            pairwise_ok = True
            for existing in assigned_to:
                if frozenset([existing, bid]) not in allowed_pairs:
                    pairwise_ok = False
                    break
            if not pairwise_ok:
                continue

            if is_full(bid):
                notes.append(
                    f"{course_code} could also count toward "
                    f"{bucket_meta[bid]['label']} but that bucket is already satisfied."
                )
                continue

            assign_completed_to_bucket(course_code, bid, credits)
            assigned_to.append(bid)

        if len(assigned_to) > 1:
            double_counted.append(
                {
                    "course_code": course_code,
                    "buckets": assigned_to,
                }
            )

    # Step 3: in-progress display only.
    for course_code in in_progress:
        eligible_buckets = get_eligible_buckets_for_course(course_code)
        for bucket_info in eligible_buckets[:MAX_BUCKETS_PER_COURSE]:
            bid = bucket_info["bucket_id"]
            if course_code not in applied[bid]["in_progress_applied"]:
                applied[bid]["in_progress_applied"].append(course_code)

    # Step 4: remaining view.
    completed_set = set(completed)
    in_progress_set = set(in_progress)
    remaining: dict[str, dict] = {}
    for bid in bucket_order:
        if bid not in bucket_meta:
            continue
        meta = bucket_meta[bid]
        slots = slots_remaining(bid)
        needed_val = (
            meta["needed_count"] if meta["needed_count"] is not None else meta["needed_credits"]
        )
        bucket_courses = track_map[track_map["bucket_id"] == bid]["course_code"].tolist()
        remaining_courses = [c for c in bucket_courses if c not in completed_set and c not in in_progress_set]
        remaining[bid] = {
            "needed": needed_val,
            "slots_remaining": slots,
            "remaining_courses": remaining_courses,
            "label": meta["label"],
            "is_credit_based": meta["needed_count"] is None,
        }

    # Step 5: finalized applied output.
    applied_by_bucket: dict[str, dict] = {}
    for bid in bucket_order:
        if bid not in applied:
            continue
        meta = bucket_meta[bid]
        needed_val = (
            meta["needed_count"] if meta["needed_count"] is not None else meta["needed_credits"]
        )
        applied_by_bucket[bid] = {
            **applied[bid],
            "label": meta["label"],
            "needed": needed_val,
        }

    return {
        "applied_by_bucket": applied_by_bucket,
        "double_counted_courses": double_counted,
        "remaining": remaining,
        "notes": notes,
        "bucket_order": bucket_order,
    }
