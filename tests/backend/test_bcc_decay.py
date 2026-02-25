"""
BCC progress-aware decay tests (v1.9).

Verifies that:
- BCC_REQUIRED courses stay Tier 1 when bcc_decay_active=False
- BCC_REQUIRED courses demote to Tier 4 when bcc_decay_active=True
- MCC courses are never affected by BCC decay state
- Demoted BCC children (BCC_ETHICS etc.) are always Tier 5 regardless of decay
- Integration: with BCC_DECAY_ENABLED env flag and threshold logic
"""

import os
import pytest
from semester_recommender import (
    _bucket_hierarchy_tier_v2,
    _count_bcc_required_done,
    _BCC_DECAY_THRESHOLD,
)


# ---------------------------------------------------------------------------
# Unit tests for _bucket_hierarchy_tier_v2 with bcc_decay_active
# ---------------------------------------------------------------------------

class TestBccDecayTierLogic:
    """Unit tests: _bucket_hierarchy_tier_v2 with bcc_decay_active param."""

    BCC_REQUIRED_CAND = {
        "primary_bucket": "FIN_MAJOR::BCC_REQUIRED",
        "primary_parent_bucket_id": "FIN_MAJOR",
        "fills_buckets": ["FIN_MAJOR::BCC_REQUIRED"],
    }
    MCC_CAND = {
        "primary_bucket": "FIN_MAJOR::MCC_CORE",
        "primary_parent_bucket_id": "MCC",
        "fills_buckets": ["FIN_MAJOR::MCC_CORE"],
    }
    DEMOTED_BCC_ETHICS_CAND = {
        "primary_bucket": "FIN_MAJOR::BCC_ETHICS",
        "primary_parent_bucket_id": "FIN_MAJOR",
        "fills_buckets": ["FIN_MAJOR::BCC_ETHICS"],
    }
    MAJOR_CAND = {
        "primary_bucket": "FIN_MAJOR::FIN_CORE",
        "primary_parent_bucket_id": "FIN_MAJOR",
        "fills_buckets": ["FIN_MAJOR::FIN_CORE"],
    }

    def _parent_type_map(self):
        return {"FIN_MAJOR": "major", "MCC": "major", "ACCO_MAJOR": "major"}

    def _bucket_track_required_map(self):
        return {}

    def _bucket_parent_map(self):
        return {
            "FIN_MAJOR::BCC_REQUIRED": "FIN_MAJOR",
            "FIN_MAJOR::MCC_CORE": "MCC",
            "FIN_MAJOR::BCC_ETHICS": "FIN_MAJOR",
            "FIN_MAJOR::FIN_CORE": "FIN_MAJOR",
        }

    def test_bcc_stays_tier1_below_threshold(self):
        """With bcc_decay_active=False, BCC_REQUIRED stays Tier 1."""
        tier = _bucket_hierarchy_tier_v2(
            self.BCC_REQUIRED_CAND,
            self._parent_type_map(),
            self._bucket_track_required_map(),
            self._bucket_parent_map(),
            bcc_decay_active=False,
        )
        assert tier == 1, f"Expected Tier 1 (no decay), got Tier {tier}"

    def test_bcc_decays_at_exactly_threshold(self):
        """With bcc_decay_active=True, BCC_REQUIRED demotes to Tier 4."""
        tier = _bucket_hierarchy_tier_v2(
            self.BCC_REQUIRED_CAND,
            self._parent_type_map(),
            self._bucket_track_required_map(),
            self._bucket_parent_map(),
            bcc_decay_active=True,
        )
        assert tier == 4, f"Expected Tier 4 (decayed BCC_REQUIRED), got Tier {tier}"

    def test_bcc_decays_above_threshold(self):
        """With bcc_decay_active=True (any amount over threshold), BCC_REQUIRED is Tier 4."""
        # bcc_decay_active is already computed externally; this just confirms Tier 4
        tier = _bucket_hierarchy_tier_v2(
            self.BCC_REQUIRED_CAND,
            self._parent_type_map(),
            self._bucket_track_required_map(),
            self._bucket_parent_map(),
            bcc_decay_active=True,
        )
        assert tier == 4, f"Expected Tier 4 for decayed BCC, got Tier {tier}"

    def test_mcc_never_decays(self):
        """MCC courses always stay Tier 1 regardless of bcc_decay_active."""
        for decay in (False, True):
            tier = _bucket_hierarchy_tier_v2(
                self.MCC_CAND,
                self._parent_type_map(),
                self._bucket_track_required_map(),
                self._bucket_parent_map(),
                bcc_decay_active=decay,
            )
            assert tier == 1, (
                f"Expected Tier 1 for MCC (decay={decay}), got Tier {tier}"
            )

    def test_demoted_bcc_children_are_tier5(self):
        """BCC_ETHICS and siblings are Tier 5 regardless of decay state."""
        for decay in (False, True):
            tier = _bucket_hierarchy_tier_v2(
                self.DEMOTED_BCC_ETHICS_CAND,
                self._parent_type_map(),
                self._bucket_track_required_map(),
                self._bucket_parent_map(),
                bcc_decay_active=decay,
            )
            assert tier == 5, (
                f"Expected Tier 5 for demoted BCC child (decay={decay}), got Tier {tier}"
            )

    def test_major_bucket_stays_tier2(self):
        """Major-parent buckets are always Tier 2 regardless of decay."""
        for decay in (False, True):
            tier = _bucket_hierarchy_tier_v2(
                self.MAJOR_CAND,
                self._parent_type_map(),
                self._bucket_track_required_map(),
                self._bucket_parent_map(),
                bcc_decay_active=decay,
            )
            assert tier == 2, (
                f"Expected Tier 2 for major bucket (decay={decay}), got Tier {tier}"
            )

    def test_decayed_bcc_ranks_below_major(self):
        """When decayed, BCC_REQUIRED (Tier 4) ranks below major courses (Tier 2)."""
        tier_bcc = _bucket_hierarchy_tier_v2(
            self.BCC_REQUIRED_CAND,
            self._parent_type_map(),
            self._bucket_track_required_map(),
            self._bucket_parent_map(),
            bcc_decay_active=True,
        )
        tier_major = _bucket_hierarchy_tier_v2(
            self.MAJOR_CAND,
            self._parent_type_map(),
            self._bucket_track_required_map(),
            self._bucket_parent_map(),
            bcc_decay_active=True,
        )
        assert tier_bcc > tier_major, (
            f"Decayed BCC (tier={tier_bcc}) should rank below major (tier={tier_major})"
        )


# ---------------------------------------------------------------------------
# Unit tests for _count_bcc_required_done
# ---------------------------------------------------------------------------

class TestCountBccRequiredDone:
    """Unit tests for the BCC applied-count helper (completed + in-progress)."""

    def test_counts_applied_courses_in_bcc_required(self):
        progress = {
            "FIN_MAJOR::BCC_REQUIRED": {
                "completed_applied": ["THEO 1001", "PHIL 1001", "ENGL 1001"],
                "in_progress_applied": ["MANA 3001"],
                "satisfied": False,
            },
            "FIN_MAJOR::MCC_CORE": {
                "completed_applied": ["ECON 1001"],
                "in_progress_applied": [],
                "satisfied": False,
            },
        }
        assert _count_bcc_required_done(progress) == 4

    def test_returns_zero_when_no_bcc_required_bucket(self):
        progress = {
            "FIN_MAJOR::MCC_CORE": {
                "completed_applied": ["ECON 1001"],
                "in_progress_applied": [],
                "satisfied": False,
            },
        }
        assert _count_bcc_required_done(progress) == 0

    def test_returns_zero_for_empty_progress(self):
        assert _count_bcc_required_done({}) == 0

    def test_bcc_required_as_bare_key(self):
        """Handles bucket_id that is just 'BCC_REQUIRED' without namespace prefix."""
        progress = {
            "BCC_REQUIRED": {
                "completed_applied": ["THEO 1001", "PHIL 1001"],
                "in_progress_applied": ["ENGL 1001"],
                "satisfied": False,
            },
        }
        assert _count_bcc_required_done(progress) == 3

    def test_dedupes_applied_codes_across_completed_and_in_progress(self):
        progress = {
            "BCC_REQUIRED": {
                "completed_applied": ["THEO 1001", "PHIL 1001"],
                "in_progress_applied": ["PHIL 1001", "ENGL 1001"],
                "satisfied": False,
            },
        }
        assert _count_bcc_required_done(progress) == 3


# ---------------------------------------------------------------------------
# Integration: threshold boundary
# ---------------------------------------------------------------------------

class TestBccDecayThreshold:
    """Verify the module-level threshold constant and boundary behavior."""

    def test_threshold_is_12(self):
        assert _BCC_DECAY_THRESHOLD == 12

    def test_decay_fires_at_exactly_12_courses(self):
        """Boundary: exactly 12 courses → decay should be active."""
        courses = [f"COURSE {i}" for i in range(12)]
        progress = {
            "FIN_MAJOR::BCC_REQUIRED": {
                "completed_applied": courses,
                "in_progress_applied": [],
                "satisfied": False,
            }
        }
        done = _count_bcc_required_done(progress)
        bcc_decay_active = done >= _BCC_DECAY_THRESHOLD
        assert bcc_decay_active is True

    def test_decay_does_not_fire_at_11_courses(self):
        """Boundary: 11 courses → decay should NOT be active."""
        courses = [f"COURSE {i}" for i in range(11)]
        progress = {
            "FIN_MAJOR::BCC_REQUIRED": {
                "completed_applied": courses,
                "in_progress_applied": [],
                "satisfied": False,
            }
        }
        done = _count_bcc_required_done(progress)
        bcc_decay_active = done >= _BCC_DECAY_THRESHOLD
        assert bcc_decay_active is False
