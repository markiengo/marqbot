# MarqBot - Product Overview

MarqBot is a degree-planning tool for Marquette University business students. It tells you what courses to take next, tracks your progress toward graduation, checks whether you're eligible for a specific course, lets you save plan snapshots, and gives you a built-in way to send feedback or bug reports.

---

## What it does

### Course Recommendations
You tell MarqBot your major, track, and what you've already taken. It recommends the best courses for your next 1-8 semesters based on your remaining requirements, what you're eligible for, and your chosen scheduling style (Grinder, Explorer, or Mixer). Grinder keeps declared program work concentrated first, Explorer deliberately mixes in discovery, and Mixer balances the two. For now, course offerings are treated as always available while the offering data is being cleaned up.

### Progress Tracking
A visual dashboard shows how far along you are in each requirement area: your major, your track (if any), the Business Core (BCC), and the Marquette Core (MCC).

### Eligibility Check
Pick any course and MarqBot tells you if you can take it. If not, it says why (missing prereqs, standing, program restriction, etc.).

### Saved Plans
Students can save recommendation runs in the browser, reopen them later, compare alternatives without re-entering all of their course history, and export a print-friendly portrait PDF with course, title, credits, prerequisite, and satisfy columns.

### Feedback
Students can send a rating plus open-text feedback from inside the planner. The same form handles bug reports, confusing copy, and feature ideas.

---

## Who it's for

College of Business students at Marquette. It supports 11 majors (Finance, Accounting, AIM, Business Administration, Business Economics, Business Analytics, Human Resource Management, International Business, Information Systems, Marketing, Operations & Supply Chain Management), 7 business tracks (AIM CFA, AIM FinTech, AIM IB, Commercial Banking, Financial Planning, Business Leadership, Professional Selling), 5 MCC Discovery themes, and 6 minors (Business Administration, Entrepreneurship, Human Resources, Information Systems, Marketing, Supply Chain Management).

---

## How recommendations work

1. Filter out courses you can't take yet (prereqs, standing, restrictions, not offered).
2. Protect gateway work that blocks future progress.
3. Let the chosen scheduling style decide how aggressively declared program work stays ahead of discovery and MCC cleanup.
4. Prefer courses that unlock the most future options.
5. Pick a balanced set (not all from one requirement area).
6. For multi-semester plans, each semester builds on the one before it.

---

## What MarqBot is not

- Not a registration system. It suggests courses; you still enroll through Marquette's official process.
- Not a replacement for your advisor. It complements advising by showing what's possible next.
- No AI guessing. Every recommendation follows explicit rules from Marquette's published requirements. Same inputs always produce the same output.
- Not an official source of semester availability right now. Offering awareness is temporarily disabled until that data is reliable enough to trust.

---

## Key design choices

- **Data-driven.** All degree requirements live in data tables maintained by advisors, not in code. Adding a new major or track means adding rows, not rewriting logic.
- **Deterministic.** No randomness, no AI hallucination. If two students have the same profile, they get the same recommendations.
- **Transparent.** A debug mode explains exactly why each course was ranked where it was, so advisors can verify the logic.
- **Feedback-ready.** Students can report bugs and ideas from inside the planner, with their current planner context attached for debugging.
