"""
Tests for the publish gate validator (scripts/validate_track.py).

All fixtures are synthetic â€” no real Marquette data is used.
"""

import pytest
import pandas as pd

from validate_track import validate_track, ValidationResult


# â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _tracks(*rows):
    """Build a tracks_df from tuples of (track_id, active)."""
    return pd.DataFrame(rows, columns=["track_id", "track_label", "active"])


def _buckets(*rows):
    """Build a buckets_df. Each row: (track_id, bucket_id, priority, needed_count, role)."""
    cols = ["track_id", "bucket_id", "bucket_label", "priority",
            "needed_count", "needed_credits", "min_level", "allow_double_count", "role"]
    if not rows:
        return pd.DataFrame(columns=cols)
    return pd.DataFrame(
        [
            {
                "track_id": r[0],
                "bucket_id": r[1],
                "bucket_label": r[1],
                "priority": r[2],
                "needed_count": r[3],
                "needed_credits": None,
                "min_level": None,
                "allow_double_count": False,
                "role": r[4],
            }
            for r in rows
        ]
    )


def _mappings(*rows):
    """Build a course_bucket_map_df. Each row: (track_id, course_code, bucket_id)."""
    return pd.DataFrame(rows, columns=["track_id", "course_code", "bucket_id"])


# â”€â”€ Well-formed track (baseline) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@pytest.fixture
def good_track():
    """A fully valid synthetic track with 1 core bucket and 1 elective bucket."""
    tracks = _tracks(("GOOD", "Good Track", True))
    buckets = _buckets(
        ("GOOD", "G_CORE", 1, 2, "core"),
        ("GOOD", "G_ELEC", 2, 1, "elective"),
    )
    mappings = _mappings(
        ("GOOD", "COURSE_A", "G_CORE"),
        ("GOOD", "COURSE_B", "G_CORE"),
        ("GOOD", "COURSE_C", "G_ELEC"),
    )
    catalog = {"COURSE_A", "COURSE_B", "COURSE_C"}
    return tracks, buckets, mappings, catalog


class TestPassingValidation:
    def test_well_formed_track_passes(self, good_track):
        tracks, buckets, mappings, catalog = good_track
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed
        assert result.errors == []

    def test_summary_shows_pass(self, good_track):
        tracks, buckets, mappings, catalog = good_track
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert "[PASS]" in result.summary()
        assert "All checks passed" in result.summary()


# â”€â”€ Track existence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestTrackExists:
    def test_missing_track_fails(self, good_track):
        tracks, buckets, mappings, catalog = good_track
        result = validate_track("MISSING", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("not found in tracks sheet" in e for e in result.errors)

    def test_empty_tracks_df_fails(self, good_track):
        _, buckets, mappings, catalog = good_track
        empty_tracks = pd.DataFrame(columns=["track_id", "track_label", "active"])
        result = validate_track("GOOD", empty_tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("empty" in e.lower() for e in result.errors)

# -- Phase 5 readiness: major/track linkage ----------------------------------

class TestProgramHierarchy:
    def test_track_with_valid_parent_major_passes(self, good_track):
        _, buckets, mappings, catalog = good_track
        tracks = pd.DataFrame([
            {"track_id": "FIN_MAJOR", "track_label": "Finance Major", "active": True, "kind": "major", "parent_major_id": ""},
            {"track_id": "GOOD", "track_label": "Good Concentration", "active": True, "kind": "track", "parent_major_id": "FIN_MAJOR"},
        ])
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed
        assert not any("parent_major_id" in e for e in result.errors)

    def test_track_without_parent_major_warns(self, good_track):
        _, buckets, mappings, catalog = good_track
        tracks = pd.DataFrame([
            {"track_id": "FIN_MAJOR", "track_label": "Finance Major", "active": True, "kind": "major", "parent_major_id": ""},
            {"track_id": "GOOD", "track_label": "Good Concentration", "active": True, "kind": "track", "parent_major_id": ""},
        ])
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed
        assert any("parent_major_id" in w for w in result.warnings)

    def test_track_with_unknown_parent_major_fails(self, good_track):
        _, buckets, mappings, catalog = good_track
        tracks = pd.DataFrame([
            {"track_id": "FIN_MAJOR", "track_label": "Finance Major", "active": True, "kind": "major", "parent_major_id": ""},
            {"track_id": "GOOD", "track_label": "Good Concentration", "active": True, "kind": "track", "parent_major_id": "UNKNOWN_MAJOR"},
        ])
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("parent_major_id" in e for e in result.errors)

    def test_major_with_parent_major_warns(self, good_track):
        tracks, buckets, mappings, catalog = good_track
        tracks = tracks.copy()
        tracks["kind"] = "major"
        tracks["parent_major_id"] = "FIN_MAJOR"
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed
        assert any("will be ignored" in w for w in result.warnings)

# â”€â”€ Bucket existence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestBucketsExist:
    def test_no_buckets_fails(self, good_track):
        tracks, _, mappings, catalog = good_track
        empty_buckets = _buckets()  # No rows
        result = validate_track("GOOD", tracks, empty_buckets, mappings, catalog)
        assert not result.passed
        assert any("No buckets defined" in e for e in result.errors)


# â”€â”€ Role policy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestRolePolicy:
    def test_no_core_role_fails(self, good_track):
        tracks, _, mappings, catalog = good_track
        buckets = _buckets(
            ("GOOD", "G_ELEC1", 1, 2, "elective"),
            ("GOOD", "G_ELEC2", 2, 1, "elective"),
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("role='core'" in e for e in result.errors)

    def test_multiple_core_roles_fails(self, good_track):
        tracks, _, mappings, catalog = good_track
        buckets = _buckets(
            ("GOOD", "G_CORE1", 1, 2, "core"),
            ("GOOD", "G_CORE2", 2, 1, "core"),
            ("GOOD", "G_ELEC", 3, 1, "elective"),
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("exactly 1 core" in e for e in result.errors)

    def test_no_elective_role_warns(self, good_track):
        """Missing elective is a warning, not an error â€” concentrations may not have electives."""
        tracks, _, _, catalog = good_track
        buckets = _buckets(
            ("GOOD", "G_CORE", 1, 2, "core"),
        )
        mappings = _mappings(
            ("GOOD", "COURSE_A", "G_CORE"),
            ("GOOD", "COURSE_B", "G_CORE"),
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed
        assert any("elective" in w for w in result.warnings)

    def test_no_role_column_fails(self, good_track):
        tracks, _, mappings, catalog = good_track
        buckets = pd.DataFrame([
            {"track_id": "GOOD", "bucket_id": "G_CORE", "bucket_label": "Core", "priority": 1},
        ])
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("role" in e.lower() for e in result.errors)


# â”€â”€ Mapping checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestMappings:
    def test_no_mappings_fails(self, good_track):
        tracks, buckets, _, catalog = good_track
        empty_map = _mappings()
        result = validate_track("GOOD", tracks, buckets, empty_map, catalog)
        assert not result.passed
        assert any("No course_bucket mappings" in e for e in result.errors)

    def test_orphan_course_code_fails(self, good_track):
        tracks, buckets, _, catalog = good_track
        mappings = _mappings(
            ("GOOD", "COURSE_A", "G_CORE"),
            ("GOOD", "COURSE_B", "G_CORE"),
            ("GOOD", "GHOST_101", "G_ELEC"),  # not in catalog
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("GHOST_101" in e for e in result.errors)

    def test_orphan_bucket_id_fails(self, good_track):
        tracks, buckets, _, catalog = good_track
        mappings = _mappings(
            ("GOOD", "COURSE_A", "G_CORE"),
            ("GOOD", "COURSE_B", "FAKE_BUCKET"),  # not defined
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert not result.passed
        assert any("FAKE_BUCKET" in e for e in result.errors)


# â”€â”€ Warnings (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestWarnings:
    def test_unmapped_bucket_warns(self, good_track):
        tracks, _, _, catalog = good_track
        buckets = _buckets(
            ("GOOD", "G_CORE", 1, 2, "core"),
            ("GOOD", "G_ELEC", 2, 1, "elective"),
            ("GOOD", "G_EXTRA", 3, 1, ""),  # no mappings
        )
        mappings = _mappings(
            ("GOOD", "COURSE_A", "G_CORE"),
            ("GOOD", "COURSE_B", "G_CORE"),
            ("GOOD", "COURSE_C", "G_ELEC"),
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed  # warnings don't block
        assert any("G_EXTRA" in w and "no course mappings" in w for w in result.warnings)

    def test_unsatisfiable_needed_count_warns(self, good_track):
        tracks, _, _, catalog = good_track
        buckets = _buckets(
            ("GOOD", "G_CORE", 1, 5, "core"),  # needs 5, only 2 mapped
            ("GOOD", "G_ELEC", 2, 1, "elective"),
        )
        mappings = _mappings(
            ("GOOD", "COURSE_A", "G_CORE"),
            ("GOOD", "COURSE_B", "G_CORE"),
            ("GOOD", "COURSE_C", "G_ELEC"),
        )
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.passed
        assert any("needs 5" in w and "only 2" in w for w in result.warnings)

    def test_no_warnings_on_clean_track(self, good_track):
        tracks, buckets, mappings, catalog = good_track
        result = validate_track("GOOD", tracks, buckets, mappings, catalog)
        assert result.warnings == []


# â”€â”€ ValidationResult API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestValidationResult:
    def test_fresh_result_passes(self):
        r = ValidationResult("X")
        assert r.passed

    def test_error_causes_failure(self):
        r = ValidationResult("X")
        r.error("something broke")
        assert not r.passed

    def test_warning_does_not_fail(self):
        r = ValidationResult("X")
        r.warn("minor issue")
        assert r.passed

    def test_summary_contains_fail(self):
        r = ValidationResult("X")
        r.error("bad data")
        assert "[FAIL]" in r.summary()
        assert "bad data" in r.summary()


# â”€â”€ Multi-track isolation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class TestMultiTrackIsolation:
    def test_validation_only_checks_target_track(self):
        """Track B validation should not be affected by Track A's data quality."""
        tracks = _tracks(
            ("TRACK_A", "Track A", True),
            ("TRACK_B", "Track B", True),
        )
        buckets = _buckets(
            # A has no core (error) and no elective (warning)
            ("TRACK_A", "A_MISC", 1, 1, ""),
            # B is well-formed
            ("TRACK_B", "B_CORE", 1, 1, "core"),
            ("TRACK_B", "B_ELEC", 2, 1, "elective"),
        )
        mappings = _mappings(
            ("TRACK_A", "COURSE_A", "A_MISC"),
            ("TRACK_B", "COURSE_B", "B_CORE"),
            ("TRACK_B", "COURSE_C", "B_ELEC"),
        )
        catalog = {"COURSE_A", "COURSE_B", "COURSE_C"}

        result_b = validate_track("TRACK_B", tracks, buckets, mappings, catalog)
        assert result_b.passed

        result_a = validate_track("TRACK_A", tracks, buckets, mappings, catalog)
        assert not result_a.passed  # Missing core role is an error


# ── V3.1 Governance checks ────────────────────────────────────────────────────

def _v2_base(program_id: str = "FIN_MAJOR"):
    """Return minimal V2 data that passes legacy checks so governance tests run cleanly."""
    tracks = pd.DataFrame([{
        "track_id": program_id, "track_label": "Finance", "active": True,
        "kind": "major", "parent_major_id": "",
    }])
    buckets_legacy = pd.DataFrame([{
        "track_id": program_id, "bucket_id": "SB1", "bucket_label": "SB1",
        "priority": 1, "needed_count": 1, "needed_credits": None,
        "min_level": None, "allow_double_count": False, "role": "core",
    }])
    mappings = pd.DataFrame([{
        "track_id": program_id, "course_code": "FINA 3001", "bucket_id": "SB1",
    }])
    catalog = {"FINA 3001"}
    programs = pd.DataFrame([{
        "program_id": program_id, "program_label": "Finance",
        "kind": "major", "parent_major_id": "", "active": True,
    }])
    v2_buckets = pd.DataFrame([{
        "program_id": program_id, "bucket_id": "FIN_REQ",
        "bucket_label": "Finance Req", "priority": 1, "track_required": "", "active": True,
    }])
    v2_sub_buckets = pd.DataFrame([{
        "program_id": program_id, "bucket_id": "FIN_REQ",
        "sub_bucket_id": "SB1", "sub_bucket_label": "SB1",
        "courses_required": 1, "credits_required": None,
        "priority": 1, "role": "core",
    }])
    return tracks, buckets_legacy, mappings, catalog, programs, v2_buckets, v2_sub_buckets


def _run_v2(program_id, v2_sub_buckets=None, policy_df=None, equiv_df=None):
    """Run validate_track with V2 mode enabled for governance check testing."""
    tracks, buckets_legacy, mappings, catalog, programs, v2_buckets, default_sub = _v2_base(program_id)
    if v2_sub_buckets is None:
        v2_sub_buckets = default_sub
    return validate_track(
        program_id, tracks, buckets_legacy, mappings, catalog,
        v2_programs_df=programs,
        v2_buckets_df=v2_buckets,
        v2_sub_buckets_df=v2_sub_buckets,
        v2_double_count_policy_df=policy_df,
        v2_equivalencies_df=equiv_df,
        strict_single_core=False,
    )


class TestV2SubBucketNullRequirements:
    """Governance check 2: both courses_required and credits_required null => error."""

    def test_null_both_requirements_is_error(self):
        v2_sub = pd.DataFrame([{
            "program_id": "FIN_MAJOR", "bucket_id": "FIN_REQ",
            "sub_bucket_id": "SB1", "sub_bucket_label": "SB1",
            "courses_required": None, "credits_required": None,
            "priority": 1, "role": "core",
        }])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert not result.passed
        assert any("SB1" in e and "null" in e for e in result.errors)

    def test_courses_required_set_passes(self):
        v2_sub = pd.DataFrame([{
            "program_id": "FIN_MAJOR", "bucket_id": "FIN_REQ",
            "sub_bucket_id": "SB1", "sub_bucket_label": "SB1",
            "courses_required": 3, "credits_required": None,
            "priority": 1, "role": "core",
        }])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert not any("null" in e for e in result.errors)

    def test_credits_required_set_passes(self):
        v2_sub = pd.DataFrame([{
            "program_id": "FIN_MAJOR", "bucket_id": "FIN_REQ",
            "sub_bucket_id": "SB1", "sub_bucket_label": "SB1",
            "courses_required": None, "credits_required": 9,
            "priority": 1, "role": "core",
        }])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert not any("null" in e for e in result.errors)

    def test_multiple_sub_buckets_all_null_each_error(self):
        v2_sub = pd.DataFrame([
            {"program_id": "FIN_MAJOR", "bucket_id": "FIN_REQ", "sub_bucket_id": "SB1",
             "sub_bucket_label": "SB1", "courses_required": None, "credits_required": None,
             "priority": 1, "role": "core"},
            {"program_id": "FIN_MAJOR", "bucket_id": "FIN_REQ", "sub_bucket_id": "SB2",
             "sub_bucket_label": "SB2", "courses_required": None, "credits_required": None,
             "priority": 2, "role": "elective"},
        ])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        # Both buckets should appear in errors
        assert any("SB1" in e for e in result.errors)
        assert any("SB2" in e for e in result.errors)

    def test_no_sub_buckets_for_program_skips_check(self):
        empty_sub = pd.DataFrame(columns=[
            "program_id", "bucket_id", "sub_bucket_id", "sub_bucket_label",
            "courses_required", "credits_required", "priority", "role",
        ])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=empty_sub)
        assert not any("null" in e for e in result.errors)


class TestV2PolicyDuplicatePairs:
    """Governance check 4: duplicate canonical policy pairs => warning."""

    def _policy(self, rows):
        return pd.DataFrame(rows)

    def test_duplicate_pair_warns(self):
        policy = self._policy([
            {"program_id": "FIN_MAJOR", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "B", "allow_double_count": True},
            {"program_id": "FIN_MAJOR", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "B", "allow_double_count": False},
        ])
        result = _run_v2("FIN_MAJOR", policy_df=policy)
        assert any("duplicate" in w.lower() for w in result.warnings)

    def test_canonical_order_duplicate_warns(self):
        """(A, B) and (B, A) are the same canonical pair and should warn."""
        policy = self._policy([
            {"program_id": "FIN_MAJOR", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "B", "allow_double_count": True},
            {"program_id": "FIN_MAJOR", "node_type_a": "sub_bucket", "node_id_a": "B",
             "node_type_b": "sub_bucket", "node_id_b": "A", "allow_double_count": True},
        ])
        result = _run_v2("FIN_MAJOR", policy_df=policy)
        assert any("duplicate" in w.lower() for w in result.warnings)

    def test_no_duplicates_is_clean(self):
        policy = self._policy([
            {"program_id": "FIN_MAJOR", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "B", "allow_double_count": True},
            {"program_id": "FIN_MAJOR", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "C", "allow_double_count": False},
        ])
        result = _run_v2("FIN_MAJOR", policy_df=policy)
        assert not any("duplicate" in w.lower() for w in result.warnings)

    def test_empty_policy_skips(self):
        result = _run_v2("FIN_MAJOR", policy_df=pd.DataFrame())
        assert not any("duplicate" in w.lower() for w in result.warnings)

    def test_different_program_rows_not_flagged(self):
        """Duplicates in a different program do not affect the target program."""
        policy = self._policy([
            {"program_id": "OTHER", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "B", "allow_double_count": True},
            {"program_id": "OTHER", "node_type_a": "sub_bucket", "node_id_a": "A",
             "node_type_b": "sub_bucket", "node_id_b": "B", "allow_double_count": False},
        ])
        result = _run_v2("FIN_MAJOR", policy_df=policy)
        assert not any("duplicate" in w.lower() for w in result.warnings)


class TestV2EquivalencyScopeIntegrity:
    """Governance check 5: scope_program_id in course_equivalencies must reference valid programs."""

    def _equiv(self, rows):
        return pd.DataFrame(rows)

    def test_no_scope_column_skips(self):
        equiv = self._equiv([
            {"equiv_group_id": "EQ1", "course_code": "FINA 3001", "label": ""},
        ])
        result = _run_v2("FIN_MAJOR", equiv_df=equiv)
        assert not any("scope" in e.lower() for e in result.errors)

    def test_valid_scope_program_passes(self):
        equiv = self._equiv([
            {"equiv_group_id": "EQ1", "course_code": "FINA 3001",
             "label": "", "scope_program_id": "FIN_MAJOR"},
        ])
        result = _run_v2("FIN_MAJOR", equiv_df=equiv)
        assert not any("scope_program_id" in e for e in result.errors)

    def test_invalid_scope_program_errors(self):
        equiv = self._equiv([
            {"equiv_group_id": "EQ1", "course_code": "FINA 3001",
             "label": "", "scope_program_id": "UNKNOWN_PROG"},
        ])
        result = _run_v2("FIN_MAJOR", equiv_df=equiv)
        assert not result.passed
        assert any("UNKNOWN_PROG" in e for e in result.errors)

    def test_empty_scope_program_id_skips(self):
        """Rows with empty scope_program_id are global and should not be validated."""
        equiv = self._equiv([
            {"equiv_group_id": "EQ1", "course_code": "FINA 3001",
             "label": "", "scope_program_id": ""},
        ])
        result = _run_v2("FIN_MAJOR", equiv_df=equiv)
        assert not any("scope_program_id" in e for e in result.errors)

    def test_null_scope_treated_as_global(self):
        equiv = self._equiv([
            {"equiv_group_id": "EQ1", "course_code": "FINA 3001",
             "label": "", "scope_program_id": None},
        ])
        result = _run_v2("FIN_MAJOR", equiv_df=equiv)
        assert not any("scope_program_id" in e for e in result.errors)

    def test_mixed_valid_and_invalid_scopes_errors(self):
        equiv = self._equiv([
            {"equiv_group_id": "EQ1", "course_code": "FINA 3001",
             "label": "", "scope_program_id": "FIN_MAJOR"},
            {"equiv_group_id": "EQ2", "course_code": "FINA 4001",
             "label": "", "scope_program_id": "BAD_PROG"},
        ])
        result = _run_v2("FIN_MAJOR", equiv_df=equiv)
        assert not result.passed
        assert any("BAD_PROG" in e for e in result.errors)


class TestV2SubBucketCoursesRequiredSatisfiable:
    """V3.1 governance: warn when courses_required > mapped course count."""

    def _sub_bucket(self, sbid, courses_required, bucket_id="FIN_REQ"):
        return {
            "program_id": "FIN_MAJOR", "bucket_id": bucket_id,
            "sub_bucket_id": sbid, "sub_bucket_label": sbid,
            "courses_required": courses_required, "credits_required": None,
            "priority": 1, "role": "core",
        }

    def test_satisfied_sub_bucket_no_warn(self):
        """Enough courses mapped — no warning."""
        v2_sub = pd.DataFrame([self._sub_bucket("SB1", 1)])
        # _v2_base maps one course to SB1 by default (bucket_id == sub_bucket_id in runtime map)
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert not any("SB1" in w and "requires" in w for w in result.warnings)

    def test_undersupplied_sub_bucket_warns(self):
        """courses_required exceeds mapped count — expect warning."""
        v2_sub = pd.DataFrame([self._sub_bucket("SB1", 5)])
        # Only 1 course mapped to SB1 in _v2_base
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert any("SB1" in w and "requires" in w for w in result.warnings)

    def test_credits_only_sub_bucket_skipped(self):
        """Sub-buckets with no courses_required are not checked."""
        v2_sub = pd.DataFrame([{
            "program_id": "FIN_MAJOR", "bucket_id": "FIN_REQ",
            "sub_bucket_id": "SB1", "sub_bucket_label": "SB1",
            "courses_required": None, "credits_required": 9,
            "priority": 1, "role": "core",
        }])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert not any("SB1" in w and "requires" in w for w in result.warnings)

    def test_zero_courses_required_skipped(self):
        """courses_required=0 is not a real requirement — no warning."""
        v2_sub = pd.DataFrame([self._sub_bucket("SB1", 0)])
        result = _run_v2("FIN_MAJOR", v2_sub_buckets=v2_sub)
        assert not any("SB1" in w and "requires" in w for w in result.warnings)
