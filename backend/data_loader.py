import pandas as pd

from prereq_parser import parse_prereqs


_BOOL_TRUTHY = {"true", "1", "yes", "y"}
_REQUIRED_V2_SHEETS = {
    "programs",
    "track_definitions",
    "buckets",
    "sub_buckets",
    "course_sub_buckets",
    "double_count_policy",
}


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
    if "active" not in out.columns:
        out["active"] = False

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["program_label"] = out["program_label"].fillna("").astype(str).str.strip()
    out = _safe_bool_col(out, "active")
    return out[["program_id", "program_label", "active"]]


def _normalize_track_definitions_df(track_defs_df: pd.DataFrame) -> pd.DataFrame:
    out = track_defs_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "track_id" not in out.columns:
        out["track_id"] = ""
    if "track_label" not in out.columns:
        out["track_label"] = out["track_id"]
    if "active" not in out.columns:
        out["active"] = False

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["track_id"] = out["track_id"].fillna("").astype(str).str.strip().str.upper()
    out["track_label"] = out["track_label"].fillna("").astype(str).str.strip()
    out = _safe_bool_col(out, "active")
    out = out[out["track_id"] != ""]
    return out[["program_id", "track_id", "track_label", "active"]]


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
    if "active" not in out.columns:
        out["active"] = True

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["bucket_id"] = out["bucket_id"].fillna("").astype(str).str.strip()
    out["bucket_label"] = out["bucket_label"].fillna("").astype(str).str.strip()
    out["track_required"] = out["track_required"].fillna("").astype(str).str.strip().str.upper()
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
        out["priority"] = 99
    if "role" not in out.columns:
        out["role"] = ""

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["bucket_id"] = out["bucket_id"].fillna("").astype(str).str.strip()
    out["sub_bucket_id"] = out["sub_bucket_id"].fillna("").astype(str).str.strip()
    out["sub_bucket_label"] = out["sub_bucket_label"].fillna("").astype(str).str.strip()
    out["priority"] = pd.to_numeric(out["priority"], errors="coerce").fillna(99).astype(int)
    out["role"] = out["role"].fillna("").astype(str).str.strip()
    if "min_level" in out.columns:
        out["min_level"] = pd.to_numeric(out["min_level"], errors="coerce")
    if "courses_required" in out.columns:
        out["courses_required"] = pd.to_numeric(out["courses_required"], errors="coerce")
    if "credits_required" in out.columns:
        out["credits_required"] = pd.to_numeric(out["credits_required"], errors="coerce")
    return out


def _normalize_v2_course_sub_buckets_df(v2_map_df: pd.DataFrame) -> pd.DataFrame:
    out = v2_map_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "sub_bucket_id" not in out.columns:
        out["sub_bucket_id"] = ""
    if "course_code" not in out.columns:
        out["course_code"] = ""
    if "constraints" not in out.columns:
        out["constraints"] = ""
    if "notes" not in out.columns:
        out["notes"] = ""

    out["program_id"] = out["program_id"].fillna("").astype(str).str.strip().str.upper()
    out["sub_bucket_id"] = out["sub_bucket_id"].fillna("").astype(str).str.strip()
    out["course_code"] = out["course_code"].fillna("").astype(str).str.strip()
    out["constraints"] = out["constraints"].fillna("").astype(str)
    out["notes"] = out["notes"].fillna("").astype(str)
    return out


def _build_tracks_from_v2(programs_df: pd.DataFrame, track_defs_df: pd.DataFrame) -> pd.DataFrame:
    major_rows = [
        {
            "track_id": str(row["program_id"]),
            "track_label": str(row["program_label"]),
            "active": bool(row["active"]),
            "kind": "major",
            "parent_major_id": "",
        }
        for _, row in programs_df.iterrows()
        if str(row["program_id"]).strip()
    ]
    track_rows = [
        {
            "track_id": str(row["track_id"]),
            "track_label": str(row["track_label"] or row["track_id"]),
            "active": bool(row["active"]),
            "kind": "track",
            "parent_major_id": str(row["program_id"]),
        }
        for _, row in track_defs_df.iterrows()
        if str(row["track_id"]).strip()
    ]
    if not major_rows and not track_rows:
        return pd.DataFrame(columns=["track_id", "track_label", "active", "kind", "parent_major_id"])
    tracks_df = pd.DataFrame(major_rows + track_rows)
    tracks_df["track_id"] = tracks_df["track_id"].astype(str).str.strip().str.upper()
    tracks_df["track_label"] = tracks_df["track_label"].fillna("").astype(str).str.strip()
    tracks_df["parent_major_id"] = tracks_df["parent_major_id"].fillna("").astype(str).str.strip().str.upper()
    tracks_df = _safe_bool_col(tracks_df, "active")
    tracks_df.loc[tracks_df["kind"] == "major", "parent_major_id"] = ""
    return tracks_df[["track_id", "track_label", "active", "kind", "parent_major_id"]]


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

    src_idx = src.set_index("course_code")
    if "prerequisites" in src_idx.columns:
        out["prereq_hard"] = out["course_code"].map(src_idx["prerequisites"]).fillna(out["prereq_hard"])
    if "prereq_warnings" in src_idx.columns:
        out["prereq_soft"] = out["course_code"].map(src_idx["prereq_warnings"]).fillna(out["prereq_soft"])
    if "concurrent_with" in src_idx.columns:
        out["prereq_concurrent"] = out["course_code"].map(src_idx["concurrent_with"]).fillna(out["prereq_concurrent"])
    if "min_standing" in src_idx.columns:
        out["prereq_level"] = out["course_code"].map(src_idx["min_standing"]).fillna(out["prereq_level"])

    out["prereq_hard"] = out["prereq_hard"].fillna("none").astype(str)
    out["prereq_soft"] = out["prereq_soft"].fillna("").astype(str)
    out["prereq_concurrent"] = out["prereq_concurrent"].fillna("none").astype(str)
    return out


def _term_sort_key(term_code: str) -> tuple[int, int]:
    s = str(term_code or "").strip().upper()
    if len(s) < 6:
        return (-1, -1)
    try:
        year = int(s[:4])
    except ValueError:
        return (-1, -1)
    season_rank = {"FA": 3, "SU": 2, "SP": 1}.get(s[4:], 0)
    return (year, season_rank)


def _term_code_to_label(term_code: str) -> str:
    s = str(term_code or "").strip().upper()
    if len(s) < 6:
        return s
    season_map = {"FA": "Fall", "SP": "Spring", "SU": "Summer"}
    return f"{s[:4]} {season_map.get(s[4:], s[4:])}"


def _overlay_course_offerings(courses_df: pd.DataFrame, offerings_df: pd.DataFrame) -> pd.DataFrame:
    """Derive offered_fall/spring/summer + confidence + last_four_terms from row-per-term V2 data."""
    if len(offerings_df) == 0 or "course_code" not in offerings_df.columns:
        return courses_df

    src = offerings_df.copy()
    src["course_code"] = src["course_code"].fillna("").astype(str).str.strip()
    src["term_code"] = src.get("term_code", pd.Series(dtype=str)).fillna("").astype(str).str.strip().str.upper()
    src = _safe_bool_col(src, "offered")
    if "confidence" not in src.columns:
        src["confidence"] = None

    grouped = {}
    for _, row in src.iterrows():
        code = row["course_code"]
        if not code:
            continue
        grouped.setdefault(code, []).append(
            {
                "term_code": row.get("term_code", ""),
                "offered": bool(row.get("offered", False)),
                "confidence": row.get("confidence"),
            }
        )

    out = courses_df.copy()
    for col in ("offered_fall", "offered_spring", "offered_summer", "offering_confidence", "last_four_terms"):
        if col not in out.columns:
            out[col] = None

    offered_fall = {}
    offered_spring = {}
    offered_summer = {}
    conf_map = {}
    terms_map = {}
    for code, rows in grouped.items():
        sorted_rows = sorted(rows, key=lambda r: _term_sort_key(r["term_code"]), reverse=True)
        offered_fall[code] = any(r["offered"] and str(r["term_code"]).endswith("FA") for r in sorted_rows)
        offered_spring[code] = any(r["offered"] and str(r["term_code"]).endswith("SP") for r in sorted_rows)
        offered_summer[code] = any(r["offered"] and str(r["term_code"]).endswith("SU") for r in sorted_rows)
        latest_conf = next(
            (
                str(r["confidence"]).strip().lower()
                for r in sorted_rows
                if pd.notna(r.get("confidence")) and str(r.get("confidence")).strip()
            ),
            None,
        )
        conf_map[code] = latest_conf
        terms_map[code] = ", ".join(
            [_term_code_to_label(r["term_code"]) for r in sorted_rows[:4] if r["term_code"]]
        )

    out["offered_fall"] = out["course_code"].map(offered_fall).fillna(out["offered_fall"])
    out["offered_spring"] = out["course_code"].map(offered_spring).fillna(out["offered_spring"])
    out["offered_summer"] = out["course_code"].map(offered_summer).fillna(out["offered_summer"])
    out["offering_confidence"] = out["course_code"].map(conf_map).fillna(out["offering_confidence"])
    out["last_four_terms"] = out["course_code"].map(terms_map).fillna(out["last_four_terms"])
    return out


def _derive_runtime_from_v2(
    v2_buckets_df: pd.DataFrame,
    v2_sub_buckets_df: pd.DataFrame,
    v2_course_sub_buckets_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build runtime-compatible buckets/map from V2 model."""
    if len(v2_sub_buckets_df) == 0 or len(v2_course_sub_buckets_df) == 0:
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
                "parent_bucket_id",
                "parent_bucket_label",
                "track_required",
            ]
        )
        empty_m = pd.DataFrame(columns=["track_id", "course_code", "bucket_id", "constraints", "notes"])
        return empty_b, empty_m

    parent_meta = v2_buckets_df[["program_id", "bucket_id", "bucket_label", "track_required"]].copy()
    parent_meta = parent_meta.rename(
        columns={
            "bucket_id": "parent_bucket_id",
            "bucket_label": "parent_bucket_label",
        }
    )

    merged_sub = v2_sub_buckets_df.merge(
        parent_meta,
        left_on=["program_id", "bucket_id"],
        right_on=["program_id", "parent_bucket_id"],
        how="left",
    )

    runtime_buckets = pd.DataFrame(
        {
            "track_id": merged_sub["program_id"],
            "bucket_id": merged_sub["sub_bucket_id"],
            "bucket_label": merged_sub["sub_bucket_label"],
            "priority": merged_sub["priority"],
            "needed_count": merged_sub.get("courses_required"),
            "needed_credits": merged_sub.get("credits_required"),
            "min_level": merged_sub.get("min_level"),
            "role": merged_sub.get("role", "").fillna(""),
            "parent_bucket_id": merged_sub["bucket_id"],
            "parent_bucket_label": merged_sub.get("parent_bucket_label", merged_sub["bucket_id"]),
            "track_required": merged_sub.get("track_required", "").fillna("").astype(str).str.strip().str.upper(),
        }
    )

    runtime_map = pd.DataFrame(
        {
            "track_id": v2_course_sub_buckets_df["program_id"],
            "course_code": v2_course_sub_buckets_df["course_code"],
            "bucket_id": v2_course_sub_buckets_df["sub_bucket_id"],
            "constraints": v2_course_sub_buckets_df.get("constraints", "").fillna(""),
            "notes": v2_course_sub_buckets_df.get("notes", "").fillna(""),
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
    if "restriction_note" in eq.columns:
        label = eq["restriction_note"].fillna("").astype(str)
    elif "notes" in eq.columns:
        label = eq["notes"].fillna("").astype(str)
    else:
        label = ""
    return pd.DataFrame(
        {
            "equiv_group_id": eq["equiv_group_id"],
            "course_code": eq["course_code"],
            "label": label,
        }
    )


def load_data(data_path: str) -> dict:
    """Load workbook using strict V2 schema (no legacy sheet fallback)."""
    xl = pd.ExcelFile(data_path)
    sheet_set = set(xl.sheet_names)

    if "courses" not in sheet_set:
        raise ValueError("Workbook must contain a 'courses' sheet.")
    missing_v2 = sorted(_REQUIRED_V2_SHEETS - sheet_set)
    if missing_v2:
        raise ValueError(
            "Workbook is missing required V2 sheet(s): "
            + ", ".join(missing_v2)
        )

    courses_df = xl.parse("courses")
    v2_programs_df = _normalize_programs_df(xl.parse("programs"))
    v2_track_definitions_df = _normalize_track_definitions_df(xl.parse("track_definitions"))
    v2_buckets_df = _normalize_v2_buckets_df(xl.parse("buckets"))
    v2_sub_buckets_df = _normalize_v2_sub_buckets_df(xl.parse("sub_buckets"))
    v2_course_sub_buckets_df = _normalize_v2_course_sub_buckets_df(xl.parse("course_sub_buckets"))
    v2_double_count_policy_df = xl.parse("double_count_policy")

    course_prereqs_df = xl.parse("course_prereqs") if "course_prereqs" in sheet_set else pd.DataFrame()
    course_offerings_df = xl.parse("course_offerings") if "course_offerings" in sheet_set else pd.DataFrame()
    courses_df = _overlay_course_prereqs(courses_df, course_prereqs_df)
    courses_df = _overlay_course_offerings(courses_df, course_offerings_df)

    equivalencies_df = _load_v2_equivalencies(xl, sheet_set)
    tracks_df = _build_tracks_from_v2(v2_programs_df, v2_track_definitions_df)
    buckets_df, course_bucket_map_df = _derive_runtime_from_v2(
        v2_buckets_df,
        v2_sub_buckets_df,
        v2_course_sub_buckets_df,
    )

    # Normalize booleans on course offering flags for runtime consumers.
    for col in ["offered_fall", "offered_spring", "offered_summer"]:
        courses_df = _safe_bool_col(courses_df, col)

    courses_df["course_code"] = courses_df["course_code"].fillna("").astype(str).str.strip()
    courses_df["prereq_hard"] = courses_df.get("prereq_hard", pd.Series(dtype=str)).fillna("none")
    courses_df["prereq_soft"] = courses_df.get("prereq_soft", pd.Series(dtype=str)).fillna("")
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
            f"[WARN] {len(orphaned_codes)} course(s) in course_sub_buckets not found in courses sheet: "
            f"{orphaned_codes}"
        )

    map_buckets = set(course_bucket_map_df["bucket_id"].astype(str).str.strip().tolist())
    defined_buckets = set(buckets_df["bucket_id"].astype(str).str.strip().tolist())
    orphaned_buckets = sorted(map_buckets - defined_buckets)
    if orphaned_buckets:
        print(
            f"[WARN] {len(orphaned_buckets)} sub_bucket_id(s) in course_sub_buckets not found in sub_buckets sheet: "
            f"{orphaned_buckets}"
        )

    unsupported = [code for code, p in prereq_map.items() if p["type"] == "unsupported"]
    if unsupported:
        print(
            "[WARN] "
            f"{len(unsupported)} course(s) have unsupported prereq format (manual review required): "
            f"{sorted(unsupported)}"
        )

    print("[INFO] Loaded strict V2 workbook model (no legacy sheet fallback).")

    return {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_bucket_map_df,
        "tracks_df": tracks_df,
        "catalog_codes": catalog_codes,
        "prereq_map": prereq_map,
        "v2_detected": True,
        "v2_programs_df": v2_programs_df,
        "v2_track_definitions_df": v2_track_definitions_df,
        "v2_buckets_df": v2_buckets_df,
        "v2_sub_buckets_df": v2_sub_buckets_df,
        "v2_course_sub_buckets_df": v2_course_sub_buckets_df,
        "v2_double_count_policy_df": v2_double_count_policy_df,
    }
