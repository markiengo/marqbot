import os
import sys

# Ensure backend/ is on sys.path so sibling imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv

from normalizer import normalize_code, normalize_input
from requirements import DEFAULT_TRACK_ID
from allocator import allocate_courses
from validators import find_inconsistent_completed_courses, expand_completed_with_prereqs
from unlocks import build_reverse_prereq_map
from eligibility import check_can_take, parse_term, get_eligible_courses
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

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
DATA_PATH = os.environ.get(
    "DATA_PATH",
    os.path.join(PROJECT_ROOT, "marquette_courses_full.xlsx"),
)

# ── Startup data load ──────────────────────────────────────────────────────────
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


# ── Input validation ───────────────────────────────────────────────────────────
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


# ── 500 handler ────────────────────────────────────────────────────────────────
@app.errorhandler(Exception)
def handle_unexpected_error(e):
    return jsonify({
        "mode": "error",
        "error": {
            "error_code": "SERVER_ERROR",
            "message": "An unexpected server error occurred.",
        },
    }), 500


# ── Routes ─────────────────────────────────────────────────────────────────────
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
    cols = ["course_code", "course_name", "credits"]
    df = _data["courses_df"][cols].dropna(subset=["course_code"])
    return jsonify({"courses": df.to_dict(orient="records")})


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

    # ── Track validation ─────────────────────────────────────────────────
    track_id = str(body.get("track_id", DEFAULT_TRACK_ID) or DEFAULT_TRACK_ID).strip().upper()
    track_warning = None
    tracks_df = _data.get("tracks_df")
    if tracks_df is not None and len(tracks_df) > 0:
        # Normalize both sides so workbook casing/spacing does not break matching.
        normalized_track_ids = tracks_df["track_id"].astype(str).str.strip().str.upper()
        track_row = tracks_df[normalized_track_ids == track_id]
        if len(track_row) == 0:
            return jsonify({
                "mode": "error",
                "error": {
                    "error_code": "UNKNOWN_TRACK",
                    "message": f"Track '{track_id}' is not recognized.",
                },
            }), 400
        if not track_row.iloc[0].get("active", True):
            track_warning = f"Track '{track_id}' is not yet published (active=0). Results may be incomplete."
    elif track_id != DEFAULT_TRACK_ID:
        # No tracks sheet — only the default track is accepted
        return jsonify({
            "mode": "error",
            "error": {
                "error_code": "UNKNOWN_TRACK",
                "message": f"Track '{track_id}' is not recognized.",
            },
        }), 400

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

    catalog_codes = _data["catalog_codes"]

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
        completed, in_progress, _data["prereq_map"]
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

    # Infer implied completed prereqs: if FINA 3001 is completed, ACCO 1031 must be too.
    completed = expand_completed_with_prereqs(completed, _data["prereq_map"])

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

    allocation = allocate_courses(
        completed,
        in_progress,
        _data["buckets_df"],
        _data["course_bucket_map_df"],
        _data["courses_df"],
        _data["equivalencies_df"],
        track_id=track_id,
    )

    if requested_course:
        result = check_can_take(
            requested_course,
            _data["courses_df"],
            completed,
            in_progress,
            target_term,
            _data["prereq_map"],
        )

    sem1 = run_recommendation_semester(
        completed, in_progress, target_semester_primary,
        _data, max_recs, _reverse_map, USE_OPENAI_EXPLANATIONS,
        track_id=track_id,
    )
    semesters_payload = [sem1]
    if target_semester_secondary != "__NONE__":
        second_label = target_semester_secondary or default_followup_semester(target_semester_primary)
        completed_for_sem2 = list(dict.fromkeys(
            completed + in_progress + [r["course_code"] for r in sem1["recommendations"] if r.get("course_code")]
        ))
        sem2 = run_recommendation_semester(
            completed_for_sem2, [], second_label,
            _data, max_recs, _reverse_map, USE_OPENAI_EXPLANATIONS,
            track_id=track_id,
        )
        semesters_payload.append(sem2)

    response = {
        "mode": "recommendations",
        "semesters": semesters_payload,
        **sem1,
        "not_in_catalog_warning": not_in_catalog_warn if not_in_catalog_warn else None,
        "error": None,
    }
    if track_warning:
        response["track_warning"] = track_warning
    return jsonify(response)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
