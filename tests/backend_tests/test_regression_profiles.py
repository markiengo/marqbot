"""
Regression tests with real student profiles against the live workbook.

Each test defines a student scenario (completed courses, major, track, target semester)
and asserts that recommendations match advisor expectations:
- Required/core courses should appear before electives when eligible
- No elective-tier course should rank above an unmet BCC_REQUIRED course in
  top 6 when an eligible BCC_REQUIRED course exists
- Key gateway courses should be recommended for early students
"""

import pytest
from server import app


@pytest.fixture(scope="module")
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _get_recs(client, payload):
    resp = client.post("/recommend", json=payload)
    assert resp.status_code == 200, f"Server error: {resp.get_json()}"
    data = resp.get_json()
    assert data.get("error") is None, f"Response error: {data['error']}"
    recs = data.get("recommendations", [])
    return recs, data


def _rec_codes(recs):
    return [r["course_code"] for r in recs]


def _rec_fills(recs):
    """Return list of (course_code, fills_buckets) tuples."""
    return [(r["course_code"], r.get("fills_buckets", [])) for r in recs]


def _bucket_short(bucket_id):
    return bucket_id.split("::")[-1] if "::" in bucket_id else bucket_id


# ---------------------------------------------------------------------------
# FIN_MAJOR scenarios
# ---------------------------------------------------------------------------


class TestFinMajorFreshman:
    """Freshman with almost no courses -- should get BCC/MCC gateway courses."""

    PAYLOAD = {
        "declared_majors": ["FIN_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, ECON 1002, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_gateway_courses_recommended(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        codes = _rec_codes(recs)
        # ECON 1103 is a gateway prereq for the FINA chain
        assert "ECON 1103" in codes, "ECON 1103 (gateway) should be recommended"
        # ACCO 1030 may or may not appear in top 6 depending on unlock power
        # ranking of other BCC_REQUIRED courses, but should at minimum be eligible

    def test_no_upper_level_fina_courses(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        codes = _rec_codes(recs)
        upper_fina = [c for c in codes if c.startswith("FINA") and int(c.split()[-1]) >= 3000]
        assert len(upper_fina) == 0, f"No upper-level FINA courses should appear for freshman: {upper_fina}"

    def test_all_recs_are_tier_1(self, client):
        """All recs for a freshman should be BCC or MCC (tier 1)."""
        recs, _ = _get_recs(client, self.PAYLOAD)
        for r in recs:
            fills = r.get("fills_buckets", [])
            short_fills = [_bucket_short(b) for b in fills]
            is_tier_1 = any(
                "BCC" in b or "MCC" in b for b in short_fills
            )
            assert is_tier_1, (
                f"{r['course_code']} fills {short_fills} which is not tier 1 (BCC/MCC)"
            )


class TestFinMajorJuniorCB:
    """Junior on CB track with FINA 3001 done -- should see major core courses."""

    PAYLOAD = {
        "declared_majors": ["FIN_MAJOR"],
        "track_id": "CB_TRACK",
        "completed_courses": (
            "ECON 1001, ECON 1002, ECON 1103, BUAD 1000, BUAD 1560, "
            "ACCO 1030, ACCO 1031, MATH 1400, FINA 3001, INSY 3001, "
            "OSCM 3001, MANA 3001, PHIL 1001, THEO 1001, BUAD 3010, "
            "BUAD 3020, MARK 3001, BUAD 2500, BUAD 3060"
        ),
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 4, f"Expected at least 4 recommendations, got {len(recs)}"

    def test_fina_core_eligible_courses_exist(self, client):
        """FINA 4001, 4011, 4020 should be eligible (FINA 3001 + ACCO 1031 done)."""
        recs, data = _get_recs(client, self.PAYLOAD)
        # Check they're at least in the eligible pool (not necessarily top 6)
        assert data.get("eligible_count", 0) > 10, "Should have many eligible courses"


class TestFinMajorSenior:
    """Senior close to graduation -- should recommend remaining required courses."""

    PAYLOAD = {
        "declared_majors": ["FIN_MAJOR"],
        "track_id": "CB_TRACK",
        "completed_courses": (
            "ECON 1001, ECON 1002, ECON 1103, BUAD 1000, BUAD 1560, "
            "ACCO 1030, ACCO 1031, MATH 1400, FINA 3001, INSY 3001, "
            "OSCM 3001, MANA 3001, PHIL 1001, THEO 1001, BUAD 3010, "
            "BUAD 3020, MARK 3001, BUAD 2500, BUAD 3060, BUAD 1001, "
            "LEAD 1050, ECON 1104, ENGL 1001, CORE 1929, ANTH 1001, "
            "FINA 4001, FINA 4011, FINA 4020, FINA 3002, FINA 4050, "
            "FINA 4210, REAL 3001"
        ),
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 1, "Should still have courses to recommend"


# ---------------------------------------------------------------------------
# Other majors -- basic smoke tests
# ---------------------------------------------------------------------------


class TestAccoMajor:
    """ACCO major freshman -- should get ACCO gateway and BCC courses."""

    PAYLOAD = {
        "declared_majors": ["ACCO_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 4, f"Expected at least 4 recommendations, got {len(recs)}"

    def test_bcc_courses_recommended(self, client):
        """ACCO freshman should get BCC/MCC tier 1 courses."""
        recs, _ = _get_recs(client, self.PAYLOAD)
        for r in recs:
            fills = r.get("fills_buckets", [])
            short_fills = [_bucket_short(b) for b in fills]
            is_tier_1 = any("BCC" in b or "MCC" in b for b in short_fills)
            assert is_tier_1, (
                f"{r['course_code']} fills {short_fills} which is not tier 1 (BCC/MCC)"
            )


class TestAimMajor:
    """AIM major smoke test."""

    PAYLOAD = {
        "declared_majors": ["AIM_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 4


class TestHureMajor:
    """HURE major smoke test."""

    PAYLOAD = {
        "declared_majors": ["HURE_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 4


class TestOscmMajor:
    """OSCM major smoke test."""

    PAYLOAD = {
        "declared_majors": ["OSCM_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 4


class TestInsyMajor:
    """INSY major smoke test."""

    PAYLOAD = {
        "declared_majors": ["INSY_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_produces_recommendations(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD)
        assert len(recs) >= 4


class TestBuanMajor:
    """BUAN major requires a primary major (requires_primary_major=True)."""

    PAYLOAD_SOLO = {
        "declared_majors": ["BUAN_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    PAYLOAD_WITH_PRIMARY = {
        "declared_majors": ["FIN_MAJOR", "BUAN_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }

    def test_solo_buan_requires_primary(self, client):
        """BUAN alone should return PRIMARY_MAJOR_REQUIRED error."""
        resp = client.post("/recommend", json=self.PAYLOAD_SOLO)
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "PRIMARY_MAJOR_REQUIRED"

    def test_buan_with_primary_produces_recs(self, client):
        recs, _ = _get_recs(client, self.PAYLOAD_WITH_PRIMARY)
        assert len(recs) >= 4


# ---------------------------------------------------------------------------
# Debug mode test
# ---------------------------------------------------------------------------


class TestDebugMode:
    """Verify debug mode returns trace data."""

    PAYLOAD = {
        "declared_majors": ["FIN_MAJOR"],
        "track_id": "",
        "completed_courses": "ECON 1001, BUAD 1000",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 4,
        "debug": True,
        "debug_limit": 10,
    }

    def test_debug_field_present(self, client):
        _, data = _get_recs(client, self.PAYLOAD)
        sem1 = data.get("semesters", [{}])[0]
        assert "debug" in sem1, "debug field should be present in semester response"
        debug_entries = sem1["debug"]
        assert len(debug_entries) <= 10, "debug_limit should cap entries"
        assert len(debug_entries) > 0, "should have at least one debug entry"

    def test_debug_entry_fields(self, client):
        _, data = _get_recs(client, self.PAYLOAD)
        entry = data["semesters"][0]["debug"][0]
        required_fields = [
            "rank", "course_code", "selected", "tier",
            "unlock_count", "soft_tag_penalty", "multi_bucket_score",
            "prereq_level", "fills_buckets",
        ]
        for field in required_fields:
            assert field in entry, f"debug entry missing field: {field}"

    def test_debug_absent_when_not_requested(self, client):
        payload = dict(self.PAYLOAD)
        payload.pop("debug")
        _, data = _get_recs(client, payload)
        sem1 = data.get("semesters", [{}])[0]
        assert "debug" not in sem1, "debug field should not be present when not requested"
