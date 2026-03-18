# CHANGELOG

All notable changes to MarqBot are documented here.

Format per release:
- `Changes`: what shipped.
- `Design Decisions`: why those changes were made.

---

## [v2.4.6] - 2026-03-17

### Changes

- Moved MCC Culminating Course (MCC_CULM) from tier 6 (lowest) to tier 5 (MCC Late), fixing 514 of 584 "not graduated" nightly failures caused by the planner never scheduling CORE 4929 before semester 8.
- Condensed nightly report from 750 individual student logs (~385KB) to ~10 representative cases with a test methodology header explaining sampling, profiles, and pass/fail criteria. Full data remains in the JSON snapshot.
- Upgraded GitHub Actions `upload-artifact` and `download-artifact` from v4 to v5, removing Node.js 20 deprecation warnings.
- Added three new autotune capabilities to `scripts/analyze_nightly.py`:
  - **Feasibility Auditor**: flags program combos requiring more than 48 courses as infeasible by curriculum design.
  - **Concentration Detector**: flags any bucket causing >15% of failures with a targeted recommendation.
  - **Resolved-Issue Ledger** (`config/autotune_ledger.json`): tracks past fixes to detect regressions and boost-resistant buckets.

### Design Decisions

- MCC_CULM tier change: the culminating course was starved at tier 6 because discovery buckets (also tier 6) have wider course pools and consumed the remaining slots. Moving it to tier 5 keeps it deferred below major/track work but ensures it schedules before discovery.
- Report condensing: 750 student logs were unreadable. Representative cases are selected for diversity across failure types, unsatisfied buckets, and program combos.
- Feasibility audit uses per-family course counting: since every parent bucket has a unique `double_count_family_id`, requirements within the same family cannot overlap. Summing per-family gives the true minimum unique courses needed.

---

## [v2.4.5] - 2026-03-17

### Changes

- Moved course-history screenshot parsing from backend (GPT-4o vision) to browser-only OCR using tesseract.js. No data leaves the student's device.
- Added local parser with canvas preprocessing, header/row reconstruction, wrapped-title merging, footer skipping, and department-code fuzzy matching.
- Removed backend `/api/import-course-history` route, `backend/import_service.py`, and associated backend tests.
- Added golden OCR fixture and parser tests (`courseHistoryImportParser.test.ts`) covering 11 completed / 10 in-progress / 1 unmatched / 2 ignored rows.
- Updated `CourseHistoryImport.tsx` status copy for local parsing stages (`preprocessing`, `parsing`).
- Updated `ImportStatus` type to replace `uploading` with `preprocessing`.

### Design Decisions

- Local OCR eliminates the OpenAI API dependency for import, removing per-import cost and the `OPENAI_API_KEY` requirement for this feature.
- tesseract.js worker is lazily initialized and reused across retries to avoid repeated WASM startup.
- Canvas preprocessing (grayscale, contrast boost, thresholding) improves OCR accuracy on CheckMarq's table layout.

---

## [v2.4.4] - 2026-03-16

### Changes

- Full frontend language revamp: rewrote copy across 25+ components for max humor per the branding guide — landing, about, onboarding, planner, saved plans, placeholder pages.
- Added spring physics animations (hero cards, wizard steps, buttons, modals, mobile menu) and micro-interactions (parallax orbs, tooltip bounce, hover ripple, animated stat counters).
- New CSS keyframes and utility classes: `spring-up`, `tooltip-bounce`, `ripple-out`, `parallax-slow`, `parallax-fast`, `count-pop`, `.hover-ripple`, `.flip-card`.
- New hooks: `useConfetti` (gold/blue particle burst on CTA clicks) and `useAnimatedCounter` (scroll-triggered count-up for stats).
- All new animations respect `prefers-reduced-motion: reduce`.
- Fixed nightly collection crashes caused by archived migration imports.
- Added structured nightly JSON output alongside the Markdown report, with new report sections for priority fixes, CSV investigation guidance, and failures grouped by program.
- Added nightly auto-tune analysis via `scripts/analyze_nightly.py`, plus checked-in `config/ranking_overrides.json` and `config/data_investigation_queue.json` for deterministic follow-up actions.
- Updated the nightly GitHub Actions workflow to upload the JSON sidecar, run the analyzer after scheduled/manual sweeps, and open auto-tune PRs for config-only changes.
- Fixed track-parent lookup for program helpers so track baselines use `parent_major_id` correctly instead of producing false setup failures for AIM tracks.

### Design Decisions

- Copy tone targets campus humor without stacking slang or mixing campus refs with slang on the same line. No humor in error or warning states.
- Nightly self-improvement is limited to checked-in config changes, not direct CSV edits or arbitrary code edits.
- Auto-tuned changes should land through PRs rather than direct commits to `main`, so nightly behavior changes stay reviewable and reversible.
- Nightly collection should not fail just because a non-nightly archived migration test imports tooling that has been moved out of the active script path.

---

## [v2.4.3] - 2026-03-12

### Changes

- Updated the GitHub Actions workflow to Node 24-safe action versions (`actions/checkout@v5`, `actions/setup-node@v5`, `actions/setup-python@v6`, `actions/upload-artifact@v6`).
- Split CI expectations cleanly: pull requests run only stable backend/frontend/planner guardrail checks, while nightly-only catalog audits stay out of the PR gate.
- Expanded the nightly report so advisor-gold mismatches, track catalog audits, baseline graduation gaps, and track-only program-setup failures are all captured in one report section with readable course-history logging.
- Refreshed `tests/test_structure.md` and `docs/prompts/file_cleanup.md` to document the report-driven nightly workflow and the stable-vs-nightly test split.
- Added frontend CSS polish: text gradients, gradient borders, shimmer effects, breathing glow, underline-reveal nav links, frosted panels, and stagger-enter animations with reduced-motion fallbacks.
- Rewrote about page copy to be funnier and more student-facing.
- Fixed recommendation sort key: wired `soft_prereq_penalty`, `discovery_foundation_penalty`, `discovery_affinity_penalty`, and `is_core_prereq_blocker` into the actual ranking (were computed but unused).
- Fixed rate-limit tracker memory leak: expired IP keys now get evicted instead of accumulating as empty lists.
- Fixed empty-bucket (0/0) satisfaction: buckets with no count or credit threshold are now marked satisfied instead of blocking progress.
- Deleted 14 dead frontend files (unused components, orphaned lib module, stale CSV).
- Archived 7 one-time migration/scraping scripts to `scripts/archive/`.

### Design Decisions

- Stable product behavior should be protected by green PR-facing checks; course and major data drift should be reviewed from the nightly report instead of blocking merges.
- The scheduled nightly workflow should stay green when pytest reports catalog-data mismatches (`exit code 1`) as long as the report artifact is produced, but it should still fail on real runner, collection, or internal pytest errors.
- CSS effects use safe box-shadow approach instead of mask-composite to avoid Safari/Framer Motion composited-layer breaks.
- Shimmer limited to the primary hero CTA only to avoid diluting the visual signal across multiple buttons.

---

## [v2.4.2] - 2026-03-12

### Changes

- Tightened the landing hero so the headline stays dominant, the copy gets to the point faster, and the right-side preview reads more like a clear ranked plan than a crowded dashboard.
- Refreshed the landing navbar with a cleaner centered link pill and a stronger landing-page CTA treatment.

### Design Decisions

- The first screen should sell the outcome quickly: headline first, curiosity second, product proof third.
- Landing copy can be more Marquette-specific and playful as long as the structure stays clear and the CTA remains easy to find.

---

## [v2.4.1] - 2026-03-12

### Changes

- Bucket mappings now come solely from `master_bucket_courses.csv` — equivalency expansion no longer adds phantom courses to buckets.
- Added prereq courses (ACCO 4050, OSCM 4020) to their major's required buckets and bumped `courses_required` for ACCO, BUAN, and OSCM accordingly.
- Removed bad REAL 4061/REAL 4100 equivalency that was treating two distinct required courses as interchangeable.
- Fixed graduation check in both fast tests and nightly sweep to evaluate progress after all semesters' recommendations are applied (was off by one).
- Rewrote core prereq blocker detection to use actual remaining buckets instead of a broken role-based lookup.

### Design Decisions

- `master_bucket_courses.csv` is the single source of truth for which courses map to which buckets. Equivalency expansion was causing grad-level phantom courses to appear in undergrad buckets.
- Prereq courses that gate required courses belong in the required bucket — the engine needs to see them as required work to schedule them early enough.
- Graduation progress must be checked after the final semester's recommendations are applied, not before. The prior off-by-one caused false graduation failures.

---

## [v2.4.0] - 2026-03-10

### Changes

- Added student stage selector (undergraduate, graduate, doctoral) to the planner profile, onboarding, and profile edit flows.
- Recommendations and can-take checks now enforce a hard course-level gate based on the selected stage: undergrad gets 1000-4000, graduate gets 5000-7999, doctoral gets 8000+.
- Stage is inferred automatically from course history when not explicitly set; defaults to undergraduate for new students.
- Course search and transcript entry remain full-catalog so users can still record unusual history.
- A warning banner appears when the selected stage conflicts with recorded course history.
- Removed the planner's old requirement-diversity balancing layer and switched recommendations to one fixed order: BCC required, MCC core, ESSV1, major requirements, later BCC work, then track work.
- Business freshman plans now pull math bridge work like `MATH 1200` back into the first semester when it unlocks required core progress, even if the source data carries a noisy standing tag.
- Retired the old planner balance-policy chips in the semester modal because the recommender no longer uses family-cap or declared-min quota passes.
- Bumped CI timeout caps from 30 minutes to 360 minutes for backend regression and nightly sweep jobs.
- Adapted all backend test helpers (`PlanCase`, `recommend_payload`, `payload_for_major`) to accept and pass through the `student_stage` parameter.
- Fixed frontend feedback nudge test to match updated "Contact Markie" link text.

### Design Decisions

- Stage is a hard gate on future recommendations, not a validator on past history. Students with unusual transcripts should still be able to record what they took.
- Level bands (1000-4000, 5000-7999, 8000+) match the current Marquette catalog better than mapping 7000+ directly to doctoral.
- Server-side inference mirrors the frontend default so older clients without the field still get correct filtering.
- Planner ordering should be one global policy, not a separate balancing system that can reshuffle obvious priorities.
- Foundational business math should beat filler when it opens required core progress, even if the workbook's standing metadata is noisy.
- CI timeouts were removed as a practical constraint — GitHub's 6-hour job limit is the only real cap needed.

---

## [v2.3.2] - 2026-03-09

### Changes

- Added planner bucket drill-ins so progress cards can open the courses and source details behind each requirement bucket.
- Refined planner, semester, and saved-plan modals so course details and progress review are easier to scan.
- Rewrote the frontend copy across landing, onboarding, planner, saved plans, About, and placeholder pages to match the updated voice guide: clearer first, drier humor second, and more Marquette-specific without sounding sloppy.
- Tightened planner-facing microcopy: recommendation explainer, feedback modal, can-take panel, saved-plan states, and profile/settings surfaces now explain tradeoffs more directly.
- Audited the planner quip system against the new voice guide so progress and semester quips sound more like Marquette students and less like internet bits.
- Moved local feedback storage from `docs_local/` to ignored `docs/feedbacks/feedback.jsonl` so feedback logs stay inside the docs area without becoming pushable repo history.
- Added a frontend language audit memo and refreshed the branding guide so future copy work has explicit humor limits, tone rules, and surface-by-surface guidance.
- Redesigned the nightly dead-end sweep into a focused sampled harness with prereq-hardened seeded histories, semester-8 completion checks, and student-first completeness reporting.
- Renamed the nightly Actions job to `Nightly Focused Sweep` and refreshed test docs with the new nightly defaults and reduced smoke commands.

### Design Decisions

- Progress drill-ins should explain why a bucket is incomplete without making users decode raw requirement data by hand.
- Humor should target system friction, not the student. The product can be funny without sounding unserious about degree rules.
- Voice should stay clearer than it is quirky. If a joke makes an instruction weaker, the joke loses.
- Local feedback logs now live under `docs/feedbacks/` but stay git-ignored so docs can be pushable without leaking student submissions.
- Nightly confidence should come from realistic seeded student histories, not brute-force random course sampling.

---

## [v2.3.1] - 2026-03-07

### Changes

- Migrated `course_equivalencies.csv` from long format (571 rows, one per group member) to wide format (275 rows, one per equivalency group) with columns: `id`, `course_1`, `course_2`, `course_3`, `type`, `parent_bucket`, `child_bucket`, `notes`.
- Updated `_load_v2_equivalencies()` in `data_loader.py` to detect wide format and unpivot to internal long format via new `_unpivot_wide_equivalencies()` helper. Legacy long format still supported as fallback.
- Updated `discover_equivalencies.py` to output wide format.
- Redesigned nightly dead-end tests: triple-combo sweep with randomized student profiles (8,248 tests, down from 14,382 pairwise). Date-based seed for daily reproducibility.
- Trimmed fast dead-end regression suite from 93 to 55 tests. Single programs use empty-state only; curated combos keep state variants.
- Added `NightlyFailureCollector` for report aggregation and CI artifact upload.
- Updated `test_structure.md` with new counts and simplified layout.
- Dynamic warning suppression: `standing_requirement` soft tag is now suppressed when the student's current standing meets or exceeds the course's `min_standing`. A sophomore no longer sees "sophomore standing required" on courses they're already eligible for. `major_restriction` and `college_restriction` were already dynamically cleared.
- Disabled course offering filtering: all courses now treated as offered every term (Fall, Spring, Summer) with high confidence. `course_offerings.csv` is still loaded but ignored. `not_frequently_offered` tag injection removed. `low_confidence` warnings no longer fire.
- Added REAL 4061 = REAL 4100 equivalency (catalog "or" alternative).
- xfail'd REAL REAP track dead-end tests (`combo-REAL+REAP/mid`, `combo-REAL+REAP/late`) — the 4210→4220→4230 sequential chain requires summer terms which the test cases exclude.
- Updated about page: moved course equivalencies off the roadmap (shipped), added "Semester offering awareness" as a future feature.
- Updated `data_model.md` and `algorithm.md` to reflect disabled offerings.
- Equivalency CSV schema: replaced generic `equivalent` type with `honors` (35 groups) and `grad` (200 groups) for self-documenting equivalency categories. Dropped `notes` column — the type now carries the semantic meaning.
- Honors student dedup: when `is_honors_student=True`, base courses are removed from eligible candidates when their H variant is also eligible. H variants replace base courses in recommendations instead of appearing alongside them.
- Equivalency-aware greedy selection: `selected_codes_set` in the recommendation loop now expands via `_expand_with_equivalents()` so picking ECON 1103H also blocks ECON 1103 from being selected later.

### Design Decisions

- Wide CSV format is human-readable and editable — one row per equivalency group instead of 2-3 rows. The loader unpivots at load time so all downstream code (map builders, allocator, prereq checker) is unchanged.
- Standing warning suppression follows the same `cleared_tags` pattern already used for `major_restriction` and `college_restriction` — `current_standing` is threaded into `get_eligible_courses()` and the tag is removed from `soft_tags` before results are built. No frontend changes needed; the frontend already renders only the tags it receives.
- `course_3` column handles triples (21 groups have 3 members); empty for pairs.
- `parent_bucket` replaces `scope_program_id` for clarity — it names which parent bucket the equivalency applies to.
- Nightly test redesign targets triple combos (major + track + minor) which better reflect real student declarations than pairwise. Randomized profiles add variety without manual curation.
- Offering filtering was causing false dead-ends (REAP track) and adding complexity without reliable data. Disabling it removes a source of incorrect recommendations while the offering data is curated. The infrastructure remains in place for re-enablement.
- Five equivalency types (`honors`, `grad`, `cross_listed`, `no_double_count`, `equivalent`) replace the old three-type model. `honors` and `grad` behave like `equivalent` for prereq satisfaction and bucket expansion, but the type is self-documenting and enables type-specific logic (e.g., honors dedup).
- Honors dedup happens at the eligibility stage (candidate filtering), not just ranking. This guarantees the base course is never a candidate when the H variant is available — no sort-key ordering issues.

---

## [v2.3.0] - 2026-03-07

### Changes

- Fixed dead-end planner failures for AIM, Marketing, and Entrepreneurship majors caused by incorrect `complex_hard_prereq` tags on courses with parseable prerequisites (ACCO 4080, MARK 4060, FINA 4210, ENTP 3001).
- Corrected FINA 4210 hard prerequisite from `none` to `FINA 3002;MANA 3001`.
- Corrected ENTP 3001 hard prerequisite from `none` to `BUAD 1001`.
- Updated health endpoint version to 2.3.0.
- Frontend lint fixes for saved plan components.

### Design Decisions

- `complex_hard_prereq` should only exist on courses with genuinely unparseable prerequisites. Courses with parseable AND/OR prereqs must not carry this tag, as it prevents recommendation.
- Soft prereq tags were corrected to match actual restriction types (e.g., `major_restriction` instead of `complex_hard_prereq`).

---

## [v2.2.5] - 2026-03-06

### Changes

- Activated MCC requirement programs for live planning:
  - `MCC_ESSV2`, `MCC_WRIT`, and discovery theme tracks `MCC_DISC_BNJ`, `MCC_DISC_CB`, `MCC_DISC_CMI`, `MCC_DISC_EOH`, `MCC_DISC_IC` are now `active=True`.
  - `MCC_DISC` remains `active=False` as the container parent.
- Expanded bucket mappings:
  - Added 813 new Discovery course mappings to `data/master_bucket_courses.csv`.
  - Added `ACCO_MAJOR,acco-req-core,BULA 3001` and updated `ACCO_MAJOR/acco-req-core` from `7` to `8` required courses.
- Backend updates:
  - `backend/server.py`: auto-includes `discovery_theme` in `selected_track_ids` so theme child buckets materialize.
  - `backend/server.py`: `/api/courses` now includes `description`.
  - `backend/data_loader.py`: elective purge now targets only `credits_pool` buckets; `choose_n` buckets like Discovery `_ELEC` keep mappings.
  - `backend/semester_recommender.py`: removed ESSV2/WRIT "coming soon" note injection.
  - `backend/eligibility.py`: non-integer credit courses are excluded from recommendation candidates.
- Frontend updates:
  - Enabled Discovery Theme selection in onboarding and planner sidebar.
  - Recommendation payloads now consistently include discovery theme track IDs (initial run + semester edit reruns).
  - Removed ESSV2/WRIT/Discovery caveat text from recommendation panels.
  - ESSV2/WRIT are now visible in progress rendering with explicit label fallbacks.
  - Added clickable course detail modal support using catalog descriptions.
  - Improved course picker UX (scroll anchoring + Enter-select behavior), with matching frontend tests.
- Test/data gate updates:
  - `tests/backend/test_data_integrity.py`: active track parent validation now accepts active `major` and `universal` parents.
  - `tests/backend/test_data_integrity.py`: prereq orphan threshold updated from `30` to `50`.
  - `tests/backend/test_recommendation_quality.py`: senior standing seed recalibrated from `6` to `7` semesters.
  - `tests/backend/test_eligibility.py`: added coverage for non-integer-credit recommendation filtering.

### Design Decisions

- Discovery themes now run as first-class selectable tracks while preserving `MCC_DISC` as a non-selectable container.
- Discovery elective mappings must persist in `choose_n` buckets, so purge logic is scoped to `credits_pool` buckets only.
- With full-catalog descriptions injected, course detail views can be shown directly from canonical course data.
- Non-integer-credit offerings remain excluded from deterministic recommendation output to avoid schedule ambiguity.

---

## [v2.2.4] - 2026-03-06

### Changes

- Added `scripts/scrape_catalog.py` for a one-time full Marquette bulletin scrape into `data/webscrape_1/`.
- Added `scripts/merge_scraped_catalog.py` to merge scraped catalog data into production CSVs with automatic pre-merge backups.
- Expanded production catalog data:
  - `data/courses.csv`: `540` -> `5302` rows.
  - `data/course_prereqs.csv`: `540` -> `5302` rows.
- Added generated scrape artifacts for review:
  - `data/webscrape_1/all_courses_raw.csv`
  - `data/webscrape_1/course_prereqs_proposed.csv`
  - `data/webscrape_1/scrape_summary.json`
- Added backup snapshots:
  - `data/courses.pre_merge_backup.csv`
  - `data/course_prereqs.pre_merge_backup.csv`

### Design Decisions
- Kept schema compatibility with existing production CSV contracts and backend loaders.
- Preserved existing hand-curated prerequisite rows during merge and only appended new course prereq rows.
- Preserved non-empty existing curated fields during merge while injecting scraped descriptions and new catalog coverage.

---

## [v2.2.3] - 2026-03-06

### Changes

- Simplified recommendation ranking key from 10 positions to 7:
  - `tier`, `core_prereq_blocker`, `bridge`, `course_level`, `chain_depth`, `multi_bucket_score`, `course_code`.
- Removed obsolete/dead ranking branches and helpers:
  - BCC decay toggle path
  - accounting-major tie-break boost
  - soft-tag demotion tie-break
  - prereq-level tie-break
  - freshman level-balance deferral pass
- Replaced old BCC decay unit coverage with stable tier-invariant tests.
- Updated debug trace fields to match simplified ranking inputs.
- Fixed debug trace `chain_depth` to report the same chain-depth map used by ranking.
- Fixed standing-credit parsing to correctly handle decimal and range credit values (e.g., `1.5`, `1-3`).

### Design Decisions
- Prioritized explainability and deterministic behavior over stacked heuristic tie-breakers.
- Kept bridge/program-balance/rescue safeguards while reducing sort complexity.
- Preserved existing API response shape while simplifying internal ranking semantics.

---

## [v2.2.2] - 2026-03-05

### Changes

- test_data_integrity.py: validates required CSV presence/schema/non-empty, uniqueness, cross-file links, prereq sanity (no self/cycles), bucket rule fields, active program metadata, parseable offering flags, and runtime materialization for active non-minor programs.
- test_dead_end_fast.py: verifies active majors/tracks keep producing recommendations across empty/early/mid/late states, plus high-risk combos, minor smoke, 3-semester smoke, include_summer behavior, and coherent selection context.
- test_recommendation_quality.py: enforces foundation-first behavior, standing gates, no duplicate/repeated recs, non-degrading unmet requirements, semester cap compliance, unmet-bucket usefulness, and stable selected-program IDs (including summer runs).
- test_recommend_api_contract.py: validates /recommend 400 behavior for malformed inputs and contract correctness for successful responses.
- test_recommend_api_contract.py (scenario checks): confirms include_summer true/false changes semester labels correctly and target_semester_count bounds are honored (1 and 8).
- test_validate_prereqs_endpoint.py: verifies both prereq-validation routes return identical shape/output, correctly report direct/transitive conflicts, and handle empty/valid/unknown/malformed inputs safely.
- test_validate_track.py + test_regression_profiles.py + eval/advisor_gold.json: enforce full live validate_track --all pass and protect recommendation/ranking behavior against regression profiles and advisor-gold expectations.

### Design Decisions
- v2.2.2 focused on making release gates explicit around data integrity, dead-end prevention, recommendation quality, API contracts, prereq validation, and advisor-baseline regression safety.

---
## [v2.2.1] - 2026-03-04

### Changes

**Saved Plans is now live**
- You can save recommendation runs, reopen them later, and compare plan snapshots without rerunning onboarding each time.
- Saved plan pages now show clearer progress KPIs so alternatives are easier to compare before registration.

**Planner progress display is more consistent**
- Progress cards, modal views, and bucket breakdowns were refactored to use shared rendering components.
- Assumption notes are surfaced in the progress modal so inferred prerequisite chains are visible to users.

**Program data rules are stricter**
- Program metadata now supports explicit default-major selection and required-major gating for dependent tracks.
- Course/catalog and validation updates tighten recommendation behavior around program constraints.

### Design Decisions
- Saved-plan UX was implemented as reusable components so planner and saved views share the same progress semantics.
- Program selection logic is now data-driven from `parent_buckets.csv` (`required_major`, `is_default`) to reduce hardcoded behavior.
- Focused API-contract and rendering tests were prioritized for closeout speed while preserving high-risk coverage.

---

## [v2.2.0] - 2026-03-03

### Changes

**Planner avoids senior-standing dead ends**
- If your last required course is blocked only by class standing, MarqBot now keeps recommending credit-building courses instead of returning an empty semester. This prevents cases like Business Administration getting stuck just short of Senior standing before `MANA 4101`.

**Planner startup can recover from load failures**
- Onboarding and Planner no longer sit on an endless spinner if the course catalog or program list fails to load. You now get a clear error message and a retry button.

**Can-take answers no longer go stale**
- If a `Can I take this?` request fails, MarqBot no longer leaves the old course answer on screen under the new course name.

**Recommendation refresh keeps your last plan visible**
- Refreshing recommendations no longer wipes out your current plan before the next request succeeds. If the refresh fails, your last good plan stays visible.

**Nightly dead-end sweep now runs automatically**
- Added a GitHub Actions workflow that runs the nightly dead-end test sweep every day at 2:39 AM Milwaukee time, with a manual run option too.

**Quips got a student-life rewrite**
- Progress and semester one-liners now sound more like actual Marquette students: more campus references, more student-life humor, and stronger Gen Z phrasing without getting inappropriate.

### Design Decisions
- Standing is still credit-based, not semester-based. The planner only uses filler recommendations when requirements remain but the path forward is blocked by standing.
- Startup data loading now has explicit `loading / error / retry` behavior so the UI can recover cleanly from failed bootstrap fetches.
- The nightly workflow uses two UTC cron entries plus an `America/Chicago` time check so `2:39 AM` stays correct across CST and CDT.

---

## [v2.1.1] - 2026-03-02

### Changes

**Dead-end prevention test suite**
- New automated tests that simulate your full degree path — every major, track, and combo — and check that the planner never gets stuck with no courses to recommend. 73 test scenarios covering empty, early, mid, and late progress states.

**OSCM 4997 (Capstone) now recommendable**
- Previously required manual advisor review. The prereq (OSCM 3001 + OSCM 4010 + one of OSCM 4020/4025/4040 + Senior standing) is now fully understood by the engine and the course appears in recommendations when you're eligible.

**International Business study abroad options expanded**
- The study abroad requirement bucket now includes 30+ eligible courses (HIST, POSC, SPAN, ANTH, CHNS, ITAL, and more) — previously only 5 were mapped, and 4 of those were non-recommendable "Topics in" courses.

**Smarter recommendation engine**
- When the planner would have returned an empty semester with unsatisfied requirements, it now keeps recommending — even if it means overfilling a bucket that's already at its soft cap. Filling a bucket twice beats giving you nothing.

### Design Decisions
- The prereq parser now supports mixed AND/OR patterns (e.g., "A and B and (C or D or E)"). This is used only for OSCM 4997 today but supports future courses with similar prereq structures.
- Non-recommendable course groups (courses the engine will never suggest, but still count if completed): **internships**, **work periods**, **independent studies**, and **"Topics in..." courses**. These have variable content or require special enrollment.
- Dead-end tests run in the PR gate (~60s). A separate nightly sweep covers pairwise program combos and adversarial states.
- The rescue pass only fires as a last resort — after both the main selection loop and the balance-deferral pass return nothing. Normal bucket caps and diversity spreading are preserved for all other cases.

---

## [v2.1.0] - 2026-03-01

### Changes

**Contextual quips in modals**
- Progress and Semester modals now show a contextual one-liner based on your data — standing, progress, season, course load, and more. 500+ messages, deterministic (same data = same quip), no external AI.

**About page**
- New "Meet the Builder" page with founder intro, social links, project roadmap, and CTA section. Accessible from the navbar.

**Landing page stat accuracy**
- "Courses Tracked" and "Majors Supported" numbers now reflect real data (540+ courses, 12 majors). Feature card stats are larger for better readability.

### Design Decisions
- Quip selection uses a djb2 hash over student dimensions — no Math.random(), fully deterministic. Quips are authored in `data/quips.csv` and compiled to TypeScript via `scripts/compile_quips.py`. The generated file is committed to git so fresh checkouts work without running the script.
- About page uses a scrapbook visual style with polaroid frames, sticky notes, washi tape, and hand-drawn doodles to match the brand personality.

---

## [v2.0.3] - 2026-03-01

### Changes

**Business Economics electives fix**
- Fixed a bug where upper-division ECON elective courses were not counting toward the "Upper-Division ECON Electives" bucket for Business Economics majors. Courses like ECON 3042, ECON 4005, ECON 4020 now correctly fill the ECON electives requirement.
- Removed 7 incorrectly mapped courses from the ECON electives bucket (required core courses and curriculum-excluded courses like ECON 3399).

**Non-recommendable course filtering**
- Internships, independent studies, and "Topics in" courses are no longer recommended by the planner. They still count toward your progress if you've already completed or enrolled in them.

**BUAN Advanced bucket fix**
- Corrected BUAN Advanced requirement from 2 courses to 1 course (BUAN 4061 only).

**Regression test coverage**
- Added smoke tests for 5 previously untested majors (BADM, BECO, INBU, MARK, REAL) and 7 tracks (AIM CFA, AIM FinTech, AIM IB, Financial Planning, HURE Leadership, MARK Professional Selling, REAL REAP).

**Modal and heading polish**
- Modal titles sized down from h2 to h3 for better visual hierarchy.
- Major section headings in progress and semester modals now use Marquette blue and bold styling for better visibility.
- ESSV2/WRIT/Discovery disclaimer text made bold and 15% larger.

### Design Decisions
- BECO ECON electives bucket changed from `credits_pool` to `choose_n` mode to give it allocation priority over the general business electives bucket. This leverages the allocator's built-in priority ordering (`required → choose_n → credits_pool`).
- Non-recommendable courses are filtered by name pattern matching (not a CSV column) to automatically catch future courses without data maintenance.

---

## [v2.0.2] - 2026-03-01

### Changes

**UI revamp — Marquette design language integration**
- Applied Marquette brand visual language across landing, onboarding, and planner: section color banding, gold/blue accent borders, serif italic accents, stat-card decorations, hash-mark section labels, anchor-line dividers.
- Updated branding copy across planner, onboarding, and empty states to match `docs/branding.md` voice (student-built, witty upperclassman tone).
- Responsive typography via CSS `clamp()` on h1–h3 element selectors.
- 4 new shared components: `StatCard`, `SplitCard`, `AnchorLine`, `HashMark`.

**Progress modals — major sub-grouping**
- "Major Requirements" and "Tracks & Minors" sections in both ProgressModal and SemesterModal now sub-group buckets by individual program (e.g., separate "BUAN", "Marketing", "Real Estate" headings).
- Primary major listed first when applicable, otherwise follows user's selected order.
- New `groupProgressByTierWithMajors()` in `rendering.ts`; `programOrder` derived from `selection_context.selected_program_ids`.

**Planner polish**
- "Get My Plan" button glow: two-layer gold shadow (`24px @ 35%` + `48px @ 15%`).
- "How Marqbot Recommends Courses" modal title: gold color, h3-scale sizing.
- Semester heading in recommendations panel: h4 (no clamp override) for tighter fit.
- KPI tiles: removed `stat-card-decor` gradient, kept `text-3xl` bold numbers.
- Course code/title font bumped 20% across all density tiers.
- Semester heading in recommendations reduced 30%.
- Projected progress in SemesterModal restyled to match ProgressModal's bucket cards.

### Design Decisions
- Sub-grouping majors inside tier sections gives multi-major students a clearer mental model without breaking the MCC → BCC → Major → Track hierarchy.
- CSS `clamp()` on heading elements ensures consistent responsive sizing but requires `h4` (no clamp rule) for small UI headings to avoid inflation.
- Gold glow on the primary CTA reinforces Marquette brand while drawing attention to the main action.

---

## [v2.0.1] - 2026-03-01

### Changes

**Prerequisite cleanup — removed phantom course recommendations**
- Cleaned up ~40 OR-alternative prerequisites that were causing unrelated courses (MATH 1700, COMM 1700, SOCI 2060, etc.) to appear in recommendations as "unlock targets."
- OR alternatives replaced with the primary business course (usually BUAD 1560 for stats) or converted to AND where all prereqs are truly required.
- Future `course_equivalencies` sheet will handle OR equivalences for completed/in-progress credit only — they no longer affect recommendations.

**Core prereq blocker fix**
- Fixed a bug where universal buckets (BCC_REQUIRED, MCC_CORE, etc.) were included in the core_prereq_blocker scoring, causing random non-major courses to get boosted in recommendations.
- The existing BCC::/MCC:: prefix filter was dead code — bucket IDs are plain strings, not namespaced. Replaced with proper parent-type lookup.

**"How Marqbot Recommends" rewrite**
- Rewrote the explainer modal from 7 jargon-heavy steps to 5 plain-English steps a student can actually understand.

**Data cleanup**
- Removed MATH 4720 and ECON 1001 from all data files (not real courses students take).
- Restored MATH 1200 (prereq for MATH 1400 which is BCC_REQUIRED).
- Updated all 14 advisor gold profiles with corrected expected recommendations.

### Design Decisions
- OR-alternative prereqs were the root cause of phantom recommendations — the engine treated every OR branch as an unlock target. Stripping them from prereq data and deferring equivalency logic to a future `course_equivalencies` sheet keeps the recommendation engine clean.
- `hard_prereq_complex` tag added to INSY 4158 (choose 2 from 5) and OSCM 4997 (choose 1 from 3) — genuinely unparseable patterns.
- CORE 1929 (`THEO 1001 or PHIL 1001`) kept as OR — commonly known and intentional.

---

## [v2.0.0] - 2026-02-28

### Changes

**Smarter recommendations — chain depth, multi-bucket scoring, and dual-major balance**
- Courses that start long prerequisite chains now rank higher. FINA 3001 (depth 4 — unlocks a 5-semester sequence to AIM 4430) gets scheduled before standalone electives with no downstream dependencies.
- Multi-bucket score is now prioritized over direct unlock count. A course counting toward your major, BCC, and a track requirement simultaneously ranks above one that only fills a single bucket.
- Dual-major students now get balanced picks. If Finance already has 3 picks and INSY has 0, the next FINA course is deferred so INSY can catch up. No major gets starved.
- Removed `hard_prereq_complex` tag from all courses with parseable prerequisites (~80 courses unblocked, including all INSY 4051-4055 core courses and AIM 4310-4430 track chain).
- Lowered FINA 3001 standing gate from Senior (90 credits) to Sophomore (24 credits), unblocking the AIM FinTech chain much earlier in the plan.

**Graduation projection**
- When a future semester has no eligible courses and all degree requirements are projected as satisfied, the planner now shows "You will have graduated!" instead of "No eligible courses."
- Both the main semester view and the sidebar semester list display the graduation indicator.
- Added a disclaimer: "ESSV2, WRIT, and Discovery courses are not yet considered."

**Bug fix — BCC progress satisfaction**
- Fixed a bug where course-count buckets (like BCC Required: 18 courses) could show as unsatisfied even when all courses were completed, because the satisfaction check was comparing credits (52) against an estimated credit target (54) instead of using the actual course count (18/18).
- Satisfaction now uses OR logic: if either the course-count OR credit threshold is met, the bucket is satisfied.

**"How Marqbot Recommends Courses" — rewrite**
- Updated the explainer modal to match the actual 7-step algorithm: Eligibility Filter, Requirement Tiers, Prereq Blocker Priority, Chain Depth, Multi-Bucket Score, Direct Unlockers, Program Diversity.

**Code audit and cleanup (from prior session)**
- Removed duplicate helper functions, dead frontend utility, button typo fix, archived migration scripts.
- Fixed 9 backend test expectations + 4 frontend lint errors. All 377 tests pass.
- Rewrote README as a student-friendly intro. Added `docs/data_model.md`.
- Fixed standing gate deadlock in multi-semester recommendations.
- Deactivated MCC_ESSV2, MCC_DISC, and all 5 Discovery Theme tracks until course data is injected.

### Design Decisions
- Chain depth is computed once at startup via memoized recursive traversal (O(V+E), ~300 courses). No per-request cost.
- Program balance uses a threshold of 2: a program must have ≥ min_picks + 2 before deferral kicks in. Single-major students see no change.
- Satisfaction OR logic ensures that mixed-unit buckets (both course-count and credit targets) don't falsely block graduation projection.
- `hard_prereq_complex` removal was a data cleanup — the prereq parser already handles "or" prereqs correctly; the tag was a leftover TODO from data migration.

---

## [v1.9.8] - 2026-02-28

### Changes

**Requirement progress — grouped hierarchy view**
- Progress panels (Degree Summary, Progress Modal, Semester Modal) now group bucket entries by parent program instead of a flat sorted list.
- Each group shows a labeled section header (e.g. "Finance", "MCC Foundation") with child buckets indented beneath it.
- Hidden parents (`MCC_ESSV2`, `MCC_WRIT`) are filtered from the display until their data is fully injected.

**Planning Settings moved to Preferences pane**
- The "Include Summer Semesters" toggle was in the wrong pane (Your Profile). Moved it to the Preferences pane, right below Semesters and Max Courses.

**Max semesters raised to 8**
- Semester count now accepts 1–8 (was 1–4). Both the UI options list and backend validation/clamp updated.

**Summer semester UX polish**
- Added a gold-tinted note inside the Semester Detail modal when the selected semester is a summer: "Summer semesters are capped at 4 courses (max 12 credits)."
- Suppressed the "You requested N, but only 4 eligible" warning for summer semesters since the 4-course cap is by design.

**Coming Soon — Discovery Theme and Minors**
- Discovery Theme dropdown in the profile modal now shows a translucent "Coming Soon" overlay and is non-interactive. Data not yet injected.
- Minors dropdown similarly marked Coming Soon; no minor data injected yet.

**"How Marqbot Recommends Courses" modal — rewrite**
- Rewrote the explainer modal (accessible via link next to the Can I Take search bar) in a first-person, student-facing voice.
- Now covers 7 steps (0–6): Reality Check First, MCC Foundation, Business Core (BCC), Major Requirements, Tracks & Minors, Course Unlockers, Multi-Bucket Efficiency.
- Removed the redundant "Standing Gates" step (already covered by step 0). Added BCC as its own step. Added Multi-Bucket Efficiency as the final step.

**MCC Writing Intensive (WRIT) bucket deactivated**
- Set `MCC_WRIT active=False` in `data/parent_buckets.csv`. WRIT courses no longer appear in recommendations until the bucket is re-activated after full data review.
- Deactivating the parent bucket cascades through the runtime: its sub-buckets are dropped via inner join, course mappings are removed from the eligibility pool, and WRIT-only courses are skipped (no eligible bucket).

**AIM primary major enforcement**
- Set `AIM_MAJOR requires_primary_major=True` in `data/parent_buckets.csv`. AIM is now correctly treated as a secondary-only major alongside BUAN and INBU.
- Removed the hardcoded `majorId === "AIM_MAJOR" ? true : ...` override from `frontend/src/lib/api.ts` — the data carries the correct value now.
- Added frontend warning in both the onboarding Major step and the planner profile modal: when every selected major has `requires_primary_major=True`, a yellow banner prompts the student to add a standalone primary major.
- Backend already returned `PRIMARY_MAJOR_REQUIRED` (HTTP 400) for this case; the frontend warning now surfaces it before the API call.

### Design Decisions
- Grouping progress by parent gives students a clearer mental model of their degree structure (e.g. all Finance sub-requirements under one "Finance" header) rather than a flat alphabetical list.
- WRIT deactivation is a data-readiness gate, not a feature removal. The bucket and its 103 course mappings remain in the CSV; flipping `active` back to `True` re-enables it instantly.
- AIM primary major rule is enforced at both data and frontend layers: data is the source of truth, frontend gives early feedback, backend is the hard gate.

---

## [v1.9.7] - 2026-02-28

### Changes

**MCC course data — ESSV2, WRIT, CULM buckets now populated**
- Added 107 Engaging Social Systems & Values 2 (ESSV2) approved courses to the data model; MCC_ESSV2 bucket now has full course mappings.
- Added 103 Writing Intensive (WRIT) approved courses; MCC_WRIT bucket now has full course mappings.
- Added CORE 4929 as the Culminating Experience (CULM) course; MCC_CULM bucket now has a mapping.
- All three buckets previously returned no recommendations; students needing these requirements now receive course suggestions.

**Summer semester recommendations**
- New "Include Summer Semesters" toggle in Planning Settings (default Off).
- When enabled, summer semesters appear in the plan capped at 4 courses, showing only summer-available offerings.
- When disabled, summer semesters are skipped and the plan delivers the requested number of non-summer semesters.

**Running academic standing**
- Marqbot now tracks your academic standing (Freshman / Sophomore / Junior / Senior) across each planned semester.
- Standing is computed from your completed courses at the start and projected forward as you complete each semester's recommendations.
- Courses requiring a minimum standing (e.g. Junior-only seminars) are automatically held until you qualify.
- Each semester card now shows a standing badge: e.g. "Semester 1 – Fall 2025 · Freshman Standing".

**"How Marqbot Recommends Courses" explainer**
- Added a link near the course search bar in the Recommendations panel.
- Opens a modal describing the five recommendation tiers: Foundation First, Major Requirements, Tracks & Minors, Standing Gates, and Prerequisite Chains.

**Bug fixes**
- Fixed a crash when using the CSV data source: prerequisite standing values were read as strings, causing a type error during eligibility checks.
- Restored BCC (Business Core Curriculum) decay behavior: once core BCC requirements are substantially complete, lower-priority BCC courses are deprioritized in favor of major-specific courses.

### Design Decisions
- ESSV2 and WRIT bucket course data is live in the data model; the frontend "coming soon" treatment for those buckets will land in a future patch.
- Summer course cap of 4 matches typical summer session load limits at Marquette.
- Standing projection is additive: each semester's recommended credits accumulate before the next semester's eligibility gate runs, so a student finishing Semester 1 as a Freshman may start Semester 2 as a Sophomore.

---

## [v1.9.6] - 2026-02-27

### Changes

**Data source migration: Excel → CSV directory**
- Changed `_DEFAULT_DATA_PATH` in `backend/server.py` from `marquette_courses_full.xlsx` to `data/`. Backend now reads from the six CSV files in `data/` by default; Excel remains as a manual override via `DATA_PATH` env var.
- Fixed `_canonical_program_label` in `backend/server.py`: was hardcoded to ignore CSV labels for `kind=major` and always generate `"{code} Major"` format. Now uses the CSV `parent_bucket_label` as priority; falls back to generated format only when label is absent.
- Removed `MAJOR_LABEL_OVERRIDES` dict from `frontend/src/lib/api.ts` — was an Excel-era workaround that mapped abbreviated labels (e.g. "ACCO Major" → "Accounting"). No longer needed since labels now come directly from CSVs.
- Deleted `marquette_courses_full.xlsx`; removed xlsx COPY line from `infra/docker/Dockerfile`; updated `scripts/validate_track.py` default `--path` to `data/`.

**Stage 1 data injection — `data/courses.csv`, `data/course_prereqs.csv`, `data/course_offerings.csv`**
- Injected 268 business school catalog entries (ACCO, AIM, BUAD, BUAN, BULA, ECON, ENTP, FINA, HURE, INBU, INSY, LEAD, MANA, MARK, OSCM, REAL) via `scripts/inject_stage1.py`.
- CSV BOM fix: changed `read_csv` in inject script to use `encoding="utf-8-sig"` to handle UTF-8 BOM on first column.

**Stage 2 data injection — `data/parent_buckets.csv`, `data/child_buckets.csv`, `data/master_bucket_courses.csv`**
- Added 5 new majors: Marketing (MARK_MAJOR), Real Estate (REAL_MAJOR), Business Economics (BECO_MAJOR), Business Administration (BADM_MAJOR), International Business (INBU_MAJOR).
- Added 7 minors: Business Administration, Entrepreneurship, Human Resources, Information Systems, Marketing, Supply Chain Management, Professional Selling.
- Added 2 new tracks: Professional Selling Concentration (MARK_PRSL_TRACK), Real Estate Asset Program Concentration (REAL_REAP_TRACK).

**CSV integrity fixes**
- AIM 4410: removed ghost prereq `FINA 5075` (graduate code), corrected to `FINA 4075`; fixed `min_standing` from 5.0 → 4.0; removed erroneous `may_be_concurrent`/`instructor_consent` warnings; kept `major_restriction` only.
- MATH 1200: cleared all prereqs and warnings (was incorrectly flagging `instructor_consent;standing_requirement`).
- HOPR 2956H, INPS 2010: fixed `prereq_warnings` separator from `;` to `,`.
- REAL 4002: added to all three CSVs as a cross-listing of FINA 4002 (Commercial Real Estate Finance); resolves orphaned prereq references in REAL 4xxx courses.

**Label cleanup — `data/parent_buckets.csv`**
- Removed "Major" suffix from all major display labels (e.g. "Finance Major" → "Finance", "Accounting Major" → "Accounting").
- Removed "Minor" suffix from all minor display labels (e.g. "Entrepreneurship Minor" → "Entrepreneurship").
- Set AIM label to "AIM - Accelerating Ingenuity in Markets".
- Prefixed Discovery tier track labels with "MCC Discovery:" for clarity in the UI.

**Frontend — MajorStep redesign (`frontend/src/components/onboarding/MajorStep.tsx`)**
- Restructured from a single-column conditional layout to 4 explicit sections: Major(s), Minor(s), Concentration / Track, Discovery Theme.
- Concentration/Track section always visible; shows placeholder text when no major with tracks is selected.
- Added Discovery Theme section: single-select combobox for MCC_DISC tracks (CMI, BNJ, CB, EOH, IC), using existing track selection state keyed by `MCC_DISC`.
- Compacted spacing and font sizes; removed `<hr>` dividers between sections.
- Updated heading to "What's your program?".

### Design Decisions
- CSV directory is the permanent data source going forward; Excel file deleted. All future data changes go through the CSV files.
- Label authority lives in `parent_bucket_label` column — no frontend overrides. Keeps display names in one place and avoids frontend/data drift.
- Discovery themes are tracks (not a separate entity type) to reuse existing `SET_TRACK` dispatch and `selectedTracks` state without new reducer logic.

---

## [v1.9.3] - 2026-02-27

### Changes
- Redesigned planner to a 45/55 dual-column layout: Progress on the left, Recommendations on the right.
- Merged Profile and Preferences into one side-by-side modal (edit pencil icon in the header).
- Added "Get Recommendations" button inside the modal — it auto-closes and fetches your plan.
- Moved "Can I Take This?" inline above the semester tabs for quicker access.
- Removed the left sidebar — all settings now live in the Profile & Preferences modal.
- Enlarged text in semester detail views for easier reading.
- Standardized all warnings to red for clearer visibility (removed yellow warning icons).
- Completed degree buckets now show in green in the Degree Summary.
- Scaled up progress ring, KPI cards, and degree summary for the wider layout.
- Semester tab buttons auto-adapt height based on how many semesters are shown.

### Design Decisions
- 45/55 split gives recommendations more horizontal space since they contain the most detail, while progress and degree summary benefit from full vertical height.
- Merging profile and preferences into one modal reduces clicks and keeps the main viewport focused on results.
- Inline Can-I-Take above semester tabs is contextually closer to the recommendations it relates to.
- Red-only warnings are simpler to scan than mixed yellow/red severity levels.

---

## [v1.9.2] - 2026-02-25

### Changes
- Improved planner responsiveness so recommendation and eligibility requests return faster on larger plans.
- Fixed deployment packaging so Render consistently serves both backend APIs and the latest frontend build from one service.
- Added a single local run command (`python scripts/run_local.py`) that auto-builds the frontend export when needed.
- Archived older one-time migration and investigation scripts under `scripts/archive/` to keep active maintenance scripts easier to navigate.
- Removed duplicate root-level `PRD.md` and `CHANGELOG.md`; canonical product and release docs are now under `mds/`.

### Design Decisions
- Kept behavior-preserving refactors focused on runtime speed and operational reliability.
- Moved historical scripts to archive instead of permanently deleting them so prior migration history remains available.

---

## [v1.9.1] - 2026-02-25

### Changes
- Removed unused code: dead imports, orphaned constants, unused component (KpiCards), and stub functions.
- Removed unused dependencies: root Jest/jsdom devDeps, `array.prototype.flatmap` polyfill.
- Fixed stale README references to `PRD.md` and `CHANGELOG.md` (now point to `mds/`).

### Design Decisions
- Cleanup-only release. No behavior changes. All 270 backend tests pass, frontend lint and build clean.

---

## [v1.9.0] - 2026-02-24

### Changes
- **BCC progress-aware decay (5-tier system)**: `_bucket_hierarchy_tier_v2()` now accepts
  `bcc_decay_active` param. When `BCC_DECAY_ENABLED=true` (env flag, default off) and a student
  has >=12 courses applied to BCC_REQUIRED, BCC_REQUIRED demotes from Tier 1 -> Tier 4 (below
  track). Demoted BCC children (BCC_ETHICS/ANALYTICS/ENHANCE) shift from Tier 4 -> Tier 5.
  `_count_bcc_required_done()` helper computes the done count from `build_progress_output`.
- **Production hardening**: Added `GET /health` endpoint (`{"status":"ok","version":"1.9.0"}`),
  `@app.after_request` security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy),
  and manual token-bucket rate limiting on `/recommend` (10 req/min per IP, bypassed in TESTING
  mode).
- **Feedback infrastructure**: Added `POST /feedback` endpoint (validates course_code + rating,
  rank/tier integer shape, and appends JSON lines to `FEEDBACK_PATH`, default `feedback.jsonl`).
  Added `postFeedback()` to `frontend/modules/api.js`, feedback strip buttons to every
  recommendation card in `renderCard()`, and click handlers in `app.js` with session_id
  generation and double-submission guard.
- **Gold dataset + advisor match eval**: Created `eval/advisor_gold.json` (14 freshman profiles
  covering all active business majors, including BUAN as a secondary-major case). Created
  `scripts/eval_advisor_match.py` (>=4/6 overlap case pass, >=80% passing-case release gate, hard
  fail on zero-overlap profile). Added `tests/backend/test_advisor_match.py` (offline
  variant using Flask test client).
- **Regression profiles expanded**: Added `TestFinMajorJuniorBccSaturated` and
  `TestFinMajorSeniorBccFull` BCC-saturation profiles to `test_regression_profiles.py`.
- **Test suite growth**: Backend 326 -> 376 (+50), Frontend 62 -> 98 (+36).

### Design Decisions
- BCC decay behind env flag (`BCC_DECAY_ENABLED`) for safe rollout: enable only after Advisor
  Match baseline confirms >=80%.
- 5-tier instead of 4-tier: decayed BCC_REQUIRED at Tier 4 (below track Tier 3) preserves major
  course priority without disrupting existing tier semantics.
- Demoted BCC children (BCC_ETHICS etc.) promoted from Tier 4 -> Tier 5: now always below decayed
  BCC_REQUIRED, preserving relative ordering intent.
- Rate limiting uses manual token bucket (no new deps) rather than Flask-Limiter.
- Feedback uses append-only JSONL on a Render persistent disk (provision separately).

---

## [Unreleased]

### Changes
- Removed recommendation-card feedback feature end-to-end:
  - Removed feedback buttons from card rendering.
  - Removed frontend feedback wiring and API helper.
  - Removed backend `POST /feedback` endpoint and feedback file-writing logic.
  - Removed feedback backend test suite.
- **Next.js frontend (`frontend/`)**: Complete migration from vanilla JS SPA to Next.js 16 +
  TypeScript + Tailwind CSS 4 with App Router and static export.
  - 53 source files across `src/lib/`, `src/context/`, `src/hooks/`, `src/components/`, `src/app/`.
  - Dark navy theme with gold/blue accents, glassmorphic cards, atmospheric CSS orb backgrounds.
  - Routes: `/` landing, `/onboarding` 3-step wizard, `/planner` main app, `/courses`, `/saved`,
    `/ai-advisor` coming-soon pages.
  - Fonts: Sora (headings) + Plus Jakarta Sans (body) via `next/font/google`.
  - Framer Motion (via `motion/react`) for page transitions and micro-interactions.
  - React Context + useReducer for state, localStorage session persistence.
- **Planner crash fixes**: `loadCourses()` now unwraps Flask `{courses: [...]}` wrapper.
  `loadPrograms()` maps `major_id`/`track_id` to frontend `id` field. Defensive `Array.isArray`
  guard in `RESTORE_SESSION` reducer.
- **Request payload contract**: `useRecommendations` and `useCanTake` hooks now send
  `completed_courses`/`in_progress_courses` as comma-delimited strings (matching backend
  `normalize_input`). `declared_majors` omitted when empty. `track_id` only sent when a real track
  is selected (no more `FIN_MAJOR` major-as-track fallback).
- **Backend input tolerance**: Added `_coerce_course_list()` helper so `/recommend` and `/can-take`
  accept both comma-delimited strings and JSON arrays for course lists.
- **Error handling**: `postRecommend`/`postCanTake` parse backend error JSON for user-friendly
  messages. Invalid-input response now returns HTTP 400 (was 200).
- **Route hardening**: Added `/api/<path>` catch-all returning JSON 404. SPA catch-all now returns
  404 for missing static assets instead of serving `index.html`.
- **Planner 2x2 layout**: Full-viewport quad grid on desktop (>1200px) — TL: profile inputs +
  submit, TR: progress + degree summary, BL: preferences + can-take, BR: recommendations.
  Responsive: 2-col tablet, single-col mobile. New `PreferencesPanel` component extracted from
  `InputSidebar`.
- **Empty state UX**: "Pick your major to get started" card shown in recommendations quad when no
  major selected. Get Recommendations button disabled with inline hint until major is chosen.
- **Coming Soon pages**: Redesigned `PlaceholderPage` to full-viewport immersive experience with
  blurred background image, dark gradient overlay, staggered motion animations, and gold badge.
- **Performance**: Memoized `excludeSet`/`defaultMatches` in `MultiSelect`. Added stale-request
  cancellation via `useRef` counter in recommendation and can-take hooks.
- **ESLint fix**: Downgraded from ESLint 10 to 9 for `eslint-config-next` compatibility. Replaced
  broken `FlatCompat` bridge with native flat config import. Fixed `SingleSelect` lint error.
- **Cleanup**: Deleted `.xlsx.bak` backups, stray `nul` file. Updated `.gitignore` for Next.js
  build artifacts.

### Design Decisions
- Feedback controls added UI noise without improving core recommendation quality for students.
- Next.js chosen for SEO-friendly landing page, file-based routing, and static export compatibility
  with existing Flask serving.
- Dark navy theme aligns with Marquette branding while differentiating from generic light SaaS UIs.
- 2x2 planner grid maximizes information density on desktop — all four concern areas visible without
  scrolling the page.
- Backend accepts both string and array formats for course lists to be tolerant of client variations.
- Stale-request cancellation prevents race conditions when users rapidly re-submit recommendations.

---

## [v1.8.3] - 2026-02-24

### Changes
- Switched dashboard KPI logic to credit-based metrics using workbook course credits.
- Added standing classification from completed credits:
  - Freshman: 0-23
  - Sophomore: 24-59
  - Junior: 60-89
  - Senior: 90+
- Updated progress ring to use credit denominator (`124`) with completed + in-progress visualization.
- Removed low-value recommendation/progress surfaces:
  - double-counted courses section
  - courses remaining / estimated terms timeline cards
- Enforced deterministic same-family child assignment order:
  - `required` -> `choose_n` -> `credits_pool`
  - then priority
  - then lexical bucket ID tie-break
- Fixed ranking tier behavior so any course that fills `BCC_REQUIRED` is treated as Tier 1 (even when not primary bucket).
- Completed workbook integrity audit and refreshed data model docs.

### Design Decisions
- Shift KPI framing from bucket-slot counts to credit reality because students understand credits better than internal allocation counters.
- Keep same-family assignment deterministic to eliminate random routing and inconsistent `fills_buckets` interpretation.
- Remove UI sections that add cognitive load without improving course-taking decisions.
- Preserve cross-family sharing defaults while preventing same-family elective leakage.

---

## [v1.8.2] - 2026-02-24

### Changes
- Brought recommender selection behavior in line with allocator semantics.
- Applied same-family non-elective-first routing during semester packing.
- Enforced pairwise double-count policy checks during selection.
- Corrected credits-pool virtual consumption to use course credits.

### Design Decisions
- Recommendation packing and progress allocation must obey the same rules; divergence creates trust failures.
- Credits-pool logic must be credit-native end-to-end (not inferred via course count).

---

## [v1.8.1] - 2026-02-24

### Changes
- Refreshed documentation of recommender hierarchy and tie-break behavior.
- Clarified and validated cross-major elective sharing behavior.
- Normalized recommendation bucket-tag capitalization.

### Design Decisions
- Policy clarity in docs is part of product correctness for advisor-facing systems.
- Cross-major sharing should be explicit and test-backed, not implicit.

---

## [v1.8.0] - 2026-02-24

### Changes
- Fixed credits-pool runtime integrity for `needed_credits` and `requirement_mode` projection paths.
- Corrected elective pool bucket progress display (e.g., `0/0` issues on credit-based buckets).
- Consolidated decision documentation to a single canonical file.

### Design Decisions
- Preserve workbook semantics through every runtime projection path.
- Favor one canonical architecture rationale source to avoid decision drift.

---

## [v1.7.11] - 2026-02-24

### Changes
- Locked tier hierarchy:
  - Tier 1: MCC + `BCC_REQUIRED`
  - Tier 2: major buckets
  - Tier 3: selected track buckets
  - Tier 4: demoted BCC children (`BCC_ETHICS`, `BCC_ANALYTICS`, `BCC_ENHANCE`)
- Introduced dynamic elective pool synthesis from `courses.elective_pool_tag`.
- Added same-family non-elective-first routing.
- Replaced hard diversity cap with soft-cap auto-relax behavior.

### Design Decisions
- Keep foundational curriculum visible but avoid elective capture ahead of core/choose requirements in the same family.
- Model elective pools dynamically to reduce static map maintenance risk.

---

## [v1.7.10] - 2026-02-24

### Changes
- Migrated to canonical parent/child workbook model:
  - `parent_buckets`
  - `child_buckets`
  - `master_bucket_courses`
- Preserved one-release compatibility for legacy runtime loading paths.
- Added track-family-aware double-count governance.

### Design Decisions
- Keep workbook schema explicit and scalable for majors/tracks/minors.
- Use family-based defaults plus targeted overrides instead of hardcoding special cases.

---

## [v1.7.9] - 2026-02-23

### Changes
- Implemented greedy bucket-aware recommendation selection.
- Applied MCC/BCC tier parity.
- Fixed MCC label capitalization and rendering consistency.

### Design Decisions
- Avoid recommendation list collapse into a single bucket when multiple unmet buckets exist.
- Treat universal overlays consistently across MCC/BCC for student-visible fairness.

---

## [v1.6.x to v1.7.8] - 2026-02-22 to 2026-02-23

### Changes
- Completed V2 runtime/data-model migration and governance hardening.
- Added MCC universal overlay and expanded workbook integrations.
- Rolled out left-rail + 2x2 planner UI architecture and modal/selector refinements.
- Added scalable semester planning controls and recommendation caps.
- Fixed already-satisfied bucket recommendation leakage.

### Design Decisions
- Prioritize deterministic planner behavior over speculative recommendation heuristics.
- Keep public API contracts stable while evolving workbook schema and runtime internals.

---

## [v1.0.0 to v1.5.0] - 2026-02-20 to 2026-02-21

### Changes
- Established stable deterministic runtime baseline.
- Introduced policy-driven allocation and track selection behaviors.
- Improved reliability, validation, and UI workflow foundations.

### Design Decisions
- Commit to data-driven governance and modular backend/frontend boundaries early.
- Prefer incremental contract-safe refactors over one-shot rewrites.
