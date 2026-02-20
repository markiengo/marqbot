"""
Tests for transitive prereq consistency validation.

Covers find_inconsistent_completed_courses() and its helper
_get_all_required_prereqs() using synthetic prereq_maps — no Flask app
or Excel file needed.
"""

import sys
import os
import pytest

# conftest.py already adds backend/ to sys.path
from validators import (
    find_inconsistent_completed_courses,
    expand_completed_with_prereqs,
    expand_completed_with_prereqs_with_provenance,
    expand_in_progress_with_prereqs,
    _get_all_required_prereqs,
)


# ── Helper: build synthetic prereq_map ────────────────────────────────────────

def _pmap(*pairs):
    """
    Build a prereq_map from (course, prereq_or_list) pairs.
    prereq_or_list:
      - None or "none"        → {"type": "none"}
      - "CODE"                → {"type": "single", "course": "CODE"}
      - ["A", "B"] (and)      → {"type": "and", "courses": [...]}
      - ("A", "B") (or)       → {"type": "or", "courses": [...]}
    """
    m = {}
    for course, prereq in pairs:
        if prereq is None or prereq == "none":
            m[course] = {"type": "none"}
        elif isinstance(prereq, str):
            m[course] = {"type": "single", "course": prereq}
        elif isinstance(prereq, list):
            m[course] = {"type": "and", "courses": prereq}
        elif isinstance(prereq, tuple):
            m[course] = {"type": "or", "courses": list(prereq)}
    return m


# ── _get_all_required_prereqs ──────────────────────────────────────────────────

class TestGetAllRequiredPrereqs:
    def test_no_prereqs(self):
        m = _pmap(("FINA 3001", None))
        assert _get_all_required_prereqs("FINA 3001", m) == set()

    def test_single_direct(self):
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        assert _get_all_required_prereqs("FINA 3001", m) == {"ACCO 1031"}

    def test_two_level_chain(self):
        # MATH 1200 → MATH 1400 → MATH 1450
        m = _pmap(
            ("MATH 1450", "MATH 1400"),
            ("MATH 1400", "MATH 1200"),
            ("MATH 1200", None),
        )
        assert _get_all_required_prereqs("MATH 1450", m) == {"MATH 1400", "MATH 1200"}

    def test_three_level_chain(self):
        m = _pmap(
            ("D", "C"),
            ("C", "B"),
            ("B", "A"),
            ("A", None),
        )
        assert _get_all_required_prereqs("D", m) == {"C", "B", "A"}

    def test_and_prereqs_all_included(self):
        m = _pmap(
            ("FINA 4001", ["FINA 3001", "ECON 1103"]),
            ("FINA 3001", None),
            ("ECON 1103", None),
        )
        assert _get_all_required_prereqs("FINA 4001", m) == {"FINA 3001", "ECON 1103"}

    def test_or_prereqs_not_traversed(self):
        """OR branches are ambiguous — neither side should be flagged."""
        m = _pmap(
            ("FINA 4001", ("FINA 3001", "ECON 1103")),
            ("FINA 3001", None),
        )
        assert _get_all_required_prereqs("FINA 4001", m) == set()

    def test_cycle_does_not_hang(self):
        """A → B → A cycle must terminate cleanly."""
        m = {"A": {"type": "single", "course": "B"}, "B": {"type": "single", "course": "A"}}
        result = _get_all_required_prereqs("A", m)
        # Result will include B (direct), and the cycle is broken by visited set
        assert isinstance(result, set)

    def test_unsupported_prereq_stops(self):
        m = {"FINA 4999": {"type": "unsupported", "raw": "instructor permission"}}
        assert _get_all_required_prereqs("FINA 4999", m) == set()

    def test_course_not_in_map(self):
        """Unknown course → treated as no prereqs."""
        assert _get_all_required_prereqs("ZZZZ 9999", {}) == set()


# ── find_inconsistent_completed_courses ───────────────────────────────────────

class TestFindInconsistentCompletedCourses:
    def test_direct_prereq_in_progress_flagged(self):
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        result = find_inconsistent_completed_courses(["FINA 3001"], ["ACCO 1031"], m)
        assert len(result) == 1
        assert result[0]["course_code"] == "FINA 3001"
        assert "ACCO 1031" in result[0]["prereqs_in_progress"]

    def test_two_level_chain_indirect_flagged(self):
        # MATH 1200 → MATH 1400 → MATH 1450
        # completed=MATH 1450, in_progress=MATH 1200 → should flag even though indirect
        m = _pmap(
            ("MATH 1450", "MATH 1400"),
            ("MATH 1400", "MATH 1200"),
            ("MATH 1200", None),
        )
        result = find_inconsistent_completed_courses(["MATH 1450"], ["MATH 1200"], m)
        assert len(result) == 1
        assert result[0]["course_code"] == "MATH 1450"
        assert "MATH 1200" in result[0]["prereqs_in_progress"]

    def test_three_level_chain_flagged(self):
        m = _pmap(("D", "C"), ("C", "B"), ("B", "A"), ("A", None))
        result = find_inconsistent_completed_courses(["D"], ["A"], m)
        assert len(result) == 1
        assert "A" in result[0]["prereqs_in_progress"]

    def test_prereq_in_completed_not_flagged(self):
        """Both courses completed — no contradiction."""
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        result = find_inconsistent_completed_courses(
            ["FINA 3001", "ACCO 1031"], [], m
        )
        assert result == []

    def test_prereq_absent_from_both_not_flagged(self):
        """Prereq not listed anywhere — user may have taken it prior; no contradiction."""
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        result = find_inconsistent_completed_courses(["FINA 3001"], [], m)
        assert result == []

    def test_no_prereq_course_not_flagged(self):
        m = _pmap(("FINA 3001", None))
        result = find_inconsistent_completed_courses(["FINA 3001"], ["ACCO 1031"], m)
        assert result == []

    def test_or_prereq_not_flagged(self):
        """OR prereqs are ambiguous — must not generate false positives."""
        m = _pmap(("FINA 4001", ("FINA 3001", "ECON 1103")), ("FINA 3001", None))
        result = find_inconsistent_completed_courses(
            ["FINA 4001"], ["FINA 3001", "ECON 1103"], m
        )
        assert result == []

    def test_multiple_completed_multiple_issues(self):
        m = _pmap(
            ("A", "X"),
            ("B", "Y"),
            ("X", None),
            ("Y", None),
        )
        result = find_inconsistent_completed_courses(["A", "B"], ["X", "Y"], m)
        codes = {r["course_code"] for r in result}
        assert "A" in codes
        assert "B" in codes

    def test_empty_inputs_no_error(self):
        assert find_inconsistent_completed_courses([], [], {}) == []
        assert find_inconsistent_completed_courses(["FINA 3001"], [], {}) == []
        assert find_inconsistent_completed_courses([], ["ACCO 1031"], {}) == []

    def test_prereqs_in_progress_sorted(self):
        """prereqs_in_progress list should be sorted for deterministic output."""
        m = _pmap(("X", ["C", "A", "B"]), ("A", None), ("B", None), ("C", None))
        result = find_inconsistent_completed_courses(["X"], ["A", "B", "C"], m)
        assert result[0]["prereqs_in_progress"] == ["A", "B", "C"]


# ── expand_completed_with_prereqs ─────────────────────────────────────────────

class TestExpandCompletedWithPrereqs:
    def test_direct_prereq_inferred(self):
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        result = expand_completed_with_prereqs(["FINA 3001"], m)
        assert "ACCO 1031" in result
        assert "FINA 3001" in result

    def test_two_level_chain_all_inferred(self):
        # MATH 1200 → MATH 1400 → MATH 1450
        m = _pmap(
            ("MATH 1450", "MATH 1400"),
            ("MATH 1400", "MATH 1200"),
            ("MATH 1200", None),
        )
        result = expand_completed_with_prereqs(["MATH 1450"], m)
        assert set(result) == {"MATH 1450", "MATH 1400", "MATH 1200"}

    def test_original_completed_preserved(self):
        m = _pmap(("A", "B"), ("B", None))
        result = expand_completed_with_prereqs(["A", "OTHER"], m)
        assert "OTHER" in result
        assert "A" in result
        assert "B" in result

    def test_no_prereqs_unchanged(self):
        m = _pmap(("FINA 3001", None))
        result = expand_completed_with_prereqs(["FINA 3001"], m)
        assert set(result) == {"FINA 3001"}

    def test_or_prereq_not_inferred(self):
        """OR branches are ambiguous — neither should be added."""
        m = _pmap(("FINA 4001", ("FINA 3001", "ECON 1103")))
        result = expand_completed_with_prereqs(["FINA 4001"], m)
        assert "FINA 3001" not in result
        assert "ECON 1103" not in result

    def test_empty_completed(self):
        assert expand_completed_with_prereqs([], {}) == []

    def test_already_listed_prereq_not_duplicated(self):
        """If ACCO 1031 is already in completed, it shouldn't appear twice."""
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        result = expand_completed_with_prereqs(["FINA 3001", "ACCO 1031"], m)
        assert result.count("ACCO 1031") == 1

    def test_cycle_does_not_hang(self):
        m = {"A": {"type": "single", "course": "B"}, "B": {"type": "single", "course": "A"}}
        result = expand_completed_with_prereqs(["A"], m)
        assert isinstance(result, list)


class TestExpandCompletedWithProvenance:
    def test_completed_provenance_direct(self):
        m = _pmap(("FINA 3001", "ACCO 1031"), ("ACCO 1031", None))
        expanded, rows = expand_completed_with_prereqs_with_provenance(["FINA 3001"], m)
        assert expanded == ["FINA 3001", "ACCO 1031"]
        assert rows == [{
            "source_completed": "FINA 3001",
            "assumed_prereqs": ["ACCO 1031"],
            "already_completed_prereqs": [],
        }]

    def test_completed_provenance_with_already_completed(self):
        m = _pmap(("FINA 3001", ["ACCO 1031", "ECON 1103"]))
        expanded, rows = expand_completed_with_prereqs_with_provenance(
            ["FINA 3001", "ECON 1103"],
            m,
        )
        assert expanded == ["FINA 3001", "ECON 1103", "ACCO 1031"]
        assert rows == [{
            "source_completed": "FINA 3001",
            "assumed_prereqs": ["ACCO 1031"],
            "already_completed_prereqs": ["ECON 1103"],
        }]

    def test_completed_provenance_or_not_inferred(self):
        m = _pmap(("FINA 4001", ("FINA 3001", "ECON 1103")))
        expanded, rows = expand_completed_with_prereqs_with_provenance(["FINA 4001"], m)
        assert expanded == ["FINA 4001"]
        assert rows == []


class TestExpandInProgressWithPrereqs:
    def test_direct_prereq_inferred(self):
        m = _pmap(("ACCO 1031", "ACCO 1030"), ("ACCO 1030", None))
        expanded, rows = expand_in_progress_with_prereqs(["ACCO 1031"], [], m)
        assert expanded == ["ACCO 1031", "ACCO 1030"]
        assert rows == [{
            "source_in_progress": "ACCO 1031",
            "assumed_prereqs": ["ACCO 1030"],
            "already_completed_prereqs": [],
        }]

    def test_transitive_chain_inferred(self):
        m = _pmap(("D", "C"), ("C", "B"), ("B", "A"), ("A", None))
        expanded, rows = expand_in_progress_with_prereqs(["D"], [], m)
        assert expanded == ["D", "A", "B", "C"]
        assert rows == [{
            "source_in_progress": "D",
            "assumed_prereqs": ["A", "B", "C"],
            "already_completed_prereqs": [],
        }]

    def test_or_prereqs_not_inferred(self):
        m = _pmap(("FINA 4001", ("FINA 3001", "ECON 1103")))
        expanded, rows = expand_in_progress_with_prereqs(["FINA 4001"], [], m)
        assert expanded == ["FINA 4001"]
        assert rows == []

    def test_no_duplicates_against_completed_or_in_progress(self):
        m = _pmap(("ACCO 1031", "ACCO 1030"), ("ACCO 1030", None))
        expanded, rows = expand_in_progress_with_prereqs(
            ["ACCO 1031", "ACCO 1030"],
            ["ACCO 1030"],
            m,
        )
        assert expanded == ["ACCO 1031", "ACCO 1030"]
        assert rows == []

    def test_deterministic_ordering(self):
        m = _pmap(
            ("X", ["C", "A"]),
            ("Y", "B"),
            ("A", None),
            ("B", None),
            ("C", None),
        )
        expanded, rows = expand_in_progress_with_prereqs(["Y", "X"], [], m)
        assert expanded == ["Y", "X", "A", "B", "C"]
        assert rows[0]["source_in_progress"] == "Y"
        assert rows[1]["source_in_progress"] == "X"

    def test_provenance_payload_shape(self):
        m = _pmap(("X", ["A", "B"]), ("A", None), ("B", None))
        expanded, rows = expand_in_progress_with_prereqs(["X"], ["A"], m)
        assert expanded == ["X", "B"]
        assert len(rows) == 1
        row = rows[0]
        assert sorted(row.keys()) == [
            "already_completed_prereqs",
            "assumed_prereqs",
            "source_in_progress",
        ]
        assert row["source_in_progress"] == "X"
        assert row["assumed_prereqs"] == ["B"]
        assert row["already_completed_prereqs"] == ["A"]
