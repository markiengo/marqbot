"""
Shared dead-end detection helpers for the dead-end prevention test suites.

Provides:
- PlanCase / DeadEndCheck dataclasses
- resolve_effective_plan() — mirrors /recommend preprocessing
- simulate_terms() — runs multi-semester simulation directly
- classify_dead_end() — 2-term strict dead-end classifier
- rerun_case_with_debug() — debug rerun on failure
- format_failure() — human-readable failure output
"""

from __future__ import annotations

import time
import textwrap
from dataclasses import dataclass, field

import pandas as pd

import server
from semester_recommender import (
    default_followup_semester,
    default_followup_semester_with_summer,
    run_recommendation_semester,
    _credits_to_standing,
)
from unlocks import build_reverse_prereq_map, compute_chain_depths
from validators import expand_completed_with_prereqs_with_provenance, expand_in_progress_with_prereqs


# ── Dataclasses ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class PlanCase:
    declared_majors: list[str]
    track_ids: list[str]
    declared_minors: list[str]
    completed_courses: list[str]
    in_progress_courses: list[str]
    target_semester_primary: str
    include_summer: bool = False
    max_recommendations: int = 6
    student_stage: str | None = None


@dataclass
class DeadEndCheck:
    failed: bool
    failure_kind: str | None  # SELECTION_GAP | MANUAL_REVIEW_BLOCK | ELIGIBILITY_GAP
    semester_index: int | None
    semester_label: str | None
    unsatisfied_buckets: list[str]
    manual_review_courses: list[str]
    eligible_count: int
    reproduction_case: PlanCase


# ── Data access ─────────────────────────────────────────────────────────────


def _get_data():
    """Return loaded runtime data from server module (loaded at import time)."""
    return server._data


def _get_reverse_map():
    return server._reverse_map


def _get_chain_depths():
    return server._chain_depths


# ── Resolve effective plan ──────────────────────────────────────────────────


def resolve_effective_plan(case: PlanCase):
    """
    Mirror /recommend preprocessing exactly.

    Returns:
        (effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup)
    """
    data = _get_data()

    body = {
        "declared_majors": case.declared_majors,
        "declared_minors": case.declared_minors,
        "track_ids": case.track_ids,
        "target_semester": case.target_semester_primary,
        "include_summer": case.include_summer,
        "max_recommendations": case.max_recommendations,
    }

    selection, err = server._resolve_program_selection(body, data)
    if err is not None:
        raise ValueError(
            f"Program selection failed: {err[0]}"
        )

    effective_data = selection["effective_data"]
    effective_track_id = selection["effective_track_id"]
    catalog_codes = data["catalog_codes"]

    from normalizer import normalize_input
    norm = normalize_input(",".join(case.completed_courses), catalog_codes)
    completed = norm["valid"]

    norm_ip = normalize_input(",".join(case.in_progress_courses), catalog_codes)
    in_progress = norm_ip["valid"]

    completed, _ = expand_completed_with_prereqs_with_provenance(
        completed, effective_data["prereq_map"],
    )
    in_progress, assumption_rows = expand_in_progress_with_prereqs(
        in_progress, completed, effective_data["prereq_map"],
    )
    completed, in_progress = server._promote_inferred_in_progress_prereqs_to_completed(
        completed, in_progress, assumption_rows,
    )

    # Build credits lookup matching server.py exactly
    cdf = effective_data["courses_df"]
    credits_lookup: dict[str, float] = dict(zip(
        cdf["course_code"].astype(str),
        cdf["credits"].fillna(3.0).apply(lambda x: server._parse_credits(x) if pd.notna(x) else 3.0),
    ))
    running_credits = (
        sum(credits_lookup.get(c, 3) for c in completed)
        + sum(credits_lookup.get(c, 3) for c in in_progress)
    )

    return effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup


# ── Multi-term simulation ──────────────────────────────────────────────────


def simulate_terms(case: PlanCase, num_terms: int = 9) -> list[dict]:
    """
    Run the same semester progression logic as /recommend, directly.

    Simulates num_terms semesters (default 9 so term 8 can be checked against 9).
    Returns list of semester payloads from run_recommendation_semester.
    """
    effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup = (
        resolve_effective_plan(case)
    )
    reverse_map = _get_reverse_map()
    chain_depths = _get_chain_depths()

    followup_fn = default_followup_semester_with_summer if case.include_summer else default_followup_semester

    # Build semester labels
    semester_labels = [case.target_semester_primary]
    while len(semester_labels) < num_terms:
        semester_labels.append(followup_fn(semester_labels[-1]))

    # Filter summer if not included (mirrors server.py)
    if not case.include_summer:
        filtered = [l for l in semester_labels if "summer" not in l.lower()]
        probe = filtered[-1] if filtered else semester_labels[-1]
        while len(filtered) < num_terms:
            next_label = default_followup_semester(probe)
            filtered.append(next_label)
            probe = next_label
        semester_labels = filtered[:num_terms]

    semesters = []
    completed_cursor = list(dict.fromkeys(completed + in_progress))

    for idx, semester_label in enumerate(semester_labels):
        current_standing = _credits_to_standing(running_credits)

        if idx == 0:
            sem = run_recommendation_semester(
                completed,
                in_progress,
                semester_label,
                effective_data,
                case.max_recommendations,
                reverse_map,
                track_id=effective_track_id,
                debug=False,
                current_standing=current_standing,
                chain_depths=chain_depths,
                student_stage=case.student_stage,
            )
        else:
            sem = run_recommendation_semester(
                completed_cursor,
                [],
                semester_label,
                effective_data,
                case.max_recommendations,
                reverse_map,
                track_id=effective_track_id,
                debug=False,
                current_standing=current_standing,
                chain_depths=chain_depths,
                student_stage=case.student_stage,
            )

        semesters.append(sem)

        # Advance state: add recommended courses to completed, accumulate credits
        for rec in sem.get("recommendations", []):
            cc = rec.get("course_code", "")
            running_credits += credits_lookup.get(cc, 3)

        completed_cursor = list(dict.fromkeys(
            completed_cursor + [
                r["course_code"]
                for r in sem.get("recommendations", [])
                if r.get("course_code")
            ]
        ))

    return semesters


# ── Dead-end classification ────────────────────────────────────────────────


def unsatisfied_active_buckets(progress: dict) -> list[str]:
    """Return bucket IDs where satisfied is False."""
    return [
        bucket_id for bucket_id, entry in progress.items()
        if not entry.get("satisfied", True)
    ]


def classify_dead_end(semesters: list[dict], case: PlanCase) -> DeadEndCheck:
    """
    Classify a simulation as healthy or dead-ended.

    Rules:
    - SELECTION_GAP: eligible_count > 0 but recommendations empty (immediate fail)
    - 2-term dead-end: empty semester with unsatisfied buckets, AND next semester also empty
      with unsatisfied buckets
      - MANUAL_REVIEW_BLOCK: manual_review_courses non-empty in the failing term
      - ELIGIBILITY_GAP: otherwise
    """
    ok = DeadEndCheck(
        failed=False,
        failure_kind=None,
        semester_index=None,
        semester_label=None,
        unsatisfied_buckets=[],
        manual_review_courses=[],
        eligible_count=0,
        reproduction_case=case,
    )

    for i, sem in enumerate(semesters):
        recs = sem.get("recommendations", [])
        eligible = sem.get("eligible_count", 0)
        progress = sem.get("progress", {})
        unsat = unsatisfied_active_buckets(progress)
        manual = sem.get("manual_review_courses", [])

        # Has recommendations — healthy
        if recs:
            continue

        # No recs but all buckets satisfied — graduation, healthy
        if not unsat:
            continue

        # eligible_count > 0 but no recs — selection/ranking bug
        if eligible > 0:
            return DeadEndCheck(
                failed=True,
                failure_kind="SELECTION_GAP",
                semester_index=i,
                semester_label=sem.get("target_semester", "?"),
                unsatisfied_buckets=unsat,
                manual_review_courses=manual,
                eligible_count=eligible,
                reproduction_case=case,
            )

        # No recs, unsatisfied buckets, eligible_count == 0 — check next term
        if i + 1 < len(semesters):
            next_sem = semesters[i + 1]
            next_recs = next_sem.get("recommendations", [])
            next_progress = next_sem.get("progress", {})
            next_unsat = unsatisfied_active_buckets(next_progress)

            # Next term recovers
            if next_recs or not next_unsat:
                continue

            # 2-term dead-end confirmed
            kind = "MANUAL_REVIEW_BLOCK" if manual else "ELIGIBILITY_GAP"
            return DeadEndCheck(
                failed=True,
                failure_kind=kind,
                semester_index=i,
                semester_label=sem.get("target_semester", "?"),
                unsatisfied_buckets=unsat,
                manual_review_courses=manual,
                eligible_count=eligible,
                reproduction_case=case,
            )

        # Last term, no next to check — single empty term at end is not a 2-term failure
        continue

    return ok


# ── Debug rerun ─────────────────────────────────────────────────────────────


def rerun_case_with_debug(case: PlanCase, failing_semester_index: int) -> dict | None:
    """
    Rerun simulation up to failing semester with debug=True.
    Returns the debug trace for the failing semester only.
    """
    try:
        effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup = (
            resolve_effective_plan(case)
        )
    except ValueError:
        return None

    reverse_map = _get_reverse_map()
    chain_depths = _get_chain_depths()
    followup_fn = default_followup_semester_with_summer if case.include_summer else default_followup_semester

    semester_labels = [case.target_semester_primary]
    while len(semester_labels) <= failing_semester_index:
        semester_labels.append(followup_fn(semester_labels[-1]))

    if not case.include_summer:
        filtered = [l for l in semester_labels if "summer" not in l.lower()]
        probe = filtered[-1] if filtered else semester_labels[-1]
        while len(filtered) <= failing_semester_index:
            next_label = default_followup_semester(probe)
            filtered.append(next_label)
            probe = next_label
        semester_labels = filtered[:failing_semester_index + 1]

    completed_cursor = list(dict.fromkeys(completed + in_progress))

    for idx, semester_label in enumerate(semester_labels):
        current_standing = _credits_to_standing(running_credits)
        is_debug = idx == failing_semester_index

        if idx == 0:
            sem = run_recommendation_semester(
                completed, in_progress, semester_label,
                effective_data, case.max_recommendations, reverse_map,
                track_id=effective_track_id, debug=is_debug, debug_limit=30,
                current_standing=current_standing, chain_depths=chain_depths,
                student_stage=case.student_stage,
            )
        else:
            sem = run_recommendation_semester(
                completed_cursor, [], semester_label,
                effective_data, case.max_recommendations, reverse_map,
                track_id=effective_track_id, debug=is_debug, debug_limit=30,
                current_standing=current_standing, chain_depths=chain_depths,
                student_stage=case.student_stage,
            )

        if is_debug:
            return sem

        for rec in sem.get("recommendations", []):
            running_credits += credits_lookup.get(rec.get("course_code", ""), 3)
        completed_cursor = list(dict.fromkeys(
            completed_cursor + [
                r["course_code"]
                for r in sem.get("recommendations", [])
                if r.get("course_code")
            ]
        ))

    return None


# ── Failure formatting ──────────────────────────────────────────────────────


def format_failure(check: DeadEndCheck, debug_sem: dict | None = None) -> str:
    """Build a human-readable failure message for assertion output."""
    c = check.reproduction_case
    lines = [
        f"DEAD-END DETECTED: {check.failure_kind}",
        f"  Semester: #{check.semester_index} ({check.semester_label})",
        f"  Selection:",
        f"    declared_majors: {c.declared_majors}",
        f"    track_ids: {c.track_ids}",
        f"    declared_minors: {c.declared_minors}",
        f"    start_term: {c.target_semester_primary}",
        f"    include_summer: {c.include_summer}",
        f"  Initial completed: {c.completed_courses[:10]}{'...' if len(c.completed_courses) > 10 else ''}",
        f"  Initial in_progress: {c.in_progress_courses}",
        f"  Unsatisfied buckets: {check.unsatisfied_buckets}",
        f"  Manual-review courses: {check.manual_review_courses}",
        f"  Eligible count: {check.eligible_count}",
    ]

    if debug_sem:
        recs = debug_sem.get("recommendations", [])
        lines.append(f"  Recommendations returned: {[r.get('course_code') for r in recs]}")

        debug_trace = debug_sem.get("debug", [])
        if debug_trace:
            lines.append("  Debug trace (top 10):")
            for entry in debug_trace[:10]:
                skip = entry.get("skip_reason", "")
                lines.append(
                    f"    {entry.get('rank','-')}. {entry.get('course_code','?')} "
                    f"sel={entry.get('selected', False)} skip={skip or 'N/A'} "
                    f"tier={entry.get('tier','-')} buckets={entry.get('fills_buckets',[])}"
                )

    return "\n".join(lines)


# ── Seed-based state generation helpers ─────────────────────────────────────


# ── Nightly report aggregation ─────────────────────────────────────────────


class NightlyFailureCollector:
    """Collects dead-end failures across nightly tests and produces an aggregated report."""

    THRESHOLD = 5  # minimum occurrences to flag a pattern

    def __init__(self):
        self.failures: list[dict] = []
        self.total_tests = 0
        self.seed: int | None = None
        self._start_time: float = time.time()

    def record_failure(self, label: str, check: "DeadEndCheck", standing: str = ""):
        case = check.reproduction_case
        self.failures.append({
            "label": label,
            "failure_kind": check.failure_kind,
            "unsatisfied_buckets": check.unsatisfied_buckets,
            "manual_review_courses": check.manual_review_courses,
            "semester_label": check.semester_label,
            "eligible_count": check.eligible_count,
            "standing": standing,
            "programs": "+".join(case.declared_majors + case.track_ids),
            "declared_majors": list(case.declared_majors),
            "track_ids": list(case.track_ids),
            "declared_minors": list(case.declared_minors),
            "completed_courses": list(case.completed_courses),
            "in_progress_courses": list(case.in_progress_courses),
            "target_semester": case.target_semester_primary,
            "include_summer": case.include_summer,
        })

    def generate_report(self) -> str:
        """Generate markdown report. Always produces output (even on clean runs)."""
        from datetime import date as _date

        elapsed = time.time() - self._start_time
        mins, secs = divmod(int(elapsed), 60)
        passed = self.total_tests - len(self.failures)
        fail_rate = (len(self.failures) / self.total_tests * 100) if self.total_tests else 0

        lines = [
            f"# Nightly Sweep — {_date.today().isoformat()}",
            "",
            f"**{passed}/{self.total_tests} passed** ({fail_rate:.1f}% failure rate) | "
            f"Seed `{self.seed or 'unknown'}` | {mins}m {secs}s",
        ]

        if not self.failures:
            lines.extend(["", "All combos passed. No action needed."])
            return "\n".join(lines)

        # ── What to fix ──────────────────────────────────────────────
        # Group failures by the bucket that got stuck
        bucket_groups: dict[str, list[dict]] = {}
        for f in self.failures:
            for bucket in f["unsatisfied_buckets"]:
                bucket_groups.setdefault(bucket, []).append(f)

        lines.extend([
            "",
            "---",
            "",
            "## What broke",
            "",
        ])

        for bucket, fails in sorted(bucket_groups.items(), key=lambda x: -len(x[1])):
            standings = set(f["standing"] for f in fails)
            programs = sorted(set(f["programs"] for f in fails))
            sample_programs = ", ".join(programs[:4])
            if len(programs) > 4:
                sample_programs += f", +{len(programs) - 4} more"

            lines.extend([
                f"### `{bucket}` — {len(fails)} failure{'s' if len(fails) != 1 else ''}",
                "",
                f"- **Who:** {sample_programs}",
                f"- **When:** {', '.join(sorted(standings))} standing",
                f"- **Why:** {fails[0]['failure_kind']}",
                "",
            ])

        # ── Analysis ─────────────────────────────────────────────────
        lines.extend([
            "---",
            "",
            "## Analysis",
            "",
        ])

        # Patterns: same bucket failing across many combos = data issue
        widespread = [(b, fs) for b, fs in bucket_groups.items() if len(fs) >= self.THRESHOLD]
        isolated = [(b, fs) for b, fs in bucket_groups.items() if len(fs) < self.THRESHOLD]

        if widespread:
            lines.append("**Widespread (likely a data or rule issue):**")
            for bucket, fails in sorted(widespread, key=lambda x: -len(x[1])):
                lines.append(f"- `{bucket}` stuck in {len(fails)} combos — check bucket mappings, prereqs, or standing gates")
            lines.append("")

        if isolated:
            lines.append("**Isolated (likely combo-specific):**")
            for bucket, fails in sorted(isolated, key=lambda x: -len(x[1])):
                combo_names = ", ".join(sorted(set(f["programs"] for f in fails)))
                lines.append(f"- `{bucket}` only in: {combo_names}")
            lines.append("")

        # Standing breakdown
        standing_counts: dict[str, int] = {}
        for f in self.failures:
            standing_counts[f["standing"]] = standing_counts.get(f["standing"], 0) + 1
        if standing_counts:
            worst_standing = max(standing_counts, key=standing_counts.get)
            lines.extend([
                "**Standing breakdown:**",
                ", ".join(f"{s}: {c}" for s, c in sorted(standing_counts.items())),
                "",
                f"Most failures at **{worst_standing}** standing — "
                + ("early students lack prereqs?" if worst_standing in ("freshman", "sophomore")
                   else "late students blocked by standing gates or missing mappings?"),
                "",
            ])

        # ── Next steps ───────────────────────────────────────────────
        lines.extend([
            "---",
            "",
            "## Next steps",
            "",
        ])

        if widespread:
            lines.append("1. Fix widespread buckets first — they affect the most students")
        if isolated:
            lines.append(f"{'2' if widespread else '1'}. Investigate isolated failures — "
                         "run the specific combo locally to see the debug trace")
        lines.extend([
            "",
            f"Reproduce any failure: `python -m pytest -m nightly -k \"<label>\" -q`",
            "",
            f"Re-run with same seed: `NIGHTLY_SEED={self.seed} python -m pytest -m nightly -q`",
        ])

        # ── Full failure log ─────────────────────────────────────────
        lines.extend([
            "",
            "---",
            "",
            "<details>",
            "<summary>Full failure log (click to expand)</summary>",
            "",
        ])

        for i, f in enumerate(self.failures, 1):
            buckets = ", ".join(f["unsatisfied_buckets"])
            completed_count = len(f["completed_courses"])
            completed_sample = ", ".join(f["completed_courses"][:10])
            if completed_count > 10:
                completed_sample += f", +{completed_count - 10} more"
            minors = ", ".join(f["declared_minors"]) if f["declared_minors"] else "none"
            tracks = ", ".join(f["track_ids"]) if f["track_ids"] else "none"

            lines.extend([
                f"**{i}. {f['label']}**",
                f"- Programs: {', '.join(f['declared_majors'])} | Tracks: {tracks} | Minors: {minors}",
                f"- Standing: {f['standing']} | Completed: {completed_count} courses",
                f"- Stuck at: {f['semester_label']} | Buckets: {buckets}",
                f"- Completed courses: {completed_sample if completed_sample else 'none'}",
                "",
            ])

        lines.extend(["</details>"])

        return "\n".join(lines)


def seed_from_simulation(case: PlanCase, num_semesters_to_take: int) -> list[str]:
    """
    Simulate from empty and take the first N semesters of recommendations
    as a completed course set. Used to generate realistic mid-path states.
    """
    empty_case = PlanCase(
        declared_majors=case.declared_majors,
        track_ids=case.track_ids,
        declared_minors=case.declared_minors,
        completed_courses=[],
        in_progress_courses=[],
        target_semester_primary=case.target_semester_primary,
        include_summer=case.include_summer,
        max_recommendations=case.max_recommendations,
        student_stage=case.student_stage,
    )
    try:
        semesters = simulate_terms(empty_case, num_terms=num_semesters_to_take + 1)
    except (ValueError, Exception):
        return []

    completed = []
    for sem in semesters[:num_semesters_to_take]:
        for rec in sem.get("recommendations", []):
            cc = rec.get("course_code", "")
            if cc and cc not in completed:
                completed.append(cc)
    return completed


def run_case_and_assert(case: PlanCase, num_terms: int = 9):
    """
    Simulate terms and assert no dead-end. On failure, rerun with debug
    and produce a detailed assertion message.
    """
    try:
        semesters = simulate_terms(case, num_terms=num_terms)
    except ValueError as exc:
        # Program selection failure — skip, not a dead-end
        return

    check = classify_dead_end(semesters, case)
    if not check.failed:
        return

    debug_sem = rerun_case_with_debug(case, check.semester_index)
    msg = format_failure(check, debug_sem)
    raise AssertionError(msg)


def assert_graduates_by(case: PlanCase, max_semesters: int = 8):
    """
    Simulate max_semesters terms and assert all buckets are satisfied
    after all semesters' recommendations are applied.

    Runs max_semesters+1 terms so the extra semester's progress reflects
    the full completed set from all max_semesters recommendation rounds.
    """
    try:
        semesters = simulate_terms(case, num_terms=max_semesters + 1)
    except ValueError as exc:
        raise AssertionError(f"Program selection failed: {exc}")

    if len(semesters) < max_semesters + 1:
        raise AssertionError("Not enough semesters returned")

    # Progress at semester max_semesters+1 reflects all recs from semesters 1..max_semesters.
    final_progress = semesters[max_semesters].get("progress", {})
    unsat = unsatisfied_active_buckets(final_progress)
    if not unsat:
        return

    total_recs = sum(len(s.get("recommendations", [])) for s in semesters[:max_semesters])
    per_sem = [
        f"  Sem {i+1}: {len(s.get('recommendations', []))} recs"
        for i, s in enumerate(semesters[:max_semesters])
    ]
    lines = [
        f"NOT GRADUATED after {max_semesters} semesters ({total_recs} total courses)",
        f"  declared_majors: {case.declared_majors}",
        f"  track_ids: {case.track_ids}",
        f"  declared_minors: {case.declared_minors}",
        f"  Unsatisfied buckets ({len(unsat)}):",
    ]
    for bid in unsat:
        info = final_progress[bid]
        lines.append(
            f"    {bid}: {info.get('completed_done', 0)}/{info.get('needed_count', 0)} courses"
        )
    lines.extend(per_sem)
    raise AssertionError("\n".join(lines))
