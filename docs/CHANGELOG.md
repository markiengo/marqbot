# CHANGELOG

All notable changes to MarqBot are documented here.

Format per release:
- `User`: student/advisor-facing changes in plain language.
- `Technical`: compact engineering context using Goal + Problem + Decisions + Outcome.

---

## [Unreleased]

### User

- Nothing queued yet.

### Technical

- No unreleased notes yet.

---

## [v2.8.0] - 2026-04-07

### User

- Planner and landing pages feel snappier — reduced animation overhead without removing any visual effects.
- Data Science is now a selectable non-business major, and business-only rules no longer spill onto that path.
- Edited semester reruns now recompute downstream terms, keep the yellow projected-progress bars honest, and preserve manual adds when they still fit.
- Equivalent or no-double-count aliases no longer show up together in the same semester just because they have different course codes.
- Business electives stop claiming courses that already have a more specific BCC or degree bucket in the active plan.
- Save Plan can now overwrite an existing saved snapshot instead of forcing endless duplicate versions.
- Saved-plan PDF exports now print as compact per-semester tables with course, title, credits, prerequisite text, and satisfy columns.

### Technical

- **Goal**: Reduce lag on the planner page and landing page, especially for lower-end hardware.
- **Problem**: Multiple always-running `requestAnimationFrame` loops, per-card Motion spring physics (60–72 concurrent springs for triple majors), permanent `willChange` compositor layer promotion, infinite looping `motion.div` animations, and per-row Motion stagger on CourseRow.
- **Decisions**:
  - ReactivePageShell + LandingHeroSimple: rAF loops now self-pause when pointer is idle (settle detection).
  - CourseRow: replaced `motion.div` per-row stagger with CSS `stagger-enter` class (already in globals.css).
  - RecommendationsPanel: replaced infinite `motion.div` floating glow with static `div` — identical visual.
  - BucketProgressGrid: capped Motion stagger at 8 items; items beyond render instantly.
  - CourseCard: changed `willChange: "transform"` to `"auto"` — browser manages layer promotion on demand.
  - Modal: removed permanent `willChange` on wrapper and backdrop; `transform-gpu` class handles it during animation.
- **Outcome**: Zero visual regressions. Eliminated continuous CPU churn when idle, reduced concurrent Motion springs, and cut compositor layer count.

- **Goal**: Add the first supported non-business major without hardcoding more one-off college logic.
- **Problem**: The selectable-program path still assumed every real major was business-scoped, which broke catalog restrictions and universal-bucket loading for a new Data Science major.
- **Decisions**: Add `DS_MAJOR` bucket data, carry `college_alias` through program loading/runtime selection, and scope business-only rules off that metadata instead of assuming all majors are CoBA.
- **Outcome**: Data Science now behaves like a real selectable major while business-core and business-policy logic stay attached only to business programs.
- **Goal**: Keep edited-semester reruns truthful after swap application.
- **Problem**: Re-running from an edited semester could rebuild the term without preserving its projected in-progress allocation, so semester bucket views lost the yellow progress segment after "Apply swaps."
- **Decisions**: Add a `selected_courses` request path to `/recommend`, rerun from the edited semester instead of locally splicing in a stripped term, rebuild projected bucket progress from the visible plan, and preserve manual-add pins after downstream reruns.
- **Outcome**: Edited semesters now keep the same in-progress semantics as a normal recommendation pass, including the yellow bucket-bar rendering and consistent downstream replanning.
- **Goal**: Make equivalent-course suppression generic and data-driven.
- **Problem**: Scoped `type=equivalent` aliases in `data/course_equivalencies.csv` could still leave the canonical course listed as remaining or recommend it again, because recommendation filtering and required-bucket remaining views were not reading the scoped equivalency layer.
- **Decisions**: Build a per-track runtime equivalent-course map from `course_equivalencies.csv`, use it to collapse required-bucket `remaining_courses`, suppress recommending a course when any equivalent alias is already completed or in progress, and treat equivalent / no-double-count pairs as same-semester conflicts in both backend selection and the edit modal.
- **Outcome**: Any future `type=equivalent` rows now automatically drive scalable, scope-aware deduplication without hardcoding major-specific exceptions.
- **Goal**: Stop business-elective pools from reusing courses that already have a more specific home in the active degree plan.
- **Problem**: Contextual business-elective pools could still count BCC-tagged or major-tagged courses as generic electives, which made progress and graduation status look too optimistic.
- **Decisions**: Filter the synthesized `biz_elective` pool by current plan context so any course with another active bucket in that student's degree path is excluded from business-elective counting.
- **Outcome**: Business electives now mean "other eligible business courses," not "anything tagged biz_elective even if it already fills Analytics, Ethics, Enhance, or another named bucket."
- **Goal**: Make grinder scheduling behave like a true major-first profile instead of an efficiency-first profile.
- **Problem**: Multi-bucket MCC/discovery courses could still rise ahead of declared-program work because grinder previously changed slot reservations more than ranking-band progression.
- **Decisions**: Add strict ranking-band progression for grinder in `backend/scheduling_styles.py`, remap grinder tiers to keep declared-program work above late cleanup, and run style-aware ranking keys before semester selection.
- **Outcome**: Grinder semesters now keep major and track sequences moving while flexible MCC/core cleanup gets pushed toward the end of the plan.
- **Goal**: Make saved-plan management less annoying and saved-plan exports easier to share.
- **Problem**: The save flow forced duplicate plans when users just wanted to replace an existing snapshot, and the print export lacked enough course context to work as a real handout.
- **Decisions**: Add explicit overwrite-existing mode in the save modal, keep create mode separate, and render print exports as compact semester tables with `Course | Title | Credits | Prereq | Satisfy` columns sourced from the saved snapshot.
- **Outcome**: Students can replace an old local plan on purpose and export a snapshot that is actually readable off-screen.

---

## [v2.7.0] - 2026-04-03

### User

- Updated Fall 2026 business catalog coverage, including the new Insurance concentration, the Applied AI in Business secondary major, and corrected prerequisite and MCC mapping rules.
- Fixed semester editing so swap suggestions stay attached to the semester you are actually editing, and restored delete from the normal saved-plan detail view.
- Reworked the landing and About pages around a stronger Marquette visual system, interactive product-story previews, and more consistent CTA behavior.
- Tightened the landing, onboarding, and planner chrome so more of the actual product fits on screen, and made the product story switch only on a 9-second timer or direct step clicks.
- Simplified reduced-effects behavior so full effects stay on by default unless reduced motion or a manual reduced-effects preference is active.
- Removed the nightly auto-tune pipeline and tightened local dependency-install guardrails.
- Deployment defaults now keep planner feedback on the Render disk, and the documented backend/frontend release checks are green again.

### Technical

- Goal: align planner data with Fall 2026 CoBA guidance. Problem: course renumberings, new programs, stale prereqs, and MCC mappings had drifted from advising updates. Decisions: add the new FINA and INSY catalog rows, introduce `INS_TRACK` and `AIBM_MAJOR`, deactivate `FINA 4020`, add equivalencies, and update BULA and MARK prerequisite and bucket rules. Outcome: the planner can model the new insurance and applied-AI paths with current catalog logic.
- Goal: make semester editing and saved-plan actions reliable. Problem: async swap pools could bleed across modal sessions, and delete had been buried inside metadata edit mode. Decisions: tie candidate pools to the active edit request, ignore stale responses, and move delete back to read mode. Outcome: users no longer see the wrong swap options, and plan deletion is reachable from the normal detail view.
- Goal: make the public pages look intentional without detaching them from the actual planner. Problem: the landing and About surfaces had drifted into a mix of old and new layouts, while the product-story section was too wordy and visually inconsistent. Decisions: restore the older hero/final-CTA hierarchy, keep the newer interactive story section, add real planner-style previews, unify CTA styling, and bring About closer to the landing shell. Outcome: the public pages now present one coherent Marquette-branded visual system and a clearer product narrative.
- Goal: keep the richer frontend predictable while reclaiming more usable space in the planner and onboarding surfaces. Problem: the public pages and planner chrome had grown dense enough that key content and controls were competing for vertical space, and the product-story rail was switching both on scroll and on a timer. Decisions: compact the shared navbar, compress planner and onboarding headers, move Step 3 onboarding toggles into the available side space, enlarge the product-story step rail text, and keep story switching on a 9-second timer plus manual clicks only. Outcome: more of the actual planner and story content fits on one screen without removing the current interaction model.
- Goal: keep effects behavior understandable instead of heuristic-heavy. Problem: the reduced-effects manager had drifted into save-data, hardware-hint, and frame-probe heuristics that made motion behavior harder to predict while the UI was still changing rapidly. Decisions: keep `EffectsModeManager`, but resolve reduced-effects mode only from OS reduced-motion or a manual reduced-effects preference, and leave full effects on by default otherwise. Outcome: cursor-reactive landing/About treatments and planner tilt effects stay available by default, while reduced-effects mode still changes presentation only.
- Goal: reduce maintenance risk from autonomous tuning and dependency scripts. Problem: the nightly autotune path had become stale and noisy, and package install commands could still execute risky defaults. Decisions: remove the nightly autotune jobs and files, keep manual ranking overrides, and enforce exact-pinned `npm --ignore-scripts` guardrails in the Claude hook handler. Outcome: less unattended churn and tighter local supply-chain controls.
- Goal: make the current deployment contract truthful and repeatable. Problem: the default test gates had drifted red, feedback persistence was only documented instead of provisioned, and health checks reported success even when the frontend build was missing. Decisions: repair backend collection and frontend release checks, make `/health` and `/api/health` readiness endpoints, mount a Render disk in `render.yaml`, and wire `FEEDBACK_PATH` to `/var/data/marqbot/feedback.jsonl`. Outcome: the checked-in Render blueprint now matches the intended production shape and the local release gate passes end-to-end.

---

## [v2.6.0] - 2026-03-29

### User

- Finished the landing-page redesign with a cleaner hero, a scroll cue, and a balanced four-card benefits layout.
- Kept reduced-effects behavior intact while simplifying the implementation behind it.
- Reorganized the technical docs so repo context is easier to navigate.

### Technical

- Goal: finish the landing refresh without changing the core message. Problem: hero alignment and the old three-card spotlight layout felt unbalanced and hid content below the fold. Decisions: center the headline, add a viewport-bottom anchor cue, and replace the asymmetric benefits layout with a 2x2 grid plus a dedicated "Plan ahead" benefit. Outcome: the first screen is easier to scan and does a better job selling multi-semester planning.
- Goal: simplify reduced-effects plumbing and repo orientation. Problem: `EffectsContext` duplicated state already available in the DOM and localStorage, and the technical reference naming no longer matched repo usage. Decisions: replace the context read path with `useReducedEffects`, rename the technical reference to `docs/tech_readme.md`, and add `.planning` and codebase-map links. Outcome: less frontend indirection and easier repo onboarding.

---

## [v2.5.4] - 2026-03-28

### User

- Added policy-aware warnings for business-major limits, business-minor guidance, and semester credit-load issues.
- Split documentation by audience so students and advisors get a plain-English planning guide while engineers get a separate technical reference.

### Technical

- Goal: move policy support from ad hoc checks to a traceable registry. Problem: policy enforcement and documentation were scattered and hard to audit. Decisions: add `data/policies.csv` plus `data/policies_buckets.csv`, enforce COBA_05 and COBA_06 in `server.py`, and emit per-semester `semester_warnings` from `semester_recommender.py`. Outcome: policy coverage is data-backed, testable, and visible in recommendation responses.
- Goal: separate docs by audience. Problem: a single algorithm doc was trying to serve non-technical readers and engineers at once. Decisions: rewrite `docs/algorithm.md` for students and advisors, create `docs/tech_readme.md` for engineering context, and link both from `README.md`. Outcome: user docs get simpler without losing system detail.

---

## [v2.5.3] - 2026-03-27

### User

- Major search now understands program codes such as `OSCM`.
- MarqBot can automatically reduce visual effects on weaker browsers, with a manual override if you want fuller motion.
- Screenshot import review is simpler, the primary save action is clearer, and recommendation and progress logic handles required work more accurately.

### Technical

- Goal: keep the frontend usable on average laptops. Problem: blur, glow, and motion-heavy rendering paths were too expensive on lower-capability browsers. Decisions: add auto-detected reduced-effects mode plus a manual override, flatten heavy surfaces in reduced mode, and remove user-facing OCR confidence badges while keeping internal triage. Outcome: the same planner flow runs on a lighter render path with less visual noise.
- Goal: make requirement allocation more faithful to curriculum intent. Problem: broad elective pools could steal credit from narrower required buckets, and extra same-slot completions could disappear. Decisions: prioritize `required` and `choose_n` over `credits_pool`, allow overflow spill into eligible elective pools after narrow requirements are filled, and centralize bucket-family helpers in `requirements.py`. Outcome: progress and recommendations better reflect the intended degree rules.
- Goal: keep docs and tests aligned with the shipped frontend. Problem: fixture placement, about-page layout, and DOM test wiring had drifted. Decisions: move advisor-gold fixtures under `tests/backend/fixtures`, fix missing effects providers and payload expectations, and refresh `README.md`. Outcome: documentation and regression coverage match the current UI.

---

## [v2.5.2] - 2026-03-27

### User

- Planner performance improved, especially around modal opens, long sessions, and repeated recommendation work.
- Screenshot import parsing now loads only when you actually use it.

### Technical

- Goal: remove browser-side lag without changing planning behavior. Problem: session persistence, broad context subscriptions, modal setup, and always-on effects were doing too much work on every interaction. Decisions: split hot vs heavy session storage, narrow context slices, defer modal focus and blur work, memoize course-detail lookups, and reduce default paint and compositing cost. Outcome: faster planner interactions with unchanged recommendation logic.
- Goal: stop long sessions from growing memory and startup work unnecessarily. Problem: OCR parsing code loaded too early and backend caches could expand during exploratory use. Decisions: lazy-load screenshot parsing on demand and add bounded cache-size env controls in `backend/server.py`. Outcome: lower client startup cost and safer backend memory behavior.

---

## [v2.5.1] - 2026-03-24

### User

- Landing and About pages were tightened up with cleaner copy, simpler layouts, and a single timeline view.
- The nightly auto-tune job was paused while the product was changing quickly.

### Technical

- Goal: reduce content sprawl in the marketing and About surfaces. Problem: separate roadmap and recent-change structures created redundant rendering paths and weaker scanning. Decisions: consolidate into one `ABOUT_TIMELINE`, trim CTA and placeholder copy, and add a shared scrollbar utility. Outcome: fewer content branches and a cleaner public narrative.
- Goal: stop noisy unattended tuning during heavy iteration. Problem: nightly auto-tune branches were going stale before review. Decisions: disable the cron and auto-PR path but keep manual `workflow_dispatch`. Outcome: fewer stale maintenance branches while preserving on-demand sweeps.

---

## [v2.5.0] - 2026-03-18

### User

- Added Major Guide so students can see their full bucket structure before planning and reopen it from the planner header.
- Onboarding now includes a "Your Buckets" step, and the scheduling-style picker was redesigned to be easier to choose from.

### Technical

- Goal: teach students how MarqBot thinks about degree requirements before showing a plan. Problem: buckets and double-counting rules were opaque, so recommendation output lacked context. Decisions: add grouped-column Major Guide UI, expose `GET /api/program-buckets`, wire the planner header to reopen the guide, and add onboarding step 4 plus updated explainer copy. Outcome: requirement structure is visible and reusable without invoking the recommender.
- Goal: make preference selection clearer. Problem: the scheduling-style control and onboarding step indicator were too table-like and low-signal. Decisions: redesign them as card-based selectors with a four-step indicator. Outcome: setup choices read faster and feel more intentional.

---

## [v2.4.7] - 2026-03-18

### User

- Screenshot import got a visual walkthrough, clearer progress feedback, larger text, and easier-to-scan match review.
- Students can now toggle assumed courses on and off when reviewing credits completed.

### Technical

- Goal: make screenshot import understandable at first use. Problem: inline walkthrough copy and small text asked users to imagine the process instead of seeing it. Decisions: replace inline explanation with a modal tutorial, add staged progress UI, switch matched courses to a two-column grid, and enlarge key modal text. Outcome: the import flow is easier to follow and review.
- Goal: expose inferred-course behavior without changing allocation logic. Problem: users could not distinguish what they entered from what prerequisite chains implied. Decisions: add an assumptions toggle in the credits-completed modal and keep palette and copy aligned with MarqBot tokens. Outcome: review surfaces explain planner assumptions without changing the underlying data model.

---

## [v2.4.6] - 2026-03-17

### User

- The planner stopped missing the MCC culminating course late in the degree, and nightly planning audits became easier to read.
- Internal auto-tune analysis got better at spotting impossible program combinations and concentrated failure points.

### Technical

- Goal: reduce false "not graduated" outcomes in nightly sweeps. Problem: `MCC_CULM` sat too low in the tier order and could be starved by broader discovery buckets. Decisions: move it from tier 6 to tier 5 and update the nightly logic around it. Outcome: CORE 4929 schedules before discovery filler and most late-stage nightly failures disappear.
- Goal: make nightly output actionable instead of overwhelming. Problem: hundreds of raw student logs and shallow analyzer output made triage slow. Decisions: condense reports to representative cases, add feasibility, concentration, and ledger analysis to `scripts/analyze_nightly.py`, and upgrade artifact actions. Outcome: nightly review focuses on patterns rather than raw volume.

---

## [v2.4.5] - 2026-03-17

### User

- Course-history screenshot import moved fully into the browser, so transcript screenshots no longer need a backend AI call.
- Import status text now matches local OCR processing steps.

### Technical

- Goal: remove the server dependency from screenshot import. Problem: backend GPT-based OCR added cost, latency, and an API-key requirement for a feature that could run locally. Decisions: replace the backend route with browser-only `tesseract.js`, add reusable worker and preprocessing logic, and add parser fixtures and tests. Outcome: import runs on-device with deterministic coverage and no server OCR dependency.
- Goal: align UI states with the new local pipeline. Problem: old upload-oriented status labels assumed a backend round trip. Decisions: rename states around preprocessing and parsing and remove backend import code paths. Outcome: status copy now matches the actual import lifecycle.

---

## [v2.4.4] - 2026-03-16

### User

- Frontend copy got a full brand-language rewrite, and the app added richer animation and motion polish with reduced-motion support.
- Nightly planning started producing machine-readable reports and auto-tune follow-up configs.

### Technical

- Goal: align product voice and motion with the branding guide. Problem: the app sounded inconsistent and had little shared animation vocabulary. Decisions: rewrite copy across major surfaces, add reusable motion utilities and hooks, and respect `prefers-reduced-motion`. Outcome: the UI has a more distinct voice and a more coherent interaction language.
- Goal: make nightly tuning reviewable and deterministic. Problem: nightly investigation data lived mostly in prose and follow-up changes were manual. Decisions: emit JSON alongside Markdown, add analyzer and config files, and open config-only PRs from nightly sweeps. Outcome: nightly output becomes structured and semi-automated without allowing direct code mutation.

---

## [v2.4.3] - 2026-03-12

### User

- CI and nightly checks were separated more cleanly, About page copy was refreshed, and the frontend got another round of visual polish.
- Recommendation sorting now honors several ranking signals that had been computed but accidentally ignored.

### Technical

- Goal: keep PR checks focused on stable product guarantees. Problem: catalog-drift audits and nightly-only checks were too intertwined with normal CI. Decisions: move data-drift expectations into the nightly report, upgrade GitHub actions, and document the stable-vs-nightly split. Outcome: PR gates protect product behavior while nightly artifacts track catalog issues.
- Goal: make ranking and runtime housekeeping accurate. Problem: key ranking penalties were dead code and rate-limit keys could accumulate. Decisions: wire the missing sort terms into the live ranking, evict expired limiter entries, mark zero-threshold buckets satisfied, and archive dead frontend files and scripts. Outcome: recommendation ordering and operational cleanup match intended behavior.

---

## [v2.4.2] - 2026-03-12

### User

- The landing-page hero was tightened up so the value proposition, preview, and CTA read faster.

### Technical

- Goal: improve first-screen clarity. Problem: the hero carried too much visual and copy weight before showing the product payoff. Decisions: shorten the headline and copy, rebalance the preview, and strengthen navbar CTA treatment. Outcome: the landing page communicates outcome first and detail second.

---

## [v2.4.1] - 2026-03-12

### User

- Fixed bucket mappings, graduation checks, and prerequisite blocker logic so plans stop failing on phantom mappings and late-stage off-by-one errors.

### Technical

- Goal: restore correctness in bucket materialization and graduation projection. Problem: equivalency expansion was creating phantom bucket memberships, some prerequisite courses were missing from required buckets, and final-semester graduation checks ran one step early. Decisions: make `master_bucket_courses.csv` the sole bucket-mapping authority, add missing prerequisite mappings, remove the bad REAL equivalency, and evaluate completion after the final semester is applied. Outcome: fewer false blockers and more accurate graduation detection.

---

## [v2.4.0] - 2026-03-10

### User

- Added student-stage selection (undergraduate, graduate, doctoral), and recommendations now respect course-level stage boundaries.
- Planner warning and ordering behavior were simplified so foundational work appears in a more predictable order.

### Technical

- Goal: stop the planner from recommending the wrong course level. Problem: students with mixed histories needed a hard gate for future recommendations without invalidating completed work. Decisions: add `student_stage` across onboarding, profile flows, and tests, infer a default when missing, keep full-catalog history entry, and enforce level bands server-side. Outcome: future recommendations stay in the chosen stage while past transcript data remains recordable.
- Goal: reduce ranking complexity and standing-related deadlocks. Problem: the old diversity balancing and noisy standing metadata could bury obvious foundational courses. Decisions: replace family-cap balancing with one fixed global order, pull bridge math forward when it unlocks core progress, and remove obsolete UI chips. Outcome: recommendation order is simpler to reason about and less likely to stall.

---

## [v2.3.2] - 2026-03-09

### User

- Progress cards can now open detailed bucket drill-ins, modal scanning improved, and the app's voice and copy were tightened across major surfaces.
- Nightly testing shifted toward more realistic sampled student histories.

### Technical

- Goal: make progress views explain themselves. Problem: incomplete buckets were hard to diagnose from summary cards alone. Decisions: add planner bucket drill-ins, refine modals, and tighten planner-facing copy and quips around a clearer-first voice guide. Outcome: users can inspect why a requirement is incomplete without reading raw bucket data.
- Goal: make nightly confidence reflect real students. Problem: brute-force random sweeps produced noisy coverage and awkward local feedback storage. Decisions: focus the nightly harness on seeded histories, rename the Actions job, and move local feedback logs into ignored `docs/feedbacks/`. Outcome: better signal from nightly runs and safer local feedback handling.

---

## [v2.3.1] - 2026-03-07

### User

- Course equivalencies became easier to maintain, honors students stop seeing duplicate base and honors recommendations, and standing warnings are hidden when the student already qualifies.
- Semester-offering filtering was temporarily turned off so good courses are not wrongly excluded.

### Technical

- Goal: make equivalency data readable without changing runtime semantics. Problem: long-format equivalency rows were hard to edit and downstream logic could recommend both honors and base versions. Decisions: move to a wide-format CSV with loader unpivoting, expand selected-course equivalency blocking, and deduplicate honors variants at eligibility time. Outcome: cleaner data maintenance and better recommendation deduplication.
- Goal: reduce false negatives from standing and offering data. Problem: already-qualified students still saw standing warnings, and incomplete offering data was causing dead ends. Decisions: dynamically suppress standing tags when already satisfied and disable offer-term filtering while keeping the data path in place. Outcome: warnings match reality and recommendations stay available while offering data matures.
- Goal: keep nightly tests representative. Problem: pairwise combos and manual curation missed realistic declaration patterns. Decisions: redesign nightly sweeps around randomized triple-combo profiles and add failure aggregation. Outcome: broader but still reproducible coverage.

---

## [v2.3.0] - 2026-03-07

### User

- Fixed dead-end recommendation gaps caused by bad prerequisite tagging, especially in AIM, Marketing, and Entrepreneurship paths.

### Technical

- Goal: stop valid courses from being hidden by bad prerequisite metadata. Problem: parseable prerequisites had been mislabeled as `complex_hard_prereq`, making the engine treat recommendable courses as unavailable. Decisions: correct the affected course rows and reserve the complex tag for genuinely unparseable cases. Outcome: dead-end planner failures drop and recommendation eligibility matches real prerequisites.

---

## [v2.2.5] - 2026-03-06

### User

- Discovery themes, ESSV2, and WRIT moved into live planning, course details became clickable, and recommendations now include descriptions.
- Discovery theme selection works in onboarding and planner flows.

### Technical

- Goal: graduate hidden MCC requirement data into live planning. Problem: Discovery, ESSV2, and WRIT existed in the model but were partially inactive and inconsistently surfaced. Decisions: activate the relevant programs and tracks, auto-include discovery theme IDs in request handling, preserve `choose_n` discovery mappings, and remove "coming soon" caveats. Outcome: the planner can recommend and display those MCC areas directly.
- Goal: make course detail and filtering safer. Problem: recommendation output lacked descriptions and non-integer-credit courses created ambiguity. Decisions: expose descriptions on `/api/courses`, add clickable detail modals, and filter non-integer-credit offerings from deterministic recommendations. Outcome: richer detail views with more stable scheduling output.

---

## [v2.2.4] - 2026-03-06

### User

- Catalog coverage expanded from a small curated set to a much larger scraped Marquette course dataset.

### Technical

- Goal: massively expand course coverage without breaking existing loaders. Problem: the hand-maintained catalog was too small, but fully replacing it risked overwriting curated fields. Decisions: add scrape and merge scripts, keep CSV schema compatibility, append new rows conservatively, and preserve existing curated data when non-empty. Outcome: thousands of catalog rows become available with controlled merge behavior.

---

## [v2.2.3] - 2026-03-06

### User

- Recommendation ranking became simpler and more consistent.

### Technical

- Goal: reduce heuristic sprawl in course ranking. Problem: the sort key had too many branches, some tied to stale BCC-decay and freshman-balance logic. Decisions: cut the ranking key from 10 positions to 7, remove dead branches, keep bridge and blocker safeguards, and fix debug-trace and credit parsing behavior. Outcome: ranking is easier to explain and debug while preserving deterministic behavior.

---

## [v2.2.2] - 2026-03-05

### User

- No major visible product changes. This release focused on making planning results safer to ship with broader regression coverage.

### Technical

- Goal: make quality gates explicit before further feature growth. Problem: correctness expectations were spread across ad hoc tests and not framed as release-blocking coverage. Decisions: define targeted suites for data integrity, fast dead-end planning, recommendation quality, API contracts, prerequisite validation, and advisor-gold regression. Outcome: releases now have named guardrails around the highest-risk planner behaviors.

---

## [v2.2.1] - 2026-03-04

### User

- Saved Plans went live, and saved-plan pages now make plan comparisons easier.
- Progress displays became more consistent between live planning and saved plans.

### Technical

- Goal: let students keep and revisit recommendation snapshots. Problem: rerunning onboarding for every comparison was slow, and progress rendering differed across surfaces. Decisions: ship saved-plan views, reuse shared progress components, surface assumption notes in progress modals, and move program-selection defaults and gates into data. Outcome: saved plans behave like first-class planner states with less hardcoded selection logic.

---

## [v2.2.0] - 2026-03-03

### User

- The planner no longer dead-ends when class standing is the last blocker, startup failures show retryable errors, stale can-take answers are cleared, and failed refreshes keep the last plan visible.
- Nightly dead-end sweeps started running automatically, and product quips were rewritten in a more student-life voice.

### Technical

- Goal: make the app resilient to common failure states. Problem: standing-gated degrees could return empty semesters, bootstrap fetch failures trapped the UI on spinners, and stale can-take or recommendation states lingered after errors. Decisions: add a late-stage rescue pass, explicit loading, error, and retry flows, stale-answer clearing, and last-good-plan preservation. Outcome: fewer broken states without changing core API shapes.
- Goal: operationalize regression detection and refresh product tone. Problem: dead-end sweeps were manual and quips felt off-brand. Decisions: add the nightly workflow with DST-safe time handling and rewrite quips around Marquette and student-life language. Outcome: automation catches planning regressions while the product voice becomes more consistent.

---

## [v2.1.1] - 2026-03-02

### User

- Added full-path dead-end prevention tests, made OSCM 4997 recommendable, expanded International Business study-abroad options, and taught the planner to keep recommending useful credit-builders instead of returning empty semesters.

### Technical

- Goal: reduce empty-semester outcomes in real degree paths. Problem: complex prerequisites, thin study-abroad mapping, and strict bucket caps could still strand students with unmet requirements. Decisions: extend the prereq parser for mixed AND/OR patterns, broaden International Business abroad mappings, add a last-resort rescue pass, and create broad dead-end tests. Outcome: more late-stage plans keep moving toward graduation instead of stalling.

---

## [v2.1.0] - 2026-03-01

### User

- Added contextual one-liners in progress and semester modals, a new About page, and corrected landing-page stats.

### Technical

- Goal: add personality without randomness or API dependence. Problem: static modal copy felt flat and the product lacked a dedicated story page. Decisions: compile `data/quips.csv` into deterministic TypeScript using hashed student context and build a scrapbook-style About page. Outcome: modals feel more contextual, and the product has a clearer builder narrative.

---

## [v2.0.3] - 2026-03-01

### User

- Business Economics elective counting was fixed, non-recommendable courses stopped appearing in plans, and BUAN Advanced rules were corrected.

### Technical

- Goal: tighten bucket mapping and recommendation hygiene. Problem: BECO electives were misallocated, BUAN Advanced was overstated, and internships or topics-like courses polluted recommendations. Decisions: change the BECO bucket to `choose_n`, filter non-recommendable course patterns at selection time, correct BUAN bucket requirements, and extend smoke coverage for under-tested majors and tracks. Outcome: recommendation output better matches curriculum rules and avoids low-value suggestions.

---

## [v2.0.2] - 2026-03-01

### User

- Applied a broader Marquette visual language across landing, onboarding, and planner surfaces.
- Progress and semester views now group major requirements by program, which makes multi-major plans easier to read.

### Technical

- Goal: align the new UI with brand and multi-major readability. Problem: the initial Next.js planner needed stronger shared visual primitives and major-level grouping inside tier sections. Decisions: add shared design components, use responsive heading clamps, subgroup progress by program order, and restyle CTA, modal, and KPI surfaces. Outcome: the UI feels more intentional, and complex plans are easier to scan.

---

## [v2.0.1] - 2026-03-01

### User

- Removed phantom prerequisite recommendations, rewrote the ranking explainer in plainer language, and cleaned up incorrect course data.

### Technical

- Goal: stop unrelated OR prerequisites from spawning bad suggestions. Problem: the engine treated every OR branch as an unlock target, and universal buckets were leaking into prerequisite-blocker scoring. Decisions: strip noisy OR alternatives from prerequisite data, fix core-blocker lookup to use parent types, keep only genuinely complex prerequisite tags, and correct data plus advisor-gold expectations. Outcome: fewer phantom recommendations and clearer ranking explanations.

---

## [v2.0.0] - 2026-02-28

### User

- Recommendations got smarter about long prerequisite chains, multi-bucket efficiency, and dual-major balance.
- The planner can now show a graduation message when requirements are projected complete instead of returning a blank late semester.

### Technical

- Goal: make ranking reward true degree leverage. Problem: standalone electives could outrank long unlock chains, and dual-major plans could starve one program. Decisions: add chain-depth and multi-bucket scoring, defer overrepresented programs, and clean up stale `hard_prereq_complex` tags and standing gates. Outcome: recommendations better prioritize degree-progress leverage across single- and dual-major plans.
- Goal: make late-stage projection trustworthy. Problem: mixed-unit buckets could show false incompletion, and empty final semesters looked like failures instead of graduation. Decisions: switch satisfaction to course-count-or-credit-threshold logic and add explicit graduation indicators with temporary MCC caveats. Outcome: progress display and end-of-plan messaging better reflect actual completion state.

---

## [v1.9.8] - 2026-02-28

### User

- Progress views were reorganized by program, summer planning gained better UX, max semesters increased to eight, and AIM now warns when it is selected without a primary major.
- Discovery theme and minors were shown as not-yet-ready instead of acting like live inputs.

### Technical

- Goal: make plan structure and long-horizon planning clearer. Problem: flat bucket lists, limited semester counts, and hidden summer constraints made larger plans hard to interpret. Decisions: group progress by parent, move the summer toggle into preferences, raise the semester cap to 8, and add summer-specific messaging. Outcome: long plans are easier to configure and understand.
- Goal: enforce data readiness and program constraints earlier. Problem: WRIT mappings were not ready for live use, and AIM's primary-major rule was only a backend concern. Decisions: deactivate `MCC_WRIT`, mark Discovery and minors as coming soon, and surface AIM primary-major warnings in the frontend while keeping backend hard gates. Outcome: users get earlier feedback and fewer misleading selections.

---

## [v1.9.7] - 2026-02-28

### User

- ESSV2, WRIT, and Culminating Experience course data started showing up in recommendations.
- Summer semesters and running class standing became first-class planning features.

### Technical

- Goal: expand live planning beyond the initial core buckets. Problem: MCC late-stage buckets had no usable mappings, summer planning was absent, and standing progression was static. Decisions: populate ESSV2, WRIT, and CULM mappings, add an `Include Summer Semesters` toggle with a 4-course cap, project standing across semesters, and expose a recommendation explainer. Outcome: late-MCC coverage, summer planning, and standing-aware eligibility become visible product features.

---

## [v1.9.6] - 2026-02-27

### User

- The planner switched permanently to CSV-based catalog data, added more majors, minors, and tracks, cleaned up program labels, and redesigned program selection in onboarding.

### Technical

- Goal: move the data model off the old workbook file. Problem: Excel-era label overrides and loading paths were brittle and hard to extend. Decisions: make `data/` CSVs the default source, delete the workbook from normal runtime, use `parent_bucket_label` as the label authority, and update validation scripts. Outcome: data edits become file-based and less coupled to frontend overrides.
- Goal: expand catalog and program coverage using the new structure. Problem: business catalog data and several programs and tracks were missing or inconsistent. Decisions: inject new catalog rows, add new majors, minors, and tracks, fix prerequisite errors, and redesign `MajorStep` around majors, minors, tracks, and discovery. Outcome: broader program coverage with cleaner selection UX.

---

## [v1.9.3] - 2026-02-27

### User

- Planner layout shifted to a two-column, results-first design, profile and preferences were merged into one modal, and can-take moved closer to recommendations.

### Technical

- Goal: give recommendations more space and reduce setup friction. Problem: the old sidebar layout hid results behind configuration and spread related controls across multiple surfaces. Decisions: adopt a 45/55 layout, merge profile and preferences into one modal with in-modal submit, and simplify warning and progress color treatment. Outcome: the main viewport stays focused on results while settings remain accessible.

---

## [v1.9.2] - 2026-02-25

### User

- Startup reliability and deployment flow improved, and local development got a single command that builds the frontend automatically when needed.

### Technical

- Goal: make the app easier to run and ship. Problem: startup packaging, build orchestration, and script sprawl made local and deployed behavior brittle. Decisions: ensure frontend export serving works consistently on Render, add `python scripts/run_local.py`, archive one-off scripts, and centralize canonical docs under `mds/`. Outcome: more reliable local startup and cleaner maintenance structure.

---

## [v1.9.1] - 2026-02-25

### User

- MarqBot moved onto a new Next.js frontend with a full landing page, onboarding flow, planner, saved plans, and placeholder product pages.
- The planner UI was rebuilt around a 2x2 desktop layout, and early crash cases in course and program loading were fixed.
- This release also included cleanup of dead code and unused dependencies.

### Technical

- Goal: replace the old SPA shell with a more scalable frontend architecture. Problem: the earlier client had brittle routing and state patterns and weak landing-page and SEO support. Decisions: introduce a separate Next.js, TypeScript, and Tailwind app, add App Router pages for landing, onboarding, planner, saved, and placeholder surfaces, and adopt React context plus reducer session state. Outcome: MarqBot gets a full new frontend foundation that later evolves into the current `frontend/` app.
- Goal: make the new planner usable at launch. Problem: API shape mismatches, track and major ID mapping issues, stale request races, and missing major selection created crashes or broken empty states. Decisions: unwrap Flask course payloads, normalize program IDs, accept string and array course lists server-side, harden routes and error handling, add stale-request cancellation, and ship the 2x2 planner plus immersive placeholder pages. Outcome: the new frontend can load and submit plans reliably on the existing backend.
- Goal: stabilize the release after the migration. Problem: the new codebase carried dead assets, dead components, and unused dependencies. Decisions: prune unreferenced assets, remove dead code such as `KpiCards`, and clean dependency drift. Outcome: the migration ships with less leftover scaffolding.

---

## [v1.9.0] - 2026-02-24

### User

- Added optional BCC decay so late-stage business-core work can fall behind major and track priorities once enough core progress is complete.
- Added health, security, and rate-limit hardening, recommendation feedback capture, and advisor-baseline regression evaluation.

### Technical

- Goal: let major-specific work surface once BCC saturation is high. Problem: strict four-tier ordering could keep late-stage BCC work ahead of more valuable major and track courses. Decisions: introduce env-gated five-tier BCC decay based on completed BCC courses and add regression plus advisor-match tests around it. Outcome: BCC prioritization becomes tunable without changing default behavior.
- Goal: harden operations and collect recommendation-quality signals. Problem: the service lacked basic health, security, and rate-limit plumbing, and there was no structured feedback or eval path. Decisions: add `GET /health`, response security headers, manual token-bucket limiting, JSONL feedback capture, advisor-gold evaluation, and extra regression profiles. Outcome: the backend becomes safer to operate and easier to benchmark.

---

## [v1.8.3] - 2026-02-24

### User

- Progress KPIs switched to credit-based metrics, standing labels were added, and low-value dashboard clutter was removed.

### Technical

- Goal: make progress read like a real degree audit. Problem: bucket-slot counts were less intuitive than credits, and some surfaces added noise without helping decisions. Decisions: move KPIs and the progress ring to credit framing, add credit-based standing bands, remove low-value sections, and make same-family assignment and tier handling deterministic. Outcome: progress displays are simpler for users and more stable for the allocator.

---

## [v1.8.2] - 2026-02-24

### User

- Recommendation packing now follows the same double-count and credit-pool rules used by progress allocation.

### Technical

- Goal: align selection with allocation semantics. Problem: recommender packing and progress allocation could disagree, which undermined trust. Decisions: apply same-family non-elective-first routing, pairwise double-count checks, and credit-based consumption in the selection path. Outcome: recommended courses follow the same rules that completed-course allocation uses.

---

## [v1.8.1] - 2026-02-24

### User

- No major visible product changes. This release focused on clarifying recommender hierarchy and cross-major sharing behavior in docs and labels.

### Technical

- Goal: make planner policy easier to understand and audit. Problem: cross-major sharing and bucket tags were correct in code but underdocumented or inconsistently labeled. Decisions: refresh hierarchy docs, clarify sharing behavior, and normalize bucket-tag capitalization. Outcome: policy explanations better match runtime behavior.

---

## [v1.8.0] - 2026-02-24

### User

- Fixed credit-pool progress math and consolidated architecture rationale into a single canonical doc.

### Technical

- Goal: preserve workbook semantics through runtime projection. Problem: credit-based buckets could show broken progress such as `0/0`, and decision rationale was split across docs. Decisions: fix `needed_credits` and `requirement_mode` projection handling and consolidate decision documentation. Outcome: progress display and architecture references become more reliable.

---

## [v1.7.11] - 2026-02-24

### User

- Tier hierarchy, elective-pool handling, and diversity balancing were made more predictable.

### Technical

- Goal: make bucket priority and elective synthesis deterministic. Problem: same-family electives could compete with narrower requirements, and the old diversity cap was too rigid. Decisions: lock the four-tier hierarchy, synthesize elective pools from `elective_pool_tag`, prefer non-elective siblings first, and switch to soft-cap auto-relax behavior. Outcome: recommendation ordering becomes easier to reason about.

---

## [v1.7.10] - 2026-02-24

### User

- The data model moved to the canonical parent and child bucket workbook layout, and double-count rules became track-family aware.

### Technical

- Goal: give the workbook a scalable structure for majors, tracks, and minors. Problem: the earlier schema and double-count governance were too implicit for continued expansion. Decisions: adopt `parent_buckets`, `child_buckets`, and `master_bucket_courses`, preserve one release of compatibility, and add track-family-aware governance. Outcome: the runtime can evolve without hardcoding every special case.

---

## [v1.7.9] - 2026-02-23

### User

- Recommendation selection became bucket-aware, and MCC and BCC priority treatment was made consistent.

### Technical

- Goal: stop the recommender from collapsing onto one unmet area. Problem: greedy selection could overfill one bucket while ignoring other active needs. Decisions: implement bucket-aware greedy selection, align MCC and BCC tier treatment, and fix MCC labeling. Outcome: recommendations spread more fairly across unmet requirements.

---

## [v1.6.x to v1.7.8] - 2026-02-22 to 2026-02-23

### User

- This period established the V2 planner runtime, expanded workbook integration, rolled out the early multi-panel planner UI, and fixed already-satisfied bucket leakage.

### Technical

- Goal: transition from early prototype logic to a deterministic V2 planner. Problem: runtime, data-model contracts, and UI architecture were still shifting quickly. Decisions: harden governance, add MCC overlay support, expand workbook integrations, introduce scalable semester controls and recommendation caps, and close leaks from already-satisfied buckets. Outcome: the app reaches a usable V2 baseline for later release-line iteration.

---

## [v1.0.0 to v1.5.0] - 2026-02-20 to 2026-02-21

### User

- The first release window established the deterministic planner baseline, core allocation rules, and the initial frontend and backend workflow.

### Technical

- Goal: turn the project into a usable planning product. Problem: early planner logic and repo structure still needed stable, data-driven contracts. Decisions: establish policy-driven allocation, modular backend and frontend boundaries, and contract-safe iterative refactors instead of big-bang rewrites. Outcome: later releases build on a stable deterministic foundation.
