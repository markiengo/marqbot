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
from semester_recommender import _credits_to_standing, run_recommendation_semester, VALID_SCHEDULING_STYLES


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


def _normalize_string_list(values) -> list[str]:
    if values is None:
        return []
    if isinstance(values, str):
        return [piece.strip() for piece in values.split(",") if piece.strip()]

    normalized: list[str] = []
    for value in values:
        text = str(value).strip()
        if text:
            normalized.append(text)
    return normalized


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


def _health_status(
    *,
    partial: bool,
    total_tests: int,
    reported: int,
    dead_end_count: int,
    not_finished_count: int,
    supplemental_count: int,
) -> str:
    if partial or total_tests == 0:
        return "Red"
    if reported == 0:
        if supplemental_count:
            return "Yellow"
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
    supplemental_count: int,
) -> str:
    if partial or total_tests == 0:
        return (
            f"This run is incomplete, so it should not be used as a clean daily decision signal yet "
            f"({total_tests} of {expected_tests} planned samples were evaluated)."
        )
    if reported == 0 and supplemental_count == 0:
        return "All sampled student plans completed without reported issues."
    if reported == 0 and supplemental_count > 0:
        return "Sampled plans passed, but nightly catalog baseline checks still found issues to review."
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


def _coerce_optional_float(value) -> float | None:
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _extract_failure_kind(details: list[str]) -> str:
    for detail in details:
        text = str(detail or "").strip()
        if text.lower().startswith("failure kind:"):
            return text.split(":", 1)[1].strip().upper()
    return ""


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
    style_count = len(VALID_SCHEDULING_STYLES)
    expected_tests = expected_nightly_case_count(
        scenario_count=len(sampled),
        profile_count=len(NIGHTLY_PROFILES),
        selection_variants=selection_variants,
    ) * style_count
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
                for style in sorted(VALID_SCHEDULING_STYLES):
                    case = PlanCase(
                        declared_majors=list(base_case.declared_majors),
                        track_ids=list(base_case.track_ids),
                        declared_minors=list(base_case.declared_minors),
                        completed_courses=list(seeded.completed_courses),
                        in_progress_courses=[],
                        target_semester_primary=start_term,
                        include_summer=base_case.include_summer,
                        max_recommendations=base_case.max_recommendations,
                        scheduling_style=style,
                    )
                    cases.append(
                        NightlyCaseSpec(
                            label=f"{scenario.label}/{profile.label}/v{variant_index}::style={style}",
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

    # Check progress from the semester AFTER the last recommendations are applied.
    # semesters[N] has progress reflecting recs from semesters 0..N-1.
    check_index = remaining_semesters  # one past the last recommendation semester
    if check_index < len(semesters):
        progress_sem = semesters[check_index]
    else:
        progress_sem = relevant[-1]

    last_rec_sem = relevant[-1]
    unsatisfied = unsatisfied_active_buckets(progress_sem.get("progress", {}))
    return GraduationCheck(
        failed=bool(unsatisfied),
        max_semesters=max_semesters,
        semester_label=last_rec_sem.get("target_semester", "?"),
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
        self.supplemental_checks = 0
        self.supplemental_records: list[dict] = []
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
            "failure_kind": dead_end.failure_kind if dead_end and dead_end.failed else "",
            "manual_review_courses": list(dead_end.manual_review_courses) if dead_end and dead_end.failed else [],
            "eligible_count": dead_end.eligible_count if dead_end and dead_end.failed else None,
            "total_recommendations": (
                graduation.total_recommendations if graduation and graduation.failed else None
            ),
        })

    def record_supplemental_issue(
        self,
        *,
        label: str,
        issue_kind: str,
        reason: str,
        scenario_label: str,
        declared_majors: list[str] | None = None,
        track_ids: list[str] | None = None,
        declared_minors: list[str] | None = None,
        completed_courses: list[str] | None = None,
        unsatisfied_buckets: list[str] | None = None,
        details: list[str] | None = None,
    ):
        self.supplemental_records.append({
            "label": label,
            "issue_kind": issue_kind,
            "reason": reason,
            "scenario_label": scenario_label,
            "declared_majors": _normalize_string_list(declared_majors),
            "track_ids": _normalize_string_list(track_ids),
            "declared_minors": _normalize_string_list(declared_minors),
            "completed_courses": _normalize_string_list(completed_courses),
            "unsatisfied_buckets": list(dict.fromkeys(unsatisfied_buckets or [])),
            "details": list(details or []),
        })

    def _bucket_metadata(self) -> dict[str, dict]:
        data = getattr(server, "_data", {}) or {}
        parent_df = data.get("parent_buckets_df")
        child_df = data.get("child_buckets_df")

        parent_types: dict[str, str] = {}
        if parent_df is not None and len(parent_df) > 0:
            for _, row in parent_df.iterrows():
                parent_id = str(row.get("parent_bucket_id", "") or "").strip().upper()
                if parent_id:
                    parent_types[parent_id] = str(row.get("type", "") or "").strip().lower()

        metadata: dict[str, dict] = {}
        if child_df is None or len(child_df) == 0:
            return metadata

        for _, row in child_df.iterrows():
            parent_id = str(row.get("parent_bucket_id", "") or "").strip().upper()
            child_id = str(row.get("child_bucket_id", "") or "").strip().upper()
            if not parent_id or not child_id:
                continue
            metadata[f"{parent_id}::{child_id}"] = {
                "parent_bucket_id": parent_id,
                "child_bucket_id": child_id,
                "requirement_mode": str(row.get("requirement_mode", "") or "").strip().lower(),
                "courses_required": _coerce_optional_float(row.get("courses_required")),
                "credits_required": _coerce_optional_float(row.get("credits_required")),
                "min_level": _coerce_optional_float(row.get("min_level")),
                "parent_type": parent_types.get(parent_id, ""),
            }
        return metadata

    def _diagnosis_for_issue(
        self,
        *,
        bucket_id: str = "",
        reason: str = "",
        status: str = "",
        issue_kind: str = "",
        failure_kind: str = "",
    ) -> tuple[str, str]:
        text = str(reason or "").strip().lower()
        normalized_issue = str(issue_kind or "").strip().lower()
        normalized_failure_kind = str(failure_kind or "").strip().upper()
        bucket_key = str(bucket_id or "").strip().upper()
        bucket_label = _friendly_bucket_label(bucket_key) if bucket_key else "this issue"
        meta = self._bucket_metadata().get(bucket_key, {})

        if normalized_issue == "nightly collection setup":
            return (
                "tests/backend/test_schema_migration.py",
                "Fix the archived migration imports or other collection-time code errors before trusting the nightly report.",
            )
        if normalized_issue == "advisor gold mismatch":
            return (
                "master_bucket_courses.csv",
                f"Compare mapped intro/core courses and bucket labels against the advisor gold expectations for {bucket_label}.",
            )
        if normalized_issue in {"catalog plan setup", "track catalog audit"} or "program selection failed" in text:
            return (
                "parent_buckets.csv",
                f"Check parent_major, required_major, active, and requires_primary_major metadata for {bucket_label}.",
            )
        if normalized_failure_kind in {"ELIGIBILITY_GAP", "MANUAL_REVIEW_BLOCK"} or "prereq" in text:
            return (
                "course_hard_prereqs.csv",
                f"Look for circular, missing, or over-restrictive prerequisite chains that block {bucket_label}.",
            )
        if meta.get("requirement_mode") == "credits_pool":
            return (
                "child_buckets.csv",
                f"Compare credits_required and min_level against mapped eligible courses for {bucket_label}.",
            )
        if meta.get("min_level") is not None:
            return (
                "child_buckets.csv",
                f"Check courses_required and min_level for {bucket_label} against the courses currently mapped to it.",
            )
        if bucket_key:
            return (
                "master_bucket_courses.csv",
                f"Verify that the needed courses are mapped into {bucket_label}.",
            )
        return (
            "child_buckets.csv",
            f"Review the requirement metadata behind {bucket_label}.",
        )

    def _priority_fix_items(self) -> list[dict]:
        aggregated: dict[str, dict] = {}
        for record in self.records:
            for bucket_id in list(dict.fromkeys(record.get("unsatisfied_buckets") or [])):
                entry = aggregated.setdefault(
                    bucket_id,
                    {
                        "bucket_id": bucket_id,
                        "bucket_label": _friendly_bucket_label(bucket_id),
                        "scenario_labels": set(),
                        "failure_count": 0,
                        "example_record": record,
                    },
                )
                entry["scenario_labels"].add(str(record.get("scenario_label", "") or ""))
                entry["failure_count"] += 1

        items = []
        for entry in aggregated.values():
            csv_to_check, what_to_look_for = self._diagnosis_for_issue(
                bucket_id=entry["bucket_id"],
                reason=str(entry["example_record"].get("reason", "") or ""),
                status=str(entry["example_record"].get("status", "") or ""),
                failure_kind=str(entry["example_record"].get("failure_kind", "") or ""),
            )
            items.append({
                "bucket_id": entry["bucket_id"],
                "bucket_label": entry["bucket_label"],
                "affected_combos": len([label for label in entry["scenario_labels"] if label]),
                "failure_count": entry["failure_count"],
                "csv_to_check": csv_to_check,
                "what_to_look_for": what_to_look_for,
            })

        return sorted(
            items,
            key=lambda item: (-item["affected_combos"], -item["failure_count"], item["bucket_label"]),
        )[:5]

    def _checklist_items(self) -> list[dict]:
        aggregated: dict[tuple[str, str, str], dict] = {}

        for record in self.records:
            buckets = list(dict.fromkeys(record.get("unsatisfied_buckets") or []))
            if not buckets:
                key = (
                    str(record.get("scenario_label", "") or ""),
                    str(record.get("status", "") or ""),
                    "",
                )
                csv_to_check, what_to_look_for = self._diagnosis_for_issue(
                    reason=str(record.get("reason", "") or ""),
                    status=str(record.get("status", "") or ""),
                    failure_kind=str(record.get("failure_kind", "") or ""),
                )
                entry = aggregated.setdefault(
                    key,
                    {
                        "scenario_label": key[0],
                        "subject_label": key[1] or "nightly issue",
                        "csv_to_check": csv_to_check,
                        "what_to_look_for": what_to_look_for,
                        "occurrences": 0,
                    },
                )
                entry["occurrences"] += 1
                continue

            for bucket_id in buckets:
                key = (str(record.get("scenario_label", "") or ""), bucket_id, "record")
                csv_to_check, what_to_look_for = self._diagnosis_for_issue(
                    bucket_id=bucket_id,
                    reason=str(record.get("reason", "") or ""),
                    status=str(record.get("status", "") or ""),
                    failure_kind=str(record.get("failure_kind", "") or ""),
                )
                entry = aggregated.setdefault(
                    key,
                    {
                        "scenario_label": key[0],
                        "subject_label": _friendly_bucket_label(bucket_id),
                        "csv_to_check": csv_to_check,
                        "what_to_look_for": what_to_look_for,
                        "occurrences": 0,
                    },
                )
                entry["occurrences"] += 1

        for record in self.supplemental_records:
            buckets = list(dict.fromkeys(record.get("unsatisfied_buckets") or []))
            if buckets:
                for bucket_id in buckets:
                    key = (str(record.get("scenario_label", "") or ""), bucket_id, str(record.get("issue_kind", "") or ""))
                    csv_to_check, what_to_look_for = self._diagnosis_for_issue(
                        bucket_id=bucket_id,
                        reason=str(record.get("reason", "") or ""),
                        issue_kind=str(record.get("issue_kind", "") or ""),
                        failure_kind=_extract_failure_kind(record.get("details") or []),
                    )
                    entry = aggregated.setdefault(
                        key,
                        {
                            "scenario_label": key[0],
                            "subject_label": _friendly_bucket_label(bucket_id),
                            "csv_to_check": csv_to_check,
                            "what_to_look_for": what_to_look_for,
                            "occurrences": 0,
                        },
                    )
                    entry["occurrences"] += 1
            else:
                subject_label = str(record.get("issue_kind", "") or "catalog issue")
                key = (str(record.get("scenario_label", "") or ""), subject_label, "supplemental")
                csv_to_check, what_to_look_for = self._diagnosis_for_issue(
                    reason=str(record.get("reason", "") or ""),
                    issue_kind=str(record.get("issue_kind", "") or ""),
                    failure_kind=_extract_failure_kind(record.get("details") or []),
                )
                entry = aggregated.setdefault(
                    key,
                    {
                        "scenario_label": key[0],
                        "subject_label": subject_label,
                        "csv_to_check": csv_to_check,
                        "what_to_look_for": what_to_look_for,
                        "occurrences": 0,
                    },
                )
                entry["occurrences"] += 1

        items = list(aggregated.values())
        return sorted(
            items,
            key=lambda item: (-item["occurrences"], _friendly_scenario_label(item["scenario_label"]), item["subject_label"]),
        )[:12]

    def _program_groups(self) -> list[dict]:
        grouped: dict[str, dict] = {}

        for record in self.records:
            scenario_label = str(record.get("scenario_label", "") or "")
            entry = grouped.setdefault(
                scenario_label,
                {
                    "scenario_label": scenario_label,
                    "friendly_label": _friendly_scenario_label(scenario_label),
                    "sampled_failures": 0,
                    "supplemental_failures": 0,
                    "buckets": Counter(),
                    "issue_kinds": Counter(),
                },
            )
            entry["sampled_failures"] += 1
            for bucket_id in list(dict.fromkeys(record.get("unsatisfied_buckets") or [])):
                entry["buckets"][_friendly_bucket_label(bucket_id)] += 1

        for record in self.supplemental_records:
            scenario_label = str(record.get("scenario_label", "") or "")
            entry = grouped.setdefault(
                scenario_label,
                {
                    "scenario_label": scenario_label,
                    "friendly_label": _friendly_scenario_label(scenario_label),
                    "sampled_failures": 0,
                    "supplemental_failures": 0,
                    "buckets": Counter(),
                    "issue_kinds": Counter(),
                },
            )
            entry["supplemental_failures"] += 1
            entry["issue_kinds"][str(record.get("issue_kind", "") or "catalog issue")] += 1
            for bucket_id in list(dict.fromkeys(record.get("unsatisfied_buckets") or [])):
                entry["buckets"][_friendly_bucket_label(bucket_id)] += 1

        items = []
        for entry in grouped.values():
            top_buckets = [label for label, _count in entry["buckets"].most_common(3)]
            top_issue_kinds = [label for label, _count in entry["issue_kinds"].most_common(3)]
            items.append({
                "scenario_label": entry["scenario_label"],
                "friendly_label": entry["friendly_label"],
                "sampled_failures": entry["sampled_failures"],
                "supplemental_failures": entry["supplemental_failures"],
                "top_buckets": top_buckets,
                "top_issue_kinds": top_issue_kinds,
                "total_failures": entry["sampled_failures"] + entry["supplemental_failures"],
            })

        return sorted(
            items,
            key=lambda item: (-item["total_failures"], item["friendly_label"]),
        )[:8]

    def _select_representative_cases(self, max_cases: int = 10) -> list[dict]:
        """Pick up to *max_cases* diverse representative records."""
        if not self.records:
            return []

        selected: list[dict] = []
        selected_keys: set[str] = set()

        def _add(record: dict) -> None:
            key = record["label"]
            if key not in selected_keys and len(selected) < max_cases:
                selected_keys.add(key)
                selected.append(record)

        # 1. One per unique status type
        seen_statuses: set[str] = set()
        for record in self.records:
            status = record["status"]
            if status not in seen_statuses:
                seen_statuses.add(status)
                _add(record)

        # 2. One per top-5 unsatisfied bucket (prefer different scenarios)
        bucket_counts: Counter[str] = Counter()
        for record in self.records:
            for bucket in record.get("unsatisfied_buckets") or []:
                bucket_counts[str(bucket)] += 1
        seen_scenarios: set[str] = {r["scenario_label"] for r in selected}
        for bucket, _count in bucket_counts.most_common(5):
            for record in self.records:
                if bucket in (record.get("unsatisfied_buckets") or []):
                    if record["scenario_label"] not in seen_scenarios or len(selected) < max_cases:
                        seen_scenarios.add(record["scenario_label"])
                        _add(record)
                        break

        return selected

    def to_snapshot(self, *, report_date: str | None = None) -> dict:
        from datetime import date as _date

        elapsed = time.time() - self._start_time
        mins, secs = divmod(int(elapsed), 60)
        passed = self.total_tests - len(self.records)
        partial = bool(self.expected_tests and self.total_tests != self.expected_tests)
        resolved_report_date = str(report_date or _date.today().isoformat())

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
            supplemental_count=len(self.supplemental_records),
        )

        return {
            "report_version": 2,
            "report_date": resolved_report_date,
            "status": health,
            "plain_summary": _plain_summary(
                partial=partial,
                total_tests=self.total_tests,
                expected_tests=self.expected_tests,
                invalid_count=invalid_count,
                not_finished_count=not_finished_count,
                dead_end_count=dead_end_count,
                reported=len(self.records),
                supplemental_count=len(self.supplemental_records),
            ),
            "runtime": {
                "minutes": mins,
                "seconds": secs,
            },
            "suite": {
                "seed": self.seed,
                "total_possible_scenarios": self.total_possible_scenarios,
                "sampled_scenario_labels": list(self.sampled_scenario_labels),
                "profiles_per_scenario": self.profiles_per_scenario,
                "selection_variants": self.selection_variants,
                "expected_tests": self.expected_tests,
                "case_budget": self.case_budget,
            },
            "totals": {
                "total_tests": self.total_tests,
                "passed_tests": max(passed, 0),
                "reported_issues": len(self.records),
                "invalid_cases": self.invalid_cases,
                "supplemental_checks": self.supplemental_checks,
                "supplemental_issues": len(self.supplemental_records),
                "partial": partial,
                "status_counts": dict(status_counts),
                "dead_end_count": dead_end_count,
                "not_finished_count": not_finished_count,
                "invalid_count": invalid_count,
            },
            "priority_fix_list": self._priority_fix_items(),
            "data_investigation_checklist": self._checklist_items(),
            "failures_by_program": self._program_groups(),
            "records": self.records,
            "supplemental_records": self.supplemental_records,
        }

    def generate_report(self, *, report_date: str | None = None) -> str:
        snapshot = self.to_snapshot(report_date=report_date)
        totals = snapshot["totals"]
        suite = snapshot["suite"]

        lines = [
            f"# Nightly Planner Report - {snapshot['report_date']}",
            "",
            "Nightly graduation audit for sampled student plans.",
            "Start with the summary, then check Fix First and Programs To Review.",
            "",
            "## Start Here",
            f"- Overall result: {snapshot['status']}",
            f"- Summary: {snapshot['plain_summary']}",
            f"- Review date: {snapshot['report_date']}",
            f"- Students graduating by semester 8: {totals['passed_tests']} of {self.total_tests}",
            f"- Students not graduating by semester 8: {totals['not_finished_count']}",
            f"- Plans blocked before evaluation: {totals['invalid_count']}",
            f"- Runtime: {snapshot['runtime']['minutes']}m {snapshot['runtime']['seconds']}s",
        ]
        if totals["partial"]:
            lines.append(
                f"- Run Completeness: Incomplete. Only {self.total_tests} of {self.expected_tests} planned samples were evaluated."
            )
        else:
            lines.append(f"- Run Completeness: Complete. {self.total_tests} planned samples were evaluated.")

        lines.extend([
            "",
            "## Why Students Failed",
        ])

        if totals["partial"]:
            lines.append(
                "- The run itself needs attention first: "
                f"{_count_phrase(self.total_tests, 'planned sample')} out of "
                f"{_count_phrase(self.expected_tests, 'planned sample')} were evaluated."
            )
        if totals["invalid_count"]:
            top_invalid_reason = Counter(
                _plain_invalid_reason(str(record.get("reason", "") or ""))
                for record in self.records
                if "invalid seeded history" in str(record.get("status", "") or "")
            ).most_common(1)[0][0]
            lines.append(
                f"- {_count_phrase(totals['invalid_count'], 'sampled plan')} could not be evaluated. "
                f"Most commonly, {top_invalid_reason}"
            )
        if totals["not_finished_count"]:
            lines.append(
                f"- {_count_phrase(totals['not_finished_count'], 'sampled plan')} did not finish within 8 semesters."
            )
        if totals["dead_end_count"]:
            lines.append(
                f"- {_count_phrase(totals['dead_end_count'], 'sampled plan')} ran out of valid next courses before finishing."
            )
        if self.supplemental_records:
            kind_counts = Counter(record["issue_kind"] for record in self.supplemental_records)
            summary = ", ".join(
                f"{count} {kind}"
                for kind, count in sorted(kind_counts.items(), key=lambda item: (-item[1], item[0]))
            )
            lines.append(
                f"- {_count_phrase(len(self.supplemental_records), 'nightly catalog baseline check')} failed: {summary}."
            )
        if not any([
            totals["partial"],
            totals["invalid_count"],
            totals["not_finished_count"],
            totals["dead_end_count"],
            self.supplemental_records,
        ]):
            lines.append("- No action items were reported in this run.")

        lines.extend(["", "## Most Common Open Buckets"])
        bucket_counts = Counter()
        for record in self.records:
            for bucket in record.get("unsatisfied_buckets") or []:
                bucket_counts[str(bucket)] += 1
        if bucket_counts:
            hottest = sorted(bucket_counts.items(), key=lambda item: (-item[1], item[0]))[:5]
            for bucket, count in hottest:
                lines.append(f"- {_friendly_bucket_label(bucket)} remained open in {count} sampled plans.")
        elif len(self.records) == 0 and not totals["partial"]:
            lines.append("- No recurring requirement gaps were found in the sampled plans.")
        else:
            lines.append("- No requirement pattern summary is available for this run.")

        lines.extend(["", "## Fix First"])
        if snapshot["priority_fix_list"]:
            for item in snapshot["priority_fix_list"]:
                lines.append(
                    f"- {item['bucket_label']} affected {item['affected_combos']} distinct program combos "
                    f"({item['failure_count']} sampled failures). Check `{item['csv_to_check']}`."
                )
        else:
            lines.append("- No recurring bucket failures were found to prioritize.")

        lines.extend(["", "## Where To Look In Data"])
        if snapshot["data_investigation_checklist"]:
            for item in snapshot["data_investigation_checklist"]:
                lines.append(
                    f"- {_friendly_scenario_label(item['scenario_label'])}: check `{item['csv_to_check']}` for "
                    f"{item['subject_label']} ({item['what_to_look_for']})"
                )
        else:
            lines.append("- No data-investigation checklist items were generated for this run.")

        lines.extend(["", "## Baseline Audit Failures"])
        if self.supplemental_records:
            grouped: Counter[tuple[str, str]] = Counter(
                (record["issue_kind"], record["scenario_label"]) for record in self.supplemental_records
            )
            for (issue_kind, scenario_label), count in sorted(
                grouped.items(),
                key=lambda item: (-item[1], item[0][0], item[0][1]),
            )[:8]:
                sample = next(
                    (
                        record for record in self.supplemental_records
                        if record["issue_kind"] == issue_kind and record["scenario_label"] == scenario_label
                    ),
                    None,
                )
                if sample is None:
                    continue
                lines.append(
                    f"- {_count_phrase(count, issue_kind)} in {scenario_label}: {sample['reason']}"
                )
        else:
            lines.append("- No nightly catalog baseline issues were reported.")

        lines.extend(["", "## Programs To Review"])
        if snapshot["failures_by_program"]:
            for item in snapshot["failures_by_program"]:
                summary_parts = []
                if item["sampled_failures"]:
                    summary_parts.append(f"{item['sampled_failures']} sampled-plan failures")
                if item["supplemental_failures"]:
                    summary_parts.append(f"{item['supplemental_failures']} baseline/audit issues")
                if item["top_buckets"]:
                    summary_parts.append("open buckets: " + ", ".join(item["top_buckets"]))
                if item["top_issue_kinds"]:
                    summary_parts.append("audit types: " + ", ".join(item["top_issue_kinds"]))
                lines.append(f"- {item['friendly_label']}: {'; '.join(summary_parts)}")
        else:
            lines.append("- No program-specific grouping is available for this run.")

        lines.extend(["", "## Student Groups To Review"])
        scenario_counts: Counter[tuple[str, str]] = Counter()
        for record in self.records:
            scenario_counts[(str(record["status"]), str(record["scenario_label"]))] += 1
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
        elif len(self.records) == 0 and not totals["partial"]:
            lines.append("- No sample groups were flagged for review in this run.")
        else:
            lines.append("- No sample groups were available to summarize.")

        # --- Compute pass rate and failure breakdown for insights ---
        pass_rate = (
            f"{totals['passed_tests'] / self.total_tests * 100:.1f}%"
            if self.total_tests > 0 else "N/A"
        )
        status_counts = totals.get("status_counts", {})
        status_breakdown = []
        for status_label, count in sorted(status_counts.items(), key=lambda x: -x[1]):
            status_breakdown.append(f"  - {status_label}: {count}")

        lines.extend([
            "",
            "## How This Nightly Audit Works",
            "",
            "### How students are picked",
            "",
            f"The nightly sweep draws {len(self.sampled_scenario_labels)} program combos "
            f"out of {self.total_possible_scenarios} possible combinations, using a date-seeded RNG "
            f"(seed `{suite['seed'] or 'unknown'}`) so runs are reproducible.",
            "Each combo represents a realistic student declaration: a set of majors, tracks, and minors "
            "that a student could actually enroll in.",
            "",
            "### How course histories are built",
            "",
            f"For each combo, {suite['profiles_per_scenario']} student profiles are generated "
            "at different stages of progress:",
            "- **foundation** (1 seeded semester): a student who just started",
            "- **early** (2 semesters): through their first year",
            "- **mid** (3 semesters): beginning upper-division work",
            "- **late** (4 semesters): well into their major",
            "- **capstone** (5 semesters): approaching graduation",
            "",
            f"Each profile is tested with {suite['selection_variants']} randomly-varied course-history "
            "selections to avoid overfitting to one specific path. "
            f"This produces {suite['expected_tests']} total test cases.",
            "",
            "### How pass/fail is determined",
            "",
            "The planner recommends up to 6 courses per semester for 8 semesters (48 courses total). "
            "A case **passes** if every active requirement bucket is satisfied by the end of semester 8. "
            "A case **fails** if any bucket remains open, the planner hits a dead end with no valid courses, "
            "or the seeded history could not be built (invalid combo).",
            "",
            "## Run Facts",
            "",
            f"- Seed: `{suite['seed'] or 'unknown'}`",
            f"- Sampled plan groups: {len(self.sampled_scenario_labels)} of {self.total_possible_scenarios}",
            f"- Profiles per group: {suite['profiles_per_scenario']} | Variants per profile: {suite['selection_variants']}",
            f"- Total cases: {self.total_tests} of {suite['expected_tests']} planned",
            f"- Pass rate: {totals['passed_tests']} passed ({pass_rate})",
            f"- Issues: {len(self.records)} | Invalid: {self.invalid_cases}",
            f"- Catalog baseline checks: {self.supplemental_checks} run, {len(self.supplemental_records)} issues",
            f"- Runtime: {snapshot['runtime']['minutes']}m {snapshot['runtime']['seconds']}s",
        ])
        if status_breakdown:
            lines.append("- Failure breakdown:")
            lines.extend(status_breakdown)

        representative = self._select_representative_cases()
        if not representative and not self.supplemental_records:
            lines.extend(["", "## Representative Cases", "", "No cases were recorded for this run."])
            return "\n".join(lines)

        lines.extend([
            "",
            "## Representative Cases",
            "",
            f"Showing {len(representative)} representative cases out of {len(self.records)} total. "
            "Cases are selected for diversity across failure types, unsatisfied buckets, and program combos. "
            "Full data is in the JSON snapshot.",
            "",
        ])
        for index, record in enumerate(representative, 1):
            tracks = ", ".join(record["track_ids"]) if record["track_ids"] else "none"
            minors = ", ".join(record["declared_minors"]) if record["declared_minors"] else "none"
            courses = ", ".join(record["completed_courses"]) if record["completed_courses"] else "none"
            unsatisfied = record.get("unsatisfied_buckets") or []
            lines.extend([
                f"#### Case {index}",
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
            ])
            if unsatisfied:
                lines.append(
                    "- open buckets: "
                    + ", ".join(_friendly_bucket_label(b) for b in unsatisfied)
                )
            lines.append("")
        if self.supplemental_records:
            lines.extend(["## Catalog Baseline Logs", ""])
            shown_supplemental = self.supplemental_records[:5]
            if len(self.supplemental_records) > 5:
                lines.append(
                    f"Showing {len(shown_supplemental)} of {len(self.supplemental_records)} "
                    "catalog issues. Full data is in the JSON snapshot."
                )
                lines.append("")
            for index, record in enumerate(shown_supplemental, 1):
                lines.extend([
                    f"#### Catalog Issue {index}",
                    f"- label: {record['label']}",
                    f"- kind: {record['issue_kind']}",
                    f"- scenario: {record['scenario_label']}",
                    f"- reason: {record['reason']}",
                ])
                if record["unsatisfied_buckets"]:
                    lines.append(
                        "- buckets: "
                        + ", ".join(_friendly_bucket_label(bucket) for bucket in record["unsatisfied_buckets"])
                    )
                lines.append("")
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
