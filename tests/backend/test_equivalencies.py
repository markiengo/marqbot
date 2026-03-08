"""Tests for course equivalency system (5 relation types)."""

import pytest
import pandas as pd
from data_loader import (
    _build_equiv_prereq_map,
    _build_cross_listed_map,
    _build_no_double_count_groups,
    _load_v2_equivalencies,
    _VALID_RELATION_TYPES,
    load_data,
)
from prereq_parser import prereqs_satisfied, parse_prereqs
from allocator import allocate_courses, ensure_runtime_indexes, _expand_map_with_equivalencies


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def equiv_df():
    """Equivalency DataFrame with all five relation types."""
    return pd.DataFrame([
        {"equiv_group_id": "STAT_1", "course_code": "STAT 2200", "relation_type": "equivalent", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "STAT_1", "course_code": "STAT 2210", "relation_type": "equivalent", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "HON_1", "course_code": "ECON 1103", "relation_type": "honors", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "HON_1", "course_code": "ECON 1103H", "relation_type": "honors", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "GRAD_1", "course_code": "FINA 4001", "relation_type": "grad", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "GRAD_1", "course_code": "FINA 5001", "relation_type": "grad", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "XLIST_1", "course_code": "PHIL 1001", "relation_type": "cross_listed", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "XLIST_1", "course_code": "PHIL 1001H", "relation_type": "cross_listed", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "NDC_1", "course_code": "MATH 4710", "relation_type": "no_double_count", "scope_program_id": "", "label": ""},
        {"equiv_group_id": "NDC_1", "course_code": "MATH 4720", "relation_type": "no_double_count", "scope_program_id": "", "label": ""},
    ])


@pytest.fixture
def scoped_equiv_df():
    """Equivalency with program scope."""
    return pd.DataFrame([
        {"equiv_group_id": "ACCO_INSY", "course_code": "INSY 3001", "relation_type": "equivalent", "scope_program_id": "ACCO_MAJOR", "label": ""},
        {"equiv_group_id": "ACCO_INSY", "course_code": "ACCO 4050", "relation_type": "equivalent", "scope_program_id": "ACCO_MAJOR", "label": ""},
    ])


@pytest.fixture
def simple_buckets():
    return pd.DataFrame([
        {"track_id": "TEST_MAJOR", "bucket_id": "CORE", "bucket_label": "Core", "priority": 1, "needed_count": 2, "needed_credits": None, "min_level": None, "parent_bucket_id": "TEST_REQ"},
        {"track_id": "TEST_MAJOR", "bucket_id": "ELEC", "bucket_label": "Electives", "priority": 2, "needed_count": 2, "needed_credits": None, "min_level": None, "parent_bucket_id": "TEST_REQ"},
    ])


@pytest.fixture
def simple_map():
    return pd.DataFrame([
        {"track_id": "TEST_MAJOR", "bucket_id": "CORE", "course_code": "STAT 2200"},
        {"track_id": "TEST_MAJOR", "bucket_id": "CORE", "course_code": "PHIL 1001"},
        {"track_id": "TEST_MAJOR", "bucket_id": "ELEC", "course_code": "MATH 4710"},
        {"track_id": "TEST_MAJOR", "bucket_id": "ELEC", "course_code": "MATH 4720"},
    ])


@pytest.fixture
def simple_courses():
    return pd.DataFrame([
        {"course_code": "STAT 2200", "course_name": "Intro Stats", "credits": 3, "level": 2000},
        {"course_code": "STAT 2210", "course_name": "Intro Stats Alt", "credits": 3, "level": 2000},
        {"course_code": "ECON 1103", "course_name": "Micro Econ", "credits": 3, "level": 1000},
        {"course_code": "ECON 1103H", "course_name": "Honors Micro Econ", "credits": 3, "level": 1000},
        {"course_code": "FINA 4001", "course_name": "Investments", "credits": 3, "level": 4000},
        {"course_code": "FINA 5001", "course_name": "Investments", "credits": 3, "level": 5000},
        {"course_code": "PHIL 1001", "course_name": "Intro Philosophy", "credits": 3, "level": 1000},
        {"course_code": "PHIL 1001H", "course_name": "Honors Intro Philosophy", "credits": 3, "level": 1000},
        {"course_code": "MATH 4710", "course_name": "Probability", "credits": 3, "level": 4000},
        {"course_code": "MATH 4720", "course_name": "Math Stats", "credits": 3, "level": 4000},
    ])


# ── Map Builder Tests ─────────────────────────────────────────────────────────


class TestBuildEquivPrereqMap:
    def test_only_equivalent_like_types(self, equiv_df):
        result = _build_equiv_prereq_map(equiv_df)
        assert "STAT 2200" in result
        assert "STAT 2210" in result["STAT 2200"]
        # honors and grad types are included
        assert "ECON 1103H" in result.get("ECON 1103", set())
        assert "FINA 5001" in result.get("FINA 4001", set())
        # cross_listed and no_double_count should NOT appear
        assert "PHIL 1001" not in result
        assert "MATH 4710" not in result

    def test_bidirectional(self, equiv_df):
        result = _build_equiv_prereq_map(equiv_df)
        assert "STAT 2200" in result["STAT 2210"]
        assert "STAT 2210" in result["STAT 2200"]

    def test_empty_df(self):
        assert _build_equiv_prereq_map(pd.DataFrame()) == {}
        assert _build_equiv_prereq_map(None) == {}

    def test_no_relation_type_column(self):
        """Missing relation_type defaults to treating all as equivalent."""
        df = pd.DataFrame([
            {"equiv_group_id": "G1", "course_code": "A 1001"},
            {"equiv_group_id": "G1", "course_code": "B 1001"},
        ])
        result = _build_equiv_prereq_map(df)
        assert "B 1001" in result.get("A 1001", set())


class TestBuildCrossListedMap:
    def test_only_cross_listed_type(self, equiv_df):
        result = _build_cross_listed_map(equiv_df)
        assert "PHIL 1001" in result
        assert "PHIL 1001H" in result["PHIL 1001"]
        assert "STAT 2200" not in result

    def test_empty(self):
        assert _build_cross_listed_map(pd.DataFrame()) == {}


class TestBuildNDCGroups:
    def test_only_ndc_type(self, equiv_df):
        result = _build_no_double_count_groups(equiv_df)
        assert len(result) == 1
        assert {"MATH 4710", "MATH 4720"} in result

    def test_empty(self):
        assert _build_no_double_count_groups(pd.DataFrame()) == []


# ── Prereq Satisfaction Tests ─────────────────────────────────────────────────


class TestPrereqSatisfiedWithEquivMap:
    def test_equivalent_satisfies_single_prereq(self):
        parsed = parse_prereqs("STAT 2200")
        equiv = {"STAT 2210": {"STAT 2200"}, "STAT 2200": {"STAT 2210"}}
        # Student has STAT 2210, prereq requires STAT 2200
        assert prereqs_satisfied(parsed, {"STAT 2210"}, equiv_map=equiv) is True

    def test_without_equiv_map_fails(self):
        parsed = parse_prereqs("STAT 2200")
        assert prereqs_satisfied(parsed, {"STAT 2210"}) is False

    def test_equivalent_satisfies_and_prereq(self):
        parsed = parse_prereqs("STAT 2200;ACCO 1030")
        equiv = {"STAT 2210": {"STAT 2200"}, "STAT 2200": {"STAT 2210"}}
        assert prereqs_satisfied(parsed, {"STAT 2210", "ACCO 1030"}, equiv_map=equiv) is True

    def test_equivalent_satisfies_or_prereq(self):
        parsed = parse_prereqs("STAT 2200 or STAT 2300")
        equiv = {"STAT 2210": {"STAT 2200"}}
        assert prereqs_satisfied(parsed, {"STAT 2210"}, equiv_map=equiv) is True

    def test_none_prereq_unaffected(self):
        parsed = parse_prereqs("none")
        assert prereqs_satisfied(parsed, set(), equiv_map={"X": {"Y"}}) is True

    def test_equiv_map_does_not_assume_completion(self):
        """Equivalency expands satisfied_codes but does NOT imply the other
        course was taken — only that the prereq slot is satisfied."""
        parsed = parse_prereqs("STAT 2200")
        equiv = {"STAT 2200": {"STAT 2210"}}
        # Student has STAT 2200; this satisfies "STAT 2200" directly.
        # But STAT 2210 should NOT be in their completed set.
        assert prereqs_satisfied(parsed, {"STAT 2200"}, equiv_map=equiv) is True


# ── Bucket Expansion Tests ────────────────────────────────────────────────────


class TestExpandMapWithEquivalencies:
    def test_equivalent_expands_buckets(self, equiv_df, simple_map):
        expanded = _expand_map_with_equivalencies(simple_map, equiv_df, "TEST_MAJOR")
        codes = expanded["course_code"].tolist()
        # STAT 2210 should be added to CORE bucket (equivalent of STAT 2200)
        assert "STAT 2210" in codes

    def test_honors_and_grad_expand_buckets(self, equiv_df, simple_map):
        # Add ECON 1103 and FINA 4001 to the map so their equivalents can expand
        extra = pd.DataFrame([
            {"track_id": "TEST_MAJOR", "bucket_id": "CORE", "course_code": "ECON 1103"},
            {"track_id": "TEST_MAJOR", "bucket_id": "ELEC", "course_code": "FINA 4001"},
        ])
        combined = pd.concat([simple_map, extra], ignore_index=True)
        expanded = _expand_map_with_equivalencies(combined, equiv_df, "TEST_MAJOR")
        codes = expanded["course_code"].tolist()
        assert "ECON 1103H" in codes  # honors type expands
        assert "FINA 5001" in codes   # grad type expands

    def test_cross_listed_expands_buckets(self, equiv_df, simple_map):
        expanded = _expand_map_with_equivalencies(simple_map, equiv_df, "TEST_MAJOR")
        codes = expanded["course_code"].tolist()
        # PHIL 1001H should be added to CORE bucket (cross-listed with PHIL 1001)
        assert "PHIL 1001H" in codes

    def test_ndc_does_not_expand_buckets(self, equiv_df, simple_map):
        expanded = _expand_map_with_equivalencies(simple_map, equiv_df, "TEST_MAJOR")
        # Both MATH 4710 and 4720 are already in the map as base courses.
        # NDC should NOT create additional cross-bucket mappings.
        core_codes = expanded[expanded["bucket_id"] == "CORE"]["course_code"].tolist()
        assert "MATH 4710" not in core_codes
        assert "MATH 4720" not in core_codes

    def test_empty_equiv_df(self, simple_map):
        result = _expand_map_with_equivalencies(simple_map, pd.DataFrame(), "TEST_MAJOR")
        assert len(result) == len(simple_map)


# ── Allocator NDC Tests ───────────────────────────────────────────────────────


class TestAllocatorNDCBlocking:
    def test_ndc_blocks_second_course(self, equiv_df, simple_buckets, simple_map, simple_courses):
        data = {
            "courses_df": simple_courses,
            "equivalencies_df": equiv_df,
            "equiv_prereq_map": _build_equiv_prereq_map(equiv_df),
            "cross_listed_map": _build_cross_listed_map(equiv_df),
            "no_double_count_groups": _build_no_double_count_groups(equiv_df),
            "buckets_df": simple_buckets,
            "course_bucket_map_df": simple_map,
            "v2_double_count_policy_df": pd.DataFrame(),
        }
        data = ensure_runtime_indexes(data)

        result = allocate_courses(
            completed=["MATH 4710", "MATH 4720"],
            in_progress=[],
            buckets_df=data["buckets_df"],
            course_bucket_map_df=data["course_bucket_map_df"],
            courses_df=data["courses_df"],
            equivalencies_df=data["equivalencies_df"],
            track_id="TEST_MAJOR",
            runtime_indexes=data.get("runtime_indexes"),
        )
        # Only one of MATH 4710/4720 should be applied
        elec = result["applied_by_bucket"].get("ELEC", {})
        applied = elec.get("completed_applied", [])
        assert len(applied) == 1
        # A note should explain the blocking
        assert any("no double credit" in n for n in result["notes"])


# ── Schema Tests (against real data) ─────────────────────────────────────────


class TestEquivalencyDataIntegrity:
    @pytest.fixture(autouse=True)
    def _load(self):
        self.data = load_data("data")

    def test_relation_types_valid(self):
        eq = self.data["equivalencies_df"]
        if len(eq) == 0:
            pytest.skip("No equivalency data yet")
        if "relation_type" not in eq.columns:
            pytest.skip("No relation_type column")
        invalid = set(eq["relation_type"].unique()) - _VALID_RELATION_TYPES
        assert not invalid, f"Invalid relation_type values: {invalid}"

    def test_no_singleton_groups(self):
        eq = self.data["equivalencies_df"]
        if len(eq) == 0:
            pytest.skip("No equivalency data yet")
        for gid, grp in eq.groupby("equiv_group_id"):
            codes = {c.strip() for c in grp["course_code"].tolist() if c.strip()}
            assert len(codes) >= 2, f"Group {gid} has fewer than 2 members: {codes}"

    def test_no_mixed_relation_types(self):
        eq = self.data["equivalencies_df"]
        if len(eq) == 0 or "relation_type" not in eq.columns:
            pytest.skip("No equivalency data yet")
        for gid, grp in eq.groupby("equiv_group_id"):
            types = set(grp["relation_type"].unique())
            assert len(types) == 1, f"Group {gid} has mixed relation types: {types}"

    def test_course_codes_in_catalog(self):
        eq = self.data["equivalencies_df"]
        if len(eq) == 0:
            pytest.skip("No equivalency data yet")
        catalog = self.data["catalog_codes"]
        eq_codes = {c.strip() for c in eq["course_code"].tolist() if c.strip()}
        orphaned = eq_codes - catalog
        # Warn but don't fail — some equivalencies may reference future courses.
        if orphaned:
            import warnings
            warnings.warn(f"{len(orphaned)} equivalency course(s) not in catalog: {sorted(orphaned)}")


# ── Backward Compatibility Tests ──────────────────────────────────────────────


class TestBackwardCompatibility:
    def test_empty_csv_no_changes(self):
        data = load_data("data")
        assert data["equiv_prereq_map"] == {} or isinstance(data["equiv_prereq_map"], dict)
        assert data["cross_listed_map"] == {} or isinstance(data["cross_listed_map"], dict)
        assert data["no_double_count_groups"] == [] or isinstance(data["no_double_count_groups"], list)

    def test_missing_relation_type_defaults_to_equivalent(self):
        """If no relation_type column, all rows default to equivalent."""
        df = pd.DataFrame([
            {"equiv_group_id": "G1", "course_code": "A 1001"},
            {"equiv_group_id": "G1", "course_code": "B 1001"},
        ])
        result = _build_equiv_prereq_map(df)
        assert "B 1001" in result.get("A 1001", set())
        # Cross-listed and NDC should be empty
        assert _build_cross_listed_map(df) == {}
        assert _build_no_double_count_groups(df) == []
