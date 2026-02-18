import json

SYSTEM_PROMPT = """You are a Marquette University Finance academic advisor assistant.
You will receive a short list of pre-vetted courses a student is eligible to take next term.
All prerequisite checks, offering filters, and requirement bucket labels have already been applied.

Your job:
1. Select the best 2-3 courses (or the number specified) from the provided list
2. Prioritize courses that fill more requirement buckets and are from higher-priority buckets
3. Write a 1-2 sentence "why" explanation for each that references the student's specific situation
4. Preserve all other fields exactly as provided — do NOT change prereq_check, requirement_bucket, or unlocks

Output ONLY a valid JSON array. No markdown. No prose outside the JSON.
Never add courses not in the input list. Never override eligibility or bucket labels.

Schema per item (output exactly this structure):
{
  "course_code": "...",
  "course_name": "...",
  "why": "1-2 sentences explaining why this course is a good next step for this student.",
  "prereq_check": "...",
  "requirement_bucket": "...",
  "fills_buckets": [...],
  "unlocks": [...]
}"""


def build_prompt(
    candidates: list[dict],
    completed: list[str],
    in_progress: list[str],
    target_semester: str,
    max_recommendations: int = 3,
) -> str:
    """
    Builds the user message sent to the LLM.
    The LLM only receives pre-filtered candidates — never decides eligibility.
    """
    context_lines = []

    if completed:
        context_lines.append(f"Completed courses: {', '.join(completed)}")
    else:
        context_lines.append("Completed courses: none")

    if in_progress:
        context_lines.append(f"Currently in progress: {', '.join(in_progress)}")

    context_lines.append(f"Target semester: {target_semester}")
    context_lines.append(f"Return exactly {max_recommendations} recommendations (or fewer if fewer candidates provided).")
    context_lines.append("")
    context_lines.append(
        "Eligible courses (pre-filtered — all prereqs satisfied, all offered this term):"
    )

    # Simplify candidates for the LLM — only what's needed for explanation
    llm_candidates = []
    for c in candidates:
        llm_candidates.append({
            "course_code": c["course_code"],
            "course_name": c["course_name"],
            "prereq_check": c.get("prereq_check", ""),
            "requirement_bucket": c.get("primary_bucket_label") or c.get("primary_bucket", ""),
            "fills_buckets": c.get("fills_buckets", []),
            "unlocks": c.get("unlocks", []),
            "soft_warnings": c.get("soft_tags", []),
            "low_confidence_offering": c.get("low_confidence", False),
        })

    context_lines.append(json.dumps(llm_candidates, indent=2))

    return "\n".join(context_lines)
