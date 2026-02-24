"""
Feedback endpoint tests (v1.9).

Covers:
- POST /feedback with valid payload → 200 {"ok": true}
- POST /feedback with invalid rating → 400
- POST /feedback with unknown course_code → 400
- Two sequential POSTs produce two lines in the feedback file
"""

import json
import os
import tempfile
import pytest
import server


@pytest.fixture(scope="module")
def client():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c


@pytest.fixture()
def tmp_feedback_file(tmp_path, monkeypatch):
    """Override FEEDBACK_PATH to a temp file for each test."""
    path = str(tmp_path / "test_feedback.jsonl")
    monkeypatch.setattr(server, "FEEDBACK_PATH", path)
    return path


def _valid_payload():
    """Return a minimal valid feedback payload using a real catalog course."""
    # ECON 1103 is the first ECON course in the catalog (ECON 1001/1002 are not in catalog)
    return {
        "course_code": "ECON 1103",
        "rating": 1,
        "session_id": "abc12345",
        "semester": "Fall 2026",
        "rank": 1,
        "fills_buckets": ["FIN_MAJOR::BCC_REQUIRED"],
        "tier": 1,
        "major": "FIN_MAJOR",
        "track": "",
    }


class TestFeedbackValid:
    def test_post_feedback_valid(self, client, tmp_feedback_file):
        resp = client.post("/feedback", json=_valid_payload())
        assert resp.status_code == 200
        data = resp.get_json()
        assert data.get("ok") is True

    def test_feedback_file_created(self, client, tmp_feedback_file):
        client.post("/feedback", json=_valid_payload())
        assert os.path.exists(tmp_feedback_file)

    def test_feedback_record_fields(self, client, tmp_feedback_file):
        client.post("/feedback", json=_valid_payload())
        with open(tmp_feedback_file, encoding="utf-8") as f:
            record = json.loads(f.readline())
        assert record["course_code"] == "ECON 1103"
        assert record["rating"] == 1
        assert "event_id" in record
        assert "timestamp" in record


class TestFeedbackInvalidRating:
    def test_invalid_rating_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["rating"] = 2  # invalid
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data.get("field") == "rating"

    def test_zero_rating_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["rating"] = 0
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400

    def test_string_rating_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["rating"] = "thumbs_up"
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400


class TestFeedbackInvalidNumericFields:
    def test_invalid_rank_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["rank"] = "first"
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data.get("field") == "rank"

    def test_invalid_tier_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["tier"] = "top"
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data.get("field") == "tier"


class TestFeedbackUnknownCourse:
    def test_unknown_course_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["course_code"] = "FAKE 9999"
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data.get("field") == "course_code"

    def test_empty_course_code_returns_400(self, client, tmp_feedback_file):
        payload = _valid_payload()
        payload["course_code"] = ""
        resp = client.post("/feedback", json=payload)
        assert resp.status_code == 400


class TestFeedbackFileAppend:
    def test_two_posts_produce_two_lines(self, client, tmp_feedback_file):
        client.post("/feedback", json=_valid_payload())
        client.post("/feedback", json={**_valid_payload(), "rating": -1})
        with open(tmp_feedback_file, encoding="utf-8") as f:
            lines = [l for l in f.readlines() if l.strip()]
        assert len(lines) == 2, f"Expected 2 lines in feedback file, got {len(lines)}"
        rec0 = json.loads(lines[0])
        rec1 = json.loads(lines[1])
        assert rec0["rating"] == 1
        assert rec1["rating"] == -1
        # event_ids should be distinct
        assert rec0["event_id"] != rec1["event_id"]
