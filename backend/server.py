import os
import sys
import threading

# Ensure backend/ is on sys.path so sibling imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

from normalizer import normalize_code, normalize_input
from requirements import DEFAULT_TRACK_ID
from validators import (
    find_inconsistent_completed_courses,
    expand_completed_with_prereqs_with_provenance,
    expand_in_progress_with_prereqs,
)
from unlocks import build_reverse_prereq_map
from eligibility import check_can_take, parse_term
from data_loader import load_data
from allocator import allocate_courses
from semester_recommender import (
    SEM_RE,
    normalize_semester_label,
    default_followup_semester,
    run_recommendation_semester,
)

load_dotenv()

app = Flask(__name__)

# â”€â”€ Paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
DATA_PATH = os.environ.get("DATA_PATH")
if not DATA_PATH:
    DATA_PATH = os.path.join(PROJECT_ROOT, "marquette_courses_full.xlsx")
elif not os.path.isabs(DATA_PATH):
    DATA_PATH = os.path.join(PROJECT_ROOT, DATA_PATH)
_data_lock = threading.Lock()
_data_mtime = None


def _data_file_mtime(path: str):
    try:
        return os.path.getmtime(path)
    except OSError:
        return None

# â”€â”€ Startup data load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try:
    _data = load_data(DATA_PATH)
    _data_mtime = _data_file_mtime(DATA_PATH)
    print(f"[OK] Loaded {len(_data['catalog_codes'])} courses from {DATA_PATH}")
except FileNotFoundError:
    print(f"[FATAL] Data file not found: {DATA_PATH}", file=sys.stderr)
    sys.exit(1)
except Exception as exc:
    print(f"[FATAL] Failed to load data: {exc}", file=sys.stderr)
    sys.exit(1)

_reverse_map = build_reverse_prereq_map(_data["courses_df"], _data["prereq_map"])


def _reload_data_if_changed(force: bool = False) -> bool:
    """
    Hot-reload workbook-backed runtime data when DATA_PATH changes on disk.

    Returns True when a reload occurred, else False.
    """
    global _data, _reverse_map, _data_mtime

    candidate_mtime = _data_file_mtime(DATA_PATH)
    if not force:
        if candidate_mtime is None:
            return False
        if _data_mtime is not None and candidate_mtime <= _data_mtime:
            return False

    with _data_lock:
        latest_mtime = _data_file_mtime(DATA_PATH)
        if not force:
            if latest_mtime is None:
                return False
            if _data_mtime is not None and latest_mtime <= _data_mtime:
                return False

        try:
            new_data = load_data(DATA_PATH)
            new_reverse_map = build_reverse_prereq_map(
                new_data["courses_df"],
                new_data["prereq_map"],
            )
        except Exception as exc:
            print(f"[WARN] Data reload failed; keeping previous dataset: {exc}", file=sys.stderr)
            return False

        _data = new_data
        _reverse_map = new_reverse_map
        _data_mtime = latest_mtime if latest_mtime is not None else candidate_mtime
        print(f"[OK] Reloaded {len(new_data['catalog_codes'])} courses from {DATA_PATH}")
        return True


def _refresh_data_if_needed() -> None:
    try:
        _reload_data_if_changed()
    except Exception as exc:
        print(f"[WARN] Data reload check failed: {exc}", file=sys.stderr)


# â”€â”€ Input validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _validate_recommend_body(body):
    """Returns (error_code, message) on invalid input, (None, None) on success."""
    if body is None:
        return "INVALID_INPUT", "Request body must be valid JSON."
    max_recs_raw = body.get("max_recommendations", 3)
    try:
        max_recs = int(max_recs_raw)
        if not (1 <= max_recs <= 6):
            raise ValueError
    except (TypeError, ValueError):
        return "INVALID_INPUT", "max_recommendations must be an integer between 1 and 6."
    semester_count_raw = body.get("target_semester_count")
    if semester_count_raw not in (None, ""):
        try:
            semester_count = int(semester_count_raw)
            if not (1 <= semester_count <= 4):
                raise ValueError
        except (TypeError, ValueError):
            return "INVALID_INPUT", "target_semester_count must be an integer between 1 and 4."
    for field in (
        "target_semester_primary",
        "target_semester",
        "target_semester_secondary",
        "target_semester_tertiary",
        "target_semester_quaternary",
    ):
        val = body.get(field)
        if val and val not in ("", "__NONE__") and not SEM_RE.match(str(val).strip()):
            return "INVALID_INPUT", f"'{field}' value '{val}' is not a valid semester (e.g. 'Spring 2026')."
    return None, None


PHASE5_PLAN_TRACK_ID = "__DECLARED_PLAN__"
_MAJOR_CODE_LABEL_OVERRIDES = {
    "FIN": "FINA",
    "INSY": "IS",
}


def _major_code_from_program_id(program_id: str) -> str:
    program = str(program_id or "").strip().upper()
    if not program:
        return ""
    if program.endswith("_MAJOR"):
        program = program[:-6]
    return program.split("_", 1)[0]


def _canonical_major_label(program_id: str) -> str:
    code = _major_code_from_program_id(program_id)
    if not code:
        return str(program_id or "").strip().upper()
    display_code = _MAJOR_CODE_LABEL_OVERRIDES.get(code, code)
    return f"{display_code} Major"


def _canonical_program_label(program_id: str, kind: str, fallback_label: str | None = None) -> str:
    normalized_kind = str(kind or "").strip().lower()
    if normalized_kind == "major":
        return _canonical_major_label(program_id)

    fallback = str(fallback_label or "").strip()
    if fallback:
        return fallback
    return str(program_id or "").strip().upper()


def _normalize_program_catalog(tracks_df):
    """Return normalized program catalog dataframe used by /programs and /recommend."""
    if tracks_df is None or len(tracks_df) == 0:
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

    df = tracks_df.copy()
    if "track_id" not in df.columns and "program_id" in df.columns:
        df = df.rename(columns={"program_id": "track_id"})
    if "kind" not in df.columns and "program_type" in df.columns:
        df = df.rename(columns={"program_type": "kind"})
    if "parent_major_id" not in df.columns and "parent_program_id" in df.columns:
        df = df.rename(columns={"parent_program_id": "parent_major_id"})

    if "kind" not in df.columns:
        df["kind"] = ""
    if "parent_major_id" not in df.columns:
        df["parent_major_id"] = ""
    if "track_label" not in df.columns:
        df["track_label"] = df.get("track_id", "")
    if "active" not in df.columns:
        df["active"] = True
    if "requires_primary_major" not in df.columns:
        df["requires_primary_major"] = False
    if "applies_to_all" not in df.columns:
        df["applies_to_all"] = False

    df["track_id"] = df["track_id"].astype(str).str.strip().str.upper()
    df["track_label"] = df["track_label"].fillna("").astype(str).str.strip()
    df["parent_major_id"] = df["parent_major_id"].fillna("").astype(str).str.strip().str.upper()
    df["active"] = df["active"].apply(lambda v: bool(v) if pd.notna(v) else False)
    df["requires_primary_major"] = df["requires_primary_major"].apply(lambda v: bool(v) if pd.notna(v) else False)
    df["applies_to_all"] = df["applies_to_all"].apply(lambda v: bool(v) if pd.notna(v) else False)

    def _normalize_kind(row):
        kind = str(row.get("kind", "") or "").strip().lower()
        if kind in {"major", "track"}:
            return kind
        tid = str(row.get("track_id", "") or "").strip().upper()
        label = str(row.get("track_label", "") or "").strip().lower()
        if tid.endswith("_CONC") or tid.endswith("_TRACK"):
            return "track"
        if "concentration" in label or " track" in label:
            return "track"
        return "major"

    df["kind"] = df.apply(_normalize_kind, axis=1)

    major_ids = df.loc[df["kind"] == "major", "track_id"].tolist()
    if len(major_ids) == 1:
        lone_major = major_ids[0]
        missing_parent = (df["kind"] == "track") & (df["parent_major_id"] == "")
        df.loc[missing_parent, "parent_major_id"] = lone_major
    df.loc[df["kind"] == "major", "parent_major_id"] = ""
    df["track_label"] = df.apply(
        lambda row: _canonical_program_label(
            row.get("track_id", ""),
            row.get("kind", ""),
            row.get("track_label", ""),
        ),
        axis=1,
    )

    return df[
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


def _normalize_program_catalog_v2(data: dict) -> pd.DataFrame:
    """Build normalized catalog from V2 programs sheet (majors + tracks)."""
    programs = data.get("v2_programs_df")
    rows = []

    if programs is not None and len(programs) > 0:
        for _, row in programs.iterrows():
            program_id = str(row.get("program_id", "") or "").strip().upper()
            if not program_id:
                continue
            kind = str(row.get("kind", "major") or "major").strip().lower()
            if kind not in {"major", "track"}:
                kind = "major"
            parent_major_id = str(row.get("parent_major_id", "") or "").strip().upper()
            if kind == "major":
                parent_major_id = ""
            raw_label = str(row.get("program_label", program_id) or program_id).strip()
            rows.append(
                {
                    "track_id": program_id,
                    "track_label": _canonical_program_label(program_id, kind, raw_label),
                    "active": bool(row.get("active", True)) if pd.notna(row.get("active", True)) else False,
                    "kind": kind,
                    "parent_major_id": parent_major_id,
                    "requires_primary_major": (
                        bool(row.get("requires_primary_major", False))
                        if pd.notna(row.get("requires_primary_major", False))
                        else False
                    ),
                    "applies_to_all": (
                        bool(row.get("applies_to_all", False))
                        if pd.notna(row.get("applies_to_all", False))
                        else False
                    ),
                }
            )

    if not rows:
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
    return pd.DataFrame(rows)


def _is_v2_program_model_enabled(data: dict) -> bool:
    if not data.get("v2_detected"):
        return False
    programs = data.get("v2_programs_df")
    sub_buckets = data.get("v2_sub_buckets_df")
    mappings = data.get("v2_courses_all_buckets_df", data.get("v2_course_sub_buckets_df"))
    return (
        programs is not None and len(programs) > 0
        and sub_buckets is not None and len(sub_buckets) > 0
        and mappings is not None and len(mappings) > 0
    )


def _get_program_catalog(data: dict) -> tuple[pd.DataFrame, pd.DataFrame, bool]:
    """
    Return (catalog_df, legacy_catalog_df, using_v2_catalog).
    """
    legacy_catalog = _normalize_program_catalog(data.get("tracks_df"))
    if _is_v2_program_model_enabled(data):
        v2_catalog = _normalize_program_catalog_v2(data)
        if len(v2_catalog) > 0:
            return v2_catalog, legacy_catalog, True
    return legacy_catalog, legacy_catalog, False


def _track_alias_map(catalog_df: pd.DataFrame) -> dict[str, str]:
    """
    Map accepted aliases -> canonical track IDs.

    Keeps backward compatibility for legacy *_CONC / *_TRACK inputs.
    """
    alias_map: dict[str, str] = {}
    if catalog_df is None or len(catalog_df) == 0:
        return alias_map
    tracks = catalog_df[catalog_df["kind"] == "track"]
    for _, row in tracks.iterrows():
        tid = str(row["track_id"]).strip().upper()
        if not tid:
            continue
        alias_map[tid] = tid
        if tid.endswith("_TRACK"):
            base = tid[: -len("_TRACK")]
            if base:
                alias_map[base] = tid
                alias_map[f"{base}_CONC"] = tid
        elif tid.endswith("_CONC"):
            base = tid[: -len("_CONC")]
            if base:
                alias_map[base] = tid
                alias_map[f"{base}_TRACK"] = tid
        else:
            alias_map[f"{tid}_TRACK"] = tid
            alias_map[f"{tid}_CONC"] = tid
    return alias_map


def _universal_program_ids(data: dict) -> set[str]:
    programs = data.get("v2_programs_df")
    if programs is None or len(programs) == 0:
        return set()
    p = programs.copy()
    p["program_id"] = p["program_id"].astype(str).str.strip().str.upper()
    p["active"] = p.get("active", True).apply(lambda v: bool(v) if pd.notna(v) else False)
    if "applies_to_all" in p.columns:
        p["applies_to_all"] = p["applies_to_all"].apply(lambda v: bool(v) if pd.notna(v) else False)
    else:
        p["applies_to_all"] = False
    return set(
        p[(p["applies_to_all"] == True) & (p["active"] == True)]["program_id"].tolist()
    )


def _build_single_major_data_v2(data: dict, major_id: str, selected_track_id: str | None) -> dict:
    """
    Build runtime-compatible data slice for one major from V2 sheets.

    selected_track_id applies conditional buckets:
      - always include buckets with empty track_required
      - include track_required==selected_track_id when a track is selected
    """
    major_id = str(major_id or "").strip().upper()
    selected_track = str(selected_track_id or "").strip().upper()

    v2_buckets = data.get("v2_buckets_df", pd.DataFrame()).copy()
    v2_sub = data.get("v2_sub_buckets_df", pd.DataFrame()).copy()
    v2_map = data.get("v2_courses_all_buckets_df", data.get("v2_course_sub_buckets_df", pd.DataFrame())).copy()
    universal_program_ids = _universal_program_ids(data)
    program_scope = {major_id} | universal_program_ids

    if len(v2_buckets) == 0 or len(v2_sub) == 0:
        return dict(data)

    buckets = v2_buckets.copy()
    buckets["program_id"] = buckets["program_id"].astype(str).str.strip().str.upper()
    buckets["bucket_id"] = buckets["bucket_id"].astype(str).str.strip()
    buckets["track_required"] = buckets.get("track_required", "").fillna("").astype(str).str.strip().str.upper()
    buckets["active"] = buckets.get("active", True).apply(bool)
    buckets = buckets[
        (buckets["program_id"].isin(program_scope))
        & (buckets["active"] == True)
    ].copy()

    if selected_track:
        buckets = buckets[
            (buckets["program_id"] != major_id)
            | (buckets["track_required"] == "")
            | (buckets["track_required"] == selected_track)
        ].copy()
    else:
        buckets = buckets[
            (buckets["program_id"] != major_id)
            | (buckets["track_required"] == "")
        ].copy()
    bucket_keys = buckets[["program_id", "bucket_id"]].drop_duplicates()

    sub = v2_sub.copy()
    sub["program_id"] = sub["program_id"].astype(str).str.strip().str.upper()
    sub["bucket_id"] = sub["bucket_id"].astype(str).str.strip()
    sub["sub_bucket_id"] = sub["sub_bucket_id"].astype(str).str.strip()
    sub = sub.merge(bucket_keys, on=["program_id", "bucket_id"], how="inner")
    sub["credits_required"] = pd.to_numeric(sub.get("credits_required"), errors="coerce")
    requirement_mode = (
        sub.get("requirement_mode", pd.Series(index=sub.index, dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )
    missing_mode = requirement_mode == ""
    if missing_mode.any():
        role_norm = (
            sub.get("role", pd.Series(index=sub.index, dtype=str))
            .fillna("")
            .astype(str)
            .str.strip()
            .str.lower()
        )
        derived_mode = role_norm.map({"core": "required", "elective": "choose_n"}).fillna("required")
        requirement_mode = requirement_mode.where(~missing_mode, derived_mode)
    requirement_mode = requirement_mode.where(
        requirement_mode.isin({"required", "choose_n", "credits_pool"}),
        "required",
    )

    bucket_labels = {
        (str(row.get("program_id", "")).strip().upper(), str(row.get("bucket_id", "")).strip()): str(
            row.get("bucket_label", "")
        )
        for _, row in buckets.iterrows()
    }
    bucket_track_required = {
        (str(row.get("program_id", "")).strip().upper(), str(row.get("bucket_id", "")).strip()): str(
            row.get("track_required", "")
        ).strip().upper()
        for _, row in buckets.iterrows()
    }
    bucket_double_count_family = {}
    for _, row in buckets.iterrows():
        key = (
            str(row.get("program_id", "")).strip().upper(),
            str(row.get("bucket_id", "")).strip(),
        )
        track_req = str(row.get("track_required", "") or "").strip().upper()
        family = str(row.get("double_count_family_id", "") or "").strip().upper()
        if not family:
            family = str(row.get("bucket_id", "") or "").strip().upper()
        bucket_double_count_family[key] = family

    runtime_buckets = pd.DataFrame(
        {
            "track_id": major_id,
            "bucket_id": sub["sub_bucket_id"],
            "bucket_label": sub.get("sub_bucket_label", sub["sub_bucket_id"]),
            "priority": sub.get("priority", 99),
            "needed_count": sub.get("courses_required"),
            "needed_credits": sub.get("credits_required"),
            "min_level": sub.get("min_level"),
            "allow_double_count": False,
            "role": sub.get("role", "").fillna(""),
            "requirement_mode": requirement_mode,
            "parent_bucket_id": sub["bucket_id"],
            "parent_bucket_label": sub.apply(
                lambda r: bucket_labels.get(
                    (
                        str(r.get("program_id", "")).strip().upper(),
                        str(r.get("bucket_id", "")).strip(),
                    ),
                    str(r.get("bucket_id", "")),
                ),
                axis=1,
            ),
            "track_required": sub.apply(
                lambda r: bucket_track_required.get(
                    (
                        str(r.get("program_id", "")).strip().upper(),
                        str(r.get("bucket_id", "")).strip(),
                    ),
                    "",
                ),
                axis=1,
            ),
            "double_count_family_id": sub.apply(
                lambda r: bucket_double_count_family.get(
                    (
                        str(r.get("program_id", "")).strip().upper(),
                        str(r.get("bucket_id", "")).strip(),
                    ),
                    str(r.get("bucket_id", "")).strip().upper(),
                ),
                axis=1,
            ),
            "source_program_id": sub["program_id"],
            "source_parent_bucket_id": sub["bucket_id"],
        }
    )

    sub_keys = runtime_buckets[["source_program_id", "bucket_id"]].copy()
    sub_keys = sub_keys.rename(columns={"bucket_id": "source_bucket_id"}).drop_duplicates()

    runtime_source_map = data.get("course_bucket_map_df", pd.DataFrame()).copy()
    if len(runtime_source_map) > 0 and {"track_id", "bucket_id", "course_code"}.issubset(runtime_source_map.columns):
        runtime_source_map["track_id"] = runtime_source_map["track_id"].astype(str).str.strip().str.upper()
        runtime_source_map["bucket_id"] = runtime_source_map["bucket_id"].astype(str).str.strip()
        runtime_source_map["course_code"] = runtime_source_map["course_code"].astype(str).str.strip()
        mappings = runtime_source_map.merge(
            sub_keys,
            left_on=["track_id", "bucket_id"],
            right_on=["source_program_id", "source_bucket_id"],
            how="inner",
        )
        runtime_map = pd.DataFrame(
            {
                "track_id": major_id,
                "course_code": mappings["course_code"],
                "bucket_id": mappings["bucket_id"],
                "notes": mappings.get("notes"),
                "source_program_id": mappings["track_id"],
                "source_bucket_id": mappings["bucket_id"],
            }
        )
    else:
        legacy_sub_keys = sub_keys.rename(
            columns={
                "source_program_id": "program_id",
                "source_bucket_id": "sub_bucket_id",
            }
        )
        mappings = v2_map.copy()
        mappings["program_id"] = mappings["program_id"].astype(str).str.strip().str.upper()
        mappings["sub_bucket_id"] = mappings["sub_bucket_id"].astype(str).str.strip()
        mappings["course_code"] = mappings["course_code"].astype(str).str.strip()
        mappings = mappings.merge(legacy_sub_keys, on=["program_id", "sub_bucket_id"], how="inner")
        runtime_map = pd.DataFrame(
            {
                "track_id": major_id,
                "course_code": mappings["course_code"],
                "bucket_id": mappings["sub_bucket_id"],
                "notes": mappings.get("notes"),
                "source_program_id": mappings["program_id"],
                "source_bucket_id": mappings["sub_bucket_id"],
            }
        )

    merged = dict(data)
    merged["buckets_df"] = runtime_buckets
    merged["course_bucket_map_df"] = runtime_map
    return merged


def _build_declared_plan_data_v2(
    data: dict,
    declared_majors: list[str],
    selected_track_id: str | None,
    catalog_df: pd.DataFrame,
) -> dict:
    """Build synthetic merged runtime view from V2 model for declared majors."""
    label_map = {str(r["track_id"]): str(r["track_label"] or r["track_id"]) for _, r in catalog_df.iterrows()}
    track_parent = {
        str(r["track_id"]): str(r.get("parent_major_id", "") or "").strip().upper()
        for _, r in catalog_df[catalog_df["kind"] == "track"].iterrows()
    }
    universal_programs = _universal_program_ids(data)

    all_buckets = []
    all_maps = []

    for major_id in declared_majors:
        major_track = selected_track_id if track_parent.get(selected_track_id or "", "") == major_id else None
        major_data = _build_single_major_data_v2(data, major_id, major_track)
        buckets = major_data["buckets_df"].copy()
        course_map = major_data["course_bucket_map_df"].copy()

        buckets["source_program_id"] = buckets.get("source_program_id", major_id).fillna(major_id).astype(str).str.strip().str.upper()
        buckets["source_bucket_id"] = buckets.get("source_bucket_id", buckets["bucket_id"]).fillna("").astype(str)
        buckets["source_parent_bucket_id"] = buckets.get(
            "source_parent_bucket_id",
            buckets.get("parent_bucket_id", ""),
        ).fillna("").astype(str).str.strip().str.upper()
        core_parent_alias = {
            "BCC": "BCC",
            "MCC": "MCC",
            "BCC_CORE": "BCC",
            "MCC_CORE": "MCC",
            "MCC_FOUNDATION": "MCC",
        }
        source_parent_display = buckets["source_parent_bucket_id"].map(core_parent_alias).fillna(
            buckets["source_parent_bucket_id"]
        )

        is_overlay_bucket = buckets["source_program_id"].isin(universal_programs)
        has_named_core_parent_bucket = is_overlay_bucket & source_parent_display.isin({"BCC", "MCC"})
        buckets.loc[has_named_core_parent_bucket, "bucket_id"] = (
            source_parent_display.loc[has_named_core_parent_bucket].astype(str)
            + "::"
            + buckets.loc[has_named_core_parent_bucket, "source_bucket_id"].astype(str)
        )
        buckets.loc[is_overlay_bucket & ~has_named_core_parent_bucket, "bucket_id"] = (
            buckets.loc[is_overlay_bucket & ~has_named_core_parent_bucket, "source_program_id"].astype(str)
            + "::"
            + buckets.loc[is_overlay_bucket & ~has_named_core_parent_bucket, "source_bucket_id"].astype(str)
        )
        buckets.loc[~is_overlay_bucket, "bucket_id"] = (
            major_id + "::" + buckets.loc[~is_overlay_bucket, "source_bucket_id"].astype(str)
        )
        buckets.loc[~is_overlay_bucket, "bucket_label"] = (
            f"{label_map.get(major_id, major_id)}: "
            + buckets.loc[~is_overlay_bucket, "bucket_label"].astype(str)
        )
        buckets["track_id"] = PHASE5_PLAN_TRACK_ID

        course_map["source_program_id"] = course_map.get("source_program_id", major_id).fillna(major_id).astype(str).str.strip().str.upper()
        course_map["source_bucket_id"] = course_map.get("source_bucket_id", course_map["bucket_id"]).fillna("").astype(str)
        parent_lookup = buckets[
            ["source_program_id", "source_bucket_id", "source_parent_bucket_id"]
        ].drop_duplicates()
        course_map = course_map.merge(
            parent_lookup,
            on=["source_program_id", "source_bucket_id"],
            how="left",
        )
        course_map["source_parent_bucket_id"] = course_map["source_parent_bucket_id"].fillna("").astype(str).str.upper()
        source_parent_map_display = course_map["source_parent_bucket_id"].map(core_parent_alias).fillna(
            course_map["source_parent_bucket_id"]
        )

        is_overlay_map = course_map["source_program_id"].isin(universal_programs)
        has_named_core_parent_map = is_overlay_map & source_parent_map_display.isin({"BCC", "MCC"})
        course_map.loc[has_named_core_parent_map, "bucket_id"] = (
            source_parent_map_display.loc[has_named_core_parent_map].astype(str)
            + "::"
            + course_map.loc[has_named_core_parent_map, "source_bucket_id"].astype(str)
        )
        course_map.loc[is_overlay_map & ~has_named_core_parent_map, "bucket_id"] = (
            course_map.loc[is_overlay_map & ~has_named_core_parent_map, "source_program_id"].astype(str)
            + "::"
            + course_map.loc[is_overlay_map & ~has_named_core_parent_map, "source_bucket_id"].astype(str)
        )
        course_map.loc[~is_overlay_map, "bucket_id"] = (
            major_id + "::" + course_map.loc[~is_overlay_map, "source_bucket_id"].astype(str)
        )
        course_map["track_id"] = PHASE5_PLAN_TRACK_ID

        all_buckets.append(buckets)
        all_maps.append(course_map)

    merged = dict(data)
    if all_buckets:
        merged_buckets = pd.concat(all_buckets, ignore_index=True)
        merged["buckets_df"] = merged_buckets.drop_duplicates(subset=["bucket_id"], keep="first")
    else:
        merged["buckets_df"] = pd.DataFrame(columns=data["buckets_df"].columns)
    if all_maps:
        merged_map = pd.concat(all_maps, ignore_index=True)
        merged["course_bucket_map_df"] = merged_map.drop_duplicates(
            subset=["bucket_id", "course_code"],
            keep="first",
        )
    else:
        merged["course_bucket_map_df"] = pd.DataFrame(columns=data["course_bucket_map_df"].columns)
    return merged


def _build_unknown_track_error(track_id: str):
    return {
        "mode": "error",
        "error": {
            "error_code": "UNKNOWN_TRACK",
            "message": f"Track '{track_id}' is not recognized.",
        },
    }


def _build_unknown_major_error(major_id: str):
    return {
        "mode": "error",
        "error": {
            "error_code": "UNKNOWN_MAJOR",
            "message": f"Major '{major_id}' is not recognized.",
        },
    }


def _normalize_declared_majors(raw_value):
    if raw_value is None:
        return None, None
    if not isinstance(raw_value, list):
        return None, (
            "INVALID_INPUT",
            "declared_majors must be an array of major IDs (e.g., ['FIN_MAJOR']).",
        )
    majors = []
    for item in raw_value:
        code = str(item or "").strip().upper()
        if code:
            majors.append(code)
    majors = list(dict.fromkeys(majors))
    if not majors:
        return None, (
            "INVALID_INPUT",
            "declared_majors cannot be empty when provided.",
        )
    if len(majors) > 2:
        return None, (
            "INVALID_INPUT",
            "MVP limit exceeded: declared_majors supports at most 2 majors.",
        )
    return majors, None


def _resolve_program_selection(body, data: dict):
    """
    Resolve request-scoped plan selection.

    Returns:
      selection dict, None               on success
      None, (payload_dict, status_code)  on error
    """
    catalog_df, legacy_catalog_df, using_v2_catalog = _get_program_catalog(data)
    if "applies_to_all" in catalog_df.columns:
        selectable_catalog_df = catalog_df[catalog_df["applies_to_all"] != True].copy()
    else:
        selectable_catalog_df = catalog_df.copy()
    alias_map = _track_alias_map(selectable_catalog_df)
    label_map = {
        str(r["track_id"]): str(r["track_label"] or r["track_id"])
        for _, r in catalog_df.iterrows()
    }

    def _program_label(program_id: str) -> str:
        return label_map.get(str(program_id), str(program_id))

    declared_majors, parse_error = _normalize_declared_majors(body.get("declared_majors"))
    if parse_error:
        code, msg = parse_error
        return None, ({
            "mode": "error",
            "error": {"error_code": code, "message": msg},
        }, 400)

    # Single-program path (backward compatibility input shape).
    if declared_majors is None:
        raw_track_id = str(body.get("track_id", DEFAULT_TRACK_ID) or DEFAULT_TRACK_ID).strip().upper()
        track_warning = None
        # V2 mode: body.track_id is optional track selection, not major ID.
        if using_v2_catalog:
            major_id = DEFAULT_TRACK_ID
            selected_track_id = None

            # Backward compatibility: explicit default major means "no track".
            if raw_track_id not in ("", "__NONE__", major_id):
                selected_track_id = alias_map.get(raw_track_id, raw_track_id)
                track_row = selectable_catalog_df[selectable_catalog_df["track_id"] == selected_track_id]

                # If V2 does not know this track but legacy does, allow legacy fallback.
                if len(track_row) == 0 and len(legacy_catalog_df) > 0:
                    legacy_row = legacy_catalog_df[legacy_catalog_df["track_id"] == raw_track_id]
                    if len(legacy_row) > 0:
                        return {
                            "mode": "legacy",
                            "declared_majors": None,
                            "declared_major_labels": None,
                            "selected_track_id": raw_track_id,
                            "selected_track_label": str(legacy_row.iloc[0].get("track_label", raw_track_id)),
                            "selected_program_ids": [raw_track_id],
                            "selected_program_labels": [str(legacy_row.iloc[0].get("track_label", raw_track_id))],
                            "program_warnings": [],
                            "track_warning": None,
                            "effective_track_id": raw_track_id,
                            "effective_data": data,
                        }, None

                if len(track_row) == 0:
                    return None, (_build_unknown_track_error(raw_track_id), 400)
                track_row = track_row.iloc[0]
                if track_row["kind"] != "track":
                    return None, (_build_unknown_track_error(raw_track_id), 400)
                if not track_row.get("active", True):
                    track_warning = (
                        f"Track '{_program_label(selected_track_id)}' is not yet published (active=0). "
                        "Results may be incomplete."
                    )

            effective_data = _build_single_major_data_v2(data, major_id, selected_track_id)
            return {
                "mode": "legacy",
                "declared_majors": None,
                "declared_major_labels": None,
                "selected_track_id": selected_track_id,
                "selected_track_label": _program_label(selected_track_id) if selected_track_id else None,
                "selected_program_ids": [major_id] + ([selected_track_id] if selected_track_id else []),
                "selected_program_labels": [_program_label(major_id)] + ([_program_label(selected_track_id)] if selected_track_id else []),
                "program_warnings": [],
                "track_warning": track_warning,
                "effective_track_id": major_id,
                "effective_data": effective_data,
            }, None

        # Legacy catalog path.
        track_id = raw_track_id
        if len(selectable_catalog_df) > 0:
            row = selectable_catalog_df[selectable_catalog_df["track_id"] == track_id]
            if len(row) == 0:
                return None, (_build_unknown_track_error(track_id), 400)
            if not row.iloc[0].get("active", True):
                track_warning = (
                    f"Track '{_program_label(track_id)}' is not yet published (active=0). "
                    "Results may be incomplete."
                )
        elif track_id != DEFAULT_TRACK_ID:
            return None, (_build_unknown_track_error(track_id), 400)

        return {
            "mode": "legacy",
            "declared_majors": None,
            "declared_major_labels": None,
            "selected_track_id": track_id,
            "selected_track_label": _program_label(track_id),
            "selected_program_ids": [track_id],
            "selected_program_labels": [_program_label(track_id)],
            "program_warnings": [],
            "track_warning": track_warning,
            "effective_track_id": track_id,
            "effective_data": data,
        }, None

    # Declared majors path.
    if len(selectable_catalog_df) == 0:
        return None, (_build_unknown_major_error(declared_majors[0]), 400)

    warnings = []
    major_requires_primary = {}
    for major_id in declared_majors:
        row = selectable_catalog_df[selectable_catalog_df["track_id"] == major_id]
        if len(row) == 0 or row.iloc[0]["kind"] != "major":
            return None, (_build_unknown_major_error(major_id), 400)
        major_requires_primary[major_id] = bool(row.iloc[0].get("requires_primary_major", False))
        if not row.iloc[0].get("active", True):
            warnings.append(
                f"Major '{_program_label(major_id)}' is not yet published (active=0). "
                "Results may be incomplete."
            )

    secondary_only_selected = [mid for mid in declared_majors if major_requires_primary.get(mid, False)]
    if secondary_only_selected:
        has_primary = any(not major_requires_primary.get(mid, False) for mid in declared_majors)
        if not has_primary:
            labels = ", ".join([_program_label(mid) for mid in secondary_only_selected])
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "PRIMARY_MAJOR_REQUIRED",
                    "message": f"{labels} must be paired with a primary major.",
                },
            }, 400)

    selected_track_id = None
    raw_track = body.get("track_id", None)
    if raw_track not in (None, "", "__NONE__"):
        selected_track_id = str(raw_track).strip().upper()
        if using_v2_catalog:
            selected_track_id = alias_map.get(selected_track_id, selected_track_id)
        track_row = selectable_catalog_df[selectable_catalog_df["track_id"] == selected_track_id]
        if len(track_row) == 0:
            return None, (_build_unknown_track_error(str(raw_track).strip()), 400)
        track_row = track_row.iloc[0]
        if track_row["kind"] != "track":
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "INVALID_INPUT",
                    "message": f"track_id '{selected_track_id}' is not a track.",
                },
            }, 400)
        parent_major_id = str(track_row.get("parent_major_id", "") or "").strip().upper()
        if parent_major_id and parent_major_id not in declared_majors:
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "TRACK_MAJOR_MISMATCH",
                    "message": (
                        f"Track '{_program_label(selected_track_id)}' does not belong to declared majors "
                        f"{[_program_label(mid) for mid in declared_majors]}."
                    ),
                },
            }, 400)
        if not track_row.get("active", True):
            warnings.append(
                f"Track '{_program_label(selected_track_id)}' is not yet published (active=0). "
                "Results may be incomplete."
            )

    selected_program_ids = list(dict.fromkeys(
        declared_majors + ([selected_track_id] if selected_track_id else [])
    ))
    if using_v2_catalog:
        effective_data = _build_declared_plan_data_v2(
            data,
            declared_majors,
            selected_track_id,
            catalog_df,
        )
    else:
        effective_data = _build_declared_plan_data(data, selected_program_ids, catalog_df)
    selected_program_labels = [_program_label(pid) for pid in selected_program_ids]
    declared_major_labels = [_program_label(mid) for mid in declared_majors]
    selected_track_label = _program_label(selected_track_id) if selected_track_id else None

    return {
        "mode": "declared",
        "declared_majors": declared_majors,
        "declared_major_labels": declared_major_labels,
        "selected_track_id": selected_track_id,
        "selected_track_label": selected_track_label,
        "selected_program_ids": selected_program_ids,
        "selected_program_labels": selected_program_labels,
        "program_warnings": warnings,
        "track_warning": None,
        "effective_track_id": PHASE5_PLAN_TRACK_ID,
        "effective_data": effective_data,
    }, None


def _build_declared_plan_data(data: dict, selected_program_ids: list[str], catalog_df: pd.DataFrame) -> dict:
    """Build synthetic single-track data view for merged major/track planning."""
    label_map = {
        r["track_id"]: r["track_label"]
        for _, r in catalog_df.iterrows()
    }
    selected_set = set(selected_program_ids)

    buckets = data["buckets_df"][data["buckets_df"]["track_id"].isin(selected_set)].copy()
    course_map = data["course_bucket_map_df"][
        data["course_bucket_map_df"]["track_id"].isin(selected_set)
    ].copy()

    buckets["source_program_id"] = buckets["track_id"].astype(str)
    buckets["source_bucket_id"] = buckets["bucket_id"].astype(str)
    buckets["bucket_id"] = (
        buckets["source_program_id"].astype(str)
        + "::"
        + buckets["source_bucket_id"].astype(str)
    )
    buckets["bucket_label"] = buckets.apply(
        lambda r: (
            f"{label_map.get(str(r['source_program_id']), str(r['source_program_id']))}: "
            f"{str(r.get('bucket_label', r['source_bucket_id']))}"
        ),
        axis=1,
    )
    buckets["track_id"] = PHASE5_PLAN_TRACK_ID

    course_map["source_program_id"] = course_map["track_id"].astype(str)
    course_map["source_bucket_id"] = course_map["bucket_id"].astype(str)
    course_map["bucket_id"] = (
        course_map["source_program_id"].astype(str)
        + "::"
        + course_map["source_bucket_id"].astype(str)
    )
    course_map["track_id"] = PHASE5_PLAN_TRACK_ID

    merged = dict(data)
    merged["buckets_df"] = buckets
    merged["course_bucket_map_df"] = course_map
    return merged


def _dedupe_codes(codes):
    return list(dict.fromkeys([c for c in codes if c]))


def _build_current_progress(completed, in_progress, data, track_id):
    """
    Build current progress snapshot using:
      - completed-only counts
      - completed+in-progress assumed counts
    """
    completed_only_alloc = allocate_courses(
        completed,
        in_progress,
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )
    assumed_alloc = allocate_courses(
        _dedupe_codes(completed + in_progress),
        [],
        data["buckets_df"],
        data["course_bucket_map_df"],
        data["courses_df"],
        data["equivalencies_df"],
        track_id=track_id,
        double_count_policy_df=data.get("v2_double_count_policy_df"),
    )

    bucket_order = list(dict.fromkeys(
        completed_only_alloc.get("bucket_order", [])
        + assumed_alloc.get("bucket_order", [])
        + list(completed_only_alloc.get("applied_by_bucket", {}).keys())
        + list(assumed_alloc.get("applied_by_bucket", {}).keys())
    ))

    out = {}
    for bucket_id in bucket_order:
        baseline = completed_only_alloc.get("applied_by_bucket", {}).get(bucket_id, {})
        assumed = assumed_alloc.get("applied_by_bucket", {}).get(bucket_id, {})

        completed_done = len(baseline.get("completed_applied", []))
        assumed_done = len(assumed.get("completed_applied", []))
        in_progress_increment = max(0, assumed_done - completed_done)

        out[bucket_id] = {
            "label": str(assumed.get("label") or baseline.get("label") or bucket_id),
            "needed": assumed.get("needed", baseline.get("needed")),
            "completed_done": completed_done,
            "in_progress_increment": in_progress_increment,
            "assumed_done": assumed_done,
            "satisfied": bool(assumed.get("satisfied", baseline.get("satisfied", False))),
        }
    return out


def _build_current_assumption_notes(
    completed_assumption_rows,
    in_progress_assumption_rows,
):
    """
    Build user-facing inference notes from completed and in-progress
    provenance rows.
    """
    notes = []
    for row in completed_assumption_rows or []:
        source_course = str(row.get("source_completed") or "").strip()
        assumed = sorted(list(dict.fromkeys(row.get("assumed_prereqs") or [])))
        already_completed = sorted(list(dict.fromkeys(row.get("already_completed_prereqs") or [])))
        if not source_course or not assumed:
            continue

        note = f"Assumed {', '.join(assumed)} because {source_course} is completed."
        if already_completed:
            note += f" Already completed in that chain: {', '.join(already_completed)}."
        notes.append(note)

    for row in in_progress_assumption_rows or []:
        source_course = str(row.get("source_in_progress") or "").strip()
        assumed = sorted(list(dict.fromkeys(row.get("assumed_prereqs") or [])))
        already_completed = sorted(list(dict.fromkeys(row.get("already_completed_prereqs") or [])))
        if not source_course or not assumed:
            continue

        note = f"Assumed {', '.join(assumed)} because {source_course} is in progress."
        if already_completed:
            note += f" Already completed in that chain: {', '.join(already_completed)}."
        notes.append(note)

    if notes:
        notes.append(
            "Inference scope: required chains only (single/and). "
            "OR and concurrent-optional prereqs are not auto-assumed."
        )
    return notes


def _promote_inferred_in_progress_prereqs_to_completed(completed, in_progress, assumption_rows):
    """
    Promote inferred prerequisites from in-progress chains into completed.

    Rationale: if course Y is currently in progress and X is a required prereq
    for Y, X is treated as already completed for progress display and ranking.
    """
    inferred = []
    for row in assumption_rows or []:
        inferred.extend(row.get("assumed_prereqs") or [])
    inferred_set = set(inferred)

    promoted_completed = _dedupe_codes(completed + sorted(inferred_set))
    remaining_in_progress = [c for c in in_progress if c not in inferred_set]
    return promoted_completed, remaining_in_progress


# â”€â”€ 500 handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@app.errorhandler(Exception)
def handle_unexpected_error(e):
    return jsonify({
        "mode": "error",
        "error": {
            "error_code": "SERVER_ERROR",
            "message": "An unexpected server error occurred.",
        },
    }), 500


# â”€â”€ Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route("/courses", methods=["GET"])
def get_courses():
    _refresh_data_if_needed()
    if not _data:
        return jsonify({"error": "Data not loaded"}), 500
    cols = ["course_code", "course_name", "credits", "level", "prereq_level"]
    df = _data["courses_df"].copy()
    for col in cols:
        if col not in df.columns:
            df[col] = None
    df = df[cols].dropna(subset=["course_code"])
    # Ensure JSON-safe numeric class level for frontend search ranking.
    level_numeric = pd.to_numeric(df["level"], errors="coerce")
    df["level"] = pd.Series(
        [int(v) if pd.notna(v) else None for v in level_numeric],
        index=df.index,
        dtype=object,
    )
    # Ensure JSON-safe numeric ordering field for frontend search ranking.
    prereq_numeric = pd.to_numeric(df["prereq_level"], errors="coerce")
    df["prereq_level"] = pd.Series(
        [int(v) if pd.notna(v) else None for v in prereq_numeric],
        index=df.index,
        dtype=object,
    )
    # Convert to object dtype so None survives instead of being re-coerced to NaN.
    df = df.astype(object).where(pd.notna(df), None)
    return jsonify({"courses": df.to_dict(orient="records")})


@app.route("/programs", methods=["GET"])
def get_programs():
    """Return published program catalog for the major/track selector."""
    _refresh_data_if_needed()
    if not _data:
        return jsonify({"error": "Data not loaded"}), 500

    catalog_df, _, _ = _get_program_catalog(_data)
    if len(catalog_df) == 0:
        return jsonify({
            "majors": [],
            "tracks": [],
            "default_track_id": DEFAULT_TRACK_ID,
        })

    publishable = catalog_df[catalog_df.get("applies_to_all", False) != True].copy()
    majors = publishable[publishable["kind"] == "major"].sort_values("track_id", kind="stable")
    tracks = publishable[publishable["kind"] == "track"].sort_values("track_id", kind="stable")

    majors_payload = [
        {
            "major_id": str(row["track_id"]),
            "label": str(row.get("track_label", row["track_id"])),
            "active": bool(row.get("active", True)),
            "requires_primary_major": bool(row.get("requires_primary_major", False)),
        }
        for _, row in majors.iterrows()
    ]
    tracks_payload = [
        {
            "track_id": str(row["track_id"]),
            "label": str(row.get("track_label", row["track_id"])),
            "parent_major_id": str(row.get("parent_major_id", "") or ""),
            "active": bool(row.get("active", True)),
        }
        for _, row in tracks.iterrows()
    ]

    return jsonify({
        "majors": majors_payload,
        "tracks": tracks_payload,
        "default_track_id": DEFAULT_TRACK_ID,
    })


@app.route("/recommend", methods=["POST"])
def recommend():
    _refresh_data_if_needed()
    if not _data:
        return jsonify({"mode": "error", "error": {"error_code": "SERVER_ERROR", "message": "Data not loaded."}}), 500

    body = request.get_json(force=True, silent=True)
    err_code, err_msg = _validate_recommend_body(body)
    if err_code:
        return jsonify({
            "mode": "error",
            "error": {"error_code": err_code, "message": err_msg},
        }), 400

    # Recommendations require an explicit major selection from the UI.
    # Keep backward-compatible track-only calls only when a track_id is provided.
    declared_majors_raw = body.get("declared_majors", None)
    track_raw = body.get("track_id", None)
    has_track_context = str(track_raw).strip().upper() not in {"", "__NONE__", "NONE"}
    if declared_majors_raw is None and not has_track_context:
        return jsonify({
            "mode": "error",
            "error": {
                "error_code": "INVALID_INPUT",
                "message": "Select at least one major before requesting recommendations.",
            },
        }), 400

    selection, selection_error = _resolve_program_selection(body, _data)
    if selection_error:
        payload, status = selection_error
        return jsonify(payload), status

    effective_data = selection["effective_data"]
    effective_track_id = selection["effective_track_id"]
    track_warning = selection["track_warning"]

    completed_raw = str(body.get("completed_courses", "") or "")
    in_progress_raw = str(body.get("in_progress_courses", "") or "")
    target_semester_primary = str(
        body.get("target_semester_primary")
        or body.get("target_semester")
        or "Spring 2026"
    )
    target_semester_primary = normalize_semester_label(target_semester_primary)

    def _parse_optional_semester(raw_value):
        if raw_value is None:
            return None
        raw = str(raw_value).strip()
        if raw == "__NONE__":
            return "__NONE__"
        return normalize_semester_label(raw) if raw else None

    target_semester_secondary = _parse_optional_semester(body.get("target_semester_secondary"))
    target_semester_tertiary = _parse_optional_semester(body.get("target_semester_tertiary"))
    target_semester_quaternary = _parse_optional_semester(body.get("target_semester_quaternary"))

    target_semester_count_raw = body.get("target_semester_count")
    if target_semester_count_raw in (None, ""):
        # Backward compatibility for legacy second/third-term controls.
        if target_semester_secondary == "__NONE__":
            target_semester_count = 1
        elif target_semester_tertiary == "__NONE__":
            target_semester_count = 2
        elif target_semester_quaternary == "__NONE__":
            target_semester_count = 3
        else:
            target_semester_count = 3
    else:
        target_semester_count = max(1, min(4, int(target_semester_count_raw)))

    requested_course_raw = body.get("requested_course") or None
    max_recs = max(1, min(6, int(body.get("max_recommendations", 3) or 3)))
    debug_mode = bool(body.get("debug", False))
    debug_limit = max(1, min(100, int(body.get("debug_limit", 30) or 30)))

    catalog_codes = effective_data["catalog_codes"]

    comp_result = normalize_input(completed_raw, catalog_codes)
    ip_result = normalize_input(in_progress_raw, catalog_codes)

    if comp_result["invalid"] or ip_result["invalid"]:
        return jsonify({
            "mode": "error",
            "recommendations": None,
            "error": {
                "error_code": "INVALID_INPUT",
                "message": "Some course codes could not be recognized.",
                "invalid_courses": comp_result["invalid"] + ip_result["invalid"],
                "not_in_catalog": comp_result["not_in_catalog"] + ip_result["not_in_catalog"],
            },
        })

    completed = comp_result["valid"]
    in_progress = ip_result["valid"]
    not_in_catalog_warn = comp_result["not_in_catalog"] + ip_result["not_in_catalog"]

    inconsistencies = find_inconsistent_completed_courses(
        completed, in_progress, effective_data["prereq_map"]
    )
    if inconsistencies:
        return jsonify({
            "mode": "error",
            "error": {
                "error_code": "INCONSISTENT_INPUT",
                "message": (
                    "Some completed courses have prerequisites that are still in-progress. "
                    "A course cannot be completed before its prerequisite is done."
                ),
                "inconsistent_courses": inconsistencies,
            },
        }), 400

    completed, completed_assumption_rows = expand_completed_with_prereqs_with_provenance(
        completed,
        effective_data["prereq_map"],
    )
    in_progress, assumption_rows = expand_in_progress_with_prereqs(
        in_progress,
        completed,
        effective_data["prereq_map"],
    )
    completed, in_progress = _promote_inferred_in_progress_prereqs_to_completed(
        completed,
        in_progress,
        assumption_rows,
    )
    current_assumption_notes = _build_current_assumption_notes(
        completed_assumption_rows,
        assumption_rows,
    )
    current_progress = _build_current_progress(
        completed,
        in_progress,
        effective_data,
        effective_track_id,
    )

    try:
        target_term = parse_term(target_semester_primary)
    except ValueError:
        target_term = "Fall"

    requested_course = None
    if requested_course_raw:
        requested_course = normalize_code(str(requested_course_raw).strip())
        if requested_course and requested_course not in catalog_codes:
            return jsonify({
                "mode": "error",
                "error": {
                    "error_code": "INVALID_INPUT",
                    "message": f"{requested_course} is not in the course catalog.",
                    "invalid_courses": [],
                    "not_in_catalog": [requested_course],
                },
            })

    if requested_course:
        result = check_can_take(
            requested_course,
            effective_data["courses_df"],
            completed,
            in_progress,
            target_term,
            effective_data["prereq_map"],
        )

    explicit_labels = [
        target_semester_secondary,
        target_semester_tertiary,
        target_semester_quaternary,
    ]
    semester_labels = [target_semester_primary]
    while len(semester_labels) < target_semester_count:
        idx = len(semester_labels)  # 1-based semester offset from primary
        explicit = explicit_labels[idx - 1] if idx - 1 < len(explicit_labels) else None
        if explicit and explicit != "__NONE__":
            semester_labels.append(explicit)
        else:
            semester_labels.append(default_followup_semester(semester_labels[-1]))

    semesters_payload = []
    completed_cursor = list(dict.fromkeys(completed + in_progress))
    for idx, semester_label in enumerate(semester_labels):
        if idx == 0:
            semester_payload = run_recommendation_semester(
                completed,
                in_progress,
                semester_label,
                effective_data,
                max_recs,
                _reverse_map,
                track_id=effective_track_id,
                debug=debug_mode,
                debug_limit=debug_limit,
            )
        else:
            semester_payload = run_recommendation_semester(
                completed_cursor,
                [],
                semester_label,
                effective_data,
                max_recs,
                _reverse_map,
                track_id=effective_track_id,
                debug=debug_mode,
                debug_limit=debug_limit,
            )
        semesters_payload.append(semester_payload)
        completed_cursor = list(dict.fromkeys(
            completed_cursor + [
                r["course_code"]
                for r in semester_payload.get("recommendations", [])
                if r.get("course_code")
            ]
        ))

    sem1 = semesters_payload[0]

    response = {
        "mode": "recommendations",
        "semesters": semesters_payload,
        **sem1,
        "current_progress": current_progress,
        "current_assumption_notes": current_assumption_notes,
        "not_in_catalog_warning": not_in_catalog_warn if not_in_catalog_warn else None,
        "error": None,
    }
    if selection["mode"] == "declared":
        response["selection_context"] = {
            "declared_majors": selection["declared_majors"],
            "declared_major_labels": selection["declared_major_labels"],
            "selected_track_id": selection["selected_track_id"],
            "selected_track_label": selection["selected_track_label"],
            "selected_program_ids": selection["selected_program_ids"],
            "selected_program_labels": selection["selected_program_labels"],
        }
        if selection["program_warnings"]:
            response["program_warnings"] = selection["program_warnings"]
    if track_warning:
        response["track_warning"] = track_warning
    return jsonify(response)

@app.route("/can-take", methods=["POST"])
def can_take_endpoint():
    """Standalone eligibility check for a single course. Does not run recommendations."""
    _refresh_data_if_needed()
    if not _data:
        return jsonify({"mode": "can_take", "error": "Data not loaded."}), 500

    body = request.get_json(force=True, silent=True)
    if not body:
        return jsonify({"mode": "can_take", "error": "Invalid JSON body."}), 400

    requested_course_raw = str(body.get("requested_course") or "").strip()
    if not requested_course_raw:
        return jsonify({"mode": "can_take", "error": "requested_course is required."}), 400

    requested_course = normalize_code(requested_course_raw)
    if not requested_course or requested_course not in _data["catalog_codes"]:
        return jsonify({
            "mode": "can_take",
            "requested_course": requested_course or requested_course_raw,
            "can_take": False,
            "why_not": f"{requested_course or requested_course_raw} is not in the course catalog.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
            "next_best_alternatives": [],
        })

    # Normalize completed / in-progress course lists (same logic as /recommend)
    catalog_codes = _data["catalog_codes"]
    comp_result = normalize_input(str(body.get("completed_courses", "") or ""), catalog_codes)
    ip_result = normalize_input(str(body.get("in_progress_courses", "") or ""), catalog_codes)
    completed = comp_result["valid"]
    in_progress = ip_result["valid"]

    # Resolve target term
    target_semester_raw = str(body.get("target_semester") or "Spring 2026").strip()
    try:
        target_semester_norm = normalize_semester_label(target_semester_raw)
        target_term = parse_term(target_semester_norm)
    except (ValueError, AttributeError):
        target_term = "Fall"

    # Optional program context (ignored if malformed)
    selection, selection_error = _resolve_program_selection(body, _data)
    effective_data = _data if selection_error else selection["effective_data"]

    # Expand prereq chains (mirrors /recommend pipeline)
    completed, _ = expand_completed_with_prereqs_with_provenance(
        completed, effective_data["prereq_map"]
    )
    in_progress, assumption_rows = expand_in_progress_with_prereqs(
        in_progress, completed, effective_data["prereq_map"]
    )
    completed, in_progress = _promote_inferred_in_progress_prereqs_to_completed(
        completed,
        in_progress,
        assumption_rows,
    )

    # "Can I Take This Next Semester?" semantics:
    # treat currently in-progress courses as completed by next term.
    completed_for_next_term = _dedupe_codes(completed + in_progress)

    result = check_can_take(
        requested_course,
        effective_data["courses_df"],
        completed_for_next_term,
        [],
        target_term,
        effective_data["prereq_map"],
    )

    return jsonify({
        "mode": "can_take",
        "requested_course": requested_course,
        "can_take": result["can_take"],
        "why_not": result["why_not"],
        "missing_prereqs": result["missing_prereqs"],
        "not_offered_this_term": result["not_offered_this_term"],
        "unsupported_prereq_format": result["unsupported_prereq_format"],
        "next_best_alternatives": [],
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
