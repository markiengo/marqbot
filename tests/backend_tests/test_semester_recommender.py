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
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes == ["FINA 4995"]
    assert "projected_progress" in out
    assert "projected_timeline" in out
    assert "projection_note" in out


def test_universal_overlay_buckets_ranked_before_major_requirements():
    """All BCC:: and MCC:: buckets are tier 0; major-specific buckets are tier 1."""
    courses = [
        {
            "course_code": "ZZZZ 1000",
            "course_name": "BCC Required Course",
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
            "course_code": "ACCO 2000",
            "course_name": "Major Requirement Course",
            "credits": 3,
            "level": 2000,
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
            "course_code": "FINA 2000",
            "course_name": "BCC Child Course",
            "credits": 3,
            "level": 2000,
            "prereq_hard": "none",
            "prereq_soft": "",
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
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "Business Core Required",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_ANALYTICS",
            "bucket_label": "BCC Analytics",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::FIN_CORE",
            "bucket_label": "Finance Core Required",
            "priority": 5,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "ZZZZ 1000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "ACCO 2000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ANALYTICS", "course_code": "FINA 2000"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=3,
        reverse_map={},
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    # Both BCC buckets are tier 0 (universal overlay), FIN_CORE is tier 1.
    # Within tier 0, sorted by prereq_level (both 0) then course_code alphabetically.
    assert set(codes[:2]) == {"ZZZZ 1000", "FINA 2000"}
    assert codes[2] == "ACCO 2000"


def test_mcc_buckets_ranked_tier_0_like_bcc():
    """MCC:: namespaced buckets also get tier 0 priority."""
    courses = [
        {
            "course_code": "PHIL 1001",
            "course_name": "MCC ESSV1 Course",
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
            "course_code": "FINA 3001",
            "course_name": "Major Elective",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
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
            "bucket_id": "MCC::MCC_ESSV1",
            "bucket_label": "MCC ESSV1",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::FIN_CHOOSE_2",
            "bucket_label": "Finance Elective",
            "priority": 5,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "elective",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV1", "course_code": "PHIL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CHOOSE_2", "course_code": "FINA 3001"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    # MCC bucket (tier 0) ranks before major elective (tier 1)
    assert codes[0] == "PHIL 1001"
    assert codes[1] == "FINA 3001"


def test_single_slot_bucket_gets_at_most_one_recommendation():
    """Greedy selection skips duplicate courses for a single-slot bucket."""
    courses = [
        {
            "course_code": f"PHIL 100{i}",
            "course_name": f"ESSV1 Option {i}",
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
        }
        for i in range(1, 6)
    ] + [
        {
            "course_code": "FINA 3001",
            "course_name": "Finance Core",
            "credits": 3,
            "level": 3000,
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
            "course_code": "FINA 3002",
            "course_name": "Finance Core 2",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
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
            "bucket_id": "MCC::MCC_ESSV1",
            "bucket_label": "MCC ESSV1",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::FIN_CORE",
            "bucket_label": "Finance Core",
            "priority": 5,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV1", "course_code": f"PHIL 100{i}"}
        for i in range(1, 6)
    ] + [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3002"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=5,
        reverse_map={},
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    # Only 1 ESSV1 course despite 5 being eligible (single-slot bucket)
    essv1_codes = [c for c in codes if c.startswith("PHIL")]
    assert len(essv1_codes) == 1, f"Expected 1 ESSV1 course, got {len(essv1_codes)}: {essv1_codes}"
    # The remaining recs should include FIN_CORE courses
    fin_codes = [c for c in codes if c.startswith("FINA")]
    assert len(fin_codes) == 2
    # Total should be 3 (1 ESSV1 + 2 FIN_CORE), not 5
    assert len(codes) == 3
