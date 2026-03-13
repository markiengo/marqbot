"""
Migrate workbook requirement model to parent/child bucket schema.

Creates/updates:
  - parent_buckets
  - child_buckets
  - master_bucket_courses

Source model:
  - programs
  - buckets
  - sub_buckets
  - courses_all_buckets (preferred) or course_sub_buckets
"""

import argparse
import os
import re
import shutil
import sys

import pandas as pd


DEFAULT_WORKBOOK = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "marquette_courses_full.xlsx")
)

_ELECTIVE_PURGE_RE = re.compile(r"ELEC|BUS_ELEC|ELECTIVE", re.IGNORECASE)
_REQUIREMENT_MODE_VALUES = {"required", "choose_n", "credits_pool"}


def _to_bool(value, default=False) -> bool:
    if pd.isna(value):
        return bool(default)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(int(value))
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return True
    if text in {"0", "false", "no", "n"}:
        return False
    return bool(default)


def _norm_str(series: pd.Series, upper: bool = False) -> pd.Series:
    out = series.fillna("").astype(str).str.strip()
    return out.str.upper() if upper else out


def _first_non_empty(values) -> str:
    for value in values:
        if pd.notna(value) and str(value).strip():
            return str(value).strip()
    return ""


def _first_numeric(values):
    for value in values:
        if pd.notna(value):
            return value
    return None


def _infer_requirement_mode(row: pd.Series) -> str:
    mode = str(row.get("requirement_mode", "") or "").strip().lower()
    if mode in _REQUIREMENT_MODE_VALUES:
        return mode

    role = str(row.get("role", "") or "").strip().lower()
    courses_required = pd.to_numeric(row.get("courses_required"), errors="coerce")
    credits_required = pd.to_numeric(row.get("credits_required"), errors="coerce")

    if role == "core":
        return "required"
    if pd.notna(credits_required) and float(credits_required) > 0:
        return "credits_pool"
    if role == "elective":
        return "choose_n"
    if pd.notna(courses_required) and float(courses_required) > 0:
        return "choose_n"
    return "required"


def _build_parent_buckets(programs_df: pd.DataFrame) -> pd.DataFrame:
    df = programs_df.copy()
    for col, default in {
        "program_id": "",
        "program_label": "",
        "kind": "major",
        "parent_major_id": "",
        "active": True,
        "requires_primary_major": False,
        "applies_to_all": False,
    }.items():
        if col not in df.columns:
            df[col] = default

    df["program_id"] = _norm_str(df["program_id"], upper=True)
    df["program_label"] = _norm_str(df["program_label"])
    df["kind"] = _norm_str(df["kind"]).str.lower()
    df["parent_major_id"] = _norm_str(df["parent_major_id"], upper=True)
    df["active"] = df["active"].apply(_to_bool)
    df["requires_primary_major"] = df["requires_primary_major"].apply(_to_bool)
    df["applies_to_all"] = df["applies_to_all"].apply(_to_bool)

    def _row_type(row: pd.Series) -> str:
        if bool(row.get("applies_to_all", False)):
            return "universal"
        kind = str(row.get("kind", "") or "").strip().lower()
        if kind in {"track", "minor"}:
            return kind
        return "major"

    out = pd.DataFrame(
        {
            "parent_bucket_id": df["program_id"],
            "parent_bucket_label": df["program_label"].where(df["program_label"] != "", df["program_id"]),
            "type": df.apply(_row_type, axis=1),
            "parent_major": df["parent_major_id"],
            "active": df["active"],
            "requires_primary_major": df["requires_primary_major"],
            "double_count_family_id": df["program_id"],
        }
    )
    out.loc[out["type"].isin({"major", "universal"}), "parent_major"] = ""
    out = out[out["parent_bucket_id"] != ""].copy()
    out = out.drop_duplicates(subset=["parent_bucket_id"], keep="first")
    return out[
        [
            "parent_bucket_id",
            "parent_bucket_label",
            "type",
            "parent_major",
            "active",
            "requires_primary_major",
            "double_count_family_id",
        ]
    ]


def _build_child_buckets(sub_buckets_df: pd.DataFrame) -> pd.DataFrame:
    df = sub_buckets_df.copy()
    for col, default in {
        "program_id": "",
        "bucket_id": "",
        "sub_bucket_id": "",
        "sub_bucket_label": "",
        "courses_required": None,
        "credits_required": None,
        "min_level": None,
        "notes": "",
    }.items():
        if col not in df.columns:
            df[col] = default

    df["program_id"] = _norm_str(df["program_id"], upper=True)
    df["bucket_id"] = _norm_str(df["bucket_id"], upper=True)
    df["sub_bucket_id"] = _norm_str(df["sub_bucket_id"], upper=True)
    df["sub_bucket_label"] = _norm_str(df["sub_bucket_label"])
    df["notes"] = _norm_str(df["notes"])
    df["courses_required"] = pd.to_numeric(df["courses_required"], errors="coerce")
    df["credits_required"] = pd.to_numeric(df["credits_required"], errors="coerce")
    df["min_level"] = pd.to_numeric(df["min_level"], errors="coerce")
    df["requirement_mode"] = df.apply(_infer_requirement_mode, axis=1)

    out = pd.DataFrame(
        {
            # Parent bucket is the major/track program family.
            "parent_bucket_id": df["program_id"],
            "child_bucket_id": df["sub_bucket_id"],
            "child_bucket_label": df["sub_bucket_label"].where(df["sub_bucket_label"] != "", df["sub_bucket_id"]),
            "requirement_mode": df["requirement_mode"],
            "courses_required": df["courses_required"],
            "credits_required": df["credits_required"],
            "min_level": df["min_level"],
            "notes": df["notes"],
        }
    )
    out = out[(out["parent_bucket_id"] != "") & (out["child_bucket_id"] != "")].copy()

    if len(out) > 0:
        out = (
            out.sort_values(["parent_bucket_id", "child_bucket_id"], kind="stable")
            .groupby(["parent_bucket_id", "child_bucket_id"], as_index=False)
            .agg(
                {
                    "child_bucket_label": _first_non_empty,
                    "requirement_mode": _first_non_empty,
                    "courses_required": _first_numeric,
                    "credits_required": _first_numeric,
                    "min_level": _first_numeric,
                    "notes": _first_non_empty,
                }
            )
        )
    out["requirement_mode"] = out["requirement_mode"].where(
        out["requirement_mode"].isin(_REQUIREMENT_MODE_VALUES),
        "required",
    )
    return out[
        [
            "parent_bucket_id",
            "child_bucket_id",
            "child_bucket_label",
            "requirement_mode",
            "courses_required",
            "credits_required",
            "min_level",
            "notes",
        ]
    ]


def _build_master_bucket_courses(
    sub_buckets_df: pd.DataFrame,
    map_df: pd.DataFrame,
) -> pd.DataFrame:
    sub = sub_buckets_df.copy()
    for col, default in {
        "program_id": "",
        "bucket_id": "",
        "sub_bucket_id": "",
    }.items():
        if col not in sub.columns:
            sub[col] = default

    sub["program_id"] = _norm_str(sub["program_id"], upper=True)
    sub["bucket_id"] = _norm_str(sub["bucket_id"], upper=True)
    sub["sub_bucket_id"] = _norm_str(sub["sub_bucket_id"], upper=True)
    sub_lookup = (
        sub[["program_id", "sub_bucket_id"]]
        .drop_duplicates(subset=["program_id", "sub_bucket_id"], keep="first")
        .copy()
    )

    m = map_df.copy()
    for col, default in {
        "program_id": "",
        "sub_bucket_id": "",
        "course_code": "",
        "notes": "",
    }.items():
        if col not in m.columns:
            m[col] = default
    if "notes" not in map_df.columns and "constraints" in map_df.columns:
        m["notes"] = _norm_str(map_df["constraints"])

    m["program_id"] = _norm_str(m["program_id"], upper=True)
    m["sub_bucket_id"] = _norm_str(m["sub_bucket_id"], upper=True)
    m["course_code"] = _norm_str(m["course_code"])
    m["notes"] = _norm_str(m["notes"])

    merged = m.merge(sub_lookup, how="left", on=["program_id", "sub_bucket_id"])
    merged["parent_bucket_id"] = merged["program_id"]

    out = pd.DataFrame(
        {
            "parent_bucket_id": merged["parent_bucket_id"],
            "child_bucket_id": merged["sub_bucket_id"],
            "course_code": merged["course_code"],
            "notes": merged["notes"],
        }
    )
    out = out[
        (out["parent_bucket_id"] != "")
        & (out["child_bucket_id"] != "")
        & (out["course_code"] != "")
    ].copy()
    out = out.drop_duplicates(
        subset=["parent_bucket_id", "child_bucket_id", "course_code"],
        keep="first",
    )
    return out[
        ["parent_bucket_id", "child_bucket_id", "course_code", "notes"]
    ]


def _purge_elective_mappings(
    child_buckets_df: pd.DataFrame,
    master_bucket_courses_df: pd.DataFrame,
) -> tuple[pd.DataFrame, int]:
    child_ids = _norm_str(child_buckets_df.get("child_bucket_id", pd.Series(dtype=str)), upper=True)
    purge_ids = set(child_ids[child_ids.str.contains(_ELECTIVE_PURGE_RE, na=False)].tolist())
    map_child_ids = _norm_str(master_bucket_courses_df.get("child_bucket_id", pd.Series(dtype=str)), upper=True)
    purge_mask = map_child_ids.str.contains(_ELECTIVE_PURGE_RE, na=False)
    if purge_ids:
        purge_mask = purge_mask | map_child_ids.isin(purge_ids)
    removed = int(purge_mask.sum())
    return master_bucket_courses_df.loc[~purge_mask].copy(), removed


def _load_workbook_sheets(path: str) -> tuple[list[str], dict[str, pd.DataFrame]]:
    xl = pd.ExcelFile(path)
    order = list(xl.sheet_names)
    sheets = {name: xl.parse(name) for name in order}
    return order, sheets


def _write_workbook(path: str, order: list[str], sheets: dict[str, pd.DataFrame]) -> None:
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        for sheet_name in order:
            sheets.get(sheet_name, pd.DataFrame()).to_excel(writer, sheet_name=sheet_name, index=False)


def migrate(path: str, dry_run: bool = False) -> None:
    abs_path = os.path.abspath(path)
    if not os.path.exists(abs_path):
        sys.exit(f"[ERROR] Workbook not found: {abs_path}")

    order, sheets = _load_workbook_sheets(abs_path)
    required = {"programs", "buckets", "sub_buckets"}
    missing_required = sorted(required - set(sheets.keys()))
    if missing_required:
        sys.exit(
            "[ERROR] Workbook is missing required legacy sheet(s): "
            + ", ".join(missing_required)
        )

    if "courses_all_buckets" in sheets:
        map_sheet = "courses_all_buckets"
    elif "course_sub_buckets" in sheets:
        map_sheet = "course_sub_buckets"
    else:
        sys.exit(
            "[ERROR] Workbook must contain either 'courses_all_buckets' "
            "or 'course_sub_buckets'."
        )

    programs_df = sheets["programs"].copy()
    sub_buckets_df = sheets["sub_buckets"].copy()
    map_df = sheets[map_sheet].copy()

    parent_buckets_df = _build_parent_buckets(programs_df)
    child_buckets_df = _build_child_buckets(sub_buckets_df)
    master_bucket_courses_df = _build_master_bucket_courses(sub_buckets_df, map_df)
    master_bucket_courses_df, removed_count = _purge_elective_mappings(
        child_buckets_df,
        master_bucket_courses_df,
    )

    print(f"[INFO] Source map sheet: {map_sheet}")
    print(f"[INFO] parent_buckets rows: {len(parent_buckets_df)}")
    print(f"[INFO] child_buckets rows: {len(child_buckets_df)}")
    print(f"[INFO] master_bucket_courses rows: {len(master_bucket_courses_df)}")
    print(f"[INFO] Purged elective-like mappings: {removed_count}")

    if dry_run:
        print("[DRY RUN] No file changes were written.")
        return

    backup_path = f"{abs_path}.bak"
    shutil.copy2(abs_path, backup_path)
    print(f"[INFO] Backup created: {backup_path}")

    sheets["parent_buckets"] = parent_buckets_df
    sheets["child_buckets"] = child_buckets_df
    sheets["master_bucket_courses"] = master_bucket_courses_df

    for sheet_name in ["parent_buckets", "child_buckets", "master_bucket_courses"]:
        if sheet_name not in order:
            order.append(sheet_name)

    _write_workbook(abs_path, order, sheets)
    print(f"[DONE] Migrated workbook: {abs_path}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Migrate workbook to parent/child bucket schema."
    )
    parser.add_argument("--path", default=DEFAULT_WORKBOOK, help="Workbook path")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args(argv)
    migrate(args.path, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
