#!/usr/bin/env python
"""
Advisor Match Evaluation Script (v1.9).

Scores recommendation quality against a gold dataset of advisor-curated profiles.

Usage:
  python scripts/eval_advisor_match.py [--url http://localhost:5000] [--gold eval/advisor_gold.json]

Pass/Fail definition (locked):
  - Case pass: overlap(actual_top6, expected_top6) >= 4
  - Release gate: >= 80% of cases pass
  - Hard failure: any single profile with overlap == 0 -> blocks release

Exit codes:
  0 = PASS (gate met, no hard failures)
  1 = FAIL (gate not met or hard failure)
"""

import argparse
import json
import os
import sys

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package required. Install with: pip install requests", file=sys.stderr)
    sys.exit(2)


def score_profile(profile: dict, gold_top6: list[str], server_url: str) -> tuple[int, bool]:
    """
    POST the profile to /recommend, compare top-6 codes to gold set.
    Returns (overlap_count, case_pass).
    """
    try:
        resp = requests.post(f"{server_url}/recommend", json=profile, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"  [ERROR] Request failed: {exc}", file=sys.stderr)
        return 0, False

    if data.get("mode") == "error":
        print(f"  [ERROR] Server returned error: {data.get('error')}", file=sys.stderr)
        return 0, False

    recs = data.get("recommendations", [])
    actual_top6 = [r["course_code"] for r in recs[:6]]
    gold_set = set(gold_top6)
    actual_set = set(actual_top6)
    overlap = len(actual_set & gold_set)
    case_pass = overlap >= 4
    return overlap, case_pass


def run_eval(gold_path: str, server_url: str) -> int:
    """Run evaluation. Returns 0 on PASS, 1 on FAIL."""
    with open(gold_path, encoding="utf-8") as f:
        gold_dataset = json.load(f)

    print(f"Evaluating {len(gold_dataset)} profiles against {server_url}")
    print("=" * 60)

    results = []
    hard_fail = False

    for entry in gold_dataset:
        profile_id = entry["id"]
        description = entry.get("description", "")
        profile = entry["profile"]
        expected_top6 = entry["expected_top6"]

        overlap, case_pass = score_profile(profile, expected_top6, server_url)

        status = "PASS" if case_pass else "FAIL"
        if overlap == 0:
            hard_fail = True
            status = "HARD-FAIL (overlap=0)"

        print(f"  [{status:12s}] {profile_id}: overlap={overlap}/6")
        if not case_pass:
            print(f"              Profile: {description}")
        results.append((profile_id, overlap, case_pass))

    print("=" * 60)
    total = len(results)
    passed = sum(1 for _, _, p in results if p)
    gate_rate = passed / total if total else 0.0
    gate_pass = gate_rate >= 0.80 and not hard_fail

    print(f"Cases passing : {passed}/{total} ({gate_rate:.0%})")
    print(f"Hard failures : {'YES' if hard_fail else 'none'}")
    print(f"Release gate  : {'PASS' if gate_pass else 'FAIL'}")

    if not gate_pass:
        if hard_fail:
            print("\nFAIL: At least one profile has zero overlap -> blocks release.", file=sys.stderr)
        else:
            print(f"\nFAIL: Gate requires >=80% case-pass rate ({gate_rate:.0%} achieved).", file=sys.stderr)
        return 1

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost:5000", help="Base URL of MarqBot server")
    parser.add_argument(
        "--gold",
        default=os.path.join(os.path.dirname(__file__), "..", "eval", "advisor_gold.json"),
        help="Path to advisor_gold.json",
    )
    args = parser.parse_args()

    gold_path = os.path.abspath(args.gold)
    if not os.path.exists(gold_path):
        print(f"ERROR: Gold dataset not found: {gold_path}", file=sys.stderr)
        sys.exit(2)

    sys.exit(run_eval(gold_path, args.url.rstrip("/")))


if __name__ == "__main__":
    main()
