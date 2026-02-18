import pytest
import pandas as pd
from eligibility import get_eligible_courses, check_can_take, parse_term


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def courses_df():
    return pd.DataFrame([
        {"course_code": "FINA 3001", "course_name": "Intro Finance",  "credits": 3, "level": 3000, "offered_fall": True,  "offered_spring": True,  "offered_summer": False, "prereq_hard": "none",                "prereq_soft": "",                     "offering_confidence": "high", "notes": None},
        {"course_code": "FINA 4001", "course_name": "Adv Finance",    "credits": 3, "level": 4000, "offered_fall": True,  "offered_spring": False, "offered_summer": False, "prereq_hard": "FINA 3001",           "prereq_soft": "",                     "offering_confidence": "high", "notes": None},
        {"course_code": "FINA 4011", "course_name": "Investment",     "credits": 3, "level": 4000, "offered_fall": False, "offered_spring": True,  "offered_summer": False, "prereq_hard": "FINA 3001",           "prereq_soft": "",                     "offering_confidence": "high", "notes": None},
        {"course_code": "FINA 4020", "course_name": "Fin Planning",   "credits": 3, "level": 4000, "offered_fall": True,  "offered_spring": False, "offered_summer": False, "prereq_hard": "FINA 3001",           "prereq_soft": "",                     "offering_confidence": "high", "notes": None},
        {"course_code": "FINA 4081", "course_name": "Inv Banking",    "credits": 3, "level": 4000, "offered_fall": False, "offered_spring": True,  "offered_summer": False, "prereq_hard": "FINA 3001; FINA 4001","prereq_soft": "",                     "offering_confidence": "high", "notes": None},
        {"course_code": "FINA 4210", "course_name": "Commercial Bank","credits": 3, "level": 4000, "offered_fall": True,  "offered_spring": False, "offered_summer": False, "prereq_hard": "none",                "prereq_soft": "instructor_consent",   "offering_confidence": "high", "notes": None},
        {"course_code": "FINA 4095", "course_name": "Complex Course", "credits": 3, "level": 4000, "offered_fall": True,  "offered_spring": True,  "offered_summer": False, "prereq_hard": "none",                "prereq_soft": "hard_prereq_complex",  "offering_confidence": "low",  "notes": None},
        {"course_code": "FINA 4300", "course_name": "Concurrent Cap", "credits": 3, "level": 4000, "offered_fall": True,  "offered_spring": False, "offered_summer": False, "prereq_hard": "FINA 3001",           "prereq_soft": "may_be_concurrent",    "offering_confidence": "high", "notes": None},
    ])


@pytest.fixture
def buckets_df():
    return pd.DataFrame([
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "bucket_label": "Core Required",     "priority": 1, "needed_count": 3, "needed_credits": None, "min_level": None, "allow_double_count": False},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "bucket_label": "Choose Two Finance","priority": 2, "needed_count": 2, "needed_credits": None, "min_level": 3000, "allow_double_count": True},
    ])


@pytest.fixture
def course_bucket_map():
    return pd.DataFrame([
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "course_code": "FINA 3001", "is_required": True,  "can_double_count": False, "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "course_code": "FINA 4001", "is_required": True,  "can_double_count": False, "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "course_code": "FINA 4011", "is_required": True,  "can_double_count": False, "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4020", "is_required": False, "can_double_count": True,  "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4081", "is_required": False, "can_double_count": True,  "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4300", "is_required": False, "can_double_count": True,  "constraints": None},
    ])


@pytest.fixture
def prereq_map(courses_df):
    from prereq_parser import parse_prereqs
    return {row["course_code"]: parse_prereqs(row["prereq_hard"]) for _, row in courses_df.iterrows()}


@pytest.fixture
def allocator_remaining():
    return {
        "CORE":         {"slots_remaining": 2, "needed": 3},
        "FIN_CHOOSE_2": {"slots_remaining": 2, "needed": 2},
    }


class TestGetEligibleCourses:
    def test_excludes_completed(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, ["FINA 3001"], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        codes = [c["course_code"] for c in eligible]
        assert "FINA 3001" not in codes

    def test_excludes_in_progress(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, [], ["FINA 3001"], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        codes = [c["course_code"] for c in eligible]
        assert "FINA 3001" not in codes

    def test_excludes_wrong_term(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        # FINA 4011 is Spring only
        eligible = get_eligible_courses(
            courses_df, ["FINA 3001"], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        codes = [c["course_code"] for c in eligible]
        assert "FINA 4011" not in codes

    def test_missing_prereq_excluded(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        # FINA 4001 requires FINA 3001 — not completed
        eligible = get_eligible_courses(
            courses_df, [], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        codes = [c["course_code"] for c in eligible]
        assert "FINA 4001" not in codes

    def test_prereq_satisfied_by_completed(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, ["FINA 3001"], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        codes = [c["course_code"] for c in eligible]
        assert "FINA 4001" in codes

    def test_hard_prereq_not_satisfied_by_in_progress_by_default(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        # FINA 3001 in-progress should NOT satisfy hard prereq for FINA 4001
        eligible = get_eligible_courses(
            courses_df, [], ["FINA 3001"], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        codes = [c["course_code"] for c in eligible]
        assert "FINA 4001" not in codes

    def test_prereq_satisfied_by_in_progress_when_concurrent_allowed(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, [], ["FINA 3001"], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        fina4300 = next(c for c in eligible if c["course_code"] == "FINA 4300")
        assert "concurrent allowed" in fina4300["prereq_check"]

    def test_soft_requirement_flagged(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, [], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        fina4210 = next((c for c in eligible if c["course_code"] == "FINA 4210"), None)
        if fina4210:
            assert fina4210["has_soft_requirement"] is True

    def test_hard_prereq_complex_flagged_manual_review(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, [], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        fina4095 = next((c for c in eligible if c["course_code"] == "FINA 4095"), None)
        if fina4095:
            assert fina4095["manual_review"] is True

    def test_sorted_by_priority(self, courses_df, prereq_map, allocator_remaining, course_bucket_map, buckets_df):
        eligible = get_eligible_courses(
            courses_df, ["FINA 3001"], [], "Fall", prereq_map,
            allocator_remaining, course_bucket_map, buckets_df
        )
        non_manual = [c for c in eligible if not c["manual_review"]]
        priorities = [c["primary_bucket_priority"] for c in non_manual if c["primary_bucket_priority"]]
        assert priorities == sorted(priorities)


class TestCheckCanTake:
    def test_can_take_eligible(self, courses_df, prereq_map):
        result = check_can_take("FINA 4001", courses_df, ["FINA 3001"], [], "Fall", prereq_map)
        assert result["can_take"] is True

    def test_cannot_take_missing_prereq(self, courses_df, prereq_map):
        result = check_can_take("FINA 4001", courses_df, [], [], "Fall", prereq_map)
        assert result["can_take"] is False
        assert "FINA 3001" in result["missing_prereqs"]

    def test_cannot_take_wrong_term(self, courses_df, prereq_map):
        # FINA 4011 Spring only
        result = check_can_take("FINA 4011", courses_df, ["FINA 3001"], [], "Fall", prereq_map)
        assert result["can_take"] is False
        assert result["not_offered_this_term"] is True

    def test_cannot_take_already_completed(self, courses_df, prereq_map):
        result = check_can_take("FINA 3001", courses_df, ["FINA 3001"], [], "Fall", prereq_map)
        assert result["can_take"] is False

    def test_unknown_course(self, courses_df, prereq_map):
        result = check_can_take("FAKE 9999", courses_df, [], [], "Fall", prereq_map)
        assert result["can_take"] is False

    def test_unsupported_prereq_returns_null(self, courses_df, prereq_map):
        # FINA 4095 has hard_prereq_complex tag
        result = check_can_take("FINA 4095", courses_df, [], [], "Fall", prereq_map)
        assert result["can_take"] is None
        assert result["unsupported_prereq_format"] is True


class TestParseTerm:
    def test_fall(self):
        assert parse_term("Fall 2026") == "Fall"

    def test_spring(self):
        assert parse_term("Spring 2027") == "Spring"

    def test_summer(self):
        assert parse_term("Summer 2026") == "Summer"

    def test_invalid(self):
        with pytest.raises(ValueError):
            parse_term("Winter 2026")
