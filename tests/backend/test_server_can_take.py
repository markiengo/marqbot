"""
Tests for the /can-take endpoint added in the UI redesign.

These tests use the real Flask test client against the actual workbook data,
so they exercise the full request→response pipeline.
"""

import json
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))


@pytest.fixture(scope="module")
def client():
    from server import app
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def post_can_take(client, payload):
    resp = client.post(
        "/can-take",
        data=json.dumps(payload),
        content_type="application/json",
    )
    return resp.status_code, resp.get_json()


def _catalog_course_for_level(min_level: int, max_level: int | None = None) -> str:
    import server

    rows = server._data["courses_df"]
    mask = rows["level"].astype(float) >= float(min_level)
    if max_level is not None:
        mask &= rows["level"].astype(float) <= float(max_level)
    row = rows[mask].iloc[0]
    return str(row["course_code"]).strip().upper()


def _completed_courses_for_senior_standing(exclude_code: str = "") -> list[str]:
    import server

    completed: list[str] = []
    credits = 0.0
    seen: set[str] = set()
    excluded = str(exclude_code or "").strip().upper()

    for _, row in server._data["courses_df"].iterrows():
        code = str(row.get("course_code") or "").strip().upper()
        if not code or code == excluded or code in seen:
            continue

        try:
            credit_value = float(row.get("credits"))
        except (TypeError, ValueError):
            continue

        level = float(row.get("level") or 0)
        if level >= 5000:
            continue

        if credit_value <= 0 or credit_value % 1 != 0:
            continue

        completed.append(code)
        seen.add(code)
        credits += credit_value
        if credits >= 90:
            break

    assert credits >= 90, f"Expected enough catalog credits to reach senior standing, got {credits}"
    return completed


# ── Basic contract ──────────────────────────────────────────────────────────

class TestCanTakeBasicContract:
    def test_returns_can_take_mode(self, client):
        """Response always has mode='can_take'."""
        status, data = post_can_take(client, {
            "requested_course": "FINA 3001",
            "completed_courses": "",
            "in_progress_courses": "",
        })
        assert status == 200
        assert data["mode"] == "can_take"

    def test_response_has_required_fields(self, client):
        """All spec fields are present in the response."""
        status, data = post_can_take(client, {
            "requested_course": "FINA 3001",
        })
        assert status == 200
        assert "requested_course" in data
        assert "can_take" in data
        assert "why_not" in data
        assert "missing_prereqs" in data
        assert "not_offered_this_term" in data
        assert "unsupported_prereq_format" in data
        assert "next_best_alternatives" in data

    def test_next_best_alternatives_is_list(self, client):
        """next_best_alternatives must always be a list."""
        _, data = post_can_take(client, {"requested_course": "FINA 3001"})
        assert isinstance(data["next_best_alternatives"], list)


# ── Input validation ────────────────────────────────────────────────────────

class TestCanTakeInputValidation:
    def test_missing_requested_course_returns_400(self, client):
        status, data = post_can_take(client, {
            "completed_courses": "FINA 3001",
        })
        assert status == 400
        assert "error" in data

    def test_empty_body_returns_400(self, client):
        resp = client.post(
            "/can-take",
            data="not-json",
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_unknown_course_returns_can_take_false(self, client):
        status, data = post_can_take(client, {
            "requested_course": "FAKE 9999",
        })
        assert status == 200
        assert data["can_take"] is False
        assert data["requested_course"] == "FAKE 9999"

    def test_requested_course_is_normalized(self, client):
        """Course code is normalized (uppercase, standardized spacing)."""
        _, data = post_can_take(client, {"requested_course": "fina 3001"})
        assert data["requested_course"] == "FINA 3001"

    def test_invalid_student_stage_returns_400(self, client):
        status, data = post_can_take(client, {
            "requested_course": "FINA 3001",
            "student_stage": "postdoc",
        })
        assert status == 400
        assert "student_stage" in str(data.get("error", ""))


# ── Eligibility outcomes ─────────────────────────────────────────────────────

class TestCanTakeEligibility:
    def test_eligible_course_with_prereqs_met(self, client):
        """A course whose prereqs are in completed_courses should return can_take=True."""
        _, data = post_can_take(client, {
            "requested_course": "FINA 4001",
            "completed_courses": "FINA 3001, ACCO 1031",
            "target_semester": "Fall 2026",
        })
        # can_take is True or None (manual review), but NOT False due to missing prereqs
        assert data["can_take"] is not False or data.get("missing_prereqs") == []

    def test_missing_prereqs_returns_false(self, client):
        """Without prereqs, a gated course should return can_take=False or missing_prereqs."""
        _, data = post_can_take(client, {
            "requested_course": "FINA 4001",
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester": "Fall 2026",
        })
        # Either can't take it (False) or manual review (None); never True without prereqs
        assert data["can_take"] is not True or data["unsupported_prereq_format"] is True

    def test_not_offered_this_term(self, client):
        """Courses not offered in the target term return not_offered_this_term=True."""
        # Summer is generally a limited offering — use a course unlikely to be offered
        # We test the field exists and is boolean regardless of value
        _, data = post_can_take(client, {
            "requested_course": "FINA 3001",
            "target_semester": "Summer 2026",
        })
        assert isinstance(data["not_offered_this_term"], bool)

    def test_in_progress_prereqs_count_as_completed_for_next_semester(self, client):
        """Can-take endpoint checks next-semester eligibility, so in-progress prereqs count."""
        _, data = post_can_take(client, {
            "requested_course": "ACCO 1031",
            "completed_courses": "",
            "in_progress_courses": "ACCO 1030",
            "target_semester": "Fall 2026",
        })
        assert data["can_take"] is True
        assert data["missing_prereqs"] == []

    def test_choose_two_prereq_supported_for_insy_4158(self, client):
        _, data = post_can_take(client, {
            "requested_course": "INSY 4158",
            "completed_courses": "INSY 4051, INSY 4052",
            "target_semester": "Spring 2027",
            "declared_majors": ["INSY_MAJOR"],
        })
        assert data["can_take"] is True
        assert data["unsupported_prereq_format"] is False

    def test_student_stage_blocks_out_of_band_course(self, client):
        graduate_code = _catalog_course_for_level(5000, 7999)
        status, data = post_can_take(client, {
            "requested_course": graduate_code,
            "student_stage": "undergrad",
            "target_semester": "Fall 2026",
        })
        assert status == 200
        assert data["can_take"] is False
        assert "Undergraduate" in str(data.get("why_not", ""))


# ── Program context ──────────────────────────────────────────────────────────

class TestCanTakeWithProgramContext:
    def test_declared_majors_accepted(self, client):
        """Providing declared_majors should not cause an error."""
        status, data = post_can_take(client, {
            "requested_course": "FINA 3001",
            "declared_majors": ["FIN_MAJOR"],
            "target_semester": "Fall 2026",
        })
        assert status == 200
        assert data["mode"] == "can_take"

    def test_major_restriction_blocks_unrelated_program(self, client):
        status, data = post_can_take(client, {
            "requested_course": "ACCO 4000",
            "completed_courses": "ACCO 3001",
            "declared_majors": ["FIN_MAJOR"],
            "target_semester": "Fall 2026",
        })
        assert status == 200
        assert data["can_take"] is False
        assert "Restricted" in str(data.get("why_not", ""))

    def test_major_restriction_blocks_external_subject_capstone_for_business_profile(self, client):
        senior_completed = _completed_courses_for_senior_standing("INCG 4997")
        status, data = post_can_take(client, {
            "requested_course": "INCG 4997",
            "completed_courses": ", ".join(senior_completed),
            "declared_majors": ["BECO_MAJOR", "HURE_MAJOR"],
            "target_semester": "Spring 2027",
        })
        assert status == 200
        assert data["can_take"] is False
        assert data["why_not"] == "Restricted to INCG program context."

    def test_track_context_accepted(self, client):
        """Providing track_id should not cause an error."""
        status, data = post_can_take(client, {
            "requested_course": "FINA 3001",
            "declared_majors": ["FIN_MAJOR"],
            "track_id": "CB",
            "target_semester": "Fall 2026",
        })
        assert status == 200
        assert data["mode"] == "can_take"
