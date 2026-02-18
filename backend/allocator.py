import pandas as pd
from requirements import TRACK_ID, MAX_BUCKETS_PER_COURSE, get_allowed_double_count_pairs


def _safe_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().upper() == "TRUE"
    return bool(val)


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
    Expand course_bucket_map: if a row has constraints='equiv_group:EQUIV_FINA_4001',
    add extra rows for all other members of that equivalency group so they
    also map to the same bucket.
    """
    if equivalencies_df is None or len(equivalencies_df) == 0:
        return track_map

    equiv_groups: dict[str, list[str]] = {}
    for _, row in equivalencies_df.iterrows():
        gid = str(row["equiv_group_id"])
        code = str(row["course_code"])
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

    if extra_rows:
        expanded = pd.concat([track_map, pd.DataFrame(extra_rows)], ignore_index=True)
        expanded = expanded.drop_duplicates(subset=["track_id", "bucket_id", "course_code"])
        return expanded
    return track_map


def allocate_courses(
    completed: list,
    in_progress: list,
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    equivalencies_df: pd.DataFrame = None,
) -> dict:
    """
    Deterministically allocates completed courses to requirement buckets.

    Only `completed` courses count toward bucket satisfaction.
    `in_progress` courses are tracked but do NOT fill buckets.

    Returns:
    {
      "applied_by_bucket": {
        "CORE": {
          "completed_applied": ["FINA 3001"],
          "in_progress_applied": ["FINA 4001"],
          "credits_applied": 3,
          "satisfied": False,
          "label": "Core Required",
          "needed": 3,
        }, ...
      },
      "double_counted_courses": [
        {"course_code": "FINA 4020", "buckets": ["FIN_CHOOSE_2", "FIN_CHOOSE_1"]}
      ],
      "remaining": {
        "CORE": {
          "needed": 3,
          "slots_remaining": 2,
          "remaining_courses": ["FINA 4001", "FINA 4011"],
          "label": "Core Required",
          "is_credit_based": False,
        }, ...
      },
      "notes": [...],
      "bucket_order": ["CORE", "FIN_CHOOSE_2", ...],
    }
    """
    # Filter to our track
    track_buckets = buckets_df[buckets_df["track_id"] == TRACK_ID].copy()
    track_map = course_bucket_map_df[course_bucket_map_df["track_id"] == TRACK_ID].copy()
    track_map = _expand_map_with_equivalencies(track_map, equivalencies_df)

    # Build allowed double-count pairs from bucket data
    allowed_pairs = get_allowed_double_count_pairs(track_buckets)

    # bucket_order: sorted by priority ascending (priority 1 = highest)
    bucket_order = (
        track_buckets.sort_values("priority")["bucket_id"].tolist()
    )

    # Build bucket metadata
    bucket_meta: dict[str, dict] = {}
    for _, row in track_buckets.iterrows():
        bid = row["bucket_id"]
        needed_count = _safe_int(row.get("needed_count"))
        needed_credits = _safe_int(row.get("needed_credits"))
        min_level = _safe_int(row.get("min_level"))
        allow_dc = _safe_bool(row.get("allow_double_count", False))

        bucket_meta[bid] = {
            "label": str(row.get("bucket_label", bid)),
            "priority": _safe_int(row.get("priority"), 99),
            "needed_count": needed_count,
            "needed_credits": needed_credits,
            "min_level": min_level,
            "allow_double_count": allow_dc,
            # mutable tracking fields:
            "slots_used": 0,
            "credits_used": 0,
        }

    # course-level lookup helpers
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
        """Returns list of {bucket_id, can_double_count} dicts, filtered by min_level."""
        rows = track_map[track_map["course_code"] == course_code]
        result = []
        course_level = get_course_level(course_code)

        for _, row in rows.iterrows():
            bid = row["bucket_id"]
            if bid not in bucket_meta:
                continue
            # Enforce min_level constraint
            min_lvl = bucket_meta[bid].get("min_level")
            if min_lvl is not None and course_level is not None and course_level < min_lvl:
                continue
            result.append({
                "bucket_id": bid,
                "can_double_count": _safe_bool(row.get("can_double_count", False)),
            })

        # Sort by priority ascending
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

    # Initialize applied tracking
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

    # ── Step 1: sort completed by number of eligible buckets ascending ──────────
    completed_with_buckets = []
    for code in completed:
        eligible_buckets = get_eligible_buckets_for_course(code)
        completed_with_buckets.append((code, eligible_buckets))

    completed_with_buckets.sort(key=lambda x: len(x[1]))

    # ── Step 2: assign completed courses ────────────────────────────────────────
    for course_code, eligible_buckets in completed_with_buckets:
        if not eligible_buckets:
            continue

        credits = get_course_credits(course_code)
        assigned_to: list[str] = []

        # Primary assignment: first non-full bucket
        for bucket_info in eligible_buckets:
            bid = bucket_info["bucket_id"]
            if is_full(bid):
                continue
            # Assign
            applied[bid]["completed_applied"].append(course_code)
            applied[bid]["credits_applied"] += credits
            bucket_meta[bid]["slots_used"] += 1
            bucket_meta[bid]["credits_used"] += credits
            assigned_to.append(bid)
            break

        if not assigned_to:
            continue

        primary_bid = assigned_to[0]

        # Check if primary bucket is now satisfied
        meta = bucket_meta[primary_bid]
        if meta["needed_count"] is not None:
            applied[primary_bid]["satisfied"] = (
                len(applied[primary_bid]["completed_applied"]) >= meta["needed_count"]
            )
        elif meta["needed_credits"] is not None:
            applied[primary_bid]["satisfied"] = (
                applied[primary_bid]["credits_applied"] >= meta["needed_credits"]
            )

        # Secondary assignment (double-count)
        if len(assigned_to) < MAX_BUCKETS_PER_COURSE:
            for bucket_info in eligible_buckets:
                bid = bucket_info["bucket_id"]
                if bid in assigned_to:
                    continue
                if not bucket_info["can_double_count"]:
                    continue
                pair = frozenset([primary_bid, bid])
                if pair not in allowed_pairs:
                    continue
                if is_full(bid):
                    notes.append(
                        f"{course_code} could also count toward "
                        f"{bucket_meta[bid]['label']} but that bucket is already satisfied."
                    )
                    continue
                # Assign secondary
                applied[bid]["completed_applied"].append(course_code)
                applied[bid]["credits_applied"] += credits
                bucket_meta[bid]["slots_used"] += 1
                bucket_meta[bid]["credits_used"] += credits
                assigned_to.append(bid)

                # Check if secondary bucket is now satisfied
                meta2 = bucket_meta[bid]
                if meta2["needed_count"] is not None:
                    applied[bid]["satisfied"] = (
                        len(applied[bid]["completed_applied"]) >= meta2["needed_count"]
                    )
                elif meta2["needed_credits"] is not None:
                    applied[bid]["satisfied"] = (
                        applied[bid]["credits_applied"] >= meta2["needed_credits"]
                    )
                break

        if len(assigned_to) > 1:
            double_counted.append({
                "course_code": course_code,
                "buckets": assigned_to,
            })

    # ── Step 3: track in-progress (display only, does not fill buckets) ─────────
    for course_code in in_progress:
        eligible_buckets = get_eligible_buckets_for_course(course_code)
        for bucket_info in eligible_buckets[:MAX_BUCKETS_PER_COURSE]:
            bid = bucket_info["bucket_id"]
            if course_code not in applied[bid]["in_progress_applied"]:
                applied[bid]["in_progress_applied"].append(course_code)

    # ── Step 4: build `remaining` output ────────────────────────────────────────
    completed_set = set(completed)
    in_progress_set = set(in_progress)

    remaining: dict[str, dict] = {}
    for bid in bucket_order:
        if bid not in bucket_meta:
            continue
        meta = bucket_meta[bid]
        slots = slots_remaining(bid)

        needed_val = meta["needed_count"] if meta["needed_count"] is not None else meta["needed_credits"]

        # Remaining courses: in map but not completed/in_progress
        bucket_courses = track_map[track_map["bucket_id"] == bid]["course_code"].tolist()
        remaining_courses = [
            c for c in bucket_courses
            if c not in completed_set and c not in in_progress_set
        ]

        remaining[bid] = {
            "needed": needed_val,
            "slots_remaining": slots,
            "remaining_courses": remaining_courses,
            "label": meta["label"],
            "is_credit_based": meta["needed_count"] is None,
        }

    # ── Step 5: finalize applied_by_bucket ──────────────────────────────────────
    applied_by_bucket: dict[str, dict] = {}
    for bid in bucket_order:
        if bid not in applied:
            continue
        meta = bucket_meta[bid]
        needed_val = meta["needed_count"] if meta["needed_count"] is not None else meta["needed_credits"]
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
