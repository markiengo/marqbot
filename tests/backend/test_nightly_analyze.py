import json

from analyze_nightly import analyze_report


def _write_csv(path, header, rows):
    lines = [",".join(header)]
    lines.extend(",".join(row) for row in rows)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_analyze_nightly_queues_data_shortfall(tmp_path):
    report_path = tmp_path / "2026-03-15.json"
    report_path.write_text(json.dumps({
        "report_date": "2026-03-15",
        "records": [
            {
                "scenario_label": "triple-A+B+C",
                "reason": "The student still had unfinished requirement buckets by semester 8.",
                "status": "not graduated by semester 8",
                "failure_kind": "",
                "unsatisfied_buckets": ["FIN_MAJOR::FIN_CORE"],
            }
        ],
        "supplemental_records": [],
    }), encoding="utf-8")

    child_path = tmp_path / "child_buckets.csv"
    master_path = tmp_path / "master_bucket_courses.csv"
    parent_path = tmp_path / "parent_buckets.csv"
    courses_path = tmp_path / "courses.csv"
    overrides_path = tmp_path / "ranking_overrides.json"
    queue_path = tmp_path / "data_investigation_queue.json"

    _write_csv(child_path, ["parent_bucket_id", "child_bucket_id", "requirement_mode", "courses_required", "credits_required", "min_level"], [
        ["FIN_MAJOR", "FIN_CORE", "required", "2", "", ""],
    ])
    _write_csv(master_path, ["parent_bucket_id", "child_bucket_id", "course_code"], [
        ["FIN_MAJOR", "FIN_CORE", "FINA 3001"],
    ])
    _write_csv(parent_path, ["parent_bucket_id", "type"], [
        ["FIN_MAJOR", "major"],
    ])
    _write_csv(courses_path, ["course_code", "credits", "level"], [
        ["FINA 3001", "3", "3000"],
    ])
    overrides_path.write_text(json.dumps({
        "version": 1,
        "last_updated": "",
        "bucket_priority_boosts": {},
        "failure_history": {},
    }), encoding="utf-8")
    queue_path.write_text("[]", encoding="utf-8")

    summary = analyze_report(
        report_path=report_path,
        child_buckets_path=child_path,
        master_bucket_courses_path=master_path,
        parent_buckets_path=parent_path,
        courses_path=courses_path,
        overrides_path=overrides_path,
        queue_path=queue_path,
        dry_run=False,
    )

    queue = json.loads(queue_path.read_text(encoding="utf-8"))
    overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
    assert summary["queue_count"] == 1
    assert queue[0]["bucket_id"] == "FIN_MAJOR::FIN_CORE"
    assert queue[0]["csv_to_check"] == "master_bucket_courses.csv"
    assert overrides["bucket_priority_boosts"] == {}


def test_analyze_nightly_promotes_algorithm_bucket_after_streak(tmp_path):
    report_path = tmp_path / "2026-03-16.json"
    report_path.write_text(json.dumps({
        "report_date": "2026-03-16",
        "records": [
            {
                "scenario_label": "triple-A+B+C",
                "reason": "The student still had unfinished requirement buckets by semester 8.",
                "status": "not graduated by semester 8",
                "failure_kind": "SELECTION_GAP",
                "unsatisfied_buckets": ["FIN_MAJOR::FIN_CORE"],
            }
        ],
        "supplemental_records": [],
    }), encoding="utf-8")

    child_path = tmp_path / "child_buckets.csv"
    master_path = tmp_path / "master_bucket_courses.csv"
    parent_path = tmp_path / "parent_buckets.csv"
    courses_path = tmp_path / "courses.csv"
    overrides_path = tmp_path / "ranking_overrides.json"
    queue_path = tmp_path / "data_investigation_queue.json"

    _write_csv(child_path, ["parent_bucket_id", "child_bucket_id", "requirement_mode", "courses_required", "credits_required", "min_level"], [
        ["FIN_MAJOR", "FIN_CORE", "required", "1", "", ""],
    ])
    _write_csv(master_path, ["parent_bucket_id", "child_bucket_id", "course_code"], [
        ["FIN_MAJOR", "FIN_CORE", "FINA 3001"],
    ])
    _write_csv(parent_path, ["parent_bucket_id", "type"], [
        ["FIN_MAJOR", "major"],
    ])
    _write_csv(courses_path, ["course_code", "credits", "level"], [
        ["FINA 3001", "3", "3000"],
    ])
    overrides_path.write_text(json.dumps({
        "version": 1,
        "last_updated": "2026-03-15",
        "bucket_priority_boosts": {},
        "failure_history": {
            "FIN_MAJOR::FIN_CORE": {
                "consecutive_failures": 0,
                "last_seen": "2026-03-15",
            }
        },
    }), encoding="utf-8")
    queue_path.write_text("[]", encoding="utf-8")

    summary = analyze_report(
        report_path=report_path,
        child_buckets_path=child_path,
        master_bucket_courses_path=master_path,
        parent_buckets_path=parent_path,
        courses_path=courses_path,
        overrides_path=overrides_path,
        queue_path=queue_path,
        dry_run=False,
    )

    overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
    assert summary["override_change_count"] == 1
    assert overrides["bucket_priority_boosts"]["FIN_MAJOR::FIN_CORE"] == -1
