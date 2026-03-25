# Nightly Auto-Tune Loop

MarqBot runs a single GitHub Actions workflow called **Nightly Sweep** that doubles as both a PR gate and a self-improving nightly pipeline. This memo explains the nightly side.

## Current status

> **Paused as of 2026-03-24.** The cron schedule and auto-tune job are disabled while the codebase is under heavy daily changes. The sweep still runs on `workflow_dispatch`. See the comments in `.github/workflows/nightly-sweep.yml` for how to re-enable.

## How it works

When enabled, the workflow triggers two jobs in sequence at 3 AM Eastern (07:00 UTC):

### 1. Nightly Focused Sweep

Runs every `@nightly`-marked pytest case against the full course catalog and planner engine. The test harness writes two files:

- **Markdown report** — human-readable summary of any ranking anomalies, dead-end paths, or prerequisite mismatches found overnight.
- **JSON sidecar** — machine-readable version of the same findings, keyed by course code.

Both are uploaded as a GitHub Actions artifact and retained for 14 days.

### 2. Nightly Auto-Tune

Downloads the JSON sidecar and feeds it to `scripts/analyze_nightly.py`. The analyzer can update two config files and reads a third:

| File | Purpose |
|------|---------|
| `config/ranking_overrides.json` | Per-bucket priority boosts that shift where courses land in the recommendation list |
| `config/data_investigation_queue.json` | Buckets flagged for manual review (catalog discrepancies, missing prereqs, etc.) |
| `config/autotune_ledger.json` | Read-only log of past resolved issues — used to detect regressions and boost-resistant buckets |

If either file changes, the job:

1. Creates a branch named `nightly-tuning/YYYY-MM-DD`
2. Opens (or updates) a pull request against `main`
3. If the override change count is small (3 or fewer), enables auto-merge so the fix lands without manual intervention

### Smart analysis (added 2026-03-17)

Beyond the streak-based priority boosts, the analyzer now runs three additional checks:

- **Feasibility Auditor**: For each failing scenario, estimates minimum unique courses needed per double-count family. Combos requiring more than 48 courses are flagged as `INFEASIBLE` so the autotune stops wasting boost slots on mathematically impossible paths.
- **Concentration Detector**: If a single bucket accounts for >15% of all failure occurrences, the PR body flags it with a targeted recommendation (e.g., review tier placement, check mapped course count).
- **Resolved-Issue Ledger**: Reads `config/autotune_ledger.json` to detect regressions (a previously-fixed bucket failing again) and boost-resistant buckets (>5 consecutive nights failing despite -2 boost — needs structural review, not more boosts).

## What it does NOT touch

- The CSV course catalog (`data/`) — those fixes stay manual
- Bulletin data or scraping — no automated crawling
- Frontend code or UI copy
- Any file outside `config/`

## The PR gate side

The same workflow file also runs on every pull request, but only the **non-nightly** jobs fire: backend regression, planner fast guardrail, and frontend tests. The nightly jobs skip on PRs, and the PR jobs skip on the schedule trigger.

## Manual trigger

You can also run the nightly sweep on demand from the Actions tab using **workflow_dispatch**. Both the PR gate jobs and the nightly jobs will run.

## Diagram

```
schedule (3 AM ET)
  │
  ▼
┌─────────────────────┐
│  Nightly Focused     │
│  Sweep (pytest)      │
│  ─────────────────   │
│  → Markdown report   │
│  → JSON sidecar      │
│  → Upload artifact   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Nightly Auto-Tune   │
│  (analyze_nightly)   │
│  ─────────────────   │
│  → ranking_overrides │
│  → investigation_q   │
│  → reads ledger.json │
│  → feasibility audit │
│  → concentration det │
│  → Open PR if diff   │
│  → Auto-merge if ≤3  │
└─────────────────────┘
          │
          ▼
   Human merges larger
   PRs after review
```
