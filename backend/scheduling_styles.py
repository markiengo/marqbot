"""
Scheduling style (build) configuration and style-aware selection logic.

Each style controls how MarqBot balances core requirements vs discovery/gen-ed
courses within a single semester's recommendations.  The mechanism is
**slot reservation**: styles declare how many of the max_recs slots must be
filled by each category, and the selection loop enforces those reservations.

Styles:
  grinder  - Major-first. No slot reservations. Discovery fills gaps only.
  explorer - Front-loads discovery. Reserves 2 slots for discovery/gen-ed
             courses. Can defer BCC when the student has enough runway.
  mixer    - Guaranteed mix. Reserves 1 discovery + 2 core slots and
             interleaves picks so no semester is all-business or all-exploration.

All styles respect hard constraints: prerequisites, standing gates, critical
bridge courses, and graduation feasibility.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable


# ---------------------------------------------------------------------------
# Style configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class StyleConfig:
    """Immutable configuration for a scheduling style (build).

    Attributes:
        name: Human-readable style identifier.
        min_discovery_slots: Best-effort minimum discovery/gen-ed picks per
            semester.  The selection loop tries to hit this target but will not
            block if fewer discovery courses are eligible.
        min_core_slots: Best-effort minimum core (BCC/major/track) picks per
            semester.
        interleave: When True the selection loop alternates core and discovery
            picks so the final list has variety (used by mixer).
        tier_map: Secondary lever — remaps base tiers (1-7) before sorting.
            The primary differentiation comes from slot reservations, but the
            tier map still influences tie-breaking within the ranked list.
        relax_bcc_band: When True *and* the student has >= 4 semesters of
            runway, band-1 BCC courses are demoted to band 2 so MCC and
            discovery courses can surface earlier (used by explorer).
    """

    name: str
    min_discovery_slots: int = 0
    min_core_slots: int = 0
    interleave: bool = False
    tier_map: dict[int, int] = field(default_factory=lambda: {
        1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
    })
    relax_bcc_band: bool = False


# -- Concrete style configs --------------------------------------------------

STYLE_GRINDER = StyleConfig(
    name="grinder",
    min_discovery_slots=0,
    min_core_slots=0,
    interleave=False,
    tier_map={1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7},
    relax_bcc_band=False,
)

STYLE_EXPLORER = StyleConfig(
    name="explorer",
    min_discovery_slots=2,
    min_core_slots=0,
    interleave=False,
    # Promote discovery/late-MCC tiers (5,6 -> 2), demote BCC/major (2->4, 3->5, 4->6)
    tier_map={1: 1, 2: 4, 3: 5, 4: 6, 5: 2, 6: 2, 7: 7},
    relax_bcc_band=True,
)

STYLE_MIXER = StyleConfig(
    name="mixer",
    min_discovery_slots=1,
    min_core_slots=2,
    interleave=True,
    # Promote discovery/late-MCC tiers (5,6 -> 2), keep BCC/major the same
    tier_map={1: 1, 2: 2, 3: 3, 4: 4, 5: 2, 6: 2, 7: 7},
    relax_bcc_band=False,
)

_STYLE_REGISTRY: dict[str, StyleConfig] = {
    "grinder": STYLE_GRINDER,
    "explorer": STYLE_EXPLORER,
    "mixer": STYLE_MIXER,
}

VALID_SCHEDULING_STYLES = frozenset(_STYLE_REGISTRY)


def get_style_config(name: str | None) -> StyleConfig:
    """Return the StyleConfig for *name*, falling back to grinder."""
    if not name:
        return STYLE_GRINDER
    return _STYLE_REGISTRY.get(name, STYLE_GRINDER)


# ---------------------------------------------------------------------------
# Candidate classification
# ---------------------------------------------------------------------------

def classify_candidate(
    candidate: dict,
    *,
    is_discovery_driven: bool,
    ranking_band: int,
) -> str:
    """Classify a candidate as ``'bridge'``, ``'discovery'``, or ``'core'``.

    - **bridge** (band 0): Priority core bridge candidates that must always be
      selected regardless of style.  Exempt from slot reservations.
    - **discovery**: Courses whose only unmet buckets are discovery/gen-ed.
      Determined by the existing ``_is_discovery_driven`` flag plus late-MCC
      tier membership (ESSV2, WRIT).
    - **core**: Everything else — BCC, major, track, minor courses.
    """
    if ranking_band == 0:
        return "bridge"
    if is_discovery_driven:
        return "discovery"
    # Also classify late-MCC (tier 5 before style remap) as discovery-adjacent
    # so explorer/mixer can reserve slots for them.
    base_tier = candidate.get("base_tier")
    if base_tier is not None and base_tier in (5, 6):
        return "discovery"
    return "core"


# ---------------------------------------------------------------------------
# Style-aware selection
# ---------------------------------------------------------------------------

def style_select(
    ranked_candidates: list[dict],
    style: StyleConfig,
    max_recs: int,
    *,
    accept_fn: Callable[[dict, list[str]], None],
    can_select_fn: Callable[[dict, set[str]], tuple[bool, list[str]]],
    classify_fn: Callable[[dict], str],
) -> list[dict]:
    """Three-pass style-aware course selection.

    This replaces the old single greedy loop with a three-pass approach that
    enforces slot reservations for discovery and core courses.

    Passes:
      1. **Mandatory** — Accept all band-0 (bridge) candidates.  These unlock
         critical prerequisite chains and are non-negotiable.
      2. **Reservation** — Fill style-specific slot reservations.  Explorer
         scans for the first N discovery candidates; mixer alternates between
         core and discovery.  Grinder skips this pass entirely.
      3. **Greedy fill** — Fill remaining slots from the ranked list in order,
         identical to the old single-pass behavior.

    Args:
        ranked_candidates: Pre-sorted candidate list (output of the multi-key
            sort in the recommender).
        style: The active StyleConfig.
        max_recs: Maximum courses to select this semester.
        accept_fn: Callback to record a selected candidate and update virtual
            bucket state.  Signature: ``(candidate, assigned_buckets) -> None``.
        can_select_fn: Returns ``(ok, assigned_buckets)`` for a candidate given
            the set of already-selected course codes.  Encapsulates all gate
            checks: WRIT limit, same-semester prereqs, maturity guard, bucket
            capacity, and bridge deferral.
        classify_fn: Returns ``'bridge'`` | ``'discovery'`` | ``'core'`` for a
            candidate.

    Returns:
        List of selected candidate dicts in selection order.
    """
    selected: list[dict] = []
    selected_codes: set[str] = set()

    def _try_accept(cand: dict) -> bool:
        """Attempt to select *cand*.  Returns True if accepted."""
        if cand["course_code"] in selected_codes:
            return False
        ok, assigned = can_select_fn(cand, selected_codes)
        if not ok:
            return False
        accept_fn(cand, assigned)
        selected.append(cand)
        selected_codes.add(cand["course_code"])
        return True

    # ── Pass 1: Mandatory bridge picks ──────────────────────────────────
    # Band-0 candidates unlock critical prereq chains.  Every style must
    # select them.
    for cand in ranked_candidates:
        if len(selected) >= max_recs:
            break
        if classify_fn(cand) == "bridge":
            _try_accept(cand)

    # ── Pass 2: Slot reservations ───────────────────────────────────────
    # Each style declares minimum discovery and core slots.  We fill those
    # targets here before the greedy pass fills the rest.
    #
    # Reservations are best-effort: if only 1 discovery course is eligible
    # but the style wants 2, we take 1 and move on.
    if style.interleave:
        # Mixer: alternate core and discovery picks to guarantee variety.
        core_target = style.min_core_slots
        disc_target = style.min_discovery_slots
        core_filled = 0
        disc_filled = 0
        # Alternate: core, discovery, core, discovery, ...
        while len(selected) < max_recs and (core_filled < core_target or disc_filled < disc_target):
            made_progress = False
            # Try to pick a core course
            if core_filled < core_target:
                for cand in ranked_candidates:
                    if len(selected) >= max_recs:
                        break
                    if cand["course_code"] in selected_codes:
                        continue
                    if classify_fn(cand) == "core":
                        if _try_accept(cand):
                            core_filled += 1
                            made_progress = True
                            break
            # Try to pick a discovery course
            if disc_filled < disc_target and len(selected) < max_recs:
                for cand in ranked_candidates:
                    if len(selected) >= max_recs:
                        break
                    if cand["course_code"] in selected_codes:
                        continue
                    if classify_fn(cand) == "discovery":
                        if _try_accept(cand):
                            disc_filled += 1
                            made_progress = True
                            break
            if not made_progress:
                break
    else:
        # Non-interleaved reservation (explorer / grinder).
        # Fill discovery slots first (explorer wants 2), then core slots.
        disc_filled = 0
        for cand in ranked_candidates:
            if disc_filled >= style.min_discovery_slots:
                break
            if len(selected) >= max_recs:
                break
            if cand["course_code"] in selected_codes:
                continue
            if classify_fn(cand) == "discovery":
                if _try_accept(cand):
                    disc_filled += 1

        core_filled = 0
        for cand in ranked_candidates:
            if core_filled >= style.min_core_slots:
                break
            if len(selected) >= max_recs:
                break
            if cand["course_code"] in selected_codes:
                continue
            if classify_fn(cand) == "core":
                if _try_accept(cand):
                    core_filled += 1

    # ── Pass 3: Greedy fill ─────────────────────────────────────────────
    # Fill remaining slots from the ranked list in order.  This is identical
    # to the old single-pass greedy behavior.
    for cand in ranked_candidates:
        if len(selected) >= max_recs:
            break
        _try_accept(cand)

    return selected
