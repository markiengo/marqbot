"""
Track-aware architecture tests.

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
            "declared_majors": ["FIN_MAJOR"],
        }
        payload.update(overrides)
        return client.post("/recommend", json=payload)

    def test_unknown_track_returns_400(self, client):
        resp = self._post(client, track_id="NONEXISTENT_TRACK")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "UNKNOWN_TRACK"

    def test_inactive_track_returns_warning(self, client):
        import server

        patched_programs = server._data["v2_programs_df"].copy()
        mask = (
            patched_programs["program_id"].astype(str).str.strip().str.upper() == "CB_TRACK"
        )
        patched_programs.loc[mask, "active"] = False
        with pytest.MonkeyPatch.context() as mp:
            mp.setitem(server._data, "v2_programs_df", patched_programs)
            resp = self._post(client, track_id="CB")
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert "program_warnings" in data
        assert any("not yet published" in str(w) for w in data["program_warnings"])

    def test_default_track_no_warning(self, client):
        resp = self._post(client)
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data.get("track_warning") is None

    def test_case_insensitive_track_id(self, client):
        """Case-insensitive track aliases should resolve to canonical track IDs."""
        resp = self._post(client, track_id="cb_track")
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data.get("track_warning") is None

    def test_omitted_track_id_uses_default(self, client):
        """When track_id is absent, declared-major planning still succeeds."""
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR"],
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"

    def test_missing_major_returns_400(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "INVALID_INPUT"
        assert "major" in data["error"]["message"].lower()

    def test_recommend_includes_current_progress(self, client):
        resp = self._post(
            client,
            completed_courses="BUAD 1001",
            in_progress_courses="ACCO 1030",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "current_progress" in data
        assert isinstance(data["current_progress"], dict)
        assert len(data["current_progress"]) > 0
        any_bucket = next(iter(data["current_progress"].values()))
        assert "completed_done" in any_bucket
        assert "in_progress_increment" in any_bucket
        assert "assumed_done" in any_bucket
        assert any_bucket["assumed_done"] >= any_bucket["completed_done"]

    def test_recommend_includes_current_assumption_notes(self, client):
        resp = self._post(
            client,
            completed_courses="BUAD 1001, ECON 1103, MATH 1400",
            in_progress_courses="ACCO 1031",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "current_assumption_notes" in data
        assert isinstance(data["current_assumption_notes"], list)
        assert any(
            note == "Assumed ACCO 1030 because ACCO 1031 is in progress."
            for note in data["current_assumption_notes"]
        )
        assert any(
            note.startswith("Inference scope:")
            for note in data["current_assumption_notes"]
        )

    def test_completed_chain_assumption_note_is_present(self, client):
        """Completing ACCO 1031 should infer ACCO 1030 via prereq chain."""
        resp = self._post(
            client,
            completed_courses="ACCO 1031",
            in_progress_courses="",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        matching_notes = [
            note for note in data.get("current_assumption_notes", [])
            if "because ACCO 1031 is completed." in note
        ]
        assert len(matching_notes) == 1
        assert matching_notes[0].startswith("Assumed ")
        assert "ACCO 1030" in matching_notes[0]

    def test_in_progress_prereq_is_not_recommended(self, client):
        resp = self._post(
            client,
            completed_courses="BUAD 1001, ECON 1103, MATH 1400",
            in_progress_courses="ACCO 1031, ECON 1104",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        rec_codes = [r.get("course_code") for r in data.get("recommendations", [])]
        assert "ACCO 1030" not in rec_codes

    def test_inferred_in_progress_prereqs_count_as_completed_in_current_progress(self, client):
        resp = self._post(
            client,
            completed_courses="",
            in_progress_courses="ACCO 1031",
        )
        assert resp.status_code == 200
        data = resp.get_json()
        totals = data.get("current_progress", {}).values()
        total_completed_done = sum(v.get("completed_done", 0) for v in totals)
        assert total_completed_done > 0
        assert any(
            note == "Assumed ACCO 1030 because ACCO 1031 is in progress."
            for note in data.get("current_assumption_notes", [])
        )

    def test_semester_projection_fields_present(self, client):
        resp = self._post(client, completed_courses="BUAD 1001")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "semesters" in data
        sem1 = data["semesters"][0]
        assert "progress" in sem1
        assert "timeline" not in sem1
        assert "projected_progress" in sem1
        assert "projected_timeline" not in sem1
        assert "projection_note" in sem1

    def test_existing_progress_fields_remain_compatible(self, client):
        resp = self._post(client, completed_courses="BUAD 1001")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "progress" in data
        assert "timeline" not in data
        assert "semesters" in data and len(data["semesters"]) > 0
        sem1 = data["semesters"][0]
        assert "progress" in sem1
        assert "timeline" not in sem1

    def test_projection_done_count_is_non_decreasing(self, client):
        resp = self._post(client, completed_courses="BUAD 1001, ECON 1103, MATH 1400")
        assert resp.status_code == 200
        data = resp.get_json()
        sem1 = data["semesters"][0]
        baseline_done = sum(v.get("done_count", 0) for v in sem1["progress"].values())
        projected_done = sum(v.get("done_count", 0) for v in sem1["projected_progress"].values())
        assert projected_done >= baseline_done

    def test_optional_third_semester_is_generated(self, client):
        resp = self._post(
            client,
            completed_courses="BUAD 1001, ECON 1103, MATH 1400",
            target_semester_primary="Fall 2026",
            target_semester_secondary="Spring 2027",
            target_semester_tertiary="Fall 2027",
            max_recommendations=5,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert len(data.get("semesters", [])) == 3
        assert all(len(sem.get("recommendations", [])) <= 5 for sem in data["semesters"])

    def test_semester_count_supports_four_terms_and_six_recs(self, client):
        resp = self._post(
            client,
            completed_courses="BUAD 1001, ECON 1103, MATH 1400",
            target_semester_primary="Fall 2026",
            target_semester_count=4,
            max_recommendations=6,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert len(data.get("semesters", [])) == 4
        assert all(len(sem.get("recommendations", [])) <= 6 for sem in data["semesters"])

    def test_fin_major_business_elective_pool_keeps_credit_target_and_sem3_capacity(self, client):
        """
        Regression: FINA-ELEC-4 must retain credit target semantics (12 credits)
        and should not collapse to 0/0.
        """
        resp = self._post(
            client,
            completed_courses="FINA 3001, PHIL 1001, ENGL 1001, MATH 1450, BUAD 1560, INGS 1001",
            in_progress_courses="MARK 3001, INSY 3001, BUAD 2001, LEAD 2000",
            target_semester_primary="Fall 2026",
            target_semester_count=3,
            max_recommendations=6,
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert len(data.get("semesters", [])) == 3

        for sem in data["semesters"]:
            progress = sem.get("progress", {})
            bucket = progress.get("FIN_MAJOR::FINA-ELEC-4")
            assert bucket is not None
            assert bucket.get("needed") == 12
            assert bucket.get("slots_remaining", -1) >= 0

        sem1_bucket = data["semesters"][0]["progress"]["FIN_MAJOR::FINA-ELEC-4"]
        assert len(sem1_bucket.get("remaining_courses", [])) > 0

    def test_declared_majors_must_be_array(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": "FIN_MAJOR",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "INVALID_INPUT"

    def test_unknown_major_returns_400(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["UNKNOWN_MAJOR"],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "UNKNOWN_MAJOR"

    def test_secondary_major_requires_primary_major(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["BUAN_MAJOR"],
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "PRIMARY_MAJOR_REQUIRED"

    def test_secondary_major_with_primary_major_passes(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR", "BUAN_MAJOR"],
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data["selection_context"]["declared_majors"] == ["FIN_MAJOR", "BUAN_MAJOR"]

    def test_declared_major_without_track_returns_context(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR"],
            "track_id": None,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data["selection_context"]["declared_majors"] == ["FIN_MAJOR"]
        assert data["selection_context"]["selected_track_id"] is None
        assert "FIN_MAJOR::FINA-REQ-CORE" in data["progress"]

    def test_declared_track_must_match_major(self, client, monkeypatch):
        import server

        patched_programs = server._data["v2_programs_df"].copy()
        mask = (
            patched_programs["program_id"].astype(str).str.strip().str.upper() == "CB_TRACK"
        )
        patched_programs.loc[mask, "parent_major_id"] = "OTHER_MAJOR"
        monkeypatch.setitem(server._data, "v2_programs_df", patched_programs)

        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR"],
            "track_id": "CB",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "TRACK_MAJOR_MISMATCH"

    def test_aim_cfa_track_requires_finance_major(self, client):
        """AIM CFA track requires FIN_MAJOR specifically, not just any primary major."""
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["ACCO_MAJOR", "AIM_MAJOR"],
            "track_id": "AIM_CFA_TRACK",
        })
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "PRIMARY_MAJOR_REQUIRED"
        assert "Finance" in data["error"]["message"]

    def test_declared_major_plus_track_returns_merged_progress(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR"],
            "track_id": "CB",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data["selection_context"]["selected_track_id"] == "CB_TRACK"
        assert "FIN_MAJOR::FINA-REQ-CORE" in data["progress"]
        assert "FIN_MAJOR::COMMBANK-REQ-CORE" in data["progress"]

    def test_double_major_shares_bcc_once(self, client):
        resp = client.post("/recommend", json={
            "completed_courses": "BUAD 1001, ECON 1103, MATH 1400",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR", "ACCO_MAJOR"],
            "track_id": None,
        })
        assert resp.status_code == 200
        data = resp.get_json()
        progress_keys = set(data.get("progress", {}).keys())

        # Shared BCC buckets should appear once (no duplicated per-major prefixes).
        assert "BCC::BCC_REQUIRED" in progress_keys
        assert "BCC::BCC_ETHICS" in progress_keys
        assert "BCC::BCC_ENHANCE" in progress_keys
        assert "BCC::BCC_ANALYTICS" in progress_keys
        assert "FIN_MAJOR::BCC_REQUIRED" not in progress_keys
        assert "ACCO_MAJOR::BCC_REQUIRED" not in progress_keys

        # Major-specific requirement buckets still remain separated.
        assert "FIN_MAJOR::FINA-REQ-CORE" in progress_keys
        assert "ACCO_MAJOR::ACCO-REQ-CORE" in progress_keys

    def test_programs_endpoint_returns_expected_shape(self, client):
        resp = client.get("/programs")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "majors" in data
        assert "tracks" in data
        assert data["default_track_id"] == "FIN_MAJOR"
        assert isinstance(data["majors"], list)
        assert isinstance(data["tracks"], list)

    def test_programs_endpoint_includes_finance_catalog(self, client):
        resp = client.get("/programs")
        data = resp.get_json()

        majors = {m["major_id"]: m for m in data["majors"]}
        tracks = {t["track_id"]: t for t in data["tracks"]}

        assert "FIN_MAJOR" in majors
        assert "CB_TRACK" in tracks
        assert "FP_TRACK" in tracks
        assert tracks["CB_TRACK"]["parent_major_id"] == "FIN_MAJOR"
        assert tracks["FP_TRACK"]["parent_major_id"] == "FIN_MAJOR"

    def test_programs_endpoint_major_labels_use_csv_labels(self, client):
        resp = client.get("/programs")
        assert resp.status_code == 200
        data = resp.get_json()
        majors = {m["major_id"]: m["label"] for m in data["majors"]}

        assert majors["ACCO_MAJOR"] == "Accounting"
        assert majors["BUAN_MAJOR"] == "Business Analytics"
        assert majors["FIN_MAJOR"] == "Finance"
        assert majors["INSY_MAJOR"] == "Information Systems"
        assert majors["OSCM_MAJOR"] == "Operations & Supply Chain Management"

    def test_courses_endpoint_levels_are_json_safe(self, client):
        resp = client.get("/api/courses")
        assert resp.status_code == 200
        raw = resp.get_data(as_text=True)
        assert "NaN" not in raw

        data = resp.get_json()
        for row in data.get("courses", []):
            course_level = row.get("level")
            level = row.get("prereq_level")
            assert course_level is None or isinstance(course_level, int)
            assert level is None or isinstance(level, int)

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
        """When tracks_df is empty, declared-major request still remains valid."""
        import server

        empty_tracks = server._data["tracks_df"].iloc[0:0].copy()
        monkeypatch.setitem(server._data, "tracks_df", empty_tracks)

        resp = self._post(client)
        data = resp.get_json()
        assert data["mode"] == "recommendations"

    def test_track_conc_alias_resolves_to_canonical(self, client):
        """'CB_CONC' should resolve to canonical 'CB_TRACK' via _track_alias_map."""
        resp = self._post(client, track_id="CB_CONC")
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert data.get("track_warning") is None or "not yet published" not in str(
            data.get("track_warning", "")
        )

    def test_track_track_alias_resolves_to_canonical(self, client):
        """'CB_TRACK' should resolve to canonical 'CB_TRACK' via _track_alias_map."""
        resp = self._post(client, track_id="CB_TRACK")
        data = resp.get_json()
        assert data["mode"] == "recommendations"

    def test_unknown_alias_returns_400(self, client):
        """An unrecognized alias that does not map to any track should return 400."""
        resp = self._post(client, track_id="NONEXISTENT_CONC")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["error"]["error_code"] == "UNKNOWN_TRACK"

    def test_track_specific_bucket_coexists_with_major_bucket(self, client):
        """When a track is selected, both the base major's buckets and track-specific
        buckets appear in progress (v2 parent/child model)."""
        resp = client.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "declared_majors": ["FIN_MAJOR", "AIM_MAJOR"],
            "track_id": "AIM_FINTECH_TRACK",
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        progress_keys = set(data.get("progress", {}).keys())
        # The track-specific sub-bucket should be present.
        assert "AIM_MAJOR::AIM-FINTECH-ELEC-UPPER-15" in progress_keys
        # The base major's elective bucket also remains (separate parent).
        assert "AIM_MAJOR::AIM-ELEC-UPPER-15" in progress_keys
        # Core requirements from both base major and track appear.
        assert "AIM_MAJOR::AIM-REQ-CORE" in progress_keys
        assert "AIM_MAJOR::AIM-FINTECH-REQ-CORE" in progress_keys


# ── 5. End-to-end smoke test — synthetic track through /recommend ────────────

class TestSyntheticTrackSmoke:
    """Proves data-only onboarding criteria: a new track added in workbook data
    produces valid recommendations through /recommend with zero code changes.

    The test monkeypatches server._data to inject a synthetic track alongside
    existing workbook data, then calls the real /recommend endpoint.
    """

    @pytest.fixture
    def client_with_synthetic_track(self, monkeypatch):
        import server

        # Inject synthetic track into tracks_df
        synth_track = pd.DataFrame([
            {"track_id": "SYNTH_TEST", "track_label": "Synthetic Test Track", "active": True},
        ])
        patched_tracks = pd.concat(
            [server._data["tracks_df"], synth_track], ignore_index=True,
        )
        monkeypatch.setitem(server._data, "tracks_df", patched_tracks)

        # Inject synthetic buckets (1 core, 1 elective)
        synth_buckets = pd.DataFrame([
            {"track_id": "SYNTH_TEST", "bucket_id": "ST_CORE", "bucket_label": "Synth Core",
             "priority": 1, "needed_count": 2, "needed_credits": None,
             "min_level": None, "allow_double_count": False, "role": "core",
             "parent_bucket_priority": 2},
            {"track_id": "SYNTH_TEST", "bucket_id": "ST_ELEC", "bucket_label": "Synth Elective",
             "priority": 2, "needed_count": 1, "needed_credits": None,
             "min_level": None, "allow_double_count": True, "role": "elective",
             "parent_bucket_priority": 2},
        ])
        patched_buckets = pd.concat(
            [server._data["buckets_df"], synth_buckets], ignore_index=True,
        )
        monkeypatch.setitem(server._data, "buckets_df", patched_buckets)

        # Map real courses (already in courses_df + prereq_map) to synthetic buckets.
        # Include ACCO 1030 (no prereqs) so recommendations exist at zero-completed state.
        synth_mappings = pd.DataFrame([
            {"track_id": "SYNTH_TEST", "course_code": "ACCO 1030", "bucket_id": "ST_CORE"},
            {"track_id": "SYNTH_TEST", "course_code": "FINA 3001", "bucket_id": "ST_CORE"},
            {"track_id": "SYNTH_TEST", "course_code": "FINA 4001", "bucket_id": "ST_ELEC"},
            {"track_id": "SYNTH_TEST", "course_code": "FINA 4011", "bucket_id": "ST_ELEC"},
            {"track_id": "SYNTH_TEST", "course_code": "FINA 4020", "bucket_id": "ST_ELEC"},
        ])
        patched_map = pd.concat(
            [server._data["course_bucket_map_df"], synth_mappings], ignore_index=True,
        )
        monkeypatch.setitem(server._data, "course_bucket_map_df", patched_map)

        server.app.config["TESTING"] = True
        with server.app.test_client() as c:
            yield c

    def test_synthetic_track_returns_recommendations(self, client_with_synthetic_track):
        """A data-only track produces a valid recommendation response."""
        resp = client_with_synthetic_track.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester_primary": "Fall 2026",
            "track_id": "SYNTH_TEST",
        })
        data = resp.get_json()
        assert resp.status_code == 200
        assert data["mode"] == "recommendations"
        assert len(data["recommendations"]) > 0

    def test_synthetic_track_respects_completed(self, client_with_synthetic_track):
        """Completing a core course reduces remaining slots for the synthetic track."""
        resp = client_with_synthetic_track.post("/recommend", json={
            "completed_courses": "FINA 3001",
            "in_progress_courses": "",
            "target_semester_primary": "Fall 2026",
            "track_id": "SYNTH_TEST",
        })
        data = resp.get_json()
        assert resp.status_code == 200
        progress = data["progress"]
        assert "ST_CORE" in progress
        assert "FINA 3001" in progress["ST_CORE"]["completed_applied"]

    def test_synthetic_track_has_progress_for_both_buckets(self, client_with_synthetic_track):
        """Both synthetic buckets appear in progress output."""
        resp = client_with_synthetic_track.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester_primary": "Fall 2026",
            "track_id": "SYNTH_TEST",
        })
        data = resp.get_json()
        assert "ST_CORE" in data["progress"]
        assert "ST_ELEC" in data["progress"]

    def test_synthetic_track_does_not_pollute_default(self, client_with_synthetic_track):
        """Default FIN_MAJOR still works normally after synthetic injection."""
        resp = client_with_synthetic_track.post("/recommend", json={
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester_primary": "Fall 2026",
            "declared_majors": ["FIN_MAJOR"],
        })
        data = resp.get_json()
        assert data["mode"] == "recommendations"
        assert "ST_CORE" not in data["progress"]
        assert "FIN_MAJOR::FINA-REQ-CORE" in data["progress"]
