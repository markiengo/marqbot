"""
Nightly broad deterministic dead-end state sweep.

Covers pairwise program combinations, BFS reachable states, and
adversarial random-but-deterministic student histories.

All randomness uses a fixed seed for reproducibility.
Run with: pytest -m nightly
"""

import random
from itertools import combinations

import pytest

import server
from dead_end_utils import (
    PlanCase,
    run_case_and_assert,
    seed_from_simulation,
    simulate_terms,
)

pytestmark = pytest.mark.nightly

FIXED_SEED = 20260302
CANONICAL_PRIMARY = "FIN_MAJOR"
START_TERMS = ["Fall 2026", "Spring 2026", "Summer 2026"]


# ── Program discovery ───────────────────────────────────────────────────────


def _active_programs():
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


def _requires_primary(major_id):
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)
    row = catalog_df[catalog_df["track_id"] == major_id]
    if row.empty:
        return False
    return bool(row.iloc[0].get("requires_primary_major", False))


def _get_parent_major(track_id):
    data = server._data
    catalog_df, _, _ = server._get_program_catalog(data)
    row = catalog_df[catalog_df["track_id"] == track_id]
    if row.empty:
        return None
    return str(row.iloc[0].get("parent_major", "")) or None


# ── Pair generation ─────────────────────────────────────────────────────────


def _build_pair_cases():
    """Generate valid pairwise program selections.
    Minors excluded — no child buckets or course mappings yet (Coming Soon)."""
    majors, tracks, _minors = _active_programs()
    all_programs = (
        [("major", m) for m in majors]
        + [("track", t) for t in tracks]
    )

    cases = []
    for (type_a, id_a), (type_b, id_b) in combinations(all_programs, 2):
        declared_majors = []
        track_ids = []
        declared_minors = []
        needs_primary = False

        for ptype, pid in [(type_a, id_a), (type_b, id_b)]:
            if ptype == "major":
                declared_majors.append(pid)
                if _requires_primary(pid):
                    needs_primary = True
            elif ptype == "track":
                track_ids.append(pid)
                parent = _get_parent_major(pid)
                if parent and parent not in declared_majors:
                    declared_majors.append(parent)
                    if _requires_primary(parent):
                        needs_primary = True

        # Ensure primary major pairing if needed
        if needs_primary and not any(
            not _requires_primary(m) for m in declared_majors
        ):
            declared_majors.insert(0, CANONICAL_PRIMARY)

        # Minor-only needs a base major
        if not declared_majors and not track_ids:
            declared_majors = [CANONICAL_PRIMARY]

        # Skip duplicate major entries
        declared_majors = list(dict.fromkeys(declared_majors))

        label = f"pair-{id_a}+{id_b}"
        cases.append((label, declared_majors, track_ids, declared_minors))

    return cases


# ── Adversarial state generation ────────────────────────────────────────────


def _get_course_universe(case: PlanCase) -> list[str]:
    """Get the course universe for a program selection."""
    try:
        from dead_end_utils import resolve_effective_plan
        effective_data, _, _, _, _, _ = resolve_effective_plan(case)
        course_map = effective_data.get("course_bucket_map_df")
        if course_map is not None and not course_map.empty:
            mapped = set(course_map["course_code"].astype(str).tolist())
        else:
            mapped = set()

        # Add direct prereqs of mapped courses
        prereq_map = effective_data.get("prereq_map", {})
        extended = set(mapped)
        for cc in mapped:
            info = prereq_map.get(cc, {})
            for clause in info.get("clauses", []):
                if isinstance(clause, str):
                    extended.add(clause)
                elif isinstance(clause, list):
                    extended.update(clause)

        return sorted(extended)
    except (ValueError, Exception):
        return []


def _generate_adversarial_states(
    case: PlanCase, rng: random.Random, universe: list[str]
) -> list[PlanCase]:
    """Generate deterministic random states from the course universe."""
    if not universe:
        return []

    states = []
    ranges = [
        (0, min(8, len(universe))),     # early: 0-8 courses
        (9, min(18, len(universe))),    # mid: 9-18 courses
        (19, min(35, len(universe))),   # late: 19-35 courses
    ]

    for lo, hi in ranges:
        if lo > len(universe):
            continue
        for _ in range(4):
            n = rng.randint(lo, hi)
            completed = rng.sample(universe, min(n, len(universe)))
            states.append(PlanCase(
                declared_majors=case.declared_majors,
                track_ids=case.track_ids,
                declared_minors=case.declared_minors,
                completed_courses=completed,
                in_progress_courses=[],
                target_semester_primary=case.target_semester_primary,
                include_summer=case.include_summer,
                max_recommendations=case.max_recommendations,
            ))

    return states


# ── BFS reachable states ────────────────────────────────────────────────────


def _bfs_reachable_states(case: PlanCase, max_depth: int = 3, max_states: int = 12) -> list[PlanCase]:
    """BFS from empty state, branching on first 2 recommendations at each depth."""
    queue = [case]
    seen = {frozenset(case.completed_courses)}
    result = [case]

    for _ in range(max_depth):
        if len(result) >= max_states:
            break
        next_queue = []
        for current in queue:
            if len(result) >= max_states:
                break
            try:
                semesters = simulate_terms(current, num_terms=1)
            except (ValueError, Exception):
                continue

            recs = semesters[0].get("recommendations", []) if semesters else []
            branch_recs = [r["course_code"] for r in recs[:2] if r.get("course_code")]

            for rec_code in branch_recs:
                new_completed = list(current.completed_courses) + [rec_code]
                key = frozenset(new_completed)
                if key in seen:
                    continue
                seen.add(key)
                new_case = PlanCase(
                    declared_majors=current.declared_majors,
                    track_ids=current.track_ids,
                    declared_minors=current.declared_minors,
                    completed_courses=new_completed,
                    in_progress_courses=[],
                    target_semester_primary=current.target_semester_primary,
                    include_summer=current.include_summer,
                    max_recommendations=current.max_recommendations,
                )
                result.append(new_case)
                next_queue.append(new_case)
                if len(result) >= max_states:
                    break

        queue = next_queue

    return result


# ── Collect all nightly cases ───────────────────────────────────────────────


def _collect_nightly_cases():
    pairs = _build_pair_cases()
    rng = random.Random(FIXED_SEED)
    all_cases = []

    for label, declared_majors, track_ids, declared_minors in pairs:
        for start_term in START_TERMS:
            include_summer = "summer" in start_term.lower()
            base = PlanCase(
                declared_majors=declared_majors,
                track_ids=track_ids,
                declared_minors=declared_minors,
                completed_courses=[],
                in_progress_courses=[],
                target_semester_primary=start_term,
                include_summer=include_summer,
            )

            term_label = start_term.replace(" ", "")
            case_label = f"{label}/{term_label}"

            # BFS reachable states
            bfs_states = _bfs_reachable_states(base, max_depth=3, max_states=12)
            for idx, state in enumerate(bfs_states):
                all_cases.append((f"{case_label}/bfs-{idx}", state))

            # Adversarial states
            universe = _get_course_universe(base)
            adv_states = _generate_adversarial_states(base, rng, universe)
            for idx, state in enumerate(adv_states):
                all_cases.append((f"{case_label}/adv-{idx}", state))

    return all_cases


# Collect at module load — only when nightly marker is active
_NIGHTLY_CASES = None


def _get_nightly_cases():
    global _NIGHTLY_CASES
    if _NIGHTLY_CASES is None:
        _NIGHTLY_CASES = _collect_nightly_cases()
    return _NIGHTLY_CASES


# ── Tests ───────────────────────────────────────────────────────────────────


def _case_ids():
    cases = _get_nightly_cases()
    return [label for label, _ in cases]


def _case_params():
    return _get_nightly_cases()


@pytest.mark.parametrize(
    "label,case",
    _case_params(),
    ids=_case_ids(),
)
def test_nightly_no_dead_end(label, case):
    """Assert no 2-term dead-end for this nightly pairwise case."""
    run_case_and_assert(case, num_terms=9)
