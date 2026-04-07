"""
Policy verification: 10 student scenarios testing CRED_01/02/04/10,
COBA_05, and COBA_06 enforcement.
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from backend import server
from backend.server import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def _recommend(client, majors, completed="", in_progress="",
               minors=None, track_id="",
               semester="Fall 2026", num_courses=6, num_semesters=1):
    payload = {
        "declared_majors": majors if isinstance(majors, list) else [majors],
        "declared_minors": minors or [],
        "track_id": track_id,
        "completed_courses": completed,
        "in_progress_courses": in_progress,
        "target_semester_primary": semester,
        "target_semester_count": num_semesters,
        "max_recommendations": num_courses,
    }
    resp = client.post("/recommend", json=payload)
    return resp.status_code, resp.get_json()


# ─── COBA_06: Max 3 business majors ───────────────────────────────

class TestCOBA06MaxThreeBusinessMajors:
    """COBA_06: CoBA students can complete a maximum of three business majors."""

    def test_01_three_majors_allowed(self, client):
        """Student 1: FIN + MARK + ACCO (3 biz majors) — should succeed."""
        code, data = _recommend(client, ["FIN_MAJOR", "MARK_MAJOR", "ACCO_MAJOR"])
        assert code == 200, f"3 business majors should be allowed, got {code}: {data}"
        assert data.get("mode") != "error"

    def test_02_four_majors_blocked(self, client):
        """Student 2: FIN + MARK + ACCO + OSCM (4 biz majors) — must be blocked."""
        code, data = _recommend(
            client, ["FIN_MAJOR", "MARK_MAJOR", "ACCO_MAJOR", "OSCM_MAJOR"]
        )
        assert code == 400, f"4 business majors should be blocked, got {code}"
        assert data["error"]["error_code"] == "TOO_MANY_BUSINESS_MAJORS"

    def test_03_two_majors_fine(self, client):
        """Student 3: BUAN + HURE (2 biz majors) — no issue."""
        code, data = _recommend(client, ["BUAN_MAJOR", "HURE_MAJOR"])
        assert code == 200
        assert data.get("mode") != "error"

    def test_03b_three_business_majors_plus_ds_allowed(self, client):
        """A non-business DS major should not count toward the 3-business-major cap."""
        code, data = _recommend(
            client,
            ["DS_MAJOR", "FIN_MAJOR", "MARK_MAJOR", "ACCO_MAJOR"],
        )
        assert code == 200, f"3 business majors plus DS should be allowed, got {code}: {data}"
        assert data.get("mode") != "error"


# ─── COBA_05: CoBA students cannot declare a business minor ───────

class TestCOBA05BusinessMinorWarning:
    """COBA_05: CoBA students cannot declare a business minor (warning)."""

    def test_04_biz_major_with_biz_minor_warns(self, client):
        """Student 4: FIN major + MARK minor — should produce a warning."""
        code, data = _recommend(
            client, ["FIN_MAJOR"], minors=["MARK_MINOR"]
        )
        assert code == 200
        warnings = data.get("program_warnings", [])
        found = any("business minor" in w.lower() for w in warnings)
        assert found, f"Expected business-minor warning, got: {warnings}"

    def test_05_biz_major_with_entp_minor_warns(self, client):
        """Student 5: ACCO major + ENTP minor — should produce a warning."""
        code, data = _recommend(
            client, ["ACCO_MAJOR"], minors=["ENTP_MINOR"]
        )
        assert code == 200
        warnings = data.get("program_warnings", [])
        found = any("business minor" in w.lower() for w in warnings)
        assert found, f"Expected business-minor warning for ENTP, got: {warnings}"

    def test_06_biz_major_no_minor_no_warning(self, client):
        """Student 6: MARK major, no minor — should not warn about business minor."""
        code, data = _recommend(client, ["MARK_MAJOR"])
        assert code == 200
        warnings = data.get("program_warnings", [])
        biz_minor_warn = [w for w in warnings if "business minor" in w.lower()]
        assert not biz_minor_warn, f"Unexpected business-minor warning: {biz_minor_warn}"

    def test_06b_ds_major_with_business_minor_does_not_warn(self, client):
        """DS is non-business, so a business minor warning should not appear."""
        code, data = _recommend(client, ["DS_MAJOR"], minors=["MARK_MINOR"])
        assert code == 200
        warnings = data.get("program_warnings", [])
        biz_minor_warn = [w for w in warnings if "business minor" in w.lower()]
        assert not biz_minor_warn, f"Unexpected business-minor warning for DS major: {biz_minor_warn}"


class TestDataScienceMajorSupport:
    def test_programs_endpoint_lists_ds_major(self, client):
        response = client.get("/programs")
        assert response.status_code == 200
        majors = response.get_json().get("majors", [])
        ds = next((major for major in majors if major.get("major_id") == "DS_MAJOR"), None)
        assert ds is not None, f"DS_MAJOR missing from /programs majors payload: {majors}"
        assert ds.get("active") is True

    def test_ds_major_recommendation_smoke(self, client):
        code, data = _recommend(client, ["DS_MAJOR"], num_courses=4)
        assert code == 200, f"Expected DS major recommendation request to succeed, got {code}: {data}"
        assert data.get("mode") != "error"
        assert data.get("selection_context", {}).get("selected_program_ids") == ["DS_MAJOR"]

    def test_ds_major_runtime_excludes_business_core(self, client):
        ds_data = server._build_single_major_data_v2(server._data, "DS_MAJOR", None)
        parent_bucket_ids = set(
            ds_data["buckets_df"]["parent_bucket_id"].fillna("").astype(str).str.strip().str.upper().tolist()
        )
        assert "BCC_CORE" not in parent_bucket_ids

    def test_insy_4052_does_not_satisfy_bcc_analytics(self, client):
        code, data = _recommend(
            client,
            ["DS_MAJOR", "INSY_MAJOR"],
            completed="BUAD 1001, BUAD 1560, INSY 3001, INSY 4052",
            semester="Fall 2027",
            num_courses=12,
        )
        assert code == 200, f"Expected DS+INSY recommendation request to succeed, got {code}: {data}"

        analytics = data["current_progress"]["BCC::BCC_ANALYTICS"]
        assert analytics["satisfied"] is False
        assert analytics["completed_applied"] == []

        swaps = data["semesters"][0].get("eligible_swaps", [])
        swap_codes = [row["course_code"] for row in swaps]
        assert "BUAN 3065" in swap_codes, f"Expected BUAN 3065 in eligible swaps, got: {swap_codes}"

    def test_business_elective_pool_excludes_courses_with_other_degree_buckets(self, client):
        code, data = _recommend(
            client,
            ["DS_MAJOR", "INSY_MAJOR"],
            completed="BUAD 1001, BUAD 1560, INSY 3001, MARK 3001, OSCM 3001, FINA 3001",
            semester="Fall 2027",
            num_courses=12,
        )
        assert code == 200, f"Expected DS+INSY recommendation request to succeed, got {code}: {data}"

        business_electives = data["current_progress"]["INSY_MAJOR::INSY-ELEC-4"]
        counted = set(business_electives["completed_applied"])
        assert counted == set(), f"Business elective pool should exclude degree-context courses, got: {counted}"

        bcc_required = set(data["current_progress"]["BCC::BCC_REQUIRED"]["completed_applied"])
        assert {"MARK 3001", "OSCM 3001", "FINA 3001"}.issubset(bcc_required)


# ─── CRED: Credit-load warnings ──────────────────────────────────

class TestCreditLoadWarnings:
    """CRED_01/02/04/10: credit load warnings in semester results."""

    def test_07_normal_load_no_overload(self, client):
        """Student 7: Fresh FIN student, 5 courses — no overload warning."""
        code, data = _recommend(client, ["FIN_MAJOR"], num_courses=5)
        assert code == 200
        for sem in data.get("semesters", []):
            for w in sem.get("semester_warnings", []):
                assert "exceeds" not in w.lower(), f"Unexpected overload: {w}"

    def test_08_below_fulltime_flagged(self, client):
        """Student 8: Request 2 courses — if credits < 12, warn below full-time."""
        code, data = _recommend(client, ["FIN_MAJOR"], num_courses=2)
        assert code == 200
        semesters = data.get("semesters", [])
        if semesters:
            sem = semesters[0]
            total_creds = sum(
                float(r.get("credits", 3)) for r in sem.get("recommendations", [])
            )
            warnings = sem.get("semester_warnings", [])
            if total_creds < 12:
                found = any("below" in w.lower() or "full-time" in w.lower()
                            for w in warnings)
                assert found, (
                    f"Expected below-full-time warning at {total_creds} credits, "
                    f"got: {warnings}"
                )

    def test_09_summer_semester_cap(self, client):
        """Student 9: Summer semester — should cap at 4 and have semester_warnings."""
        payload = {
            "declared_majors": ["FIN_MAJOR"],
            "declared_minors": [],
            "track_id": "",
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester_primary": "Summer 2026",
            "target_semester_count": 1,
            "max_recommendations": 6,
            "include_summer": True,
        }
        resp = client.post("/recommend", json=payload)
        code, data = resp.status_code, resp.get_json()
        assert code == 200
        semesters = data.get("semesters", [])
        if semesters:
            sem = semesters[0]
            recs = sem.get("recommendations", [])
            assert len(recs) <= 4, f"Summer should cap at 4, got {len(recs)}"
            assert "semester_warnings" in sem


# ─── Semester warnings field exists ───────────────────────────────

class TestSemesterWarningsField:
    """semester_warnings field is present in every semester response."""

    def test_10_field_present(self, client):
        """Student 10: OSCM major with completed courses — semester_warnings exists."""
        code, data = _recommend(
            client,
            ["OSCM_MAJOR"],
            completed="BUAD 1000, ACCO 1030, ACCO 1031, ECON 1003, ECON 1004, MATH 1451",
        )
        assert code == 200, f"Expected 200, got {code}: {data}"
        for sem in data.get("semesters", []):
            assert "semester_warnings" in sem, (
                f"semester_warnings missing from keys: {list(sem.keys())}"
            )
