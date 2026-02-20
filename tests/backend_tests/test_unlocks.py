import pytest
import pandas as pd
from unlocks import build_reverse_prereq_map, get_direct_unlocks, get_blocking_warnings


@pytest.fixture
def courses_df():
    return pd.DataFrame([
        {"course_code": "FINA 3001"},
        {"course_code": "FINA 4001"},
        {"course_code": "FINA 4011"},
        {"course_code": "FINA 4020"},
        {"course_code": "FINA 4050"},
        {"course_code": "FINA 4081"},
    ])


@pytest.fixture
def prereq_map():
    return {
        "FINA 3001": {"type": "none"},
        "FINA 4001": {"type": "and", "courses": ["FINA 3001"]},
        "FINA 4011": {"type": "and", "courses": ["FINA 3001"]},
        "FINA 4020": {"type": "single", "course": "FINA 3001"},
        "FINA 4050": {"type": "single", "course": "FINA 3001"},
        "FINA 4081": {"type": "and", "courses": ["FINA 3001", "FINA 4001"]},
    }


class TestBuildReversePrereqMap:
    def test_fina_3001_unlocks_many(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        unlocked = reverse.get("FINA 3001", [])
        assert "FINA 4001" in unlocked
        assert "FINA 4011" in unlocked
        assert "FINA 4020" in unlocked
        assert "FINA 4050" in unlocked

    def test_fina_4001_unlocks_fina_4081(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        assert "FINA 4081" in reverse.get("FINA 4001", [])

    def test_no_prereq_not_in_map(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        # FINA 3001 itself has no prereqs so no course should list it... wait,
        # other courses DO list FINA 3001, so it WILL be in the reverse map.
        # But FINA 4081 has no course that lists IT as prereq (in this fixture)
        assert "FINA 4081" not in reverse or reverse.get("FINA 4081", []) == []


class TestGetDirectUnlocks:
    def test_limit_applied(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        unlocks = get_direct_unlocks("FINA 3001", reverse, limit=2)
        assert len(unlocks) <= 2

    def test_course_not_in_map(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        unlocks = get_direct_unlocks("ACCO 1030", reverse, limit=3)
        assert unlocks == []


class TestGetBlockingWarnings:
    def test_warns_when_many_blocked(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        # FINA 3001 blocks 4 finance electives: 4001, 4011, 4020, 4050, 4081 (partial)
        fin_elective_courses = ["FINA 4001", "FINA 4011", "FINA 4020", "FINA 4050", "FINA 4081"]
        warnings = get_blocking_warnings(
            core_remaining=["FINA 3001"],
            reverse_map=reverse,
            finance_elective_courses=fin_elective_courses,
            completed=[],
            in_progress=[],
            threshold=2,
        )
        assert len(warnings) > 0
        assert "FINA 3001" in warnings[0]

    def test_no_warn_when_already_completed(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        fin_elective_courses = ["FINA 4001", "FINA 4011"]
        # Already completed FINA 4001 and FINA 4011 → they're not "unmet"
        warnings = get_blocking_warnings(
            core_remaining=["FINA 3001"],
            reverse_map=reverse,
            finance_elective_courses=fin_elective_courses,
            completed=["FINA 4001", "FINA 4011"],  # already done
            in_progress=[],
            threshold=2,
        )
        assert len(warnings) == 0

    def test_threshold_respected(self, courses_df, prereq_map):
        reverse = build_reverse_prereq_map(courses_df, prereq_map)
        fin_elective_courses = ["FINA 4001"]  # only 1 unmet
        warnings = get_blocking_warnings(
            core_remaining=["FINA 3001"],
            reverse_map=reverse,
            finance_elective_courses=fin_elective_courses,
            completed=[],
            in_progress=[],
            threshold=2,  # need >= 2
        )
        assert len(warnings) == 0
