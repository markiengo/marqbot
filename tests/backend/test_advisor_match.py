"""
Offline Advisor Match tests (v1.9).

Calls the Flask test client (no live server needed) to score each gold profile.
Pass criteria per profile: overlap(actual_top6, expected_top6) >= 4.

These tests are nightly-only because the gold profiles are intended to drive
catalog patch decisions from the nightly report rather than block PRs.
"""

import json
import os
import pytest
from advisor_match_common import score_against_gold
from conftest import get_nightly_collector
from server import app

pytestmark = pytest.mark.nightly


GOLD_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "eval", "advisor_gold.json"
)

with open(GOLD_PATH, encoding="utf-8") as _f:
    _GOLD_DATASET = json.load(_f)


@pytest.fixture(scope="module")
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _score(client, profile: dict, expected_top6: list[str]) -> tuple[int, list[str]]:
    """POST profile to /recommend; return (overlap, actual_top6)."""
    resp = client.post("/recommend", json=profile)
    assert resp.status_code == 200, f"Server error: {resp.get_json()}"
    data = resp.get_json()
    assert data.get("error") is None, f"Response error: {data['error']}"
    overlap, actual_top6 = score_against_gold(data, expected_top6, limit=6)
    return overlap, actual_top6


def _normalize_profile_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [piece.strip() for piece in value.split(",") if piece.strip()]
    return [str(piece).strip() for piece in value if str(piece).strip()]


def _make_test(entry: dict):
    """Generate a test function for a single gold profile."""
    profile_id = entry["id"]
    description = entry.get("description", profile_id)
    profile = entry["profile"]
    expected_top6 = entry["expected_top6"]
    notes = entry.get("notes", "")
    declared_majors = _normalize_profile_list(profile.get("declared_majors"))
    track_ids = (
        [str(profile["track_id"]).strip()]
        if profile.get("track_id")
        else _normalize_profile_list(profile.get("track_ids"))
    )
    declared_minors = _normalize_profile_list(profile.get("declared_minors"))
    completed_courses = _normalize_profile_list(profile.get("completed_courses"))

    def test_fn(client):
        collector = get_nightly_collector()
        collector.supplemental_checks += 1
        overlap, actual = _score(client, profile, expected_top6)
        if overlap >= 4:
            return

        missing = sorted(set(expected_top6) - set(actual))
        extra = sorted(set(actual) - set(expected_top6))
        collector.record_supplemental_issue(
            label=profile_id,
            issue_kind="advisor gold mismatch",
            scenario_label=profile_id,
            declared_majors=declared_majors,
            track_ids=track_ids,
            declared_minors=declared_minors,
            completed_courses=completed_courses,
            reason=(
                f"Top-6 overlap was {overlap}/6 for {description}. "
                f"The planner missed {', '.join(missing) if missing else 'none'}."
            ),
            details=[
                f"notes: {notes}" if notes else "notes: none",
                f"expected top6: {', '.join(expected_top6)}",
                f"actual top6: {', '.join(actual)}",
                f"missing: {', '.join(missing) if missing else 'none'}",
                f"extra: {', '.join(extra) if extra else 'none'}",
            ],
        )
        raise AssertionError(
            f"[{profile_id}] Advisor Match FAIL: overlap={overlap}/6\n"
            f"  Profile    : {description}\n"
            f"  Notes      : {notes}\n"
            f"  Expected   : {expected_top6}\n"
            f"  Actual top6: {actual}\n"
            f"  Missing    : {missing}\n"
            f"  Extra      : {extra}"
        )

    test_fn.__name__ = f"test_advisor_match_{profile_id}"
    test_fn.__doc__ = description
    return test_fn


# Dynamically generate one test per gold profile.
# This keeps parametrize output readable in CI.
for _entry in _GOLD_DATASET:
    _test_fn = _make_test(_entry)
    globals()[_test_fn.__name__] = _test_fn
