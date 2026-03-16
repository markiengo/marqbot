import sys
import os
import json

# Add backend/ to path so tests can import backend modules directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))

# Add scripts/ to path so tests can import script modules directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))


# ── Nightly failure report hook ────────────────────────────────────────────

_nightly_collector = None


def get_nightly_collector():
    """Get the session-scoped nightly failure collector (created on first access)."""
    global _nightly_collector
    if _nightly_collector is None:
        from nightly_support import NightlyFailureCollector
        _nightly_collector = NightlyFailureCollector()
    return _nightly_collector


def pytest_sessionfinish(session, exitstatus):
    """After all tests, generate nightly report artifacts under tests/nightly_reports/."""
    global _nightly_collector
    if _nightly_collector is None:
        return

    from datetime import date

    collector = _nightly_collector
    if collector.total_tests == 0 and collector.supplemental_checks == 0:
        return

    report_dir = os.path.join(os.path.dirname(__file__), "..", "nightly_reports")
    os.makedirs(report_dir, exist_ok=True)
    report_date = os.environ.get("NIGHTLY_REPORT_DATE", "").strip() or date.today().isoformat()
    snapshot = collector.to_snapshot(report_date=report_date)
    report = collector.generate_report(report_date=report_date)
    report_path = os.path.join(report_dir, f"{report_date}.md")
    report_json_path = os.path.join(report_dir, f"{report_date}.json")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    with open(report_json_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)
    print(f"\n[NIGHTLY REPORT] Written to {report_path}")
    print(f"[NIGHTLY REPORT] JSON written to {report_json_path}")
    print(report)
