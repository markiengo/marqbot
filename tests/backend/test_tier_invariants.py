"""
Tier invariant tests for _bucket_hierarchy_tier_v2.

Verifies the stable tier assignments:
  Tier 1: MCC Foundation
  Tier 2: BCC
  Tier 3: major buckets
  Tier 4: track/minor buckets
  Tier 5: MCC_ESSV2, MCC_WRIT, and MCC_CULM
  Tier 6: Discovery
"""

from semester_recommender import _bucket_hierarchy_tier_v2


PARENT_TYPE_MAP = {
    "FIN_MAJOR": "major",
    "CB_TRACK": "track",
    "AIM_MINOR": "minor",
    "MCC_FOUNDATION": "universal",
    "MCC_ESSV2": "universal",
    "MCC_WRIT": "universal",
    "MCC_CULM": "universal",
    "MCC_DISC_CB": "track",
}
BUCKET_TRACK_REQUIRED_MAP = {}
BUCKET_PARENT_MAP = {
    "BCC::BCC_REQUIRED": "BCC_CORE",
    "BCC::BCC_ANALYTICS": "BCC_CORE",
    "MCC::MCC_CORE": "MCC_FOUNDATION",
    "MCC::MCC_ESSV1": "MCC_FOUNDATION",
    "FIN_MAJOR::FIN_CORE": "FIN_MAJOR",
    "CB_TRACK::CB_ELECTIVE": "CB_TRACK",
    "AIM_MINOR::AIM_ELECTIVE": "AIM_MINOR",
    "MCC::MCC_ESSV2": "MCC_ESSV2",
    "MCC::MCC_WRIT": "MCC_WRIT",
    "MCC::MCC_CULM": "MCC_CULM",
    "MCC::MCC_DISC_CB_SSC": "MCC_DISC_CB",
}


def _tier(candidate):
    return _bucket_hierarchy_tier_v2(
        candidate, PARENT_TYPE_MAP, BUCKET_TRACK_REQUIRED_MAP, BUCKET_PARENT_MAP,
    )


def test_mcc_foundation_is_tier_1():
    cand = {"fills_buckets": ["MCC::MCC_CORE"], "primary_bucket": "MCC::MCC_CORE", "primary_parent_bucket_id": "MCC_FOUNDATION"}
    assert _tier(cand) == 1


def test_bcc_is_tier_2():
    for child in ["BCC_REQUIRED", "BCC_ANALYTICS"]:
        cand = {"fills_buckets": [f"BCC::{child}"], "primary_bucket": f"BCC::{child}", "primary_parent_bucket_id": "BCC_CORE"}
        assert _tier(cand) == 2, f"{child} should be Tier 2"


def test_major_bucket_is_tier_3():
    cand = {"fills_buckets": ["FIN_MAJOR::FIN_CORE"], "primary_bucket": "FIN_MAJOR::FIN_CORE", "primary_parent_bucket_id": "FIN_MAJOR"}
    assert _tier(cand) == 3


def test_track_and_minor_buckets_are_tier_4():
    track = {"fills_buckets": ["CB_TRACK::CB_ELECTIVE"], "primary_bucket": "CB_TRACK::CB_ELECTIVE", "primary_parent_bucket_id": "CB_TRACK"}
    minor = {"fills_buckets": ["AIM_MINOR::AIM_ELECTIVE"], "primary_bucket": "AIM_MINOR::AIM_ELECTIVE", "primary_parent_bucket_id": "AIM_MINOR"}
    assert _tier(track) == 4
    assert _tier(minor) == 4


def test_essv2_writ_and_culm_are_tier_5():
    for child in ["MCC_ESSV2", "MCC_WRIT", "MCC_CULM"]:
        cand = {"fills_buckets": [f"MCC::{child}"], "primary_bucket": f"MCC::{child}", "primary_parent_bucket_id": child}
        assert _tier(cand) == 5, f"{child} should be Tier 5"


def test_discovery_is_tier_6():
    discovery = {"fills_buckets": ["MCC::MCC_DISC_CB_SSC"], "primary_bucket": "MCC::MCC_DISC_CB_SSC", "primary_parent_bucket_id": "MCC_DISC_CB"}
    assert _tier(discovery) == 6


def test_foundation_beats_bcc_and_major():
    foundation = _tier({"fills_buckets": ["MCC::MCC_ESSV1"], "primary_bucket": "MCC::MCC_ESSV1", "primary_parent_bucket_id": "MCC_FOUNDATION"})
    bcc = _tier({"fills_buckets": ["BCC::BCC_REQUIRED"], "primary_bucket": "BCC::BCC_REQUIRED", "primary_parent_bucket_id": "BCC_CORE"})
    major = _tier({"fills_buckets": ["FIN_MAJOR::FIN_CORE"], "primary_bucket": "FIN_MAJOR::FIN_CORE", "primary_parent_bucket_id": "FIN_MAJOR"})
    assert foundation < bcc < major
