"""Shared test helpers for backend test suite.

Centralizes catalog lookups, payload builders, and assertion helpers
that were previously duplicated across planner safety and recommendation
regression tests such as test_recommendation_quality and test_dead_end_fast.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from functools import lru_cache

import server
from server import app

COURSE_CODE_RE = re.compile(r"^[A-Z]{2,5} \d{4}$")
CANONICAL_PRIMARY = "FIN_MAJOR"


# ── Catalog lookups ────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def active_catalog():
    """Return DataFrame of active, selectable programs (excludes applies_to_all)."""
    catalog_df, _, _ = server._get_program_catalog(server._data)
    catalog = catalog_df.copy()
    if "applies_to_all" in catalog.columns:
        catalog = catalog[catalog["applies_to_all"] != True].copy()
    if "active" in catalog.columns:
        catalog = catalog[catalog["active"] == True].copy()
    return catalog


@lru_cache(maxsize=1)
def program_rows() -> dict[str, dict]:
    """Return {track_id: row_dict} for all active programs."""
    catalog = active_catalog()
    return {
        str(row["track_id"]).strip(): row.to_dict()
        for _, row in catalog.iterrows()
    }


@lru_cache(maxsize=1)
def primary_major_id() -> str:
    """Return the canonical standalone primary major (FIN_MAJOR preferred)."""
    rows = program_rows()
    if "FIN_MAJOR" in rows and rows["FIN_MAJOR"].get("kind") == "major":
        return "FIN_MAJOR"
    for track_id, row in rows.items():
        if row.get("kind") == "major" and not bool(row.get("requires_primary_major", False)):
            return track_id
    raise AssertionError("No usable primary major found in active program catalog")


def active_program_ids(kind: str) -> list[str]:
    """Return sorted list of active program IDs for a given kind (major/track/minor)."""
    catalog = active_catalog()
    return sorted(
        str(track_id).strip()
        for track_id in catalog.loc[catalog["kind"] == kind, "track_id"].tolist()
        if str(track_id).strip()
    )


def active_programs() -> tuple[list[str], list[str], list[str]]:
    """Return (majors, tracks, minors) lists of active program IDs."""
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)

    if "applies_to_all" in catalog_df.columns:
        selectable = catalog_df[catalog_df["applies_to_all"] != True].copy()
    else:
        selectable = catalog_df.copy()

    if "active" in selectable.columns:
        selectable = selectable[selectable["active"].astype(str).str.lower().isin(["true", "1", "yes"])]

    majors, tracks, minors = [], [], []
    for _, row in selectable.iterrows():
        tid = str(row["track_id"])
        ptype = str(row.get("kind", row.get("type", ""))).strip().lower()
        if ptype == "minor":
            minors.append(tid)
        elif ptype == "track":
            tracks.append(tid)
        else:
            majors.append(tid)

    return sorted(majors), sorted(tracks), sorted(minors)


def requires_primary(major_id: str) -> bool:
    """Check if a major requires a primary major pairing."""
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)
    row = catalog_df[catalog_df["track_id"] == major_id]
    if row.empty:
        return False
    return bool(row.iloc[0].get("requires_primary_major", False))


def get_parent_major(track_id: str) -> str | None:
    """Get the parent major for a track."""
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)
    row = catalog_df[catalog_df["track_id"] == track_id]
    if row.empty:
        return None
    return (
        str(
            row.iloc[0].get("parent_major")
            or row.iloc[0].get("parent_major_id")
            or ""
        ).strip()
        or None
    )


# ── Payload builders ───────────────────────────────────────────────────────


def declared_majors_for_major(major_id: str) -> list[str]:
    """Build declared_majors list, prepending primary if required."""
    row = program_rows()[major_id]
    declared = [major_id]
    if bool(row.get("requires_primary_major", False)) and primary_major_id() not in declared:
        declared = [primary_major_id(), major_id]
    return declared


def declared_majors_for_track(track_id: str) -> list[str]:
    """Build declared_majors list for a track (includes parent major)."""
    row = program_rows()[track_id]
    parent_major = str(row.get("parent_major") or row.get("parent_major_id") or "").strip()
    if not parent_major:
        return []
    declared = [parent_major]
    parent_row = program_rows().get(parent_major, {})
    if bool(parent_row.get("requires_primary_major", False)) and primary_major_id() not in declared:
        declared = [primary_major_id(), parent_major]
    return declared


def recommend_payload(
    *,
    declared_majors: list[str],
    track_id: str = "",
    declared_minors: list[str] | None = None,
    completed_courses: list[str] | None = None,
    in_progress_courses: list[str] | None = None,
    target_semester_primary: str = "Fall 2026",
    target_semester_count: int = 1,
    max_recommendations: int = 6,
    include_summer: bool = False,
    debug: bool = False,
    student_stage: str | None = None,
) -> dict:
    """Build a /recommend request payload."""
    payload = {
        "declared_majors": declared_majors,
        "track_id": track_id,
        "declared_minors": declared_minors or [],
        "completed_courses": ", ".join(completed_courses or []),
        "in_progress_courses": ", ".join(in_progress_courses or []),
        "target_semester_primary": target_semester_primary,
        "target_semester_count": target_semester_count,
        "max_recommendations": max_recommendations,
    }
    if include_summer:
        payload["include_summer"] = True
    if debug:
        payload["debug"] = True
        payload["debug_limit"] = 12
    if student_stage:
        payload["student_stage"] = student_stage
    return payload


def payload_for_major(
    major_id: str,
    *,
    completed_courses: list[str] | None = None,
    in_progress_courses: list[str] | None = None,
    target_semester_primary: str = "Fall 2026",
    target_semester_count: int = 1,
    max_recommendations: int = 6,
    include_summer: bool = False,
    debug: bool = False,
    student_stage: str | None = None,
) -> dict:
    """Build a /recommend payload for a single major."""
    return recommend_payload(
        declared_majors=declared_majors_for_major(major_id),
        completed_courses=completed_courses,
        in_progress_courses=in_progress_courses,
        target_semester_primary=target_semester_primary,
        target_semester_count=target_semester_count,
        max_recommendations=max_recommendations,
        include_summer=include_summer,
        debug=debug,
        student_stage=student_stage,
    )


# ── API helpers ────────────────────────────────────────────────────────────


def post_recommend(client, payload: dict) -> dict:
    """POST /recommend and assert success."""
    response = client.post("/recommend", json=payload)
    data = response.get_json()
    assert response.status_code == 200, f"Unexpected status for payload {payload}: {data}"
    assert data.get("error") is None, f"Recommendation error for payload {payload}: {data['error']}"
    return data


# ── Assertion helpers ──────────────────────────────────────────────────────


def assert_recommendation_shape(recommendations: list[dict]):
    """Assert recommendations have correct shape, valid course codes, no duplicates."""
    assert recommendations, "Expected at least one recommendation"

    course_codes = []
    for rec in recommendations:
        for field in ("course_code", "course_name", "credits", "fills_buckets"):
            assert field in rec, f"Recommendation missing '{field}': {rec}"

        assert isinstance(rec["course_name"], str) and rec["course_name"].strip(), rec
        assert isinstance(rec["credits"], int) and rec["credits"] >= 0, rec
        assert isinstance(rec["fills_buckets"], list), rec
        assert COURSE_CODE_RE.match(rec["course_code"]), rec
        course_codes.append(rec["course_code"])

    assert len(course_codes) == len(set(course_codes)), (
        f"Duplicate course codes within semester: {course_codes}"
    )


def assert_selection_context(data: dict, expected_program_ids: list[str]):
    """Assert selection_context has correct program IDs and labels."""
    context = data.get("selection_context")
    assert isinstance(context, dict), f"Missing selection_context: {data}"
    assert context["selected_program_ids"] == expected_program_ids
    labels = context.get("selected_program_labels")
    assert isinstance(labels, list) and len(labels) == len(expected_program_ids)
    assert all(isinstance(label, str) and label.strip() for label in labels), context


def active_representatives(kind: str, candidates: list[str], limit: int) -> list[str]:
    """Pick up to `limit` active programs, preferring candidates in order."""
    active = active_program_ids(kind)
    chosen = [pid for pid in candidates if pid in active]
    if len(chosen) < limit:
        for pid in active:
            if pid not in chosen:
                chosen.append(pid)
            if len(chosen) == limit:
                break
    return chosen[:limit]


# ── Triple combo + random profile helpers (nightly v2) ─────────────────────


NIGHTLY_SAMPLE_SIZE = 30
NIGHTLY_SELECTION_VARIANTS = 5
NIGHTLY_CASE_BUDGET = 2250  # 750 base × 3 scheduling styles


@dataclass(frozen=True)
class NightlyScenario:
    label: str
    declared_majors: tuple[str, ...]
    track_ids: tuple[str, ...]
    declared_minors: tuple[str, ...] = ()


@dataclass(frozen=True)
class NightlyProfile:
    label: str
    seeded_semesters: int


NIGHTLY_PROFILES: tuple[NightlyProfile, ...] = (
    NightlyProfile("foundation", 1),
    NightlyProfile("early", 2),
    NightlyProfile("mid", 3),
    NightlyProfile("late", 4),
    NightlyProfile("capstone", 5),
)


def _get_required_major(track_id: str) -> str | None:
    """Get required_major for a track (e.g. AIM_CFA requires FIN)."""
    rows = program_rows()
    row = rows.get(track_id, {})
    val = str(row.get("required_major_id", "") or row.get("required_major", "") or "").strip()
    return val if val else None


@lru_cache(maxsize=1)
def build_triple_cases() -> list[tuple[str, list[str], list[str], list[str]]]:
    """Generate all valid triple program combinations.

    Returns list of (label, declared_majors, track_ids, declared_minors).
    Pool: active majors + active tracks (minors and MCC_DISC tracks excluded).
    Validity: at least 1 primary major in effective declared_majors.
    """
    from itertools import combinations

    majors, tracks, _minors = active_programs()
    # Exclude MCC_DISC tracks (parent inactive)
    tracks = [t for t in tracks if not t.startswith("MCC_DISC_")]

    all_programs = (
        [("major", m) for m in majors]
        + [("track", t) for t in tracks]
    )

    cases = []
    for combo in combinations(all_programs, 3):
        declared_majors = []
        track_ids = []

        for ptype, pid in combo:
            if ptype == "major":
                declared_majors.append(pid)
            elif ptype == "track":
                track_ids.append(pid)
                parent = get_parent_major(pid)
                if parent and parent not in declared_majors:
                    declared_majors.append(parent)
                # AIM_CFA requires FIN_MAJOR
                req = _get_required_major(pid)
                if req and req not in declared_majors:
                    declared_majors.append(req)

        # Check requires_primary satisfaction
        needs_primary = any(requires_primary(m) for m in declared_majors)
        has_primary = any(not requires_primary(m) for m in declared_majors)

        if needs_primary and not has_primary:
            # No valid primary major — skip
            continue

        declared_majors = list(dict.fromkeys(declared_majors))

        ids_sorted = sorted([pid for _, pid in combo])
        label = f"triple-{'+'.join(ids_sorted)}"
        cases.append((label, declared_majors, track_ids, []))

    return cases


@lru_cache(maxsize=1)
def build_nightly_scenario_pool() -> list[NightlyScenario]:
    """Return the full valid nightly scenario pool derived from triple combos."""
    scenarios = [
        NightlyScenario(
            label=label,
            declared_majors=tuple(declared_majors),
            track_ids=tuple(track_ids),
            declared_minors=tuple(declared_minors),
        )
        for label, declared_majors, track_ids, declared_minors in build_triple_cases()
    ]
    return sorted(scenarios, key=lambda scenario: scenario.label)


def sample_nightly_scenarios(seed: int, sample_size: int = NIGHTLY_SAMPLE_SIZE) -> list[NightlyScenario]:
    """Pick a deterministic-random nightly slice from the full scenario pool."""
    pool = build_nightly_scenario_pool()
    if sample_size >= len(pool):
        return pool

    rng = random.Random(seed)
    sampled = rng.sample(pool, sample_size)
    return sorted(sampled, key=lambda scenario: scenario.label)


def expected_nightly_case_count(
    scenario_count: int,
    profile_count: int = len(NIGHTLY_PROFILES),
    selection_variants: int = NIGHTLY_SELECTION_VARIANTS,
) -> int:
    """Return the expected case count for the current nightly configuration."""
    return scenario_count * profile_count * selection_variants
