"""
Regression tests for the schema normalization (Phase 1).

Covers:
  1. _safe_bool_col() — all input variants
  2. allocate_courses() — double-count works without row-level can_double_count column
  3. data_loader fallback chain — loader selects correct sheet and warns appropriately
"""

import io
import sys
import os
import pytest
import pandas as pd

# conftest.py already adds backend/ to sys.path
from data_loader import _safe_bool_col, load_data
from allocator import allocate_courses


# ── 1. Boolean coercion ────────────────────────────────────────────────────────

class TestSafeBoolCol:
    def _apply(self, values):
        """Apply _safe_bool_col to a single-column DataFrame and return the list."""
        df = pd.DataFrame({"col": values})
        df = _safe_bool_col(df, "col")
        return df["col"].tolist()

    def test_python_bool_true(self):
        assert self._apply([True]) == [True]

    def test_python_bool_false(self):
        assert self._apply([False]) == [False]

    def test_int_1_is_true(self):
        assert self._apply([1]) == [True]

    def test_int_0_is_false(self):
        assert self._apply([0]) == [False]

    def test_float_1_is_true(self):
        assert self._apply([1.0]) == [True]

    def test_float_0_is_false(self):
        assert self._apply([0.0]) == [False]

    def test_string_TRUE(self):
        assert self._apply(["TRUE"]) == [True]

    def test_string_true_lowercase(self):
        assert self._apply(["true"]) == [True]

    def test_string_False(self):
        assert self._apply(["FALSE"]) == [False]

    def test_string_false_lowercase(self):
        assert self._apply(["false"]) == [False]

    def test_string_1(self):
        assert self._apply(["1"]) == [True]

    def test_string_0(self):
        assert self._apply(["0"]) == [False]

    def test_string_yes(self):
        assert self._apply(["yes"]) == [True]

    def test_string_no(self):
        assert self._apply(["no"]) == [False]

    def test_string_y(self):
        assert self._apply(["y"]) == [True]

    def test_string_n(self):
        assert self._apply(["n"]) == [False]

    def test_nan_is_false(self):
        assert self._apply([float("nan")]) == [False]

    def test_none_is_false(self):
        assert self._apply([None]) == [False]

    def test_mixed_column(self):
        result = self._apply([1, 0, "TRUE", "false", True, None])
        assert result == [True, False, True, False, True, False]

    def test_missing_column_is_noop(self):
        """_safe_bool_col should silently skip columns that don't exist."""
        df = pd.DataFrame({"other": [1, 2]})
        df2 = _safe_bool_col(df, "nonexistent")
        assert list(df2.columns) == ["other"]


# ── 2. Double-count without row-level can_double_count column ─────────────────

@pytest.fixture
def buckets_dc():
    """Two buckets that both allow double-counting."""
    return pd.DataFrame([
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "bucket_label": "Choose Two",
         "priority": 2, "needed_count": 2, "needed_credits": None, "min_level": 3000, "allow_double_count": True},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1", "bucket_label": "Choose One",
         "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": 3000, "allow_double_count": True},
    ])


@pytest.fixture
def map_no_can_double_count():
    """Map with NO can_double_count column — simulates new normalized schema."""
    return pd.DataFrame([
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4020"},
        {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1", "course_code": "FINA 4020"},
    ])


@pytest.fixture
def courses_dc():
    return pd.DataFrame([
        {"course_code": "FINA 4020", "course_name": "Financial Planning", "credits": 3, "level": 4000},
    ])


class TestDoubleCountWithoutRowLevelFlag:
    def test_double_count_works_with_no_can_double_count_column(
        self, buckets_dc, map_no_can_double_count, courses_dc
    ):
        """
        When the map has no can_double_count column, double-count should be
        gated solely by bucket-level allow_double_count (both True here).
        Course should appear in double_counted_courses.
        """
        result = allocate_courses(
            ["FINA 4020"], [], buckets_dc, map_no_can_double_count, courses_dc
        )
        dc = result["double_counted_courses"]
        assert any(d["course_code"] == "FINA 4020" for d in dc), (
            "FINA 4020 should double-count when both buckets allow it"
        )
        entry = next(d for d in dc if d["course_code"] == "FINA 4020")
        assert "FIN_CHOOSE_2" in entry["buckets"]
        assert "FIN_CHOOSE_1" in entry["buckets"]

    def test_double_count_blocked_when_bucket_disallows(self, courses_dc):
        """When bucket allow_double_count=False, course should NOT double-count."""
        buckets_no_dc = pd.DataFrame([
            {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "bucket_label": "Choose Two",
             "priority": 2, "needed_count": 2, "needed_credits": None, "min_level": None, "allow_double_count": False},
            {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1", "bucket_label": "Choose One",
             "priority": 3, "needed_count": 1, "needed_credits": None, "min_level": None, "allow_double_count": False},
        ])
        map_no_dc = pd.DataFrame([
            {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_2", "course_code": "FINA 4020"},
            {"track_id": "FIN_MAJOR", "bucket_id": "FIN_CHOOSE_1", "course_code": "FINA 4020"},
        ])
        result = allocate_courses(["FINA 4020"], [], buckets_no_dc, map_no_dc, courses_dc)
        assert result["double_counted_courses"] == [], (
            "No double-count when bucket disallows it"
        )


# ── 3. Loader fallback chain ───────────────────────────────────────────────────

def _make_minimal_xlsx(sheet_data: dict) -> str:
    """
    Write a minimal .xlsx to a temp file with the given sheets.
    sheet_data: {sheet_name: pd.DataFrame}
    Returns the file path.
    """
    import tempfile
    path = tempfile.mktemp(suffix=".xlsx")
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for name, df in sheet_data.items():
            df.to_excel(writer, sheet_name=name, index=False)
    return path


def _base_sheets():
    """Minimal valid sheets every loader test needs."""
    courses = pd.DataFrame([{
        "course_code": "FINA 3001", "course_name": "Intro Finance", "credits": 3,
        "offered_fall": 1, "offered_spring": 1, "offered_summer": 0,
        "prereq_hard": "none", "prereq_level": 0,
    }])
    buckets = pd.DataFrame([{
        "track_id": "FIN_MAJOR", "bucket_id": "CORE", "bucket_label": "Core",
        "priority": 1, "needed_count": 3, "needed_credits": None,
        "min_level": None, "allow_double_count": 0,
    }])
    tracks = pd.DataFrame([{
        "track_id": "FIN_MAJOR", "active": 1,
    }])
    return courses, buckets, tracks


class TestLoaderFallbackChain:
    def test_uses_course_bucket_sheet_when_present(self, tmp_path):
        courses, buckets, tracks = _base_sheets()
        course_bucket = pd.DataFrame([{
            "track_id": "FIN_MAJOR", "course_code": "FINA 3001", "bucket_id": "CORE",
        }])
        # Also include old bucket_course_map — loader should prefer course_bucket
        bucket_course_map = pd.DataFrame([{
            "track_id": "FIN_MAJOR", "course_code": "FINA 3001", "bucket_id": "WRONG",
        }])
        path = str(tmp_path / "test.xlsx")
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            courses.to_excel(w, sheet_name="courses", index=False)
            buckets.to_excel(w, sheet_name="buckets", index=False)
            tracks.to_excel(w, sheet_name="tracks", index=False)
            course_bucket.to_excel(w, sheet_name="course_bucket", index=False)
            bucket_course_map.to_excel(w, sheet_name="bucket_course_map", index=False)

        data = load_data(path)
        map_df = data["course_bucket_map_df"]
        assert "WRONG" not in map_df["bucket_id"].values, "Should use course_bucket, not bucket_course_map"
        assert "CORE" in map_df["bucket_id"].values

    def test_falls_back_to_bucket_course_map(self, tmp_path):
        courses, buckets, tracks = _base_sheets()
        bucket_course_map = pd.DataFrame([{
            "track_id": "FIN_MAJOR", "course_code": "FINA 3001", "bucket_id": "CORE",
        }])
        path = str(tmp_path / "test.xlsx")
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            courses.to_excel(w, sheet_name="courses", index=False)
            buckets.to_excel(w, sheet_name="buckets", index=False)
            tracks.to_excel(w, sheet_name="tracks", index=False)
            bucket_course_map.to_excel(w, sheet_name="bucket_course_map", index=False)

        data = load_data(path)
        assert "CORE" in data["course_bucket_map_df"]["bucket_id"].values

    def test_derives_from_wide_columns_when_no_map_sheet(self, tmp_path):
        courses, buckets, tracks = _base_sheets()
        courses["bucket1"] = "CORE"  # wide-format column
        path = str(tmp_path / "test.xlsx")
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            courses.to_excel(w, sheet_name="courses", index=False)
            buckets.to_excel(w, sheet_name="buckets", index=False)
            tracks.to_excel(w, sheet_name="tracks", index=False)

        data = load_data(path)
        map_df = data["course_bucket_map_df"]
        assert len(map_df) == 1
        assert map_df.iloc[0]["bucket_id"] == "CORE"
        assert map_df.iloc[0]["course_code"] == "FINA 3001"

    def test_active_track_read_from_tracks_sheet(self, tmp_path):
        """Derived map should use the active track from tracks sheet, not hardcoded FIN_MAJOR."""
        courses = pd.DataFrame([{
            "course_code": "ACCT 1001", "course_name": "Accounting", "credits": 3,
            "offered_fall": 1, "offered_spring": 1, "offered_summer": 0,
            "prereq_hard": "none", "prereq_level": 0, "bucket1": "CORE",
        }])
        buckets = pd.DataFrame([{
            "track_id": "BUS_MAJOR", "bucket_id": "CORE", "bucket_label": "Core",
            "priority": 1, "needed_count": 3, "needed_credits": None,
            "min_level": None, "allow_double_count": 0,
        }])
        tracks = pd.DataFrame([
            {"track_id": "FIN_MAJOR", "active": 0},
            {"track_id": "BUS_MAJOR", "active": 1},
        ])
        path = str(tmp_path / "test.xlsx")
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            courses.to_excel(w, sheet_name="courses", index=False)
            buckets.to_excel(w, sheet_name="buckets", index=False)
            tracks.to_excel(w, sheet_name="tracks", index=False)

        data = load_data(path)
        map_df = data["course_bucket_map_df"]
        assert map_df.iloc[0]["track_id"] == "BUS_MAJOR", (
            "Derived map should use active track from tracks sheet"
        )

    def test_bool_coercion_on_loaded_data(self, tmp_path):
        """offered_fall stored as 1/0 in Excel should load as True/False."""
        courses, buckets, tracks = _base_sheets()
        course_bucket = pd.DataFrame([{
            "track_id": "FIN_MAJOR", "course_code": "FINA 3001", "bucket_id": "CORE",
        }])
        path = str(tmp_path / "test.xlsx")
        with pd.ExcelWriter(path, engine="openpyxl") as w:
            courses.to_excel(w, sheet_name="courses", index=False)
            buckets.to_excel(w, sheet_name="buckets", index=False)
            tracks.to_excel(w, sheet_name="tracks", index=False)
            course_bucket.to_excel(w, sheet_name="course_bucket", index=False)

        data = load_data(path)
        course_row = data["courses_df"].iloc[0]
        # Use == not `is` — pandas may return np.bool_ which is equal to but not identical to Python bool
        assert course_row["offered_fall"] == True, "offered_fall=1 should load as True"
        assert course_row["offered_summer"] == False, "offered_summer=0 should load as False"
        assert type(course_row["offered_fall"]) in (bool, __import__("numpy").bool_), \
            "offered_fall should be a bool type, not raw int"
