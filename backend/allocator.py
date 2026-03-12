import pandas as pd
from prereq_parser import parse_prereqs

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


def _safe_float(val, default=None):
    try:
        if pd.isna(val):
            return default
        return float(val)
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


def _normalize_track_key(track_id: str | None) -> str:
    return str(track_id or "").strip().upper()


def _safe_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().upper() == "TRUE"
    return bool(val)


def _normalize_text(value, default: str = "") -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    return str(value)


def _normalize_optional_text(value) -> str | None:
    text = _normalize_text(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def _build_course_runtime_indexes(courses_df: pd.DataFrame) -> dict:
    rows: list[dict] = []
    by_code: dict[str, dict] = {}
    credits: dict[str, int] = {}
    levels: dict[str, int | None] = {}

    if courses_df is None or len(courses_df) == 0:
        return {
            "rows": rows,
            "by_code": by_code,
            "credits": credits,
            "levels": levels,
        }

    for _, row in courses_df.iterrows():
        code = str(row.get("course_code", "") or "").strip()
        if not code or code in by_code:
            continue

        course_credits = _safe_int(row.get("credits"), 3)
        course_level = _safe_int(row.get("level"))
        prereq_concurrent = _normalize_text(row.get("prereq_concurrent", "none"), "none")
        prereq_soft = _normalize_text(row.get("prereq_soft", ""))
        min_standing = _safe_float(row.get("prereq_level"))
        if min_standing is None:
            min_standing = _safe_float(row.get("min_standing"), 0.0)
        if min_standing is None:
            min_standing = 0.0
        course_row = {
            "course_code": code,
            "course_name": _normalize_text(row.get("course_name", "")),
            "credits": course_credits if course_credits is not None else 3,
            "level": course_level,
            "prereq_concurrent": prereq_concurrent,
            "parsed_concurrent": parse_prereqs(prereq_concurrent if prereq_concurrent.strip() else "none"),
            "prereq_soft": prereq_soft,
            "soft_tags": [t.strip() for t in prereq_soft.split(";") if t.strip()],
            "soft_prereq_major_restriction": _normalize_text(row.get("soft_prereq_major_restriction", "")),
            "soft_prereq_college_restriction": _normalize_text(row.get("soft_prereq_college_restriction", "")),
            "warning_text": _normalize_optional_text(row.get("warning_text")),
            "notes": _normalize_optional_text(row.get("notes")),
            "offered_fall": _safe_bool(row.get("offered_fall", False)),
            "offered_spring": _safe_bool(row.get("offered_spring", False)),
            "offered_summer": _safe_bool(row.get("offered_summer", False)),
            "offering_confidence": _normalize_text(row.get("offering_confidence", "high"), "high").lower(),
            "prereq_level": min_standing,
            "min_standing": min_standing,
        }
        rows.append(course_row)
        by_code[code] = course_row
        credits[code] = course_row["credits"]
        levels[code] = course_level

    return {
        "rows": rows,
        "by_code": by_code,
        "credits": credits,
        "levels": levels,
    }


def _build_track_runtime_index(
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
    courses_df: pd.DataFrame,
    equivalencies_df: pd.DataFrame,
    track_id: str,
    double_count_policy_df: pd.DataFrame | None = None,
    course_indexes: dict | None = None,
) -> dict | None:
    if buckets_df is None or len(buckets_df) == 0:
        return None

    track_key = _normalize_track_key(track_id)
    track_buckets = buckets_df[
        buckets_df["track_id"].astype(str).str.strip().str.upper() == track_key
    ].copy()
    if len(track_buckets) == 0:
        return None

    base_track_map = course_bucket_map_df[
        course_bucket_map_df["track_id"].astype(str).str.strip().str.upper() == track_key
    ].copy()
    # Bucket mappings come solely from master_bucket_courses.csv (no equivalency expansion).
    track_map = base_track_map

    course_bucket_index: dict[str, list[str]] = {}
    bucket_course_index: dict[str, list[str]] = {}
    base_bucket_course_index: dict[str, list[str]] = {}

    for _, row in track_map.iterrows():
        course_code = str(row.get("course_code", "") or "").strip()
        bucket_id = str(row.get("bucket_id", "") or "").strip()
        if not course_code or not bucket_id:
            continue

        course_bucket_index.setdefault(course_code, [])
        if bucket_id not in course_bucket_index[course_code]:
            course_bucket_index[course_code].append(bucket_id)

        bucket_course_index.setdefault(bucket_id, [])
        if course_code not in bucket_course_index[bucket_id]:
            bucket_course_index[bucket_id].append(course_code)

    for _, row in base_track_map.iterrows():
        course_code = str(row.get("course_code", "") or "").strip()
        bucket_id = str(row.get("bucket_id", "") or "").strip()
        if not course_code or not bucket_id:
            continue
        base_bucket_course_index.setdefault(bucket_id, [])
        if course_code not in base_bucket_course_index[bucket_id]:
            base_bucket_course_index[bucket_id].append(course_code)

    allowed_pairs = get_allowed_double_count_pairs(
        track_buckets,
        track_id=track_key,
        double_count_policy_df=double_count_policy_df,
    )

    if "priority" in track_buckets.columns:
        sort_priority = pd.to_numeric(track_buckets["priority"], errors="coerce").fillna(99)
        track_buckets = track_buckets.assign(_priority_sort=sort_priority).sort_values(
            ["_priority_sort", "bucket_id"], kind="stable"
        )
    else:
        track_buckets = track_buckets.sort_values("bucket_id", kind="stable")

    bucket_order = track_buckets["bucket_id"].astype(str).tolist()
    bucket_meta_template: dict[str, dict] = {}
    selection_bucket_meta: dict[str, dict] = {}
    bucket_parent_map: dict[str, str] = {}
    bucket_track_required_map: dict[str, str] = {}
    bucket_role_map: dict[str, str] = {}

    for _, row in track_buckets.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        if not bid:
            continue
        needed_count = _safe_int(row.get("needed_count"))
        needed_credits = _safe_int(row.get("needed_credits"))
        min_level = _safe_int(row.get("min_level"))
        priority = _safe_int(row.get("priority"), 99) or 99
        parent_bucket_priority = _safe_int(row.get("parent_bucket_priority"), 99) or 99
        requirement_mode = _infer_requirement_mode(row)
        parent_bucket_id = str(row.get("parent_bucket_id", "") or "").strip()
        bucket_meta_template[bid] = {
            "label": str(row.get("bucket_label", bid)),
            "priority": priority,
            "parent_bucket_priority": parent_bucket_priority,
            "needed_count": needed_count,
            "needed_credits": needed_credits,
            "min_level": min_level,
            "requirement_mode": requirement_mode,
            "parent_bucket_id": parent_bucket_id,
            "double_count_family_id": str(row.get("double_count_family_id", "") or "").strip(),
        }
        selection_bucket_meta[bid] = {
            "priority": priority,
            "parent_bucket_id": parent_bucket_id,
            "requirement_mode": requirement_mode,
        }
        bucket_parent_map[bid.upper()] = parent_bucket_id.strip().upper()
        bucket_track_required_map[bid] = str(row.get("track_required", "") or "").strip().upper()
        bucket_role_map[bid] = str(row.get("role", "") or "").strip().lower()

    course_indexes = course_indexes or _build_course_runtime_indexes(courses_df)
    return {
        "track_key": track_key,
        "bucket_order": bucket_order,
        "bucket_meta_template": bucket_meta_template,
        "selection_bucket_meta": selection_bucket_meta,
        "course_bucket_index": course_bucket_index,
        "bucket_course_index": bucket_course_index,
        "base_bucket_course_index": base_bucket_course_index,
        "allowed_pairs": allowed_pairs,
        "course_credits_index": course_indexes["credits"],
        "course_level_index": course_indexes["levels"],
        "bucket_parent_map": bucket_parent_map,
        "bucket_track_required_map": bucket_track_required_map,
        "bucket_role_map": bucket_role_map,
    }


def get_runtime_track_index(runtime_indexes: dict | None, track_id: str) -> dict | None:
    if not runtime_indexes:
        return None
    return runtime_indexes.get("tracks", {}).get(_normalize_track_key(track_id))


def get_runtime_course_index(runtime_indexes: dict | None) -> dict | None:
    if not runtime_indexes:
        return None
    return runtime_indexes.get("courses")


def ensure_runtime_indexes(data: dict, *, force: bool = False) -> dict:
    runtime_indexes = data.get("runtime_indexes")
    if runtime_indexes is not None and not force:
        return data

    courses_df = data.get("courses_df", pd.DataFrame())
    buckets_df = data.get("buckets_df", pd.DataFrame())
    course_bucket_map_df = data.get("course_bucket_map_df", pd.DataFrame())
    equivalencies_df = data.get("equivalencies_df")
    double_count_policy_df = data.get("v2_double_count_policy_df")

    tracks: dict[str, dict] = {}
    course_indexes = _build_course_runtime_indexes(courses_df)
    track_ids: set[str] = set()
    if buckets_df is not None and len(buckets_df) > 0 and "track_id" in buckets_df.columns:
        track_ids.update(
            _normalize_track_key(track_id)
            for track_id in buckets_df["track_id"].tolist()
            if _normalize_track_key(track_id)
        )
    if course_bucket_map_df is not None and len(course_bucket_map_df) > 0 and "track_id" in course_bucket_map_df.columns:
        track_ids.update(
            _normalize_track_key(track_id)
            for track_id in course_bucket_map_df["track_id"].tolist()
            if _normalize_track_key(track_id)
        )

    ndc_groups = data.get("no_double_count_groups") or []

    for track_key in sorted(track_ids):
        track_index = _build_track_runtime_index(
            buckets_df,
            course_bucket_map_df,
            courses_df,
            equivalencies_df,
            track_key,
            double_count_policy_df=double_count_policy_df,
            course_indexes=course_indexes,
        )
        if track_index is not None:
            track_index["no_double_count_groups"] = ndc_groups
            tracks[track_key] = track_index

    parent_type_map: dict[str, str] = {}
    parent_buckets_df = data.get("parent_buckets_df")
    if parent_buckets_df is not None and len(parent_buckets_df) > 0 and "parent_bucket_id" in parent_buckets_df.columns:
        for _, row in parent_buckets_df.iterrows():
            pid = str(row.get("parent_bucket_id", "") or "").strip().upper()
            ptype = str(row.get("type", "") or "").strip().lower()
            if pid and ptype:
                parent_type_map[pid] = ptype

    data["runtime_indexes"] = {
        "courses": course_indexes,
        "tracks": tracks,
        "parent_type_map": parent_type_map,
    }
    return data


def get_applied_bucket_progress_units(
    applied_bucket: dict,
    *,
    include_in_progress: bool = False,
) -> int:
    """Return bucket progress in credit units for all response payloads."""
    completed_units = _safe_int(applied_bucket.get("credits_applied"), 0) or 0
    if not include_in_progress:
        return completed_units
    in_progress_units = _safe_int(applied_bucket.get("in_progress_credits_applied"), 0) or 0
    return completed_units + in_progress_units


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
    # Only equivalent-like and cross_listed types expand bucket mappings.
    if "relation_type" in eq.columns:
        eq = eq[eq["relation_type"].isin(["equivalent", "cross_listed", "honors", "grad", ""])]
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
    runtime_indexes: dict | None = None,
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

    track_key = _normalize_track_key(track_id)
    track_runtime = get_runtime_track_index(runtime_indexes, track_key)
    if track_runtime is None:
        track_runtime = _build_track_runtime_index(
            buckets_df,
            course_bucket_map_df,
            courses_df,
            equivalencies_df,
            track_key,
            double_count_policy_df=double_count_policy_df,
        )
    if track_runtime is None:
        return {
            "applied_by_bucket": {},
            "double_counted_courses": [],
            "remaining": {},
            "notes": [],
            "bucket_order": [],
        }

    bucket_order = list(track_runtime["bucket_order"])
    course_bucket_index = track_runtime["course_bucket_index"]
    bucket_course_index = track_runtime["bucket_course_index"]
    base_bucket_course_index = track_runtime["base_bucket_course_index"]
    allowed_pairs = track_runtime["allowed_pairs"]
    course_credits_index = dict(track_runtime["course_credits_index"])
    course_level_index = dict(track_runtime["course_level_index"])
    bucket_meta = {
        bid: {
            **meta,
            "slots_used": 0,
            "credits_used": 0,
        }
        for bid, meta in track_runtime["bucket_meta_template"].items()
    }

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

    def progress_needed_credits(bid: str) -> int:
        meta = bucket_meta[bid]
        needed_credits = meta.get("needed_credits")
        if needed_credits is not None:
            return max(0, int(needed_credits))

        needed_count = meta.get("needed_count")
        if needed_count is None:
            return 0

        mapped_courses = base_bucket_course_index.get(bid, [])
        if (
            str(meta.get("requirement_mode", "") or "").strip().lower() == "required"
            and len(mapped_courses) == int(needed_count)
        ):
            return sum(get_course_credits(code) for code in mapped_courses)

        return max(0, int(needed_count) * 3)

    def is_full(bid: str) -> bool:
        return slots_remaining(bid) <= 0

    applied: dict[str, dict] = {
        bid: {
            "completed_applied": [],
            "in_progress_applied": [],
            "credits_applied": 0,
            "in_progress_credits_applied": 0,
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

    # Build no-double-count reverse index for credit blocking.
    ndc_groups = track_runtime.get("no_double_count_groups") or []
    ndc_course_to_group: dict[str, int] = {}
    for gi, group in enumerate(ndc_groups):
        for member in group:
            ndc_course_to_group[member] = gi
    ndc_allocated_groups: dict[int, str] = {}  # group_index → first allocated code

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
        # No-double-count credit blocking: skip if another course in the
        # same NDC group has already been allocated.
        ndc_gi = ndc_course_to_group.get(course_code)
        if ndc_gi is not None and ndc_gi in ndc_allocated_groups:
            already = ndc_allocated_groups[ndc_gi]
            notes.append(
                f"{course_code} not counted toward progress — overlaps with {already} (no double credit)."
            )
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

        # Mark NDC group as allocated so subsequent members are blocked.
        if assigned_to and ndc_gi is not None:
            ndc_allocated_groups[ndc_gi] = course_code

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
        credits = get_course_credits(course_code)
        ip_assigned_to: list[str] = []
        for bucket_info in eligible_buckets:
            bid = bucket_info["bucket_id"]
            if course_code in applied[bid]["in_progress_applied"]:
                ip_assigned_to.append(bid)
                continue
            if not ip_assigned_to:
                applied[bid]["in_progress_applied"].append(course_code)
                applied[bid]["in_progress_credits_applied"] += credits
                ip_assigned_to.append(bid)
            else:
                pairwise_ok = all(
                    frozenset([existing, bid]) in allowed_pairs
                    for existing in ip_assigned_to
                )
                if pairwise_ok:
                    applied[bid]["in_progress_applied"].append(course_code)
                    applied[bid]["in_progress_credits_applied"] += credits
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
            "needed": progress_needed_credits(bid),
            "is_credit_based": meta["needed_count"] is None,
            "needed_count": meta["needed_count"],
            "requirement_mode": meta["requirement_mode"],
        }

    return {
        "applied_by_bucket": applied_by_bucket,
        "double_counted_courses": double_counted,
        "remaining": remaining,
        "notes": notes,
        "bucket_order": bucket_order,
    }
