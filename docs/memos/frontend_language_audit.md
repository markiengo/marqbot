# Frontend Language Audit
Date: 2026-03-09

Goal: audit the frontend language system and decide how MarqBot should get funnier without getting sloppier.

## Executive summary

Yes, `branding.md` can get funnier.

No, the answer is not more slang, more chaos, or more random jokes.

The strongest existing MarqBot voice is already present in two places:

- the planner surfaces that stay clear and dry
- the quip system in `data/quips.csv`

The biggest issues are tone drift and trust drift:

- some copy is sharp, useful, and campus-aware
- some copy gets too cute during serious moments
- some copy leans too hard into founder self-deprecation
- a few lines make useful features sound less credible than they are

Recommended direction:

- keep the landing and onboarding clarity
- borrow the quips' specificity
- reduce slang and self-owning humor
- make saved-plan copy more grounded
- let jokes sit after the useful point, not instead of it

## The current voice, in one sentence

MarqBot already sounds best when it is a dry, observant upperclassman who knows the rules and is mildly tired of the system.

## What is already working

### 1. Landing copy is clear and restrained

Files:

- `frontend/src/components/landing/LandingHeroSimple.tsx`
- `frontend/src/components/landing/BenefitsSection.tsx`
- `frontend/src/components/landing/HowItWorksClear.tsx`
- `frontend/src/components/landing/ProofSection.tsx`

Why it works:

- the value prop is immediate
- jokes are attached to registration pain, not random personality
- the lines stay short
- the copy sounds student-built without sounding reckless

Best pattern in this area:

- outcome first
- mechanism second
- one dry jab at the old way

### 2. Onboarding is the strongest model for core utility copy

Files:

- `frontend/src/components/onboarding/MajorStep.tsx`
- `frontend/src/components/onboarding/CoursesStep.tsx`
- `frontend/src/components/onboarding/PreferencesStep.tsx`
- `frontend/src/components/onboarding/WizardLayout.tsx`

Why it works:

- labels are plain
- helper text is useful
- personality exists, but it does not slow the task down
- warnings stay readable

Takeaway:

If the rest of the product matched onboarding's clarity and the quips' distinctiveness, the voice would be in very good shape.

### 3. The planner's best lines are already close to the target voice

Files:

- `frontend/src/components/planner/PlannerLayout.tsx`
- `frontend/src/components/planner/RecommendationsPanel.tsx`
- `frontend/src/components/planner/ProgressModal.tsx`
- `frontend/src/components/planner/FeedbackModal.tsx`

Why it works:

- the product explains logic in plain English
- dry phrases like "Same inputs, same plan" and "Core stuff beats side quests" feel on-brand
- celebratory states have room to be more playful without breaking trust

### 4. `quips.csv` is the clearest proof of the real brand

Files:

- `data/quips.csv`
- `frontend/src/lib/quips.ts`

What the quips consistently get right:

- they are specific
- they use visuals, not filler
- they roast the process, not the student
- they are funny because they are sharp, not because they are loud
- they feel local to Marquette

## Where the tone drifts

### 1. Serious planner moments occasionally get too cute

Primary file:

- `frontend/src/components/planner/PlannerLayout.tsx`

Examples of the pattern:

- jokes in the recommendation explainer that are fine once, but start to soften serious logic
- phrases like "Oopsie" in a context that should feel academically firm

Problem:

The explainer is where students decide whether to trust the ranking logic. The humor should stay dry there, not cutesy.

Direction:

- keep the clarity
- remove any line that sounds toy-like
- make the joke about the bottleneck, not the explanation itself

### 2. About-page humor is memorable but sometimes spends trust too aggressively

Primary files:

- `frontend/src/components/about/aboutContent.ts`
- `frontend/src/components/about/AboutHero.tsx`
- `frontend/src/components/about/AboutCTA.tsx`

What works:

- it sounds like a real person
- it feels student-built
- it is the funniest surface in the app

What misses:

- "vibe-coded" dates the voice fast
- repeated self-deprecation can make the planner sound less reliable than it is
- lines like "I can't afford to pay you" are funny once, but they frame bug reporting as a joke instead of a useful feedback loop

Direction:

- keep the founder voice
- shift jokes toward the absurdity of the problem and the build process
- do fewer jokes that lower confidence in the tool itself

### 3. Saved-plan copy swings between useful and self-undermining

Primary files:

- `frontend/src/components/saved/SavedPlansLibraryPage.tsx`
- `frontend/src/components/saved/SavedPlanDetailPage.tsx`
- `frontend/src/components/saved/SavedPlanViewModal.tsx`

Biggest example:

- "Saved delusions, organized."

Problem:

That line is funny in isolation, but it breaks the product rule of roasting the system instead of the student. Saved plans are a practical feature. Calling them delusions makes the feature feel less serious than it should.

Direction:

- keep the personality
- remove jokes that frame the user's planning effort as cope
- make saved-plan copy sound grounded, useful, and a little dry

### 4. Placeholder and coming-soon copy is strong, but it can drift into "bit first, product second"

Primary files:

- `frontend/src/app/ai-advisor/page.tsx`
- `frontend/src/components/layout/PlaceholderPage.tsx`

Current effect:

- memorable
- on-brand enough
- slightly more internet-brained than the rest of the app

Direction:

- keep one sharp analogy
- make the actual utility land first

### 5. The product has multiple language systems in saved-plan surfaces

Files:

- `frontend/src/components/saved/SavedPlansLibraryPage.tsx`
- `frontend/src/components/saved/SavedPlansPage.tsx`
- `frontend/src/components/saved/SavedPlanViewModal.tsx`

Problem:

There is enough duplicated or alternate saved-plan UI in the frontend that voice drift will keep happening unless one tone guide becomes explicit and operational.

Direction:

- use the same voice rules across all saved-plan surfaces
- prefer one canonical tone guide over component-by-component improvisation

## What the quips teach us

The quips suggest a better humor model than the current branding memo.

### The good mechanics

- concrete nouns
- short sentences
- local details
- mild drama
- student competence
- system friction as the punchline

### The bad mechanics to avoid spreading everywhere

- repeated use of "energy"
- repeated use of "arc"
- repeated use of "plot"
- too many campus nouns in one flow

Conclusion:

The quips should influence the voice architecture, not become the default sentence shape for every screen.

## Surface-by-surface scorecard

| Surface | Clarity | Brand distinctiveness | Risk | Direction |
| --- | --- | --- | --- | --- |
| Landing | High | Medium-high | Low | Keep structure, add only light humor |
| Onboarding | High | Medium | Low | Use as the model for core utility copy |
| Planner shell | High | High | Medium | Tighten cute moments during serious logic |
| Feedback flow | High | Medium | Low | Keep mostly as-is |
| Saved plans | Medium-high | Medium | High | Remove self-undermining jokes |
| About | Medium | High | Medium-high | Keep voice, reduce trust-killing self-owns |
| Placeholder pages | Medium | Medium | Medium | Make utility clearer before the joke |

## Recommended voice direction

Make MarqBot funnier by making it:

- drier
- more specific
- more observational
- more campus-aware
- less slangy
- less self-deprecating

Do not make it funnier by making it:

- more chaotic
- more meme-heavy
- more self-aware in every block
- more casual in warnings and errors

## Candidate rewrites worth carrying into future copy passes

### Saved plans

Current direction:

> Saved delusions, organized.

Better direction:

> Saved plans, organized.

Funnier but still usable:

> Saved plans. Fewer tab-induced hallucinations.

### Planner explainers

Current direction:

> Oopsie. Locked means locked.

Better direction:

> Locked right now. You need [COURSE] first.

Funnier but still usable:

> Locked right now. This prereq is not bluffing.

### About page

Current direction:

> I vibe-coded and built a whole degree planner instead of doing my actual homework.

Better direction:

> I built the planner because figuring out one course ate an entire Sunday.

Funnier but still usable:

> I built the planner because one course question ate an entire Sunday and then asked for overtime.

## Research takeaways behind this recommendation

External guidance points in the same direction:

- Mailchimp's style guidance favors natural humor, but only when clarity still wins.
- Google recommends conversational, respectful language and warns against slang-heavy or overly frivolous writing when users are trying to get something done fast.
- Nielsen Norman Group's error guidance favors plain-language messages that name the issue and tell users what to do next.
- Duolingo's own writing about silly sentences is useful here: the humor works because the learning objective comes first and the weirdness makes the line memorable.

That matches what the repo already shows:

- the best MarqBot copy teaches or guides first
- the joke works best as a memory hook

## Decision

Yes, `branding.md` should get funnier.

But it should get funnier in the direction of:

- dry
- useful
- local
- specific
- academically competent

Not in the direction of:

- louder
- more online
- more self-owning
- more random

## Next logical step

After the doc rewrite, the next pass should be a targeted frontend copy cleanup in:

- saved-plan headings and empty states
- About page self-deprecating lines
- planner explainer copy where the joke density is a little high

That is where the biggest voice gains are sitting.
