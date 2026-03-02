"""
Fast deterministic dead-end invariant suite for PR gating.

Runs every active single program selection + curated high-risk combos,
each with multiple starting histories (empty, foundation, mid, late),
and asserts no 2-term dead-ends occur.

Target runtime: under 3 minutes on a normal dev machine.
"""

import pytest

import server
from dead_end_utils import (
    PlanCase,
    run_case_and_assert,
    seed_from_simulation,
)


# ── Program discovery helpers ───────────────────────────────────────────────


def _active_programs():
    """Return (majors, tracks, minors) lists of active program IDs from live data."""
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)

    if "applies_to_all" in catalog_df.columns:
        selectable = catalog_df[catalog_df["applies_to_all"] != True].copy()
    else:
        selectable = catalog_df.copy()

    if "active" in selectable.columns:
        selectable = selectable[selectable["active"].astype(str).str.lower().isin(["true", "1", "yes"])]

    majors = []
    tracks = []
    minors = []

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


def _requires_primary(major_id):
    """Check if a major requires a primary major pairing."""
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)
    row = catalog_df[catalog_df["track_id"] == major_id]
    if row.empty:
        return False
    return bool(row.iloc[0].get("requires_primary_major", False))


def _get_parent_major(track_id):
    """Get the parent major for a track."""
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)
    row = catalog_df[catalog_df["track_id"] == track_id]
    if row.empty:
        return None
    return str(row.iloc[0].get("parent_major", "")) or None


CANONICAL_PRIMARY = "FIN_MAJOR"


# ── Case generation ─────────────────────────────────────────────────────────


def _single_major_cases():
    """Generate PlanCase for every active major."""
    majors, _, _ = _active_programs()
    cases = []
    for mid in majors:
        declared = [mid]
        if _requires_primary(mid):
            declared = [CANONICAL_PRIMARY, mid]
        cases.append((
            f"major-{mid}",
            PlanCase(
                declared_majors=declared,
                track_ids=[],
                declared_minors=[],
                completed_courses=[],
                in_progress_courses=[],
                target_semester_primary="Fall 2026",
            ),
        ))
    return cases


def _single_track_cases():
    """Generate PlanCases for every active track (standalone + with parent major)."""
    _, tracks, _ = _active_programs()
    cases = []
    for tid in tracks:
        parent = _get_parent_major(tid)
        # Track-only selection
        if parent:
            majors = [parent]
            if _requires_primary(parent):
                majors = [CANONICAL_PRIMARY, parent]
        else:
            majors = []
        cases.append((
            f"track-{tid}",
            PlanCase(
                declared_majors=majors,
                track_ids=[tid],
                declared_minors=[],
                completed_courses=[],
                in_progress_courses=[],
                target_semester_primary="Fall 2026",
            ),
        ))
    return cases


# Curated high-risk overlap combos
# NOTE: minors are excluded — they exist in parent_buckets.csv but have no
# child buckets or course mappings yet (Coming Soon).  Re-enable once minor
# data is injected.
CURATED_COMBOS = [
    ("combo-FIN+INSY+BUAN", PlanCase(
        declared_majors=["FIN_MAJOR", "INSY_MAJOR"],
        track_ids=[], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-FIN+AIM", PlanCase(
        declared_majors=["FIN_MAJOR", "AIM_MAJOR"],
        track_ids=[], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-FIN+AIM+FINTECH", PlanCase(
        declared_majors=["FIN_MAJOR", "AIM_MAJOR"],
        track_ids=["AIM_FINTECH_TRACK"], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-FIN+CB_TRACK", PlanCase(
        declared_majors=["FIN_MAJOR"],
        track_ids=["FIN_CB_TRACK"], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
    ("combo-REAL+REAP", PlanCase(
        declared_majors=["REAL_MAJOR"],
        track_ids=["REAL_REAP_TRACK"], declared_minors=[],
        completed_courses=[], in_progress_courses=[],
        target_semester_primary="Spring 2026",
    )),
]


def _generate_state_variants(label: str, base_case: PlanCase):
    """Generate empty, foundation, mid, and late starting states for a base case."""
    variants = [(f"{label}/empty", base_case)]

    # Foundation: take first 3 recommendations from empty simulation
    foundation = seed_from_simulation(base_case, 1)
    if foundation:
        variants.append((
            f"{label}/foundation",
            PlanCase(
                declared_majors=base_case.declared_majors,
                track_ids=base_case.track_ids,
                declared_minors=base_case.declared_minors,
                completed_courses=foundation[:3],
                in_progress_courses=[],
                target_semester_primary=base_case.target_semester_primary,
                include_summer=base_case.include_summer,
                max_recommendations=base_case.max_recommendations,
            ),
        ))

    # Mid: first 2 semesters of recs
    mid = seed_from_simulation(base_case, 2)
    if mid:
        variants.append((
            f"{label}/mid",
            PlanCase(
                declared_majors=base_case.declared_majors,
                track_ids=base_case.track_ids,
                declared_minors=base_case.declared_minors,
                completed_courses=mid,
                in_progress_courses=[],
                target_semester_primary=base_case.target_semester_primary,
                include_summer=base_case.include_summer,
                max_recommendations=base_case.max_recommendations,
            ),
        ))

    # Late: first 4 semesters of recs
    late = seed_from_simulation(base_case, 4)
    if late:
        variants.append((
            f"{label}/late",
            PlanCase(
                declared_majors=base_case.declared_majors,
                track_ids=base_case.track_ids,
                declared_minors=base_case.declared_minors,
                completed_courses=late,
                in_progress_courses=[],
                target_semester_primary=base_case.target_semester_primary,
                include_summer=base_case.include_summer,
                max_recommendations=base_case.max_recommendations,
            ),
        ))

    return variants


# ── Build parametrized test cases ───────────────────────────────────────────


def _collect_fast_cases():
    """Collect all fast-suite cases with state variants."""
    all_cases = []

    for label, base in _single_major_cases():
        all_cases.extend(_generate_state_variants(label, base))

    for label, base in _single_track_cases():
        all_cases.extend(_generate_state_variants(label, base))

    # Minors excluded — no child buckets or course mappings yet.

    for label, base in CURATED_COMBOS:
        all_cases.extend(_generate_state_variants(label, base))

    return all_cases


# Collect at module load (data loaded via server import)
_FAST_CASES = _collect_fast_cases()


# ── Tests ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "label,case",
    [(label, case) for label, case in _FAST_CASES],
    ids=[label for label, _ in _FAST_CASES],
)
def test_no_dead_end(label, case):
    """Assert no 2-term dead-end for this program selection and starting state."""
    run_case_and_assert(case, num_terms=9)
