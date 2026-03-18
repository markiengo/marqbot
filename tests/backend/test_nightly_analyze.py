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


def _setup_multi_major_fixture(tmp_path, *, extra_records=None):
    """Shared fixture builder for feasibility / concentration / ledger tests."""
    child_path = tmp_path / "child_buckets.csv"
    master_path = tmp_path / "master_bucket_courses.csv"
    parent_path = tmp_path / "parent_buckets.csv"
    courses_path = tmp_path / "courses.csv"
    overrides_path = tmp_path / "ranking_overrides.json"
    queue_path = tmp_path / "data_investigation_queue.json"

    # Two majors + one universal. Major A needs 30 courses, Major B needs 25.
    # Universal (BCC) needs 20. With overlap, naive total = 75.
    # BCC shares 5 courses with A and 3 with B => overlap = 8.
    # min_courses = 75 - 8 = 67 >> 48 => INFEASIBLE.
    _write_csv(child_path, [
        "parent_bucket_id", "child_bucket_id", "requirement_mode",
        "courses_required", "credits_required", "min_level",
    ], [
        ["MAJOR_A", "A_CORE", "required", "30", "", ""],
        ["MAJOR_B", "B_CORE", "required", "25", "", ""],
        ["BCC", "BCC_REQ", "required", "20", "", ""],
    ])

    a_courses = [f"SUBJ_A {i:04d}" for i in range(1, 31)]
    b_courses = [f"SUBJ_B {i:04d}" for i in range(1, 26)]
    bcc_courses = [f"BCC {i:04d}" for i in range(1, 21)]
    # Overlap: BCC 0001-0005 also map to MAJOR_A, BCC 0001-0003 also to MAJOR_B.
    overlap_a = bcc_courses[:5]
    overlap_b = bcc_courses[:3]

    master_rows = []
    for c in a_courses:
        master_rows.append(["MAJOR_A", "A_CORE", c])
    for c in overlap_a:
        master_rows.append(["MAJOR_A", "A_CORE", c])
    for c in b_courses:
        master_rows.append(["MAJOR_B", "B_CORE", c])
    for c in overlap_b:
        master_rows.append(["MAJOR_B", "B_CORE", c])
    for c in bcc_courses:
        master_rows.append(["BCC", "BCC_REQ", c])

    _write_csv(master_path, ["parent_bucket_id", "child_bucket_id", "course_code"], master_rows)
    _write_csv(parent_path, [
        "parent_bucket_id", "type", "double_count_family_id",
    ], [
        ["MAJOR_A", "major", "MAJOR_A"],
        ["MAJOR_B", "major", "MAJOR_B"],
        ["BCC", "universal", "BCC"],
    ])
    all_codes = sorted(set(a_courses + b_courses + bcc_courses))
    _write_csv(courses_path, ["course_code", "credits", "level"], [
        [c, "3", "1000"] for c in all_codes
    ])
    overrides_path.write_text(json.dumps({
        "version": 1, "last_updated": "", "bucket_priority_boosts": {}, "failure_history": {},
    }), encoding="utf-8")
    queue_path.write_text("[]", encoding="utf-8")

    records = extra_records or []
    return {
        "child_path": child_path,
        "master_path": master_path,
        "parent_path": parent_path,
        "courses_path": courses_path,
        "overrides_path": overrides_path,
        "queue_path": queue_path,
        "records": records,
    }


def test_feasibility_audit_flags_infeasible_combo(tmp_path):
    """A combo requiring ~67 courses (budget 48) should be flagged INFEASIBLE."""
    # 50 failures all on one bucket to also trigger concentration.
    records = [
        {
            "scenario_label": "triple-A+B",
            "declared_majors": ["MAJOR_A", "MAJOR_B"],
            "track_ids": [],
            "reason": "unfinished requirement buckets",
            "status": "not graduated by semester 8",
            "failure_kind": "",
            "unsatisfied_buckets": ["MAJOR_A::A_CORE"],
        }
    ] * 50 + [
        {
            "scenario_label": "triple-A+B",
            "declared_majors": ["MAJOR_A", "MAJOR_B"],
            "track_ids": [],
            "reason": "unfinished requirement buckets",
            "status": "not graduated by semester 8",
            "failure_kind": "",
            "unsatisfied_buckets": ["MAJOR_B::B_CORE"],
        }
    ] * 10

    fixture = _setup_multi_major_fixture(tmp_path, extra_records=records)
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps({
        "report_date": "2026-03-17",
        "records": fixture["records"] or records,
        "supplemental_records": [],
    }), encoding="utf-8")

    summary = analyze_report(
        report_path=report_path,
        child_buckets_path=fixture["child_path"],
        master_bucket_courses_path=fixture["master_path"],
        parent_buckets_path=fixture["parent_path"],
        courses_path=fixture["courses_path"],
        overrides_path=fixture["overrides_path"],
        queue_path=fixture["queue_path"],
        dry_run=True,
    )

    assert len(summary["infeasible_combos"]) >= 1
    combo = summary["infeasible_combos"][0]
    assert combo["verdict"] == "INFEASIBLE"
    assert combo["min_courses"] > 48
    assert combo["deficit"] > 0


def test_concentration_detector_flags_dominant_bucket(tmp_path):
    """A bucket causing >50% of failures should be flagged."""
    records = [
        {
            "scenario_label": "triple-X+Y",
            "declared_majors": ["MAJOR_A"],
            "track_ids": [],
            "reason": "unfinished requirement buckets",
            "status": "not graduated by semester 8",
            "failure_kind": "",
            "unsatisfied_buckets": ["MAJOR_A::A_CORE"],
        }
    ] * 80 + [
        {
            "scenario_label": "triple-X+Y",
            "declared_majors": ["MAJOR_B"],
            "track_ids": [],
            "reason": "unfinished requirement buckets",
            "status": "not graduated by semester 8",
            "failure_kind": "",
            "unsatisfied_buckets": ["MAJOR_B::B_CORE"],
        }
    ] * 10

    fixture = _setup_multi_major_fixture(tmp_path, extra_records=records)
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps({
        "report_date": "2026-03-17",
        "records": records,
        "supplemental_records": [],
    }), encoding="utf-8")

    summary = analyze_report(
        report_path=report_path,
        child_buckets_path=fixture["child_path"],
        master_bucket_courses_path=fixture["master_path"],
        parent_buckets_path=fixture["parent_path"],
        courses_path=fixture["courses_path"],
        overrides_path=fixture["overrides_path"],
        queue_path=fixture["queue_path"],
        dry_run=True,
    )

    assert len(summary["concentration_findings"]) >= 1
    finding = summary["concentration_findings"][0]
    assert finding["bucket_id"] == "MAJOR_A::A_CORE"
    assert finding["share"] > 0.15
    assert "accounts for" in finding["recommendation"]


def test_ledger_detects_regression(tmp_path):
    """A bucket resolved in the ledger that fails again should warn REGRESSION."""
    fixture = _setup_multi_major_fixture(tmp_path)
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps({
        "report_date": "2026-03-18",
        "records": [
            {
                "scenario_label": "triple-A+B",
                "declared_majors": ["MAJOR_A"],
                "track_ids": [],
                "reason": "unfinished requirement buckets",
                "status": "not graduated by semester 8",
                "failure_kind": "",
                "unsatisfied_buckets": ["MAJOR_A::A_CORE"],
            }
        ],
        "supplemental_records": [],
    }), encoding="utf-8")

    ledger_path = tmp_path / "autotune_ledger.json"
    ledger_path.write_text(json.dumps({
        "version": 1,
        "entries": [
            {
                "bucket_id": "MAJOR_A::A_CORE",
                "date_opened": "2026-03-10",
                "date_resolved": "2026-03-15",
                "resolution": "tier_move",
                "detail": "Moved to higher tier",
                "nights_open": 5,
                "peak_failure_count": 200,
                "root_cause": "test",
            }
        ],
    }), encoding="utf-8")

    summary = analyze_report(
        report_path=report_path,
        child_buckets_path=fixture["child_path"],
        master_bucket_courses_path=fixture["master_path"],
        parent_buckets_path=fixture["parent_path"],
        courses_path=fixture["courses_path"],
        overrides_path=fixture["overrides_path"],
        queue_path=fixture["queue_path"],
        ledger_path=ledger_path,
        dry_run=True,
    )

    assert len(summary["ledger_warnings"]) >= 1
    warning = summary["ledger_warnings"][0]
    assert warning["kind"] == "REGRESSION"
    assert "MAJOR_A::A_CORE" in warning["message"]
    assert "resolved on 2026-03-15" in warning["message"]


def test_ledger_detects_boost_resistant(tmp_path):
    """A bucket failing >5 nights despite boosts should warn BOOST_RESISTANT."""
    fixture = _setup_multi_major_fixture(tmp_path)
    report_path = tmp_path / "report.json"
    report_path.write_text(json.dumps({
        "report_date": "2026-03-18",
        "records": [
            {
                "scenario_label": "triple-A+B",
                "declared_majors": ["MAJOR_A"],
                "track_ids": [],
                "reason": "unfinished requirement buckets",
                "status": "not graduated by semester 8",
                "failure_kind": "",
                "unsatisfied_buckets": ["MAJOR_A::A_CORE"],
            }
        ],
        "supplemental_records": [],
    }), encoding="utf-8")

    # Pre-seed failure history with 5 consecutive failures.
    fixture["overrides_path"].write_text(json.dumps({
        "version": 1,
        "last_updated": "2026-03-17",
        "bucket_priority_boosts": {"MAJOR_A::A_CORE": -2},
        "failure_history": {
            "MAJOR_A::A_CORE": {
                "consecutive_failures": 5,
                "last_seen": "2026-03-17",
                "classification": "ALGORITHM",
            }
        },
    }), encoding="utf-8")

    ledger_path = tmp_path / "autotune_ledger.json"
    ledger_path.write_text(json.dumps({"version": 1, "entries": []}), encoding="utf-8")

    summary = analyze_report(
        report_path=report_path,
        child_buckets_path=fixture["child_path"],
        master_bucket_courses_path=fixture["master_path"],
        parent_buckets_path=fixture["parent_path"],
        courses_path=fixture["courses_path"],
        overrides_path=fixture["overrides_path"],
        queue_path=fixture["queue_path"],
        ledger_path=ledger_path,
        dry_run=True,
    )

    assert any(w["kind"] == "BOOST_RESISTANT" for w in summary["ledger_warnings"])
    warning = next(w for w in summary["ledger_warnings"] if w["kind"] == "BOOST_RESISTANT")
    assert "structural review" in warning["message"]
