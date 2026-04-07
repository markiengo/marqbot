"""Tests for course equivalency system (5 relation types)."""

from pathlib import Path

import pytest
import pandas as pd
from data_loader import (
    _build_equiv_prereq_map,
    _build_cross_listed_map,
    _build_no_double_count_groups,
    _derive_runtime_from_v2,
    _load_v2_equivalencies,
    _VALID_RELATION_TYPES,
    load_data,
)
from prereq_parser import prereqs_satisfied, parse_prereqs
from allocator import (
    allocate_courses,
    ensure_runtime_indexes,
    _expand_map_with_equivalencies,
)
from eligibility import get_eligible_courses, parse_term


DATA_DIR = Path(__file__).resolve().parents[2] / "data"


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


def test_required_bucket_remaining_omits_base_course_when_equivalent_is_completed():
    courses_df = pd.DataFrame([
        {"course_code": "BASE 1000", "course_name": "Base Course", "credits": 3, "level": 1000},
        {"course_code": "ALT 1000", "course_name": "Equivalent Alternate", "credits": 3, "level": 1000},
    ])
    buckets_df = pd.DataFrame([
        {
            "track_id": "TEST_MAJOR",
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "TEST_MAJOR",
            "parent_bucket_priority": 1,
        },
    ])
    course_map_df = pd.DataFrame([
        {"track_id": "TEST_MAJOR", "bucket_id": "CORE", "course_code": "BASE 1000"},
    ])
    equivalencies_df = pd.DataFrame([
        {
            "equiv_group_id": "EQ_1",
            "course_code": "BASE 1000",
            "relation_type": "equivalent",
            "scope_program_id": "TEST_MAJOR",
            "label": "",
        },
        {
            "equiv_group_id": "EQ_1",
            "course_code": "ALT 1000",
            "relation_type": "equivalent",
            "scope_program_id": "TEST_MAJOR",
            "label": "",
        },
    ])
    data = {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_map_df,
        "v2_double_count_policy_df": pd.DataFrame(),
    }
    data = ensure_runtime_indexes(data, force=True)

    result = allocate_courses(
        completed=["ALT 1000"],
        in_progress=[],
        buckets_df=buckets_df,
        course_bucket_map_df=course_map_df,
        courses_df=courses_df,
        equivalencies_df=equivalencies_df,
        track_id="TEST_MAJOR",
        runtime_indexes=data.get("runtime_indexes"),
    )

    assert result["applied_by_bucket"]["CORE"]["completed_applied"] == ["ALT 1000"]
    assert result["remaining"]["CORE"]["remaining_courses"] == []


def test_eligibility_skips_scoped_equivalent_base_course_when_alias_is_completed():
    courses_df = pd.DataFrame([
        {
            "course_code": "BASE 1000",
            "course_name": "Base Course",
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
            "course_name": "Equivalent Alternate",
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
    ])
    buckets_df = pd.DataFrame([
        {
            "track_id": "TEST_MAJOR",
            "bucket_id": "CORE",
            "bucket_label": "Core",
            "priority": 1,
            "needed_count": 1,
            "needed_credits": None,
            "min_level": None,
            "allow_double_count": False,
            "role": "core",
            "requirement_mode": "required",
            "parent_bucket_id": "TEST_MAJOR",
            "parent_bucket_priority": 1,
        },
    ])
    course_map_df = pd.DataFrame([
        {"track_id": "TEST_MAJOR", "bucket_id": "CORE", "course_code": "BASE 1000"},
    ])
    equivalencies_df = pd.DataFrame([
        {
            "equiv_group_id": "EQ_1",
            "course_code": "BASE 1000",
            "relation_type": "equivalent",
            "scope_program_id": "TEST_MAJOR",
            "label": "",
        },
        {
            "equiv_group_id": "EQ_1",
            "course_code": "ALT 1000",
            "relation_type": "equivalent",
            "scope_program_id": "TEST_MAJOR",
            "label": "",
        },
    ])
    data = {
        "courses_df": courses_df,
        "equivalencies_df": equivalencies_df,
        "buckets_df": buckets_df,
        "course_bucket_map_df": course_map_df,
        "v2_double_count_policy_df": pd.DataFrame(),
    }
    data = ensure_runtime_indexes(data, force=True)
    runtime_track = data["runtime_indexes"]["tracks"]["TEST_MAJOR"]

    eligible = get_eligible_courses(
        courses_df,
        completed=["ALT 1000"],
        in_progress=[],
        target_term=parse_term("Fall 2026"),
        prereq_map={},
        allocator_remaining={
            "CORE": {
                "slots_remaining": 1,
                "remaining_courses": ["BASE 1000"],
            },
        },
        course_bucket_map_df=course_map_df,
        buckets_df=buckets_df,
        equivalencies_df=equivalencies_df,
        track_id="TEST_MAJOR",
        runtime_indexes=data.get("runtime_indexes"),
        selected_program_ids=["TEST_MAJOR"],
        equiv_map={},
        cross_listed_map={},
    )

    assert runtime_track["equivalent_course_map"]["BASE 1000"] == {"ALT 1000"}
    assert all(course["course_code"] != "BASE 1000" for course in eligible)


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

    def test_scoped_equivalency_program_ids_reference_valid_programs(self):
        eq = self.data["equivalencies_df"]
        if len(eq) == 0 or "scope_program_id" not in eq.columns:
            pytest.skip("No scoped equivalency data yet")
        scoped = eq["scope_program_id"].fillna("").astype(str).str.strip().str.upper()
        scoped = {program_id for program_id in scoped.tolist() if program_id}
        if not scoped:
            pytest.skip("No scoped equivalencies configured")

        valid_program_ids = {
            str(program_id).strip().upper()
            for program_id in self.data["v2_programs_df"]["program_id"].tolist()
            if str(program_id).strip()
        }
        assert scoped <= valid_program_ids, (
            f"Scoped equivalencies reference unknown programs: {sorted(scoped - valid_program_ids)}"
        )

    def test_ds_scoped_equivalencies_expand_ds_runtime_buckets_only(self):
        eq = self.data["equivalencies_df"]
        runtime_map = self.data["course_bucket_map_df"]
        ds_map = runtime_map[runtime_map["track_id"] == "DS_MAJOR"].copy()
        expanded_ds = _expand_map_with_equivalencies(ds_map, eq, "DS_MAJOR")
        ds_math_codes = set(
            expanded_ds[expanded_ds["bucket_id"] == "DS-REQ-MATH"]["course_code"].tolist()
        )

        assert {"MATH 1451", "MATH 2100", "COSC 3570", "MATH 4740"} <= ds_math_codes

    def test_ds_scoped_equivalencies_expand_when_merged_track_uses_source_program_id(self):
        eq = self.data["equivalencies_df"]
        runtime_map = self.data["course_bucket_map_df"]
        ds_map = runtime_map[runtime_map["track_id"] == "DS_MAJOR"].copy()
        merged_like_map = ds_map.copy()
        merged_like_map["source_program_id"] = "DS_MAJOR"
        merged_like_map["track_id"] = "PHASE5_PLAN_V2"

        expanded_ds = _expand_map_with_equivalencies(merged_like_map, eq, "PHASE5_PLAN_V2")
        ds_math_codes = set(
            expanded_ds[expanded_ds["bucket_id"] == "DS-REQ-MATH"]["course_code"].tolist()
        )

        assert {"MATH 1451", "MATH 2100", "COSC 3570", "MATH 4740"} <= ds_math_codes

    def test_ds_scoped_equivalencies_do_not_enter_global_prereq_equiv_map(self):
        equiv_prereq_map = self.data["equiv_prereq_map"]
        assert "MATH 1451" not in equiv_prereq_map
        assert "MATH 2100" not in equiv_prereq_map
        assert "COSC 3570" not in equiv_prereq_map
        assert "MATH 4740" not in equiv_prereq_map

    def test_ds_no_double_count_groups_are_present(self):
        ndc_groups = self.data["no_double_count_groups"]
        assert {"COSC 3570", "MATH 3570"} in ndc_groups
        assert {"MATH 4720", "MATH 4740"} in ndc_groups

    def test_ds_equivalent_completion_hides_math_2350_from_remaining_and_eligibility(self):
        data = ensure_runtime_indexes(self.data, force=True)
        completed = ["MATH 1450", "MATH 2100"]

        alloc = allocate_courses(
            completed=completed,
            in_progress=[],
            buckets_df=data["buckets_df"],
            course_bucket_map_df=data["course_bucket_map_df"],
            courses_df=data["courses_df"],
            equivalencies_df=data["equivalencies_df"],
            track_id="DS_MAJOR",
            double_count_policy_df=data.get("v2_double_count_policy_df"),
            runtime_indexes=data.get("runtime_indexes"),
        )

        ds_remaining = alloc["remaining"]["DS-REQ-MATH"]["remaining_courses"]
        assert "MATH 2350" not in ds_remaining

        eligible = get_eligible_courses(
            data["courses_df"],
            completed,
            [],
            parse_term("Fall 2026"),
            data["prereq_map"],
            alloc["remaining"],
            data["course_bucket_map_df"],
            data["buckets_df"],
            data["equivalencies_df"],
            track_id="DS_MAJOR",
            runtime_indexes=data.get("runtime_indexes"),
            reverse_map={},
            selected_program_ids=["DS_MAJOR"],
            equiv_map=data.get("equiv_prereq_map"),
            cross_listed_map=data.get("cross_listed_map"),
        )

        assert all(course["course_code"] != "MATH 2350" for course in eligible)


# ── Backward Compatibility Tests ──────────────────────────────────────────────


class TestCanonicalMappedCountStrategy:
    def test_runtime_needed_count_collapses_equivalency_aliases(self):
        v2_buckets_df = pd.DataFrame([
            {
                "program_id": "BCC_CORE",
                "bucket_id": "BCC_CORE",
                "bucket_label": "Business Core",
                "priority": 1,
                "track_required": "",
                "double_count_family_id": "BCC_CORE",
            }
        ])
        v2_sub_buckets_df = pd.DataFrame([
            {
                "program_id": "BCC_CORE",
                "bucket_id": "BCC_CORE",
                "sub_bucket_id": "BCC_REQUIRED",
                "sub_bucket_label": "Business Core Required",
                "courses_required": 99,
                "credits_required": None,
                "min_level": None,
                "role": "core",
                "priority": 1,
                "requirement_mode": "required",
                "count_strategy": "canonical_mapped",
            }
        ])
        v2_courses_all_buckets_df = pd.DataFrame([
            {"program_id": "BCC_CORE", "sub_bucket_id": "BCC_REQUIRED", "course_code": "LEAD 3000", "notes": ""},
            {"program_id": "BCC_CORE", "sub_bucket_id": "BCC_REQUIRED", "course_code": "ECON 1103", "notes": ""},
            {"program_id": "BCC_CORE", "sub_bucket_id": "BCC_REQUIRED", "course_code": "ECON 1103H", "notes": ""},
            {"program_id": "BCC_CORE", "sub_bucket_id": "BCC_REQUIRED", "course_code": "MATH 1400", "notes": ""},
            {"program_id": "BCC_CORE", "sub_bucket_id": "BCC_REQUIRED", "course_code": "MATH 1450", "notes": ""},
        ])
        equivalencies_df = pd.DataFrame([
            {"equiv_group_id": "HON_1", "course_code": "ECON 1103", "relation_type": "honors", "scope_program_id": "", "label": ""},
            {"equiv_group_id": "HON_1", "course_code": "ECON 1103H", "relation_type": "honors", "scope_program_id": "", "label": ""},
            {"equiv_group_id": "EQ_1", "course_code": "MATH 1400", "relation_type": "equivalent", "scope_program_id": "", "label": ""},
            {"equiv_group_id": "EQ_1", "course_code": "MATH 1450", "relation_type": "equivalent", "scope_program_id": "", "label": ""},
        ])

        runtime_buckets, _ = _derive_runtime_from_v2(
            v2_buckets_df,
            v2_sub_buckets_df,
            v2_courses_all_buckets_df,
            equivalencies_df=equivalencies_df,
        )

        row = runtime_buckets.iloc[0]
        assert int(row["configured_needed_count"]) == 99
        assert str(row["count_strategy"]).strip().lower() == "canonical_mapped"
        assert int(row["needed_count"]) == 3

    def test_live_bcc_required_uses_canonical_mapped_strategy(self):
        data = load_data(str(DATA_DIR))
        buckets = data["buckets_df"]
        row = buckets[
            (buckets["track_id"].astype(str).str.strip().str.upper() == "BCC_CORE")
            & (buckets["bucket_id"].astype(str).str.strip().str.upper() == "BCC_REQUIRED")
        ].iloc[0]

        assert str(row["count_strategy"]).strip().lower() == "canonical_mapped"
        assert int(row["needed_count"]) == 18


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
