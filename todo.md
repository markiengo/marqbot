## session 1 (patch 1.9.3) - UI small bug fixes 
- home screen: delete "Jump to Planner" button and enlarge get started to be wider 
- home screen: "No sign-up required · Works instantly" font size to be 40% bigger
- home screen: Get Started free -> get Started Only 
- "Whats your major screen": make the search bar closer to the question. also make the whole pane bigger. so everything (the translucent pane, the title, the fonts, the subtexts, the tick, the 1-2-3, the back and continue button, everything inside the screen) of that should occupies an extra 40% of the screen with the same alignment -> do this for all onboarding screens (major, courses, preferences)
- "what's your major screen": change "Applied Investment Management" to "AIM - Accerlerating Ingenuinty in Markets". check for search bar functionality as well. this one is also a secondary major so noted the "(requires primary)" there
- "what's your major screen": HURE Major? thats "Human Resources" - change this
- "What course have you taken" screen: same thing as mentioned, make the search bar closer to the questions
- view full progress model view after user press "view full progress" right now it's a bit too big, its occupying more than 90% of the screen. aim for less. like decrease this size by 30% while keeping the same alignment. same thing for all semesters of recommendations modal view. 

## bigger fixes (patch 1.9.4) 
- right now AIM and Finance and HR are the majors with tracks. based on the rules that i set out i'm not allowing users to select multiple tracks at the same time. so for example: if they select finance and aim as a double major pair, they should be able to select 2 tracks. for eg: financial planning and aim fintech at the same time. this goes for both backend and frontend. consider the implications of data workbook model and the recommendation system before doing anything. 
- what courses have you taken screen: i want completed courses and currently in progress courses -> they need to be searchable by both name (course title) and course codes. right it's just codes. 
- the warning for prereq checking logic: before this onboarding screen, i implemented a feature where if user input something that doesnt make sense in logic, it wont get the users recommendations. in this case, for example if i pick fina 3001 as completed and acco 1031 as in progress (it would display a warning and not return recommendation results. it's working on the planner screen but not the onboarding screen) implement the same thing there
- on preferneces screen: the button "start planning" should lead to recommendations right away. so like let it loads, and then lead to planner screen. right now it's still letting users go to planner screen, and then have to select "get recommendations" again to actually get the recs. 

## UI revamp (patch 1.9.5)
- right now the planner screen (main feature) is a 2x2 grid layout. this is inefficient and not intuitive, especially the 2 screens on the left side where users need to scroll. we will do an entire revamp. both your profile and preferences pane will now become modal view instead of a hard-coded thing on the screen. 
- right now we have the "Planning for: [major name] -> turn that into "Edit your profile here" -> that pops up the your profile pane exactly as it is right now, except that this will be a modal view exactly similar to the ones existing in "view full progress" or when you expand the semesters recommendations. that means same size (occupy the screen in the same manner). 
- what to do about the preferences pane: well after we remove the "your profile" pane, we have an empty space right? that's the preferences zone, adjust accordingly for sizing. maybe since it has more vertical space now, make it less wide so we have more space for the 2 panes on the right. the rule here is: avoid as much scrolling as possible before getting into the expanded views. 

## Inject more data & prep (patch 1.9.6)
- The goal is to prepare the codebase in a way that i can just add more courses, majors, its buckets and the thing would still work
- roll out minors 
- scope: everything inside the college of business, undergraduate
- add the ability to triple major while keeping buckets logic the same
- missing: 
    majors: Business Economics, International Business, Marketing, Real Estate, Business Administration
    minors: Business Administration, Entrepreneurship, HR, Info Systems, Marketing, Supply Chain, Professional Selling
- each of this majors and minors will come with their own sets of buckets, with potentially more courses needed to be add
- condition: with the massive amount of data incoming, the system still need to be efficienct, scalable and fast. 
- inside MCC: right now we already have foundation tier which include MCC_CORE + MCC_ESSV1, next up we will have MCC_CULM (Culminating Course), ESSV2, WRIT (writing intensive), Discovery Tiers which is a very big bucket
- because of this large data injection incoming, we need to re-examine the current system to evaluate its scalability:
- I will supply the courses and their descriptions at each stage, we will only focus on optimizing the code and prep or data injection right now. 
    - should we switch to a database .db or csv format for better data reading?
    - are there any unnecessary tests or scripts
    - if we map out the parent buckets, child buckets and the courses inside it, while stating any explicit double counting rules if needed. would the system work?

## 1.9.6 - Update on Courses Injection Issue

1. MCC_CULM, MCC_ESSV2, MCC_WRIT — These three parent buckets exist but have zero child_buckets defined at all, not just missing course mappings. All of these buckets don't have children_buckets. They just have direct course mappings onto them. 

2. Orphaned prereq codes — Several prereq strings reference courses that will not exist in courses.csv as I inject this. Problem identification: Every time I paste course descriptions directly from Marquette's website, each course will have a specific prereq that is not yet a part of courses yet. Over time, this will repeat and result in a situation where we have a lot of things inside the "Prerequisites" column that is not courses.csv. This matters because in order to recommend those courses, we need the system to recommend their prereqs first, but if the prereqs aren't formally part of the courses, it won't work or this would return unnecessary warnings. This is especially common for Discovery Tier Courses as they include high to middle level courses from across the entire university that have multiple prereqs each. 
-> Solution: Discovery Themes note as a feature of "Coming Soon" 
-> future approach: use chatgpt's agent mode to web scrape missing courses, further along the way database can become better. 
-> Wait for test pilot, scale, and official database from Marquette to proceed. 

3. These coursesdon't have their prereqs noted: although won't affect recommendations, but noted for future fix: COMM 1700, COSC 1010, MATH 1410, MATH 1451, MATH 1455, MATH 1700, MATH 2450, MATH 4720, SOCI 2060, SOCI 2060H, SPAN 3001, SPAN 3005. They were added as a temporary gap fixed between courses and prereqs. 

## patch 1.9.7: add missing courses of remaining buckets, summer recs, recommendation system check, running standing
- add ESSV2, WRIT and CULM courses. 
- each summer have maximum 4 courses takeable. u have @courses_offerings to double check their availability, if yes, recommend, if no, disgregard and not recommend. as for UI, use a on/off or yes/no button to turn on summer recommendations inside settings configurations
- running standing: we assume users take all of our course recommendations, therefore, the standing warnings should be assumed along the way. this has to affect the tier 0 - eligibility of courses when recommending. also, add a display, so when user expand a semester view, - right next to "Semester 1 - Fall 2025" for example, include a line that says "Freshman standing" -> this is determined by the courses already taken, excluding courses in progress.
"Warning: Sophomore standing required" -> checkable with user's current standing
- add a "How does Recommendations work?" inside rec pane. next to the search bar of Can I take -> to the rigth side of the screen, add an underline, yellow text: "See how Marqbot recommend courses" -> click it and it shows a modal view explaining the recommendation hierarchy. succinct, short, and students has to understand. 

## course_equivalencies (future)
- Add a new data sheet `course_equivalencies.csv` that maps OR-equivalent courses (e.g., BUAD 1560 ↔ MATH 1700 ↔ COMM 1700 ↔ SOCI 2060)
- These equivalences should ONLY apply when checking if a student has already satisfied a prereq (completed or in-progress), NOT during recommendation ranking
- This way, if a student took MATH 1700 instead of BUAD 1560, the system recognizes the prereq is met — but MATH 1700 never shows up as a recommendation
- Scope: all OR-alternatives that were stripped from `course_prereqs.csv` in v2.0.1

## pre-launch (post v2.0.2)
- extensive testing
- feedback form inside app
- configure UI from iphone perspective
- add more tests 