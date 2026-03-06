"""
Tier invariant tests for _bucket_hierarchy_tier_v2.

Verifies the stable tier assignments:
  Tier 1: MCC + BCC_REQUIRED
  Tier 2: major buckets
  Tier 3: track/minor buckets
  Tier 5: demoted BCC children (BCC_ETHICS, BCC_ANALYTICS, BCC_ENHANCE)
"""

from semester_recommender import _bucket_hierarchy_tier_v2


PARENT_TYPE_MAP = {"FIN_MAJOR": "major", "MCC": "major", "CB_TRACK": "track"}
BUCKET_TRACK_REQUIRED_MAP = {}
BUCKET_PARENT_MAP = {
    "FIN_MAJOR::BCC_REQUIRED": "FIN_MAJOR",
    "FIN_MAJOR::MCC_CORE": "MCC",
    "FIN_MAJOR::BCC_ETHICS": "FIN_MAJOR",
    "FIN_MAJOR::FIN_CORE": "FIN_MAJOR",
    "CB_TRACK::CB_ELECTIVE": "CB_TRACK",
}


def _tier(candidate):
    return _bucket_hierarchy_tier_v2(
        candidate, PARENT_TYPE_MAP, BUCKET_TRACK_REQUIRED_MAP, BUCKET_PARENT_MAP,
    )


def test_mcc_is_tier_1():
    cand = {"fills_buckets": ["FIN_MAJOR::MCC_CORE"], "primary_bucket": "FIN_MAJOR::MCC_CORE", "primary_parent_bucket_id": "MCC"}
    assert _tier(cand) == 1


def test_bcc_required_is_tier_1():
    cand = {"fills_buckets": ["FIN_MAJOR::BCC_REQUIRED"], "primary_bucket": "FIN_MAJOR::BCC_REQUIRED", "primary_parent_bucket_id": "FIN_MAJOR"}
    assert _tier(cand) == 1


def test_major_bucket_is_tier_2():
    cand = {"fills_buckets": ["FIN_MAJOR::FIN_CORE"], "primary_bucket": "FIN_MAJOR::FIN_CORE", "primary_parent_bucket_id": "FIN_MAJOR"}
    assert _tier(cand) == 2


def test_track_bucket_is_tier_3():
    cand = {"fills_buckets": ["CB_TRACK::CB_ELECTIVE"], "primary_bucket": "CB_TRACK::CB_ELECTIVE", "primary_parent_bucket_id": "CB_TRACK"}
    assert _tier(cand) == 3


def test_demoted_bcc_children_are_tier_5():
    for child in ["BCC_ETHICS", "BCC_ANALYTICS", "BCC_ENHANCE"]:
        cand = {"fills_buckets": [f"FIN_MAJOR::{child}"], "primary_bucket": f"FIN_MAJOR::{child}", "primary_parent_bucket_id": "FIN_MAJOR"}
        assert _tier(cand) == 5, f"{child} should be Tier 5"


def test_tier_1_beats_tier_2():
    t1 = _tier({"fills_buckets": ["FIN_MAJOR::BCC_REQUIRED"], "primary_bucket": "FIN_MAJOR::BCC_REQUIRED", "primary_parent_bucket_id": "FIN_MAJOR"})
    t2 = _tier({"fills_buckets": ["FIN_MAJOR::FIN_CORE"], "primary_bucket": "FIN_MAJOR::FIN_CORE", "primary_parent_bucket_id": "FIN_MAJOR"})
    assert t1 < t2
