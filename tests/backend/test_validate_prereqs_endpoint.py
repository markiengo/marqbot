"""
Contract tests for the /validate-prereqs onboarding endpoint.
"""

from __future__ import annotations

import pytest

import server


@pytest.fixture(scope="module")
def client():
    server.app.config["TESTING"] = True
    with server.app.test_client() as c:
        yield c


def _post(client, path: str, **payload):
    return client.post(path, json=payload)


@pytest.mark.parametrize("path", ["/validate-prereqs", "/api/validate-prereqs"])
def test_empty_body_returns_empty_inconsistencies(client, path):
    response = _post(client, path)

    assert response.status_code == 200
    assert response.get_json() == {"inconsistencies": []}


def test_valid_completed_and_in_progress_pair_returns_no_inconsistencies(client):
    response = _post(
        client,
        "/validate-prereqs",
        completed_courses="ACCO 1031, BUAD 1560, ECON 1103",
        in_progress_courses="FINA 3001",
    )

    assert response.status_code == 200
    assert response.get_json() == {"inconsistencies": []}


def test_direct_inconsistency_returns_offending_completed_course(client):
    response = _post(
        client,
        "/validate-prereqs",
        completed_courses="FINA 3001",
        in_progress_courses="ACCO 1031",
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["inconsistencies"] == [
        {
            "course_code": "FINA 3001",
            "prereqs_in_progress": ["ACCO 1031"],
        }
    ]


def test_transitive_inconsistency_returns_all_offending_completed_courses(client):
    response = _post(
        client,
        "/validate-prereqs",
        completed_courses="FINA 4001, FINA 4081",
        in_progress_courses="FINA 3001",
    )

    assert response.status_code == 200
    data = response.get_json()
    offending_codes = [row["course_code"] for row in data["inconsistencies"]]
    assert offending_codes == ["FINA 4001", "FINA 4081"]
    assert all(row["prereqs_in_progress"] == ["FINA 3001"] for row in data["inconsistencies"])


def test_unknown_or_malformed_course_codes_do_not_500(client):
    response = _post(
        client,
        "/validate-prereqs",
        completed_courses="garbage, FAKE 9999",
        in_progress_courses="???",
    )

    assert response.status_code == 200
    assert response.get_json() == {"inconsistencies": []}


def test_alias_route_matches_primary_route_payload(client):
    payload = {
        "completed_courses": "FINA 3001",
        "in_progress_courses": "ACCO 1031",
    }

    primary = _post(client, "/validate-prereqs", **payload)
    alias = _post(client, "/api/validate-prereqs", **payload)

    assert primary.status_code == 200
    assert alias.status_code == 200
    assert alias.get_json() == primary.get_json()


def test_response_shape_is_always_a_single_inconsistencies_field(client):
    response = _post(
        client,
        "/validate-prereqs",
        completed_courses="FINA 3001",
        in_progress_courses="ACCO 1031",
    )

    data = response.get_json()
    assert list(data.keys()) == ["inconsistencies"]
    assert isinstance(data["inconsistencies"], list)
