"""
Phase 3 track-aware architecture tests.

Covers:
  1. Allocator isolates tracks — courses allocated under the correct track only.
  2. Eligibility filters by track — eligible buckets respect track_id parameter.
  3. Role-based bucket lookup — helpers return correct bucket IDs by role.
  4. Server /recommend route — UNKNOWN_TRACK error, inactive track warning,
     case-insensitive track_id, backward compatibility when track_id omitted.
"""

import pytest
import pandas as pd

from allocator import allocate_courses
from eligibility import get_course_eligible_buckets, get_eligible_courses
from requirements import DEFAULT_TRACK_ID, get_bucket_by_role, get_buckets_by_role


# ── Shared multi-track fixtures ──────────────────────────────────────────────

@pytest.fixture
def two_track_buckets():
    """Two tracks sharing some course codes but with different bucket structures."""
    return pd.DataFrame([
        {"track_id": "TRACK_A", "bucket_id": "A_CORE",   "bucket_label": "A Core",     "priority": 1, "needed_count": 2, "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "core"},
        {"track_id": "TRACK_A", "bucket_id": "A_ELEC",   "bucket_label": "A Elective",  "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": True,  "role": "elective"},
        {"track_id": "TRACK_B", "bucket_id": "B_CORE",   "bucket_label": "B Core",     "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "core"},
        {"track_id": "TRACK_B", "bucket_id": "B_ELEC",   "bucket_label": "B Elective",  "priority": 2, "needed_count": 2, "needed_credits": None, "min_level": None, "allow_double_count": True,  "role": "elective"},
    ])


@pytest.fixture
def two_track_map():
    """Course-to-bucket mapping for two tracks. COURSE_X maps to both tracks."""
    return pd.DataFrame([
        {"track_id": "TRACK_A", "bucket_id": "A_CORE",  "course_code": "COURSE_X", "constraints": None},
        {"track_id": "TRACK_A", "bucket_id": "A_CORE",  "course_code": "COURSE_Y", "constraints": None},
        {"track_id": "TRACK_A", "bucket_id": "A_ELEC",  "course_code": "COURSE_Z", "constraints": None},
        {"track_id": "TRACK_B", "bucket_id": "B_CORE",  "course_code": "COURSE_X", "constraints": None},
        {"track_id": "TRACK_B", "bucket_id": "B_ELEC",  "course_code": "COURSE_Y", "constraints": None},
        {"track_id": "TRACK_B", "bucket_id": "B_ELEC",  "course_code": "COURSE_W", "constraints": None},
    ])


@pytest.fixture
def two_track_courses():
    return pd.DataFrame([
        {"course_code": "COURSE_X", "course_name": "Shared X",  "credits": 3, "level": 3000, "offered_fall": True,  "offered_spring": True,  "offered_summer": False, "prereq_hard": "none", "prereq_soft": "", "offering_confidence": "high", "notes": None},
        {"course_code": "COURSE_Y", "course_name": "Course Y",  "credits": 3, "level": 3000, "offered_fall": True,  "offered_spring": True,  "offered_summer": False, "prereq_hard": "none", "prereq_soft": "", "offering_confidence": "high", "notes": None},
        {"course_code": "COURSE_Z", "course_name": "A Only Z",  "credits": 3, "level": 3000, "offered_fall": True,  "offered_spring": False, "offered_summer": False, "prereq_hard": "none", "prereq_soft": "", "offering_confidence": "high", "notes": None},
        {"course_code": "COURSE_W", "course_name": "B Only W",  "credits": 3, "level": 3000, "offered_fall": True,  "offered_spring": True,  "offered_summer": False, "prereq_hard": "none", "prereq_soft": "", "offering_confidence": "high", "notes": None},
    ])


@pytest.fixture
def two_track_prereq_map():
    return {
        "COURSE_X": {"type": "none"},
        "COURSE_Y": {"type": "none"},
        "COURSE_Z": {"type": "none"},
        "COURSE_W": {"type": "none"},
    }


# ── 1. Allocator track isolation ─────────────────────────────────────────────

class TestAllocatorTrackIsolation:
    def test_track_a_allocates_to_a_buckets(self, two_track_buckets, two_track_map, two_track_courses):
        result = allocate_courses(
            ["COURSE_X"], [], two_track_buckets, two_track_map, two_track_courses,
            track_id="TRACK_A",
        )
        assert "COURSE_X" in result["applied_by_bucket"]["A_CORE"]["completed_applied"]
        assert "B_CORE" not in result["applied_by_bucket"]

    def test_track_b_allocates_to_b_buckets(self, two_track_buckets, two_track_map, two_track_courses):
        result = allocate_courses(
            ["COURSE_X"], [], two_track_buckets, two_track_map, two_track_courses,
            track_id="TRACK_B",
        )
        assert "COURSE_X" in result["applied_by_bucket"]["B_CORE"]["completed_applied"]
        assert "A_CORE" not in result["applied_by_bucket"]

    def test_same_course_different_bucket_per_track(self, two_track_buckets, two_track_map, two_track_courses):
        """COURSE_Y is A_CORE in track A but B_ELEC in track B."""
        result_a = allocate_courses(
            ["COURSE_Y"], [], two_track_buckets, two_track_map, two_track_courses,
            track_id="TRACK_A",
        )
        result_b = allocate_courses(
            ["COURSE_Y"], [], two_track_buckets, two_track_map, two_track_courses,
            track_id="TRACK_B",
        )
        assert "COURSE_Y" in result_a["applied_by_bucket"]["A_CORE"]["completed_applied"]
        assert "COURSE_Y" in result_b["applied_by_bucket"]["B_ELEC"]["completed_applied"]

    def test_unknown_track_produces_empty_allocation(self, two_track_buckets, two_track_map, two_track_courses):
        result = allocate_courses(
            ["COURSE_X"], [], two_track_buckets, two_track_map, two_track_courses,
            track_id="NONEXISTENT",
        )
        assert result["applied_by_bucket"] == {}
        assert result["remaining"] == {}

    def test_default_track_id_is_fin_major(self):
        assert DEFAULT_TRACK_ID == "FIN_MAJOR"


# ── 2. Eligibility track filtering ──────────────────────────────────────────

class TestEligibilityTrackFiltering:
    def test_eligible_buckets_for_track_a(self, two_track_buckets, two_track_map, two_track_courses):
        buckets = get_course_eligible_buckets(
            "COURSE_X", two_track_map, two_track_courses, two_track_buckets,
            track_id="TRACK_A",
        )
        bucket_ids = [b["bucket_id"] for b in buckets]
        assert "A_CORE" in bucket_ids
        assert "B_CORE" not in bucket_ids

    def test_eligible_buckets_for_track_b(self, two_track_buckets, two_track_map, two_track_courses):
        buckets = get_course_eligible_buckets(
            "COURSE_X", two_track_map, two_track_courses, two_track_buckets,
            track_id="TRACK_B",
        )
        bucket_ids = [b["bucket_id"] for b in buckets]
        assert "B_CORE" in bucket_ids
        assert "A_CORE" not in bucket_ids

    def test_course_not_in_track_returns_empty(self, two_track_buckets, two_track_map, two_track_courses):
        """COURSE_W only maps to TRACK_B — should return empty for TRACK_A."""
        buckets = get_course_eligible_buckets(
            "COURSE_W", two_track_map, two_track_courses, two_track_buckets,
            track_id="TRACK_A",
        )
        assert buckets == []

    def test_get_eligible_courses_respects_track(
        self, two_track_buckets, two_track_map, two_track_courses, two_track_prereq_map,
    ):
        remaining_a = {
            "A_CORE": {"slots_remaining": 2, "needed": 2},
            "A_ELEC": {"slots_remaining": 1, "needed": 1},
        }
        eligible = get_eligible_courses(
            two_track_courses, [], [], "Fall", two_track_prereq_map,
            remaining_a, two_track_map, two_track_buckets,
            track_id="TRACK_A",
        )
        codes = [c["course_code"] for c in eligible]
        # COURSE_W is only in TRACK_B — should not appear in TRACK_A results
        assert "COURSE_W" not in codes
        # COURSE_X and COURSE_Y should appear (both in A_CORE)
        assert "COURSE_X" in codes
        assert "COURSE_Y" in codes


# ── 3. Role-based bucket lookup ──────────────────────────────────────────────

class TestRoleLookup:
    def test_get_core_bucket_for_track_a(self, two_track_buckets):
        assert get_bucket_by_role(two_track_buckets, "TRACK_A", "core") == "A_CORE"

    def test_get_core_bucket_for_track_b(self, two_track_buckets):
        assert get_bucket_by_role(two_track_buckets, "TRACK_B", "core") == "B_CORE"

    def test_get_elective_buckets_for_track_a(self, two_track_buckets):
        assert get_buckets_by_role(two_track_buckets, "TRACK_A", "elective") == ["A_ELEC"]

    def test_get_elective_buckets_for_track_b(self, two_track_buckets):
        assert get_buckets_by_role(two_track_buckets, "TRACK_B", "elective") == ["B_ELEC"]

    def test_missing_role_returns_none(self, two_track_buckets):
        assert get_bucket_by_role(two_track_buckets, "TRACK_A", "nonexistent") is None

    def test_missing_role_returns_empty_list(self, two_track_buckets):
        assert get_buckets_by_role(two_track_buckets, "TRACK_A", "nonexistent") == []

    def test_unknown_track_returns_none(self, two_track_buckets):
        assert get_bucket_by_role(two_track_buckets, "FAKE_TRACK", "core") is None

    def test_no_role_column_returns_none(self):
        df = pd.DataFrame([
            {"track_id": "T", "bucket_id": "B", "bucket_label": "X", "priority": 1},
        ])
        assert get_bucket_by_role(df, "T", "core") is None
        assert get_buckets_by_role(df, "T", "core") == []


# ── 4. Server /recommend route — track validation ────────────────────────────

class TestServerTrackValidation:
    """Integration tests against the actual Flask app with real workbook data."""

    @pytest.fixture
    def client(self):
        from server import app
        app.config["TESTING"] = True
        with app.test_client() as c:
            yield c

    def _post(self, client, **overrides):
        payload = {
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester_primary": "Fall 2026",
        }
        payload.update(overrides)
        return client.post("/recommend", json=payload)

    def test_unknown_track_returns_400(self, client):
        resp = self._post(client, track_id="NONEXISTENT_TRACK")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "UNKNOWN_TRACK"

    def test_inactive_track_returns_warning(self, client):
        resp = self._post(client, track_id="CB_CONC")
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert "track_warning" in data
        assert "not yet published" in data["track_warning"]

    def test_default_track_no_warning(self, client):
        resp = self._post(client)
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data.get("track_warning") is None

    def test_case_insensitive_track_id(self, client):
        """'fin_major' should resolve to 'FIN_MAJOR' via uppercase normalization."""
        resp = self._post(client, track_id="fin_major")
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data.get("track_warning") is None

    def test_omitted_track_id_uses_default(self, client):
        """When track_id is absent from the request, DEFAULT_TRACK_ID is used."""
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
        })
        data = resp.get_json()
        assert data["mode"] == "recommendations"

    def test_empty_tracks_rejects_non_default_track(self, client, monkeypatch):
        """When tracks_df is empty, non-default tracks should be rejected."""
        import server

        empty_tracks = server._data["tracks_df"].iloc[0:0].copy()
        monkeypatch.setitem(server._data, "tracks_df", empty_tracks)

        resp = self._post(client, track_id="NONDEFAULT_TRACK")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "UNKNOWN_TRACK"

    def test_empty_tracks_allows_default_track(self, client, monkeypatch):
        """When tracks_df is empty, default track remains allowed for compatibility."""
        import server

        empty_tracks = server._data["tracks_df"].iloc[0:0].copy()
        monkeypatch.setitem(server._data, "tracks_df", empty_tracks)

        resp = self._post(client, track_id="FIN_MAJOR")
        data = resp.get_json()
        assert data["mode"] == "recommendations"
