"""
Contract tests for the /recommend endpoint.
"""

from __future__ import annotations

import pytest

import server


BASE_PAYLOAD = {
    "declared_majors": ["FIN_MAJOR"],
    "track_id": "",
    "declared_minors": [],
    "completed_courses": "",
    "in_progress_courses": "",
    "target_semester_primary": "Fall 2026",
    "target_semester_count": 2,
    "max_recommendations": 4,
}


@pytest.fixture(scope="module")
def client():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c


def _payload(**overrides) -> dict:
    body = dict(BASE_PAYLOAD)
    body.update(overrides)
    return body


def _post(client, **overrides):
    return client.post("/recommend", json=_payload(**overrides))


def test_invalid_json_body_returns_400_invalid_input(client):
    response = client.post(
        "/recommend",
        data="not-json",
        content_type="application/json",
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["mode"] == "error"
    assert data["error"]["error_code"] == "INVALID_INPUT"


@pytest.mark.parametrize("value", [0, 16, "abc"])
def test_invalid_max_recommendations_returns_400(client, value):
    response = _post(client, max_recommendations=value)

    assert response.status_code == 400
    data = response.get_json()
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert "max_recommendations" in data["error"]["message"]


@pytest.mark.parametrize("value", [0, 9, "abc"])
def test_invalid_target_semester_count_returns_400(client, value):
    response = _post(client, target_semester_count=value)

    assert response.status_code == 400
    data = response.get_json()
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert "target_semester_count" in data["error"]["message"]


@pytest.mark.parametrize(
    "field",
    [
        "target_semester_primary",
        "target_semester_secondary",
        "target_semester_tertiary",
        "target_semester_quaternary",
    ],
)
def test_malformed_semester_labels_return_400(client, field):
    response = _post(client, **{field: "Autumn 2026"})

    assert response.status_code == 400
    data = response.get_json()
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert field in data["error"]["message"]


def test_missing_program_selection_returns_400(client):
    response = client.post(
        "/recommend",
        json={
            "completed_courses": "",
            "in_progress_courses": "",
            "target_semester_primary": "Fall 2026",
            "max_recommendations": 3,
        },
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert "major or track" in data["error"]["message"]


def test_malformed_requested_course_returns_400(client):
    response = _post(client, requested_course="garbage")

    assert response.status_code == 400
    data = response.get_json()
    assert data["mode"] == "error"
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert data["error"]["invalid_courses"] == ["garbage"]


def test_requested_course_not_in_catalog_returns_400(client):
    response = _post(client, requested_course="FAKE 9999")

    assert response.status_code == 400
    data = response.get_json()
    assert data["mode"] == "error"
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert data["error"]["not_in_catalog"] == ["FAKE 9999"]


def test_inconsistent_completed_and_in_progress_returns_400(client):
    response = _post(
        client,
        completed_courses="FINA 3001",
        in_progress_courses="ACCO 1031",
    )

    assert response.status_code == 400
    data = response.get_json()
    assert data["mode"] == "error"
    assert data["error"]["error_code"] == "INCONSISTENT_INPUT"
    assert any(row["course_code"] == "FINA 3001" for row in data["error"]["inconsistent_courses"])


def test_valid_response_includes_expected_top_level_contract(client):
    response = _post(client, target_semester_count=3, max_recommendations=3)

    assert response.status_code == 200
    data = response.get_json()
    assert data["mode"] == "recommendations"
    assert data["error"] is None
    assert isinstance(data["input_completed_courses"], list)
    assert isinstance(data["input_in_progress_courses"], list)
    assert isinstance(data["current_completed_courses"], list)
    assert isinstance(data["current_in_progress_courses"], list)
    assert isinstance(data["current_progress"], dict)
    assert isinstance(data["current_assumption_notes"], list)
    assert isinstance(data["semesters"], list) and len(data["semesters"]) == 3

    first_semester = data["semesters"][0]
    assert data["recommendations"] == first_semester["recommendations"]
    assert data["target_semester"] == first_semester["target_semester"]
    assert data["standing"] == first_semester["standing"]
    assert data["progress"] == first_semester["progress"]


def test_selection_context_is_coherent_for_declared_program_requests(client):
    response = _post(client, declared_majors=["FIN_MAJOR"], target_semester_count=3)

    assert response.status_code == 200
    data = response.get_json()
    context = data.get("selection_context")
    assert isinstance(context, dict)
    assert context["declared_majors"] == ["FIN_MAJOR"]
    assert context["selected_program_ids"] == ["FIN_MAJOR"]
    assert len(context["selected_program_ids"]) == len(context["selected_program_labels"])
    assert all(label.strip() for label in context["selected_program_labels"])


def test_include_summer_false_filters_explicit_summer_labels(client):
    response = _post(
        client,
        target_semester_primary="Fall 2026",
        target_semester_secondary="Summer 2027",
        target_semester_count=3,
        include_summer=False,
    )

    assert response.status_code == 200
    labels = [semester["target_semester"] for semester in response.get_json()["semesters"]]
    assert labels == ["Fall 2026", "Fall 2027", "Spring 2028"]


def test_include_summer_true_preserves_explicit_summer_labels(client):
    response = _post(
        client,
        target_semester_primary="Fall 2026",
        target_semester_secondary="Summer 2027",
        target_semester_count=3,
        include_summer=True,
    )

    assert response.status_code == 200
    labels = [semester["target_semester"] for semester in response.get_json()["semesters"]]
    assert labels == ["Fall 2026", "Summer 2027", "Fall 2027"]


@pytest.mark.parametrize("semester_count", [1, 8])
def test_target_semester_count_controls_number_of_returned_semesters(client, semester_count):
    response = _post(
        client,
        target_semester_count=semester_count,
        max_recommendations=1,
    )

    assert response.status_code == 200
    data = response.get_json()
    assert len(data["semesters"]) == semester_count
