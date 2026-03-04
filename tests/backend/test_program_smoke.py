"""
Live-data smoke coverage for every active major, track, and minor.
"""

from __future__ import annotations

from functools import lru_cache
import re

import pytest

import server
from server import app


COURSE_CODE_RE = re.compile(r"^[A-Z]{2,5} \d{4}$")
REPRESENTATIVE_MAJOR_CANDIDATES = [
    "FIN_MAJOR",
    "ACCO_MAJOR",
    "BUAN_MAJOR",
    "REAL_MAJOR",
    "MARK_MAJOR",
]
REPRESENTATIVE_TRACK_CANDIDATES = [
    "CB_TRACK",
    "REAL_REAP_TRACK",
    "AIM_FINTECH_TRACK",
]


@pytest.fixture(scope="module")
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


@lru_cache(maxsize=1)
def _active_catalog():
    catalog_df, _, _ = server._get_program_catalog(server._data)
    catalog = catalog_df.copy()
    if "applies_to_all" in catalog.columns:
        catalog = catalog[catalog["applies_to_all"] != True].copy()
    if "active" in catalog.columns:
        catalog = catalog[catalog["active"] == True].copy()
    return catalog


@lru_cache(maxsize=1)
def _program_rows() -> dict[str, dict]:
    catalog = _active_catalog()
    return {
        str(row["track_id"]).strip(): row.to_dict()
        for _, row in catalog.iterrows()
    }


@lru_cache(maxsize=1)
def _primary_major_id() -> str:
    rows = _program_rows()
    if "FIN_MAJOR" in rows and rows["FIN_MAJOR"].get("kind") == "major":
        return "FIN_MAJOR"

    for track_id, row in rows.items():
        if row.get("kind") == "major" and not bool(row.get("requires_primary_major", False)):
            return track_id
    raise AssertionError("No usable primary major found in active program catalog")


def _active_program_ids(kind: str) -> list[str]:
    catalog = _active_catalog()
    return sorted(
        str(track_id).strip()
        for track_id in catalog.loc[catalog["kind"] == kind, "track_id"].tolist()
        if str(track_id).strip()
    )


def _active_representatives(kind: str, candidates: list[str], limit: int) -> list[str]:
    active = _active_program_ids(kind)
    chosen = [program_id for program_id in candidates if program_id in active]
    if len(chosen) < limit:
        for program_id in active:
            if program_id not in chosen:
                chosen.append(program_id)
            if len(chosen) == limit:
                break
    return chosen[:limit]


def _declared_majors_for_major(major_id: str) -> list[str]:
    row = _program_rows()[major_id]
    declared = [major_id]
    if bool(row.get("requires_primary_major", False)) and _primary_major_id() not in declared:
        declared = [_primary_major_id(), major_id]
    return declared


def _declared_majors_for_track(track_id: str) -> list[str]:
    row = _program_rows()[track_id]
    parent_major = str(row.get("parent_major") or row.get("parent_major_id") or "").strip()
    if not parent_major:
        return []

    declared = [parent_major]
    parent_row = _program_rows().get(parent_major, {})
    if bool(parent_row.get("requires_primary_major", False)) and _primary_major_id() not in declared:
        declared = [_primary_major_id(), parent_major]
    return declared


def _payload(
    *,
    declared_majors: list[str],
    track_id: str = "",
    declared_minors: list[str] | None = None,
) -> dict:
    return {
        "declared_majors": declared_majors,
        "track_id": track_id,
        "declared_minors": declared_minors or [],
        "completed_courses": "",
        "in_progress_courses": "",
        "target_semester_primary": "Fall 2026",
        "target_semester_count": 1,
        "max_recommendations": 6,
    }


def _post_recommend(client, payload: dict) -> dict:
    response = client.post("/recommend", json=payload)
    data = response.get_json()
    assert response.status_code == 200, f"Unexpected status for payload {payload}: {data}"
    assert data.get("error") is None, f"Recommendation error for payload {payload}: {data['error']}"
    return data


def _assert_recommendation_shape(recommendations: list[dict]):
    assert recommendations, "Expected at least one recommendation"

    course_codes = []
    for rec in recommendations:
        for field in ("course_code", "course_name", "credits", "fills_buckets"):
            assert field in rec, f"Recommendation missing '{field}': {rec}"

        assert isinstance(rec["course_name"], str) and rec["course_name"].strip(), rec
        assert isinstance(rec["credits"], int) and rec["credits"] >= 0, rec
        assert isinstance(rec["fills_buckets"], list), rec
        assert COURSE_CODE_RE.match(rec["course_code"]), rec
        course_codes.append(rec["course_code"])

    assert len(course_codes) == len(set(course_codes)), (
        f"Duplicate course codes within semester: {course_codes}"
    )


def _assert_selection_context(data: dict, expected_program_ids: list[str]):
    context = data.get("selection_context")
    assert isinstance(context, dict), f"Missing selection_context: {data}"
    assert context["selected_program_ids"] == expected_program_ids
    labels = context.get("selected_program_labels")
    assert isinstance(labels, list) and len(labels) == len(expected_program_ids)
    assert all(isinstance(label, str) and label.strip() for label in labels), context


@pytest.mark.parametrize("major_id", _active_program_ids("major"), ids=_active_program_ids("major"))
def test_smoke_major(client, major_id):
    data = _post_recommend(
        client,
        _payload(declared_majors=_declared_majors_for_major(major_id)),
    )

    semesters = data.get("semesters", [])
    assert semesters, f"No semesters returned for major {major_id}"
    _assert_recommendation_shape(semesters[0].get("recommendations", []))
    _assert_selection_context(data, _declared_majors_for_major(major_id))


@pytest.mark.parametrize("track_id", _active_program_ids("track"), ids=_active_program_ids("track"))
def test_smoke_track(client, track_id):
    declared_majors = _declared_majors_for_track(track_id)
    data = _post_recommend(
        client,
        _payload(
            declared_majors=declared_majors,
            track_id=track_id,
        ),
    )

    semesters = data.get("semesters", [])
    assert semesters, f"No semesters returned for track {track_id}"
    _assert_recommendation_shape(semesters[0].get("recommendations", []))
    _assert_selection_context(data, declared_majors + [track_id])


@pytest.mark.parametrize("minor_id", _active_program_ids("minor"), ids=_active_program_ids("minor"))
def test_smoke_minor(client, minor_id):
    data = _post_recommend(
        client,
        _payload(
            declared_majors=[_primary_major_id()],
            declared_minors=[minor_id],
        ),
    )

    semesters = data.get("semesters", [])
    assert semesters, f"No semesters returned for minor {minor_id}"
    _assert_recommendation_shape(semesters[0].get("recommendations", []))
    _assert_selection_context(data, [_primary_major_id(), minor_id])


@pytest.mark.parametrize(
    "major_id",
    _active_representatives("major", REPRESENTATIVE_MAJOR_CANDIDATES, 4),
    ids=_active_representatives("major", REPRESENTATIVE_MAJOR_CANDIDATES, 4),
)
def test_three_semester_smoke_major(client, major_id):
    data = _post_recommend(
        client,
        {
            **_payload(declared_majors=_declared_majors_for_major(major_id)),
            "target_semester_count": 3,
        },
    )

    semesters = data.get("semesters", [])
    assert len(semesters) == 3, f"Expected 3 semesters for major {major_id}, got {len(semesters)}"
    for semester in semesters:
        _assert_recommendation_shape(semester.get("recommendations", []))
    _assert_selection_context(data, _declared_majors_for_major(major_id))


@pytest.mark.parametrize(
    "track_id",
    _active_representatives("track", REPRESENTATIVE_TRACK_CANDIDATES, 3),
    ids=_active_representatives("track", REPRESENTATIVE_TRACK_CANDIDATES, 3),
)
def test_three_semester_smoke_track(client, track_id):
    declared_majors = _declared_majors_for_track(track_id)
    data = _post_recommend(
        client,
        {
            **_payload(
                declared_majors=declared_majors,
                track_id=track_id,
            ),
            "target_semester_count": 3,
        },
    )

    semesters = data.get("semesters", [])
    assert len(semesters) == 3, f"Expected 3 semesters for track {track_id}, got {len(semesters)}"
    for semester in semesters:
        _assert_recommendation_shape(semester.get("recommendations", []))
    _assert_selection_context(data, declared_majors + [track_id])


def test_include_summer_smoke_preserves_summer_term_when_enabled(client):
    data = _post_recommend(
        client,
        {
            **_payload(
                declared_majors=[_primary_major_id()],
                track_id="",
            ),
            "target_semester_primary": "Spring 2026",
            "target_semester_count": 3,
            "include_summer": True,
        },
    )

    labels = [semester["target_semester"] for semester in data.get("semesters", [])]
    assert labels == ["Spring 2026", "Summer 2026", "Fall 2026"]
    _assert_recommendation_shape(data["semesters"][0].get("recommendations", []))
    _assert_selection_context(data, [_primary_major_id()])
