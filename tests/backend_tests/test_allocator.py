import pytest
import pandas as pd
from allocator import allocate_courses


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def simple_buckets():
    return pd.DataFrame([
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",        "bucket_label": "Core Required",        "priority": 1, "needed_count": 3, "needed_credits": None, "min_level": None, "allow_double_count": False},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2","bucket_label": "Choose Two Finance",    "priority": 2, "needed_count": 2, "needed_credits": None, "min_level": 3000,  "allow_double_count": True},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1","bucket_label": "Choose One Finance",    "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": 3000,  "allow_double_count": True},
        {"track_id": "FIN_MAJOR", "bucket_id": "BUS_ELEC_4",  "bucket_label": "Business Electives",   "priority": 4, "needed_count": 4, "needed_credits": None, "min_level": None,  "allow_double_count": True},
    ])


@pytest.fixture
def simple_map():
    return pd.DataFrame([
        # CORE only
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "course_code": "FINA 3001", "is_required": True,  "can_double_count": False, "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "course_code": "FINA 4001", "is_required": True,  "can_double_count": False, "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",         "course_code": "FINA 4011", "is_required": True,  "can_double_count": False, "constraints": None},
        # FIN_CHOOSE_2 + FIN_CHOOSE_1 overlap
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4020", "is_required": False, "can_double_count": True,  "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4050", "is_required": False, "can_double_count": True,  "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1", "course_code": "FINA 4020", "is_required": False, "can_double_count": True,  "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1", "course_code": "FINA 4050", "is_required": False, "can_double_count": True,  "constraints": None},
        # BUS_ELEC_4 only
        {"track_id": "FIN_MAJOR", "bucket_id": "BUS_ELEC_4",   "course_code": "ACCO 1030", "is_required": False, "can_double_count": True,  "constraints": None},
        {"track_id": "FIN_MAJOR", "bucket_id": "BUS_ELEC_4",   "course_code": "BUAD 1001", "is_required": False, "can_double_count": True,  "constraints": None},
    ])


@pytest.fixture
def simple_courses():
    return pd.DataFrame([
        {"course_code": "FINA 3001", "course_name": "Intro Finance",   "credits": 3, "level": 3000},
        {"course_code": "FINA 4001", "course_name": "Adv Finance",     "credits": 3, "level": 4000},
        {"course_code": "FINA 4011", "course_name": "Investment",      "credits": 3, "level": 4000},
        {"course_code": "FINA 4020", "course_name": "Financial Plan",  "credits": 3, "level": 4000},
        {"course_code": "FINA 4050", "course_name": "Fin Modeling",    "credits": 3, "level": 4000},
        {"course_code": "ACCO 1030", "course_name": "Financial Acct",  "credits": 3, "level": 1000},
        {"course_code": "BUAD 1001", "course_name": "Business Day 1",  "credits": 3, "level": 1000},
    ])


# ── Tests ──────────────────────────────────────────────────────────────────────

def run(completed, in_progress, buckets, course_map, courses):
    return allocate_courses(completed, in_progress, buckets, course_map, courses)


class TestBasicAllocation:
    def test_core_course_goes_to_core(self, simple_buckets, simple_map, simple_courses):
        result = run(["FINA 3001"], [], simple_buckets, simple_map, simple_courses)
        assert "FINA 3001" in result["applied_by_bucket"]["CORE"]["completed_applied"]

    def test_in_progress_not_counted(self, simple_buckets, simple_map, simple_courses):
        result = run([], ["FINA 3001"], simple_buckets, simple_map, simple_courses)
        assert result["applied_by_bucket"]["CORE"]["completed_applied"] == []
        assert "FINA 3001" in result["applied_by_bucket"]["CORE"]["in_progress_applied"]
        assert result["applied_by_bucket"]["CORE"]["satisfied"] is False

    def test_satisfied_flag(self, simple_buckets, simple_map, simple_courses):
        result = run(["FINA 3001", "FINA 4001", "FINA 4011"], [], simple_buckets, simple_map, simple_courses)
        assert result["applied_by_bucket"]["CORE"]["satisfied"] is True

    def test_finance_elective_to_fin_choose_2_first(self, simple_buckets, simple_map, simple_courses):
        result = run(["FINA 4020"], [], simple_buckets, simple_map, simple_courses)
        assert "FINA 4020" in result["applied_by_bucket"]["FIN_CHOOSE_2"]["completed_applied"]


class TestDoubleCount:
    def test_double_count_happy_path(self, simple_buckets, simple_map, simple_courses):
        """Finance course fills both FIN_CHOOSE_2 and FIN_CHOOSE_1."""
        result = run(["FINA 4020"], [], simple_buckets, simple_map, simple_courses)
        dc = result["double_counted_courses"]
        assert any(d["course_code"] == "FINA 4020" for d in dc)
        entry = next(d for d in dc if d["course_code"] == "FINA 4020")
        assert "FIN_CHOOSE_2" in entry["buckets"]
        assert "FIN_CHOOSE_1" in entry["buckets"]

    def test_core_cannot_double_count(self, simple_buckets, simple_map, simple_courses):
        """CORE courses never double-count (allow_double_count=False on CORE bucket)."""
        result = run(["FINA 3001"], [], simple_buckets, simple_map, simple_courses)
        dc = result["double_counted_courses"]
        # FINA 3001 only maps to CORE so shouldn't double-count
        assert not any(d["course_code"] == "FINA 3001" for d in dc)

    def test_double_count_bucket_already_full(self, simple_buckets, simple_map, simple_courses):
        """If secondary bucket is already full, note is generated."""
        # Fill FIN_CHOOSE_1 first with FINA 4020
        # Then FINA 4050 should note that FIN_CHOOSE_1 is full
        result = run(["FINA 4020", "FINA 4050"], [], simple_buckets, simple_map, simple_courses)
        # FINA 4020 fills FIN_CHOOSE_2 (slot 1) + FIN_CHOOSE_1 (slot 1, satisfying it)
        # FINA 4050 fills FIN_CHOOSE_2 (slot 2) — FIN_CHOOSE_1 now full
        assert result["applied_by_bucket"]["FIN_CHOOSE_1"]["satisfied"] is True
        # There should be a note about FINA 4050 and FIN_CHOOSE_1
        assert any("FIN_CHOOSE_1" in n or "Choose One" in n for n in result["notes"])


class TestAllocationOrder:
    def test_constrained_course_placed_first(self, simple_buckets, simple_map, simple_courses):
        """
        FINA 3001 can only go to CORE (1 bucket).
        FINA 4020 can go to FIN_CHOOSE_2 or FIN_CHOOSE_1 (2 buckets).
        FINA 3001 should be sorted first → CORE gets filled correctly.
        """
        result = run(["FINA 4020", "FINA 3001"], [], simple_buckets, simple_map, simple_courses)
        assert "FINA 3001" in result["applied_by_bucket"]["CORE"]["completed_applied"]
        assert "FINA 4020" in result["applied_by_bucket"]["FIN_CHOOSE_2"]["completed_applied"]

    def test_remaining_reflects_slots(self, simple_buckets, simple_map, simple_courses):
        result = run(["FINA 3001"], [], simple_buckets, simple_map, simple_courses)
        core_remaining = result["remaining"]["CORE"]
        assert core_remaining["slots_remaining"] == 2
        assert core_remaining["needed"] == 3


class TestMinLevel:
    def test_below_min_level_excluded(self, simple_buckets, simple_map, simple_courses):
        """ACCO 1030 (level 1000) should NOT go to FIN_CHOOSE_2 (min_level 3000)."""
        result = run(["ACCO 1030"], [], simple_buckets, simple_map, simple_courses)
        assert "ACCO 1030" not in result["applied_by_bucket"]["FIN_CHOOSE_2"]["completed_applied"]
        assert "ACCO 1030" in result["applied_by_bucket"]["BUS_ELEC_4"]["completed_applied"]
