import pytest
import pandas as pd
from allocator import allocate_courses


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def simple_buckets():
    return pd.DataFrame([
        {"track_id": "FIN_MAJOR", "bucket_id": "CORE",        "bucket_label": "Core Required",        "priority": 1, "needed_count": 3, "needed_credits": None, "min_level": None, "allow_double_count": False, "parent_bucket_id": "FIN_REQ"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2","bucket_label": "Choose Two Finance",    "priority": 2, "needed_count": 2, "needed_credits": None, "min_level": 3000,  "allow_double_count": True,  "parent_bucket_id": "FIN_REQ"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1","bucket_label": "Choose One Finance",    "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": 3000,  "allow_double_count": True,  "parent_bucket_id": "FIN_REQ"},
        {"track_id": "FIN_MAJOR", "bucket_id": "BUS_ELEC_4",  "bucket_label": "Business Electives",   "priority": 4, "needed_count": 4, "needed_credits": None, "min_level": None,  "allow_double_count": True,  "parent_bucket_id": "BCC"},
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

@pytest.fixture
def simple_policy():
    return pd.DataFrame([
        {
            "program_id": "FIN_MAJOR",
            "sub_bucket_id_a": "FIN_CHOOSE_1",
            "sub_bucket_id_b": "FIN_CHOOSE_2",
            "allow_double_count": True,
        },
    ])


# ── Tests ──────────────────────────────────────────────────────────────────────

def run(completed, in_progress, buckets, course_map, courses):
    return allocate_courses(completed, in_progress, buckets, course_map, courses)


def run_with_policy(completed, in_progress, buckets, course_map, courses, policy):
    track_id = "FIN_MAJOR"
    if "track_id" in buckets.columns and len(buckets) > 0:
        track_id = str(buckets.iloc[0]["track_id"])
    return allocate_courses(
        completed,
        in_progress,
        buckets,
        course_map,
        courses,
        track_id=track_id,
        double_count_policy_df=policy,
    )


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
    def test_double_count_happy_path(self, simple_buckets, simple_map, simple_courses, simple_policy):
        """Finance course fills both FIN_CHOOSE_2 and FIN_CHOOSE_1."""
        result = run_with_policy(["FINA 4020"], [], simple_buckets, simple_map, simple_courses, simple_policy)
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

    def test_double_count_bucket_already_full(self, simple_buckets, simple_map, simple_courses, simple_policy):
        """If secondary bucket is already full, note is generated."""
        # Fill FIN_CHOOSE_1 first with FINA 4020
        # Then FINA 4050 should note that FIN_CHOOSE_1 is full
        result = run_with_policy(
            ["FINA 4020", "FINA 4050"], [], simple_buckets, simple_map, simple_courses, simple_policy
        )
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


class TestPolicyDrivenDoubleCount:
    def _base_courses(self):
        return pd.DataFrame([
            {"course_code": "X100", "course_name": "Course X", "credits": 3, "level": 3000},
        ])

    def test_n_way_double_count_when_all_pairwise_allowed(self):
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "bucket_label": "A", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False},
            {"track_id": "P1", "bucket_id": "B", "bucket_label": "B", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False},
            {"track_id": "P1", "bucket_id": "C", "bucket_label": "C", "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "B", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "C", "course_code": "X100"},
        ])
        policy = pd.DataFrame([
            {"program_id": "P1", "sub_bucket_id_a": "A", "sub_bucket_id_b": "B", "allow_double_count": True},
            {"program_id": "P1", "sub_bucket_id_a": "A", "sub_bucket_id_b": "C", "allow_double_count": True},
            {"program_id": "P1", "sub_bucket_id_a": "B", "sub_bucket_id_b": "C", "allow_double_count": True},
        ])

        result = run_with_policy(["X100"], [], buckets, course_map, self._base_courses(), policy)
        dc = result["double_counted_courses"]
        assert len(dc) == 1
        assert dc[0]["course_code"] == "X100"
        assert dc[0]["buckets"] == ["A", "B", "C"]

    def test_same_family_default_deny_blocks_unspecified_pairs(self):
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "bucket_label": "A", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": True, "parent_bucket_id": "PARENT"},
            {"track_id": "P1", "bucket_id": "B", "bucket_label": "B", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": True, "parent_bucket_id": "PARENT"},
            {"track_id": "P1", "bucket_id": "C", "bucket_label": "C", "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": True, "parent_bucket_id": "PARENT"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "B", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "C", "course_code": "X100"},
        ])
        policy = pd.DataFrame([
            {"program_id": "P1", "sub_bucket_id_a": "A", "sub_bucket_id_b": "B", "allow_double_count": True},
        ])

        result = run_with_policy(["X100"], [], buckets, course_map, self._base_courses(), policy)
        dc = result["double_counted_courses"]
        assert len(dc) == 1
        assert dc[0]["buckets"] == ["A", "B"]
        assert "X100" not in result["applied_by_bucket"]["C"]["completed_applied"]

    def test_bucket_level_allow_propagates_to_children(self):
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "S1", "bucket_label": "S1", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False, "parent_bucket_id": "PARENT_1"},
            {"track_id": "P1", "bucket_id": "S2", "bucket_label": "S2", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False, "parent_bucket_id": "PARENT_2"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "S1", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "S2", "course_code": "X100"},
        ])
        policy = pd.DataFrame([
            {"program_id": "P1", "node_type_a": "bucket", "node_id_a": "PARENT_1", "node_type_b": "bucket", "node_id_b": "PARENT_2", "allow_double_count": True},
        ])

        result = run_with_policy(["X100"], [], buckets, course_map, self._base_courses(), policy)
        dc = result["double_counted_courses"]
        assert len(dc) == 1
        assert dc[0]["buckets"] == ["S1", "S2"]

    def test_sub_bucket_deny_overrides_bucket_allow(self):
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "S1", "bucket_label": "S1", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False, "parent_bucket_id": "PARENT_1"},
            {"track_id": "P1", "bucket_id": "S2", "bucket_label": "S2", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False, "parent_bucket_id": "PARENT_2"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "S1", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "S2", "course_code": "X100"},
        ])
        policy = pd.DataFrame([
            {"program_id": "P1", "node_type_a": "bucket", "node_id_a": "PARENT_1", "node_type_b": "bucket", "node_id_b": "PARENT_2", "allow_double_count": True},
            {"program_id": "P1", "node_type_a": "sub_bucket", "node_id_a": "S1", "node_type_b": "sub_bucket", "node_id_b": "S2", "allow_double_count": False},
        ])

        result = run_with_policy(["X100"], [], buckets, course_map, self._base_courses(), policy)
        assert result["double_counted_courses"] == []
        assert "X100" in result["applied_by_bucket"]["S1"]["completed_applied"]
        assert "X100" not in result["applied_by_bucket"]["S2"]["completed_applied"]

    def test_no_matching_policy_rows_uses_family_default(self):
        """No policy rows: same family denies, different families allow."""
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "bucket_label": "A", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": True, "parent_bucket_id": "PARENT_1"},
            {"track_id": "P1", "bucket_id": "B", "bucket_label": "B", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": True, "parent_bucket_id": "PARENT_2"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "B", "course_code": "X100"},
        ])
        policy = pd.DataFrame()

        result = run_with_policy(["X100"], [], buckets, course_map, self._base_courses(), policy)
        assert len(result["double_counted_courses"]) == 1
        assert result["double_counted_courses"][0]["buckets"] == ["A", "B"]


class TestInProgressPolicyRespect:
    """Verify in-progress courses respect same-parent deny policy."""

    def _base_courses(self):
        return pd.DataFrame([
            {"course_code": "X100", "course_name": "Course X", "credits": 3, "level": 3000},
        ])

    def test_in_progress_same_parent_deny(self):
        """In-progress course should NOT appear in multiple same-parent buckets."""
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "bucket_label": "A", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT"},
            {"track_id": "P1", "bucket_id": "B", "bucket_label": "B", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT"},
            {"track_id": "P1", "bucket_id": "C", "bucket_label": "C", "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "B", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "C", "course_code": "X100"},
        ])

        result = run_with_policy([], ["X100"], buckets, course_map, self._base_courses(), pd.DataFrame())

        # X100 should appear in exactly ONE bucket (highest priority = A), not all three
        ip_buckets = [
            bid for bid, data in result["applied_by_bucket"].items()
            if "X100" in data["in_progress_applied"]
        ]
        assert len(ip_buckets) == 1, f"Expected in 1 bucket, found in {ip_buckets}"
        assert ip_buckets[0] == "A"

    def test_in_progress_different_parent_allowed(self):
        """In-progress course CAN appear in multiple different-parent buckets."""
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "bucket_label": "A", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT_1"},
            {"track_id": "P1", "bucket_id": "B", "bucket_label": "B", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT_2"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "B", "course_code": "X100"},
        ])

        result = run_with_policy([], ["X100"], buckets, course_map, self._base_courses(), pd.DataFrame())

        ip_buckets = [
            bid for bid, data in result["applied_by_bucket"].items()
            if "X100" in data["in_progress_applied"]
        ]
        assert len(ip_buckets) == 2, f"Expected in 2 buckets, found in {ip_buckets}"

    def test_in_progress_with_explicit_policy_allow(self):
        """In-progress course respects explicit allow policy for same-parent siblings."""
        buckets = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "bucket_label": "A", "priority": 1, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT"},
            {"track_id": "P1", "bucket_id": "B", "bucket_label": "B", "priority": 2, "needed_count": 1, "needed_credits": None, "min_level": None, "parent_bucket_id": "PARENT"},
        ])
        course_map = pd.DataFrame([
            {"track_id": "P1", "bucket_id": "A", "course_code": "X100"},
            {"track_id": "P1", "bucket_id": "B", "course_code": "X100"},
        ])
        policy = pd.DataFrame([
            {"program_id": "P1", "sub_bucket_id_a": "A", "sub_bucket_id_b": "B", "allow_double_count": True},
        ])

        result = run_with_policy([], ["X100"], buckets, course_map, self._base_courses(), policy)

        ip_buckets = [
            bid for bid, data in result["applied_by_bucket"].items()
            if "X100" in data["in_progress_applied"]
        ]
        assert len(ip_buckets) == 2, f"Expected in 2 buckets with explicit allow, found in {ip_buckets}"
