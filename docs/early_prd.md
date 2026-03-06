# MarqBot - Product Overview

MarqBot is a degree-planning tool for Marquette University business students. It tells you what courses to take next, tracks your progress toward graduation, and checks whether you're eligible for a specific course.

---

## What it does

### Course Recommendations
You tell MarqBot your major, track, and what you've already taken. It recommends the best courses for your next 1-4 semesters based on your remaining requirements, what's offered that term, and what you're eligible for.

### Progress Tracking
A visual dashboard shows how far along you are in each requirement area: your major, your track (if any), the Business Core (BCC), and the Marquette Core (MCC).

### Eligibility Check
Pick any course and MarqBot tells you if you can take it. If not, it says why (missing prereqs, not offered that semester, etc.).

---

## Who it's for

College of Business students at Marquette, starting with a small pilot of finance students. It supports 7 majors (Finance, Accounting, AIM, Business Analytics, HR, Supply Chain, Information Systems) and 6 optional tracks/concentrations.

---

## How recommendations work

1. Filter out courses you can't take yet (prereqs, standing, not offered).
2. Prioritize what matters most: Marquette Core and Business Core first, then your major, then your track.
3. Prefer courses that unlock the most future options.
4. Pick a balanced set (not all from one requirement area).
5. For multi-semester plans, each semester builds on the one before it.

---

## What MarqBot is not

- Not a registration system. It suggests courses; you still enroll through Marquette's official process.
- Not a replacement for your advisor. It complements advising by showing what's possible next.
- No AI guessing. Every recommendation follows explicit rules from Marquette's published requirements. Same inputs always produce the same output.

---

## Key design choices

- **Data-driven.** All degree requirements live in data tables maintained by advisors, not in code. Adding a new major or track means adding rows, not rewriting logic.
- **Deterministic.** No randomness, no AI hallucination. If two students have the same profile, they get the same recommendations.
- **Transparent.** A debug mode explains exactly why each course was ranked where it was, so advisors can verify the logic.
