# Phase 01 Research: Landing Page Redesign

**Phase:** 1
**Phase dir:** `.planning/phases/01-landing-page-redesign`
**Created:** 2026-03-29
**Confidence:** Medium-high

## Planning Basis

This phase does not have a dedicated `01-CONTEXT.md` or `01-UI-SPEC.md`. Planning should treat the existing milestone docs as the locked direction:

- `.planning/PROJECT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/research/SUMMARY.md`

The phase is brownfield. It must upgrade the existing landing experience inside the current MarqBot frontend without turning the work into a rebrand, a copy rewrite, or a new animation system.

## Confirmed Code Surface

The current homepage is composed from these files:

- `frontend/src/app/page.tsx`
- `frontend/src/components/landing/LandingHeroSimple.tsx`
- `frontend/src/components/landing/BenefitsSection.tsx`
- `frontend/src/components/landing/ProofSection.tsx` (exists but is not mounted)
- `frontend/src/components/landing/HowItWorksClear.tsx`
- `frontend/src/components/landing/LandingFinalCTA.tsx`
- `frontend/src/app/globals.css`

Shared primitives already available and worth reusing:

- `frontend/src/components/shared/Button.tsx`
- `frontend/src/components/shared/AnchorLine.tsx`

Frontend validation commands already available:

- `npm --prefix frontend run lint`
- `npm --prefix frontend run test`
- `npm --prefix frontend run build`

## What The Phase Must Actually Deliver

Phase 1 succeeds only if the final landing flow becomes:

1. Hero owns the first desktop viewport.
2. A centered product mockup is the visual focal point.
3. The first scroll becomes a deliberate handoff into section two.
4. Section two becomes a spotlight stage, not three equal cards.
5. Proof/trust returns immediately after the spectacle beat.
6. How-it-works and the final CTA feel like the same visual system.
7. Reduced-effects, mobile sizing, lint, tests, and build all hold up.

## Recommended File Strategy

### Hero foundation

Primary files:

- `frontend/src/components/landing/LandingHeroSimple.tsx`
- `frontend/src/app/globals.css`

Why:

- The main hierarchy problem starts here.
- `globals.css` already has the band, anchor, glow, and reduced-motion utilities needed for the hero shell.

### Spotlight handoff

Primary files:

- `frontend/src/components/landing/BenefitsSection.tsx`
- `frontend/src/app/globals.css`

Why:

- `BenefitsSection.tsx` is the current section-two slot.
- Reworking this file in place is lower risk than inventing a second route-level composition layer.

### Proof and lower-story fit

Primary files:

- `frontend/src/app/page.tsx`
- `frontend/src/components/landing/ProofSection.tsx`
- `frontend/src/components/landing/HowItWorksClear.tsx`
- `frontend/src/components/landing/LandingFinalCTA.tsx`

Why:

- `ProofSection.tsx` already exists and should be reintroduced instead of replaced.
- The lower sections are visually behind the planned hero and spotlight work, but the structure is already present.

### Hardening and verification

Primary files:

- `frontend/src/hooks/useReducedEffects.ts` (new helper recommended)
- `frontend/src/components/landing/LandingHeroSimple.tsx`
- `frontend/src/components/landing/BenefitsSection.tsx`
- `frontend/src/components/landing/ProofSection.tsx`
- `frontend/src/app/globals.css`
- `frontend/tests/landingPage.dom.test.tsx` (new)
- `frontend/tests/effectsMode.test.ts`

Why:

- The phase has explicit reduced-effects and mobile requirements.
- Existing test coverage does not currently protect the homepage.

## Recommended Plan Split

### 01-01 Hero stage and centered mockup

Build the opening scene first. This is the lowest-risk way to remove fold competition and establish the visual system that later sections should inherit.

### 01-02 Handoff and spotlight stage

Rework `BenefitsSection.tsx` into the single signature continuation beat. Keep the implementation light enough to preserve performance: one sticky spotlight stage is acceptable, multiple pinned scenes are not.

### 01-03 Proof and lower-section retune

Reinsert `ProofSection.tsx` directly after the spotlight stage and retune the remaining landing sections so they stop reading like older holdovers.

### 01-04 Fallbacks, tests, and performance

Only after the visual story is in place should the phase lock down reduced-effects, mobile clamps, homepage tests, and final lint/build verification.

## Motion And Performance Guardrails

Non-negotiable constraints for downstream plans:

- Use `motion/react`; do not add another animation framework.
- Keep dramatic motion concentrated in the hero and section-two handoff.
- Use `transform` and `opacity` for movement whenever possible.
- Do not introduce `backdrop-filter`-heavy glass.
- Keep pointer-reactive or ambient effects hero-only.
- Mobile should simplify layers and disable sticky or pinned behavior.
- Reduced-effects and reduced-motion cannot be an afterthought; they need an explicit escape path in markup and CSS.

## Brand And Narrative Guardrails

- Stay inside the existing MarqBot navy, gold, and blue palette.
- Keep the tone student-built and direct, not enterprise-polished.
- Keep copy changes light; the redesign should win on hierarchy, composition, and motion more than on rewritten marketing text.
- Trust must land immediately after the spectacle beat. Do not bury proof near the footer.

## Test Strategy

At minimum, this phase should end with:

- `npm --prefix frontend run lint`
- `npm --prefix frontend run test -- landingPage.dom.test.tsx effectsMode.test.ts`
- `npm --prefix frontend run build`

Targeted test coverage should include:

- Homepage section order and critical CTAs
- Reduced-effects or reduced-motion fallback behavior for the landing scene
- Stable hero and spotlight markup under mobile or simplified rendering paths

## Main Risks

1. The hero can still feel split-screen if the mockup is not clearly larger than the copy block.
2. The spotlight stage can turn into motion noise if every card moves equally.
3. Proof can still feel delayed if `ProofSection` is not placed immediately after section two.
4. Mobile can break quickly if the mockup width and CTA row are not explicitly clamped.
5. Reduced-effects can become fake compliance if CSS disables animation but markup still depends on motion to explain the hierarchy.

## Planning Conclusion

The best execution path is four plans:

- hero foundation
- spotlight handoff
- proof plus lower-section fit
- hardening plus verification

That split matches the roadmap, keeps file ownership understandable, and preserves a clean final verification pass.
