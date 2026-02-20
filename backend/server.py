import os
import sys

# Ensure backend/ is on sys.path so sibling imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

from normalizer import normalize_code, normalize_input
from requirements import DEFAULT_TRACK_ID
from validators import find_inconsistent_completed_courses, expand_completed_with_prereqs
from unlocks import build_reverse_prereq_map
from eligibility import check_can_take, parse_term
from data_loader import load_data
from semester_recommender import (
    SEM_RE,
    normalize_semester_label,
    default_followup_semester,
    run_recommendation_semester,
)

load_dotenv()

app = Flask(__name__)
USE_OPENAI_EXPLANATIONS = os.environ.get("USE_OPENAI_EXPLANATIONS", "0") == "1"

# â”€â”€ Paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
DATA_PATH = os.environ.get(
    "DATA_PATH",
    os.path.join(PROJECT_ROOT, "marquette_courses_full.xlsx"),
)

# â”€â”€ Startup data load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
try:
    _data = load_data(DATA_PATH)
    print(f"[OK] Loaded {len(_data['catalog_codes'])} courses from {DATA_PATH}")
except FileNotFoundError:
    print(f"[FATAL] Data file not found: {DATA_PATH}", file=sys.stderr)
    sys.exit(1)
except Exception as exc:
    print(f"[FATAL] Failed to load data: {exc}", file=sys.stderr)
    sys.exit(1)

_reverse_map = build_reverse_prereq_map(_data["courses_df"], _data["prereq_map"])


# â”€â”€ Input validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _validate_recommend_body(body):
    """Returns (error_code, message) on invalid input, (None, None) on success."""
    if body is None:
        return "INVALID_INPUT", "Request body must be valid JSON."
    max_recs_raw = body.get("max_recommendations", 3)
    try:
        max_recs = int(max_recs_raw)
        if not (1 <= max_recs <= 4):
            raise ValueError
    except (TypeError, ValueError):
        return "INVALID_INPUT", "max_recommendations must be an integer between 1 and 4."
    for field in ("target_semester_primary", "target_semester", "target_semester_secondary"):
        val = body.get(field)
        if val and val not in ("", "__NONE__") and not SEM_RE.match(str(val).strip()):
            return "INVALID_INPUT", f"'{field}' value '{val}' is not a valid semester (e.g. 'Spring 2026')."
    return None, None


PHASE5_PLAN_TRACK_ID = "__DECLARED_PLAN__"


def _normalize_program_catalog(tracks_df):
    """Return normalized program catalog dataframe used by /programs and /recommend."""
    if tracks_df is None or len(tracks_df) == 0:
        return pd.DataFrame(columns=["track_id", "track_label", "active", "kind", "parent_major_id"])

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

    df["track_id"] = df["track_id"].astype(str).str.strip().str.upper()
    df["track_label"] = df["track_label"].fillna("").astype(str).str.strip()
    df["parent_major_id"] = df["parent_major_id"].fillna("").astype(str).str.strip().str.upper()
    df["active"] = df["active"].apply(bool)

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

    return df[["track_id", "track_label", "active", "kind", "parent_major_id"]]


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


def _resolve_program_selection(body, tracks_df):
    """
    Resolve request-scoped plan selection.

    Returns:
      selection dict, None               on success
      None, (payload_dict, status_code)  on error
    """
    catalog_df = _normalize_program_catalog(tracks_df)
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

    # Legacy single-program path (backward compatibility).
    if declared_majors is None:
        track_id = str(body.get("track_id", DEFAULT_TRACK_ID) or DEFAULT_TRACK_ID).strip().upper()
        track_warning = None
        if len(catalog_df) > 0:
            row = catalog_df[catalog_df["track_id"] == track_id]
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
            "effective_data": _data,
        }, None

    # Phase 5 path: multiple majors + optional single track.
    if len(catalog_df) == 0:
        return None, (_build_unknown_major_error(declared_majors[0]), 400)

    warnings = []
    for major_id in declared_majors:
        row = catalog_df[catalog_df["track_id"] == major_id]
        if len(row) == 0 or row.iloc[0]["kind"] != "major":
            return None, (_build_unknown_major_error(major_id), 400)
        if not row.iloc[0].get("active", True):
            warnings.append(
                f"Major '{_program_label(major_id)}' is not yet published (active=0). "
                "Results may be incomplete."
            )

    selected_track_id = None
    raw_track = body.get("track_id", None)
    if raw_track not in (None, "", "__NONE__"):
        selected_track_id = str(raw_track).strip().upper()
        track_row = catalog_df[catalog_df["track_id"] == selected_track_id]
        if len(track_row) == 0:
            return None, (_build_unknown_track_error(selected_track_id), 400)
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
    effective_data = _build_declared_plan_data(_data, selected_program_ids, catalog_df)
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
    if not _data:
        return jsonify({"error": "Data not loaded"}), 500
    cols = ["course_code", "course_name", "credits", "prereq_level"]
    df = _data["courses_df"].copy()
    for col in cols:
        if col not in df.columns:
            df[col] = None
    df = df[cols].dropna(subset=["course_code"])
    # Ensure JSON-safe numeric ordering field for frontend search ranking.
    df["prereq_level"] = pd.to_numeric(df["prereq_level"], errors="coerce")
    df["prereq_level"] = df["prereq_level"].apply(
        lambda v: int(v) if pd.notna(v) else None
    )
    return jsonify({"courses": df.to_dict(orient="records")})


@app.route("/programs", methods=["GET"])
def get_programs():
    """Return published program catalog for Phase 5 selector UX."""
    if not _data:
        return jsonify({"error": "Data not loaded"}), 500

    catalog_df = _normalize_program_catalog(_data.get("tracks_df"))
    if len(catalog_df) == 0:
        return jsonify({
            "majors": [],
            "tracks": [],
            "default_track_id": DEFAULT_TRACK_ID,
        })

    majors = catalog_df[catalog_df["kind"] == "major"].sort_values("track_id", kind="stable")
    tracks = catalog_df[catalog_df["kind"] == "track"].sort_values("track_id", kind="stable")

    majors_payload = [
        {
            "major_id": str(row["track_id"]),
            "label": str(row.get("track_label", row["track_id"])),
            "active": bool(row.get("active", True)),
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
    if not _data:
        return jsonify({"mode": "error", "error": {"error_code": "SERVER_ERROR", "message": "Data not loaded."}}), 500

    body = request.get_json(force=True, silent=True)
    err_code, err_msg = _validate_recommend_body(body)
    if err_code:
        return jsonify({
            "mode": "error",
            "error": {"error_code": err_code, "message": err_msg},
        }), 400

    selection, selection_error = _resolve_program_selection(body, _data.get("tracks_df"))
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

    target_semester_secondary = body.get("target_semester_secondary")
    target_semester_secondary = str(target_semester_secondary).strip() if target_semester_secondary is not None else None
    if target_semester_secondary == "__NONE__":
        target_semester_secondary = "__NONE__"
    else:
        target_semester_secondary = (
            normalize_semester_label(target_semester_secondary)
            if target_semester_secondary
            else None
        )

    requested_course_raw = body.get("requested_course") or None
    max_recs = max(1, min(4, int(body.get("max_recommendations", 3) or 3)))

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

    completed = expand_completed_with_prereqs(completed, effective_data["prereq_map"])

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

    sem1 = run_recommendation_semester(
        completed, in_progress, target_semester_primary,
        effective_data, max_recs, _reverse_map, USE_OPENAI_EXPLANATIONS,
        track_id=effective_track_id,
    )
    semesters_payload = [sem1]
    if target_semester_secondary != "__NONE__":
        second_label = target_semester_secondary or default_followup_semester(target_semester_primary)
        completed_for_sem2 = list(dict.fromkeys(
            completed + in_progress + [r["course_code"] for r in sem1["recommendations"] if r.get("course_code")]
        ))
        sem2 = run_recommendation_semester(
            completed_for_sem2, [], second_label,
            effective_data, max_recs, _reverse_map, USE_OPENAI_EXPLANATIONS,
            track_id=effective_track_id,
        )
        semesters_payload.append(sem2)

    response = {
        "mode": "recommendations",
        "semesters": semesters_payload,
        **sem1,
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

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
