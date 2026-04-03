# my to-do list

## high priority
- make `docs/memos/policies.md` genuinely easy to understand and navigate without removing any policy text.

### detailed plan for policies guide
goal: turn the current reordered policy memo into a navigation-first guide for both students and internal users while keeping full policy text and keeping college-specific duplicates separate.

1. define the main user journeys the guide should serve.
   examples: transferring in, registering for classes, figuring out probation/CAA status, appealing a grade, taking courses elsewhere, handling withdrawal/medical withdrawal, and graduating.
   output: a short list of task-based entry points that matches how real users search.

2. add a top-level quick navigation section.
   include a plain-English jump menu near the top of `docs/memos/policies.md`.
   examples: `I'm starting or returning`, `I'm choosing a program`, `I need registration help`, `I'm dealing with academic standing`, `I need a records or grading rule`, `I'm preparing to graduate`.
   each item should link directly to the most relevant section anchors.

3. add a second navigation layer for repeated college topics.
   for topics that appear across many colleges, add mini-indexes before the repeated policy blocks.
   priority topics: academic dismissal/probation/CAA, attendance, grade minimums, transfer rules, and degree/program progression.
   structure: university-wide policy first, then separate college links underneath.

4. add short plain-English summaries before each major policy section.
   keep these summaries very short and consistent.
   preferred template:
   `what this covers`
   `who this applies to`
   `go here if you need`
   these summaries should help a reader decide whether to keep reading the full section.

5. standardize section labeling so repeated content is easier to scan.
   keep the `University:` / college-prefixed headings already added.
   tighten any headings that are overly bulletin-like or inconsistent.
   ensure similar topics use similar visible naming across colleges when possible without changing policy meaning.

6. add related-policy cross-links at the end of major sections.
   examples:
   `Medical Withdrawal` should point to `Withdrawal`, `Attendance`, `Academic Censure`, and `Readmission`.
   `Transfer Course Credit` should point to `Study at Other Institutions`, `Transfer Students`, and any college-specific transfer approval sections.
   this should make the memo work more like a guide than a dump.

7. add lightweight orientation notes where policy text is dense.
   before especially long sections, add a one- or two-line note that explains what kind of rules follow.
   good candidates: `Academic Censure`, `Academic Misconduct`, `Advanced Standing Credit`, and `Degree Progression Requirements`.

8. preserve fidelity while improving readability.
   do not delete substantive policy text.
   do not merge college-specific rules into one generic summary.
   keep source URLs visible.
   if any text is obviously scrape-noisy or encoding-broken, clean only the formatting/encoding and not the policy substance.

9. run a navigation QA pass after rewriting.
   verify every jump link works.
   verify every lifecycle section has a clear intro.
   verify all repeated college topics are easy to find from the top.
   verify the guide still contains all 112 policy sections.

10. optional polish if the structure works well.
   add a short `common questions` section near the top.
   add a `start here by role` block for `student` vs `internal staff`.
   consider moving long reference-heavy sections into collapsible patterns later if the final publishing surface supports it.

- read entire changelog.md and compact the entire doc. within each version or each release, shrink changes to user-facing changes, product level changes. for system decisions/changes, rewrite in a compact style: [the goal] + [the problem] + [the decisions] + [the outcome]. I want to make each patch notes to have a user section and technical section. the user section is non technical language while the technical section (as detailed as possible although compacted language) will be used to be feed into future AI coding agents for context, so revisit git history and confirm and then plan this rewrite for the file. 
- plan out AI feature more carefully to cater to the school's picture. note: pareto analysis. let the AI do the automation work

## medium priority
- configure UI from iPhone perspective
- add a mascot? marqbot vibe

## user-feedbacks
- 

## side-notes
- insight from chat with mark: information fragmentation is the key problem
- is it possible to adopt ML into the project or is it even necessary to do so? - discuss 
