from __future__ import annotations

from collections import Counter
import random
import re
import time
from dataclasses import dataclass
from functools import lru_cache

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


def _titleize_words(text: str) -> str:
    parts = []
    for word in str(text or "").split():
        if word.isupper() and len(word) <= 5:
            parts.append(word)
        else:
            parts.append(word.capitalize())
    return " ".join(parts)


def _fallback_program_label(program_id: str) -> str:
    raw = str(program_id or "").strip().upper()
    if not raw:
        return "Unknown program"

    suffix_map = {
        "_MAJOR": "major",
        "_TRACK": "track",
        "_MINOR": "minor",
        "_CONC": "concentration",
    }
    for suffix, noun in suffix_map.items():
        if raw.endswith(suffix):
            stem = raw[: -len(suffix)]
            words = _titleize_words(stem.replace("_", " "))
            return f"{words} {noun}"
    return _titleize_words(raw.replace("_", " "))


def _fallback_bucket_label(bucket_id: str) -> str:
    raw = str(bucket_id or "").strip()
    if not raw:
        return "Unknown requirement"

    normalized = raw.replace("-", " ").replace("_", " ").lower()
    normalized = re.sub(r"\s+", " ", normalized).strip()
    replacements = {
        "req core": "required courses",
        "core requirements": "core requirements",
        "required": "required",
        "choose n": "choice requirement",
        "elec": "electives",
        "culm": "culminating requirement",
        "upper": "upper division",
    }
    for old, new in replacements.items():
        normalized = normalized.replace(old, new)
    return _titleize_words(normalized)


@lru_cache(maxsize=1)
def _label_lookups() -> tuple[dict[str, str], dict[str, str]]:
    data = getattr(server, "_data", {}) or {}
    parent_buckets_df = data.get("parent_buckets_df")
    child_buckets_df = data.get("child_buckets_df")

    program_labels: dict[str, str] = {}
    bucket_labels: dict[str, str] = {}

    if parent_buckets_df is not None and len(parent_buckets_df) > 0:
        for _, row in parent_buckets_df.iterrows():
            parent_id = str(row.get("parent_bucket_id", "") or "").strip().upper()
            if not parent_id:
                continue
            parent_label = str(row.get("parent_bucket_label", parent_id) or "").strip() or parent_id
            program_labels[parent_id] = parent_label

    if child_buckets_df is not None and len(child_buckets_df) > 0:
        for _, row in child_buckets_df.iterrows():
            child_id = str(row.get("child_bucket_id", "") or "").strip().lower()
            if not child_id:
                continue
            child_label = str(row.get("child_bucket_label", child_id) or "").strip() or child_id
            parent_id = str(row.get("parent_bucket_id", "") or "").strip().upper()
            parent_label = program_labels.get(parent_id, _fallback_program_label(parent_id))
            bucket_labels[child_id] = f"{parent_label}: {child_label}" if parent_label else child_label

    return program_labels, bucket_labels


def _friendly_program_label(program_id: str) -> str:
    program_labels, _ = _label_lookups()
    raw = str(program_id or "").strip().upper()
    return program_labels.get(raw, _fallback_program_label(raw))


def _friendly_bucket_label(bucket_id: str) -> str:
    _, bucket_labels = _label_lookups()
    raw = str(bucket_id or "").strip()
    if not raw:
        return "Unknown requirement"
    if raw == "NO_SEMESTERS":
        return "No semesters were available to evaluate"

    parent_id, sep, child_id = raw.partition("::")
    child_key = (child_id if sep else raw).strip().lower()
    mapped = bucket_labels.get(child_key)
    if mapped:
        return mapped
    if sep:
        return f"{_friendly_program_label(parent_id)}: {_fallback_bucket_label(child_id)}"
    return _fallback_bucket_label(raw)


def _friendly_scenario_label(scenario_label: str) -> str:
    raw = str(scenario_label or "").strip()
    if not raw:
        return "Unknown sample group"

    _, sep, remainder = raw.partition("-")
    payload = remainder if sep else raw
    parts = [piece for piece in payload.split("+") if piece]
    if not parts:
        return raw
    return " + ".join(_friendly_program_label(part) for part in parts)


def _plain_invalid_reason(reason: str) -> str:
    text = str(reason or "").strip()
    if not text:
        return "the sample could not be evaluated."
    if "PRIMARY_MAJOR_REQUIRED" in text:
        return "a selected track required a matching major that was not declared."
    if "declared_majors cannot be empty" in text:
        return "the sample ended up with no declared major."
    if "Could not build a unique prereq-hardened seeded history" in text:
        return "the test runner could not build a unique student history for this sample."
    if "Seed builder stalled in" in text:
        return "the seeded history builder ran out of undergraduate course options."
    return "the sample could not be evaluated."


def _plain_reason(record: dict) -> str:
    status = str(record.get("status", "") or "")
    buckets = list(record.get("unsatisfied_buckets") or [])
    first_bucket = _friendly_bucket_label(buckets[0]) if buckets else "remaining requirements"

    if "invalid seeded history" in status:
        return _plain_invalid_reason(str(record.get("reason", "") or ""))
    if "dead end" in status and "not graduated by semester 8" in status:
        return (
            f"the planner ran out of valid next courses, and the plan still had open work in {first_bucket}."
        )
    if "dead end" in status:
        return f"the planner ran out of valid next courses around {first_bucket}."
    if "not graduated by semester 8" in status:
        return f"the plan still had open work in {first_bucket} by semester 8."
    return "the sample needs review."


def _health_status(*, partial: bool, total_tests: int, reported: int, dead_end_count: int, not_finished_count: int) -> str:
    if partial or total_tests == 0:
        return "Red"
    if reported == 0:
        return "Green"
    if dead_end_count > 0 or not_finished_count >= max(5, total_tests // 4):
        return "Red"
    return "Yellow"


def _plain_summary(
    *,
    partial: bool,
    total_tests: int,
    expected_tests: int,
    invalid_count: int,
    not_finished_count: int,
    dead_end_count: int,
    reported: int,
) -> str:
    if partial or total_tests == 0:
        return (
            f"This run is incomplete, so it should not be used as a clean daily decision signal yet "
            f"({total_tests} of {expected_tests} planned samples were evaluated)."
        )
    if reported == 0:
        return "All sampled student plans completed without reported issues."
    if not_finished_count > 0:
        return "Many sampled student plans still do not finish within 8 semesters."
    if dead_end_count > 0:
        return "Some sampled student plans still run out of valid next courses."
    if invalid_count > 0:
        return "Some sampled student plans could not be evaluated because the sample setup was invalid."
    return "This run found issues that still need review."


def _count_phrase(count: int, singular: str, plural: str | None = None) -> str:
    noun = singular if count == 1 else (plural or f"{singular}s")
    return f"{count} {noun}"


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

        status_counts: Counter[str] = Counter()
        bucket_counts: Counter[str] = Counter()
        scenario_counts: Counter[tuple[str, str]] = Counter()
        invalid_reason_counts: Counter[str] = Counter()
        for record in self.records:
            status = str(record["status"])
            status_counts[status] += 1
            scenario_counts[(status, str(record["scenario_label"]))] += 1
            for bucket in record["unsatisfied_buckets"]:
                bucket_counts[bucket] += 1
            if "invalid seeded history" in status:
                invalid_reason_counts[_plain_invalid_reason(str(record["reason"]))] += 1

        invalid_count = sum(
            count for status, count in status_counts.items() if "invalid seeded history" in status
        )
        not_finished_count = sum(
            count for status, count in status_counts.items() if "not graduated by semester 8" in status
        )
        dead_end_count = sum(
            count for status, count in status_counts.items() if "dead end" in status
        )
        health = _health_status(
            partial=partial,
            total_tests=self.total_tests,
            reported=len(self.records),
            dead_end_count=dead_end_count,
            not_finished_count=not_finished_count,
        )

        lines = [
            f"# Nightly Planner Report - {_date.today().isoformat()}",
            "",
            "Daily decision summary for sampled student plans.",
            "This version is written for quick review first, with raw case logs saved in the appendix.",
            "",
            "## Overall Health",
            f"- Status: {health}",
            "- Plain-English Summary: "
            + _plain_summary(
                partial=partial,
                total_tests=self.total_tests,
                expected_tests=self.expected_tests,
                invalid_count=invalid_count,
                not_finished_count=not_finished_count,
                dead_end_count=dead_end_count,
                reported=len(self.records),
            ),
            f"- Review Date: {_date.today().isoformat()}",
            f"- Runtime: {mins}m {secs}s",
        ]
        if partial:
            lines.append(
                f"- Run Completeness: Incomplete. Only {self.total_tests} of {self.expected_tests} planned samples were evaluated."
            )
        else:
            lines.append(f"- Run Completeness: Complete. {self.total_tests} planned samples were evaluated.")

        lines.extend([
            "",
            "## What Needs Attention",
        ])

        if partial:
            lines.append(
                "- The run itself needs attention first: "
                f"{_count_phrase(self.total_tests, 'planned sample')} out of "
                f"{_count_phrase(self.expected_tests, 'planned sample')} were evaluated."
            )
        if invalid_count:
            top_invalid_reason = invalid_reason_counts.most_common(1)[0][0]
            lines.append(
                f"- {_count_phrase(invalid_count, 'sampled plan')} could not be evaluated. "
                f"Most commonly, {top_invalid_reason}"
            )
        if not_finished_count:
            lines.append(
                f"- {_count_phrase(not_finished_count, 'sampled plan')} did not finish within 8 semesters."
            )
        if dead_end_count:
            lines.append(
                f"- {_count_phrase(dead_end_count, 'sampled plan')} ran out of valid next courses before finishing."
            )
        if not any([partial, invalid_count, not_finished_count, dead_end_count]):
            lines.append("- No action items were reported in this run.")

        lines.extend(["", "## Biggest Patterns"])
        if bucket_counts:
            hottest = sorted(bucket_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
            for bucket, count in hottest:
                lines.append(f"- {_friendly_bucket_label(bucket)} remained open in {count} sampled plans.")
        elif len(self.records) == 0 and not partial:
            lines.append("- No recurring requirement gaps were found in the sampled plans.")
        else:
            lines.append("- No requirement pattern summary is available for this run.")

        lines.extend(["", "## Sample Plan Groups To Review"])
        top_groups = sorted(scenario_counts.items(), key=lambda item: (-item[1], item[0][0], item[0][1]))[:5]
        if top_groups:
            for (status, scenario_label), count in top_groups:
                matching_record = next(
                    (
                        record for record in self.records
                        if record["status"] == status and record["scenario_label"] == scenario_label
                    ),
                    None,
                )
                plain_reason = _plain_reason(matching_record or {})
                lines.append(
                    f"- {_count_phrase(count, 'sampled student')} in "
                    f"{_friendly_scenario_label(scenario_label)} needed review because {plain_reason}"
                )
        elif len(self.records) == 0 and not partial:
            lines.append("- No sample groups were flagged for review in this run.")
        else:
            lines.append("- No sample groups were available to summarize.")

        lines.extend(["", "## Appendix", "", "### Run Details"])
        lines.extend([
            f"- Sampled plan groups: {len(self.sampled_scenario_labels)} of {self.total_possible_scenarios}",
            f"- Student profiles per group: {self.profiles_per_scenario}",
            f"- Course-history variants per profile: {self.selection_variants}",
            f"- Planned samples: {self.expected_tests}",
            f"- Evaluated samples: {self.total_tests}",
            f"- Samples with no reported issues: {max(passed, 0)}",
            f"- Samples with reported issues: {len(self.records)}",
            f"- Samples that could not be evaluated: {self.invalid_cases}",
            f"- Seed: `{self.seed or 'unknown'}`",
        ])

        if not self.records:
            lines.extend(["", "### Student Profile Logs", "", "No student profile logs were recorded for this run."])
            return "\n".join(lines)

        lines.extend(["", "### Student Profile Logs", ""])
        for index, record in enumerate(self.records, 1):
            tracks = ", ".join(record["track_ids"]) if record["track_ids"] else "none"
            minors = ", ".join(record["declared_minors"]) if record["declared_minors"] else "none"
            courses = ", ".join(record["completed_courses"]) if record["completed_courses"] else "none"
            lines.extend([
                f"#### Student {index}",
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
