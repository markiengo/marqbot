---
quick_id: 260402-o3h
status: complete
date: 2026-04-02
---

# Summary: Delete Nightly Autotune Feature

Deleted 9 files and simplified 2 shared test files. The nightly pipeline
(analyze_nightly.py → ranking_overrides, data_investigation_queue) is gone.

`config/ranking_overrides.json` kept — backend reads it at runtime.

Fast guardrail passed: 15 passed, 156 deselected (not nightly) in ~37s.
