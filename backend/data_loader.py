import sys
import pandas as pd
from prereq_parser import parse_prereqs


_BOOL_TRUTHY = {"true", "1", "yes", "y"}


def _safe_bool_col(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """Normalize a boolean column to Python bool regardless of Excel format."""

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


def _infer_program_kind(track_id: str, track_label: str) -> str:
    """Infer program kind when workbook does not provide it."""
    tid = str(track_id or "").strip().upper()
    label = str(track_label or "").strip().lower()
    if tid.endswith("_CONC") or tid.endswith("_TRACK"):
        return "track"
    if "concentration" in label or " track" in label:
        return "track"
    if tid.endswith("_MAJOR") or "major" in label:
        return "major"
    return "major"


def _normalize_program_kind(raw_kind, track_id: str, track_label: str) -> str:
    """Normalize program kind to one of: major, track."""
    k = str(raw_kind or "").strip().lower()
    if k in {"major", "maj"}:
        return "major"
    if k in {"track", "concentration", "minor", "certificate"}:
        return "track"
    return _infer_program_kind(track_id, track_label)


def _normalize_tracks_df(tracks_df: pd.DataFrame) -> pd.DataFrame:
    """Normalize legacy tracks/program catalog columns."""
    tracks_df = tracks_df.copy()

    rename_map = {}
    if "track_id" not in tracks_df.columns and "program_id" in tracks_df.columns:
        rename_map["program_id"] = "track_id"
    if "kind" not in tracks_df.columns and "program_type" in tracks_df.columns:
        rename_map["program_type"] = "kind"
    if "parent_major_id" not in tracks_df.columns and "parent_program_id" in tracks_df.columns:
        rename_map["parent_program_id"] = "parent_major_id"
    if rename_map:
        tracks_df = tracks_df.rename(columns=rename_map)

    if "track_id" not in tracks_df.columns:
        tracks_df["track_id"] = ""
    if "track_label" not in tracks_df.columns:
        tracks_df["track_label"] = tracks_df["track_id"]
    if "active" not in tracks_df.columns:
        tracks_df["active"] = False
    if "kind" not in tracks_df.columns:
        tracks_df["kind"] = ""
    if "parent_major_id" not in tracks_df.columns:
        tracks_df["parent_major_id"] = ""

    tracks_df["track_id"] = tracks_df["track_id"].astype(str).str.strip().str.upper()
    tracks_df["track_label"] = tracks_df["track_label"].fillna("").astype(str).str.strip()
    tracks_df = _safe_bool_col(tracks_df, "active")
    tracks_df["kind"] = tracks_df.apply(
        lambda r: _normalize_program_kind(r.get("kind"), r.get("track_id"), r.get("track_label")),
        axis=1,
    )
    tracks_df["parent_major_id"] = (
        tracks_df["parent_major_id"].fillna("").astype(str).str.strip().str.upper()
    )

    major_ids = tracks_df.loc[tracks_df["kind"] == "major", "track_id"].tolist()
    if len(major_ids) == 1:
        lone_major = major_ids[0]
        missing_parent = (tracks_df["kind"] == "track") & (tracks_df["parent_major_id"] == "")
        tracks_df.loc[missing_parent, "parent_major_id"] = lone_major

    tracks_df.loc[tracks_df["kind"] == "major", "parent_major_id"] = ""
    return tracks_df[["track_id", "track_label", "active", "kind", "parent_major_id"]]


def _normalize_programs_df(programs_df: pd.DataFrame) -> pd.DataFrame:
    """Normalize V2 programs sheet (majors only)."""
    out = programs_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "program_label" not in out.columns:
        out["program_label"] = out["program_id"]
    if "active" not in out.columns:
        out["active"] = False
    out["program_id"] = out["program_id"].astype(str).str.strip().str.upper()
    out["program_label"] = out["program_label"].fillna("").astype(str).str.strip()
    out = _safe_bool_col(out, "active")
    return out[["program_id", "program_label", "active"]]


def _normalize_track_definitions_df(track_defs_df: pd.DataFrame) -> pd.DataFrame:
    """Normalize V2 track_definitions sheet."""
    out = track_defs_df.copy()
    if "program_id" not in out.columns:
        out["program_id"] = ""
    if "track_id" not in out.columns:
        out["track_id"] = ""
    if "track_label" not in out.columns:
        out["track_label"] = out["track_id"]
    if "active" not in out.columns:
        out["active"] = False

    out["program_id"] = out["program_id"].astype(str).str.strip().str.upper()
    out["track_id"] = out["track_id"].astype(str).str.strip().str.upper()
    out["track_label"] = out["track_label"].fillna("").astype(str).str.strip()
    out = _safe_bool_col(out, "active")
    out = out[out["track_id"] != ""]
    return out[["program_id", "track_id", "track_label", "active"]]


def _build_tracks_from_v2(
    programs_df: pd.DataFrame, track_defs_df: pd.DataFrame
) -> pd.DataFrame:
    """Build runtime-compatible tracks_df from V2 programs + track_definitions."""
    major_rows = []
    for _, row in programs_df.iterrows():
        major_rows.append(
            {
                "track_id": str(row["program_id"]),
                "track_label": str(row["program_label"]),
                "active": bool(row["active"]),
                "kind": "major",
                "parent_major_id": "",
            }
        )

    track_rows = []
    for _, row in track_defs_df.iterrows():
        track_rows.append(
            {
                "track_id": str(row["track_id"]),
                "track_label": str(row["track_label"] or row["track_id"]),
                "active": bool(row["active"]),
                "kind": "track",
                "parent_major_id": str(row["program_id"]),
            }
        )

    merged = pd.DataFrame(major_rows + track_rows)
    if len(merged) == 0:
        return pd.DataFrame(columns=["track_id", "track_label", "active", "kind", "parent_major_id"])
    return _normalize_tracks_df(merged)


def _overlay_course_prereqs(courses_df: pd.DataFrame, prereqs_df: pd.DataFrame) -> pd.DataFrame:
    """Apply V2 course_prereqs onto runtime course fields."""
    if len(prereqs_df) == 0:
        return courses_df

    src = prereqs_df.copy()
    if "course_code" not in src.columns:
        return courses_df
    src["course_code"] = src["course_code"].astype(str).str.strip()
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

    p_hard = src.set_index("course_code").get("prerequisites")
    p_soft = src.set_index("course_code").get("prereq_warnings")
    p_conc = src.set_index("course_code").get("concurrent_with")
    p_lvl = src.set_index("course_code").get("min_standing")

    if p_hard is not None:
        out["prereq_hard"] = out["course_code"].map(p_hard).fillna(out["prereq_hard"])
    if p_soft is not None:
        out["prereq_soft"] = out["course_code"].map(p_soft).fillna(out["prereq_soft"])
    if p_conc is not None:
        out["prereq_concurrent"] = out["course_code"].map(p_conc).fillna(out["prereq_concurrent"])
    if p_lvl is not None:
        out["prereq_level"] = out["course_code"].map(p_lvl).fillna(out["prereq_level"])

    out["prereq_hard"] = out["prereq_hard"].fillna("none").astype(str)
    out["prereq_soft"] = out["prereq_soft"].fillna("").astype(str)
    out["prereq_concurrent"] = out["prereq_concurrent"].fillna("none").astype(str)
    return out


def _term_sort_key(term_code: str) -> tuple[int, int]:
    """
    Parse YYYYFA/SP/SU into sortable key (year desc, season desc).
    Unknown format sorts last.
    """
    s = str(term_code or "").strip().upper()
    if len(s) < 6:
        return (-1, -1)
    try:
        year = int(s[:4])
    except ValueError:
        return (-1, -1)
    season = s[4:]
    season_rank = {"FA": 3, "SU": 2, "SP": 1}.get(season, 0)
    return (year, season_rank)


def _term_code_to_label(term_code: str) -> str:
    s = str(term_code or "").strip().upper()
    if len(s) < 6:
        return s
    season_map = {"FA": "Fall", "SP": "Spring", "SU": "Summer"}
    year = s[:4]
    season = season_map.get(s[4:], s[4:])
    return f"{year} {season}"


def _overlay_course_offerings(courses_df: pd.DataFrame, offerings_df: pd.DataFrame) -> pd.DataFrame:
    """Derive offered_fall/spring/summer + confidence/last_four_terms from V2 term rows."""
    if len(offerings_df) == 0 or "course_code" not in offerings_df.columns:
        return courses_df

    src = offerings_df.copy()
    src["course_code"] = src["course_code"].astype(str).str.strip()
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
            (str(r["confidence"]).strip().lower() for r in sorted_rows if pd.notna(r.get("confidence")) and str(r.get("confidence")).strip()),
            None,
        )
        conf_map[code] = latest_conf

        top_terms = [_term_code_to_label(r["term_code"]) for r in sorted_rows[:4] if r["term_code"]]
        terms_map[code] = ", ".join(top_terms)

    out["offered_fall"] = out["course_code"].map(offered_fall).fillna(out["offered_fall"])
    out["offered_spring"] = out["course_code"].map(offered_spring).fillna(out["offered_spring"])
    out["offered_summer"] = out["course_code"].map(offered_summer).fillna(out["offered_summer"])
    out["offering_confidence"] = out["course_code"].map(conf_map).fillna(out["offering_confidence"])
    out["last_four_terms"] = out["course_code"].map(terms_map).fillna(out["last_four_terms"])
    return out


def _derive_runtime_from_v2(
    sub_buckets_df: pd.DataFrame, course_sub_buckets_df: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Build legacy runtime bucket/map tables from V2 sub_bucket mapping.

    Commit 2A compatibility path only; allows bootstrapping if legacy sheets are absent.
    """
    b = sub_buckets_df.copy()
    m = course_sub_buckets_df.copy()

    if len(b) == 0 or len(m) == 0:
        empty_b = pd.DataFrame(
            columns=[
                "track_id", "bucket_id", "bucket_label", "priority",
                "needed_count", "needed_credits", "min_level", "allow_double_count", "role",
                "parent_bucket_id",
            ]
        )
        empty_m = pd.DataFrame(columns=["track_id", "course_code", "bucket_id"])
        return empty_b, empty_m

    rename_b = {
        "program_id": "track_id",
        "sub_bucket_id": "bucket_id",
        "sub_bucket_label": "bucket_label",
        "courses_required": "needed_count",
        "credits_required": "needed_credits",
    }
    # Preserve V2 parent bucket ID for policy resolution.
    if "bucket_id" in b.columns and "parent_bucket_id" not in b.columns:
        b["parent_bucket_id"] = b["bucket_id"]
    for old, new in rename_b.items():
        if old in b.columns:
            b = b.rename(columns={old: new})

    if "allow_double_count" not in b.columns:
        b["allow_double_count"] = False
    if "role" not in b.columns:
        b["role"] = ""
    if "needed_count" not in b.columns:
        b["needed_count"] = None
    if "needed_credits" not in b.columns:
        b["needed_credits"] = None
    if "priority" not in b.columns:
        b["priority"] = 99
    if "min_level" not in b.columns:
        b["min_level"] = None

    runtime_b = b[
        [
            "track_id",
            "bucket_id",
            "bucket_label",
            "priority",
            "needed_count",
            "needed_credits",
            "min_level",
            "allow_double_count",
            "role",
            "parent_bucket_id",
        ]
    ].copy()

    rename_m = {"program_id": "track_id", "sub_bucket_id": "bucket_id"}
    for old, new in rename_m.items():
        if old in m.columns:
            m = m.rename(columns={old: new})
    runtime_m = m[["track_id", "course_code", "bucket_id"]].copy()
    return runtime_b, runtime_m


def load_data(data_path: str) -> dict:
    """Load and parse the course data workbook. Raises on file/schema errors."""
    xl = pd.ExcelFile(data_path)
    sheet_names = xl.sheet_names
    sheet_set = set(sheet_names)

    # V2 detection: metadata/tables added in Commit 2A.
    v2_detected = {"programs", "sub_buckets", "course_sub_buckets"}.issubset(sheet_set)

    if "courses" not in sheet_set:
        raise ValueError("Workbook must contain a 'courses' sheet.")
    courses_df = xl.parse("courses")

    # Optional V2 overlays on course metadata.
    course_prereqs_df = xl.parse("course_prereqs") if "course_prereqs" in sheet_set else pd.DataFrame()
    course_offerings_df = xl.parse("course_offerings") if "course_offerings" in sheet_set else pd.DataFrame()
    courses_df = _overlay_course_prereqs(courses_df, course_prereqs_df)
    courses_df = _overlay_course_offerings(courses_df, course_offerings_df)

    # Equivalencies: prefer V2 sheet if present.
    if "course_equivalencies" in sheet_set:
        eq = xl.parse("course_equivalencies")
        if "equiv_group_id" not in eq.columns:
            equivalencies_df = pd.DataFrame(columns=["equiv_group_id", "course_code", "label"])
        else:
            if "course_code" not in eq.columns:
                eq["course_code"] = ""
            if "restriction_note" in eq.columns:
                label = eq["restriction_note"].fillna("").astype(str)
            elif "notes" in eq.columns:
                label = eq["notes"].fillna("").astype(str)
            else:
                label = ""
            equivalencies_df = pd.DataFrame(
                {
                    "equiv_group_id": eq["equiv_group_id"],
                    "course_code": eq["course_code"],
                    "label": label,
                }
            )
    elif "equivalencies" in sheet_set:
        equivalencies_df = xl.parse("equivalencies")
    else:
        equivalencies_df = pd.DataFrame()

    # Legacy runtime sheets (may be renamed in Commit 2A workbook).
    legacy_tracks_sheet = None
    if "tracks_legacy" in sheet_set:
        legacy_tracks_sheet = "tracks_legacy"
    elif "tracks" in sheet_set:
        legacy_tracks_sheet = "tracks"

    legacy_buckets_sheet = None
    if "buckets_legacy" in sheet_set:
        legacy_buckets_sheet = "buckets_legacy"
    elif "buckets" in sheet_set and not v2_detected:
        legacy_buckets_sheet = "buckets"

    legacy_map_sheet = None
    if "course_bucket_legacy" in sheet_set:
        legacy_map_sheet = "course_bucket_legacy"
    elif "course_bucket" in sheet_set:
        legacy_map_sheet = "course_bucket"

    # V2 primary sheets.
    programs_df = _normalize_programs_df(xl.parse("programs")) if "programs" in sheet_set else pd.DataFrame(
        columns=["program_id", "program_label", "active"]
    )
    track_definitions_df = _normalize_track_definitions_df(xl.parse("track_definitions")) if "track_definitions" in sheet_set else pd.DataFrame(
        columns=["program_id", "track_id", "track_label", "active"]
    )
    v2_buckets_df = xl.parse("buckets") if "buckets" in sheet_set and v2_detected else pd.DataFrame()
    v2_sub_buckets_df = xl.parse("sub_buckets") if "sub_buckets" in sheet_set else pd.DataFrame()
    v2_course_sub_buckets_df = xl.parse("course_sub_buckets") if "course_sub_buckets" in sheet_set else pd.DataFrame()
    v2_double_count_policy_df = xl.parse("double_count_policy") if "double_count_policy" in sheet_set else pd.DataFrame()

    # Tracks catalog selection.
    tracks_from_v2 = _build_tracks_from_v2(programs_df, track_definitions_df) if len(programs_df) > 0 else pd.DataFrame(
        columns=["track_id", "track_label", "active", "kind", "parent_major_id"]
    )
    if legacy_tracks_sheet:
        tracks_df = _normalize_tracks_df(xl.parse(legacy_tracks_sheet))
        tracks_source = legacy_tracks_sheet
    else:
        tracks_df = tracks_from_v2
        tracks_source = "v2:programs+track_definitions"

    # Runtime bucket/map selection.
    if legacy_buckets_sheet and legacy_map_sheet:
        buckets_df = xl.parse(legacy_buckets_sheet)
        course_bucket_map_df = xl.parse(legacy_map_sheet)
        map_source = f"{legacy_map_sheet} (compat)"
    elif len(v2_sub_buckets_df) > 0 and len(v2_course_sub_buckets_df) > 0:
        buckets_df, course_bucket_map_df = _derive_runtime_from_v2(
            v2_sub_buckets_df, v2_course_sub_buckets_df
        )
        map_source = "v2:course_sub_buckets->runtime"
    elif "course_sub_buckets" in sheet_set:
        course_bucket_map_df = xl.parse("course_sub_buckets")
        buckets_df = xl.parse("buckets") if "buckets" in sheet_set else pd.DataFrame()
        map_source = "course_sub_buckets"
    elif "course_bucket" in sheet_set:
        course_bucket_map_df = xl.parse("course_bucket")
        if "buckets" not in sheet_set:
            raise ValueError("Workbook must contain a 'buckets' sheet.")
        buckets_df = xl.parse("buckets")
        map_source = "course_bucket"
    else:
        raise ValueError(
            "Workbook must contain a bucket mapping sheet ('course_bucket' or 'course_sub_buckets')."
        )

    # Backward/forward compatibility for naming.
    if "track_id" not in buckets_df.columns and "program_id" in buckets_df.columns:
        buckets_df = buckets_df.rename(columns={"program_id": "track_id"})
    if "track_id" not in course_bucket_map_df.columns and "program_id" in course_bucket_map_df.columns:
        course_bucket_map_df = course_bucket_map_df.rename(columns={"program_id": "track_id"})
    if "bucket_id" not in course_bucket_map_df.columns and "sub_bucket_id" in course_bucket_map_df.columns:
        course_bucket_map_df = course_bucket_map_df.rename(columns={"sub_bucket_id": "bucket_id"})

    # Normalize bool columns.
    for col in ["offered_fall", "offered_spring", "offered_summer"]:
        courses_df = _safe_bool_col(courses_df, col)
    buckets_df = _safe_bool_col(buckets_df, "allow_double_count")

    # Ensure expected runtime columns.
    if "role" not in buckets_df.columns:
        buckets_df["role"] = ""
    else:
        buckets_df["role"] = buckets_df["role"].fillna("")

    courses_df["course_code"] = courses_df["course_code"].astype(str).str.strip()
    courses_df["prereq_hard"] = courses_df.get("prereq_hard", pd.Series(dtype=str)).fillna("none")
    courses_df["prereq_soft"] = courses_df.get("prereq_soft", pd.Series(dtype=str)).fillna("")

    # Build course catalog set.
    catalog_codes = set(courses_df["course_code"].tolist())

    # Build prereq map.
    prereq_map: dict = {}
    for _, row in courses_df.iterrows():
        code = row["course_code"]
        prereq_map[code] = parse_prereqs(row.get("prereq_hard", "none"))

    # Startup integrity checks.
    map_codes = set(course_bucket_map_df["course_code"].astype(str).str.strip().tolist())
    orphaned = map_codes - catalog_codes
    if orphaned:
        print(f"[WARN] {len(orphaned)} course(s) in bucket map not found in courses sheet: {sorted(orphaned)}")

    map_buckets = set(course_bucket_map_df["bucket_id"].astype(str).str.strip().tolist())
    defined_buckets = set(buckets_df["bucket_id"].astype(str).str.strip().tolist()) if "bucket_id" in buckets_df.columns else set()
    orphaned_buckets = map_buckets - defined_buckets
    if orphaned_buckets:
        print(f"[WARN] {len(orphaned_buckets)} bucket_id(s) in map not found in buckets sheet: {sorted(orphaned_buckets)}")

    unsupported = [code for code, p in prereq_map.items() if p["type"] == "unsupported"]
    if unsupported:
        print(f"[WARN] {len(unsupported)} course(s) have unsupported prereq format (manual review required): {sorted(unsupported)}")

    if v2_detected:
        print(
            "[INFO] V2 sheets detected (programs/sub_buckets/course_sub_buckets). "
            f"Runtime source: {map_source}; tracks source: {tracks_source}."
        )
    else:
        print(f"[INFO] Bucket map source: {map_source}")

    return {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_bucket_map_df,
        "tracks_df": tracks_df,
        "catalog_codes": catalog_codes,
        "prereq_map": prereq_map,
        # Commit 2A V2 metadata payload (non-breaking additive).
        "v2_detected": v2_detected,
        "v2_programs_df": programs_df,
        "v2_track_definitions_df": track_definitions_df,
        "v2_buckets_df": v2_buckets_df,
        "v2_sub_buckets_df": v2_sub_buckets_df,
        "v2_course_sub_buckets_df": v2_course_sub_buckets_df,
        "v2_double_count_policy_df": v2_double_count_policy_df,
    }
