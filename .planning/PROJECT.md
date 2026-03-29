# MarqBot

## What This Is

MarqBot is a planning tool for Marquette Business students. Students pick their program, add completed and in-progress courses, and get ranked guidance on what to take next using real degree logic instead of guesswork.

## Core Value

MarqBot must give students clear, trustworthy next-course guidance grounded in the actual degree rules.

## Current Milestone: v1.0 UI Upgrade

**Goal:** Upgrade the homepage UI so MarqBot's first impression matches the quality and confidence of the underlying planner.

**Target features:**
- Full-stage hero with a centered hybrid product mockup
- One intentional hero-to-section-two handoff and spotlight feature stage
- Stronger proof/trust beat plus retuned lower landing sections
- Reduced-effects, mobile, and performance-safe polish for the upgraded experience

## Requirements

### Validated

- ✓ Students can select programs, add completed and in-progress courses, and receive ranked next-course guidance - existing
- ✓ The planner already supports eligibility checking, progress tracking, multi-semester planning, saved plans, and adaptive visual effects - existing
- ✓ The homepage already markets the product and routes visitors into onboarding through reusable landing sections - existing

### Active

- [ ] Hero owns the first desktop viewport with a centered hybrid product mockup and an intentional scroll cue
- [ ] The first scroll becomes one signature handoff into a spotlight-style feature stage instead of an accidental overlap
- [ ] Proof/trust returns immediately after the spectacle beat and reinforces MarqBot's rule-based credibility
- [ ] Lower homepage sections are retuned to match the new visual system instead of reading like leftover sections
- [ ] Motion, responsiveness, and reduced-effects behavior stay within the repo's existing performance philosophy

### Out of Scope

- Backend recommendation changes - this effort is homepage-only and visual-first
- Major copy rewrite or rebrand - the user explicitly prioritized visuals over words
- Live embedded mini-app behavior inside the hero - a hybrid decorative mockup is enough for v1
- Pagewide cursor tracking or several pinned scenes - both were rejected on hierarchy and performance grounds
- Real frosted-glass `backdrop-filter` styling - the existing system already favors cheaper fake-glass treatments

## Context

- The repo is a brownfield MarqBot application with a Next.js 16, React 19, TypeScript, Tailwind 4, and `motion/react` frontend plus a Flask backend.
- The product already ships a deterministic planner experience: ranked recommendations, eligibility checks, progress tracking, saved plans, and browser-side adaptive visual effects.
- The current homepage sequence is `LandingHeroSimple`, `BenefitsSection`, `HowItWorksClear`, `LandingFinalCTA`, and `Footer`.
- The central UX problem is first-viewport hierarchy: on taller screens, the current benefits heading competes with the hero in the same opening view.
- This milestone is visual-first: centered hybrid product mockup, minimal framing copy, hero-only mouse-reactive ambient lighting, one signature unfold beat, spotlight feature stage, stronger proof/trust, and calmer lower sections.
- The approved material direction is "luminous glass" built from opaque gradients, seam lighting, and controlled glow instead of expensive live blur.
- Existing repo findings already support this approach: there is an unused `ProofSection`, there are reduced-motion and reduced-effects patterns elsewhere in the frontend, and current marketing assets are not polished enough to serve as a premium hero screenshot on their own.
- The plan must preserve MarqBot's student-built tone and Marquette-rooted visual identity rather than pivot to a new brand system.

## Constraints

- **Tech stack**: Stay within the existing Next.js, React, Tailwind, Motion, and shared-component architecture - avoid a second animation system
- **Scope**: No backend work, routing changes, or auth/persistence changes - homepage revamp only
- **Narrative**: Keep copy changes light - the redesign should win on visuals, hierarchy, and motion
- **Performance**: Favor `transform` and `opacity`, keep cursor tracking hero-only, use fake glass, and avoid animating large blur/filter surfaces
- **Accessibility**: Reduced-effects and mobile experiences must preserve the same story with fewer layers and lighter motion
- **Brownfield fit**: Reuse existing landing sections, shared primitives, and global style patterns where possible instead of inventing a one-off system

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Make the hero a full-stage centered composition | Stops the next section from competing in the opening viewport and makes the mockup the obvious focal point | - Pending |
| Use a luminous-glass material direction | Intensifies the current MarqBot look without forcing a brand pivot | - Pending |
| Use one signature pinned/unfold beat | Creates a memorable wow moment without turning the entire page into motion noise | - Pending |
| Replace the equal-weight benefits grid with a spotlight feature stage | Gives section two stronger hierarchy and a cleaner handoff from the hero | - Pending |
| Keep cursor-reactive ambient effects scoped to the hero | Delivers spectacle while staying inside the repo's performance guardrails | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after milestone initialization*
