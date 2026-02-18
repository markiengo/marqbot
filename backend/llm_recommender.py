import os
import json

from openai import OpenAI
from prompt_builder import build_prompt, SYSTEM_PROMPT


def get_openai_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in environment")
    return OpenAI(api_key=api_key)


def call_openai(
    candidates: list[dict],
    completed: list[str],
    in_progress: list[str],
    target_semester: str,
    max_recommendations: int,
) -> list[dict]:
    """Calls OpenAI with pre-filtered candidates. Returns parsed JSON recommendations."""
    client = get_openai_client()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    user_msg = build_prompt(candidates, completed, in_progress, target_semester, max_recommendations)

    response = client.chat.completions.create(
        model=model,
        max_tokens=420,
        temperature=0.2,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
    )

    raw = (response.choices[0].message.content or "").strip()
    # Strip markdown code fences if the model wraps the JSON
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    parsed_output = json.loads(raw)
    if not isinstance(parsed_output, list):
        parsed_output = []

    # Re-attach fields the model shouldn't change but might have dropped
    code_to_candidate = {c["course_code"]: c for c in candidates}
    enriched = []
    for rec in parsed_output:
        if not isinstance(rec, dict):
            continue
        code = rec.get("course_code")
        if code not in code_to_candidate:
            continue
        original = code_to_candidate.get(code, {})
        enriched.append({
            "course_code": code,
            "course_name": rec.get("course_name", original.get("course_name", "")),
            "why": rec.get("why", ""),
            "prereq_check": original.get("prereq_check", rec.get("prereq_check", "")),
            "requirement_bucket": original.get("primary_bucket_label") or rec.get("requirement_bucket", ""),
            "fills_buckets": original.get("fills_buckets", rec.get("fills_buckets", [])),
            "unlocks": original.get("unlocks", rec.get("unlocks", [])),
            "has_soft_requirement": original.get("has_soft_requirement", False),
            "soft_tags": original.get("soft_tags", []),
            "low_confidence": original.get("low_confidence", False),
            "notes": original.get("notes"),
        })

    # Guarantee requested count when enough candidates exist:
    # if model returns fewer items, fill with top deterministic candidates.
    target_count = min(max_recommendations, len(candidates))
    chosen_codes = {r["course_code"] for r in enriched}
    for cand in candidates:
        if len(enriched) >= target_count:
            break
        if cand["course_code"] in chosen_codes:
            continue
        enriched.append({
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "why": "Recommended based on unmet requirement priority and prerequisite readiness.",
            "prereq_check": cand.get("prereq_check", ""),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": cand.get("fills_buckets", []),
            "unlocks": cand.get("unlocks", []),
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        })
        chosen_codes.add(cand["course_code"])

    candidate_order = {c["course_code"]: i for i, c in enumerate(candidates)}
    enriched.sort(key=lambda r: candidate_order.get(r["course_code"], 10**9))
    return enriched[:target_count]


def build_deterministic_recommendations(candidates: list[dict], max_recommendations: int) -> list[dict]:
    """Fast local recommendation builder: no LLM call."""
    target_count = min(max_recommendations, len(candidates))
    recs = []
    for cand in candidates[:target_count]:
        buckets = cand.get("fills_buckets", [])
        if buckets:
            why = f"This course advances your Finance major path and counts toward {len(buckets)} unmet requirement bucket(s)."
        else:
            why = "This course advances your Finance major path based on prerequisite order and remaining requirements."
        recs.append({
            "course_code": cand["course_code"],
            "course_name": cand.get("course_name", ""),
            "why": why,
            "prereq_check": cand.get("prereq_check", ""),
            "requirement_bucket": cand.get("primary_bucket_label", ""),
            "fills_buckets": cand.get("fills_buckets", []),
            "unlocks": cand.get("unlocks", []),
            "has_soft_requirement": cand.get("has_soft_requirement", False),
            "soft_tags": cand.get("soft_tags", []),
            "low_confidence": cand.get("low_confidence", False),
            "notes": cand.get("notes"),
        })
    return recs
