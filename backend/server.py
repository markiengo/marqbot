import os
import sys
import time
import threading
import hashlib
import json
from collections import OrderedDict, defaultdict

# Ensure backend/ is on sys.path so sibling imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.exceptions import NotFound
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
    default_followup_semester_with_summer,
    run_recommendation_semester,
    _credits_to_standing,
)

load_dotenv()

app = Flask(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
_NEXT_OUT = os.path.join(PROJECT_ROOT, "frontend", "out")
# Frontend convergence: only serve the Next.js static export.
FRONTEND_DIR = _NEXT_OUT
_DEFAULT_DATA_PATH = os.path.join(PROJECT_ROOT, "data")
_env_data_path = os.environ.get("DATA_PATH")
if not _env_data_path:
    DATA_PATH = _DEFAULT_DATA_PATH
elif not os.path.isabs(_env_data_path):
    DATA_PATH = os.path.join(PROJECT_ROOT, _env_data_path)
else:
    DATA_PATH = _env_data_path
_data_lock = threading.Lock()
_data_mtime = None

# -- Rate limiting (manual token bucket, 10 req/min per IP) ----------------
_RATE_LIMIT_MAX = 10
_RATE_LIMIT_WINDOW = 60  # seconds
_rate_limit_lock = threading.Lock()
_rate_limit_tracker: dict[str, list[float]] = defaultdict(list)


def _env_float(name: str, default: float, minimum: float = 0.0) -> float:
    raw = os.environ.get(name, "")
    try:
        return max(minimum, float(raw))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    raw = os.environ.get(name, "")
    try:
        return max(minimum, int(raw))
    except (TypeError, ValueError):
        return default


_SLOW_REQUEST_LOG_MS = _env_float("SLOW_REQUEST_LOG_MS", 750.0, minimum=0.0)
_REQUEST_CACHE_SIZE = _env_int("REQUEST_CACHE_SIZE", 128, minimum=1)


class _LruResponseCache:
    """Thread-safe bounded in-memory cache for JSON-serializable responses."""

    def __init__(self, max_size: int):
        self.max_size = max(1, int(max_size))
        self._lock = threading.Lock()
        self._items: OrderedDict[str, dict] = OrderedDict()

    def get(self, key: str):
        with self._lock:
            if key not in self._items:
                return None
            value = self._items.pop(key)
            self._items[key] = value
            return value

    def set(self, key: str, value: dict) -> None:
        with self._lock:
            if key in self._items:
                self._items.pop(key)
            self._items[key] = value
            while len(self._items) > self.max_size:
                self._items.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


_recommend_response_cache = _LruResponseCache(_REQUEST_CACHE_SIZE)
_can_take_response_cache = _LruResponseCache(_REQUEST_CACHE_SIZE)


def _cache_enabled() -> bool:
    return not app.config.get("TESTING", False)


def _stable_payload_hash(payload) -> str:
    normalized = payload if payload is not None else {}
    encoded = json.dumps(
        normalized,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _data_version_tag() -> str:
    return "none" if _data_mtime is None else str(_data_mtime)


def _request_cache_key(prefix: str, payload) -> str:
    return f"{prefix}:{_data_version_tag()}:{_stable_payload_hash(payload)}"


def _clear_request_caches() -> None:
    _recommend_response_cache.clear()
    _can_take_response_cache.clear()


def _check_rate_limit(ip: str) -> bool:
    """Return True if request is allowed, False if rate-limited."""
    now = time.time()
    with _rate_limit_lock:
        timestamps = _rate_limit_tracker[ip]
        _rate_limit_tracker[ip] = [t for t in timestamps if now - t < _RATE_LIMIT_WINDOW]
        if len(_rate_limit_tracker[ip]) >= _RATE_LIMIT_MAX:
            return False
        _rate_limit_tracker[ip].append(now)
        return True


def _data_file_mtime(path: str):
    try:
        if os.path.isdir(path):
            mtimes = [
                os.path.getmtime(os.path.join(path, f))
                for f in os.listdir(path)
                if f.endswith(".csv")
            ]
            return max(mtimes) if mtimes else None
        return os.path.getmtime(path)
    except OSError:
        return None


def _frontend_missing_response():
    return jsonify({
        "mode": "error",
        "error": {
            "error_code": "FRONTEND_NOT_BUILT",
            "message": "Frontend build not found. Run `npm run build` in `frontend/`.",
        },
    }), 503


def _frontend_ready() -> bool:
    return os.path.isfile(os.path.join(FRONTEND_DIR, "index.html"))

# ── Startup data load ──────────────────────────────────────────────────────────
try:
    _data = load_data(DATA_PATH)
    _data_mtime = _data_file_mtime(DATA_PATH)
    print(f"[OK] Loaded {len(_data['catalog_codes'])} courses from {DATA_PATH}")
except FileNotFoundError:
    # Render safety: if DATA_PATH env var is stale, fall back to repo workbook.
    if DATA_PATH != _DEFAULT_DATA_PATH and os.path.exists(_DEFAULT_DATA_PATH):
        print(
            f"[WARN] DATA_PATH not found ({DATA_PATH}); "
            f"falling back to default workbook ({_DEFAULT_DATA_PATH}).",
            file=sys.stderr,
        )
        DATA_PATH = _DEFAULT_DATA_PATH
        _data = load_data(DATA_PATH)
        _data_mtime = _data_file_mtime(DATA_PATH)
        print(f"[OK] Loaded {len(_data['catalog_codes'])} courses from {DATA_PATH}")
    else:
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
        _clear_request_caches()
        print(f"[OK] Reloaded {len(new_data['catalog_codes'])} courses from {DATA_PATH}")
        return True


def _refresh_data_if_needed() -> None:
    try:
        _reload_data_if_changed()
    except Exception as exc:
        print(f"[WARN] Data reload check failed: {exc}", file=sys.stderr)


# ── Input validation ───────────────────────────────────────────────────────────
# -- Security headers ------------------------------------------------------
@app.before_request
def _start_request_timer():
    g._request_start_time = time.perf_counter()


@app.after_request
def _add_security_headers(response):
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"

    started = getattr(g, "_request_start_time", None)
    if started is not None:
        duration_ms = (time.perf_counter() - started) * 1000.0
        if duration_ms >= _SLOW_REQUEST_LOG_MS:
            endpoint = request.endpoint or "unknown"
            print(
                f"[SLOW] {request.method} {request.path} "
                f"endpoint={endpoint} status={response.status_code} duration_ms={duration_ms:.1f}"
            )
    return response


# -- Health endpoint --------------------------------------------------------
@app.route("/health", methods=["GET"])
def health_endpoint():
    return jsonify({
        "status": "ok",
        "version": "1.9.0",
        "frontend_ready": _frontend_ready(),
    })


# -- Input validation ------------------------------------------------------
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
            if not (1 <= semester_count <= 8):
                raise ValueError
        except (TypeError, ValueError):
            return "INVALID_INPUT", "target_semester_count must be an integer between 1 and 8."
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
AIM_CFA_TRACK_ID = "AIM_CFA_TRACK"
FIN_MAJOR_ID = "FIN_MAJOR"
AIM_CFA_FINANCE_RULE_MSG = (
    "Students in the AIM CFA: Investments Concentration must also have a declared "
    "primary major in Finance."
)
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
    fallback = str(fallback_label or "").strip()
    if fallback:
        return fallback
    normalized_kind = str(kind or "").strip().lower()
    if normalized_kind == "major":
        return _canonical_major_label(program_id)
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
        if kind in {"major", "track", "minor"}:
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
            if kind not in {"major", "track", "minor"}:
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

    # When a track is selected, drop track-neutral duplicates only when a
    # track-specific sub-bucket has the same requirement signature.
    if selected_track and len(runtime_buckets) > 0:
        track_required = (
            runtime_buckets.get("track_required", "")
            .fillna("")
            .astype(str)
            .str.strip()
            .str.upper()
        )
        label = runtime_buckets.get("bucket_label", "").fillna("").astype(str).str.strip()
        mode = runtime_buckets.get("requirement_mode", "").fillna("").astype(str).str.strip().str.lower()
        needed_count = pd.to_numeric(runtime_buckets.get("needed_count"), errors="coerce")
        needed_credits = pd.to_numeric(runtime_buckets.get("needed_credits"), errors="coerce")

        def _norm_num(value):
            if pd.isna(value):
                return None
            return float(value)

        row_keys = [
            (
                str(label.iloc[idx]),
                str(mode.iloc[idx]),
                _norm_num(needed_count.iloc[idx]),
                _norm_num(needed_credits.iloc[idx]),
            )
            for idx in range(len(runtime_buckets))
        ]
        track_keys = {
            row_keys[idx]
            for idx in range(len(runtime_buckets))
            if track_required.iloc[idx] == selected_track and row_keys[idx][0]
        }
        if track_keys:
            is_dup = [
                (track_required.iloc[idx] == "") and (row_keys[idx] in track_keys)
                for idx in range(len(runtime_buckets))
            ]
            runtime_buckets = runtime_buckets[[not flag for flag in is_dup]].copy()

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


_CORE_PARENT_ALIAS = {
    "BCC": "BCC",
    "MCC": "MCC",
    "BCC_CORE": "BCC",
    "MCC_CORE": "MCC",
    "MCC_FOUNDATION": "MCC",
    "MCC_CULM": "MCC",
    "MCC_ESSV2": "MCC",
    "MCC_WRIT": "MCC",
    "MCC_DISC": "MCC",
    "MCC_DISC_CMI": "MCC",
    "MCC_DISC_BNJ": "MCC",
    "MCC_DISC_CB": "MCC",
    "MCC_DISC_EOH": "MCC",
    "MCC_DISC_IC": "MCC",
}


def _apply_discovery_theme_filter(
    buckets: pd.DataFrame,
    course_map: pd.DataFrame,
    universal_programs: set[str],
    discovery_theme: str | None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Filter MCC_DISC overlay buckets to only the selected Discovery theme."""
    if "MCC_DISC" not in universal_programs:
        return buckets, course_map

    is_disc_overlay_bucket = buckets.get("source_program_id", pd.Series(dtype=str)) == "MCC_DISC"
    track_req = buckets.get("track_required", pd.Series(dtype=str)).fillna("")
    if discovery_theme:
        keep = ~is_disc_overlay_bucket | (track_req == "") | (track_req == discovery_theme)
    else:
        keep = ~is_disc_overlay_bucket | (track_req == "")
    buckets = buckets[keep].copy()

    is_disc_overlay_map = course_map.get("source_program_id", pd.Series(dtype=str)) == "MCC_DISC"
    map_track_req = course_map.get("track_required", pd.Series(dtype=str)).fillna("")
    if discovery_theme:
        keep_map = ~is_disc_overlay_map | (map_track_req == "") | (map_track_req == discovery_theme)
    else:
        keep_map = ~is_disc_overlay_map | (map_track_req == "")
    course_map = course_map[keep_map].copy()

    return buckets, course_map


def _build_declared_plan_data_v2(
    data: dict,
    declared_majors: list[str],
    selected_track_ids: list[str],
    catalog_df: pd.DataFrame,
    declared_minors: list[str] | None = None,
    discovery_theme: str | None = None,
) -> dict:
    """Build synthetic merged runtime view from V2 model for declared majors and minors."""
    declared_minors = declared_minors or []
    label_map = {str(r["track_id"]): str(r["track_label"] or r["track_id"]) for _, r in catalog_df.iterrows()}
    track_parent = {
        str(r["track_id"]): str(r.get("parent_major_id", "") or "").strip().upper()
        for _, r in catalog_df[catalog_df["kind"] == "track"].iterrows()
    }
    universal_programs = _universal_program_ids(data)

    all_buckets = []
    all_maps = []

    for major_id in declared_majors:
        major_track = next((t for t in selected_track_ids if track_parent.get(t, "") == major_id), None)
        major_data = _build_single_major_data_v2(data, major_id, major_track)
        buckets = major_data["buckets_df"].copy()
        course_map = major_data["course_bucket_map_df"].copy()

        # Filter Discovery theme overlay buckets.
        buckets, course_map = _apply_discovery_theme_filter(
            buckets, course_map, universal_programs, discovery_theme
        )

        buckets["source_program_id"] = buckets.get("source_program_id", major_id).fillna(major_id).astype(str).str.strip().str.upper()
        buckets["source_bucket_id"] = buckets.get("source_bucket_id", buckets["bucket_id"]).fillna("").astype(str)
        buckets["source_parent_bucket_id"] = buckets.get(
            "source_parent_bucket_id",
            buckets.get("parent_bucket_id", ""),
        ).fillna("").astype(str).str.strip().str.upper()
        source_parent_display = buckets["source_parent_bucket_id"].map(_CORE_PARENT_ALIAS).fillna(
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
        source_parent_map_display = course_map["source_parent_bucket_id"].map(_CORE_PARENT_ALIAS).fillna(
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

    for minor_id in declared_minors:
        minor_data = _build_single_major_data_v2(data, minor_id, None)
        buckets = minor_data["buckets_df"].copy()
        course_map = minor_data["course_bucket_map_df"].copy()

        buckets["source_program_id"] = buckets.get("source_program_id", minor_id).fillna(minor_id).astype(str).str.strip().str.upper()
        buckets["source_bucket_id"] = buckets.get("source_bucket_id", buckets["bucket_id"]).fillna("").astype(str)
        buckets["source_parent_bucket_id"] = buckets.get(
            "source_parent_bucket_id",
            buckets.get("parent_bucket_id", ""),
        ).fillna("").astype(str).str.strip().str.upper()
        source_parent_display = buckets["source_parent_bucket_id"].map(_CORE_PARENT_ALIAS).fillna(
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
            minor_id + "::" + buckets.loc[~is_overlay_bucket, "source_bucket_id"].astype(str)
        )
        buckets.loc[~is_overlay_bucket, "bucket_label"] = (
            f"{label_map.get(minor_id, minor_id)}: "
            + buckets.loc[~is_overlay_bucket, "bucket_label"].astype(str)
        )
        buckets["track_id"] = PHASE5_PLAN_TRACK_ID

        course_map["source_program_id"] = course_map.get("source_program_id", minor_id).fillna(minor_id).astype(str).str.strip().str.upper()
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
        source_parent_map_display = course_map["source_parent_bucket_id"].map(_CORE_PARENT_ALIAS).fillna(
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
            minor_id + "::" + course_map.loc[~is_overlay_map, "source_bucket_id"].astype(str)
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


def _coerce_course_list(raw_value) -> str:
    """Accept either a comma-delimited string or a JSON array of course codes.
    Always returns a comma-delimited string suitable for ``normalize_input``."""
    if raw_value is None:
        return ""
    if isinstance(raw_value, list):
        return ", ".join(str(item) for item in raw_value if item)
    return str(raw_value)


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
    return majors, None


def _normalize_declared_minors(raw_value):
    if raw_value is None:
        return [], None
    if not isinstance(raw_value, list):
        return None, (
            "INVALID_INPUT",
            "declared_minors must be an array of minor IDs (e.g., ['MARK_MINOR']).",
        )
    minors = []
    for item in raw_value:
        code = str(item or "").strip().upper()
        if code:
            minors.append(code)
    return list(dict.fromkeys(minors)), None


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

    declared_minors, minor_parse_error = _normalize_declared_minors(body.get("declared_minors"))
    if minor_parse_error:
        code, msg = minor_parse_error
        return None, ({
            "mode": "error",
            "error": {"error_code": code, "message": msg},
        }, 400)

    discovery_theme = str(body.get("discovery_theme") or "").strip().upper() or None

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

    # Validate declared minors and check for major/minor subject overlap.
    for minor_id in declared_minors:
        row = selectable_catalog_df[selectable_catalog_df["track_id"] == minor_id]
        if len(row) == 0 or row.iloc[0]["kind"] != "minor":
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "UNKNOWN_MINOR",
                    "message": f"Minor '{minor_id}' is not recognized.",
                },
            }, 400)
        if not row.iloc[0].get("active", True):
            warnings.append(
                f"Minor '{_program_label(minor_id)}' is not yet published (active=0). "
                "Results may be incomplete."
            )

    major_base_codes = {m.replace("_MAJOR", "") for m in declared_majors}
    minor_base_codes = {m.replace("_MINOR", "") for m in declared_minors}
    overlap = major_base_codes & minor_base_codes
    if overlap:
        labels = ", ".join(sorted(overlap))
        return None, ({
            "mode": "error",
            "error": {
                "error_code": "MAJOR_MINOR_OVERLAP",
                "message": f"Cannot minor in a subject you are already majoring in: {labels}.",
            },
        }, 400)

    # Support track_ids (array) and legacy track_id (single) — normalise to list.
    selected_track_ids = []
    raw_track_ids = body.get("track_ids", None)
    if raw_track_ids is None:
        raw_single = body.get("track_id", None)
        raw_track_ids = [raw_single] if raw_single not in (None, "", "__NONE__") else []

    seen_parent_majors: set[str] = set()
    for raw_track in (raw_track_ids or []):
        if raw_track in (None, "", "__NONE__"):
            continue
        t_id = str(raw_track).strip().upper()
        if using_v2_catalog:
            t_id = alias_map.get(t_id, t_id)
        track_row = selectable_catalog_df[selectable_catalog_df["track_id"] == t_id]
        if len(track_row) == 0:
            return None, (_build_unknown_track_error(str(raw_track).strip()), 400)
        track_row = track_row.iloc[0]
        if track_row["kind"] != "track":
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "INVALID_INPUT",
                    "message": f"track_id '{t_id}' is not a track.",
                },
            }, 400)
        parent_major_id = str(track_row.get("parent_major_id", "") or "").strip().upper()
        if parent_major_id and parent_major_id not in declared_majors:
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "TRACK_MAJOR_MISMATCH",
                    "message": (
                        f"Track '{_program_label(t_id)}' does not belong to declared majors "
                        f"{[_program_label(mid) for mid in declared_majors]}."
                    ),
                },
            }, 400)
        if t_id == AIM_CFA_TRACK_ID and FIN_MAJOR_ID not in declared_majors:
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "PRIMARY_MAJOR_REQUIRED",
                    "message": AIM_CFA_FINANCE_RULE_MSG,
                },
            }, 400)
        if parent_major_id in seen_parent_majors:
            return None, ({
                "mode": "error",
                "error": {
                    "error_code": "DUPLICATE_TRACK_MAJOR",
                    "message": "Cannot select two tracks for the same major.",
                },
            }, 400)
        seen_parent_majors.add(parent_major_id)
        if not track_row.get("active", True):
            warnings.append(
                f"Track '{_program_label(t_id)}' is not yet published (active=0). "
                "Results may be incomplete."
            )
        selected_track_ids.append(t_id)

    selected_program_ids = list(dict.fromkeys(declared_majors + selected_track_ids + declared_minors))
    if using_v2_catalog:
        effective_data = _build_declared_plan_data_v2(
            data,
            declared_majors,
            selected_track_ids,
            catalog_df,
            declared_minors=declared_minors,
            discovery_theme=discovery_theme,
        )
    else:
        effective_data = _build_declared_plan_data(data, selected_program_ids, catalog_df)
    selected_program_labels = [_program_label(pid) for pid in selected_program_ids]
    declared_major_labels = [_program_label(mid) for mid in declared_majors]
    declared_minor_labels = [_program_label(mid) for mid in declared_minors]
    selected_track_label = (
        _program_label(selected_track_ids[0]) if len(selected_track_ids) == 1
        else (", ".join(_program_label(t) for t in selected_track_ids) if selected_track_ids else None)
    )

    return {
        "mode": "declared",
        "declared_majors": declared_majors,
        "declared_major_labels": declared_major_labels,
        "declared_minors": declared_minors,
        "declared_minor_labels": declared_minor_labels,
        "discovery_theme": discovery_theme,
        "selected_track_id": selected_track_ids[0] if len(selected_track_ids) == 1 else None,
        "selected_track_ids": selected_track_ids,
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
    if not _frontend_ready():
        return _frontend_missing_response()
    try:
        return send_from_directory(FRONTEND_DIR, "index.html")
    except NotFound:
        return _frontend_missing_response()


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
            "minors": [],
            "default_track_id": DEFAULT_TRACK_ID,
        })

    publishable = catalog_df[catalog_df.get("applies_to_all", False) != True].copy()
    majors = publishable[publishable["kind"] == "major"].sort_values("track_id", kind="stable")
    tracks = publishable[publishable["kind"] == "track"].sort_values("track_id", kind="stable")
    minors = publishable[publishable["kind"] == "minor"].sort_values("track_id", kind="stable")

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
    minors_payload = [
        {
            "minor_id": str(row["track_id"]),
            "label": str(row.get("track_label", row["track_id"])),
            "active": bool(row.get("active", True)),
        }
        for _, row in minors.iterrows()
    ]

    return jsonify({
        "majors": majors_payload,
        "tracks": tracks_payload,
        "minors": minors_payload,
        "default_track_id": DEFAULT_TRACK_ID,
    })


@app.route("/recommend", methods=["POST"])
def recommend():
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
    if not app.config.get("TESTING") and not _check_rate_limit(client_ip):
        return jsonify({
            "mode": "error",
            "error": {"error_code": "RATE_LIMITED", "message": "Too many requests. Please wait before submitting again."},
        }), 429
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

    cache_key = _request_cache_key("recommend", body)
    if _cache_enabled():
        cached = _recommend_response_cache.get(cache_key)
        if cached is not None:
            return jsonify(cached)

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

    completed_raw = _coerce_course_list(body.get("completed_courses"))
    in_progress_raw = _coerce_course_list(body.get("in_progress_courses"))
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
        target_semester_count = max(1, min(8, int(target_semester_count_raw)))

    requested_course_raw = body.get("requested_course") or None
    max_recs = max(1, min(6, int(body.get("max_recommendations", 3) or 3)))
    include_summer = bool(body.get("include_summer", False))
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
        }), 400

    completed = comp_result["valid"]
    in_progress = ip_result["valid"]
    not_in_catalog_warn = comp_result["not_in_catalog"] + ip_result["not_in_catalog"]

    # Build a course→credits lookup for standing projection.
    _cdf = effective_data["courses_df"]
    _credits_lookup: dict[str, int] = dict(zip(
        _cdf["course_code"].astype(str),
        _cdf["credits"].fillna(3).apply(lambda x: max(0, int(x)) if pd.notna(x) else 3),
    ))
    # Initial standing from completed + in-progress courses (in-progress are assumed
    # finishing by the time semester 1 recommendations apply).
    running_credits: int = sum(_credits_lookup.get(c, 3) for c in completed) + sum(_credits_lookup.get(c, 3) for c in in_progress)

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

    explicit_labels = [
        target_semester_secondary,
        target_semester_tertiary,
        target_semester_quaternary,
    ]
    _followup_fn = default_followup_semester_with_summer if include_summer else default_followup_semester
    semester_labels = [target_semester_primary]
    while len(semester_labels) < target_semester_count:
        idx = len(semester_labels)  # 1-based semester offset from primary
        explicit = explicit_labels[idx - 1] if idx - 1 < len(explicit_labels) else None
        if explicit and explicit != "__NONE__":
            semester_labels.append(explicit)
        else:
            semester_labels.append(_followup_fn(semester_labels[-1]))

    # Filter out summer semesters when include_summer is False.
    # default_followup_semester never produces a Summer label, so only primary/explicit
    # semesters can be summers. Extend with auto-generated labels to fill any gaps.
    if not include_summer:
        filtered = [l for l in semester_labels if "summer" not in l.lower()]
        probe = filtered[-1] if filtered else semester_labels[-1]
        while len(filtered) < target_semester_count:
            next_label = default_followup_semester(probe)
            filtered.append(next_label)
            probe = next_label
        semester_labels = filtered[:target_semester_count]

    semesters_payload = []
    completed_cursor = list(dict.fromkeys(completed + in_progress))
    for idx, semester_label in enumerate(semester_labels):
        current_standing = _credits_to_standing(running_credits)
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
                current_standing=current_standing,
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
                current_standing=current_standing,
            )
        semesters_payload.append(semester_payload)
        # Accumulate recommended course credits for the next semester's standing projection.
        for rec in semester_payload.get("recommendations", []):
            running_credits += _credits_lookup.get(rec.get("course_code", ""), 3)
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
    if _cache_enabled():
        _recommend_response_cache.set(cache_key, response)
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

    cache_key = _request_cache_key("can_take", body)
    if _cache_enabled():
        cached = _can_take_response_cache.get(cache_key)
        if cached is not None:
            return jsonify(cached)

    requested_course_raw = str(body.get("requested_course") or "").strip()
    if not requested_course_raw:
        return jsonify({"mode": "can_take", "error": "requested_course is required."}), 400

    requested_course = normalize_code(requested_course_raw)
    if not requested_course or requested_course not in _data["catalog_codes"]:
        response_payload = {
            "mode": "can_take",
            "requested_course": requested_course or requested_course_raw,
            "can_take": False,
            "why_not": f"{requested_course or requested_course_raw} is not in the course catalog.",
            "missing_prereqs": [],
            "not_offered_this_term": False,
            "unsupported_prereq_format": False,
            "next_best_alternatives": [],
        }
        if _cache_enabled():
            _can_take_response_cache.set(cache_key, response_payload)
        return jsonify(response_payload)

    # Normalize completed / in-progress course lists (same logic as /recommend)
    catalog_codes = _data["catalog_codes"]
    comp_result = normalize_input(_coerce_course_list(body.get("completed_courses")), catalog_codes)
    ip_result = normalize_input(_coerce_course_list(body.get("in_progress_courses")), catalog_codes)
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

    response_payload = {
        "mode": "can_take",
        "requested_course": requested_course,
        "can_take": result["can_take"],
        "why_not": result["why_not"],
        "missing_prereqs": result["missing_prereqs"],
        "not_offered_this_term": result["not_offered_this_term"],
        "unsupported_prereq_format": result["unsupported_prereq_format"],
        "next_best_alternatives": [],
    }
    if _cache_enabled():
        _can_take_response_cache.set(cache_key, response_payload)
    return jsonify(response_payload)

@app.route("/validate-prereqs", methods=["POST"])
def validate_prereqs_endpoint():
    """Lightweight prereq inconsistency check used by the onboarding CoursesStep."""
    _refresh_data_if_needed()
    if not _data:
        return jsonify({"inconsistencies": []}), 200

    body = request.get_json(force=True, silent=True) or {}
    catalog_codes = _data["catalog_codes"]
    comp_result = normalize_input(_coerce_course_list(body.get("completed_courses")), catalog_codes)
    ip_result = normalize_input(_coerce_course_list(body.get("in_progress_courses")), catalog_codes)
    completed = comp_result["valid"]
    in_progress = ip_result["valid"]

    inconsistencies = find_inconsistent_completed_courses(
        completed, in_progress, _data["prereq_map"]
    )
    return jsonify({"inconsistencies": inconsistencies})


# -- Canonical API routes for Next.js frontend ------------------------
# `/courses` is intentionally left to SPA routing.
app.add_url_rule("/api/health", endpoint="api_health", view_func=health_endpoint, methods=["GET"])
app.add_url_rule("/api/courses", endpoint="api_courses", view_func=get_courses, methods=["GET"])
app.add_url_rule("/api/programs", endpoint="api_programs", view_func=get_programs, methods=["GET"])
app.add_url_rule("/api/recommend", endpoint="api_recommend", view_func=recommend, methods=["POST"])
app.add_url_rule("/api/can-take", endpoint="api_can_take", view_func=can_take_endpoint, methods=["POST"])
app.add_url_rule("/api/validate-prereqs", endpoint="api_validate_prereqs", view_func=validate_prereqs_endpoint, methods=["POST"])


# -- API catch-all (404 for unknown /api/* routes) -------------------
@app.route("/api/<path:rest>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def api_catch_all(rest):
    return jsonify({"error": f"/api/{rest} not found"}), 404


# -- SPA catch-all (must be last) -------------------------------------
# Serves static files from the frontend build directory; falls back to
# index.html for client-side routes like /planner, /onboarding, etc.
@app.route("/<path:filename>")
def frontend_files(filename):
    if not _frontend_ready():
        return _frontend_missing_response()

    safe_path = filename.lstrip("/")
    if safe_path.endswith("/"):
        safe_path = safe_path[:-1]

    # Static assets (js, css, images) ? 404 if not found
    if "." in safe_path.rsplit("/", 1)[-1]:
        try:
            return send_from_directory(FRONTEND_DIR, safe_path)
        except NotFound:
            return "", 404

    # Client-side routes (no extension):
    # resolve explicit file, export-style *.html, or folder index.html.
    candidates = [
        safe_path,
        f"{safe_path}.html",
        os.path.join(safe_path, "index.html"),
    ]
    for rel_path in candidates:
        if rel_path and os.path.isfile(os.path.join(FRONTEND_DIR, rel_path)):
            return send_from_directory(FRONTEND_DIR, rel_path)

    try:
        return send_from_directory(FRONTEND_DIR, "index.html")
    except NotFound:
        return _frontend_missing_response()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
