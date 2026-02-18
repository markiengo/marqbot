import os
import sys
import json
import re

# Ensure backend/ is on sys.path so sibling imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request, send_from_directory
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI

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
USE_OPENAI_EXPLANATIONS = os.environ.get("USE_OPENAI_EXPLANATIONS", "0") == "1"

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

    # Backward/forward compatibility for workbook schema naming.
    # Current workbook may use program_id instead of track_id.
    if "track_id" not in buckets_df.columns and "program_id" in buckets_df.columns:
        buckets_df = buckets_df.rename(columns={"program_id": "track_id"})
    if "track_id" not in course_bucket_map_df.columns and "program_id" in course_bucket_map_df.columns:
        course_bucket_map_df = course_bucket_map_df.rename(columns={"program_id": "track_id"})

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


# ── OpenAI client ────────────────────────────────────────────────────────────
def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in environment")
    return OpenAI(api_key=api_key)


def call_openai(
    candidates: list[dict],
    completed: list[str],
    in_progress: list[str],
    target_semester: str,
    max_recommendations: int,
) -> list[dict]:
    """Calls OpenAI with pre-filtered candidates. Returns parsed JSON recommendations."""
    client = get_openai_client()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    user_msg = build_prompt(candidates, completed, in_progress, target_semester, max_recommendations)

    response = client.chat.completions.create(
        model=model,
        max_tokens=420,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )

    raw = (response.choices[0].message.content or "").strip()
    # Strip markdown code fences if the model wraps the JSON
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    parsed_output = json.loads(raw)
    if not isinstance(parsed_output, list):
        parsed_output = []

    # Re-attach fields the model shouldn't change but might have dropped
    code_to_candidate = {c["course_code"]: c for c in candidates}
    enriched = []
    for rec in parsed_output:
        if not isinstance(rec, dict):
            continue
        code = rec.get("course_code")
        if code not in code_to_candidate:
            continue
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

    # Guarantee requested count when enough candidates exist:
    # if model returns fewer items, fill with top deterministic candidates.
    target_count = min(max_recommendations, len(candidates))
    chosen_codes = {r["course_code"] for r in enriched}
    for cand in candidates:
        if len(enriched) >= target_count:
            break
        if cand["course_code"] in chosen_codes:
            continue
        enriched.append({
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "why": "Recommended based on unmet requirement priority and prerequisite readiness.",
            "prereq_check": cand.get("prereq_check", ""),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": cand.get("fills_buckets", []),
            "unlocks": cand.get("unlocks", []),
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        })
        chosen_codes.add(cand["course_code"])

    candidate_order = {c["course_code"]: i for i, c in enumerate(candidates)}
    enriched.sort(key=lambda r: candidate_order.get(r["course_code"], 10**9))
    return enriched[:target_count]


def build_deterministic_recommendations(candidates: list[dict], max_recommendations: int) -> list[dict]:
    """Fast local recommendation builder: no LLM call."""
    target_count = min(max_recommendations, len(candidates))
    recs = []
    for cand in candidates[:target_count]:
        buckets = cand.get("fills_buckets", [])
        if buckets:
            why = f"This course advances your Finance major path and counts toward {len(buckets)} unmet requirement bucket(s)."
        else:
            why = "This course advances your Finance major path based on prerequisite order and remaining requirements."
        recs.append({
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "why": why,
            "prereq_check": cand.get("prereq_check", ""),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": cand.get("fills_buckets", []),
            "unlocks": cand.get("unlocks", []),
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        })
    return recs


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


def _prereq_courses(parsed: dict) -> set[str]:
    t = parsed.get("type")
    if t == "single":
        return {parsed["course"]}
    if t in ("and", "or"):
        return set(parsed["courses"])
    return set()


SEM_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)


def _normalize_semester_label(label: str) -> str:
    m = SEM_RE.match((label or "").strip())
    if not m:
        return label
    term = m.group(1).capitalize()
    year = int(m.group(2))
    return f"{term} {year}"


def _default_followup_semester(first_semester: str) -> str:
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
    target_semester_primary = str(
        body.get("target_semester_primary")
        or body.get("target_semester")
        or "Spring 2026"
    )
    target_semester_primary = _normalize_semester_label(target_semester_primary)
    target_semester_secondary = body.get("target_semester_secondary")
    target_semester_secondary = str(target_semester_secondary).strip() if target_semester_secondary is not None else None
    if target_semester_secondary == "__NONE__":
        target_semester_secondary = "__NONE__"
    else:
        target_semester_secondary = (
            _normalize_semester_label(target_semester_secondary)
            if target_semester_secondary
            else None
        )
    requested_course_raw = body.get("requested_course") or None
    max_recs = int(body.get("max_recommendations", 3) or 3)
    max_recs = max(1, min(4, max_recs))

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
    )

    reverse_map = build_reverse_prereq_map(_data["courses_df"], _data["prereq_map"])

    if requested_course:
        result = check_can_take(
            requested_course,
            _data["courses_df"],
            completed,
            in_progress,
            target_term,
            _data["prereq_map"],
        )

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

    def run_recommendation_semester(completed_sem: list[str], in_progress_sem: list[str], target_semester_label: str) -> dict:
        term = parse_term(target_semester_label)
        alloc = allocate_courses(
            completed_sem,
            in_progress_sem,
            _data["buckets_df"],
            _data["course_bucket_map_df"],
            _data["courses_df"],
            _data["equivalencies_df"],
        )

        eligible_sem = get_eligible_courses(
            _data["courses_df"],
            completed_sem,
            in_progress_sem,
            term,
            _data["prereq_map"],
            alloc["remaining"],
            _data["course_bucket_map_df"],
            _data["buckets_df"],
            _data["equivalencies_df"],
        )
        manual_review_sem = [c["course_code"] for c in eligible_sem if c.get("manual_review")]
        non_manual_sem = [c for c in eligible_sem if not c.get("manual_review")]
        eligible_count_sem = len(non_manual_sem)

        progress_sem = build_progress_output(alloc, _data["course_bucket_map_df"])
        timeline_sem = estimate_timeline(alloc["remaining"])
        if isinstance(timeline_sem, dict):
            timeline_sem["disclaimer"] = (
                "Estimated time to complete Finance major requirements only. "
                "Assumes about 3 major courses per term and typical course availability."
            )

        if not non_manual_sem:
            return {
                "target_semester": target_semester_label,
                "recommendations": [],
                "requested_recommendations": max_recs,
                "eligible_count": 0,
                "input_completed_count": len(completed_sem),
                "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
                "in_progress_note": None,
                "blocking_warnings": [],
                "progress": progress_sem,
                "double_counted_courses": alloc["double_counted_courses"],
                "allocation_notes": alloc["notes"],
                "manual_review_courses": manual_review_sem,
                "timeline": timeline_sem,
            }

        core_remaining_sem = alloc["remaining"].get("CORE", {}).get("remaining_courses", [])
        core_prereq_blockers_sem: set[str] = set()
        for core_code in core_remaining_sem:
            core_prereq_blockers_sem |= _prereq_courses(_data["prereq_map"].get(core_code, {"type": "none"}))

        ranked_sem = sorted(
            non_manual_sem,
            key=lambda c: (
                0 if c["course_code"] in core_prereq_blockers_sem else 1,
                c.get("prereq_level", 0),
                c.get("primary_bucket_priority", 99),
                -c.get("multi_bucket_score", 0),
                c["course_code"],
            ),
        )
        selected_sem = ranked_sem[:max_recs]
        for cand in selected_sem:
            cand["unlocks"] = get_direct_unlocks(cand["course_code"], reverse_map, limit=3)

        if USE_OPENAI_EXPLANATIONS:
            recommendations_sem = call_openai(
                selected_sem,
                completed_sem,
                in_progress_sem,
                target_semester_label,
                len(selected_sem),
            )
        else:
            recommendations_sem = build_deterministic_recommendations(selected_sem, len(selected_sem))

        fin_choose_2_courses = _data["course_bucket_map_df"][
            (_data["course_bucket_map_df"]["track_id"] == TRACK_ID)
            & (_data["course_bucket_map_df"]["bucket_id"] == "FIN_CHOOSE_2")
        ]["course_code"].tolist()
        blocking_sem = get_blocking_warnings(
            core_remaining_sem,
            reverse_map,
            fin_choose_2_courses,
            completed_sem,
            in_progress_sem,
            threshold=BLOCKING_WARNING_THRESHOLD,
        )

        in_progress_note_sem = None
        if any("in progress" in (r.get("prereq_check") or "") for r in recommendations_sem):
            in_progress_note_sem = "Prerequisites satisfied via in-progress courses assume successful completion."

        return {
            "target_semester": target_semester_label,
            "recommendations": recommendations_sem,
            "requested_recommendations": max_recs,
            "eligible_count": eligible_count_sem,
            "input_completed_count": len(completed_sem),
            "applied_completed_count": sum(p.get("done_count", 0) for p in progress_sem.values()),
            "in_progress_note": in_progress_note_sem,
            "blocking_warnings": blocking_sem,
            "progress": progress_sem,
            "double_counted_courses": alloc["double_counted_courses"],
            "allocation_notes": alloc["notes"],
            "manual_review_courses": manual_review_sem,
            "timeline": timeline_sem,
        }

    sem1 = run_recommendation_semester(completed, in_progress, target_semester_primary)
    semesters_payload = [sem1]
    if target_semester_secondary != "__NONE__":
        second_label = target_semester_secondary or _default_followup_semester(target_semester_primary)
        completed_for_sem2 = list(dict.fromkeys(completed + in_progress + [r["course_code"] for r in sem1["recommendations"] if r.get("course_code")]))
        sem2 = run_recommendation_semester(completed_for_sem2, [], second_label)
        semesters_payload.append(sem2)

    return jsonify({
        "mode": "recommendations",
        "semesters": semesters_payload,
        **sem1,
        "not_in_catalog_warning": not_in_catalog_warn if not_in_catalog_warn else None,
        "error": None,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
