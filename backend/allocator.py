import pandas as pd

from requirements import (
    DEFAULT_TRACK_ID,
    get_allowed_double_count_pairs,
)


def _safe_int(val, default=None):
    try:
        if pd.isna(val):
            return default
        return int(val)
    except (TypeError, ValueError):
        return default


def _infer_requirement_mode(row: pd.Series) -> str:
    mode = str(row.get("requirement_mode", "") or "").strip().lower()
    if mode in {"required", "choose_n", "credits_pool"}:
        return mode
    role = str(row.get("role", "") or "").strip().lower()
    if role == "core":
        return "required"
    needed_credits = _safe_int(row.get("needed_credits"))
    if needed_credits is not None and needed_credits > 0:
        return "credits_pool"
    needed_count = _safe_int(row.get("needed_count"))
    if role == "elective" or (needed_count is not None and needed_count > 0):
        return "choose_n"
    return "required"


def _expand_map_with_equivalencies(
    track_map: pd.DataFrame,
    equivalencies_df: pd.DataFrame,
    track_id: str,
) -> pd.DataFrame:
    """
    Expand course-bucket mappings via equivalency groups.

    If a mapped course belongs to an equivalency group, all members of that
    group are mapped to the same bucket. Optional scope is respected:
    - global rows (empty scope) apply to all programs
    - scoped rows apply only to matching program_id / track_id
    """
    if equivalencies_df is None or len(equivalencies_df) == 0 or len(track_map) == 0:
        return track_map
    if "equiv_group_id" not in equivalencies_df.columns or "course_code" not in equivalencies_df.columns:
        return track_map

    eq = equivalencies_df.copy()
    eq["equiv_group_id"] = eq["equiv_group_id"].fillna("").astype(str).str.strip()
    eq["course_code"] = eq["course_code"].fillna("").astype(str).str.strip()
    if "scope_program_id" in eq.columns:
        eq["scope_program_id"] = eq["scope_program_id"].fillna("").astype(str).str.strip().str.upper()
    elif "program_scope" in eq.columns:
        eq["scope_program_id"] = eq["program_scope"].fillna("").astype(str).str.strip().str.upper()
    else:
        eq["scope_program_id"] = ""
    eq = eq[(eq["equiv_group_id"] != "") & (eq["course_code"] != "")]
    if len(eq) == 0:
        return track_map

    track_key = str(track_id or "").strip().upper()
    group_members: dict[str, list[str]] = {}
    group_scopes: dict[str, set[str]] = {}
    course_to_groups: dict[str, set[str]] = {}
    for gid, grp in eq.groupby("equiv_group_id"):
        members = sorted({str(c).strip() for c in grp["course_code"].tolist() if str(c).strip()})
        scopes = {
            str(s).strip().upper()
            for s in grp["scope_program_id"].tolist()
            if str(s).strip()
        }
        if not members:
            continue
        group_members[gid] = members
        group_scopes[gid] = scopes
        for member in members:
            course_to_groups.setdefault(member, set()).add(gid)

    existing_keys = {
        (
            str(r.get("track_id", "")).strip().upper(),
            str(r.get("bucket_id", "")).strip(),
            str(r.get("course_code", "")).strip(),
        )
        for _, r in track_map.iterrows()
    }
    extra_rows = []
    for _, row in track_map.iterrows():
        base_code = str(row.get("course_code", "") or "").strip()
        if not base_code:
            continue
        for gid in course_to_groups.get(base_code, set()):
            scopes = group_scopes.get(gid, set())
            if scopes and track_key not in scopes:
                continue
            for member in group_members.get(gid, []):
                if member == base_code:
                    continue
                key = (
                    str(row.get("track_id", "")).strip().upper(),
                    str(row.get("bucket_id", "")).strip(),
                    member,
                )
                if key in existing_keys:
                    continue
                new_row = row.copy()
                new_row["course_code"] = member
                extra_rows.append(new_row)
                existing_keys.add(key)

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
    track_map = _expand_map_with_equivalencies(track_map, equivalencies_df, track_key)

    # Pre-index course<->bucket mappings once to avoid repeated dataframe scans.
    course_bucket_index: dict[str, list[str]] = {}
    bucket_course_index: dict[str, list[str]] = {}
    for _, row in track_map.iterrows():
        course_code = str(row.get("course_code", "") or "").strip()
        bucket_id = str(row.get("bucket_id", "") or "").strip()
        if not course_code or not bucket_id:
            continue

        per_course = course_bucket_index.setdefault(course_code, [])
        if bucket_id not in per_course:
            per_course.append(bucket_id)

        per_bucket = bucket_course_index.setdefault(bucket_id, [])
        if course_code not in per_bucket:
            per_bucket.append(course_code)

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
        requirement_mode = _infer_requirement_mode(row)
        bucket_meta[bid] = {
            "label": str(row.get("bucket_label", bid)),
            "priority": _safe_int(row.get("priority"), 99),
            "needed_count": needed_count,
            "needed_credits": needed_credits,
            "min_level": min_level,
            "requirement_mode": requirement_mode,
            "parent_bucket_id": str(row.get("parent_bucket_id", "") or "").strip(),
            # mutable tracking:
            "slots_used": 0,
            "credits_used": 0,
        }

    course_credits_index: dict[str, int] = {}
    course_level_index: dict[str, int | None] = {}
    for _, row in courses_df.iterrows():
        code = str(row.get("course_code", "") or "").strip()
        if not code or code in course_credits_index:
            continue
        credits = _safe_int(row.get("credits"), 3)
        course_credits_index[code] = credits if credits is not None else 3
        course_level_index[code] = _safe_int(row.get("level"))

    def get_course_credits(course_code: str) -> int:
        return course_credits_index.get(course_code, 3)

    def get_course_level(course_code: str) -> int | None:
        return course_level_index.get(course_code)

    def get_eligible_buckets_for_course(course_code: str) -> list[dict]:
        result = []
        course_level = get_course_level(course_code)

        for bid in course_bucket_index.get(course_code, []):
            if bid not in bucket_meta:
                continue
            min_lvl = bucket_meta[bid].get("min_level")
            if min_lvl is not None and course_level is not None and course_level < min_lvl:
                continue
            mode = str(bucket_meta.get(bid, {}).get("requirement_mode", "") or "").strip().lower()
            result.append({"bucket_id": bid, "requirement_mode": mode})

        # Base deterministic order.
        result.sort(
            key=lambda b: (
                bucket_meta.get(b["bucket_id"], {}).get("priority", 99),
                str(b["bucket_id"]),
            )
        )

        # Same-family precedence guard:
        # prefer required -> choose_n -> credits_pool
        # within each parent bucket family.
        if len(result) <= 1:
            return [{"bucket_id": r["bucket_id"]} for r in result]

        parent_order: list[str] = []
        grouped: dict[str, dict[str, list[dict]]] = {}
        for entry in result:
            bid = entry["bucket_id"]
            meta = bucket_meta.get(bid, {})
            parent = str(meta.get("parent_bucket_id", "") or "").strip()
            if parent not in grouped:
                grouped[parent] = {
                    "required": [],
                    "choose_n": [],
                    "credits_pool": [],
                    "other": [],
                }
                parent_order.append(parent)
            mode = str(meta.get("requirement_mode", "") or "").strip().lower()
            if mode == "required":
                grouped[parent]["required"].append(entry)
            elif mode == "choose_n":
                grouped[parent]["choose_n"].append(entry)
            elif mode == "credits_pool":
                grouped[parent]["credits_pool"].append(entry)
            else:
                grouped[parent]["other"].append(entry)

        def _sort_group(rows_: list[dict]) -> list[dict]:
            return sorted(
                rows_,
                key=lambda e: (
                    bucket_meta.get(e["bucket_id"], {}).get("priority", 99),
                    str(e["bucket_id"]),
                ),
            )

        reordered: list[dict] = []
        for parent in parent_order:
            reordered.extend(_sort_group(grouped[parent]["required"]))
            reordered.extend(_sort_group(grouped[parent]["choose_n"]))
            reordered.extend(_sort_group(grouped[parent]["credits_pool"]))
            reordered.extend(_sort_group(grouped[parent]["other"]))
        return [{"bucket_id": r["bucket_id"]} for r in reordered]

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
    # Respect pairwise double-count policy so in-progress courses don't appear
    # in multiple same-parent buckets simultaneously (visual double-count bug).
    for course_code in in_progress:
        eligible_buckets = get_eligible_buckets_for_course(course_code)
        ip_assigned_to: list[str] = []
        for bucket_info in eligible_buckets:
            bid = bucket_info["bucket_id"]
            if course_code in applied[bid]["in_progress_applied"]:
                ip_assigned_to.append(bid)
                continue
            if not ip_assigned_to:
                applied[bid]["in_progress_applied"].append(course_code)
                ip_assigned_to.append(bid)
            else:
                pairwise_ok = all(
                    frozenset([existing, bid]) in allowed_pairs
                    for existing in ip_assigned_to
                )
                if pairwise_ok:
                    applied[bid]["in_progress_applied"].append(course_code)
                    ip_assigned_to.append(bid)

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
        bucket_courses = bucket_course_index.get(bid, [])
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
