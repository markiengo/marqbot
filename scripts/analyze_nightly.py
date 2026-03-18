import argparse
import json
from pathlib import Path

import pandas as pd


MAX_OVERRIDE_ENTRIES = 20
MAX_OVERRIDE_BOOST = 2


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _normalize_text(value) -> str:
    return str(value or "").strip()


def _normalize_upper(value) -> str:
    return _normalize_text(value).upper()


def _normalize_bucket_id(bucket_id: str) -> str:
    return _normalize_upper(bucket_id)


def _parse_bucket_id(bucket_id: str) -> tuple[str, str]:
    raw = _normalize_bucket_id(bucket_id)
    parent_id, sep, child_id = raw.partition("::")
    if sep:
        return parent_id, child_id
    return "", raw


def _coerce_float(value) -> float | None:
    text = _normalize_text(value)
    if not text or text.lower() == "nan":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _load_json(path: Path, default):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def _load_catalog_tables(
    *,
    child_buckets_path: Path,
    master_bucket_courses_path: Path,
    parent_buckets_path: Path,
    courses_path: Path,
) -> dict:
    child_df = pd.read_csv(child_buckets_path, dtype=str, keep_default_na=False)
    master_df = pd.read_csv(master_bucket_courses_path, dtype=str, keep_default_na=False)
    parent_df = pd.read_csv(parent_buckets_path, dtype=str, keep_default_na=False)
    courses_df = pd.read_csv(courses_path, dtype=str, keep_default_na=False)

    child_df["parent_bucket_id"] = child_df["parent_bucket_id"].map(_normalize_upper)
    child_df["child_bucket_id"] = child_df["child_bucket_id"].map(_normalize_upper)
    child_df["requirement_mode"] = child_df["requirement_mode"].map(lambda v: _normalize_text(v).lower())
    child_df["courses_required_num"] = child_df["courses_required"].map(_coerce_float)
    child_df["credits_required_num"] = child_df["credits_required"].map(_coerce_float)
    child_df["min_level_num"] = child_df["min_level"].map(_coerce_float)

    master_df["parent_bucket_id"] = master_df["parent_bucket_id"].map(_normalize_upper)
    master_df["child_bucket_id"] = master_df["child_bucket_id"].map(_normalize_upper)
    master_df["course_code"] = master_df["course_code"].map(_normalize_upper)

    parent_df["parent_bucket_id"] = parent_df["parent_bucket_id"].map(_normalize_upper)
    parent_df["type"] = parent_df.get("type", pd.Series(dtype=str)).map(lambda v: _normalize_text(v).lower())

    courses_df["course_code"] = courses_df["course_code"].map(_normalize_upper)
    courses_df["credits_num"] = courses_df.get("credits", pd.Series(dtype=str)).map(_coerce_float)
    courses_df["level_num"] = courses_df.get("level", pd.Series(dtype=str)).map(_coerce_float)

    child_lookup = {
        (row["parent_bucket_id"], row["child_bucket_id"]): row
        for _, row in child_df.iterrows()
    }
    parent_type_lookup = {
        row["parent_bucket_id"]: row.get("type", "")
        for _, row in parent_df.iterrows()
    }
    course_lookup = {
        row["course_code"]: row
        for _, row in courses_df.iterrows()
    }

    return {
        "child_lookup": child_lookup,
        "parent_type_lookup": parent_type_lookup,
        "master_df": master_df,
        "course_lookup": course_lookup,
    }


def _extract_failure_kind(details: list[str]) -> str:
    for detail in details:
        text = _normalize_text(detail)
        if text.lower().startswith("failure kind:"):
            return text.split(":", 1)[1].strip().upper()
    return ""


def _bucket_capacity(bucket_id: str, tables: dict) -> dict:
    parent_id, child_id = _parse_bucket_id(bucket_id)
    child_row = tables["child_lookup"].get((parent_id, child_id))
    if child_row is None:
        return {
            "bucket_id": _normalize_bucket_id(bucket_id),
            "parent_bucket_id": parent_id,
            "child_bucket_id": child_id,
            "exists": False,
        }

    mapped = tables["master_df"]
    mapped = mapped[
        (mapped["parent_bucket_id"] == parent_id)
        & (mapped["child_bucket_id"] == child_id)
    ].copy()
    mapped_codes = []
    mapped_credit_capacity = 0.0
    min_level = child_row.get("min_level_num")
    for course_code in mapped["course_code"].tolist():
        row = tables["course_lookup"].get(course_code)
        if row is None:
            continue
        level = row.get("level_num")
        if min_level is not None and level is not None and level < min_level:
            continue
        mapped_codes.append(course_code)
        mapped_credit_capacity += float(row.get("credits_num") or 0.0)

    return {
        "bucket_id": f"{parent_id}::{child_id}",
        "parent_bucket_id": parent_id,
        "child_bucket_id": child_id,
        "exists": True,
        "requirement_mode": _normalize_text(child_row.get("requirement_mode")).lower(),
        "courses_required": child_row.get("courses_required_num"),
        "credits_required": child_row.get("credits_required_num"),
        "min_level": child_row.get("min_level_num"),
        "parent_type": tables["parent_type_lookup"].get(parent_id, ""),
        "mapped_course_codes": sorted(set(mapped_codes)),
        "mapped_course_count": len(set(mapped_codes)),
        "mapped_credit_capacity": mapped_credit_capacity,
    }


def _classify_bucket_issue(
    *,
    bucket_id: str,
    reason: str,
    status: str,
    failure_kind: str,
    tables: dict,
) -> dict:
    normalized_reason = _normalize_text(reason).lower()
    normalized_status = _normalize_text(status).lower()
    normalized_failure_kind = _normalize_text(failure_kind).upper()
    capacity = _bucket_capacity(bucket_id, tables)

    if "program selection failed" in normalized_reason or "declared_majors cannot be empty" in normalized_reason:
        return {
            "classification": "SETUP",
            "csv_to_check": "parent_buckets.csv",
            "what_to_look_for": "Check parent_major, required_major, and primary-major metadata for the selected programs.",
            "capacity": capacity,
        }
    if not capacity["exists"]:
        return {
            "classification": "SETUP",
            "csv_to_check": "child_buckets.csv",
            "what_to_look_for": "The failing bucket is missing from child_buckets.csv or is named inconsistently.",
            "capacity": capacity,
        }

    if capacity["requirement_mode"] == "credits_pool":
        if (capacity["credits_required"] or 0.0) > capacity["mapped_credit_capacity"]:
            return {
                "classification": "DATA",
                "csv_to_check": "child_buckets.csv",
                "what_to_look_for": "Compare credits_required and min_level against the mapped course credit capacity.",
                "capacity": capacity,
            }
    else:
        needed_count = capacity["courses_required"] or 0.0
        if needed_count > capacity["mapped_course_count"]:
            return {
                "classification": "DATA",
                "csv_to_check": "master_bucket_courses.csv",
                "what_to_look_for": "The bucket does not have enough mapped courses to satisfy its required count.",
                "capacity": capacity,
            }

    if normalized_failure_kind in {"ELIGIBILITY_GAP", "MANUAL_REVIEW_BLOCK"} or "prereq" in normalized_reason:
        return {
            "classification": "DATA",
            "csv_to_check": "course_hard_prereqs.csv",
            "what_to_look_for": "Check prerequisite chains, manual-review blockers, and impossible eligibility gates.",
            "capacity": capacity,
        }

    if "invalid seeded history" in normalized_status:
        return {
            "classification": "SETUP",
            "csv_to_check": "parent_buckets.csv",
            "what_to_look_for": "Review the selected program combination and seeded-history setup metadata.",
            "capacity": capacity,
        }

    return {
        "classification": "ALGORITHM",
        "csv_to_check": "master_bucket_courses.csv",
        "what_to_look_for": "The bucket has enough mapped capacity; the planner is likely not prioritizing it early enough.",
        "capacity": capacity,
    }


def _build_active_bucket_issues(report_data: dict, tables: dict) -> dict[str, dict]:
    aggregated: dict[str, dict] = {}
    for record in report_data.get("records") or []:
        scenario_label = _normalize_text(record.get("scenario_label"))
        failure_kind = _normalize_text(record.get("failure_kind")).upper()
        for bucket_id in list(dict.fromkeys(record.get("unsatisfied_buckets") or [])):
            bucket_key = _normalize_bucket_id(bucket_id)
            classification = _classify_bucket_issue(
                bucket_id=bucket_key,
                reason=_normalize_text(record.get("reason")),
                status=_normalize_text(record.get("status")),
                failure_kind=failure_kind,
                tables=tables,
            )
            entry = aggregated.setdefault(
                bucket_key,
                {
                    "bucket_id": bucket_key,
                    "affected_combos": set(),
                    "occurrences": 0,
                    "classification": classification["classification"],
                    "csv_to_check": classification["csv_to_check"],
                    "what_to_look_for": classification["what_to_look_for"],
                    "example_reason": _normalize_text(record.get("reason")),
                    "example_status": _normalize_text(record.get("status")),
                    "failure_kind": failure_kind,
                    "capacity": classification["capacity"],
                },
            )
            entry["affected_combos"].add(scenario_label)
            entry["occurrences"] += 1
            if entry["classification"] != classification["classification"]:
                entry["classification"] = "DATA"

    for record in report_data.get("supplemental_records") or []:
        scenario_label = _normalize_text(record.get("scenario_label"))
        failure_kind = _extract_failure_kind(record.get("details") or [])
        for bucket_id in list(dict.fromkeys(record.get("unsatisfied_buckets") or [])):
            bucket_key = _normalize_bucket_id(bucket_id)
            classification = _classify_bucket_issue(
                bucket_id=bucket_key,
                reason=_normalize_text(record.get("reason")),
                status=_normalize_text(record.get("issue_kind")),
                failure_kind=failure_kind,
                tables=tables,
            )
            entry = aggregated.setdefault(
                bucket_key,
                {
                    "bucket_id": bucket_key,
                    "affected_combos": set(),
                    "occurrences": 0,
                    "classification": classification["classification"],
                    "csv_to_check": classification["csv_to_check"],
                    "what_to_look_for": classification["what_to_look_for"],
                    "example_reason": _normalize_text(record.get("reason")),
                    "example_status": _normalize_text(record.get("issue_kind")),
                    "failure_kind": failure_kind,
                    "capacity": classification["capacity"],
                },
            )
            entry["affected_combos"].add(scenario_label)
            entry["occurrences"] += 1
            if entry["classification"] != classification["classification"]:
                entry["classification"] = "DATA"

    for entry in aggregated.values():
        entry["affected_combos"] = len([combo for combo in entry["affected_combos"] if combo])
    return aggregated


def _load_overrides(path: Path) -> dict:
    payload = _load_json(
        path,
        {
            "version": 1,
            "last_updated": "",
            "bucket_priority_boosts": {},
            "failure_history": {},
        },
    )
    payload.setdefault("bucket_priority_boosts", {})
    payload.setdefault("failure_history", {})
    return payload


def _desired_boost(consecutive_failures: int) -> int:
    if consecutive_failures >= 3:
        return -2
    if consecutive_failures >= 1:
        return -1
    return 0


def _build_queue(
    *,
    active_issues: dict[str, dict],
    existing_queue: list[dict],
    report_date: str,
) -> list[dict]:
    existing_by_bucket = {
        _normalize_bucket_id(item.get("bucket_id")): item
        for item in existing_queue
    }
    queue = []
    for bucket_id, issue in sorted(active_issues.items()):
        if issue["classification"] != "DATA":
            continue
        previous = existing_by_bucket.get(bucket_id, {})
        parent_id, _child_id = _parse_bucket_id(bucket_id)
        queue.append({
            "bucket_id": bucket_id,
            "parent_program": parent_id,
            "csv_to_check": issue["csv_to_check"],
            "what_to_look_for": issue["what_to_look_for"],
            "affected_combos": issue["affected_combos"],
            "first_seen": previous.get("first_seen") or report_date,
            "last_seen": report_date,
        })
    queue.sort(key=lambda item: (-item["affected_combos"], item["bucket_id"]))
    return queue


def _update_overrides(
    *,
    overrides_payload: dict,
    active_issues: dict[str, dict],
    report_date: str,
) -> tuple[dict, list[dict]]:
    failure_history = {
        _normalize_bucket_id(bucket_id): dict(history)
        for bucket_id, history in (overrides_payload.get("failure_history") or {}).items()
    }
    previous_boosts = {
        _normalize_bucket_id(bucket_id): int(value)
        for bucket_id, value in (overrides_payload.get("bucket_priority_boosts") or {}).items()
    }

    algorithm_buckets = {
        bucket_id: issue
        for bucket_id, issue in active_issues.items()
        if issue["classification"] == "ALGORITHM"
    }

    all_bucket_ids = set(failure_history) | set(previous_boosts) | set(active_issues)
    for bucket_id in sorted(all_bucket_ids):
        history = failure_history.setdefault(bucket_id, {})
        current_streak = int(history.get("consecutive_failures", 0) or 0)
        if bucket_id in algorithm_buckets:
            current_streak += 1
            issue = algorithm_buckets[bucket_id]
            history.update({
                "consecutive_failures": current_streak,
                "last_seen": report_date,
                "classification": issue["classification"],
                "last_reason": issue["example_reason"],
                "last_failure_kind": issue["failure_kind"],
                "affected_combos": issue["affected_combos"],
            })
        else:
            current_streak = max(0, current_streak - 1)
            history["consecutive_failures"] = current_streak
            history["last_seen"] = report_date
        if current_streak == 0 and bucket_id not in algorithm_buckets:
            failure_history.pop(bucket_id, None)

    ranked_candidates = sorted(
        (
            (bucket_id, history)
            for bucket_id, history in failure_history.items()
            if _desired_boost(int(history.get("consecutive_failures", 0) or 0)) < 0
        ),
        key=lambda item: (
            -int(item[1].get("consecutive_failures", 0) or 0),
            item[0],
        ),
    )[:MAX_OVERRIDE_ENTRIES]

    next_boosts = {
        bucket_id: _desired_boost(int(history.get("consecutive_failures", 0) or 0))
        for bucket_id, history in ranked_candidates
    }

    override_changes = []
    changed_bucket_ids = set(previous_boosts) | set(next_boosts)
    for bucket_id in sorted(changed_bucket_ids):
        before = previous_boosts.get(bucket_id, 0)
        after = next_boosts.get(bucket_id, 0)
        if before == after:
            continue
        override_changes.append({
            "bucket_id": bucket_id,
            "before": before,
            "after": after,
        })

    updated_payload = {
        "version": 1,
        "last_updated": report_date,
        "bucket_priority_boosts": next_boosts,
        "failure_history": failure_history,
    }
    return updated_payload, override_changes


def _build_pr_body(summary: dict) -> str:
    lines = [
        f"# Nightly Auto-Tune Summary ({summary['report_date']})",
        "",
        f"- Override changes: {summary['override_change_count']}",
        f"- Active data-investigation items: {summary['queue_count']}",
        "",
    ]

    if summary["override_changes"]:
        lines.append("## Override Changes")
        for change in summary["override_changes"]:
            lines.append(
                f"- `{change['bucket_id']}`: {change['before']} -> {change['after']}"
            )
        lines.append("")

    if summary["top_algorithm_buckets"]:
        lines.append("## Algorithm Buckets")
        for bucket in summary["top_algorithm_buckets"]:
            lines.append(
                f"- `{bucket['bucket_id']}` ({bucket['affected_combos']} combos): {bucket['what_to_look_for']}"
            )
        lines.append("")

    if summary["top_data_buckets"]:
        lines.append("## Data Investigation Queue")
        for bucket in summary["top_data_buckets"]:
            lines.append(
                f"- `{bucket['bucket_id']}`: check `{bucket['csv_to_check']}` ({bucket['what_to_look_for']})"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def analyze_report(
    *,
    report_path: Path,
    child_buckets_path: Path,
    master_bucket_courses_path: Path,
    parent_buckets_path: Path,
    courses_path: Path,
    overrides_path: Path,
    queue_path: Path,
    dry_run: bool = False,
) -> dict:
    report_data = _load_json(report_path, {})
    report_date = _normalize_text(report_data.get("report_date")) or report_path.stem
    tables = _load_catalog_tables(
        child_buckets_path=child_buckets_path,
        master_bucket_courses_path=master_bucket_courses_path,
        parent_buckets_path=parent_buckets_path,
        courses_path=courses_path,
    )

    active_issues = _build_active_bucket_issues(report_data, tables)
    existing_queue = _load_json(queue_path, [])
    overrides_payload = _load_overrides(overrides_path)
    updated_overrides, override_changes = _update_overrides(
        overrides_payload=overrides_payload,
        active_issues=active_issues,
        report_date=report_date,
    )
    updated_queue = _build_queue(
        active_issues=active_issues,
        existing_queue=existing_queue,
        report_date=report_date,
    )

    if not dry_run:
        _write_json(overrides_path, updated_overrides)
        _write_json(queue_path, updated_queue)

    top_algorithm_buckets = [
        {
            "bucket_id": bucket_id,
            "affected_combos": issue["affected_combos"],
            "what_to_look_for": issue["what_to_look_for"],
        }
        for bucket_id, issue in sorted(
            active_issues.items(),
            key=lambda item: (-item[1]["affected_combos"], -item[1]["occurrences"], item[0]),
        )
        if issue["classification"] == "ALGORITHM"
    ][:5]
    top_data_buckets = [
        {
            "bucket_id": bucket_id,
            "affected_combos": issue["affected_combos"],
            "csv_to_check": issue["csv_to_check"],
            "what_to_look_for": issue["what_to_look_for"],
        }
        for bucket_id, issue in sorted(
            active_issues.items(),
            key=lambda item: (-item[1]["affected_combos"], -item[1]["occurrences"], item[0]),
        )
        if issue["classification"] == "DATA"
    ][:5]
    summary = {
        "report_date": report_date,
        "override_change_count": len(override_changes),
        "override_changes": override_changes,
        "queue_count": len(updated_queue),
        "top_algorithm_buckets": top_algorithm_buckets,
        "top_data_buckets": top_data_buckets,
        "dry_run": dry_run,
    }
    summary["pr_body"] = _build_pr_body(summary)
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description="Analyze nightly JSON report and update ranking overrides.")
    parser.add_argument("--report", required=True, help="Path to the nightly JSON report")
    parser.add_argument("--summary-out", help="Optional path to write a JSON summary")
    parser.add_argument("--pr-body-out", help="Optional path to write a Markdown PR body")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing config files")
    args = parser.parse_args(argv)

    repo_root = _repo_root()
    summary = analyze_report(
        report_path=Path(args.report).resolve(),
        child_buckets_path=repo_root / "data" / "child_buckets.csv",
        master_bucket_courses_path=repo_root / "data" / "master_bucket_courses.csv",
        parent_buckets_path=repo_root / "data" / "parent_buckets.csv",
        courses_path=repo_root / "data" / "courses.csv",
        overrides_path=repo_root / "config" / "ranking_overrides.json",
        queue_path=repo_root / "config" / "data_investigation_queue.json",
        dry_run=args.dry_run,
    )

    if args.summary_out:
        _write_json(Path(args.summary_out).resolve(), summary)
    if args.pr_body_out:
        Path(args.pr_body_out).resolve().write_text(summary["pr_body"], encoding="utf-8")

    print(json.dumps({
        "report_date": summary["report_date"],
        "override_change_count": summary["override_change_count"],
        "queue_count": summary["queue_count"],
        "dry_run": summary["dry_run"],
    }, indent=2))


if __name__ == "__main__":
    main()
