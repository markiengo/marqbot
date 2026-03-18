# my to-do list

## what's happening right now


## high priority
- ~~work on course_equivalencies~~ done (v2.3.1)
- add major guides before showing recommendations. -> bucket showdown before recs and a button to go back too
- ~~fix warnings ambiguity -> dynamic warnings?~~ done (standing warnings now suppress dynamically)
- full policy documentation
- plan out AI feature more carefully to cater to the school's picture. note: pareto analysis. let the AI do the automation work
- beth krey added an email about the updates -> check to see if this is implementable 
- interactive buckets?

## medium priority
- feedback form inside app
- ~~work on the "upload PDF / upload screenshot" feature~~ done (v2.4.5 — browser-only OCR via tesseract.js)
- configure UI from iPhone perspective
- ~~more intuitive UI with tutorials~~ done (v2.4.7 — modal tutorial for screenshot import, vertical step indicator)
- add a mascot? marqbot vibe

## user-feedbacks - dump it here, consider the trade-offs, and decide later
- Sam found the warnings confusing. warnings should adapt to each user, not just a general reminder for everyone.

## known issues

### REAP track dead-end (xfail'd)
The REAL REAP track has a 3-course sequential chain: REAL 4210 → REAL 4220 → REAL 4230. Each course requires the previous one as a prereq, so they must be taken across 3 separate semesters. On top of that, the student needs to complete FINA 3001, REAL 3001, and FINA 4002 or REAL 4002 before even starting 4210. With `include_summer=False`, the mid/late test variants run out of semesters before finishing the chain. This is a real constraint of the REAP program — students in REAP would realistically include summer. The fast dead-end tests for `combo-REAL+REAP/mid` and `combo-REAL+REAP/late` are xfail'd with this explanation. Fix options: enable summer in those test cases, or accept as inherent to the track.

## side-notes
- insight from chat with mark: information fragmentation is the key problem
- ~~can-take feature is dependent on course_offerings.~~ offerings disabled for now — all courses treated as offered every term.

