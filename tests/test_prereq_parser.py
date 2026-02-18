import pytest
from prereq_parser import parse_prereqs, prereqs_satisfied, build_prereq_check_string


class TestParsePrereqs:
    def test_none(self):
        assert parse_prereqs("none") == {"type": "none"}

    def test_none_listed(self):
        assert parse_prereqs("None listed") == {"type": "none"}

    def test_nan(self):
        import math
        assert parse_prereqs(float("nan")) == {"type": "none"}

    def test_null(self):
        assert parse_prereqs(None) == {"type": "none"}

    def test_single(self):
        result = parse_prereqs("FINA 3001")
        assert result == {"type": "single", "course": "FINA 3001"}

    def test_single_normalized(self):
        result = parse_prereqs("fina3001")
        assert result["type"] == "single"
        assert result["course"] == "FINA 3001"

    def test_and(self):
        result = parse_prereqs("ECON 1103; BUAD 1560")
        assert result["type"] == "and"
        assert "ECON 1103" in result["courses"]
        assert "BUAD 1560" in result["courses"]

    def test_and_three(self):
        result = parse_prereqs("FINA 3001; FINA 4001; FINA 4011")
        assert result["type"] == "and"
        assert len(result["courses"]) == 3

    def test_or(self):
        result = parse_prereqs("FINA 4001 or FINA 5001")
        assert result["type"] == "or"
        assert "FINA 4001" in result["courses"]
        assert "FINA 5001" in result["courses"]

    def test_or_case_insensitive(self):
        result = parse_prereqs("FINA 4001 OR FINA 5001")
        assert result["type"] == "or"

    def test_or_preserves_case_before_normalize(self):
        # 'or' keyword is matched case-insensitively; codes are normalized
        result = parse_prereqs("fina4001 or fina5001")
        assert result["type"] == "or"
        assert "FINA 4001" in result["courses"]

    def test_parens_annotation_stripped(self):
        # Parenthetical annotation should be stripped; base course parses correctly
        result = parse_prereqs("FINA 3001 (may be concurrent)")
        assert result["type"] == "single"
        assert result["course"] == "FINA 3001"

    def test_or_with_annotation(self):
        # Trailing annotation on OR clause should be stripped
        result = parse_prereqs("FINA 4001 or FINA 5001 (non-majors)")
        assert result["type"] == "or"
        assert "FINA 4001" in result["courses"]
        assert "FINA 5001" in result["courses"]
        assert len(result["courses"]) == 2

    def test_annotation_with_leading_parens(self):
        # Leading parenthetical annotation stripped; remaining course code parses
        result = parse_prereqs("(minimum grade B) FINA 3001")
        assert result["type"] == "single"
        assert result["course"] == "FINA 3001"

    def test_unsupported_no_course_with_parens(self):
        # Stripping annotation still leaves unsupported signal word "consent"
        result = parse_prereqs("consent of (the) instructor")
        assert result["type"] == "unsupported"

    def test_unsupported_instructor_consent(self):
        result = parse_prereqs("consent of instructor")
        assert result["type"] == "unsupported"

    def test_unsupported_standing(self):
        result = parse_prereqs("Sophomore standing; FINA 3001")
        assert result["type"] == "unsupported"


class TestPrereqsSatisfied:
    def test_none_always_satisfied(self):
        assert prereqs_satisfied({"type": "none"}, set()) is True

    def test_single_completed(self):
        assert prereqs_satisfied({"type": "single", "course": "FINA 3001"}, {"FINA 3001"}) is True

    def test_single_missing(self):
        assert prereqs_satisfied({"type": "single", "course": "FINA 3001"}, set()) is False

    def test_and_all_present(self):
        parsed = {"type": "and", "courses": ["ECON 1103", "BUAD 1560"]}
        assert prereqs_satisfied(parsed, {"ECON 1103", "BUAD 1560"}) is True

    def test_and_partial(self):
        parsed = {"type": "and", "courses": ["ECON 1103", "BUAD 1560"]}
        assert prereqs_satisfied(parsed, {"ECON 1103"}) is False

    def test_or_one_present(self):
        parsed = {"type": "or", "courses": ["FINA 4001", "FINA 5001"]}
        assert prereqs_satisfied(parsed, {"FINA 5001"}) is True

    def test_or_none_present(self):
        parsed = {"type": "or", "courses": ["FINA 4001", "FINA 5001"]}
        assert prereqs_satisfied(parsed, set()) is False

    def test_unsupported_never_satisfied(self):
        assert prereqs_satisfied({"type": "unsupported", "raw": "..."}, {"FINA 3001"}) is False

    def test_in_progress_satisfies(self):
        # in_progress courses are included in satisfied_codes
        parsed = {"type": "single", "course": "FINA 3001"}
        satisfied = {"FINA 3001"}  # in_progress treated same as completed for eligibility
        assert prereqs_satisfied(parsed, satisfied) is True


class TestBuildPrereqCheckString:
    def test_completed(self):
        parsed = {"type": "single", "course": "FINA 3001"}
        result = build_prereq_check_string(parsed, {"FINA 3001"}, set())
        assert "✓" in result
        assert "in progress" not in result

    def test_in_progress(self):
        parsed = {"type": "single", "course": "FINA 3001"}
        result = build_prereq_check_string(parsed, set(), {"FINA 3001"})
        assert "in progress" in result
        assert "✓" in result

    def test_none(self):
        result = build_prereq_check_string({"type": "none"}, set(), set())
        assert "No prerequisites" in result
