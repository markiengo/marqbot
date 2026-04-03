import os
import sys
from dataclasses import dataclass, field

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")
SCRIPTS_DIR = os.path.join(PROJECT_ROOT, "scripts")

for path in (PROJECT_ROOT, BACKEND_DIR, SCRIPTS_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)


@dataclass
class NightlyCollector:
    supplemental_checks: int = 0
    supplemental_issues: list[dict[str, object]] = field(default_factory=list)

    def record_supplemental_issue(self, **issue) -> None:
        self.supplemental_issues.append(issue)


_nightly_collector = NightlyCollector()


def get_nightly_collector() -> NightlyCollector:
    return _nightly_collector
