import pandas as pd

from prereq_parser import parse_prereqs
from semester_recommender import run_recommendation_semester


def _mk_data(courses_rows, map_rows, buckets_rows):
    courses_df = pd.DataFrame(courses_rows)
    prereq_map = {
        row["course_code"]: parse_prereqs(row.get("prereq_hard", "none"))
        for row in courses_rows
    }
    return {
        "courses_df": courses_df,
        "equivalencies_df": pd.DataFrame(),
        "buckets_df": pd.DataFrame(buckets_rows),
        "course_bucket_map_df": pd.DataFrame(map_rows),
        "prereq_map": prereq_map,
    }


def test_soft_tags_demoted_except_concurrent_only():
    courses = [
        {
            "course_code": "ACCO 1000",
            "course_name": "No Soft Tags",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "FINA 4300",
            "course_name": "Concurrent Only",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "may_be_concurrent",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "FINA 4995",
            "course_name": "Instructor Consent",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "instructor_consent",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "INBUI 4931",
            "course_name": "Enrollment Requirement",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "enrollment_requirement",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "MIXD 4000",
            "course_name": "Mixed Soft Tags",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "may_be_concurrent;standing_requirement",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 5,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": c["course_code"]}
        for c in courses
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=5,
        reverse_map={},
        use_openai=False,
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes[0:2] == ["ACCO 1000", "FINA 4300"]
    assert set(codes[2:]) == {"FINA 4995", "INBUI 4931", "MIXD 4000"}
    assert "projected_progress" in out
    assert "projected_timeline" in out
    assert "projection_note" in out


def test_soft_demoted_courses_still_return_as_fallback():
    courses = [
        {
            "course_code": "FINA 4995",
            "course_name": "Instructor Consent",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "instructor_consent",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        }
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [{"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 4995"}]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=1,
        reverse_map={},
        use_openai=False,
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes == ["FINA 4995"]
    assert "projected_progress" in out
    assert "projected_timeline" in out
    assert "projection_note" in out
