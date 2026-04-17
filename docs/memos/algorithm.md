# How MarqBot Plans Your Degree

Last updated: April 17, 2026

## The Short Version

You tell MarqBot what programs you're in and what you've already taken. MarqBot figures out what you still need, removes anything you can't take yet, ranks the rest by importance, and fills your semesters. Same inputs, same plan, every time.

---

## Step by Step

### 1. You Pick Your Programs

When you first open MarqBot, you choose your major (like Finance or Marketing), and optionally a track and a minor. MarqBot uses this to build your personal requirement checklist — every course bucket you need to complete before you graduate.

If you're a College of Business student, MarqBot also loads the Business Common Core (BCC), which is the shared set of foundational business courses every CoBA major has to take. On top of that, there's the Marquette Core Curriculum (MCC) — the university-wide requirements that every Marquette student completes regardless of major.

So your full requirement set looks something like:

- **MCC Foundation** — the core classes everyone takes (rhetoric, theology, philosophy, math, etc.)
- **Business Common Core** — the shared business foundation (accounting, economics, statistics, etc.)
- **Your major requirements** — the courses specific to your chosen major
- **Track or minor requirements** — if you picked one
- **MCC Writing Intensive and Culminating** — upper-division core requirements that come later
- **Discovery themes** — the exploratory part of MCC where you pick from broad topic areas

### 2. You Add What You've Already Taken

You enter your completed courses and anything currently in progress. MarqBot checks each one against your requirement buckets and marks off what's done.

If a course counts toward a specific requirement (like "FINA 3001 fills the Finance Core"), MarqBot puts it there first. If you've taken more courses than a bucket needs — say you completed two courses that could both fill the same single slot — the extra one spills into an elective pool if one exists, rather than going to waste.

MarqBot never double-counts a course in conflicting buckets. If two requirements both want the same course, the more specific requirement wins.

### 3. MarqBot Figures Out What You Can Take

Before recommending anything, MarqBot filters out courses you're not eligible for. This means checking:

- **Prerequisites**: Did you complete the required courses? For example, you can't take FINA 3001 until you've passed ACCO 1030 and ACCO 1031. MarqBot reads the actual prerequisite chains from Marquette's bulletin.

- **Standing**: Your class standing (freshman, sophomore, junior, senior) is based on total credits earned. Some courses require you to be at least a sophomore or junior. MarqBot calculates your standing from your completed credits:
  - 0–23 credits = Freshman
  - 24–59 credits = Sophomore
  - 60–89 credits = Junior
  - 90+ credits = Senior

- **Course level**: As an undergrad, you can only take courses numbered 1000–4999. Graduate-level courses (5000+) are filtered out entirely.

- **College and major restrictions**: Some courses are restricted to students in a specific college or major. When MarqBot can read the restriction clearly ("open to College of Business students only"), it enforces it. If the restriction language is ambiguous, MarqBot flags it for manual review instead of guessing.

- **Concurrent courses**: Some courses must be taken at the same time as another course. MarqBot handles these by making sure the companion course is either already done, in progress, or being recommended in the same semester.

If a course's prerequisite language is too complex for MarqBot to parse safely (like "instructor consent required" or complicated conditional logic), it doesn't guess. It marks the course as "manual review" so you know to check with your advisor.

### 4. MarqBot Ranks What's Left

After filtering, MarqBot ranks every eligible course by how important it is to your degree progress. The ranking has two layers:

First, it protects gateway work that can stall your degree if you miss it. Priority bridge courses and the most important BCC unlockers stay near the front no matter which style you pick.

Then it applies a base priority system:

**Tier 1 — MCC Foundation** is the common baseline.

**Tier 2 — Business Common Core** is the shared prereq layer for business majors.

**Tier 3 — Major requirements** are your declared program courses.

**Tier 4 — Track and minor** requirements come after the main major path.

**Tier 5 — MCC Late** (writing intensive and culminating experience) are upper-division core requirements that are intentionally deferred until you have enough credits and course maturity.

**Tier 6 — Discovery themes** are the exploratory MCC courses. They have the widest course pools, so there is usually something available later if MarqBot needs flexible cleanup.

Your scheduling style decides how aggressively MarqBot remaps those tiers:

- **Grinder** keeps declared major and track work ahead of flexible MCC and discovery cleanup. This is the "push the non-major stuff late" build.
- **Explorer** still protects critical gateways, but deliberately pulls discovery and gen-ed work forward.
- **Mixer** stays between the two, keeping a balanced term without going full grinder or full explorer.

Inside the **major tier**, MarqBot also follows a hard child-bucket order: **Required** buckets come before **Choose N**, which come before **Credits pool** buckets. So if Finance Core Requirements and Finance electives are both open, the core bucket wins even if an elective course would help more than one open bucket.

Within a band or tier, MarqBot further sorts by:
- Whether the course unlocks other courses you need (prereq chain depth — deeper chains get priority)
- Whether the course counts toward more than one bucket (multi-bucket courses are more efficient)
- Course level (lower-level courses first, since they tend to be earlier in the sequence)
- Course code (alphabetical, as a final tiebreak so the order is always the same)

### 5. MarqBot Fills Your Semester

Now MarqBot picks courses from the ranked list to fill your semester. It doesn't just grab the top N — it applies balance rules:

- **Bucket cap**: No more than 2 courses from the same requirement bucket in one semester (with a small exception for BCC, which can go up to 3).

- **Program balance**: If one program is dominating the picks, MarqBot defers some to keep your semester balanced across your requirements.

- **Freshman guard**: If you're a freshman, MarqBot holds off on recommending 3000-level major courses when there are still lower-level foundation courses to take. This keeps your first year focused on building the base.

- **Bridge courses**: Sometimes a course doesn't directly fill any of your remaining requirements, but it's a prerequisite for one that does. MarqBot recognizes these "bridge" courses and includes them when needed. It only does this for core and major requirements though — not for elective pools or discovery themes, which have plenty of direct options.

- **Credit load**: MarqBot watches the total credit count per semester. If a semester goes over 19 credits (the CoBA maximum), it warns you that you'd need a Credit Overload form. If it drops below 12, it warns that you'd be below full-time status.

### 6. You Get Your Plan

MarqBot returns your semester plan with:
- A ranked list of recommended courses for each term
- Your current progress across every requirement bucket (what's done and what still counts as open right now)
- Projected bucket changes in future semesters if you complete the recommendations
- A projection of your remaining semesters
- Any warnings (credit load, standing, restriction flags, manual review items)

The plan is deterministic: if you and a friend enter the exact same programs and completed courses, you get the exact same recommendations.

---

## Scheduling Styles

Not everyone wants to plan the same way. MarqBot offers three scheduling styles that change how it balances core requirements versus discovery electives:

**Grinder** (the default) — Front-loads your declared major and track path, keeps only truly important gateway BCC work near the front, and pushes flexible MCC/discovery cleanup to the tail. This is the closest thing to a no-summer grinder plan.

**Explorer** — Reserves 2 discovery slots per semester so you can explore topics outside your major early on. Your core prereqs still happen on time — MarqBot just makes room for breadth.

**Mixer** — Alternates between core and discovery picks to create balanced semesters. Each term gets at least 1 discovery course and 2 core courses.

You can switch styles anytime. It only changes the recommendation order — your transcript and current progress stay the same, while projected semester views are recalculated separately.

---

## What MarqBot Doesn't Recommend

Some courses are real but not suitable for automatic recommendations:
- **Internship courses** — placement-based, not schedulable
- **Independent study** — requires instructor arrangement
- **Topics courses** — content varies by semester and instructor
- **Work period courses** — co-op grading courses
- **Honors sections** — only shown if you're flagged as an honors student
- **Fractional-credit courses** — courses with non-standard credits like 1.5

These courses still count toward your progress if you've already completed them. MarqBot just won't recommend them because they require decisions it can't make for you.

---

## Summer Semesters

Summer terms are shorter, so MarqBot caps recommendations at 4 courses. It also filters out courses that historically aren't offered in summer (when term offering data is available).

---

## Academic Policies MarqBot Knows About

MarqBot is aware of Marquette's academic policies and enforces the ones it can read reliably:

- **Credit load limits** — warns if your semester plan exceeds the CoBA maximum (19 credits) or drops below full-time (12 credits). Summer has a separate 16-credit cap.
- **Business major limits** — CoBA students can declare up to 3 business majors. MarqBot blocks a 4th.
- **Business minor restriction** — CoBA students cannot declare a business minor. MarqBot warns if you try.
- **Standing requirements** — courses with standing gates are filtered or warned based on your credit count.
- **Double-count rules** — MarqBot respects Marquette's rules about which courses can count toward multiple requirements and which can't.
- **Major/minor overlap** — if your major and minor share too many courses, MarqBot flags the overlap.

Many other policies (graduation audits, GPA requirements, transfer credit rules, repeat policies) are documented in the system but require data MarqBot doesn't have access to — like grades, transfer transcripts, or advisor overrides. Those are flagged for reference but not enforced.

---

## How Requirements Are Organized

MarqBot organizes your degree requirements into a two-level structure:

**Parent buckets** are the big categories — your major, your minor, your track, MCC Foundation, Business Common Core, etc. Each parent bucket represents a program or universal requirement group.

**Child buckets** are the individual requirements inside each parent. For example, the Finance major parent bucket contains child buckets like "Finance Core Requirements" (3 specific courses you must take), "Finance Electives" (pick from a pool until you hit a credit target), etc.

Each child bucket has a mode:
- **Required** — you must take every course in the list
- **Choose N** — pick N courses from the list
- **Credits pool** — take courses from a broad pool until you hit a credit target (these are your elective buckets)

Progress is tracked at the child bucket level and rolls up to the parent. When all child buckets in a parent are satisfied, that program requirement is complete.

---

## What MarqBot Is Not

MarqBot is a planning tool. It is not:
- A replacement for CheckMarq or DegreeWorks
- An official university system
- Academic advising

Use it to plan faster, then confirm with your advisor before you register.
