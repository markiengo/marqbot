import sys
import os

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
        from dead_end_utils import NightlyFailureCollector
        _nightly_collector = NightlyFailureCollector()
    return _nightly_collector


def pytest_sessionfinish(session, exitstatus):
    """After all tests, generate nightly report if there are flagged patterns."""
    global _nightly_collector
    if _nightly_collector is None:
        return

    collector = _nightly_collector
    report = collector.generate_report()
    if report is None:
        return

    report_dir = os.path.join(os.path.dirname(__file__), "..", "..", "test-reports")
    os.makedirs(report_dir, exist_ok=True)
    report_path = os.path.join(report_dir, "nightly-dead-end-report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\n[NIGHTLY REPORT] Written to {report_path}")
    print(report)
