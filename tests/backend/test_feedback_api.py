import json

import pytest

import server


def _valid_payload():
    return {
        "rating": 4,
        "message": "The planner is helpful, but the warning copy still feels a little confusing.",
        "context": {
            "source": "planner",
            "route": "/planner",
            "session_snapshot": {
                "completed": ["ECON 1001"],
                "in_progress": ["ACCO 1001"],
                "declared_majors": ["FIN_MAJOR"],
                "declared_tracks": [],
                "declared_minors": [],
                "discovery_theme": "",
                "target_semester": "Fall 2026",
                "semester_count": "3",
                "max_recs": "4",
                "include_summer": False,
                "is_honors_student": False,
                "active_nav_tab": "plan",
                "onboarding_complete": True,
                "last_requested_count": 4,
            },
            "recommendation_snapshot": {
                "mode": "recommendations",
                "semesters": [
                    {
                        "target_semester": "Fall 2026",
                        "recommendations": [{"course_code": "FINA 3001"}],
                    }
                ],
            },
        },
    }


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FEEDBACK_PATH", str(tmp_path / "feedback" / "feedback.jsonl"))
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c


class TestFeedbackEndpoint:
    def test_feedback_accepts_valid_payload_and_appends_jsonl(self, client, tmp_path):
        resp = client.post("/api/feedback", json=_valid_payload())
        assert resp.status_code == 201

        payload = resp.get_json()
        assert payload["ok"] is True
        assert payload["feedback_id"].startswith("fb_")
        assert "submitted_at" in payload

        feedback_file = tmp_path / "feedback" / "feedback.jsonl"
        assert feedback_file.exists()

        lines = feedback_file.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 1
        stored = json.loads(lines[0])
        assert stored["feedback_id"] == payload["feedback_id"]
        assert stored["rating"] == 4
        assert stored["context"]["source"] == "planner"
        assert stored["context"]["recommendation_snapshot"]["mode"] == "recommendations"
        assert stored["request_meta"]["path"] in {"/feedback", "/api/feedback"}

    @pytest.mark.parametrize(
        ("mutator", "status_code", "expected_error"),
        [
            (lambda p: p.pop("rating"), 400, "rating must be an integer between 1 and 5."),
            (lambda p: p.__setitem__("rating", 0), 400, "rating must be an integer between 1 and 5."),
            (lambda p: p.__setitem__("message", "short"), 400, "message must be at least 10 characters."),
            (lambda p: p.__setitem__("message", "x" * 2001), 413, "message must be at most 2000 characters."),
            (lambda p: p.__setitem__("context", {}), 400, "context.source must be 'planner'."),
        ],
    )
    def test_feedback_rejects_invalid_payloads(self, client, mutator, status_code, expected_error):
        payload = _valid_payload()
        mutator(payload)
        resp = client.post("/api/feedback", json=payload)
        assert resp.status_code == status_code
        body = resp.get_json()
        assert body["error"]["message"] == expected_error

    def test_feedback_rejects_oversized_context(self, client):
        payload = _valid_payload()
        payload["context"]["recommendation_snapshot"] = {
            "mode": "recommendations",
            "semesters": [{"notes": "x" * 130_000}],
        }
        resp = client.post("/api/feedback", json=payload)
        assert resp.status_code == 413
        body = resp.get_json()
        assert body["error"]["message"] == "context is too large."

    def test_feedback_response_includes_security_headers(self, client):
        resp = client.post("/api/feedback", json=_valid_payload())
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("Referrer-Policy") == "same-origin"


class TestFeedbackRateLimiting:
    def test_feedback_rate_limit_enforced_outside_testing_mode(self, tmp_path, monkeypatch):
        monkeypatch.setenv("FEEDBACK_PATH", str(tmp_path / "feedback" / "feedback.jsonl"))
        server.app.config["TESTING"] = False
        try:
            with server.app.test_client() as c:
                test_ip = "10.55.44.33"
                with server._feedback_rate_limit_lock:
                    server._feedback_rate_limit_tracker[test_ip] = []

                statuses = []
                for _ in range(server._FEEDBACK_RATE_LIMIT_MAX + 1):
                    resp = c.post(
                        "/api/feedback",
                        json=_valid_payload(),
                        environ_base={"REMOTE_ADDR": test_ip},
                    )
                    statuses.append(resp.status_code)

                assert all(status == 201 for status in statuses[:server._FEEDBACK_RATE_LIMIT_MAX])
                assert statuses[-1] == 429
        finally:
            server.app.config["TESTING"] = True
