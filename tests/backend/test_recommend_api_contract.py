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


def _post_replan(client, **overrides):
    return client.post("/replan", json=_payload(**overrides))


def _catalog_course_for_level(min_level: int, max_level: int | None = None) -> str:
    rows = server._data["courses_df"]
    mask = rows["level"].astype(float) >= float(min_level)
    if max_level is not None:
        mask &= rows["level"].astype(float) <= float(max_level)
    row = rows[mask].iloc[0]
    return str(row["course_code"]).strip().upper()


def _course_level(course_code: str) -> int | None:
    rows = server._data["courses_df"]
    match = rows[rows["course_code"].astype(str).str.strip().str.upper() == course_code.upper()]
    if match.empty:
        return None
    return int(float(match.iloc[0]["level"]))


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


def test_invalid_student_stage_returns_400(client):
    response = _post(client, student_stage="postdoc")

    assert response.status_code == 400
    data = response.get_json()
    assert data["error"]["error_code"] == "INVALID_INPUT"
    assert "student_stage" in data["error"]["message"]


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


@pytest.mark.xfail(reason="Inconsistency validation not yet implemented in /recommend endpoint")
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


def test_selected_courses_override_first_semester_and_keep_projected_progress(client):
    baseline = _post(client, target_semester_count=1, max_recommendations=3)
    baseline_data = baseline.get_json()
    baseline_semester = baseline_data["semesters"][0]
    chosen_code = next(
        (
            code
            for bucket in baseline_semester["projected_progress"].values()
            for code in bucket.get("in_progress_applied", [])
        ),
        baseline_semester["recommendations"][0]["course_code"],
    )

    response = _post(
        client,
        target_semester_count=2,
        max_recommendations=3,
        selected_courses=[chosen_code],
    )

    assert response.status_code == 200
    data = response.get_json()
    first_semester = data["semesters"][0]
    assert [rec["course_code"] for rec in first_semester["recommendations"]] == [chosen_code]
    assert any(
        chosen_code in bucket.get("in_progress_applied", [])
        for bucket in first_semester["projected_progress"].values()
    )
    assert data["current_progress"] == baseline_data["current_progress"]


def test_replan_omits_canonical_current_state_fields(client):
    response = _post_replan(
        client,
        target_semester_count=2,
        max_recommendations=3,
        selected_courses=["ACCO 1030"],
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["mode"] == "recommendations"
    assert "current_completed_courses" not in data
    assert "current_in_progress_courses" not in data
    assert "current_progress" not in data
    assert "current_assumption_notes" not in data
    assert "input_completed_courses" not in data
    assert "input_in_progress_courses" not in data
    assert len(data["semesters"]) == 2


def test_replan_selected_courses_override_first_semester_without_canonical_audit(client):
    baseline = _post(client, target_semester_count=1, max_recommendations=3)
    baseline_data = baseline.get_json()
    chosen_code = next(
        (
            code
            for bucket in baseline_data["semesters"][0]["projected_progress"].values()
            for code in bucket.get("in_progress_applied", [])
        ),
        baseline_data["semesters"][0]["recommendations"][0]["course_code"],
    )

    response = _post_replan(
        client,
        target_semester_count=2,
        max_recommendations=3,
        selected_courses=[chosen_code],
    )

    assert response.status_code == 200
    data = response.get_json()
    first_semester = data["semesters"][0]
    assert [rec["course_code"] for rec in first_semester["recommendations"]] == [chosen_code]
    assert any(
        chosen_code in bucket.get("in_progress_applied", [])
        for bucket in first_semester["projected_progress"].values()
    )
    assert "current_progress" not in data


@pytest.mark.parametrize(
    ("student_stage", "min_level", "max_level"),
    [
        ("undergrad", 1000, 4999),
        ("graduate", 5000, 7999),
        ("doctoral", 8000, None),
    ],
)
def test_student_stage_hard_filters_recommendations(client, student_stage, min_level, max_level):
    response = _post(client, student_stage=student_stage)

    assert response.status_code == 200
    recommendations = response.get_json()["semesters"][0]["recommendations"]
    for rec in recommendations:
        level = _course_level(rec["course_code"])
        assert level is not None
        assert level >= min_level
        if max_level is not None:
            assert level <= max_level


def test_missing_student_stage_infers_from_history(client):
    graduate_history_code = _catalog_course_for_level(5000, 7999)
    response = _post(client, completed_courses=graduate_history_code)

    assert response.status_code == 200
    recommendations = response.get_json()["semesters"][0]["recommendations"]
    assert all((_course_level(rec["course_code"]) or 0) >= 5000 for rec in recommendations)
    assert all((_course_level(rec["course_code"]) or 0) < 8000 for rec in recommendations)


def test_explicit_undergrad_with_graduate_history_still_succeeds(client):
    graduate_history_code = _catalog_course_for_level(5000, 7999)
    response = _post(
        client,
        completed_courses=graduate_history_code,
        student_stage="undergrad",
    )

    assert response.status_code == 200
    recommendations = response.get_json()["semesters"][0]["recommendations"]
    assert all(1000 <= (_course_level(rec["course_code"]) or 0) < 5000 for rec in recommendations)


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


def test_restriction_program_ids_expand_parent_and_required_major_for_track():
    catalog_df, _, _ = server._get_program_catalog(server._data)
    if "parent_major_id" not in catalog_df.columns:
        pytest.skip("Catalog does not expose parent major metadata")

    track_rows = catalog_df[
        (catalog_df["kind"].astype(str).str.strip().str.lower() == "track")
        & (catalog_df["parent_major_id"].astype(str).str.strip() != "")
    ]
    if track_rows.empty:
        pytest.skip("No track rows with parent major metadata available")

    row = track_rows.iloc[0]
    track_id = str(row["track_id"]).strip()
    parent_major_id = str(row["parent_major_id"]).strip()
    required_major_id = str(row.get("required_major_id") or "").strip()

    restriction_ids = server._restriction_program_ids([track_id], catalog_df)

    assert restriction_ids[0] == track_id
    assert parent_major_id in restriction_ids
    if required_major_id:
        assert required_major_id in restriction_ids


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
