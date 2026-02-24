import os
import re
import pandas as pd

from requirements import (
    DEFAULT_TRACK_ID,
    BLOCKING_WARNING_THRESHOLD,
    get_allowed_double_count_pairs,
    get_buckets_by_role,
)
from allocator import allocate_courses
from unlocks import get_direct_unlocks, get_blocking_warnings
from eligibility import get_eligible_courses, parse_term


SEM_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)

_CONCURRENT_ONLY_TAG = "may_be_concurrent"
_MAX_PER_BUCKET_PER_SEM = 2
_PROJECTION_NOTE = (
    "Projected progress below assumes you complete these recommendations."
)
_DEMOTED_BCC_CHILD_BUCKETS = {"BCC_ETHICS", "BCC_ANALYTICS", "BCC_ENHANCE"}
_MCC_PARENT_FAMILY_IDS = {"MCC", "MCC_CORE", "MCC_FOUNDATION"}

# BCC progress-aware decay (v1.9).
# Set BCC_DECAY_ENABLED=true in env to activate. Default off for safe rollout.
_BCC_DECAY_ENABLED: bool = os.environ.get("BCC_DECAY_ENABLED", "false").lower() == "true"
_BCC_DECAY_THRESHOLD: int = 12  # courses applied to BCC_REQUIRED before decay fires


def normalize_semester_label(label: str) -> str:
    m = SEM_RE.match((label or "").strip())
    if not m:
        return label
    term = m.group(1).capitalize()
    year = int(m.group(2))
    return f"{term} {year}"


def default_followup_semester(first_semester: str) -> str:
    """
    Optional second-semester default:
    - Spring YYYY -> Fall YYYY (skip Summer by default)
    - Summer YYYY -> Fall YYYY
    - Fall YYYY   -> Spring YYYY+1
    """
    m = SEM_RE.match((first_semester or "").strip())
    if not m:
        return "Fall 2026"
    term = m.group(1).capitalize()
    year = int(m.group(2))
    if term == "Spring":
        return f"Fall {year}"
    if term == "Summer":
        return f"Fall {year}"
    return f"Spring {year + 1}"


def _prereq_courses(parsed: dict) -> set[str]:
    t = parsed.get("type")
    if t == "single":
        return {parsed["course"]}
    if t in ("and", "or"):
        return set(parsed["courses"])
    return set()


def _soft_tag_demote_penalty(candidate: dict) -> int:
    """
    Demote any course that has prereq_soft tags, except when the only
    prereq_soft tag is may_be_concurrent.
    """
    tags = [str(t).strip() for t in candidate.get("all_soft_tags", []) if str(t).strip()]
    if not tags:
        return 0
    uniq = set(tags)
    if uniq == {_CONCURRENT_ONLY_TAG}:
        return 0
    return 1


def _local_bucket_id(bucket_id: str) -> str:
    raw = str(bucket_id or "").strip()
    if "::" in raw:
        return raw.split("::", 1)[1]
    return raw


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


def _build_selection_bucket_meta(data: dict, track_id: str) -> dict[str, dict]:
    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns:
        return {}

    subset = buckets_df
    if "track_id" in buckets_df.columns:
        tid = str(track_id or "").strip().upper()
        subset = buckets_df[
            buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
        ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, dict] = {}
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        if not bid:
            continue
        p_raw = pd.to_numeric(row.get("priority", 99), errors="coerce")
        out[bid] = {
            "priority": int(p_raw) if pd.notna(p_raw) else 99,
            "parent_bucket_id": str(row.get("parent_bucket_id", "") or "").strip(),
            "requirement_mode": _infer_requirement_mode(row),
        }
    return out


def _order_buckets_allocator_style(
    bucket_ids: list[str],
    bucket_meta: dict[str, dict],
) -> list[str]:
    unique = [str(b).strip() for b in bucket_ids if str(b).strip()]
    unique = list(dict.fromkeys(unique))
    unique.sort(key=lambda b: (bucket_meta.get(b, {}).get("priority", 99), b))
    if len(unique) <= 1:
        return unique

    parent_order: list[str] = []
    grouped: dict[str, dict[str, list[str]]] = {}
    for bid in unique:
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
            grouped[parent]["required"].append(bid)
        elif mode == "choose_n":
            grouped[parent]["choose_n"].append(bid)
        elif mode == "credits_pool":
            grouped[parent]["credits_pool"].append(bid)
        else:
            grouped[parent]["other"].append(bid)

    def _sort_group(bucket_ids_: list[str]) -> list[str]:
        return sorted(
            bucket_ids_,
            key=lambda b: (bucket_meta.get(b, {}).get("priority", 99), b),
        )

    ordered: list[str] = []
    for parent in parent_order:
        ordered.extend(_sort_group(grouped[parent]["required"]))
        ordered.extend(_sort_group(grouped[parent]["choose_n"]))
        ordered.extend(_sort_group(grouped[parent]["credits_pool"]))
        ordered.extend(_sort_group(grouped[parent]["other"]))
    return ordered


def _select_assignable_buckets_allocator_style(
    candidate_bucket_ids: list[str],
    virtual_remaining: dict[str, int],
    picks_per_bucket: dict[str, int],
    enforce_bucket_cap: bool,
    max_per_bucket: int,
    allowed_pairs: set[frozenset[str]],
    bucket_meta: dict[str, dict],
) -> list[str]:
    ordered = _order_buckets_allocator_style(candidate_bucket_ids, bucket_meta)
    assigned: list[str] = []
    for bid in ordered:
        if virtual_remaining.get(bid, 0) <= 0:
            continue
        if enforce_bucket_cap and picks_per_bucket.get(bid, 0) >= max_per_bucket:
            continue
        if not assigned:
            assigned.append(bid)
            continue
        pairwise_ok = all(
            frozenset([existing, bid]) in allowed_pairs
            for existing in assigned
        )
        if pairwise_ok:
            assigned.append(bid)
    return assigned


def _bucket_virtual_consumption_units(bucket_id: str, candidate: dict, bucket_meta: dict[str, dict]) -> int:
    mode = str(bucket_meta.get(bucket_id, {}).get("requirement_mode", "") or "").strip().lower()
    if mode == "credits_pool":
        return max(1, int(candidate.get("credits", 0) or 0))
    return 1


def _bucket_hierarchy_tier(candidate: dict) -> int:
    """Deprecated compatibility wrapper; use _bucket_hierarchy_tier_v2."""
    return _bucket_hierarchy_tier_v2(candidate, {}, {}, {})


def _build_parent_type_map(data: dict) -> dict[str, str]:
    """
    Build parent bucket id -> type map from parent_buckets_df when available.
    """
    parent_buckets_df = data.get("parent_buckets_df")
    if parent_buckets_df is None or len(parent_buckets_df) == 0:
        return {}
    if "parent_bucket_id" not in parent_buckets_df.columns:
        return {}
    out: dict[str, str] = {}
    for _, row in parent_buckets_df.iterrows():
        pid = str(row.get("parent_bucket_id", "") or "").strip().upper()
        ptype = str(row.get("type", "") or "").strip().lower()
        if pid and ptype:
            out[pid] = ptype
    return out


def _build_bucket_track_required_map(data: dict, track_id: str) -> dict[str, str]:
    """
    Build runtime bucket_id -> track_required map for the current runtime track.
    """
    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns or "track_id" not in buckets_df.columns:
        return {}

    tid = str(track_id or "").strip().upper()
    subset = buckets_df[
        buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
    ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, str] = {}
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip()
        track_req = str(row.get("track_required", "") or "").strip().upper()
        if bid:
            out[bid] = track_req
    return out


def _build_bucket_parent_map(data: dict, track_id: str) -> dict[str, str]:
    """Build runtime bucket_id -> parent_bucket_id map for the current runtime track."""
    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return {}
    if "bucket_id" not in buckets_df.columns or "track_id" not in buckets_df.columns:
        return {}

    tid = str(track_id or "").strip().upper()
    subset = buckets_df[
        buckets_df["track_id"].astype(str).str.strip().str.upper() == tid
    ].copy()
    if len(subset) == 0:
        return {}

    out: dict[str, str] = {}
    for _, row in subset.iterrows():
        bid = str(row.get("bucket_id", "") or "").strip().upper()
        pid = str(row.get("parent_bucket_id", "") or "").strip().upper()
        if bid:
            out[bid] = pid
    return out


def _is_mcc_tier_1_candidate(parent_id: str, primary_bucket: str, local_id: str) -> bool:
    if parent_id in _MCC_PARENT_FAMILY_IDS:
        return True
    if primary_bucket.startswith("MCC::"):
        return True
    if local_id.startswith("MCC_"):
        return True
    return False


def _bucket_hierarchy_tier_v2(
    candidate: dict,
    parent_type_map: dict[str, str],
    bucket_track_required_map: dict[str, str],
    bucket_parent_map: dict[str, str],
    bcc_decay_active: bool = False,
) -> int:
    """
    Priority tiers (v1.9 5-tier system):
      1) MCC + BCC_REQUIRED only (when not decayed)
      2) major parent buckets
      3) track/minor parent buckets
      4) decayed BCC_REQUIRED (when bcc_decay_active=True)
      5) demoted BCC children (BCC_ETHICS/ANALYTICS/ENHANCE)

    Unlockers remain an in-tier tie-break in the ranking key.
    """
    primary_bucket = str(candidate.get("primary_bucket", "") or "").strip().upper()
    primary_parent_id = str(candidate.get("primary_parent_bucket_id", "") or "").strip().upper()
    fills = [
        str(bid or "").strip().upper()
        for bid in (candidate.get("fills_buckets") or [])
        if str(bid or "").strip()
    ]
    bucket_ids = fills if fills else ([primary_bucket] if primary_bucket else [])
    if not bucket_ids:
        return 2

    def _tier_for_bucket(bucket_id: str) -> int:
        local_id = _local_bucket_id(bucket_id).upper()
        parent_id = bucket_parent_map.get(bucket_id, "")
        if not parent_id and bucket_id == primary_bucket:
            parent_id = primary_parent_id
        parent_id = str(parent_id or "").strip().upper()

        # Tier 5: explicitly demoted BCC children.
        if local_id in _DEMOTED_BCC_CHILD_BUCKETS:
            return 5

        # Tier 1 or 4: BCC_REQUIRED (position depends on decay state).
        if local_id == "BCC_REQUIRED":
            return 4 if bcc_decay_active else 1

        # Tier 1: MCC family.
        if _is_mcc_tier_1_candidate(parent_id, bucket_id, local_id):
            return 1

        # Tier 2/3 via authoritative parent type when available.
        parent_type = parent_type_map.get(parent_id, "")
        if parent_type in {"track", "minor"}:
            return 3
        if parent_type == "major":
            return 2

        # Fallback: runtime track_required indicates track-scoped bucket.
        track_required = bucket_track_required_map.get(bucket_id, "")
        if track_required:
            return 3

        # Unknown/legacy fallback.
        return 2

    return min(_tier_for_bucket(bid) for bid in bucket_ids)


def _count_bcc_required_done(progress: dict) -> int:
    """Count distinct applied courses (completed + in-progress) in BCC_REQUIRED."""
    for bid, bucket_data in progress.items():
        if _local_bucket_id(bid).upper() == "BCC_REQUIRED":
            completed = bucket_data.get("completed_applied", []) or []
            in_progress = bucket_data.get("in_progress_applied", []) or []
            applied = {
                str(code).strip().upper()
                for code in (completed + in_progress)
                if str(code).strip()
            }
            return len(applied)
    return 0


def _is_acco_major_context(data: dict, track_id: str) -> bool:
    tid = str(track_id or "").strip().upper()
    if tid == "ACCO_MAJOR":
        return True
    buckets_df = data.get("buckets_df")
    if buckets_df is None or len(buckets_df) == 0:
        return False
    subset = buckets_df[
        buckets_df.get("track_id", pd.Series(dtype=str))
        .astype(str)
        .str.strip()
        .str.upper()
        == tid
    ].copy()
    if len(subset) == 0:
        return False
    parent_match = (
        subset.get("parent_bucket_id", pd.Series(dtype=str))
        .astype(str)
        .str.strip()
        .str.upper()
        == "ACCO_MAJOR"
    ).any()
    if parent_match:
        return True
    bucket_match = subset.get("bucket_id", pd.Series(dtype=str)).astype(str).str.upper().str.startswith("ACCO_MAJOR::").any()
    return bool(bucket_match)


def _accc_major_required_rank(candidate: dict, is_acco_context: bool) -> int:
    if not is_acco_context:
        return 1
    warning_text = str(candidate.get("warning_text", "") or "").strip().lower()
    if "required for acco major" in warning_text or "required for acco majors" in warning_text:
        return 0
    return 1


def build_progress_output(allocation: dict, course_bucket_map_df: pd.DataFrame) -> dict:
    progress = {}
    for bid, applied in allocation["applied_by_bucket"].items():
        remaining = allocation["remaining"].get(bid, {})
        progress[bid] = {
            "label": applied.get("label", bid),
            "needed": applied.get("needed"),
            "completed_applied": applied["completed_applied"],
            "in_progress_applied": applied["in_progress_applied"],
            "done_count": len(applied["completed_applied"]),
            "satisfied": applied["satisfied"],
            "remaining_courses": remaining.get("remaining_courses", []),
            "slots_remaining": remaining.get("slots_remaining", 0),
        }
    return progress


def _dedupe_codes(codes: list[str]) -> list[str]:
    """Return codes in first-seen order without duplicates."""
    return list(dict.fromkeys([c for c in codes if c]))


def _build_projected_outputs(
    completed: list[str],
    in_progress: list[str],
    selected_codes: list[str],
    data: dict,
    track_id: str,
) -> dict:
    # Progress view keeps planned semester courses as in-progress (yellow segment).
    projected_completed_for_progress = _dedupe_codes(completed)
    projected_in_progress_for_progress = _dedupe_codes(in_progress + selected_codes)
    projected_alloc_for_progress = allocate_courses(
        projected_completed_for_progress,
        projected_in_progress_for_progress,
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )
    projected_progress = build_progress_output(
        projected_alloc_for_progress,
        data["course_bucket_map_df"],
    )
    return projected_progress


def _build_deterministic_recommendations(candidates: list[dict], max_recommendations: int) -> list[dict]:
    """Build recommendation output from pre-ranked candidates. No LLM call."""
    target_count = min(max_recommendations, len(candidates))
    recs = []
    for cand in candidates[:target_count]:
        buckets = cand.get("fills_buckets", [])
        if buckets:
            why = (
                "This course advances your declared degree path and "
                f"counts toward {len(buckets)} unmet requirement bucket(s)."
            )
        else:
            why = (
                "This course advances your declared degree path based on "
                "prerequisite order and remaining requirements."
            )
        recs.append({
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "why": why,
            "tier": cand.get("tier"),
            "prereq_check": cand.get("prereq_check", ""),
            "min_standing": cand.get("min_standing"),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": cand.get("fills_buckets", []),
            "unlocks": cand.get("unlocks", []),
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "warning_text": cand.get("warning_text"),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        })
    return recs


def _build_debug_trace(
    ranked: list[dict],
    selected_codes: set[str],
    skipped_reasons: dict[str, str],
    parent_type_map: dict,
    bucket_track_required_map: dict,
    bucket_parent_map: dict,
    is_acco_context: bool,
    core_prereq_blockers: set[str],
    reverse_map: dict,
    virtual_remaining_snapshot: dict[str, int],
    debug_limit: int = 30,
    bcc_decay_active: bool = False,
) -> list[dict]:
    """Build human-readable debug trace for each ranked candidate."""
    trace = []
    for rank, c in enumerate(ranked[:debug_limit], start=1):
        code = c["course_code"]
        tier = _bucket_hierarchy_tier_v2(
            c, parent_type_map, bucket_track_required_map, bucket_parent_map,
            bcc_decay_active,
        )
        unlocks = get_direct_unlocks(code, reverse_map, limit=50)
        fills = c.get("fills_buckets", [])
        bucket_capacity = {
            bid: virtual_remaining_snapshot.get(bid, 0) for bid in fills
        }
        trace.append({
            "rank": rank,
            "course_code": code,
            "course_name": c.get("course_name", ""),
            "selected": code in selected_codes,
            "skip_reason": skipped_reasons.get(code),
            "tier": tier,
            "acco_boost": _accc_major_required_rank(c, is_acco_context),
            "is_core_prereq_blocker": code in core_prereq_blockers,
            "unlock_count": len(unlocks),
            "unlocks": unlocks[:5],
            "soft_tag_penalty": _soft_tag_demote_penalty(c),
            "multi_bucket_score": c.get("multi_bucket_score", 0),
            "prereq_level": c.get("prereq_level", 0),
            "fills_buckets": fills,
            "bucket_capacity": bucket_capacity,
        })
    return trace


def run_recommendation_semester(
    completed: list[str],
    in_progress: list[str],
    target_semester_label: str,
    data: dict,
    max_recs: int,
    reverse_map: dict,
    track_id: str = DEFAULT_TRACK_ID,
    debug: bool = False,
    debug_limit: int = 30,
) -> dict:
    """Run the full recommendation pipeline for a single semester."""
    term = parse_term(target_semester_label)
    alloc = allocate_courses(
        completed,
        in_progress,
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )

    eligible_sem = get_eligible_courses(
        data["courses_df"],
        completed,
        in_progress,
        term,
        data["prereq_map"],
        alloc["remaining"],
        data["course_bucket_map_df"],
        data["buckets_df"],
        data["equivalencies_df"],
        track_id=track_id,
    )
    manual_review_sem = [c["course_code"] for c in eligible_sem if c.get("manual_review")]
    non_manual_sem = [c for c in eligible_sem if not c.get("manual_review")]
    eligible_count_sem = len(non_manual_sem)

    progress_sem = build_progress_output(alloc, data["course_bucket_map_df"])
    if not non_manual_sem:
        projected_progress_sem = _build_projected_outputs(
            completed,
            in_progress,
            [],
            data,
            track_id,
        )
        return {
            "target_semester": target_semester_label,
            "recommendations": [],
            "requested_recommendations": max_recs,
            "eligible_count": 0,
            "input_completed_count": len(completed),
            "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
            "in_progress_note": None,
            "blocking_warnings": [],
            "progress": progress_sem,
            "manual_review_courses": manual_review_sem,
            "projected_progress": projected_progress_sem,
            "projection_note": _PROJECTION_NOTE,
        }

    core_bucket_ids = get_buckets_by_role(data["buckets_df"], track_id, "core")
    core_remaining_sem: list[str] = []
    for core_bid in core_bucket_ids:
        core_remaining_sem.extend(
            alloc["remaining"].get(core_bid, {}).get("remaining_courses", [])
        )
    # Deduplicate while preserving order for deterministic warnings.
    core_remaining_sem = list(dict.fromkeys(core_remaining_sem))
    core_prereq_blockers_sem: set[str] = set()
    for core_code in core_remaining_sem:
        core_prereq_blockers_sem |= _prereq_courses(data["prereq_map"].get(core_code, {"type": "none"}))

    # BCC progress-aware decay: demote BCC_REQUIRED to Tier 4 once student
    # has >= _BCC_DECAY_THRESHOLD applied courses (completed + in-progress).
    bcc_decay_active = False
    if _BCC_DECAY_ENABLED:
        bcc_courses_done = _count_bcc_required_done(progress_sem)
        bcc_decay_active = bcc_courses_done >= _BCC_DECAY_THRESHOLD

    is_acco_context = _is_acco_major_context(data, track_id)
    parent_type_map = _build_parent_type_map(data)
    bucket_track_required_map = _build_bucket_track_required_map(data, track_id)
    bucket_parent_map = _build_bucket_parent_map(data, track_id)
    ranked_sem = sorted(
        non_manual_sem,
        key=lambda c: (
            _bucket_hierarchy_tier_v2(
                c,
                parent_type_map,
                bucket_track_required_map,
                bucket_parent_map,
                bcc_decay_active,
            ),
            _accc_major_required_rank(c, is_acco_context),
            0 if c["course_code"] in core_prereq_blockers_sem else 1,
            -len(get_direct_unlocks(c["course_code"], reverse_map, limit=50)),
            _soft_tag_demote_penalty(c),
            -c.get("multi_bucket_score", 0),
            c.get("prereq_level", 0),
            c["course_code"],
        ),
    )
    # Greedy selection that respects bucket capacity and spreads courses
    # across semesters (base cap _MAX_PER_BUCKET_PER_SEM picks per bucket).
    # The cap auto-relaxes when viable unmet buckets are too few to satisfy
    # requested recommendation count.
    selected_sem = []
    selection_bucket_meta = _build_selection_bucket_meta(data, track_id)
    allowed_pairs = get_allowed_double_count_pairs(
        data.get("buckets_df", pd.DataFrame()),
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )
    virtual_remaining = {
        bid: rem.get("slots_remaining", 0)
        for bid, rem in alloc["remaining"].items()
    }
    virtual_remaining_snapshot = dict(virtual_remaining) if debug else {}
    picks_per_bucket: dict[str, int] = {}
    cap_relaxed = False
    skipped_reasons: dict[str, str] = {}
    for idx, cand in enumerate(ranked_sem):
        if len(selected_sem) >= max_recs:
            if debug:
                skipped_reasons[cand["course_code"]] = "max_recs reached"
            break

        remaining_slots_to_fill = max_recs - len(selected_sem)
        remaining_candidates = ranked_sem[idx:]
        viable_unmet_buckets: set[str] = set()
        for rc in remaining_candidates:
            viable_unmet_buckets.update(
                _select_assignable_buckets_allocator_style(
                    rc.get("fills_buckets", []),
                    virtual_remaining,
                    picks_per_bucket,
                    enforce_bucket_cap=True,
                    max_per_bucket=_MAX_PER_BUCKET_PER_SEM,
                    allowed_pairs=allowed_pairs,
                    bucket_meta=selection_bucket_meta,
                )
            )
        if (not cap_relaxed) and (len(viable_unmet_buckets) < remaining_slots_to_fill):
            cap_relaxed = True
        enforce_bucket_cap = not cap_relaxed

        cand_buckets = cand.get("fills_buckets", [])
        assigned_buckets = _select_assignable_buckets_allocator_style(
            cand_buckets,
            virtual_remaining,
            picks_per_bucket,
            enforce_bucket_cap=enforce_bucket_cap,
            max_per_bucket=_MAX_PER_BUCKET_PER_SEM,
            allowed_pairs=allowed_pairs,
            bucket_meta=selection_bucket_meta,
        )
        if not assigned_buckets:
            if debug:
                skipped_reasons[cand["course_code"]] = "no assignable buckets (capacity full or diversity cap)"
            continue
        selected_sem.append(cand)
        for bid in assigned_buckets:
            if virtual_remaining.get(bid, 0) > 0:
                consume = _bucket_virtual_consumption_units(
                    bid,
                    cand,
                    selection_bucket_meta,
                )
                virtual_remaining[bid] = max(0, virtual_remaining[bid] - consume)
                picks_per_bucket[bid] = picks_per_bucket.get(bid, 0) + 1
    for cand in selected_sem:
        cand["tier"] = _bucket_hierarchy_tier_v2(
            cand,
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
            bcc_decay_active,
        )
        cand["unlocks"] = get_direct_unlocks(cand["course_code"], reverse_map, limit=3)

    recommendations_sem = _build_deterministic_recommendations(selected_sem, len(selected_sem))

    elective_bucket_ids = get_buckets_by_role(data["buckets_df"], track_id, "elective")
    if elective_bucket_ids:
        elective_courses = data["course_bucket_map_df"][
            (data["course_bucket_map_df"]["track_id"] == track_id)
            & (data["course_bucket_map_df"]["bucket_id"].isin(elective_bucket_ids))
        ]["course_code"].tolist()
    else:
        elective_courses = []
    blocking_sem = get_blocking_warnings(
        core_remaining_sem,
        reverse_map,
        elective_courses,
        completed,
        in_progress,
        threshold=BLOCKING_WARNING_THRESHOLD,
    )

    in_progress_note_sem = None
    if any("in progress" in (r.get("prereq_check") or "") for r in recommendations_sem):
        in_progress_note_sem = "Prerequisites satisfied via in-progress courses assume successful completion."

    selected_codes = [r["course_code"] for r in recommendations_sem if r.get("course_code")]
    projected_progress_sem = _build_projected_outputs(
        completed,
        in_progress,
        selected_codes,
        data,
        track_id,
    )

    result = {
        "target_semester": target_semester_label,
        "recommendations": recommendations_sem,
        "requested_recommendations": max_recs,
        "eligible_count": eligible_count_sem,
        "input_completed_count": len(completed),
        "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
        "in_progress_note": in_progress_note_sem,
        "blocking_warnings": blocking_sem,
        "progress": progress_sem,
        "manual_review_courses": manual_review_sem,
        "projected_progress": projected_progress_sem,
        "projection_note": _PROJECTION_NOTE,
    }
    if debug:
        selected_code_set = {r["course_code"] for r in recommendations_sem}
        result["debug"] = _build_debug_trace(
            ranked_sem,
            selected_code_set,
            skipped_reasons,
            parent_type_map,
            bucket_track_required_map,
            bucket_parent_map,
            is_acco_context,
            core_prereq_blockers_sem,
            reverse_map,
            virtual_remaining_snapshot,
            debug_limit=debug_limit,
            bcc_decay_active=bcc_decay_active,
        )
    return result
