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
            "course_name": "Instructor Consent Course",
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
    # No-soft-tag and concurrent-only courses should still rank first.
    assert codes[0] == "ACCO 1000"
    assert codes[1] == "FINA 4300"
    assert len(codes) >= 2
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


def test_acco_required_warning_text_boosts_bula_3001_in_acco_context():
    courses = [
        {
            "course_code": "BULA 3001",
            "course_name": "Legal and Ethical Environment of Business",
            "credits": 3,
            "level": 3000,
            "prereq_hard": "none",
            "prereq_soft": "standing_requirement",
            "prereq_level": 3,
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
            "prereq_level": 1,
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


def test_bcc_required_and_mcc_rank_above_major_and_demoted_bcc_children():
    """Tier 1 includes MCC + BCC_REQUIRED, while BCC_ANALYTICS is demoted."""
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
    # BCC_REQUIRED (tier 1) first, major bucket (tier 2) second,
    # demoted BCC_ANALYTICS (tier 4) last.
    assert codes == ["ZZZZ 1000", "ACCO 2000", "FINA 2000"]


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


def test_tier_order_bcc_required_then_major_then_track_then_demoted_bcc():
    """Tier order: BCC_REQUIRED > major > track > demoted BCC children."""
    courses = [
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
            "course_code": "BCC 4001",
            "course_name": "BCC Demoted Child",
            "credits": 3,
            "level": 4000,
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
            "bucket_id": "BCC::BCC_ANALYTICS",
            "bucket_label": "BCC Analytics",
            "priority": 2,
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
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "BCC 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "MAJOR 2001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::COMMBANK_CORE", "course_code": "TRACK 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ANALYTICS", "course_code": "BCC 4001"},
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
    assert codes == ["BCC 1001", "MAJOR 2001", "TRACK 3001", "BCC 4001"]


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
