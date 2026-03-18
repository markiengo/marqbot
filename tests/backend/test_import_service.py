import io

import pytest
from flask import Flask

import import_service


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config["TESTING"] = True
    data = {
        "catalog_codes": {
            "ACCO 1030",
            "ECON 1103",
            "FINA 3001",
            "MATH 1450",
            "THEO 1001",
        }
    }
    import_service.register_import_routes(app, lambda: data)
    return app


@pytest.fixture
def client(app):
    with app.test_client() as test_client:
        yield test_client


def test_process_import_rows_buckets_rows_for_review():
    rows = [
        {
            "subject": "ACCO",
            "number": "1030",
            "title": "Financial Accounting",
            "term": "2025 Fall",
            "final_grade": "A",
            "type_col": "EN",
            "credits": "3.00",
            "confidence": 0.93,
        },
        {
            "subject": "THEO",
            "number": "1001",
            "title": "Foundations in Theology",
            "term": "2025 Fall",
            "final_grade": "TC",
            "type_col": "TE",
            "credits": "3.00",
            "confidence": 0.88,
        },
        {
            "subject": "MATH",
            "number": "1450",
            "title": "Calculus 1",
            "term": "2025 Fall",
            "final_grade": "SNC",
            "type_col": "EN",
            "credits": "0.00",
            "confidence": 0.9,
        },
        {
            "subject": "FINA",
            "number": "3001",
            "title": "Intro to Financial Management",
            "term": "2026 Sum",
            "final_grade": "IP",
            "type_col": "IP",
            "credits": "3.00",
            "confidence": 0.81,
        },
        {
            "subject": "ECON",
            "number": "1103",
            "title": "Principles of Microeconomics",
            "term": "2025 Fall",
            "final_grade": "W",
            "type_col": "EN",
            "credits": "3.00",
            "confidence": 0.84,
        },
        {
            "subject": "XXXX",
            "number": "9999",
            "title": "Mystery Course",
            "term": "2026 Sprg",
            "final_grade": "A",
            "type_col": "EN",
            "credits": "3.00",
            "confidence": 0.55,
        },
        {
            "subject": "MYST",
            "number": "1001",
            "title": "Unreadable Grade",
            "term": "2026 Sprg",
            "final_grade": "P",
            "type_col": "EN",
            "credits": "3.00",
            "confidence": 0.32,
        },
    ]

    result = import_service.process_import_rows(
        rows,
        {"ACCO 1030", "ECON 1103", "FINA 3001", "MATH 1450", "THEO 1001"},
    )

    assert [row["course_code"] for row in result["completed_matches"]] == [
        "ACCO 1030",
        "MATH 1450",
        "THEO 1001",
    ]
    assert [row["course_code"] for row in result["in_progress_matches"]] == ["FINA 3001"]
    assert result["ignored_rows"] == [
        {
            "source_text": "ECON | 1103 | Principles of Microeconomics | 2025 Fall | W",
            "term": "2025 Fall",
            "status": "ignored",
            "reason": "withdrawn",
            "confidence": 0.84,
        }
    ]
    reasons = {row["reason"] for row in result["unmatched_rows"]}
    assert reasons == {"not_in_catalog", "unrecognized_grade"}
    assert result["summary"] == {
        "completed_count": 3,
        "in_progress_count": 1,
        "unmatched_count": 2,
        "ignored_count": 1,
        "total_rows": 7,
    }


def test_process_import_rows_dedups_repeats_using_latest_valid_rules():
    rows = [
        {
            "subject": "ECON",
            "number": "1103",
            "title": "Principles of Microeconomics",
            "term": "2025 Fall",
            "final_grade": "W",
            "type_col": "EN",
            "credits": "3.00",
            "confidence": 0.8,
        },
        {
            "subject": "ECON",
            "number": "1103",
            "title": "Principles of Microeconomics",
            "term": "2026 Sprg",
            "final_grade": "A",
            "type_col": "EN",
            "credits": "3.00",
            "confidence": 0.95,
        },
        {
            "subject": "ECON",
            "number": "1103",
            "title": "Principles of Microeconomics",
            "term": "2026 Sum",
            "final_grade": "IP",
            "type_col": "IP",
            "credits": "3.00",
            "confidence": 0.7,
        },
        {
            "subject": "FINA",
            "number": "3001",
            "title": "Intro to Financial Management",
            "term": "2026 Sprg",
            "final_grade": "IP",
            "type_col": "IP",
            "credits": "3.00",
            "confidence": 0.8,
        },
        {
            "subject": "FINA",
            "number": "3001",
            "title": "Intro to Financial Management",
            "term": "2026 Sum",
            "final_grade": "IP",
            "type_col": "IP",
            "credits": "3.00",
            "confidence": 0.85,
        },
    ]

    result = import_service.process_import_rows(
        rows,
        {"ECON 1103", "FINA 3001"},
    )

    assert result["completed_matches"] == [
        {
            "course_code": "ECON 1103",
            "source_text": "ECON | 1103 | Principles of Microeconomics | 2026 Sprg | A",
            "term": "2026 Sprg",
            "status": "completed",
            "confidence": 0.95,
        }
    ]
    assert result["in_progress_matches"] == [
        {
            "course_code": "FINA 3001",
            "source_text": "FINA | 3001 | Intro to Financial Management | 2026 Sum | IP",
            "term": "2026 Sum",
            "status": "in_progress",
            "confidence": 0.85,
        }
    ]


def test_import_route_requires_openai_api_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post(
        "/api/import-course-history",
        data={"file": (io.BytesIO(b"fake-image"), "coursehistory.jpg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 503
    assert response.get_json()["error"]["error_code"] == "OPENAI_API_KEY_MISSING"


def test_import_route_returns_processed_payload(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def fake_call(_image_bytes, _mime_type):
        return [
            {
                "subject": "ACCO",
                "number": "1030",
                "title": "Financial Accounting",
                "term": "2025 Fall",
                "final_grade": "A",
                "type_col": "EN",
                "credits": "3.00",
                "confidence": 0.94,
            },
            {
                "subject": "FINA",
                "number": "3001",
                "title": "Intro to Financial Management",
                "term": "2026 Sum",
                "final_grade": "IP",
                "type_col": "IP",
                "credits": "3.00",
                "confidence": 0.82,
            },
        ]

    monkeypatch.setattr(import_service, "call_openai_course_history_import", fake_call)

    response = client.post(
        "/api/import-course-history",
        data={"file": (io.BytesIO(b"fake-image"), "coursehistory.jpg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert [row["course_code"] for row in payload["completed_matches"]] == ["ACCO 1030"]
    assert [row["course_code"] for row in payload["in_progress_matches"]] == ["FINA 3001"]
    assert payload["summary"]["total_rows"] == 2


def test_import_route_surfaces_unusable_model_output(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    def fake_call(_image_bytes, _mime_type):
        raise ValueError("Model response was not valid JSON.")

    monkeypatch.setattr(import_service, "call_openai_course_history_import", fake_call)

    response = client.post(
        "/api/import-course-history",
        data={"file": (io.BytesIO(b"fake-image"), "coursehistory.jpg")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 502
    assert response.get_json()["error"]["error_code"] == "IMPORT_PARSE_FAILED"
