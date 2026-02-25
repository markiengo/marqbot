"""Investigate bucket structure for v1.6 model debugging."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from data_loader import load_data

DATA = os.path.join(os.path.dirname(__file__), "..", "marquette_courses_full.xlsx")
data = load_data(os.path.abspath(DATA))

lines = []

# 1. Show all sub-buckets for FIN_MAJOR program
buckets_df = data["buckets_df"]
fin_buckets = buckets_df[buckets_df["track_id"].str.contains("FIN", case=False, na=False)]
lines.append("=== FIN-related sub-buckets (runtime buckets_df) ===")
for _, row in fin_buckets.iterrows():
    lines.append(f"  track={row['track_id']} bucket={row['bucket_id']} label='{row['bucket_label']}' parent={row.get('parent_bucket_id','')} role={row.get('role','')} priority={row['priority']}")

# 2. Show all v2 sub_buckets for FIN
v2_sub = data["v2_sub_buckets_df"]
fin_v2_sub = v2_sub[v2_sub["program_id"].str.contains("FIN", case=False, na=False)]
lines.append("\n=== V2 sub_buckets for FIN programs ===")
for _, row in fin_v2_sub.iterrows():
    lines.append(f"  program={row['program_id']} bucket={row['bucket_id']} sub_bucket={row['sub_bucket_id']} label='{row['sub_bucket_label']}' role={row.get('role','')}")

# 3. Show all v2 buckets for FIN
v2_buckets = data["v2_buckets_df"]
fin_v2_buckets = v2_buckets[v2_buckets["program_id"].str.contains("FIN", case=False, na=False)]
lines.append("\n=== V2 buckets for FIN programs ===")
for _, row in fin_v2_buckets.iterrows():
    lines.append(f"  program={row['program_id']} bucket={row['bucket_id']} label='{row['bucket_label']}'")

# 4. Course mappings for FIN_CORE specifically
cab = data["v2_courses_all_buckets_df"]
fin_core_rows = cab[cab["sub_bucket_id"] == "FIN_CORE"]
lines.append(f"\n=== Courses in FIN_CORE sub_bucket ({len(fin_core_rows)} rows) ===")
for _, row in fin_core_rows.iterrows():
    lines.append(f"  program={row['program_id']} course={row['course_code']}")

# 5. Double-count policy for FIN
policy_df = data.get("v2_double_count_policy_df")
if policy_df is not None and len(policy_df) > 0:
    if {"sub_bucket_id_a", "sub_bucket_id_b"}.issubset(set(policy_df.columns)):
        fin_policy = policy_df[
            policy_df.apply(
                lambda r: "FIN" in str(r.get("sub_bucket_id_a", "")).upper()
                or "FIN" in str(r.get("sub_bucket_id_b", "")).upper(),
                axis=1,
            )
        ]
    else:
        fin_policy = policy_df[
            policy_df.apply(
                lambda r: "FIN" in str(r.get("node_id_a", "")).upper()
                or "FIN" in str(r.get("node_id_b", "")).upper(),
                axis=1,
            )
        ]
    lines.append(f"\n=== Double-count policy rows mentioning FIN ({len(fin_policy)} rows) ===")
    for _, row in fin_policy.iterrows():
        if {"sub_bucket_id_a", "sub_bucket_id_b"}.issubset(set(fin_policy.columns)):
            lines.append(
                f"  {row.get('sub_bucket_id_a','')} <-> {row.get('sub_bucket_id_b','')} "
                f"allow={row.get('allow_double_count','')} reason='{row.get('reason','')}'"
            )
        else:
            lines.append(
                f"  {row.get('node_type_a','')}/{row.get('node_id_a','')} <-> "
                f"{row.get('node_type_b','')}/{row.get('node_id_b','')} "
                f"allow={row.get('allow_double_count','')} reason='{row.get('reason','')}'"
            )
else:
    lines.append("\n=== No double-count policy data ===")

# 6. Search for INBUI 4931 variants (and legacy INBU prefix)
courses_df = data["courses_df"]
inbu = courses_df[courses_df["course_code"].str.contains("INBU", case=False, na=False)]
lines.append(f"\n=== INBU-prefix courses in catalog ({len(inbu)} rows) ===")
for _, row in inbu.iterrows():
    lines.append(f"  {row['course_code']}: {row.get('course_name','')}")

# Also check for INBUI
inbui = courses_df[courses_df["course_code"].str.contains("INBUI", case=False, na=False)]
lines.append(f"\n=== INBUI courses in catalog ({len(inbui)} rows) ===")
for _, row in inbui.iterrows():
    lines.append(f"  {row['course_code']}: {row.get('course_name','')}")

print("\n".join(lines))
