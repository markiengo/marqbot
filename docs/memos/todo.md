# my to-do list

## what's happening right now
- ~~planner/browser performance cleanup: trim always-on visual work, lighten modal opens, and keep session persistence from ballooning during long planning sessions~~ done (v2.5.2 — context slices, session split, modal defer, lazy OCR, reduced always-on effects; v2.5.3 — adaptive reduced-effects mode)
- ~~full policy documentation~~ done (v2.5.4 — policies.csv, policies_buckets.csv, COBA_05/06/CRED enforcement, algorithm.md rewrite, technical_reference.md)

## high priority
- ~~work on course_equivalencies~~ done (v2.3.1)
- ~~add major guides before showing recommendations. -> bucket showdown before recs and a button to go back too~~ done (v2.5.0 — Major Guide modal + onboarding step 4)
- ~~fix warnings ambiguity -> dynamic warnings?~~ done (standing warnings now suppress dynamically)
- ~~full policy documentation~~ done (v2.5.4)
- plan out AI feature more carefully to cater to the school's picture. note: pareto analysis. let the AI do the automation work
- beth krey added an email about the updates -> check to see if this is implementable
- ~~interactive buckets?~~ done (v2.5.0 — expandable bucket cards in Major Guide)

## medium priority
- ~~feedback form inside app~~ done (planner feedback modal + backend `/api/feedback`)
- configure UI from iPhone perspective
- add a mascot? marqbot vibe

## user-feedbacks - dump it here, consider the trade-offs, and decide later
- Sam found the warnings confusing. warnings should adapt to each user, not just a general reminder for everyone.

## side-notes
- insight from chat with mark: information fragmentation is the key problem
- ~~can-take feature is dependent on course_offerings.~~ offerings disabled for now — all courses treated as offered every term.
- ~~na said: adapt đến style học / preference class of each person. basically, we will have a dynamic recommender. type 1: academic grinder - the one that takes the technical/hard classes first. type 2: 50/50. take MCC, ESSV, Discovery 50% and the other half is their major or minor classes. type 3: no technicals, just funsies and gen eds?~~ done (v2.5.0 — scheduling styles: grinder/explorer/mixer)

