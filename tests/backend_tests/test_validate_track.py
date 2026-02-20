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
