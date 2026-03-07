import pandas as pd

from prereq_parser import parse_prereqs
from semester_recommender import run_recommendation_semester


def _mk_data(courses_rows, map_rows, buckets_rows):
    courses_df = pd.DataFrame(courses_rows)
    prereq_map = {
        row["course_code"]: parse_prereqs(row.get("prereq_hard", "none"))
        for row in courses_rows
    }
    buckets_df = pd.DataFrame(buckets_rows)
    # Auto-derive parent_bucket_priority from bucket_id naming if not provided.
    if "parent_bucket_priority" not in buckets_df.columns:
        buckets_df["parent_bucket_priority"] = buckets_df["bucket_id"].apply(
            lambda bid: 1 if any(bid.startswith(p) for p in ("BCC::", "MCC::", "BCC_", "MCC_")) else 2
        )
    return {
        "courses_df": courses_df,
        "equivalencies_df": pd.DataFrame(),
        "buckets_df": buckets_df,
        "course_bucket_map_df": pd.DataFrame(map_rows),
        "prereq_map": prereq_map,
    }



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
    assert "projected_timeline" not in out
    assert "projection_note" in out


def test_same_semester_may_be_concurrent_course_can_be_recommended_after_its_prereq():
    courses = [
        {
            "course_code": "FINA 3001",
            "course_name": "Intro Finance",
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
            "course_code": "FINA 4300",
            "course_name": "Concurrent Cap",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_concurrent": "FINA 3001",
            "prereq_soft": "may_be_concurrent",
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
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 4300"},
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

    assert [row["course_code"] for row in out["recommendations"]] == ["FINA 3001", "FINA 4300"]


def test_same_semester_explicit_concurrent_course_can_be_recommended_with_companion():
    courses = [
        {
            "course_code": "CHEM 1001",
            "course_name": "Chem Lecture",
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
            "course_code": "CHEM 1002",
            "course_name": "Chem Lab",
            "credits": 1,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_concurrent": "CHEM 1001",
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
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "CHEM 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "CHEM 1002"},
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

    assert [row["course_code"] for row in out["recommendations"]] == ["CHEM 1001", "CHEM 1002"]


def test_acco_required_warning_text_boosts_bula_3001_in_acco_context():
    courses = [
        {
            "course_code": "BULA 3001",
            "course_name": "Legal and Ethical Environment of Business",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "warning_text": "Required for ACCO majors",
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "AIM 4470",
            "course_name": "AIM Ethics",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "major_restriction",
            "prereq_level": 0,
            "warning_text": "AIM major declaration required",
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "ACCO_MAJOR",
            "bucket_id": "BCC::BCC_ETHICS",
            "bucket_label": "BCC Ethics",
            "priority": 1,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [
        {"track_id": "ACCO_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "BULA 3001"},
        {"track_id": "ACCO_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "AIM 4470"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="ACCO_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes[:2] == ["BULA 3001", "AIM 4470"]
    assert out["recommendations"][0]["warning_text"] == "Required for ACCO majors"


def test_non_standing_soft_prereq_courses_are_demoted_within_tier():
    courses = [
        {
            "course_code": "FINA 3001",
            "course_name": "Plain Finance",
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
            "course_code": "FINA 4995",
            "course_name": "Instructor Consent",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "instructor_consent",
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
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 4995"},
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
        debug=True,
        debug_limit=10,
    )

    ordered = [entry["course_code"] for entry in out["debug"][:2]]
    assert ordered == ["FINA 3001", "FINA 4995"]

    plain = next(entry for entry in out["debug"] if entry["course_code"] == "FINA 3001")
    soft = next(entry for entry in out["debug"] if entry["course_code"] == "FINA 4995")
    assert plain["soft_prereq_penalty"] == 0
    assert soft["soft_prereq_penalty"] == 1


def test_standing_only_soft_prereq_is_not_double_demoted():
    courses = [
        {
            "course_code": "FINA 3001",
            "course_name": "Standing Only",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "standing_requirement",
            "prereq_level": 2,
            "offered_fall": True,
            "offered_spring": False,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "FINA 3002",
            "course_name": "Standing Plus Consent",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "standing_requirement;instructor_consent",
            "prereq_level": 2,
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
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        }
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "FINA 3002"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=["ACCO 1030"] * 8,
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=2,
        completed_only_standing=2,
        debug=True,
        debug_limit=10,
    )

    standing_only = next(entry for entry in out["debug"] if entry["course_code"] == "FINA 3001")
    standing_plus = next(entry for entry in out["debug"] if entry["course_code"] == "FINA 3002")
    assert standing_only["soft_prereq_penalty"] == 0
    assert standing_plus["soft_prereq_penalty"] == 1


def test_mcc_foundation_then_bcc_then_major_order():
    """Foundation ranks first, then BCC, then major."""
    courses = [
        {
            "course_code": "PHIL 1001",
            "course_name": "Foundation Course",
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
            "course_code": "ZZZZ 1000",
            "course_name": "BCC Required Course",
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
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
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
            "bucket_id": "FIN_MAJOR::FIN_CORE",
            "bucket_label": "Finance Core Required",
            "priority": 5,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "FIN_MAJOR",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "PHIL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "ZZZZ 1000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "ACCO 2000"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
    ])

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
    assert codes == ["PHIL 1001", "ZZZZ 1000", "ACCO 2000"]


def test_mcc_foundation_ranks_above_major():
    """MCC foundation buckets should rank above major electives."""
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
    # MCC foundation ranks before major elective.
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


def test_soft_bucket_cap_auto_relaxes_when_few_viable_buckets_remain():
    """When viable bucket diversity is low, cap auto-relaxes to fill requested count."""
    courses = [
        {
            "course_code": f"MCC {1000 + i}",
            "course_name": f"Foundation {i}",
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
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_Foundation",
            "bucket_label": "MCC Foundation",
            "priority": 1,
            "needed_count": 4,
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
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_Foundation", "course_code": f"MCC {1000 + i}"}
        for i in range(1, 6)
    ] + [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3001"},
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
    # Only two viable unmet buckets exist for five requested slots, so cap relaxes.
    mcc_codes = [c for c in codes if c.startswith("MCC")]
    assert len(mcc_codes) == 4, f"Expected relaxed cap to allow 4 MCC picks, got {len(mcc_codes)}: {mcc_codes}"
    assert "FINA 3001" in codes
    assert len(codes) == 5


def test_tier_order_foundation_then_bcc_then_major_then_track_then_late_mcc_then_discovery():
    """Tier order follows the standardized hierarchy."""
    courses = [
        {
            "course_code": "FOUND 1001",
            "course_name": "Foundation Course",
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
            "course_code": "BCC 1001",
            "course_name": "BCC Required",
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
            "course_code": "MAJOR 2001",
            "course_name": "Major Req Course",
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
            "course_code": "TRACK 3001",
            "course_name": "Track Course",
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
            "course_code": "WRIT 3001",
            "course_name": "Writing Course",
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
            "course_code": "DISC 1001",
            "course_name": "Discovery Course",
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
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "MCC_FOUNDATION",
            "track_required": "",
        },
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
            "parent_bucket_id": "BCC_CORE",
            "track_required": "",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::FIN_CORE",
            "bucket_label": "Major Bucket",
            "priority": 5,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "FIN_MAJOR",
            "track_required": "",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::COMMBANK_CORE",
            "bucket_label": "Track Bucket",
            "priority": 8,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "CB_TRACK",
            "track_required": "CB_TRACK",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_WRIT",
            "bucket_label": "MCC Writ",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "MCC_WRIT",
            "track_required": "",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CB_HUM",
            "bucket_label": "Discovery Humanities",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "MCC_DISC_CB",
            "track_required": "",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "FOUND 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "BCC 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "MAJOR 2001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::COMMBANK_CORE", "course_code": "TRACK 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "WRIT 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_HUM", "course_code": "DISC 1001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
        {"parent_bucket_id": "CB_TRACK", "type": "track"},
        {"parent_bucket_id": "MCC_WRIT", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_CB", "type": "track"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=6,
        reverse_map={},
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes == ["FOUND 1001", "BCC 1001", "MAJOR 2001", "TRACK 3001", "WRIT 3001", "DISC 1001"]


def test_bcc_required_in_any_fill_bucket_forces_bcc_tier_priority():
    """
    If a course fills BCC_REQUIRED plus a major bucket, it must rank as BCC tier
    even when its primary bucket would otherwise be non-BCC.
    """
    courses = [
        {
            "course_code": "AAA 2001",
            "course_name": "Major Only Course",
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
            "course_code": "ZZZ 2001",
            "course_name": "Major + BCC Required Course",
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
            "bucket_id": "FIN_MAJOR::FIN_CORE",
            "bucket_label": "Major Bucket",
            "priority": 1,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "FIN_MAJOR",
            "track_required": "",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "Business Core Required",
            "priority": 50,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "BCC_CORE",
            "track_required": "",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "AAA 2001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "ZZZ 2001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "ZZZ 2001"},
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
    assert codes == ["ZZZ 2001", "AAA 2001"]


def test_soft_bucket_cap_stays_enforced_when_bucket_diversity_is_sufficient():
    """Cap remains active when viable unmet buckets can satisfy requested count."""
    courses = [
        {
            "course_code": f"A {i}",
            "course_name": f"A Option {i}",
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
        }
        for i in range(1, 5)
    ] + [
        {
            "course_code": "B 1",
            "course_name": "B One",
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
            "course_code": "C 1",
            "course_name": "C One",
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
            "course_code": "D 1",
            "course_name": "D One",
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
            "bucket_id": "FIN_MAJOR::A",
            "bucket_label": "Bucket A",
            "priority": 1,
            "needed_count": 4,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::B",
            "bucket_label": "Bucket B",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::C",
            "bucket_label": "Bucket C",
            "priority": 3,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::D",
            "bucket_label": "Bucket D",
            "priority": 4,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::A", "course_code": f"A {i}"}
        for i in range(1, 5)
    ] + [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::B", "course_code": "B 1"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::C", "course_code": "C 1"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::D", "course_code": "D 1"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=4,
        reverse_map={},
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    a_codes = [c for c in codes if c.startswith("A ")]
    assert len(a_codes) <= 2
    assert len(codes) == 4


def test_selection_uses_allocator_style_non_elective_first_within_same_family():
    """
    A course that can fill both same-family required and elective-pool buckets
    should be routed to required first during selection, leaving elective
    capacity for other candidates.
    """
    courses = [
        {
            "course_code": "X100",
            "course_name": "Shared Course",
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
            "course_code": "Y200",
            "course_name": "Elective-Only Course",
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
            "bucket_id": "FIN_MAJOR::REQ_A",
            "bucket_label": "Required A",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::ELEC_A",
            "bucket_label": "Elective A",
            "priority": 2,
            "needed_count": None,
            "needed_credits": 1,
            "min_level": None,
            "allow_double_count": False,
            "role": "elective",
            "requirement_mode": "credits_pool",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::REQ_A", "course_code": "X100"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::ELEC_A", "course_code": "X100"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::ELEC_A", "course_code": "Y200"},
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
    assert codes == ["X100", "Y200"]


def test_selection_uses_required_before_choose_n_within_same_family():
    courses = [
        {
            "course_code": "X300",
            "course_name": "Shared Req and Choose",
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
            "course_code": "Y300",
            "course_name": "Choose-Only Course",
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
            "bucket_id": "FIN_MAJOR::CHOOSE_A",
            "bucket_label": "Choose A",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "elective",
            "requirement_mode": "choose_n",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::REQ_A",
            "bucket_label": "Required A",
            "priority": 99,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::CHOOSE_A", "course_code": "X300"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::REQ_A", "course_code": "X300"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::CHOOSE_A", "course_code": "Y300"},
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
    assert codes == ["X300", "Y300"]


def test_only_one_bridge_course_per_target_bucket():
    """When two bridge courses target the same single-slot bucket,
    only the first (higher-ranked) should be recommended."""
    courses = [
        {
            "course_code": "BRIDGE_A",
            "course_name": "Bridge A",
            "credits": 3,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "BRIDGE_B",
            "course_name": "Bridge B",
            "credits": 3,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "TARGET_1",
            "course_name": "Target Course",
            "credits": 3,
            "prereq_hard": "BRIDGE_A or BRIDGE_B",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::CORE",
            "bucket_label": "Core Required",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::CORE", "course_code": "TARGET_1"},
    ]
    data = _mk_data(courses, course_map, buckets)

    reverse_map = {
        "BRIDGE_A": ["TARGET_1"],
        "BRIDGE_B": ["TARGET_1"],
    }

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=5,
        reverse_map=reverse_map,
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    bridge_codes = [c for c in codes if c.startswith("BRIDGE_")]
    assert len(bridge_codes) == 1, (
        f"Expected 1 bridge course, got {len(bridge_codes)}: {bridge_codes}"
    )
def test_bcc_child_bucket_cap_remains_independent_not_parent_level():
    courses = [
        {
            "course_code": "REQ_A",
            "course_name": "Req A",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "REQ_B",
            "course_name": "Req B",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "ETH_A",
            "course_name": "Ethics A",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "ENH_A",
            "course_name": "Enhance A",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "BCC Required",
            "priority": 1,
            "needed_count": 4,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "BCC_CORE",
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_ETHICS",
            "bucket_label": "BCC Ethics",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "BCC_CORE",
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_ENHANCE",
            "bucket_label": "BCC Enhance",
            "priority": 3,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "BCC_CORE",
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ_A"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ_B"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "ETH_A"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ENHANCE", "course_code": "ENH_A"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=4,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=2,
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert set(codes) == {"REQ_A", "REQ_B", "ETH_A", "ENH_A"}


def test_bcc_required_bucket_allows_three_picks_before_other_bcc_children():
    courses = [
        {
            "course_code": "REQ_A",
            "course_name": "Req A",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "REQ_B",
            "course_name": "Req B",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "REQ_C",
            "course_name": "Req C",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "ETH_A",
            "course_name": "Ethics A",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "BCC Required",
            "priority": 1,
            "needed_count": 6,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "BCC_CORE",
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_ETHICS",
            "bucket_label": "BCC Ethics",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "BCC_CORE",
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ_A"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ_B"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ_C"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "ETH_A"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=4,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert set(codes) == {"REQ_A", "REQ_B", "REQ_C", "ETH_A"}


def test_bridge_course_does_not_take_slot_while_direct_fill_exists():
    courses = [
        {
            "course_code": "FOUND 1001",
            "course_name": "Foundation",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "REQ 1001",
            "course_name": "Required",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "REQ 1002",
            "course_name": "Required 2",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "BRDG 1001",
            "course_name": "Bridge",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
        {
            "course_code": "BLOCK 2001",
            "course_name": "Blocked Required",
            "credits": 3,
            "level": 2000,
            "prereq_hard": "BRDG 1001",
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "MCC_FOUNDATION",
            "role": "core",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "BCC Required",
            "priority": 2,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "BCC_CORE",
            "role": "core",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "FOUND 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "REQ 1002"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "BLOCK 2001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=3,
        reverse_map={"BRDG 1001": ["BLOCK 2001"]},
        track_id="FIN_MAJOR",
        debug=True,
        debug_limit=20,
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes[:3] == ["FOUND 1001", "REQ 1001", "REQ 1002"]
    assert "BRDG 1001" not in codes

    bridge = next(entry for entry in out["debug"] if entry["course_code"] == "BRDG 1001")
    assert bridge["skip_reason"] in {
        "bridge deferred while direct-fill options remain",
        "max_recs reached",
    }


def test_standing_recovery_recommends_declared_path_filler_when_only_required_course_is_blocked():
    courses = [
        {
            "course_code": "CORE_DONE",
            "course_name": "Core Done",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "CAPSTONE 4000",
            "course_name": "Senior Capstone",
            "credits": 3,
            "level": 4000,
            "prereq_hard": "none",
            "prereq_soft": "standing_requirement",
            "prereq_level": 4,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "ELEC_DONE",
            "course_name": "Completed Elective",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "ELEC_FILL",
            "course_name": "Filler Elective",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "TEST_MAJOR",
            "bucket_id": "TEST_MAJOR::REQ_CORE",
            "bucket_label": "Required Core",
            "priority": 1,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "TEST_MAJOR",
            "role": "core",
        },
        {
            "track_id": "TEST_MAJOR",
            "bucket_id": "TEST_MAJOR::ELEC_POOL",
            "bucket_label": "Elective Pool",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "parent_bucket_id": "TEST_MAJOR",
            "role": "elective",
        },
    ]
    course_map = [
        {"track_id": "TEST_MAJOR", "bucket_id": "TEST_MAJOR::REQ_CORE", "course_code": "CORE_DONE"},
        {"track_id": "TEST_MAJOR", "bucket_id": "TEST_MAJOR::REQ_CORE", "course_code": "CAPSTONE 4000"},
        {"track_id": "TEST_MAJOR", "bucket_id": "TEST_MAJOR::ELEC_POOL", "course_code": "ELEC_DONE"},
        {"track_id": "TEST_MAJOR", "bucket_id": "TEST_MAJOR::ELEC_POOL", "course_code": "ELEC_FILL"},
    ]
    data = _mk_data(courses, course_map, buckets)

    out = run_recommendation_semester(
        completed=["CORE_DONE", "ELEC_DONE"],
        in_progress=[],
        target_semester_label="Spring 2029",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="TEST_MAJOR",
        current_standing=3,
        completed_only_standing=3,
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes == ["ELEC_FILL"]
    assert out["eligible_count"] >= 1
    assert "standing needed" in out["recommendations"][0]["why"].lower()


def test_family_cap_limits_discovery_courses_per_semester():
    """
    Regression: BUAN+FIN+CB+CMI student should NOT get 3+ Discovery courses
    in one semester. The family cap (ceil(n/3)) limits MCC_DISC family courses.
    """
    # 3 Discovery courses + 2 major courses + 1 MCC Foundation = 6 eligible
    courses = [
        {
            "course_code": f"DISC {1000 + i}",
            "course_name": f"Discovery {i}",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        }
        for i in range(1, 4)
    ] + [
        {
            "course_code": "ENGL 1001",
            "course_name": "English Comp",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "FINA 3001",
            "course_name": "Finance Core 1",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "BUAN 3001",
            "course_name": "Analytics Core 1",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC_DISC_CMI::DISC_HUM",
            "bucket_label": "Discovery Humanities",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CMI",
            "double_count_family_id": "MCC_DISC",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC_DISC_CMI::DISC_SSC",
            "bucket_label": "Discovery Social Science",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CMI",
            "double_count_family_id": "MCC_DISC",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC_DISC_CMI::DISC_NSM",
            "bucket_label": "Discovery Natural Science",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CMI",
            "double_count_family_id": "MCC_DISC",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_FOUNDATION",
            "bucket_label": "MCC Foundation",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
            "double_count_family_id": "MCC_FOUNDATION",
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
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "BUAN_MAJOR::BUAN_CORE",
            "bucket_label": "Analytics Core",
            "priority": 5,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "BUAN_MAJOR",
            "double_count_family_id": "BUAN_MAJOR",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC_DISC_CMI::DISC_HUM", "course_code": "DISC 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC_DISC_CMI::DISC_SSC", "course_code": "DISC 1002"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC_DISC_CMI::DISC_NSM", "course_code": "DISC 1003"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_FOUNDATION", "course_code": "ENGL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BUAN_MAJOR::BUAN_CORE", "course_code": "BUAN 3001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    # Add parent_buckets_df so parent_type_map resolves correctly
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_DISC_CMI", "type": "track"},
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
        {"parent_bucket_id": "BUAN_MAJOR", "type": "major"},
    ])

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
    disc_codes = [c for c in codes if c.startswith("DISC")]
    # Family cap = ceil(5/3) = 2 → at most 2 Discovery courses
    assert len(disc_codes) <= 2, (
        f"Expected at most 2 Discovery courses (family cap), got {len(disc_codes)}: {disc_codes}"
    )
    # Declared-min target is 2, so both declared-path courses should appear.
    major_codes = [c for c in codes if c.startswith("FINA") or c.startswith("BUAN")]
    assert len(major_codes) == 2, (
        f"Expected 2 declared-major courses, got {len(major_codes)}: {codes}"
    )
    # Balance policy metadata should be present
    policy = out.get("balance_policy", {})
    assert policy.get("family_cap") == 2
    assert policy.get("declared_min_target") == 2
    assert policy.get("declared_min_achieved") == 2
    assert policy.get("declared_min_relaxed") is False
    assert len(codes) == 5


def test_discovery_penalties_order_foundation_and_neutral_before_far_discovery():
    courses = [
        {
            "course_code": "ENGL 1001",
            "course_name": "English Composition",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "PSYC 1001",
            "course_name": "Intro Psychology",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "CHNS 1001",
            "course_name": "Elementary Chinese I",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
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
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CB_SSC",
            "bucket_label": "Discovery SSC",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CB",
            "double_count_family_id": "MCC_DISC",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CB_HUM",
            "bucket_label": "Discovery HUM",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CB",
            "double_count_family_id": "MCC_DISC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "ENGL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_SSC", "course_code": "PSYC 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_HUM", "course_code": "CHNS 1001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_CB", "type": "track"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=3,
        reverse_map={},
        track_id="FIN_MAJOR",
        debug=True,
        debug_limit=10,
    )

    psych = next(entry for entry in out["debug"] if entry["course_code"] == "PSYC 1001")
    chns = next(entry for entry in out["debug"] if entry["course_code"] == "CHNS 1001")
    assert psych["is_discovery_driven"] is True
    assert chns["is_discovery_driven"] is True
    assert psych["discovery_foundation_penalty"] == 2
    assert chns["discovery_foundation_penalty"] == 2
    assert psych["discovery_affinity_penalty"] == 1
    assert chns["discovery_affinity_penalty"] == 2


def test_mixed_major_and_discovery_course_is_not_penalized():
    courses = [
        {
            "course_code": "ECON 1001",
            "course_name": "Discovery Economics",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "PSYC 1001",
            "course_name": "Intro Psychology",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::REQ",
            "bucket_label": "Finance Requirement",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
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
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CB_SSC",
            "bucket_label": "Discovery SSC",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CB",
            "double_count_family_id": "MCC_DISC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::REQ", "course_code": "ECON 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_SSC", "course_code": "ECON 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_SSC", "course_code": "PSYC 1001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_CB", "type": "track"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
        debug=True,
        debug_limit=10,
    )

    econ = next(entry for entry in out["debug"] if entry["course_code"] == "ECON 1001")
    psych = next(entry for entry in out["debug"] if entry["course_code"] == "PSYC 1001")
    assert econ["is_discovery_driven"] is False
    assert econ["discovery_foundation_penalty"] == 0
    assert econ["discovery_affinity_penalty"] == 0
    assert psych["is_discovery_driven"] is True
    assert psych["discovery_foundation_penalty"] == 2
    assert psych["discovery_affinity_penalty"] == 1


def test_discovery_foundation_penalty_clears_when_foundation_is_complete():
    courses = [
        {
            "course_code": "ENGL 1001",
            "course_name": "English Composition",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "SOCI 1001",
            "course_name": "Intro Sociology",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "PSYC 1001",
            "course_name": "Intro Psychology",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "CHNS 1001",
            "course_name": "Elementary Chinese I",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
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
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CB_SSC",
            "bucket_label": "Discovery SSC",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CB",
            "double_count_family_id": "MCC_DISC",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CB_HUM",
            "bucket_label": "Discovery HUM",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_CB",
            "double_count_family_id": "MCC_DISC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "ENGL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV1", "course_code": "SOCI 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_SSC", "course_code": "PSYC 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CB_HUM", "course_code": "CHNS 1001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_CB", "type": "track"},
    ])

    out = run_recommendation_semester(
        completed=["ENGL 1001", "SOCI 1001"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
        debug=True,
        debug_limit=10,
    )

    psych = next(entry for entry in out["debug"] if entry["course_code"] == "PSYC 1001")
    chns = next(entry for entry in out["debug"] if entry["course_code"] == "CHNS 1001")
    assert psych["discovery_foundation_penalty"] == 0
    assert chns["discovery_foundation_penalty"] == 0
    assert psych["discovery_affinity_penalty"] == 1
    assert chns["discovery_affinity_penalty"] == 2


def test_declared_min_relaxes_when_no_major_courses_eligible():
    """When no declared-major courses are eligible, declared_min relaxes gracefully."""
    courses = [
        {
            "course_code": f"MCC {1000 + i}",
            "course_name": f"MCC Course {i}",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        }
        for i in range(1, 5)
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": f"MCC::MCC_SLOT_{i}",
            "bucket_label": f"MCC Slot {i}",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
            "double_count_family_id": "MCC_FOUNDATION",
        }
        for i in range(1, 5)
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": f"MCC::MCC_SLOT_{i}", "course_code": f"MCC {1000 + i}"}
        for i in range(1, 5)
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=4,
        reverse_map={},
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    # Should still produce recommendations even without major courses
    assert len(codes) >= 2
    # declared_min_relaxed should be True
    policy = out.get("balance_policy", {})
    assert policy.get("declared_min_relaxed") is True
    assert policy.get("declared_min_achieved") == 0


def test_declared_min_counts_bridge_unlocker_for_declared_required_bucket():
    """A bridge course that unlocks a declared required bucket should satisfy the quota."""
    courses = [
        {
            "course_code": "BRIDGE 1001",
            "course_name": "Bridge Course",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "TARGET 2001",
            "course_name": "Declared Required Target",
            "credits": 3,
            "level": 2000,
            "prereq_hard": "BRIDGE 1001",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "MCC 1001",
            "course_name": "MCC One",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "MCC 1002",
            "course_name": "MCC Two",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
    ]
    buckets = [
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::REQ_CORE",
            "bucket_label": "Declared Required",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE_A",
            "bucket_label": "MCC Core A",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
            "double_count_family_id": "MCC_FOUNDATION_A",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE_B",
            "bucket_label": "MCC Core B",
            "priority": 3,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
            "double_count_family_id": "MCC_FOUNDATION_B",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::REQ_CORE", "course_code": "TARGET 2001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE_A", "course_code": "MCC 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE_B", "course_code": "MCC 1002"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
    ])
    reverse_map = {
        "BRIDGE 1001": ["TARGET 2001"],
    }

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=3,
        reverse_map=reverse_map,
        track_id="FIN_MAJOR",
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert "BRIDGE 1001" in codes
    policy = out.get("balance_policy", {})
    assert policy.get("declared_min_target") == 1
    assert policy.get("declared_min_achieved") == 1
    assert policy.get("declared_min_relaxed") is False
