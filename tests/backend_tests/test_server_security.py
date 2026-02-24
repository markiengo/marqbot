"""
Production hardening tests (v1.9).

Covers:
- GET /health returns 200 with expected JSON
- Security headers present on all responses
- Rate limiting: 11th POST to /recommend in same window returns 429
"""

import time
import pytest
import server


@pytest.fixture(scope="module")
def client():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c


class TestHealthEndpoint:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_response_body(self, client):
        resp = client.get("/health")
        data = resp.get_json()
        assert data["status"] == "ok"
        assert "version" in data


class TestSecurityHeaders:
    def test_security_headers_on_health(self, client):
        resp = client.get("/health")
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("Referrer-Policy") == "same-origin"

    def test_security_headers_on_programs(self, client):
        resp = client.get("/programs")
        assert resp.headers.get("X-Frame-Options") == "DENY"
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("Referrer-Policy") == "same-origin"


class TestRateLimiting:
    """Rate limit: 10 req/min per IP on /recommend. TESTING mode bypasses it."""

    PAYLOAD = {
        "declared_majors": ["FIN_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 1,
    }

    def test_rate_limit_enforce_in_non_testing_mode(self):
        """Create a non-testing client and verify 429 fires after _RATE_LIMIT_MAX requests."""
        # Temporarily disable TESTING so rate limiter is active
        server.app.config["TESTING"] = False
        try:
            with server.app.test_client() as c:
                # Clear rate tracker for the test IP
                test_ip = "10.99.88.77"
                with server._rate_limit_lock:
                    server._rate_limit_tracker[test_ip] = []

                statuses = []
                for _ in range(server._RATE_LIMIT_MAX + 1):
                    resp = c.post(
                        "/recommend",
                        json=self.PAYLOAD,
                        environ_base={"REMOTE_ADDR": test_ip},
                    )
                    statuses.append(resp.status_code)

                # First _RATE_LIMIT_MAX should succeed (200)
                assert all(s == 200 for s in statuses[:server._RATE_LIMIT_MAX]), (
                    f"First {server._RATE_LIMIT_MAX} requests should be 200, got {statuses}"
                )
                # 11th should be rate limited
                assert statuses[-1] == 429, (
                    f"Expected 429 on request #{server._RATE_LIMIT_MAX + 1}, got {statuses[-1]}"
                )
        finally:
            server.app.config["TESTING"] = True

    def test_rate_limit_bypassed_in_testing_mode(self, client):
        """With TESTING=True, rate limit is bypassed and all requests succeed."""
        test_ip = "10.99.00.01"
        with server._rate_limit_lock:
            server._rate_limit_tracker[test_ip] = []

        for _ in range(server._RATE_LIMIT_MAX + 2):
            resp = client.post(
                "/recommend",
                json=self.PAYLOAD,
                environ_base={"REMOTE_ADDR": test_ip},
            )
            assert resp.status_code == 200, (
                f"TESTING mode should bypass rate limit, got {resp.status_code}"
            )
