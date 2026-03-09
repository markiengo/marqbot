from __future__ import annotations

import random
import time
from dataclasses import dataclass

import server
from dead_end_utils import (
    DeadEndCheck,
    PlanCase,
    format_failure,
    resolve_effective_plan,
    rerun_case_with_debug,
    unsatisfied_active_buckets,
)
from helpers import (
    NIGHTLY_CASE_BUDGET,
    NIGHTLY_PROFILES,
    NIGHTLY_SAMPLE_SIZE,
    NIGHTLY_SELECTION_VARIANTS,
    build_nightly_scenario_pool,
    expected_nightly_case_count,
    sample_nightly_scenarios,
)
from semester_recommender import _credits_to_standing, run_recommendation_semester


@dataclass(frozen=True)
class NightlyCaseSpec:
    label: str
    scenario_label: str
    profile_label: str
    selection_variant: int
    seeded_semesters: int
    case: PlanCase
    invalid_reason: str | None = None


@dataclass(frozen=True)
class NightlySuite:
    cases: tuple[NightlyCaseSpec, ...]
    total_possible_scenarios: int
    sampled_scenario_labels: tuple[str, ...]
    profiles_per_scenario: int
    selection_variants: int
    expected_tests: int
    case_budget: int


@dataclass
class GraduationCheck:
    failed: bool
    max_semesters: int
    semester_label: str | None
    unsatisfied_buckets: list[str]
    total_recommendations: int
    reproduction_case: PlanCase


@dataclass
class SeededHistoryResult:
    valid: bool
    actual_semesters: int
    completed_courses: list[str]
    invalid_reason: str | None = None


def _build_semester_labels(start_term: str, num_terms: int, include_summer: bool = False) -> list[str]:
    if num_terms <= 0:
        return []

    labels = [start_term]
    if include_summer:
        followups = {"Spring": "Summer", "Summer": "Fall", "Fall": "Spring"}
        while len(labels) < num_terms:
            season, year = labels[-1].split()
            next_season = followups[season]
            next_year = str(int(year) + 1) if season == "Fall" else year
            labels.append(f"{next_season} {next_year}")
        return labels

    while len(labels) < num_terms:
        season, year = labels[-1].split()
        next_season = "Spring" if season == "Fall" else "Fall"
        next_year = str(int(year) + 1) if season == "Fall" else year
        labels.append(f"{next_season} {next_year}")
    return labels


def _is_undergrad_course(course_code: str) -> bool:
    parts = str(course_code).split()
    if len(parts) != 2 or not parts[1].isdigit():
        return False
    return int(parts[1]) < 5000


def _format_bucket_list(bucket_ids: list[str], limit: int = 3) -> str:
    if not bucket_ids:
        return "none"
    shown = bucket_ids[:limit]
    suffix = f", +{len(bucket_ids) - limit} more" if len(bucket_ids) > limit else ""
    return ", ".join(shown) + suffix


def build_seeded_history_variants(
    case: PlanCase,
    *,
    requested_semesters: int,
    variant_count: int,
    seed: int | str,
) -> list[SeededHistoryResult]:
    try:
        effective_data, effective_track_id, completed, in_progress, running_credits, credits_lookup = (
            resolve_effective_plan(case)
        )
    except ValueError as exc:
        invalid = SeededHistoryResult(
            valid=False,
            actual_semesters=0,
            completed_courses=list(case.completed_courses),
            invalid_reason=f"Program selection failed during seeded history build: {exc}",
        )
        return [invalid for _ in range(variant_count)]

    semester_labels = _build_semester_labels(
        case.target_semester_primary,
        requested_semesters,
        case.include_summer,
    )

    reverse_map = server._reverse_map
    chain_depths = server._chain_depths

    variants: list[SeededHistoryResult] = []
    seen_histories: set[tuple[str, ...]] = set()
    attempts = 0
    max_attempts = max(variant_count * 12, 12)

    while len(variants) < variant_count and attempts < max_attempts:
        rng = random.Random(
            f"{seed}:{requested_semesters}:{attempts}:{','.join(case.declared_majors)}:{','.join(case.track_ids)}"
        )
        completed_cursor = list(dict.fromkeys(completed + in_progress))
        running_credits_cursor = running_credits
        ordered_completed = list(case.completed_courses)
        invalid_reason = None
        actual_semesters = 0

        for semester_index, semester_label in enumerate(semester_labels):
            current_standing = _credits_to_standing(running_credits_cursor)
            prior_completed = completed if semester_index == 0 else completed_cursor
            prior_in_progress = in_progress if semester_index == 0 else []
            semester_payload = run_recommendation_semester(
                prior_completed,
                prior_in_progress,
                semester_label,
                effective_data,
                case.max_recommendations,
                reverse_map,
                track_id=effective_track_id,
                debug=False,
                current_standing=current_standing,
                chain_depths=chain_depths,
            )

            rec_codes = [
                rec.get("course_code", "")
                for rec in semester_payload.get("recommendations", [])
                if rec.get("course_code")
            ]
            seedable = [code for code in rec_codes if _is_undergrad_course(code)]
            unsat = unsatisfied_active_buckets(semester_payload.get("progress", {}))

            if not seedable:
                if unsat:
                    invalid_reason = (
                        f"Seed builder stalled in {semester_label}: no undergraduate recommendations "
                        f"for {_format_bucket_list(unsat)}."
                    )
                break

            take_min = 1 if len(seedable) < 3 else 3
            take_max = min(5, len(seedable))
            take_count = rng.randint(take_min, take_max)
            chosen_pool = set(rng.sample(seedable, take_count))
            chosen = [code for code in rec_codes if code in chosen_pool]
            if not chosen:
                invalid_reason = f"Seed builder could not choose any course in {semester_label}."
                break

            ordered_completed.extend(chosen)
            actual_semesters += 1
            for course_code in chosen:
                running_credits_cursor += credits_lookup.get(course_code, 3)
            completed_cursor = list(dict.fromkeys(completed_cursor + chosen))

        result = SeededHistoryResult(
            valid=invalid_reason is None,
            actual_semesters=actual_semesters,
            completed_courses=ordered_completed,
            invalid_reason=invalid_reason,
        )
        if result.valid:
            history_key = tuple(result.completed_courses)
            if history_key in seen_histories:
                attempts += 1
                continue
            seen_histories.add(history_key)
        variants.append(result)
        attempts += 1

    while len(variants) < variant_count:
        variants.append(
            SeededHistoryResult(
                valid=False,
                actual_semesters=0,
                completed_courses=list(case.completed_courses),
                invalid_reason="Could not build a unique prereq-hardened seeded history.",
            )
        )

    return variants


def build_nightly_suite(
    seed: int,
    *,
    sample_size: int = NIGHTLY_SAMPLE_SIZE,
    selection_variants: int = NIGHTLY_SELECTION_VARIANTS,
    case_budget: int = NIGHTLY_CASE_BUDGET,
    start_term: str = "Fall 2026",
) -> NightlySuite:
    pool = build_nightly_scenario_pool()
    sampled = sample_nightly_scenarios(seed, sample_size=sample_size)
    expected_tests = expected_nightly_case_count(
        scenario_count=len(sampled),
        profile_count=len(NIGHTLY_PROFILES),
        selection_variants=selection_variants,
    )
    if expected_tests > case_budget:
        raise AssertionError(
            f"Nightly case budget exceeded: expected {expected_tests} > budget {case_budget}."
        )

    cases: list[NightlyCaseSpec] = []
    for scenario in sampled:
        base_case = PlanCase(
            declared_majors=list(scenario.declared_majors),
            track_ids=list(scenario.track_ids),
            declared_minors=list(scenario.declared_minors),
            completed_courses=[],
            in_progress_courses=[],
            target_semester_primary=start_term,
        )
        for profile in NIGHTLY_PROFILES:
            variants = build_seeded_history_variants(
                base_case,
                requested_semesters=profile.seeded_semesters,
                variant_count=selection_variants,
                seed=f"{seed}:{scenario.label}:{profile.label}",
            )
            for variant_index, seeded in enumerate(variants, 1):
                case = PlanCase(
                    declared_majors=list(base_case.declared_majors),
                    track_ids=list(base_case.track_ids),
                    declared_minors=list(base_case.declared_minors),
                    completed_courses=list(seeded.completed_courses),
                    in_progress_courses=[],
                    target_semester_primary=start_term,
                    include_summer=base_case.include_summer,
                    max_recommendations=base_case.max_recommendations,
                )
                cases.append(
                    NightlyCaseSpec(
                        label=f"{scenario.label}/{profile.label}/v{variant_index}",
                        scenario_label=scenario.label,
                        profile_label=profile.label,
                        selection_variant=variant_index,
                        seeded_semesters=seeded.actual_semesters,
                        case=case,
                        invalid_reason=seeded.invalid_reason,
                    )
                )

    return NightlySuite(
        cases=tuple(cases),
        total_possible_scenarios=len(pool),
        sampled_scenario_labels=tuple(s.label for s in sampled),
        profiles_per_scenario=len(NIGHTLY_PROFILES),
        selection_variants=selection_variants,
        expected_tests=expected_tests,
        case_budget=case_budget,
    )


def classify_graduation(
    semesters: list[dict],
    case: PlanCase,
    *,
    max_semesters: int = 8,
    seeded_semesters: int = 0,
) -> GraduationCheck:
    remaining_semesters = max(1, max_semesters - seeded_semesters)
    relevant = semesters[:remaining_semesters]
    if not relevant:
        return GraduationCheck(
            failed=True,
            max_semesters=max_semesters,
            semester_label=None,
            unsatisfied_buckets=["NO_SEMESTERS"],
            total_recommendations=0,
            reproduction_case=case,
        )

    last = relevant[-1]
    unsatisfied = unsatisfied_active_buckets(last.get("progress", {}))
    return GraduationCheck(
        failed=bool(unsatisfied),
        max_semesters=max_semesters,
        semester_label=last.get("target_semester", "?"),
        unsatisfied_buckets=unsatisfied,
        total_recommendations=sum(len(s.get("recommendations", [])) for s in relevant),
        reproduction_case=case,
    )


def format_graduation_failure(check: GraduationCheck) -> str:
    case = check.reproduction_case
    return "\n".join([
        f"NOT GRADUATED BY SEMESTER {check.max_semesters}",
        f"  Final semester checked: {check.semester_label}",
        f"  declared_majors: {case.declared_majors}",
        f"  track_ids: {case.track_ids}",
        f"  declared_minors: {case.declared_minors}",
        f"  total_recommendations: {check.total_recommendations}",
        f"  Unsatisfied buckets: {check.unsatisfied_buckets}",
    ])


def format_nightly_failure(
    *,
    dead_end: DeadEndCheck | None = None,
    graduation: GraduationCheck | None = None,
    invalid_reason: str | None = None,
) -> str:
    parts: list[str] = []
    if invalid_reason:
        parts.append(f"INVALID SEEDED HISTORY\n  {invalid_reason}")
    if dead_end and dead_end.failed:
        debug_sem = rerun_case_with_debug(dead_end.reproduction_case, dead_end.semester_index)
        parts.append(format_failure(dead_end, debug_sem))
    if graduation and graduation.failed:
        parts.append(format_graduation_failure(graduation))
    return "\n\n".join(parts)


def _explain_dead_end_reason(check: DeadEndCheck) -> str:
    bucket_text = _format_bucket_list(check.unsatisfied_buckets)
    if check.failure_kind == "SELECTION_GAP":
        return f"Eligible courses existed, but the planner returned no recommendations for {bucket_text}."
    if check.failure_kind == "MANUAL_REVIEW_BLOCK":
        manual = ", ".join(check.manual_review_courses[:3]) or "manual review courses"
        return f"The path stalled because manual-review courses blocked {bucket_text}: {manual}."
    return f"No eligible courses were available for {bucket_text} across two straight semesters."


def _explain_graduation_reason(check: GraduationCheck) -> str:
    return (
        f"The student still had unfinished requirement buckets by semester {check.max_semesters}: "
        f"{_format_bucket_list(check.unsatisfied_buckets)}."
    )


class NightlyFailureCollector:
    def __init__(self):
        self.records: list[dict] = []
        self.total_tests = 0
        self.seed: int | None = None
        self.total_possible_scenarios = 0
        self.sampled_scenario_labels: list[str] = []
        self.profiles_per_scenario = 0
        self.selection_variants = 0
        self.expected_tests = 0
        self.case_budget = 0
        self.invalid_cases = 0
        self._start_time = time.time()

    def configure_suite(self, suite: NightlySuite, *, seed: int):
        self.seed = seed
        self.total_possible_scenarios = suite.total_possible_scenarios
        self.sampled_scenario_labels = list(suite.sampled_scenario_labels)
        self.profiles_per_scenario = suite.profiles_per_scenario
        self.selection_variants = suite.selection_variants
        self.expected_tests = suite.expected_tests
        self.case_budget = suite.case_budget

    def record_case_issue(
        self,
        spec: NightlyCaseSpec,
        *,
        dead_end: DeadEndCheck | None = None,
        graduation: GraduationCheck | None = None,
        invalid_reason: str | None = None,
    ):
        status_parts: list[str] = []
        reason_parts: list[str] = []
        fail_at = "seed builder"
        if invalid_reason:
            self.invalid_cases += 1
            status_parts.append("invalid seeded history")
            reason_parts.append(invalid_reason)
        else:
            if dead_end and dead_end.failed:
                status_parts.append("dead end")
                reason_parts.append(_explain_dead_end_reason(dead_end))
                fail_at = dead_end.semester_label or fail_at
            if graduation and graduation.failed:
                status_parts.append("not graduated by semester 8")
                reason_parts.append(_explain_graduation_reason(graduation))
                if fail_at == "seed builder":
                    fail_at = graduation.semester_label or "semester 8"

        unsatisfied = []
        if dead_end and dead_end.failed:
            unsatisfied.extend(dead_end.unsatisfied_buckets)
        if graduation and graduation.failed:
            unsatisfied.extend(graduation.unsatisfied_buckets)

        self.records.append({
            "label": spec.label,
            "scenario_label": spec.scenario_label,
            "profile_label": spec.profile_label,
            "selection_variant": spec.selection_variant,
            "seeded_semesters": spec.seeded_semesters,
            "declared_majors": list(spec.case.declared_majors),
            "track_ids": list(spec.case.track_ids),
            "declared_minors": list(spec.case.declared_minors),
            "completed_courses": list(spec.case.completed_courses),
            "status": " + ".join(status_parts) or "issue",
            "fail_at": fail_at,
            "reason": " ".join(reason_parts) if reason_parts else "Unknown nightly failure.",
            "unsatisfied_buckets": list(dict.fromkeys(unsatisfied)),
        })

    def generate_report(self) -> str:
        from datetime import date as _date

        elapsed = time.time() - self._start_time
        mins, secs = divmod(int(elapsed), 60)
        passed = self.total_tests - len(self.records)
        partial = bool(self.expected_tests and self.total_tests != self.expected_tests)

        status_counts: dict[str, int] = {}
        bucket_counts: dict[str, int] = {}
        for record in self.records:
            status_counts[record["status"]] = status_counts.get(record["status"], 0) + 1
            for bucket in record["unsatisfied_buckets"]:
                bucket_counts[bucket] = bucket_counts.get(bucket, 0) + 1

        lines = [
            f"# Nightly Sweep - {_date.today().isoformat()}",
            "",
            "Focused nightly sweep over sampled multi-program combos.",
            "Student histories are planner-seeded, chronological, prereq-hardened, and undergrad-only.",
            "",
            "## Coverage",
            f"- Scenario pool: {len(self.sampled_scenario_labels)}/{self.total_possible_scenarios} sampled combos",
            f"- Student profiles per combo: {self.profiles_per_scenario}",
            f"- Seeded course selections per profile: {self.selection_variants}",
            f"- Expected cases: {self.expected_tests}",
            f"- Executed cases: {self.total_tests}",
            f"- Invalid seeded histories: {self.invalid_cases}",
            f"- Status: {'Partial' if partial else 'Complete'}",
            f"- Seed: `{self.seed or 'unknown'}`",
            f"- Runtime: {mins}m {secs}s",
        ]
        if partial:
            lines.append(
                f"- Completeness note: report is non-exhaustive because executed cases ({self.total_tests}) "
                f"did not match expected cases ({self.expected_tests})."
            )

        lines.extend([
            "",
            "## Summary",
            f"- Passed students: {passed}",
            f"- Reported students: {len(self.records)}",
        ])
        for status, count in sorted(status_counts.items(), key=lambda item: (-item[1], item[0])):
            lines.append(f"- {status.title()}: {count}")
        if bucket_counts:
            hottest = sorted(bucket_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
            lines.append(
                "- Most common unfinished buckets: "
                + ", ".join(f"`{bucket}` ({count})" for bucket, count in hottest)
            )

        if not self.records:
            lines.extend(["", "All sampled students passed the nightly sweep."])
            return "\n".join(lines)

        lines.extend(["", "## Student Logs", ""])
        for index, record in enumerate(self.records, 1):
            tracks = ", ".join(record["track_ids"]) if record["track_ids"] else "none"
            minors = ", ".join(record["declared_minors"]) if record["declared_minors"] else "none"
            courses = ", ".join(record["completed_courses"]) if record["completed_courses"] else "none"
            lines.extend([
                f"### Student {index}",
                f"- combo: {record['scenario_label']}",
                f"- profile: {record['profile_label']} ({record['seeded_semesters']} seeded semesters)",
                f"- selection: variant {record['selection_variant']}",
                f"- majors: {', '.join(record['declared_majors']) or 'none'}",
                f"- track: {tracks}",
                f"- minors: {minors}",
                f"- status: {record['status']}",
                f"- courses taken: {courses}",
                f"- fail at: {record['fail_at']}",
                f"- reason: {record['reason']}",
                "",
            ])
        return "\n".join(lines)


__all__ = [
    "GraduationCheck",
    "NightlyCaseSpec",
    "NightlyFailureCollector",
    "NightlySuite",
    "SeededHistoryResult",
    "build_nightly_suite",
    "build_seeded_history_variants",
    "classify_graduation",
    "format_graduation_failure",
    "format_nightly_failure",
]
