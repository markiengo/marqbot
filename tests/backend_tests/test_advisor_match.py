"""
Offline Advisor Match tests (v1.9).

Calls the Flask test client (no live server needed) to score each gold profile.
Pass criteria per profile: overlap(actual_top6, expected_top6) >= 4.

These tests use pytest.mark.xfail when a profile is known to not yet meet the
threshold, allowing CI to track progress without blocking.
"""

import json
import os
import pytest
from server import app


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
    recs = data.get("recommendations", [])
    actual_top6 = [r["course_code"] for r in recs[:6]]
    overlap = len(set(actual_top6) & set(expected_top6))
    return overlap, actual_top6


def _make_test(entry: dict):
    """Generate a test function for a single gold profile."""
    profile_id = entry["id"]
    description = entry.get("description", profile_id)
    profile = entry["profile"]
    expected_top6 = entry["expected_top6"]
    notes = entry.get("notes", "")

    def test_fn(client):
        overlap, actual = _score(client, profile, expected_top6)
        assert overlap >= 4, (
            f"[{profile_id}] Advisor Match FAIL: overlap={overlap}/6\n"
            f"  Profile    : {description}\n"
            f"  Notes      : {notes}\n"
            f"  Expected   : {expected_top6}\n"
            f"  Actual top6: {actual}\n"
            f"  Missing    : {sorted(set(expected_top6) - set(actual))}\n"
            f"  Extra      : {sorted(set(actual) - set(expected_top6))}"
        )

    test_fn.__name__ = f"test_advisor_match_{profile_id}"
    test_fn.__doc__ = description
    return test_fn


# Dynamically generate one test per gold profile.
# This keeps parametrize output readable in CI.
for _entry in _GOLD_DATASET:
    _test_fn = _make_test(_entry)
    globals()[_test_fn.__name__] = _test_fn
