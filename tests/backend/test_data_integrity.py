"""
Live-data integrity checks for the checked-in CSV workbook model.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import re

import pandas as pd
import pytest

from data_loader import load_data
from prereq_parser import parse_prereqs, prereq_course_codes
from requirements import COMPLEX_PREREQ_TAG


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
SEMESTER_COLUMN_RE = re.compile(r"^(Spring|Summer|Fall)\s+\d{4}$")
ALLOWED_PREREQ_TYPES = {"single", "and", "or", "choose_n", "none", "unsupported"}
ALLOWED_REQUIREMENT_MODES = {"required", "choose_n", "credits_pool"}
ALLOWED_BOOLEAN_LITERALS = {"true", "false", "1", "0", "yes", "no", "y", "n"}
PREREQ_ORPHAN_THRESHOLD = 30

SCHEMA_SPECS = (
    {
        "csv_name": "courses.csv",
        "required_cols": [
            "course_code",
            "course_name",
            "credits",
            "level",
            "active",
            "notes",
            "elective_pool_tag",
            "description",
        ],
        "pk_cols": ["course_code"],
        "exact_columns": True,
    },
    {
        "csv_name": "parent_buckets.csv",
        "required_cols": [
            "parent_bucket_id",
            "parent_bucket_label",
            "type",
            "parent_major",
            "active",
            "requires_primary_major",
            "double_count_family_id",
            "required_major",
            "is_default",
        ],
        "pk_cols": ["parent_bucket_id"],
        "exact_columns": True,
    },
    {
        "csv_name": "child_buckets.csv",
        "required_cols": [
            "parent_bucket_id",
            "child_bucket_id",
            "child_bucket_label",
            "requirement_mode",
            "courses_required",
            "credits_required",
            "min_level",
            "notes",
        ],
        "pk_cols": ["parent_bucket_id", "child_bucket_id"],
        "exact_columns": True,
    },
    {
        "csv_name": "master_bucket_courses.csv",
        "required_cols": [
            "parent_bucket_id",
            "child_bucket_id",
            "course_code",
            "notes",
        ],
        "pk_cols": ["parent_bucket_id", "child_bucket_id", "course_code"],
        "exact_columns": True,
    },
    {
        "csv_name": "course_prereqs.csv",
        "required_cols": [
            "course_code",
            "prerequisites",
            "prereq_warnings",
            "concurrent_with",
            "min_standing",
            "notes",
            "warning_text",
        ],
        "pk_cols": ["course_code"],
        "exact_columns": True,
    },
    {
        "csv_name": "course_offerings.csv",
        "required_cols": ["course_code"],
        "pk_cols": ["course_code"],
        "exact_columns": False,
    },
    {
        "csv_name": "double_count_policy.csv",
        "required_cols": [
            "program_id",
            "sub_bucket_id_a",
            "sub_bucket_id_b",
            "allow_double_count",
            "reason",
        ],
        "pk_cols": ["program_id", "sub_bucket_id_a", "sub_bucket_id_b"],
        "exact_columns": True,
    },
)

FK_SPECS = (
    {
        "name": "child_buckets.parent_bucket_id -> parent_buckets.parent_bucket_id",
        "source_csv": "child_buckets.csv",
        "source_cols": ["parent_bucket_id"],
        "target_csv": "parent_buckets.csv",
        "target_cols": ["parent_bucket_id"],
    },
    {
        "name": "master_bucket_courses.parent_bucket_id -> parent_buckets.parent_bucket_id",
        "source_csv": "master_bucket_courses.csv",
        "source_cols": ["parent_bucket_id"],
        "target_csv": "parent_buckets.csv",
        "target_cols": ["parent_bucket_id"],
    },
    {
        "name": "master_bucket_courses.(parent_bucket_id, child_bucket_id) -> child_buckets composite",
        "source_csv": "master_bucket_courses.csv",
        "source_cols": ["parent_bucket_id", "child_bucket_id"],
        "target_csv": "child_buckets.csv",
        "target_cols": ["parent_bucket_id", "child_bucket_id"],
    },
    {
        "name": "master_bucket_courses.course_code -> courses.course_code",
        "source_csv": "master_bucket_courses.csv",
        "source_cols": ["course_code"],
        "target_csv": "courses.csv",
        "target_cols": ["course_code"],
    },
    {
        "name": "course_prereqs.course_code -> courses.course_code",
        "source_csv": "course_prereqs.csv",
        "source_cols": ["course_code"],
        "target_csv": "courses.csv",
        "target_cols": ["course_code"],
    },
    {
        "name": "course_offerings.course_code -> courses.course_code",
        "source_csv": "course_offerings.csv",
        "source_cols": ["course_code"],
        "target_csv": "courses.csv",
        "target_cols": ["course_code"],
    },
    {
        "name": "track parent_major -> parent bucket",
        "source_csv": "parent_buckets.csv",
        "source_cols": ["parent_major"],
        "target_csv": "parent_buckets.csv",
        "target_cols": ["parent_bucket_id"],
        "row_filter": lambda df: df["type"].astype(str).str.strip().str.lower() == "track",
    },
    {
        "name": "required_major -> parent bucket",
        "source_csv": "parent_buckets.csv",
        "source_cols": ["required_major"],
        "target_csv": "parent_buckets.csv",
        "target_cols": ["parent_bucket_id"],
    },
    {
        "name": "double_count_policy.sub_bucket_id_a -> child_buckets.child_bucket_id",
        "source_csv": "double_count_policy.csv",
        "source_cols": ["sub_bucket_id_a"],
        "target_csv": "child_buckets.csv",
        "target_cols": ["child_bucket_id"],
    },
    {
        "name": "double_count_policy.sub_bucket_id_b -> child_buckets.child_bucket_id",
        "source_csv": "double_count_policy.csv",
        "source_cols": ["sub_bucket_id_b"],
        "target_csv": "child_buckets.csv",
        "target_cols": ["child_bucket_id"],
    },
)


@lru_cache(maxsize=1)
def _loaded_data():
    return load_data(str(DATA_DIR))


@lru_cache(maxsize=None)
def _raw_csv(csv_name: str) -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / csv_name, dtype=str, keep_default_na=False)


def _normalize_text_frame(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    normalized = df.loc[:, cols].fillna("").astype(str)
    for col in cols:
        normalized[col] = normalized[col].str.strip()
    return normalized


def _relation_values(df: pd.DataFrame, cols: list[str]) -> set[str] | set[tuple[str, ...]]:
    if len(df) == 0:
        return set()

    normalized = _normalize_text_frame(df, cols)
    non_blank = ~(normalized.eq("").all(axis=1))
    normalized = normalized.loc[non_blank]
    if len(cols) == 1:
        return set(normalized[cols[0]].tolist())
    return {tuple(row) for row in normalized.itertuples(index=False, name=None)}


def _prereq_rows() -> pd.DataFrame:
    prereqs = _raw_csv("course_prereqs.csv").copy()
    prereqs["course_code"] = prereqs["course_code"].fillna("").astype(str).str.strip()
    prereqs["prerequisites"] = prereqs["prerequisites"].fillna("").astype(str)
    prereqs["prereq_warnings"] = prereqs["prereq_warnings"].fillna("").astype(str)
    return prereqs[prereqs["course_code"] != ""]


def _prereq_graph() -> dict[str, list[str]]:
    graph: dict[str, list[str]] = {}
    catalog_codes = {
        code.strip()
        for code in _raw_csv("courses.csv")["course_code"].fillna("").astype(str).tolist()
        if code.strip()
    }
    for row in _prereq_rows().itertuples(index=False):
        parsed = parse_prereqs(row.prerequisites)
        refs = [code for code in prereq_course_codes(parsed) if code in catalog_codes]
        graph[row.course_code] = refs
    return graph


def _active_non_minor_program_ids() -> list[str]:
    programs = _loaded_data()["v2_programs_df"]
    active = programs[(programs["active"] == True) & (programs["kind"] != "minor")]
    return sorted(
        program_id.strip()
        for program_id in active["program_id"].astype(str).tolist()
        if program_id.strip()
    )


@pytest.mark.parametrize(
    "schema_spec",
    SCHEMA_SPECS,
    ids=[spec["csv_name"] for spec in SCHEMA_SPECS],
)
def test_csv_schema_and_primary_keys(schema_spec):
    csv_name = schema_spec["csv_name"]
    path = DATA_DIR / csv_name
    assert path.exists(), f"Missing CSV: {path}"
    assert path.stat().st_size > 0, f"CSV is empty on disk: {path}"

    df = _raw_csv(csv_name)
    assert list(df.columns), f"{csv_name} has no header row"

    required_cols = schema_spec["required_cols"]
    missing_cols = sorted(set(required_cols) - set(df.columns))
    assert not missing_cols, f"{csv_name} missing required columns: {missing_cols}"

    if schema_spec["exact_columns"]:
        assert set(df.columns) == set(required_cols), (
            f"{csv_name} columns changed. Expected {required_cols}, got {list(df.columns)}"
        )
    else:
        dynamic_cols = [col for col in df.columns if col != "course_code"]
        assert dynamic_cols, f"{csv_name} must contain at least one semester offering column"
        invalid = [col for col in dynamic_cols if not SEMESTER_COLUMN_RE.match(col)]
        assert not invalid, f"{csv_name} has non-semester offering columns: {invalid}"

    if len(df) > 0:
        stripped = df.fillna("").astype(str).apply(lambda col: col.str.strip())
        blank_rows = stripped.eq("").all(axis=1)
        assert not blank_rows.any(), f"{csv_name} contains fully blank rows"

        pk_cols = schema_spec["pk_cols"]
        duplicates = stripped.duplicated(subset=pk_cols, keep=False)
        assert not duplicates.any(), (
            f"{csv_name} has duplicate primary keys on {pk_cols}: "
            f"{stripped.loc[duplicates, pk_cols].to_dict(orient='records')[:10]}"
        )


@pytest.mark.parametrize(
    "fk_spec",
    FK_SPECS,
    ids=[spec["name"] for spec in FK_SPECS],
)
def test_cross_csv_referential_integrity(fk_spec):
    source_df = _raw_csv(fk_spec["source_csv"])
    row_filter = fk_spec.get("row_filter")
    if row_filter is not None:
        source_df = source_df[row_filter(source_df)].copy()

    source_values = _relation_values(source_df, fk_spec["source_cols"])
    if not source_values:
        return

    target_df = _raw_csv(fk_spec["target_csv"])
    target_values = _relation_values(target_df, fk_spec["target_cols"])
    missing = sorted(source_values - target_values)
    assert not missing, f"{fk_spec['name']} has orphaned references: {missing[:20]}"


def test_prereq_graph_has_no_self_references():
    offenders = []
    for row in _prereq_rows().itertuples(index=False):
        parsed = parse_prereqs(row.prerequisites)
        if row.course_code in prereq_course_codes(parsed):
            offenders.append(row.course_code)
    assert not offenders, f"Courses cannot list themselves as prerequisites: {offenders}"


def test_prereq_graph_has_no_cycles():
    graph = _prereq_graph()
    state: dict[str, int] = {}
    stack: list[str] = []
    cycle: list[str] = []

    def dfs(node: str) -> bool:
        state[node] = 1
        stack.append(node)
        for nxt in graph.get(node, []):
            if state.get(nxt) == 1:
                cycle.extend(stack[stack.index(nxt):] + [nxt])
                return True
            if state.get(nxt) != 2 and dfs(nxt):
                return True
        stack.pop()
        state[node] = 2
        return False

    for node in graph:
        if state.get(node) == 2:
            continue
        if dfs(node):
            break

    assert not cycle, f"Prerequisite cycle detected: {' -> '.join(cycle)}"


def test_prereq_references_stay_within_tolerated_orphan_threshold():
    catalog_codes = {
        code.strip()
        for code in _raw_csv("courses.csv")["course_code"].fillna("").astype(str).tolist()
        if code.strip()
    }
    referenced = set()
    for row in _prereq_rows().itertuples(index=False):
        referenced.update(prereq_course_codes(parse_prereqs(row.prerequisites)))

    orphaned = sorted(referenced - catalog_codes)
    assert len(orphaned) < PREREQ_ORPHAN_THRESHOLD, (
        f"Too many prerequisite references point outside courses.csv: {len(orphaned)} "
        f"(sample: {orphaned[:20]})"
    )


def test_min_standing_values_are_in_range():
    standing = _prereq_rows()["min_standing"].replace("", pd.NA).dropna()
    if len(standing) == 0:
        return

    numeric = standing.astype(float)
    invalid = numeric[(numeric < 0.0) | (numeric > 5.0)]
    assert invalid.empty, f"min_standing must stay within [0.0, 5.0]: {sorted(invalid.unique().tolist())}"


def test_parsed_prereq_types_are_supported_or_flagged_for_manual_review():
    unsupported_without_tag = []
    invalid_types = []

    for row in _prereq_rows().itertuples(index=False):
        parsed = parse_prereqs(row.prerequisites)
        prereq_type = parsed.get("type")
        if prereq_type not in ALLOWED_PREREQ_TYPES:
            invalid_types.append((row.course_code, prereq_type))
            continue
        if prereq_type == "unsupported" and COMPLEX_PREREQ_TAG not in row.prereq_warnings.split(";"):
            unsupported_without_tag.append(row.course_code)

    assert not invalid_types, f"Unexpected prereq parse types: {invalid_types}"
    assert not unsupported_without_tag, (
        "Unsupported prereq rows must be tagged for manual review: "
        f"{unsupported_without_tag}"
    )


def test_active_non_minor_parent_buckets_have_child_buckets():
    data = _loaded_data()
    parents = data["parent_buckets_df"]
    children = data["child_buckets_df"]

    active_non_minor = parents[(parents["active"] == True) & (parents["type"] != "minor")]
    child_parent_ids = set(children["parent_bucket_id"].astype(str).str.strip().tolist())
    missing = sorted(set(active_non_minor["parent_bucket_id"].astype(str).str.strip()) - child_parent_ids)
    assert not missing, f"Active non-minor parent buckets must have child buckets: {missing}"


def test_active_child_buckets_have_mappings_or_are_credit_pools():
    data = _loaded_data()
    parents = data["parent_buckets_df"]
    children = data["child_buckets_df"]
    mappings = data["master_bucket_courses_df"]

    active_parent_ids = set(
        parents.loc[(parents["active"] == True) & (parents["type"] != "minor"), "parent_bucket_id"]
        .astype(str)
        .str.strip()
        .tolist()
    )
    active_children = children[children["parent_bucket_id"].astype(str).str.strip().isin(active_parent_ids)].copy()
    mapped_pairs = {
        (str(parent_id).strip(), str(child_id).strip())
        for parent_id, child_id in mappings[["parent_bucket_id", "child_bucket_id"]].itertuples(index=False)
    }

    missing = []
    for row in active_children.itertuples(index=False):
        pair = (str(row.parent_bucket_id).strip(), str(row.child_bucket_id).strip())
        if str(row.requirement_mode).strip().lower() == "credits_pool":
            continue
        if pair not in mapped_pairs:
            missing.append(pair)

    assert not missing, f"Active child buckets without mappings: {missing}"


def test_requirement_mode_values_are_valid():
    child_buckets = _loaded_data()["child_buckets_df"]
    modes = set(child_buckets["requirement_mode"].fillna("").astype(str).str.strip().str.lower().tolist())
    assert modes <= ALLOWED_REQUIREMENT_MODES, f"Unexpected requirement_mode values: {sorted(modes - ALLOWED_REQUIREMENT_MODES)}"


def test_courses_required_is_set_for_count_based_buckets():
    child_buckets = _loaded_data()["child_buckets_df"]
    count_based = child_buckets[
        child_buckets["requirement_mode"].astype(str).str.strip().str.lower().isin({"required", "choose_n"})
    ]
    missing = count_based[count_based["courses_required"].isna()][["parent_bucket_id", "child_bucket_id"]]
    assert missing.empty, (
        "required/choose_n buckets must set courses_required: "
        f"{missing.to_dict(orient='records')}"
    )


def test_credits_required_is_set_for_credit_pool_buckets():
    child_buckets = _loaded_data()["child_buckets_df"]
    credit_pools = child_buckets[
        child_buckets["requirement_mode"].astype(str).str.strip().str.lower() == "credits_pool"
    ]
    missing = credit_pools[credit_pools["credits_required"].isna()][["parent_bucket_id", "child_bucket_id"]]
    assert missing.empty, (
        "credits_pool buckets must set credits_required: "
        f"{missing.to_dict(orient='records')}"
    )


def test_active_parent_buckets_have_nonempty_labels():
    parent_buckets = _loaded_data()["parent_buckets_df"]
    active = parent_buckets[parent_buckets["active"] == True]
    blank = active[
        active["parent_bucket_label"].fillna("").astype(str).str.strip() == ""
    ][["parent_bucket_id", "type"]]
    assert blank.empty, f"Active parent buckets must have labels: {blank.to_dict(orient='records')}"


def test_active_tracks_reference_active_major_parents():
    parent_buckets = _loaded_data()["parent_buckets_df"]
    active_major_ids = set(
        parent_buckets.loc[
            (parent_buckets["active"] == True) & (parent_buckets["type"] == "major"),
            "parent_bucket_id",
        ].astype(str).str.strip().tolist()
    )
    active_tracks = parent_buckets[
        (parent_buckets["active"] == True) & (parent_buckets["type"] == "track")
    ]
    invalid = active_tracks[
        ~active_tracks["parent_major"].fillna("").astype(str).str.strip().isin(active_major_ids)
    ][["parent_bucket_id", "parent_major"]]
    assert invalid.empty, (
        "Active tracks must reference active major parents: "
        f"{invalid.to_dict(orient='records')}"
    )


def test_required_major_refs_point_to_active_major_parents():
    parent_buckets = _loaded_data()["parent_buckets_df"]
    active_major_ids = set(
        parent_buckets.loc[
            (parent_buckets["active"] == True) & (parent_buckets["type"] == "major"),
            "parent_bucket_id",
        ].astype(str).str.strip().tolist()
    )
    constrained = parent_buckets[
        parent_buckets["required_major"].fillna("").astype(str).str.strip() != ""
    ]
    invalid = constrained[
        ~constrained["required_major"].fillna("").astype(str).str.strip().isin(active_major_ids)
    ][["parent_bucket_id", "required_major"]]
    assert invalid.empty, (
        "required_major must reference an active major parent: "
        f"{invalid.to_dict(orient='records')}"
    )


def test_exactly_one_active_default_major_is_configured():
    parent_buckets = _loaded_data()["parent_buckets_df"]
    defaults = parent_buckets[
        (parent_buckets["type"] == "major")
        & (parent_buckets["active"] == True)
        & (parent_buckets["is_default"] == True)
    ][["parent_bucket_id", "requires_primary_major"]]
    assert len(defaults) == 1, (
        "Exactly one active major should be marked is_default: "
        f"{defaults.to_dict(orient='records')}"
    )
    assert defaults.iloc[0]["requires_primary_major"] != True, (
        "The default major cannot require a primary major: "
        f"{defaults.to_dict(orient='records')}"
    )


def test_course_offering_cells_are_boolean_like():
    offerings = _raw_csv("course_offerings.csv")
    offering_cols = [col for col in offerings.columns if col != "course_code"]
    invalid_values = set()

    for col in offering_cols:
        values = (
            offerings[col]
            .fillna("")
            .astype(str)
            .str.strip()
            .str.lower()
        )
        invalid_values.update(
            value
            for value in values.tolist()
            if value and value not in ALLOWED_BOOLEAN_LITERALS
        )

    assert not invalid_values, (
        "course_offerings.csv should contain only boolean-like values in semester columns: "
        f"{sorted(invalid_values)}"
    )


def test_every_active_non_minor_program_produces_runtime_buckets():
    data = _loaded_data()
    runtime_track_ids = set(
        data["buckets_df"]["track_id"].fillna("").astype(str).str.strip().tolist()
    )
    missing = sorted(set(_active_non_minor_program_ids()) - runtime_track_ids)
    assert not missing, f"Active programs missing runtime buckets after load_data(): {missing}"


def test_every_active_non_minor_program_produces_runtime_course_mappings():
    data = _loaded_data()
    runtime_track_ids = set(
        data["course_bucket_map_df"]["track_id"].fillna("").astype(str).str.strip().tolist()
    )
    missing = sorted(set(_active_non_minor_program_ids()) - runtime_track_ids)
    assert not missing, f"Active programs missing runtime course mappings after load_data(): {missing}"
