import os
import sys
import json

# Ensure backend/ is on sys.path so sibling imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, send_from_directory
import pandas as pd
from dotenv import load_dotenv
import anthropic

from normalizer import normalize_code, normalize_input
from prereq_parser import parse_prereqs
from requirements import TRACK_ID, SOFT_WARNING_TAGS, BLOCKING_WARNING_THRESHOLD
from allocator import allocate_courses
from unlocks import build_reverse_prereq_map, get_direct_unlocks, get_blocking_warnings
from timeline import estimate_timeline
from eligibility import get_eligible_courses, check_can_take, parse_term
from prompt_builder import build_prompt, SYSTEM_PROMPT

load_dotenv()

app = Flask(__name__)

# ── Paths ────────────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(PROJECT_ROOT, "frontend")
DATA_PATH = os.environ.get(
    "DATA_PATH",
    os.path.join(PROJECT_ROOT, "marquette_courses_full.xlsx"),
)

# ── Data loading ─────────────────────────────────────────────────────────────

def _safe_bool_col(df: pd.DataFrame, col: str) -> pd.DataFrame:
    """Normalize a boolean column to Python bool regardless of Excel format."""
    if col in df.columns:
        df[col] = df[col].apply(
            lambda x: str(x).strip().upper() == "TRUE" if pd.notna(x) else False
        )
    return df


def load_data() -> dict:
    xl = pd.ExcelFile(DATA_PATH)
    sheet_names = xl.sheet_names

    courses_df = xl.parse("courses")
    equivalencies_df = xl.parse("equivalencies") if "equivalencies" in sheet_names else pd.DataFrame()
    buckets_df = xl.parse("buckets")
    course_bucket_map_df = xl.parse(
        "bucket_course_map"
        if "bucket_course_map" in sheet_names
        else next(s for s in sheet_names if "bucket" in s.lower() and "map" in s.lower())
    )

    # Normalize bool columns
    for col in ["offered_fall", "offered_spring", "offered_summer"]:
        courses_df = _safe_bool_col(courses_df, col)
    for col in ["can_double_count", "is_required"]:
        course_bucket_map_df = _safe_bool_col(course_bucket_map_df, col)
    for col in ["allow_double_count"]:
        buckets_df = _safe_bool_col(buckets_df, col)

    # Ensure string columns are clean
    courses_df["course_code"] = courses_df["course_code"].astype(str).str.strip()
    courses_df["prereq_hard"] = courses_df.get("prereq_hard", pd.Series(dtype=str)).fillna("none")
    courses_df["prereq_soft"] = courses_df.get("prereq_soft", pd.Series(dtype=str)).fillna("")

    # Build course catalog set
    catalog_codes = set(courses_df["course_code"].tolist())

    # Build prereq map: course_code → parsed prereq dict
    prereq_map: dict = {}
    for _, row in courses_df.iterrows():
        code = row["course_code"]
        prereq_map[code] = parse_prereqs(row.get("prereq_hard", "none"))

    # ── Startup data integrity checks ─────────────────────────────────────────
    map_codes = set(course_bucket_map_df["course_code"].astype(str).str.strip().tolist())
    orphaned = map_codes - catalog_codes
    if orphaned:
        print(f"[WARN] {len(orphaned)} course(s) in bucket_course_map not found in courses sheet: {sorted(orphaned)}")

    map_buckets = set(course_bucket_map_df["bucket_id"].astype(str).str.strip().tolist())
    defined_buckets = set(buckets_df["bucket_id"].astype(str).str.strip().tolist())
    orphaned_buckets = map_buckets - defined_buckets
    if orphaned_buckets:
        print(f"[WARN] {len(orphaned_buckets)} bucket_id(s) in map not found in buckets sheet: {sorted(orphaned_buckets)}")

    return {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_bucket_map_df,
        "catalog_codes": catalog_codes,
        "prereq_map": prereq_map,
    }


_data: dict = {}
try:
    _data = load_data()
    print(f"[OK] Loaded {len(_data['catalog_codes'])} courses from {DATA_PATH}")
except Exception as exc:
    print(f"[ERROR] Failed to load data: {exc}")


# ── Anthropic client ─────────────────────────────────────────────────────────
def get_claude_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")
    return anthropic.Anthropic(api_key=api_key)


def call_claude(
    candidates: list[dict],
    completed: list[str],
    in_progress: list[str],
    target_semester: str,
    max_recommendations: int,
) -> list[dict]:
    """Calls Claude Haiku with pre-filtered candidates. Returns parsed JSON recommendations."""
    client = get_claude_client()
    user_msg = build_prompt(candidates, completed, in_progress, target_semester, max_recommendations)

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    # Strip markdown code fences if Claude wraps the JSON
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    recommendations = json.loads(raw)

    # Re-attach fields Claude shouldn't change but might have dropped
    code_to_candidate = {c["course_code"]: c for c in candidates}
    enriched = []
    for rec in recommendations:
        code = rec.get("course_code")
        original = code_to_candidate.get(code, {})
        enriched.append({
            "course_code": code,
            "course_name": rec.get("course_name", original.get("course_name", "")),
            "why": rec.get("why", ""),
            "prereq_check": original.get("prereq_check", rec.get("prereq_check", "")),
            "requirement_bucket": original.get("primary_bucket_label") or rec.get("requirement_bucket", ""),
            "fills_buckets": original.get("fills_buckets", rec.get("fills_buckets", [])),
            "unlocks": original.get("unlocks", rec.get("unlocks", [])),
            "has_soft_requirement": original.get("has_soft_requirement", False),
            "soft_tags": original.get("soft_tags", []),
            "low_confidence": original.get("low_confidence", False),
            "notes": original.get("notes"),
        })
    return enriched


# ── Helper: build progress output for response ───────────────────────────────
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


# ── Routes ───────────────────────────────────────────────────────────────────

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

    body = request.get_json(force=True)
    completed_raw = str(body.get("completed_courses", "") or "")
    in_progress_raw = str(body.get("in_progress_courses", "") or "")
    target_semester = str(body.get("target_semester", "Fall 2026") or "Fall 2026")
    requested_course_raw = body.get("requested_course") or None
    max_recs = int(body.get("max_recommendations", 3) or 3)

    catalog_codes = _data["catalog_codes"]

    # ── 1. Normalize inputs ───────────────────────────────────────────────────
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

    # ── 2. Parse term ─────────────────────────────────────────────────────────
    try:
        target_term = parse_term(target_semester)
    except ValueError:
        target_term = "Fall"

    # ── 3. Normalize requested_course if provided ─────────────────────────────
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

    # ── 4. Run allocator ──────────────────────────────────────────────────────
    allocation = allocate_courses(
        completed,
        in_progress,
        _data["buckets_df"],
        _data["course_bucket_map_df"],
        _data["courses_df"],
        _data["equivalencies_df"],
    )

    # ── 5. Build reverse prereq map ───────────────────────────────────────────
    reverse_map = build_reverse_prereq_map(_data["courses_df"], _data["prereq_map"])

    # ── can-take mode ──────────────────────────────────────────────────────────
    if requested_course:
        result = check_can_take(
            requested_course,
            _data["courses_df"],
            completed,
            in_progress,
            target_term,
            _data["prereq_map"],
        )

        # Find same-bucket alternatives for the requested course
        eligible_all = get_eligible_courses(
            _data["courses_df"],
            completed + ([requested_course] if result["can_take"] else []),
            in_progress,
            target_term,
            _data["prereq_map"],
            allocation["remaining"],
            _data["course_bucket_map_df"],
            _data["buckets_df"],
            _data["equivalencies_df"],
        )
        # Best alternatives from same primary bucket
        req_course_rows = _data["courses_df"][_data["courses_df"]["course_code"] == requested_course]
        alternatives = []
        if not result["can_take"] and len(req_course_rows) > 0:
            alternatives = [
                c for c in eligible_all
                if c["primary_bucket"] == _data["course_bucket_map_df"][
                    (_data["course_bucket_map_df"]["course_code"] == requested_course)
                    & (_data["course_bucket_map_df"]["track_id"] == TRACK_ID)
                ]["bucket_id"].iloc[0]
                if len(_data["course_bucket_map_df"][
                    (_data["course_bucket_map_df"]["course_code"] == requested_course)
                    & (_data["course_bucket_map_df"]["track_id"] == TRACK_ID)
                ]) > 0
            ][:3]

        return jsonify({
            "mode": "can_take",
            "requested_course": requested_course,
            "can_take": result["can_take"],
            "why_not": result["why_not"],
            "missing_prereqs": result["missing_prereqs"],
            "not_offered_this_term": result["not_offered_this_term"],
            "unsupported_prereq_format": result["unsupported_prereq_format"],
            "next_best_alternatives": alternatives[:3],
            "error": None,
        })

    # ── 6. Get eligible courses ───────────────────────────────────────────────
    eligible = get_eligible_courses(
        _data["courses_df"],
        completed,
        in_progress,
        target_term,
        _data["prereq_map"],
        allocation["remaining"],
        _data["course_bucket_map_df"],
        _data["buckets_df"],
        _data["equivalencies_df"],
    )

    # Separate manual review courses
    manual_review_courses = [c["course_code"] for c in eligible if c.get("manual_review")]
    non_manual_eligible = [c for c in eligible if not c.get("manual_review")]

    if not non_manual_eligible:
        return jsonify({
            "mode": "error",
            "recommendations": None,
            "error": {
                "error_code": "NO_ELIGIBLE_COURSES",
                "message": "No eligible courses found for the specified criteria.",
                "invalid_courses": [],
                "not_in_catalog": [],
            },
        })

    # ── 7. Attach unlocks + take top 10 for Claude ────────────────────────────
    top_candidates = non_manual_eligible[:10]
    for cand in top_candidates:
        cand["unlocks"] = get_direct_unlocks(cand["course_code"], reverse_map, limit=3)

    # ── 8. Blocking warnings ──────────────────────────────────────────────────
    core_remaining = allocation["remaining"].get("CORE", {}).get("remaining_courses", [])
    fin_choose_2_courses = _data["course_bucket_map_df"][
        (_data["course_bucket_map_df"]["track_id"] == TRACK_ID)
        & (_data["course_bucket_map_df"]["bucket_id"] == "FIN_CHOOSE_2")
    ]["course_code"].tolist()

    blocking_warnings = get_blocking_warnings(
        core_remaining,
        reverse_map,
        fin_choose_2_courses,
        completed,
        in_progress,
        threshold=BLOCKING_WARNING_THRESHOLD,
    )

    # ── 9. Timeline ───────────────────────────────────────────────────────────
    timeline = estimate_timeline(allocation["remaining"])

    # ── 10. Call Claude ───────────────────────────────────────────────────────
    try:
        recommendations = call_claude(
            top_candidates,
            completed,
            in_progress,
            target_semester,
            max_recs,
        )
    except Exception as exc:
        return jsonify({
            "mode": "error",
            "recommendations": None,
            "error": {
                "error_code": "API_ERROR",
                "message": f"Claude API error: {exc}",
            },
        })

    # ── 11. Build progress output ─────────────────────────────────────────────
    progress = build_progress_output(allocation, _data["course_bucket_map_df"])

    # ── 12. in_progress note ──────────────────────────────────────────────────
    in_progress_note = None
    if any("in progress" in (r.get("prereq_check") or "") for r in recommendations):
        in_progress_note = (
            "Prerequisites satisfied via in-progress courses assume successful completion."
        )

    return jsonify({
        "mode": "recommendations",
        "recommendations": recommendations,
        "in_progress_note": in_progress_note,
        "blocking_warnings": blocking_warnings,
        "progress": progress,
        "double_counted_courses": allocation["double_counted_courses"],
        "allocation_notes": allocation["notes"],
        "manual_review_courses": manual_review_courses,
        "timeline": timeline,
        "not_in_catalog_warning": not_in_catalog_warn if not_in_catalog_warn else None,
        "error": None,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
