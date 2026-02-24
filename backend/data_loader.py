import re

import pandas as pd

from prereq_parser import parse_prereqs


_BOOL_TRUTHY = {"true", "1", "yes", "y"}
_REQUIRED_V2_SHEETS = {
    "programs",
    "buckets",
    "sub_buckets",
}
_REQUIRED_PARENT_CHILD_SHEETS = {
    "parent_buckets",
    "child_buckets",
}
_CANONICAL_MAP_SHEET = "master_bucket_courses"
_LEGACY_CANONICAL_MAP_SHEET = "courses_all_buckets"
_LEGACY_MAP_SHEET = "course_sub_buckets"
_DEFAULT_POLICY_COLUMNS = [
    "program_id",
    "sub_bucket_id_a",
    "sub_bucket_id_b",
    "allow_double_count",
    "reason",
]

_TERM_CODE_RE = re.compile(r"^(?P<year>\d{4})(?P<term>FA|SP|SU)$", re.IGNORECASE)
_SEMESTER_LABEL_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)
_ELECTIVE_PURGE_PATTERNS = ("ELEC", "BUS_ELEC", "ELECTIVE")
_ELECTIVE_PURGE_RE = re.compile("|".join(re.escape(p) for p in _ELECTIVE_PURGE_PATTERNS), re.IGNORECASE)
_DYNAMIC_ELECTIVE_POOL_TAG = "biz_elective"


def _safe_bool_col(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """Normalize a boolean-like column to Python bool."""

    def _coerce(x):
        if pd.isna(x):
            return False
        if isinstance(x, bool):
            return x
        if isinstance(x, (int, float)):
            return bool(x)
        return str(x).strip().lower() in _BOOL_TRUTHY

    if col in df.columns:
        df[col] = df[col].apply(_coerce)
    return df


def _normalize_programs_df(programs_df: pd.DataFrame) -> pd.DataFrame:
    out = programs_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "program_label" not in out.columns:
        out["program_label"] = out["program_id"]
    if "kind" not in out.columns:
        out["kind"] = "major"
    if "parent_major_id" not in out.columns:
        out["parent_major_id"] = ""
    if "active" not in out.columns:
        out["active"] = False
    if "requires_primary_major" not in out.columns:
        out["requires_primary_major"] = False
    if "applies_to_all" not in out.columns:
        out["applies_to_all"] = False

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["program_label"] = out["program_label"].fillna("").astype(str).str.strip()
    out["kind"] = out["kind"].fillna("major").astype(str).str.strip().str.lower()
    out["kind"] = out["kind"].where(out["kind"].isin({"major", "track"}), "major")
    out["parent_major_id"] = out["parent_major_id"].fillna("").astype(str).str.strip().str.upper()

    # If only one major exists, auto-parent orphan track rows to that major.
    major_ids = [
        str(row["program_id"]).strip().upper()
        for _, row in out[out["kind"] == "major"].iterrows()
        if str(row["program_id"]).strip()
    ]
    if len(major_ids) == 1:
        lone_major = major_ids[0]
        missing_parent = (out["kind"] == "track") & (out["parent_major_id"] == "")
        out.loc[missing_parent, "parent_major_id"] = lone_major
    out.loc[out["kind"] == "major", "parent_major_id"] = ""

    out = _safe_bool_col(out, "active")
    out = _safe_bool_col(out, "requires_primary_major")
    out = _safe_bool_col(out, "applies_to_all")
    return out[
        [
            "program_id",
            "program_label",
            "kind",
            "parent_major_id",
            "active",
            "requires_primary_major",
            "applies_to_all",
        ]
    ]


def _normalize_v2_buckets_df(v2_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = v2_buckets_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "bucket_id" not in out.columns:
        out["bucket_id"] = ""
    if "bucket_label" not in out.columns:
        out["bucket_label"] = out["bucket_id"]
    if "priority" not in out.columns:
        out["priority"] = 99
    if "track_required" not in out.columns:
        out["track_required"] = ""
    if "double_count_family_id" not in out.columns:
        out["double_count_family_id"] = ""
    if "active" not in out.columns:
        out["active"] = True

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["bucket_id"] = out["bucket_id"].fillna("").astype(str).str.strip()
    out["bucket_label"] = out["bucket_label"].fillna("").astype(str).str.strip()
    out["track_required"] = out["track_required"].fillna("").astype(str).str.strip().str.upper()
    out["double_count_family_id"] = (
        out["double_count_family_id"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )
    missing_family = out["double_count_family_id"] == ""
    if missing_family.any():
        out.loc[missing_family, "double_count_family_id"] = (
            out.loc[missing_family, "bucket_id"].astype(str).str.upper()
        )
    out["priority"] = pd.to_numeric(out["priority"], errors="coerce").fillna(99).astype(int)
    out = _safe_bool_col(out, "active")
    return out


def _normalize_v2_sub_buckets_df(v2_sub_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = v2_sub_buckets_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "bucket_id" not in out.columns:
        out["bucket_id"] = ""
    if "sub_bucket_id" not in out.columns:
        out["sub_bucket_id"] = ""
    if "sub_bucket_label" not in out.columns:
        out["sub_bucket_label"] = out["sub_bucket_id"]
    if "priority" not in out.columns:
        out["priority"] = None
    if "role" not in out.columns:
        out["role"] = ""
    if "requirement_mode" not in out.columns:
        out["requirement_mode"] = ""

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["bucket_id"] = out["bucket_id"].fillna("").astype(str).str.strip()
    out["sub_bucket_id"] = out["sub_bucket_id"].fillna("").astype(str).str.strip()
    out["sub_bucket_label"] = out["sub_bucket_label"].fillna("").astype(str).str.strip()
    # Keep NaN for missing values so runtime can derive sensible defaults
    # from parent bucket priority + role ordering.
    out["priority"] = pd.to_numeric(out["priority"], errors="coerce")
    out["role"] = out["role"].fillna("").astype(str).str.strip()
    if "min_level" in out.columns:
        out["min_level"] = pd.to_numeric(out["min_level"], errors="coerce")
    if "courses_required" in out.columns:
        out["courses_required"] = pd.to_numeric(out["courses_required"], errors="coerce")
    if "credits_required" in out.columns:
        out["credits_required"] = pd.to_numeric(out["credits_required"], errors="coerce")
    out["requirement_mode"] = out["requirement_mode"].fillna("").astype(str).str.strip().str.lower()
    missing_mode = out["requirement_mode"] == ""
    if missing_mode.any():
        out.loc[missing_mode, "requirement_mode"] = out.loc[missing_mode].apply(
            lambda r: _map_role_to_requirement_mode(
                r.get("role", ""),
                r.get("courses_required"),
                r.get("credits_required"),
            ),
            axis=1,
        )
    out["requirement_mode"] = out["requirement_mode"].where(
        out["requirement_mode"].isin({"required", "choose_n", "credits_pool"}),
        "required",
    )
    empty_role = out["role"].fillna("").astype(str).str.strip() == ""
    if empty_role.any():
        out.loc[empty_role, "role"] = out.loc[empty_role, "requirement_mode"].map(_map_requirement_mode_to_role)
    return out


def _normalize_v2_courses_all_buckets_df(v2_map_df: pd.DataFrame) -> pd.DataFrame:
    out = v2_map_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "sub_bucket_id" not in out.columns:
        out["sub_bucket_id"] = ""
    if "course_code" not in out.columns:
        out["course_code"] = ""
    if "notes" not in out.columns:
        out["notes"] = ""

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["sub_bucket_id"] = out["sub_bucket_id"].fillna("").astype(str).str.strip()
    out["course_code"] = out["course_code"].fillna("").astype(str).str.strip()
    out["notes"] = out["notes"].fillna("").astype(str)
    return out


def _normalize_parent_buckets_df(parent_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = parent_buckets_df.copy()
    if "parent_bucket_id" not in out.columns:
        out["parent_bucket_id"] = ""
    if "parent_bucket_label" not in out.columns:
        out["parent_bucket_label"] = out["parent_bucket_id"]
    if "type" not in out.columns:
        out["type"] = "major"
    if "parent_major" not in out.columns:
        out["parent_major"] = ""
    if "active" not in out.columns:
        out["active"] = True
    if "requires_primary_major" not in out.columns:
        out["requires_primary_major"] = False
    if "double_count_family_id" not in out.columns:
        out["double_count_family_id"] = ""

    out["parent_bucket_id"] = out["parent_bucket_id"].fillna("").astype(str).str.strip().str.upper()
    out["parent_bucket_label"] = out["parent_bucket_label"].fillna("").astype(str).str.strip()
    out["type"] = out["type"].fillna("major").astype(str).str.strip().str.lower()
    out["type"] = out["type"].where(
        out["type"].isin({"major", "track", "minor", "universal"}),
        "major",
    )
    out["parent_major"] = out["parent_major"].fillna("").astype(str).str.strip().str.upper()
    out["double_count_family_id"] = (
        out["double_count_family_id"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )
    missing_family = out["double_count_family_id"] == ""
    if missing_family.any():
        out.loc[missing_family, "double_count_family_id"] = out.loc[missing_family, "parent_bucket_id"]
    out = _safe_bool_col(out, "active")
    out = _safe_bool_col(out, "requires_primary_major")

    # Normalize parent linkage by type.
    out.loc[out["type"].isin({"major", "universal"}), "parent_major"] = ""
    return out[
        [
            "parent_bucket_id",
            "parent_bucket_label",
            "type",
            "parent_major",
            "active",
            "requires_primary_major",
            "double_count_family_id",
        ]
    ]


def _normalize_child_buckets_df(child_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = child_buckets_df.copy()
    if "parent_bucket_id" not in out.columns:
        out["parent_bucket_id"] = ""
    if "child_bucket_id" not in out.columns:
        out["child_bucket_id"] = ""
    if "child_bucket_label" not in out.columns:
        out["child_bucket_label"] = out["child_bucket_id"]
    if "requirement_mode" not in out.columns:
        out["requirement_mode"] = "required"
    if "courses_required" not in out.columns:
        out["courses_required"] = None
    if "credits_required" not in out.columns:
        out["credits_required"] = None
    if "min_level" not in out.columns:
        out["min_level"] = None
    if "notes" not in out.columns:
        out["notes"] = ""

    out["parent_bucket_id"] = out["parent_bucket_id"].fillna("").astype(str).str.strip().str.upper()
    out["child_bucket_id"] = out["child_bucket_id"].fillna("").astype(str).str.strip().str.upper()
    out["child_bucket_label"] = out["child_bucket_label"].fillna("").astype(str).str.strip()
    out["requirement_mode"] = out["requirement_mode"].fillna("required").astype(str).str.strip().str.lower()
    out["requirement_mode"] = out["requirement_mode"].where(
        out["requirement_mode"].isin({"required", "choose_n", "credits_pool"}),
        "required",
    )
    out["courses_required"] = pd.to_numeric(out["courses_required"], errors="coerce")
    out["credits_required"] = pd.to_numeric(out["credits_required"], errors="coerce")
    out["min_level"] = pd.to_numeric(out["min_level"], errors="coerce")
    out["notes"] = out["notes"].fillna("").astype(str)
    return out[
        [
            "parent_bucket_id",
            "child_bucket_id",
            "child_bucket_label",
            "requirement_mode",
            "courses_required",
            "credits_required",
            "min_level",
            "notes",
        ]
    ]


def _normalize_master_bucket_courses_df(master_df: pd.DataFrame) -> pd.DataFrame:
    out = master_df.copy()
    if "parent_bucket_id" not in out.columns:
        out["parent_bucket_id"] = ""
    if "child_bucket_id" not in out.columns:
        out["child_bucket_id"] = ""
    if "course_code" not in out.columns:
        out["course_code"] = ""
    if "notes" not in out.columns:
        out["notes"] = ""

    out["parent_bucket_id"] = out["parent_bucket_id"].fillna("").astype(str).str.strip().str.upper()
    out["child_bucket_id"] = out["child_bucket_id"].fillna("").astype(str).str.strip().str.upper()
    out["course_code"] = out["course_code"].fillna("").astype(str).str.strip()
    out["notes"] = out["notes"].fillna("").astype(str)
    return out[
        [
            "parent_bucket_id",
            "child_bucket_id",
            "course_code",
            "notes",
        ]
    ]


def _purge_elective_mappings(
    child_buckets_df: pd.DataFrame,
    master_bucket_courses_df: pd.DataFrame,
) -> tuple[pd.DataFrame, int]:
    """
    Remove master mappings for elective-like child buckets.

    Deletion targeting is keyed by child_bucket_id and matches the configured
    elective patterns case-insensitively.
    """
    child_ids = (
        child_buckets_df.get("child_bucket_id", pd.Series(dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )
    purge_ids = set(child_ids[child_ids.str.contains(_ELECTIVE_PURGE_RE, na=False)].tolist())
    map_child_ids = (
        master_bucket_courses_df.get("child_bucket_id", pd.Series(dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )
    purge_mask = map_child_ids.str.contains(_ELECTIVE_PURGE_RE, na=False)
    if purge_ids:
        purge_mask = purge_mask | map_child_ids.isin(purge_ids)
    removed = int(purge_mask.sum())
    return master_bucket_courses_df.loc[~purge_mask].copy(), removed


def _map_requirement_mode_to_role(requirement_mode: str) -> str:
    mode = str(requirement_mode or "").strip().lower()
    if mode == "required":
        return "core"
    if mode in {"choose_n", "credits_pool"}:
        return "elective"
    return ""


def _map_role_to_requirement_mode(role: str, courses_required, credits_required) -> str:
    role_norm = str(role or "").strip().lower()
    if pd.notna(credits_required) and float(credits_required) > 0:
        return "credits_pool"
    if role_norm == "core":
        return "required"
    if role_norm == "elective":
        return "choose_n"
    if pd.notna(courses_required) and float(courses_required) > 0:
        return "choose_n"
    return "required"


def _convert_parent_child_model_to_v2(
    parent_buckets_df: pd.DataFrame,
    child_buckets_df: pd.DataFrame,
    master_bucket_courses_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Convert parent/child schema into V2-compatible frames consumed by runtime.
    """
    pb = _normalize_parent_buckets_df(parent_buckets_df)
    cb = _normalize_child_buckets_df(child_buckets_df)
    mbc = _normalize_master_bucket_courses_df(master_bucket_courses_df)

    # Build V2 programs from parent buckets.
    programs_rows = []
    parent_meta: dict[str, dict] = {}
    for _, row in pb.iterrows():
        pid = str(row["parent_bucket_id"]).strip().upper()
        ptype = str(row.get("type", "major") or "major").strip().lower()
        parent_major = str(row.get("parent_major", "") or "").strip().upper()
        family = str(row.get("double_count_family_id", "") or "").strip().upper()
        active = bool(row.get("active", True))
        req_primary = bool(row.get("requires_primary_major", False))
        is_universal = ptype == "universal"

        kind = "track" if ptype in {"track", "minor"} else "major"
        program_parent = parent_major if kind == "track" else ""
        programs_rows.append(
            {
                "program_id": pid,
                "program_label": str(row.get("parent_bucket_label", pid) or pid).strip(),
                "kind": kind,
                "parent_major_id": program_parent,
                "active": active,
                "requires_primary_major": req_primary,
                "applies_to_all": is_universal,
            }
        )
        parent_meta[pid] = {
            "type": ptype,
            "parent_major": parent_major,
            "double_count_family_id": family or pid,
            "label": str(row.get("parent_bucket_label", pid) or pid).strip(),
            "active": active,
        }
    programs_df = _normalize_programs_df(pd.DataFrame(programs_rows))

    # Build V2 buckets by projecting each parent bucket into its owning major scope.
    bucket_rows: list[dict] = []
    child_rows: list[dict] = []
    map_rows: list[dict] = []
    parent_owner: dict[str, tuple[str, str]] = {}

    for parent_id, meta in parent_meta.items():
        ptype = meta["type"]
        parent_major = meta["parent_major"]
        family = str(meta.get("double_count_family_id", "") or "").strip().upper() or parent_id
        active = bool(meta["active"])
        label = str(meta["label"] or parent_id)

        if ptype in {"track", "minor"}:
            owner_program = parent_major or parent_id
            track_required = parent_id
            if not parent_major:
                print(
                    "[WARN] parent_buckets row for "
                    f"'{parent_id}' has type='{ptype}' but empty parent_major. "
                    "Track selection linkage may be incomplete."
                )
        else:
            owner_program = parent_id
            track_required = ""

        parent_owner[parent_id] = (owner_program, track_required)
        bucket_rows.append(
            {
                "program_id": owner_program,
                "bucket_id": parent_id,
                "bucket_label": label,
                # Parent-tier priority only: BCC/MCC first, all others equal.
                "priority": 1 if parent_id in {"BCC_CORE", "MCC_CORE", "MCC_FOUNDATION"} else 2,
                "track_required": track_required,
                "double_count_family_id": family,
                "active": active,
            }
        )

    child_lookup: dict[tuple[str, str], tuple[str, str]] = {}
    for _, row in cb.iterrows():
        parent_id = str(row.get("parent_bucket_id", "") or "").strip().upper()
        if not parent_id:
            continue
        owner_program, track_required = parent_owner.get(parent_id, (parent_id, ""))
        child_id = str(row.get("child_bucket_id", "") or "").strip().upper()
        if not child_id:
            continue
        mode = str(row.get("requirement_mode", "required") or "required").strip().lower()
        courses_required = row.get("courses_required")
        credits_required = row.get("credits_required")
        child_rows.append(
            {
                "program_id": owner_program,
                "bucket_id": parent_id,
                "sub_bucket_id": child_id,
                "sub_bucket_label": str(row.get("child_bucket_label", child_id) or child_id).strip(),
                "courses_required": courses_required,
                "credits_required": credits_required,
                "min_level": row.get("min_level"),
                "role": _map_requirement_mode_to_role(mode),
                "requirement_mode": mode,
                # Priority intentionally omitted (NaN) so runtime derives deterministic order.
                "priority": None,
                "notes": str(row.get("notes", "") or "").strip(),
            }
        )
        child_lookup[(parent_id, child_id)] = (owner_program, track_required)

    for _, row in mbc.iterrows():
        parent_id = str(row.get("parent_bucket_id", "") or "").strip().upper()
        child_id = str(row.get("child_bucket_id", "") or "").strip().upper()
        if not parent_id or not child_id:
            continue
        owner_program, _ = child_lookup.get((parent_id, child_id), parent_owner.get(parent_id, (parent_id, "")))
        map_rows.append(
            {
                "program_id": owner_program,
                "sub_bucket_id": child_id,
                "course_code": str(row.get("course_code", "") or "").strip(),
                "notes": str(row.get("notes", "") or "").strip(),
            }
        )

    v2_buckets_df = _normalize_v2_buckets_df(pd.DataFrame(bucket_rows))
    v2_sub_buckets_df = _normalize_v2_sub_buckets_df(pd.DataFrame(child_rows))
    v2_courses_all_buckets_df = _normalize_v2_courses_all_buckets_df(pd.DataFrame(map_rows))

    return programs_df, v2_buckets_df, v2_sub_buckets_df, v2_courses_all_buckets_df


def _build_tracks_from_programs(programs_df: pd.DataFrame) -> pd.DataFrame:
    if programs_df is None or len(programs_df) == 0:
        return pd.DataFrame(
            columns=[
                "track_id",
                "track_label",
                "active",
                "kind",
                "parent_major_id",
                "requires_primary_major",
                "applies_to_all",
            ]
        )

    requires_primary_series = (
        programs_df["requires_primary_major"]
        if "requires_primary_major" in programs_df.columns
        else pd.Series([False] * len(programs_df), index=programs_df.index)
    )

    tracks_df = pd.DataFrame(
        {
            "track_id": programs_df["program_id"].astype(str).str.strip().str.upper(),
            "track_label": programs_df["program_label"].fillna("").astype(str).str.strip(),
            "active": programs_df["active"].apply(lambda v: bool(v) if pd.notna(v) else False),
            "kind": programs_df["kind"].fillna("major").astype(str).str.strip().str.lower(),
            "parent_major_id": programs_df["parent_major_id"].fillna("").astype(str).str.strip().str.upper(),
            "requires_primary_major": requires_primary_series.apply(lambda v: bool(v) if pd.notna(v) else False),
            "applies_to_all": programs_df.get("applies_to_all", False).apply(
                lambda v: bool(v) if pd.notna(v) else False
            ),
        }
    )
    tracks_df = tracks_df[tracks_df["track_id"] != ""]
    tracks_df["kind"] = tracks_df["kind"].where(
        tracks_df["kind"].isin({"major", "track"}),
        "major",
    )
    tracks_df.loc[tracks_df["kind"] == "major", "parent_major_id"] = ""
    return tracks_df[
        [
            "track_id",
            "track_label",
            "active",
            "kind",
            "parent_major_id",
            "requires_primary_major",
            "applies_to_all",
        ]
    ]


def _overlay_course_prereqs(courses_df: pd.DataFrame, prereqs_df: pd.DataFrame) -> pd.DataFrame:
    """Overlay V2 course_prereqs onto runtime prereq fields."""
    if len(prereqs_df) == 0:
        return courses_df

    src = prereqs_df.copy()
    if "course_code" not in src.columns:
        return courses_df
    src["course_code"] = src["course_code"].fillna("").astype(str).str.strip()
    src = src[src["course_code"] != ""]

    out = courses_df.copy()
    if "prereq_hard" not in out.columns:
        out["prereq_hard"] = "none"
    if "prereq_soft" not in out.columns:
        out["prereq_soft"] = ""
    if "prereq_concurrent" not in out.columns:
        out["prereq_concurrent"] = "none"
    if "prereq_level" not in out.columns:
        out["prereq_level"] = None
    if "warning_text" not in out.columns:
        out["warning_text"] = ""

    src_idx = src.set_index("course_code")
    if "prerequisites" in src_idx.columns:
        out["prereq_hard"] = out["course_code"].map(src_idx["prerequisites"]).fillna(out["prereq_hard"])
    if "prereq_warnings" in src_idx.columns:
        out["prereq_soft"] = out["course_code"].map(src_idx["prereq_warnings"]).fillna(out["prereq_soft"])
    if "concurrent_with" in src_idx.columns:
        out["prereq_concurrent"] = out["course_code"].map(src_idx["concurrent_with"]).fillna(out["prereq_concurrent"])
    if "min_standing" in src_idx.columns:
        out["prereq_level"] = out["course_code"].map(src_idx["min_standing"]).fillna(out["prereq_level"])
    if "warning_text" in src_idx.columns:
        out["warning_text"] = out["course_code"].map(src_idx["warning_text"]).fillna(out["warning_text"])

    out["prereq_hard"] = out["prereq_hard"].fillna("none").astype(str)
    out["prereq_soft"] = out["prereq_soft"].fillna("").astype(str)
    out["prereq_concurrent"] = out["prereq_concurrent"].fillna("none").astype(str)
    out["warning_text"] = out["warning_text"].fillna("").astype(str)
    return out


def _semester_sort_key(term_label: str) -> tuple[int, int]:
    raw = str(term_label or "").strip()

    code_match = _TERM_CODE_RE.match(raw.upper())
    if code_match:
        year = int(code_match.group("year"))
        season_rank = {"SP": 1, "SU": 2, "FA": 3}.get(code_match.group("term").upper(), 0)
        return (year, season_rank)

    label_match = _SEMESTER_LABEL_RE.match(raw)
    if label_match:
        season = label_match.group(1).strip().lower()
        year = int(label_match.group(2))
        season_rank = {"spring": 1, "summer": 2, "fall": 3}.get(season, 0)
        return (year, season_rank)
    return (-1, -1)


def _term_code_to_label(term_code: str) -> str:
    raw = str(term_code or "").strip().upper()
    match = _TERM_CODE_RE.match(raw)
    if not match:
        return raw
    season_map = {"FA": "Fall", "SP": "Spring", "SU": "Summer"}
    return f"{season_map.get(match.group('term').upper(), match.group('term').upper())} {int(match.group('year'))}"


def _semester_to_season(term_label: str) -> str:
    raw = str(term_label or "").strip().lower()
    if raw.startswith("fall"):
        return "fall"
    if raw.startswith("spring"):
        return "spring"
    if raw.startswith("summer"):
        return "summer"
    return ""


def _offering_confidence_from_frequency(freq: int) -> str:
    if freq >= 3:
        return "high"
    if freq == 2:
        return "medium"
    return "low"


def _normalize_offering_rows(
    offerings_df: pd.DataFrame,
) -> tuple[dict[str, dict[str, bool]], list[str]]:
    """
    Return:
      course_term_map[course_code][semester_label] = offered_bool
      ordered_semesters (chronological ascending)

    Supports both:
      - legacy rows: course_code, term_code, offered
      - wide rows:  course_code, Fall 2025, Spring 2026, ...
    """
    if len(offerings_df) == 0 or "course_code" not in offerings_df.columns:
        return {}, []

    src = offerings_df.copy()
    src["course_code"] = src["course_code"].fillna("").astype(str).str.strip()
    src = src[src["course_code"] != ""]
    if len(src) == 0:
        return {}, []

    course_terms: dict[str, dict[str, bool]] = {}
    ordered_semesters: list[str] = []

    legacy_cols = {c.strip().lower() for c in src.columns}
    if {"term_code", "offered"}.issubset(legacy_cols):
        src["term_code"] = src["term_code"].fillna("").astype(str).str.strip().str.upper()
        src = _safe_bool_col(src, "offered")
        src = src[src["term_code"] != ""]
        src["semester_label"] = src["term_code"].apply(_term_code_to_label)

        for _, row in src.iterrows():
            code = str(row.get("course_code", "")).strip()
            label = str(row.get("semester_label", "")).strip()
            if not code or not label:
                continue
            offered = bool(row.get("offered", False))
            course_terms.setdefault(code, {})
            course_terms[code][label] = course_terms[code].get(label, False) or offered
        ordered_semesters = sorted(
            {str(v).strip() for v in src["semester_label"].tolist() if str(v).strip()},
            key=_semester_sort_key,
        )
        return course_terms, ordered_semesters

    semester_cols = [
        c for c in src.columns
        if _semester_sort_key(c) != (-1, -1) and c != "course_code"
    ]
    semester_cols = sorted(semester_cols, key=_semester_sort_key)
    if not semester_cols:
        return {}, []

    for col in semester_cols:
        src[col] = src[col].apply(
            lambda v: False if pd.isna(v) else (
                v if isinstance(v, bool) else str(v).strip().lower() in {"1", "true", "yes", "y"}
            )
        )

    for _, row in src.iterrows():
        code = str(row.get("course_code", "")).strip()
        if not code:
            continue
        course_terms.setdefault(code, {})
        for sem_col in semester_cols:
            course_terms[code][sem_col] = bool(row.get(sem_col, False))
    return course_terms, semester_cols


def _overlay_course_offerings(courses_df: pd.DataFrame, offerings_df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive offered_fall/spring/summer + confidence + last_four_terms from course_offerings.

    confidence derivation (last 3 semesters):
      - 3 offered: high
      - 2 offered: medium
      - 0/1 offered: low
    """
    course_terms, ordered_semesters = _normalize_offering_rows(offerings_df)
    if not course_terms:
        return courses_df

    out = courses_df.copy()
    for col in ("offered_fall", "offered_spring", "offered_summer", "offering_confidence", "last_four_terms"):
        if col not in out.columns:
            out[col] = None

    offered_fall: dict[str, bool] = {}
    offered_spring: dict[str, bool] = {}
    offered_summer: dict[str, bool] = {}
    conf_map: dict[str, str] = {}
    terms_map: dict[str, str] = {}
    offering_freq: dict[str, int] = {}

    latest_three = list(sorted(ordered_semesters, key=_semester_sort_key, reverse=True)[:3])
    latest_four = list(sorted(ordered_semesters, key=_semester_sort_key, reverse=True)[:4])

    for code, sem_map in course_terms.items():
        offered_semesters = [s for s, offered in sem_map.items() if offered]
        seasons = [_semester_to_season(s) for s in offered_semesters]
        offered_fall[code] = "fall" in seasons
        offered_spring[code] = "spring" in seasons
        offered_summer[code] = "summer" in seasons

        freq = sum(1 for sem in latest_three if sem_map.get(sem, False))
        offering_freq[code] = int(freq)
        conf_map[code] = _offering_confidence_from_frequency(freq)

        shown = [sem for sem in latest_four if sem_map.get(sem, False)]
        terms_map[code] = ", ".join(shown)

    out["offered_fall"] = out["course_code"].map(offered_fall).fillna(out["offered_fall"])
    out["offered_spring"] = out["course_code"].map(offered_spring).fillna(out["offered_spring"])
    out["offered_summer"] = out["course_code"].map(offered_summer).fillna(out["offered_summer"])
    out["offering_confidence"] = out["course_code"].map(conf_map).fillna(out["offering_confidence"])
    out["last_four_terms"] = out["course_code"].map(terms_map).fillna(out["last_four_terms"])
    out["offering_freq_last3"] = out["course_code"].map(offering_freq).fillna(0).astype(int)
    return out


def _local_bucket_id(bucket_id: str) -> str:
    raw = str(bucket_id or "").strip()
    if "::" in raw:
        return raw.split("::", 1)[1]
    return raw


def _dynamic_elective_bucket_mask(buckets_df: pd.DataFrame) -> pd.Series:
    mode = (
        buckets_df.get("requirement_mode", pd.Series(dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )
    local_id = buckets_df.get("bucket_id", pd.Series(dtype=str)).apply(_local_bucket_id).astype(str).str.upper()
    return (mode == "credits_pool") & local_id.str.contains(_ELECTIVE_PURGE_RE, na=False)


def _synthesize_dynamic_elective_pool_mappings(
    courses_df: pd.DataFrame,
    buckets_df: pd.DataFrame,
    course_bucket_map_df: pd.DataFrame,
) -> tuple[pd.DataFrame, int]:
    """
    Build dynamic mappings for credits_pool elective buckets from tagged courses.

    Scope:
      - runtime bucket requirement_mode == credits_pool
      - local child bucket id contains ELEC|BUS_ELEC|ELECTIVE
      - courses.elective_pool_tag == _DYNAMIC_ELECTIVE_POOL_TAG
      - bucket min_level filter is respected
    """
    if len(buckets_df) == 0:
        return course_bucket_map_df, 0
    if "elective_pool_tag" not in courses_df.columns:
        return course_bucket_map_df, 0
    if "course_code" not in courses_df.columns:
        return course_bucket_map_df, 0

    dynamic_buckets = buckets_df[_dynamic_elective_bucket_mask(buckets_df)].copy()
    if len(dynamic_buckets) == 0:
        return course_bucket_map_df, 0

    tagged = courses_df.copy()
    tagged["course_code"] = tagged["course_code"].fillna("").astype(str).str.strip()
    tagged["elective_pool_tag"] = (
        tagged["elective_pool_tag"]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )
    tagged["level"] = pd.to_numeric(tagged.get("level"), errors="coerce")
    tagged = tagged[
        (tagged["course_code"] != "")
        & (tagged["elective_pool_tag"] == _DYNAMIC_ELECTIVE_POOL_TAG)
    ][["course_code", "level"]].drop_duplicates()
    if len(tagged) == 0:
        return course_bucket_map_df, 0

    new_rows: list[dict] = []
    for _, bucket in dynamic_buckets.iterrows():
        track_id = str(bucket.get("track_id", "") or "").strip().upper()
        bucket_id = str(bucket.get("bucket_id", "") or "").strip()
        if not track_id or not bucket_id:
            continue

        min_level = pd.to_numeric(bucket.get("min_level"), errors="coerce")
        eligible = tagged
        if pd.notna(min_level):
            eligible = eligible[eligible["level"].fillna(-1) >= float(min_level)]
        if len(eligible) == 0:
            continue

        for course_code in eligible["course_code"].tolist():
            new_rows.append(
                {
                    "track_id": track_id,
                    "course_code": str(course_code).strip(),
                    "bucket_id": bucket_id,
                    "notes": f"dynamic:elective_pool_tag={_DYNAMIC_ELECTIVE_POOL_TAG}",
                }
            )

    if not new_rows:
        return course_bucket_map_df, 0

    synthesized_df = pd.DataFrame(new_rows)
    merged = pd.concat([course_bucket_map_df.copy(), synthesized_df], ignore_index=True)
    merged = merged.drop_duplicates(subset=["track_id", "bucket_id", "course_code"], keep="first")
    return merged, len(synthesized_df)


def _derive_runtime_from_v2(
    v2_buckets_df: pd.DataFrame,
    v2_sub_buckets_df: pd.DataFrame,
    v2_courses_all_buckets_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build runtime-compatible buckets/map from V2 model."""
    if len(v2_sub_buckets_df) == 0:
        empty_b = pd.DataFrame(
            columns=[
                "track_id",
                "bucket_id",
                "bucket_label",
                "priority",
                "needed_count",
                "needed_credits",
                "min_level",
                "role",
                "requirement_mode",
                "parent_bucket_id",
                "parent_bucket_label",
                "double_count_family_id",
                "track_required",
            ]
        )
        empty_m = pd.DataFrame(columns=["track_id", "course_code", "bucket_id", "notes"])
        return empty_b, empty_m

    parent_meta = v2_buckets_df[["program_id", "bucket_id", "bucket_label", "track_required"]].copy()
    if "double_count_family_id" in v2_buckets_df.columns:
        parent_meta["double_count_family_id"] = (
            v2_buckets_df["double_count_family_id"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
    else:
        parent_meta["double_count_family_id"] = ""
    missing_family = parent_meta["double_count_family_id"] == ""
    if missing_family.any():
        parent_meta.loc[missing_family, "double_count_family_id"] = (
            parent_meta.loc[missing_family, "bucket_id"]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
    parent_meta = parent_meta.rename(
        columns={
            "bucket_id": "parent_bucket_id",
            "bucket_label": "parent_bucket_label",
        }
    )
    parent_meta["parent_bucket_priority"] = pd.to_numeric(
        v2_buckets_df.get("priority", 99), errors="coerce"
    ).fillna(99).astype(int)

    merged_sub = v2_sub_buckets_df.merge(
        parent_meta,
        left_on=["program_id", "bucket_id"],
        right_on=["program_id", "parent_bucket_id"],
        how="left",
    )
    merged_sub = merged_sub.sort_values(
        by=["program_id", "bucket_id", "sub_bucket_id"],
        kind="stable",
    ).copy()

    # Recommendation hierarchy priority:
    #   1) explicit sub-bucket priority when present
    #   2) derived fallback from parent tier + requirement_mode + stable child order
    requirement_mode = (
        merged_sub.get("requirement_mode", "")
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )
    missing_mode = requirement_mode == ""
    if missing_mode.any():
        role_fallback = (
            merged_sub.get("role", "")
            .fillna("")
            .astype(str)
            .str.strip()
            .str.lower()
        )
        derived_mode = role_fallback.map({"core": "required", "elective": "choose_n"}).fillna("required")
        requirement_mode = requirement_mode.where(~missing_mode, derived_mode)
    requirement_weight = requirement_mode.map(
        {"required": 0, "choose_n": 5, "credits_pool": 6}
    ).fillna(9).astype(int)

    within_parent_index = merged_sub.groupby(["program_id", "bucket_id"]).cumcount()
    parent_priority = pd.to_numeric(
        merged_sub.get("parent_bucket_priority", 99),
        errors="coerce",
    ).fillna(99).astype(int)

    derived_priority = (parent_priority * 100) + (requirement_weight * 10) + within_parent_index
    legacy_priority = pd.to_numeric(
        merged_sub.get("priority"),
        errors="coerce",
    )
    effective_priority = legacy_priority.fillna(derived_priority).astype(int)

    runtime_buckets = pd.DataFrame(
        {
            "track_id": merged_sub["program_id"],
            "bucket_id": merged_sub["sub_bucket_id"],
            "bucket_label": merged_sub["sub_bucket_label"],
            "priority": effective_priority,
            "needed_count": merged_sub.get("courses_required"),
            "needed_credits": merged_sub.get("credits_required"),
            "min_level": merged_sub.get("min_level"),
            "role": requirement_mode.map(_map_requirement_mode_to_role),
            "requirement_mode": requirement_mode,
            "parent_bucket_id": merged_sub["bucket_id"],
            "parent_bucket_label": merged_sub.get("parent_bucket_label", merged_sub["bucket_id"]),
            "double_count_family_id": (
                merged_sub.get("double_count_family_id", merged_sub["bucket_id"])
                .fillna(merged_sub["bucket_id"])
                .astype(str)
                .str.strip()
                .str.upper()
            ),
            "parent_bucket_priority": merged_sub.get("parent_bucket_priority", 99),
            "track_required": merged_sub.get("track_required", "").fillna("").astype(str).str.strip().str.upper(),
        }
    )

    if len(v2_courses_all_buckets_df) == 0:
        runtime_map = pd.DataFrame(columns=["track_id", "course_code", "bucket_id", "notes"])
    else:
        runtime_map = pd.DataFrame(
            {
                "track_id": v2_courses_all_buckets_df["program_id"],
                "course_code": v2_courses_all_buckets_df["course_code"],
                "bucket_id": v2_courses_all_buckets_df["sub_bucket_id"],
                "notes": v2_courses_all_buckets_df.get("notes", "").fillna(""),
            }
        )
    return runtime_buckets, runtime_map


def _load_v2_equivalencies(xl: pd.ExcelFile, sheet_set: set[str]) -> pd.DataFrame:
    if "course_equivalencies" not in sheet_set:
        return pd.DataFrame(columns=["equiv_group_id", "course_code", "label"])

    eq = xl.parse("course_equivalencies")
    if "equiv_group_id" not in eq.columns:
        return pd.DataFrame(columns=["equiv_group_id", "course_code", "label"])
    if "course_code" not in eq.columns:
        eq["course_code"] = ""
    if "course_name" in eq.columns:
        label = eq["course_name"].fillna("").astype(str)
    elif "restriction_note" in eq.columns:
        label = eq["restriction_note"].fillna("").astype(str)
    elif "notes" in eq.columns:
        label = eq["notes"].fillna("").astype(str)
    else:
        label = ""
    out = pd.DataFrame(
        {
            "equiv_group_id": eq["equiv_group_id"],
            "course_code": eq["course_code"],
            "label": label,
        }
    )
    # Normalize program scope column to canonical name for governance validation.
    # The workbook uses 'program_scope'; 'scope_program_id' is the legacy/alt name.
    if "program_scope" in eq.columns:
        out["scope_program_id"] = eq["program_scope"]
    elif "scope_program_id" in eq.columns:
        out["scope_program_id"] = eq["scope_program_id"]
    return out


def load_data(data_path: str) -> dict:
    """Load workbook using parent/child schema or legacy V2 compatibility schema."""
    xl = pd.ExcelFile(data_path)
    sheet_set = set(xl.sheet_names)

    if "courses" not in sheet_set:
        raise ValueError("Workbook must contain a 'courses' sheet.")

    has_parent_child = _REQUIRED_PARENT_CHILD_SHEETS.issubset(sheet_set)
    map_sheet = None

    courses_df = xl.parse("courses")
    parent_buckets_df = pd.DataFrame()
    child_buckets_df = pd.DataFrame()
    master_bucket_courses_df = pd.DataFrame()
    elective_mappings_removed = 0

    if has_parent_child:
        map_sheet = (
            _CANONICAL_MAP_SHEET
            if _CANONICAL_MAP_SHEET in sheet_set
            else _LEGACY_CANONICAL_MAP_SHEET if _LEGACY_CANONICAL_MAP_SHEET in sheet_set
            else _LEGACY_MAP_SHEET if _LEGACY_MAP_SHEET in sheet_set
            else None
        )
        if not map_sheet:
            raise ValueError(
                "Workbook is missing required parent/child map sheet: "
                f"'{_CANONICAL_MAP_SHEET}'."
            )

        parent_buckets_df = _normalize_parent_buckets_df(xl.parse("parent_buckets"))
        child_buckets_df = _normalize_child_buckets_df(xl.parse("child_buckets"))
        if map_sheet == _CANONICAL_MAP_SHEET:
            master_bucket_courses_df = _normalize_master_bucket_courses_df(xl.parse(map_sheet))
        elif map_sheet == _LEGACY_CANONICAL_MAP_SHEET:
            legacy_map = _normalize_v2_courses_all_buckets_df(xl.parse(map_sheet))
            master_bucket_courses_df = _normalize_master_bucket_courses_df(
                legacy_map.rename(
                    columns={
                        "program_id": "parent_bucket_id",
                        "sub_bucket_id": "child_bucket_id",
                    }
                )
            )
        else:
            legacy_map = _normalize_v2_courses_all_buckets_df(xl.parse(map_sheet))
            master_bucket_courses_df = _normalize_master_bucket_courses_df(
                legacy_map.rename(
                    columns={
                        "program_id": "parent_bucket_id",
                        "sub_bucket_id": "child_bucket_id",
                    }
                )
            )

        master_bucket_courses_df, elective_mappings_removed = _purge_elective_mappings(
            child_buckets_df,
            master_bucket_courses_df,
        )

        (
            v2_programs_df,
            v2_buckets_df,
            v2_sub_buckets_df,
            v2_courses_all_buckets_df,
        ) = _convert_parent_child_model_to_v2(
            parent_buckets_df,
            child_buckets_df,
            master_bucket_courses_df,
        )
    else:
        missing_v2 = sorted(_REQUIRED_V2_SHEETS - sheet_set)
        if missing_v2:
            raise ValueError(
                "Workbook is missing required sheet(s): "
                + ", ".join(missing_v2)
            )
        map_sheet = (
            _LEGACY_CANONICAL_MAP_SHEET
            if _LEGACY_CANONICAL_MAP_SHEET in sheet_set
            else _LEGACY_MAP_SHEET if _LEGACY_MAP_SHEET in sheet_set
            else None
        )
        if not map_sheet:
            raise ValueError(
                "Workbook is missing required map sheet: "
                f"'{_CANONICAL_MAP_SHEET}' or '{_LEGACY_CANONICAL_MAP_SHEET}'."
            )

        v2_programs_df = _normalize_programs_df(xl.parse("programs"))
        v2_buckets_df = _normalize_v2_buckets_df(xl.parse("buckets"))
        v2_sub_buckets_df = _normalize_v2_sub_buckets_df(xl.parse("sub_buckets"))
        v2_courses_all_buckets_df = _normalize_v2_courses_all_buckets_df(xl.parse(map_sheet))

    if "double_count_policy" in sheet_set:
        v2_double_count_policy_df = xl.parse("double_count_policy")
    else:
        v2_double_count_policy_df = pd.DataFrame(columns=_DEFAULT_POLICY_COLUMNS)
    if (
        "child_bucket_id_a" in v2_double_count_policy_df.columns
        and "sub_bucket_id_a" not in v2_double_count_policy_df.columns
    ):
        v2_double_count_policy_df = v2_double_count_policy_df.rename(
            columns={
                "child_bucket_id_a": "sub_bucket_id_a",
                "child_bucket_id_b": "sub_bucket_id_b",
            }
        )

    course_prereqs_df = xl.parse("course_prereqs") if "course_prereqs" in sheet_set else pd.DataFrame()
    course_offerings_df = xl.parse("course_offerings") if "course_offerings" in sheet_set else pd.DataFrame()
    courses_df = _overlay_course_prereqs(courses_df, course_prereqs_df)
    courses_df = _overlay_course_offerings(courses_df, course_offerings_df)

    equivalencies_df = _load_v2_equivalencies(xl, sheet_set)
    tracks_df = _build_tracks_from_programs(v2_programs_df)
    buckets_df, course_bucket_map_df = _derive_runtime_from_v2(
        v2_buckets_df,
        v2_sub_buckets_df,
        v2_courses_all_buckets_df,
    )

    # Normalize booleans on course offering flags for runtime consumers.
    for col in ["offered_fall", "offered_spring", "offered_summer"]:
        courses_df = _safe_bool_col(courses_df, col)

    courses_df["course_code"] = courses_df["course_code"].fillna("").astype(str).str.strip()
    courses_df["prereq_hard"] = courses_df.get("prereq_hard", pd.Series(dtype=str)).fillna("none")
    courses_df["prereq_soft"] = courses_df.get("prereq_soft", pd.Series(dtype=str)).fillna("")
    courses_df["warning_text"] = courses_df.get("warning_text", pd.Series(dtype=str)).fillna("")
    courses_df["elective_pool_tag"] = (
        courses_df.get("elective_pool_tag", pd.Series(dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )

    course_bucket_map_df, dynamic_mappings_added = _synthesize_dynamic_elective_pool_mappings(
        courses_df,
        buckets_df,
        course_bucket_map_df,
    )

    # Inject not_frequently_offered tag for courses offered in fewer than 3 of last 3 terms.
    if "offering_freq_last3" in courses_df.columns:
        infrequent_mask = courses_df["offering_freq_last3"] < 3
        for idx in courses_df[infrequent_mask].index:
            existing = str(courses_df.at[idx, "prereq_soft"] or "").strip()
            if "not_frequently_offered" not in existing:
                courses_df.at[idx, "prereq_soft"] = (existing + ";not_frequently_offered").strip(";")
    catalog_codes = set(c for c in courses_df["course_code"].tolist() if c)

    prereq_map: dict = {}
    for _, row in courses_df.iterrows():
        code = row["course_code"]
        prereq_map[code] = parse_prereqs(row.get("prereq_hard", "none"))

    # Startup integrity checks.
    map_codes = set(course_bucket_map_df["course_code"].astype(str).str.strip().tolist())
    orphaned_codes = sorted(map_codes - catalog_codes)
    if orphaned_codes:
        print(
            f"[WARN] {len(orphaned_codes)} course(s) in {map_sheet} not found in courses sheet: "
            f"{orphaned_codes}"
        )

    map_buckets = set(course_bucket_map_df["bucket_id"].astype(str).str.strip().tolist())
    defined_buckets = set(buckets_df["bucket_id"].astype(str).str.strip().tolist())
    orphaned_buckets = sorted(map_buckets - defined_buckets)
    if orphaned_buckets:
        print(
            f"[WARN] {len(orphaned_buckets)} child bucket id(s) in {map_sheet} not found in child/sub-buckets sheet: "
            f"{orphaned_buckets}"
        )

    unsupported = [code for code, p in prereq_map.items() if p["type"] == "unsupported"]
    if unsupported:
        print(
            "[WARN] "
            f"{len(unsupported)} course(s) have unsupported prereq format (manual review required): "
            f"{sorted(unsupported)}"
        )

    if has_parent_child:
        print("[INFO] Loaded parent/child workbook model (with legacy runtime compatibility).")
        if elective_mappings_removed > 0:
            print(
                "[INFO] Purged "
                f"{elective_mappings_removed} elective-like row(s) from master_bucket_courses at load time."
            )
        if dynamic_mappings_added > 0:
            print(
                "[INFO] Added "
                f"{dynamic_mappings_added} dynamic elective-pool mapping row(s) from courses.elective_pool_tag."
            )
    else:
        print("[INFO] Loaded legacy V2 workbook model (compatibility mode).")

    return {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_bucket_map_df,
        "tracks_df": tracks_df,
        "catalog_codes": catalog_codes,
        "prereq_map": prereq_map,
        "v2_detected": True,
        "parent_child_detected": has_parent_child,
        "parent_buckets_df": parent_buckets_df,
        "child_buckets_df": child_buckets_df,
        "master_bucket_courses_df": master_bucket_courses_df,
        "v2_programs_df": v2_programs_df,
        "v2_buckets_df": v2_buckets_df,
        "v2_sub_buckets_df": v2_sub_buckets_df,
        "v2_courses_all_buckets_df": v2_courses_all_buckets_df,
        # Backward-compatible alias for callers not yet migrated.
        "v2_course_sub_buckets_df": v2_courses_all_buckets_df,
        "v2_double_count_policy_df": v2_double_count_policy_df,
    }
