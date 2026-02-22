"""
v1.6.0 workbook migration (data-model first).

Transforms marquette_courses_full.xlsx to the v1.6 schema:
1. Adds programs.applies_to_all and creates universal BCC_CORE overlay program.
2. Renames track IDs to *_TRACK and updates references.
3. Moves BCC family ownership to BCC_CORE in buckets/sub_buckets/courses_all_buckets.
4. Renames course_equivalencies.restriction_note -> course_name and scopes to FIN_MAJOR.
5. Replaces course_offerings row-per-term shape with literal semester columns.
6. Normalizes course_prereqs.concurrent_with: "none" -> blank.
7. Simplifies double_count_policy to sub-bucket pair schema.
8. Enforces FIN_CORE composition for FIN_MAJOR.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
from datetime import datetime

import pandas as pd


DEFAULT_WORKBOOK = os.path.join(
    os.path.dirname(__file__),
    "..",
    "marquette_courses_full.xlsx",
)

TRACK_RENAME_MAP = {
    "CB": "CB_TRACK",
    "FP": "FP_TRACK",
    "AIM_CFA": "AIM_CFA_TRACK",
    "AIM_IB": "AIM_IB_TRACK",
    "AIM_FINTECH": "AIM_FINTECH_TRACK",
    "HURE_LEAD": "HURE_LEAD_TRACK",
}

FIN_CORE_EXPECTED = {"FINA 3001", "FINA 4001", "FINA 4011"}

TERM_CODE_RE = re.compile(r"^(?P<year>\d{4})(?P<term>FA|SP|SU)$", re.IGNORECASE)
SEMESTER_HEADER_RE = re.compile(r"^(Spring|Summer|Fall)\s+(\d{4})$", re.IGNORECASE)
SEASON_RANK = {"SPRING": 1, "SUMMER": 2, "FALL": 3}
TERM_TO_LABEL = {"SP": "Spring", "SU": "Summer", "FA": "Fall"}


def _coerce_bool(value) -> bool:
    if pd.isna(value):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _normalize_code(series: pd.Series) -> pd.Series:
    return series.fillna("").astype(str).str.strip().str.upper()


def _term_code_sort_key(term_code: str) -> tuple[int, int]:
    raw = str(term_code or "").strip().upper()
    match = TERM_CODE_RE.match(raw)
    if not match:
        return (-1, -1)
    year = int(match.group("year"))
    term = match.group("term")
    season_rank = {"SP": 1, "SU": 2, "FA": 3}.get(term, 0)
    return (year, season_rank)


def _term_code_to_semester_label(term_code: str) -> str:
    raw = str(term_code or "").strip().upper()
    match = TERM_CODE_RE.match(raw)
    if not match:
        return raw
    return f"{TERM_TO_LABEL[match.group('term')]} {int(match.group('year'))}"


def _semester_header_sort_key(header: str) -> tuple[int, int]:
    raw = str(header or "").strip()
    match = SEMESTER_HEADER_RE.match(raw)
    if not match:
        return (-1, -1)
    season = match.group(1).upper()
    year = int(match.group(2))
    return (year, SEASON_RANK.get(season, 0))


def _build_backup(workbook_path: str) -> str:
    root = os.path.dirname(os.path.abspath(workbook_path))
    backups_dir = os.path.join(root, "backups")
    os.makedirs(backups_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(
        backups_dir,
        f"marquette_courses_full.pre_v16_{stamp}.xlsx",
    )
    shutil.copy2(workbook_path, backup_path)
    return backup_path


def _rename_track_ids(programs_df: pd.DataFrame) -> pd.DataFrame:
    out = programs_df.copy()
    out["program_id"] = _normalize_code(out.get("program_id", pd.Series(dtype=str)))
    out["kind"] = out.get("kind", "major").fillna("major").astype(str).str.strip().str.lower()

    is_track = out["kind"] == "track"
    out.loc[is_track, "program_id"] = out.loc[is_track, "program_id"].map(
        lambda pid: TRACK_RENAME_MAP.get(pid, pid if pid.endswith("_TRACK") else f"{pid}_TRACK")
    )

    if "parent_major_id" in out.columns:
        out["parent_major_id"] = _normalize_code(out["parent_major_id"])
    return out


def _migrate_programs(programs_df: pd.DataFrame) -> pd.DataFrame:
    out = _rename_track_ids(programs_df)
    if "program_label" not in out.columns:
        out["program_label"] = out["program_id"]
    if "active" not in out.columns:
        out["active"] = True
    if "requires_primary_major" not in out.columns:
        out["requires_primary_major"] = False
    if "applies_to_all" not in out.columns:
        out["applies_to_all"] = False

    out["applies_to_all"] = out["applies_to_all"].apply(_coerce_bool)

    bcc_mask = _normalize_code(out["program_id"]) == "BCC_CORE"
    if bcc_mask.any():
        idx = out[bcc_mask].index[0]
        out.loc[idx, "program_id"] = "BCC_CORE"
        out.loc[idx, "program_label"] = "Business Core Courses"
        out.loc[idx, "kind"] = "major"
        out.loc[idx, "parent_major_id"] = ""
        out.loc[idx, "active"] = True
        out.loc[idx, "requires_primary_major"] = False
        out.loc[idx, "applies_to_all"] = True
    else:
        sort_order = None
        if "sort_order" in out.columns:
            numeric_order = pd.to_numeric(out["sort_order"], errors="coerce")
            max_order = int(numeric_order.max()) if numeric_order.notna().any() else len(out) + 1
            sort_order = max_order + 1
        bcc_row = {
            "program_id": "BCC_CORE",
            "program_label": "Business Core Courses",
            "kind": "major",
            "parent_major_id": "",
            "active": True,
            "requires_primary_major": False,
            "applies_to_all": True,
        }
        if "sort_order" in out.columns:
            bcc_row["sort_order"] = sort_order
        if "notes" in out.columns:
            bcc_row["notes"] = "Universal shared BCC overlay."
        out = pd.concat([out, pd.DataFrame([bcc_row])], ignore_index=True)

    out = out.drop_duplicates(subset=["program_id"], keep="last")
    return out


def _migrate_buckets(buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = buckets_df.copy()
    out["program_id"] = _normalize_code(out.get("program_id", pd.Series(dtype=str)))
    out["bucket_id"] = out.get("bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    if "track_required" in out.columns:
        out["track_required"] = _normalize_code(out["track_required"])
        out["track_required"] = out["track_required"].replace(TRACK_RENAME_MAP)
    else:
        out["track_required"] = ""

    bcc_mask = out["bucket_id"] == "BCC"
    bcc_rows = out[bcc_mask].copy()
    out = out[~bcc_mask].copy()

    if len(bcc_rows) > 0:
        bcc_row = bcc_rows.iloc[0].copy()
        bcc_row["program_id"] = "BCC_CORE"
        bcc_row["bucket_id"] = "BCC"
        bcc_row["bucket_label"] = "Business Core Courses"
        bcc_row["track_required"] = ""
        if "active" in bcc_row.index:
            bcc_row["active"] = True
        out = pd.concat([out, pd.DataFrame([bcc_row])], ignore_index=True)

    out = out.drop_duplicates(subset=["program_id", "bucket_id"], keep="first")
    return out


def _migrate_sub_buckets(sub_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = sub_buckets_df.copy()
    out["program_id"] = _normalize_code(out.get("program_id", pd.Series(dtype=str)))
    out["bucket_id"] = out.get("bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    out["sub_bucket_id"] = out.get("sub_bucket_id", "").fillna("").astype(str).str.strip().str.upper()

    bcc_mask = out["bucket_id"] == "BCC"
    bcc_rows = out[bcc_mask].copy()
    out = out[~bcc_mask].copy()

    if len(bcc_rows) > 0:
        bcc_rows = bcc_rows.drop_duplicates(subset=["sub_bucket_id"], keep="first").copy()
        bcc_rows["program_id"] = "BCC_CORE"
        bcc_rows["bucket_id"] = "BCC"
        out = pd.concat([out, bcc_rows], ignore_index=True)

    out = out.drop_duplicates(subset=["program_id", "bucket_id", "sub_bucket_id"], keep="first")
    return out


def _enforce_fin_core(courses_all_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = courses_all_buckets_df.copy()
    out["program_id"] = _normalize_code(out.get("program_id", pd.Series(dtype=str)))
    out["sub_bucket_id"] = out.get("sub_bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()

    fin_core_mask = (
        (out["program_id"] == "FIN_MAJOR")
        & (out["sub_bucket_id"] == "FIN_CORE")
    )
    out = out[
        ~(
            fin_core_mask
            & (~out["course_code"].isin(FIN_CORE_EXPECTED))
        )
    ].copy()
    existing = set(out.loc[fin_core_mask, "course_code"].tolist())
    missing = sorted(FIN_CORE_EXPECTED - existing)
    if missing:
        rows = []
        for code in missing:
            row = {"program_id": "FIN_MAJOR", "sub_bucket_id": "FIN_CORE", "course_code": code}
            if "notes" in out.columns:
                row["notes"] = ""
            rows.append(row)
        out = pd.concat([out, pd.DataFrame(rows)], ignore_index=True)
    return out


def _migrate_courses_all_buckets(courses_all_buckets_df: pd.DataFrame) -> pd.DataFrame:
    out = courses_all_buckets_df.copy()
    out["program_id"] = _normalize_code(out.get("program_id", pd.Series(dtype=str)))
    out["sub_bucket_id"] = out.get("sub_bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()

    bcc_mask = out["sub_bucket_id"].str.startswith("BCC_")
    bcc_rows = out[bcc_mask].copy()
    out = out[~bcc_mask].copy()

    if len(bcc_rows) > 0:
        bcc_rows = bcc_rows.drop_duplicates(subset=["sub_bucket_id", "course_code"], keep="first").copy()
        bcc_rows["program_id"] = "BCC_CORE"
        out = pd.concat([out, bcc_rows], ignore_index=True)

    out = _enforce_fin_core(out)
    out = out.drop_duplicates(subset=["program_id", "sub_bucket_id", "course_code"], keep="first")
    return out


def _migrate_course_equivalencies(
    course_equivalencies_df: pd.DataFrame,
    courses_df: pd.DataFrame,
) -> pd.DataFrame:
    out = course_equivalencies_df.copy()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()

    if "course_name" not in out.columns:
        if "restriction_note" in out.columns:
            out = out.rename(columns={"restriction_note": "course_name"})
        else:
            out["course_name"] = ""

    if "restriction_note" in out.columns:
        restriction_fallback = out["restriction_note"].fillna("").astype(str).str.strip()
        name_mask = out["course_name"].fillna("").astype(str).str.strip() == ""
        out.loc[name_mask, "course_name"] = restriction_fallback[name_mask]
        out = out.drop(columns=["restriction_note"])

    course_name_map = (
        courses_df.assign(
            course_code=_normalize_code(courses_df.get("course_code", pd.Series(dtype=str))),
            course_name=courses_df.get("course_name", "").fillna("").astype(str).str.strip(),
        )
        .drop_duplicates(subset=["course_code"], keep="first")
        .set_index("course_code")["course_name"]
        .to_dict()
    )
    mapped_names = out["course_code"].map(course_name_map).fillna("")
    has_blank = out["course_name"].fillna("").astype(str).str.strip() == ""
    out.loc[has_blank, "course_name"] = mapped_names[has_blank]
    still_blank = out["course_name"].fillna("").astype(str).str.strip() == ""
    if "notes" in out.columns:
        out.loc[still_blank, "course_name"] = out.loc[still_blank, "notes"].fillna("").astype(str).str.strip()
        still_blank = out["course_name"].fillna("").astype(str).str.strip() == ""
    out.loc[still_blank, "course_name"] = out.loc[still_blank, "course_code"]

    out["program_scope"] = "FIN_MAJOR"
    return out


def _migrate_course_prereqs(course_prereqs_df: pd.DataFrame) -> pd.DataFrame:
    out = course_prereqs_df.copy()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()

    if "concurrent_with" in out.columns:
        concurrent = out["concurrent_with"].fillna("").astype(str).str.strip()
        out["concurrent_with"] = concurrent.mask(concurrent.str.lower() == "none", "")

    deterministic_rows = {
        "FINAI 4931": ("FINA 3001", "instructor_consent"),
        "MANA 3034": ("none", "standing_requirement"),
        "MANA 3035": ("none", "standing_requirement"),
        "MANA 4010": ("none", "standing_requirement"),
        "MARK 4085": ("MARK 3001", "standing_requirement"),
    }
    if "prerequisites" not in out.columns:
        out["prerequisites"] = "none"
    if "prereq_warnings" not in out.columns:
        out["prereq_warnings"] = ""
    for code, (prereq, warning) in deterministic_rows.items():
        mask = out["course_code"] == code
        if not mask.any():
            continue
        out.loc[mask, "prerequisites"] = prereq
        out.loc[mask, "prereq_warnings"] = warning

    return out


def _legacy_offerings_to_wide(
    offerings_df: pd.DataFrame,
    courses_df: pd.DataFrame,
) -> pd.DataFrame:
    src = offerings_df.copy()
    src["course_code"] = src.get("course_code", "").fillna("").astype(str).str.strip().str.upper()
    src["term_code"] = src.get("term_code", "").fillna("").astype(str).str.strip().str.upper()
    src["offered"] = src.get("offered", False).apply(_coerce_bool)
    src = src[(src["course_code"] != "") & (src["term_code"] != "")]

    term_codes = sorted(src["term_code"].unique().tolist(), key=_term_code_sort_key)
    if not term_codes:
        return pd.DataFrame(columns=["course_code"])

    pivot = src.pivot_table(
        index="course_code",
        columns="term_code",
        values="offered",
        aggfunc="max",
        fill_value=False,
    )
    pivot = pivot.reindex(columns=term_codes, fill_value=False)
    pivot = pivot.astype(bool)

    course_codes = (
        courses_df.get("course_code", pd.Series(dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )
    course_codes = [c for c in course_codes.tolist() if c]
    if course_codes:
        pivot = pivot.reindex(course_codes, fill_value=False)

    out = pivot.reset_index()
    rename_map = {tc: _term_code_to_semester_label(tc) for tc in term_codes}
    out = out.rename(columns=rename_map)
    return out


def _normalize_wide_offerings(
    offerings_df: pd.DataFrame,
    courses_df: pd.DataFrame,
) -> pd.DataFrame:
    out = offerings_df.copy()
    out["course_code"] = out.get("course_code", "").fillna("").astype(str).str.strip().str.upper()
    semester_cols = [
        col for col in out.columns
        if _semester_header_sort_key(col) != (-1, -1)
    ]
    semester_cols = sorted(semester_cols, key=_semester_header_sort_key)
    out = out[["course_code"] + semester_cols].copy()
    for col in semester_cols:
        out[col] = out[col].apply(_coerce_bool)

    course_codes = (
        courses_df.get("course_code", pd.Series(dtype=str))
        .fillna("")
        .astype(str)
        .str.strip()
        .str.upper()
    )
    course_codes = [c for c in course_codes.tolist() if c]
    if course_codes:
        out = out.set_index("course_code").reindex(course_codes, fill_value=False).reset_index()
    return out


def _migrate_course_offerings(
    course_offerings_df: pd.DataFrame,
    courses_df: pd.DataFrame,
) -> pd.DataFrame:
    cols = {c.strip().lower() for c in course_offerings_df.columns}
    if {"course_code", "term_code", "offered"}.issubset(cols):
        wide = _legacy_offerings_to_wide(course_offerings_df, courses_df)
        return wide
    return _normalize_wide_offerings(course_offerings_df, courses_df)


def _bucket_children_by_program(sub_buckets_df: pd.DataFrame) -> dict[tuple[str, str], list[str]]:
    sub = sub_buckets_df.copy()
    sub["program_id"] = _normalize_code(sub.get("program_id", pd.Series(dtype=str)))
    sub["bucket_id"] = sub.get("bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    sub["sub_bucket_id"] = sub.get("sub_bucket_id", "").fillna("").astype(str).str.strip().str.upper()
    out: dict[tuple[str, str], list[str]] = {}
    for (program_id, bucket_id), grp in sub.groupby(["program_id", "bucket_id"], dropna=False):
        members = sorted({str(v).strip().upper() for v in grp["sub_bucket_id"].tolist() if str(v).strip()})
        out[(program_id, bucket_id)] = members
    return out


def _to_bool(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y"}
    return bool(value)


def _canon_pair(a: str, b: str) -> tuple[str, str]:
    aa = str(a or "").strip().upper()
    bb = str(b or "").strip().upper()
    return (aa, bb) if aa <= bb else (bb, aa)


def _migrate_double_count_policy(
    policy_df: pd.DataFrame,
    sub_buckets_df: pd.DataFrame,
) -> pd.DataFrame:
    if policy_df is None or len(policy_df) == 0:
        return pd.DataFrame(
            columns=[
                "program_id",
                "sub_bucket_id_a",
                "sub_bucket_id_b",
                "allow_double_count",
                "reason",
            ]
        )

    out_rows: list[dict] = []
    children_lookup = _bucket_children_by_program(sub_buckets_df)
    policy = policy_df.copy()
    policy["program_id"] = _normalize_code(policy.get("program_id", pd.Series(dtype=str)))

    has_new_cols = {"sub_bucket_id_a", "sub_bucket_id_b"}.issubset(set(policy.columns))
    if has_new_cols:
        for _, row in policy.iterrows():
            program_id = str(row.get("program_id", "")).strip().upper()
            a = str(row.get("sub_bucket_id_a", "")).strip().upper()
            b = str(row.get("sub_bucket_id_b", "")).strip().upper()
            if not program_id or not a or not b:
                continue
            ca, cb = _canon_pair(a, b)
            out_rows.append(
                {
                    "program_id": program_id,
                    "sub_bucket_id_a": ca,
                    "sub_bucket_id_b": cb,
                    "allow_double_count": _to_bool(row.get("allow_double_count", False)),
                    "reason": str(row.get("reason", "") or "").strip(),
                }
            )
    else:
        for _, row in policy.iterrows():
            program_id = str(row.get("program_id", "")).strip().upper()
            if not program_id:
                continue
            node_type_a = str(row.get("node_type_a", "sub_bucket") or "sub_bucket").strip().lower()
            node_type_b = str(row.get("node_type_b", "sub_bucket") or "sub_bucket").strip().lower()
            node_id_a = str(
                row.get("node_id_a", row.get("bucket_id_a", ""))
            ).strip().upper()
            node_id_b = str(
                row.get("node_id_b", row.get("bucket_id_b", ""))
            ).strip().upper()
            allow = _to_bool(row.get("allow_double_count", False))
            reason = str(row.get("reason", "") or "").strip()
            if not node_id_a or not node_id_b:
                continue

            if node_type_a == "sub_bucket" and node_type_b == "sub_bucket":
                ca, cb = _canon_pair(node_id_a, node_id_b)
                out_rows.append(
                    {
                        "program_id": program_id,
                        "sub_bucket_id_a": ca,
                        "sub_bucket_id_b": cb,
                        "allow_double_count": allow,
                        "reason": reason,
                    }
                )
                continue

            if node_type_a == "bucket" and node_type_b == "bucket":
                left_children = children_lookup.get((program_id, node_id_a), [])
                right_children = children_lookup.get((program_id, node_id_b), [])
                for left in left_children:
                    for right in right_children:
                        if left == right:
                            continue
                        ca, cb = _canon_pair(left, right)
                        out_rows.append(
                            {
                                "program_id": program_id,
                                "sub_bucket_id_a": ca,
                                "sub_bucket_id_b": cb,
                                "allow_double_count": allow,
                                "reason": reason,
                            }
                        )

    out = pd.DataFrame(out_rows)
    if len(out) == 0:
        out = pd.DataFrame(
            columns=["program_id", "sub_bucket_id_a", "sub_bucket_id_b", "allow_double_count", "reason"]
        )
    out = out.drop_duplicates(
        subset=["program_id", "sub_bucket_id_a", "sub_bucket_id_b"],
        keep="last",
    )
    return out


def migrate_workbook(path: str, dry_run: bool = False) -> tuple[pd.ExcelFile, dict[str, pd.DataFrame], str | None]:
    abs_path = os.path.abspath(path)
    xl = pd.ExcelFile(abs_path)
    sheet_order = xl.sheet_names
    sheets = {name: xl.parse(name) for name in sheet_order}

    courses_df = sheets.get("courses", pd.DataFrame()).copy()
    programs_df = sheets.get("programs", pd.DataFrame()).copy()
    buckets_df = sheets.get("buckets", pd.DataFrame()).copy()
    sub_buckets_df = sheets.get("sub_buckets", pd.DataFrame()).copy()
    courses_all_buckets_df = sheets.get("courses_all_buckets", pd.DataFrame()).copy()
    course_equivalencies_df = sheets.get("course_equivalencies", pd.DataFrame()).copy()
    course_prereqs_df = sheets.get("course_prereqs", pd.DataFrame()).copy()
    course_offerings_df = sheets.get("course_offerings", pd.DataFrame()).copy()
    double_count_policy_df = sheets.get("double_count_policy", pd.DataFrame()).copy()

    programs_v16 = _migrate_programs(programs_df)
    buckets_v16 = _migrate_buckets(buckets_df)
    sub_buckets_v16 = _migrate_sub_buckets(sub_buckets_df)
    cab_v16 = _migrate_courses_all_buckets(courses_all_buckets_df)
    equiv_v16 = _migrate_course_equivalencies(course_equivalencies_df, courses_df)
    prereqs_v16 = _migrate_course_prereqs(course_prereqs_df)
    offerings_v16 = _migrate_course_offerings(course_offerings_df, courses_df)
    policy_v16 = _migrate_double_count_policy(double_count_policy_df, sub_buckets_v16)

    if "track_required" in buckets_v16.columns:
        buckets_v16["track_required"] = _normalize_code(buckets_v16["track_required"]).replace(TRACK_RENAME_MAP)

    sheets["programs"] = programs_v16
    sheets["buckets"] = buckets_v16
    sheets["sub_buckets"] = sub_buckets_v16
    sheets["courses_all_buckets"] = cab_v16
    sheets["course_equivalencies"] = equiv_v16
    sheets["course_prereqs"] = prereqs_v16
    sheets["course_offerings"] = offerings_v16
    sheets["double_count_policy"] = policy_v16

    backup_path = None
    if not dry_run:
        backup_path = _build_backup(abs_path)
        with pd.ExcelWriter(abs_path, engine="openpyxl") as writer:
            for sheet_name in sheet_order:
                df = sheets.get(sheet_name, pd.DataFrame())
                df.to_excel(writer, sheet_name=sheet_name, index=False)
    return xl, sheets, backup_path


def _print_summary(sheets: dict[str, pd.DataFrame], backup_path: str | None, dry_run: bool) -> None:
    programs = sheets["programs"]
    tracks = programs[programs["kind"].fillna("").astype(str).str.strip().str.lower() == "track"]
    bcc_buckets = sheets["buckets"][
        sheets["buckets"]["bucket_id"].fillna("").astype(str).str.strip().str.upper() == "BCC"
    ]
    offerings = sheets["course_offerings"]
    semester_cols = [c for c in offerings.columns if _semester_header_sort_key(c) != (-1, -1)]

    print("[INFO] v1.6 migration summary")
    print(f"  - Dry run: {dry_run}")
    if backup_path:
        print(f"  - Backup: {backup_path}")
    print(f"  - Programs: {len(programs)} rows")
    print(f"  - Tracks renamed: {len(tracks)} track rows")
    print(f"  - BCC bucket ownership rows: {len(bcc_buckets)}")
    print(f"  - Course offerings semester columns: {len(semester_cols)}")
    if semester_cols:
        print(f"    latest: {sorted(semester_cols, key=_semester_header_sort_key)[-3:]}")
    print(f"  - Double-count policy rows: {len(sheets['double_count_policy'])}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Migrate workbook to v1.6 data model.")
    parser.add_argument(
        "--path",
        default=DEFAULT_WORKBOOK,
        help="Path to workbook (default: marquette_courses_full.xlsx).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute migration without writing workbook.",
    )
    args = parser.parse_args(argv)

    workbook_path = os.path.abspath(args.path)
    if not os.path.exists(workbook_path):
        print(f"[ERROR] Workbook not found: {workbook_path}")
        return 1

    _, sheets, backup_path = migrate_workbook(workbook_path, dry_run=args.dry_run)
    _print_summary(sheets, backup_path, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
