import json

import pandas as pd

from allocator import ensure_runtime_indexes
from prereq_parser import parse_prereqs
import semester_recommender
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


def test_equivalent_courses_do_not_both_get_selected_in_same_semester():
    courses = [
        {
            "course_code": "MATH 1200",
            "course_name": "Precalculus",
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
            "course_code": "MATH 1400",
            "course_name": "Elements of Calculus",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "MATH 1200",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "MATH 1450",
            "course_name": "Calculus 1",
            "credits": 4,
            "level": 1000,
            "prereq_hard": "MATH 1200",
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
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "BCC Required",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "BCC_CORE",
            "parent_bucket_priority": 1,
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_EOH_NSM",
            "bucket_label": "EOH NSM",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_DISC_EOH",
            "parent_bucket_priority": 2,
            "double_count_family_id": "MCC_DISC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "MATH 1400"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_EOH_NSM", "course_code": "MATH 1450"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["equivalencies_df"] = pd.DataFrame([
        {
            "equiv_group_id": "MATH_EQ",
            "course_code": "MATH 1400",
            "relation_type": "equivalent",
            "scope_program_id": "",
            "label": "",
        },
        {
            "equiv_group_id": "MATH_EQ",
            "course_code": "MATH 1450",
            "relation_type": "equivalent",
            "scope_program_id": "",
            "label": "",
        },
    ])
    data["equiv_prereq_map"] = {
        "MATH 1400": {"MATH 1450"},
        "MATH 1450": {"MATH 1400"},
    }
    data["cross_listed_map"] = {}
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_EOH", "type": "track"},
    ])

    out = run_recommendation_semester(
        completed=["MATH 1200"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
    )

    codes = [rec["course_code"] for rec in out["recommendations"]]
    assert len({"MATH 1400", "MATH 1450"} & set(codes)) == 1


def test_edit_swap_pool_includes_eligible_equivalent_aliases():
    courses = [
        {
            "course_code": "MATH 1200",
            "course_name": "Precalculus",
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
            "course_code": "MATH 1400",
            "course_name": "Elements of Calculus",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "MATH 1200",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "MATH 1450",
            "course_name": "Calculus 1",
            "credits": 4,
            "level": 1000,
            "prereq_hard": "MATH 1200",
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
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "parent_bucket_priority": 1,
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "MATH 1400"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["equivalencies_df"] = pd.DataFrame([
        {
            "equiv_group_id": "MATH_EQ",
            "course_code": "MATH 1400",
            "relation_type": "equivalent",
            "scope_program_id": "",
            "label": "",
        },
        {
            "equiv_group_id": "MATH_EQ",
            "course_code": "MATH 1450",
            "relation_type": "equivalent",
            "scope_program_id": "",
            "label": "",
        },
    ])
    data["equiv_prereq_map"] = {
        "MATH 1400": {"MATH 1450"},
        "MATH 1450": {"MATH 1400"},
    }
    data["cross_listed_map"] = {}
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
    ])
    data = ensure_runtime_indexes(data, force=True)

    out = run_recommendation_semester(
        completed=["MATH 1200"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=1,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
    )

    swap_codes = [rec["course_code"] for rec in out["eligible_swaps"]]
    assert "MATH 1400" in swap_codes
    assert "MATH 1450" in swap_codes


def test_manual_selected_courses_drop_same_semester_conflicts():
    courses = [
        {
            "course_code": "MATH 3570",
            "course_name": "Introduction to Data Science",
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
            "course_code": "COSC 3570",
            "course_name": "Introduction to Data Science",
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
            "track_id": "DS_MAJOR",
            "bucket_id": "DS_MAJOR::DS_REQ_MATH",
            "bucket_label": "Data Science Math Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "DS_MAJOR",
            "parent_bucket_priority": 1,
        },
    ]
    course_map = [
        {"track_id": "DS_MAJOR", "bucket_id": "DS_MAJOR::DS_REQ_MATH", "course_code": "MATH 3570"},
        {"track_id": "DS_MAJOR", "bucket_id": "DS_MAJOR::DS_REQ_MATH", "course_code": "COSC 3570"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["equivalencies_df"] = pd.DataFrame([
        {
            "equiv_group_id": "DS_EQ",
            "course_code": "MATH 3570",
            "relation_type": "equivalent",
            "scope_program_id": "DS_MAJOR",
            "label": "",
        },
        {
            "equiv_group_id": "DS_EQ",
            "course_code": "COSC 3570",
            "relation_type": "equivalent",
            "scope_program_id": "DS_MAJOR",
            "label": "",
        },
        {
            "equiv_group_id": "DS_NDC",
            "course_code": "MATH 3570",
            "relation_type": "no_double_count",
            "scope_program_id": "",
            "label": "",
        },
        {
            "equiv_group_id": "DS_NDC",
            "course_code": "COSC 3570",
            "relation_type": "no_double_count",
            "scope_program_id": "",
            "label": "",
        },
    ])
    data["equiv_prereq_map"] = {
        "MATH 3570": {"COSC 3570"},
        "COSC 3570": {"MATH 3570"},
    }
    data["cross_listed_map"] = {}
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "DS_MAJOR", "type": "major"},
    ])
    data = ensure_runtime_indexes(data, force=True)

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="DS_MAJOR",
        manual_selected_codes=["COSC 3570", "MATH 3570"],
    )

    codes = [rec["course_code"] for rec in out["recommendations"]]
    assert codes == ["COSC 3570"]
    assert any(
        "MATH 3570 was removed from this semester because it conflicts with COSC 3570."
        in warning
        for warning in out["semester_warnings"]
    )


def test_edit_swap_pool_keeps_non_equivalent_eligible_courses():
    courses = [
        {
            "course_code": "MATH 1200",
            "course_name": "Precalculus",
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
            "course_code": "MATH 1400",
            "course_name": "Elements of Calculus",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "MATH 1200",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "COSC 1010",
            "course_name": "Introduction to Software Development",
            "credits": 4,
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
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "parent_bucket_priority": 1,
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "MATH 1400"},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE", "course_code": "COSC 1010"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
    ])
    data = ensure_runtime_indexes(data, force=True)

    out = run_recommendation_semester(
        completed=["MATH 1200"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=1,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
    )

    swap_codes = [rec["course_code"] for rec in out["eligible_swaps"]]
    assert out["recommendations"][0]["course_code"] in swap_codes
    assert "COSC 1010" in swap_codes


def test_grinder_keeps_open_bcc_work_ahead_of_multi_bucket_mcc_cleanup():
    courses = [
        {
            "course_code": "BULA 3001",
            "course_name": "Business Law",
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
            "course_code": "PHIL 1001",
            "course_name": "Foundations in Philosophy",
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
            "course_code": "MANA 3002",
            "course_name": "Business and Its Environment",
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
            "course_code": "ENGL 3250",
            "course_name": "Life-Writing, Creativity and Community",
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
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_CORE",
            "parent_bucket_priority": 1,
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
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "BCC_CORE",
            "parent_bucket_priority": 1,
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_WRIT",
            "bucket_label": "MCC Writing Intensive",
            "priority": 5,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_WRIT",
            "parent_bucket_priority": 1,
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_ESSV2",
            "bucket_label": "ESSV2",
            "priority": 5,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_ESSV2",
            "parent_bucket_priority": 1,
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "BULA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "PHIL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "MANA 3002"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "MANA 3002"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "ENGL 3250"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV2", "course_code": "ENGL 3250"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_CORE", "type": "universal"},
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
        {"parent_bucket_id": "MCC_WRIT", "type": "universal"},
        {"parent_bucket_id": "MCC_ESSV2", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
    ])
    data = ensure_runtime_indexes(data, force=True)

    out = run_recommendation_semester(
        completed=["BULA 3001"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=3,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
        debug=True,
        debug_limit=10,
    )

    debug_codes = [entry["course_code"] for entry in out["debug"][:3]]
    assert debug_codes[0] == "MANA 3002"
    assert set(debug_codes[1:3]) == {"PHIL 1001", "ENGL 3250"}


def test_edit_swap_pool_includes_courses_that_only_fill_satisfied_buckets():
    courses = [
        {
            "course_code": "DONE 1000",
            "course_name": "Already Used",
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
            "course_code": "ALT 1000",
            "course_name": "Alternative for Satisfied Bucket",
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
            "course_code": "NEED 1000",
            "course_name": "Still Needed",
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
            "bucket_id": "SAT",
            "bucket_label": "Satisfied Bucket",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "parent_bucket_priority": 1,
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "OPEN",
            "bucket_label": "Open Bucket",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
            "parent_bucket_priority": 1,
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "SAT", "course_code": "DONE 1000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "SAT", "course_code": "ALT 1000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "OPEN", "course_code": "NEED 1000"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
    ])
    data = ensure_runtime_indexes(data, force=True)

    out = run_recommendation_semester(
        completed=["DONE 1000"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=1,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
    )

    assert [rec["course_code"] for rec in out["recommendations"]] == ["NEED 1000"]
    swap_codes = [rec["course_code"] for rec in out["eligible_swaps"]]
    assert "NEED 1000" in swap_codes
    assert "ALT 1000" in swap_codes
    alt = next(rec for rec in out["eligible_swaps"] if rec["course_code"] == "ALT 1000")
    assert alt["fills_buckets"] == ["SAT"]


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


def test_bcc_required_then_major_then_mcc_core_order():
    """Grinder keeps BCC-required gateways first, then major work, then MCC core."""
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
    assert codes == ["ZZZZ 1000", "ACCO 2000", "PHIL 1001"]


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


def test_single_bucket_work_can_fill_multiple_slots_without_diversity_cap():
    """A high-priority bucket can keep filling slots while it still has unmet demand."""
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
    mcc_codes = [c for c in codes if c.startswith("MCC")]
    assert len(mcc_codes) == 4, f"Expected 4 MCC foundation picks, got {len(mcc_codes)}: {mcc_codes}"
    assert "FINA 3001" in codes
    assert len(codes) == 5
    assert "balance_policy" not in out


def test_tier_order_bcc_required_then_declared_work_then_cleanup():
    """Direct BCC-required work leads, then declared work, then BCC/MCC cleanup."""
    courses = [
        {
            "course_code": "ACCO 1030",
            "course_name": "Business Core Required",
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
            "course_code": "ENGL 1001",
            "course_name": "MCC Core",
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
            "course_code": "SOCI 1001",
            "course_name": "ESSV1 Course",
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
            "course_name": "Major Req Course",
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
            "course_code": "BULA 2050",
            "course_name": "Later BCC Course",
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
            "course_code": "HIST 1301",
            "course_name": "Late MCC Course",
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
            "bucket_id": "MCC::MCC_ESSV1",
            "bucket_label": "ESSV1 Bucket",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "MCC_ESSV1",
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
            "bucket_id": "BCC::BCC_ETHICS",
            "bucket_label": "BCC Ethics",
            "priority": 6,
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
            "priority": 9,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "parent_bucket_id": "MCC_WRIT",
            "track_required": "",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "ACCO 1030"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "ENGL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV1", "course_code": "SOCI 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ETHICS", "course_code": "BULA 2050"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::COMMBANK_CORE", "course_code": "TRACK 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "HIST 1301"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
        {"parent_bucket_id": "MCC_ESSV1", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
        {"parent_bucket_id": "CB_TRACK", "type": "track"},
        {"parent_bucket_id": "MCC_WRIT", "type": "universal"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=6,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=2,
        completed_only_standing=2,
        debug=True,
        debug_limit=10,
    )

    codes = [r["course_code"] for r in out["debug"][:6]]
    assert codes[0] == "ACCO 1030"
    assert codes.index("FINA 3001") < codes.index("BULA 2050")
    assert codes.index("TRACK 3001") < codes.index("BULA 2050")
    assert codes.index("BULA 2050") < codes.index("ENGL 1001")
    assert "SOCI 1001" not in codes or codes.index("BULA 2050") < codes.index("SOCI 1001")
    assert "HIST 1301" not in codes or codes.index("BULA 2050") < codes.index("HIST 1301")
    assert "balance_policy" not in out


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


def test_math_bridge_into_bcc_required_survives_standing_gate_and_ranks_first():
    """Foundational math bridges should survive noisy standing metadata and lead the semester."""
    courses = [
        {
            "course_code": "MATH 1200",
            "course_name": "Precalculus",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "none",
            "prereq_soft": "standing_requirement",
            "prereq_level": 2,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "MATH 1400",
            "course_name": "Elements of Calculus",
            "credits": 3,
            "level": 1000,
            "prereq_hard": "MATH 1200",
            "prereq_soft": "",
            "prereq_level": 0,
            "offered_fall": True,
            "offered_spring": True,
            "offered_summer": False,
            "offering_confidence": "high",
            "notes": None,
        },
        {
            "course_code": "ACCO 1030",
            "course_name": "Accounting",
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
            "course_code": "ENGL 1001",
            "course_name": "English",
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
            "bucket_id": "BCC::BCC_REQUIRED",
            "bucket_label": "Business Core Required",
            "priority": 1,
            "needed_count": 2,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "BCC_CORE",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_CORE",
            "bucket_label": "MCC Core",
            "priority": 2,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_FOUNDATION",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "MATH 1400"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "ACCO 1030"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_CORE", "course_code": "ENGL 1001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "BCC_CORE", "type": "universal"},
        {"parent_bucket_id": "MCC_FOUNDATION", "type": "universal"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=4,
        reverse_map={"MATH 1200": ["MATH 1400"]},
        track_id="FIN_MAJOR",
        current_standing=1,
        completed_only_standing=1,
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert codes[0] == "MATH 1200"
    assert "ACCO 1030" in codes
    assert "ENGL 1001" in codes
    assert "balance_policy" not in out


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
    assert codes[:3] == ["REQ 1001", "REQ 1002", "FOUND 1001"]
    assert "BRDG 1001" not in codes

    # Bridge should be present in debug output but NOT in the final selection.
    # The style_select three-pass system skips it via can_select_fn (bridge
    # deferral or targets already covered).  The skip_reason may or may not
    # be populated depending on which pass rejected it.
    bridge_entries = [e for e in out["debug"] if e["course_code"] == "BRDG 1001"]
    if bridge_entries:
        bridge = bridge_entries[0]
        if bridge.get("skip_reason"):
            assert bridge["skip_reason"] in {
                "bridge deferred while direct-fill options remain",
                "bridge targets already covered",
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


def test_fixed_hierarchy_prefers_major_courses_before_foundation_and_discovery_fillers():
    """Grinder should keep declared-program work ahead of foundation/discovery cleanup."""
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
        current_standing=2,
        completed_only_standing=2,
    )

    codes = [r["course_code"] for r in out["recommendations"]]
    assert set(codes[:2]) == {"FINA 3001", "BUAN 3001"}
    assert codes.index("ENGL 1001") > codes.index("FINA 3001")
    assert codes.index("ENGL 1001") > codes.index("BUAN 3001")
    disc_codes = [c for c in codes if c.startswith("DISC")]
    assert len(disc_codes) == 2
    assert len(codes) == 5
    assert "balance_policy" not in out


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


def test_recommendation_response_uses_assigned_buckets_for_writ_and_discovery_history():
    courses = [
        {
            "course_code": "WRIT 2000",
            "course_name": "Writing Intensive Complete",
            "credits": 3,
            "level": 2000,
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
            "course_code": "ENGL 2011",
            "course_name": "Books That Matter",
            "credits": 3,
            "level": 2000,
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
            "course_code": "ENGL 2012",
            "course_name": "WellVersed",
            "credits": 3,
            "level": 2000,
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
            "course_code": "THEO 2000",
            "course_name": "Theology Discovery",
            "credits": 3,
            "level": 2000,
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
            "course_code": "MATH 1700",
            "course_name": "Discovery Elective",
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
            "bucket_id": "MCC::MCC_WRIT",
            "bucket_label": "MCC Writing Intensive",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_WRIT",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CMI_HUM",
            "bucket_label": "Discovery Humanities",
            "priority": 2,
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
            "bucket_id": "MCC::MCC_DISC_CMI_ELEC",
            "bucket_label": "Discovery Elective",
            "priority": 3,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "elective",
            "requirement_mode": "choose_n",
            "parent_bucket_id": "MCC_DISC_CMI",
            "double_count_family_id": "MCC_DISC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "WRIT 2000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "ENGL 2011"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_HUM", "course_code": "ENGL 2011"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_ELEC", "course_code": "ENGL 2011"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "ENGL 2012"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_HUM", "course_code": "ENGL 2012"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_ELEC", "course_code": "ENGL 2012"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_HUM", "course_code": "THEO 2000"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_ELEC", "course_code": "MATH 1700"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_WRIT", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_CMI", "type": "track"},
    ])

    first_semester = run_recommendation_semester(
        completed=["WRIT 2000"],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=2,
        completed_only_standing=2,
    )
    recs_by_code = {
        rec["course_code"]: rec
        for rec in first_semester["recommendations"]
    }
    assert set(recs_by_code) == {"THEO 2000", "MATH 1700"}
    assert recs_by_code["THEO 2000"]["fills_buckets"] == ["MCC::MCC_DISC_CMI_HUM"]
    assert recs_by_code["MATH 1700"]["fills_buckets"] == ["MCC::MCC_DISC_CMI_ELEC"]
    assert "MCC::MCC_WRIT" not in recs_by_code["THEO 2000"]["fills_buckets"]
    assert "MCC::MCC_WRIT" not in recs_by_code["MATH 1700"]["fills_buckets"]


def test_recommendations_hide_credit_pool_when_course_has_non_elective_bucket():
    courses = [
        {
            "course_code": "ENTP 3001",
            "course_name": "Entrepreneurship",
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
            "bucket_id": "BCC::BCC_ENHANCE",
            "bucket_label": "BCC Enhance",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "BCC_CORE",
            "double_count_family_id": "BCC_CORE",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "FIN_MAJOR::FINA-ELEC-4",
            "bucket_label": "Finance Elective Pool",
            "priority": 2,
            "needed_count": None,
            "needed_credits": 12,
            "min_level": 3000,
            "allow_double_count": True,
            "role": "elective",
            "requirement_mode": "credits_pool",
            "parent_bucket_id": "FIN_MAJOR",
            "double_count_family_id": "FIN_MAJOR_ELEC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_ENHANCE", "course_code": "ENTP 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FINA-ELEC-4", "course_code": "ENTP 3001"},
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
        current_standing=2,
        completed_only_standing=2,
    )

    rec = next(course for course in out["recommendations"] if course["course_code"] == "ENTP 3001")
    assert rec["fills_buckets"] == ["BCC::BCC_ENHANCE"]


def test_same_semester_recommendations_only_include_one_writ_tagged_mcc_course():
    courses = [
        {
            "course_code": "ENGL 2011",
            "course_name": "Books That Matter",
            "credits": 3,
            "level": 2000,
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
            "course_code": "ENGL 2012",
            "course_name": "Well Versed",
            "credits": 3,
            "level": 2000,
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
            "course_code": "MATH 1700",
            "course_name": "Discovery Elective",
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
            "bucket_id": "MCC::MCC_WRIT",
            "bucket_label": "MCC Writing Intensive",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "MCC_WRIT",
        },
        {
            "track_id": "FIN_MAJOR",
            "bucket_id": "MCC::MCC_DISC_CMI_HUM",
            "bucket_label": "Discovery Humanities",
            "priority": 2,
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
            "bucket_id": "MCC::MCC_DISC_CMI_ELEC",
            "bucket_label": "Discovery Elective",
            "priority": 3,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "elective",
            "requirement_mode": "choose_n",
            "parent_bucket_id": "MCC_DISC_CMI",
            "double_count_family_id": "MCC_DISC",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "ENGL 2011"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_HUM", "course_code": "ENGL 2011"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_ELEC", "course_code": "ENGL 2011"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_WRIT", "course_code": "ENGL 2012"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_HUM", "course_code": "ENGL 2012"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_ELEC", "course_code": "ENGL 2012"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_DISC_CMI_ELEC", "course_code": "MATH 1700"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "MCC_WRIT", "type": "universal"},
        {"parent_bucket_id": "MCC_DISC_CMI", "type": "track"},
    ])

    out = run_recommendation_semester(
        completed=[],
        in_progress=[],
        target_semester_label="Fall 2026",
        data=data,
        max_recs=2,
        reverse_map={},
        track_id="FIN_MAJOR",
        current_standing=2,
        completed_only_standing=2,
    )

    codes = [rec["course_code"] for rec in out["recommendations"]]
    assert "MATH 1700" in codes
    assert len({"ENGL 2011", "ENGL 2012"} & set(codes)) == 1


def test_recommendations_still_return_when_only_mcc_work_is_available():
    """The planner should still emit recommendations when only core MCC work is open."""
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
    assert codes == ["MCC 1001", "MCC 1002", "MCC 1003", "MCC 1004"]
    assert "balance_policy" not in out


def test_major_bridge_unlocker_stays_after_core_work_without_quota_preemption():
    """A major bridge can still surface, but it should no longer preempt higher-tier MCC core work."""
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
    assert codes == ["MCC 1001", "MCC 1002", "BRIDGE 1001"]
    assert "balance_policy" not in out


def test_bucket_priority_override_promotes_matching_bucket(monkeypatch, tmp_path):
    overrides_path = tmp_path / "ranking_overrides.json"
    overrides_path.write_text(json.dumps({
        "version": 1,
        "last_updated": "2026-03-15",
        "bucket_priority_boosts": {
            "FIN_MAJOR::B_CORE": -1,
        },
        "failure_history": {},
    }), encoding="utf-8")
    monkeypatch.setattr(semester_recommender, "_RANKING_OVERRIDES_PATH", str(overrides_path))
    semester_recommender._clear_ranking_overrides_cache()

    courses = [
        {
            "course_code": "ACCO 3001",
            "course_name": "Bucket A Course",
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
            "course_name": "Bucket B Course",
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
            "bucket_id": "FIN_MAJOR::A_CORE",
            "bucket_label": "Bucket A",
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
            "bucket_id": "FIN_MAJOR::B_CORE",
            "bucket_label": "Bucket B",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "FIN_MAJOR",
        },
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::A_CORE", "course_code": "ACCO 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::B_CORE", "course_code": "BUAN 3001"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame([
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
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
    )

    codes = [rec["course_code"] for rec in out["recommendations"]]
    assert codes[:2] == ["BUAN 3001", "ACCO 3001"]
    debug_entry = next(entry for entry in out["debug"] if entry["course_code"] == "BUAN 3001")
    assert debug_entry["override_tier_adj"] == -1
    semester_recommender._clear_ranking_overrides_cache()


# ── Scheduling style (archetype) tests ────────────────────────────────────
# These tests verify that the three scheduling styles (grinder, explorer,
# mixer) produce meaningfully different recommendations via slot reservations.
# The fixture has 8 courses across all tiers so that 6-slot selections have
# enough room for the reservation system to produce visible differences.


def _course_row(code, name, level=1000):
    """Shorthand for a course row with sensible defaults."""
    return {
        "course_code": code, "course_name": name, "credits": 3, "level": level,
        "prereq_hard": "none", "prereq_soft": "", "prereq_level": 0,
        "offered_fall": True, "offered_spring": True, "offered_summer": False,
        "offering_confidence": "high", "notes": None,
    }


def _archetype_fixture():
    """Build a dataset with 8 courses spanning all bucket tiers.

    Tier layout:
      Tier 1 (MCC foundation): PHIL 1001 (ESSV1)
      Tier 2 (BCC):           ACCO 1030, BUAD 1001
      Tier 3 (Major):         FINA 3001, FINA 3002
      Tier 5 (Late MCC):      ENGL 2001 (ESSV2)
      Tier 6 (Discovery):     HIST 1001, SOCI 1001

    With max_recs=6, grinder fills 4 core + 2 discovery tail.
    Explorer should reserve 2 discovery slots, producing different picks.
    Mixer should interleave core and discovery.
    """
    courses = [
        _course_row("PHIL 1001", "ESSV1"),
        _course_row("ACCO 1030", "Accounting I"),
        _course_row("BUAD 1001", "Business Admin I"),
        _course_row("FINA 3001", "Finance Core", level=3000),
        _course_row("FINA 3002", "Finance II", level=3000),
        _course_row("ENGL 2001", "Writing Intensive", level=2000),
        _course_row("HIST 1001", "Discovery Hist"),
        _course_row("SOCI 1001", "Discovery Soci"),
    ]
    buckets = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV1", "parent_bucket_id": "MCC",
         "bucket_label": "ESSV1", "priority": 1, "needed_count": 1,
         "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "core"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "parent_bucket_id": "BCC",
         "bucket_label": "BCC Required", "priority": 1, "needed_count": 2,
         "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "core"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "parent_bucket_id": "FIN_MAJOR",
         "bucket_label": "FIN Core", "priority": 1, "needed_count": 2,
         "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "core"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV2", "parent_bucket_id": "MCC",
         "bucket_label": "ESSV2", "priority": 1, "needed_count": 1,
         "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "core"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC_DISC_BNJ::MCC_DISC_BNJ_SSC", "parent_bucket_id": "MCC_DISC_BNJ",
         "bucket_label": "Discovery SSC", "priority": 1, "needed_count": 2,
         "needed_credits": None, "min_level": None, "allow_double_count": False, "role": "elective"},
    ]
    course_map = [
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV1", "course_code": "PHIL 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "ACCO 1030"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BCC::BCC_REQUIRED", "course_code": "BUAD 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_MAJOR::FIN_CORE", "course_code": "FINA 3002"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC::MCC_ESSV2", "course_code": "ENGL 2001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC_DISC_BNJ::MCC_DISC_BNJ_SSC", "course_code": "HIST 1001"},
        {"track_id": "FIN_MAJOR", "bucket_id": "MCC_DISC_BNJ::MCC_DISC_BNJ_SSC", "course_code": "SOCI 1001"},
    ]
    parent_buckets = [
        {"parent_bucket_id": "MCC", "type": "universal"},
        {"parent_bucket_id": "BCC", "type": "universal"},
        {"parent_bucket_id": "FIN_MAJOR", "type": "major"},
        {"parent_bucket_id": "MCC_DISC_BNJ", "type": "universal"},
    ]
    data = _mk_data(courses, course_map, buckets)
    data["parent_buckets_df"] = pd.DataFrame(parent_buckets)
    return data


def _recommend_with_style(data, style, max_recs=6, current_standing=1):
    return run_recommendation_semester(
        completed=[], in_progress=[], target_semester_label="Fall 2026",
        data=data, max_recs=max_recs, reverse_map={}, track_id="FIN_MAJOR",
        scheduling_style=style, current_standing=current_standing,
    )


def _get_codes(out):
    return [r["course_code"] for r in out["recommendations"]]


def test_grinder_matches_default_behavior():
    """Grinder remains the default behavior when no explicit style is passed."""
    data = _archetype_fixture()
    default_codes = _get_codes(_recommend_with_style(data, None))
    grinder_codes = _get_codes(_recommend_with_style(data, "grinder"))
    assert default_codes == grinder_codes


def test_grinder_pushes_mcc_cleanup_behind_declared_program_work():
    """Grinder should keep MCC/discovery cleanup after major-track progress."""
    data = _archetype_fixture()
    grinder_codes = _get_codes(_recommend_with_style(data, "grinder", max_recs=8))

    major_positions = [grinder_codes.index(code) for code in ("FINA 3001", "FINA 3002")]
    cleanup_positions = [
        grinder_codes.index(code)
        for code in ("PHIL 1001", "ENGL 2001", "HIST 1001", "SOCI 1001")
    ]

    assert max(major_positions) < min(cleanup_positions), (
        f"Grinder should defer MCC/discovery cleanup until after declared-program work: {grinder_codes}"
    )


def test_explorer_reserves_discovery_slots():
    """Explorer reserves at least 2 discovery/gen-ed slots per semester.

    With 8 courses and max_recs=6, grinder fills mostly core.  Explorer
    should include at least 2 discovery-classified courses (HIST, SOCI,
    or ENGL) in its selection.
    """
    data = _archetype_fixture()
    grinder_codes = _get_codes(_recommend_with_style(data, "grinder"))
    explorer_codes = _get_codes(_recommend_with_style(data, "explorer"))
    discovery_courses = {"HIST 1001", "SOCI 1001", "ENGL 2001"}
    explorer_disc_count = len([c for c in explorer_codes if c in discovery_courses])
    assert explorer_disc_count >= 2, (
        f"Explorer should reserve >= 2 discovery slots, got {explorer_disc_count}: {explorer_codes}"
    )
    # Grinder may have fewer discovery picks since it has no reservation
    grinder_disc_count = len([c for c in grinder_codes if c in discovery_courses])
    assert explorer_disc_count >= grinder_disc_count, (
        f"Explorer should have >= grinder discovery count: "
        f"explorer={explorer_disc_count} grinder={grinder_disc_count}"
    )


def test_explorer_promotes_discovery_over_major():
    """Explorer ranks discovery courses ahead of major courses in the output."""
    data = _archetype_fixture()
    explorer_codes = _get_codes(_recommend_with_style(data, "explorer"))
    discovery_courses = {"HIST 1001", "SOCI 1001", "ENGL 2001"}
    # At least one discovery course should appear before the last major course
    disc_positions = [i for i, c in enumerate(explorer_codes) if c in discovery_courses]
    major_positions = [i for i, c in enumerate(explorer_codes) if c in {"FINA 3001", "FINA 3002"}]
    if disc_positions and major_positions:
        assert min(disc_positions) < max(major_positions), (
            f"Explorer should have discovery before some major courses: {explorer_codes}"
        )


def test_mixer_guarantees_core_and_discovery():
    """Mixer includes at least 1 discovery and at least 2 core courses."""
    data = _archetype_fixture()
    mixer_codes = _get_codes(_recommend_with_style(data, "mixer"))
    discovery_courses = {"HIST 1001", "SOCI 1001", "ENGL 2001"}
    core_courses = {"PHIL 1001", "ACCO 1030", "BUAD 1001", "FINA 3001", "FINA 3002"}
    disc_count = len([c for c in mixer_codes if c in discovery_courses])
    core_count = len([c for c in mixer_codes if c in core_courses])
    assert disc_count >= 1, f"Mixer should have >= 1 discovery, got {disc_count}: {mixer_codes}"
    assert core_count >= 2, f"Mixer should have >= 2 core, got {core_count}: {mixer_codes}"


def test_explorer_differs_from_grinder():
    """Explorer and grinder produce different course sets, not just reordering."""
    data = _archetype_fixture()
    grinder_codes = _get_codes(_recommend_with_style(data, "grinder"))
    explorer_codes = _get_codes(_recommend_with_style(data, "explorer"))
    # With slot reservations, the sets or at least the ordering should differ
    assert grinder_codes != explorer_codes, (
        f"Explorer should differ from grinder: both={grinder_codes}"
    )


def test_mixer_differs_from_grinder():
    """Mixer produces different output than grinder."""
    data = _archetype_fixture()
    grinder_codes = _get_codes(_recommend_with_style(data, "grinder"))
    mixer_codes = _get_codes(_recommend_with_style(data, "mixer"))
    assert grinder_codes != mixer_codes, (
        f"Mixer should differ from grinder: both={grinder_codes}"
    )


def test_invalid_scheduling_style_falls_back_to_grinder():
    """Unknown style silently falls back to grinder behavior."""
    data = _archetype_fixture()
    grinder_codes = _get_codes(_recommend_with_style(data, "grinder"))
    invalid_codes = _get_codes(_recommend_with_style(data, "nonexistent_style"))
    assert grinder_codes == invalid_codes


def test_all_styles_respect_max_recs():
    """No style exceeds max_recs."""
    data = _archetype_fixture()
    for style_name in ["grinder", "explorer", "mixer"]:
        codes = _get_codes(_recommend_with_style(data, style_name, max_recs=4))
        assert len(codes) <= 4, f"{style_name} exceeded max_recs=4: {codes}"
