# Project Research Summary

**Project:** MarqBot (milestone: v1.0 UI Upgrade)
**Domain:** Product-led homepage redesign in an existing web app
**Researched:** 2026-03-29
**Confidence:** MEDIUM

## Executive Summary

This project is not a greenfield marketing build. It is a brownfield homepage overhaul inside an existing MarqBot application that already has a solid visual language, landing-section primitives, and reduced-effects philosophy. The highest-leverage change is not adding more content. It is rebuilding the first-screen hierarchy so the hero owns the opening viewport, then turning the first scroll into an intentional handoff instead of an accidental overlap.

The recommended approach is to stay inside the current frontend stack, keep the page product-led, and concentrate spectacle in one signature hero-to-section-two transition. The winning shape is a centered hybrid mockup, luminous fake-glass materials, a spotlight feature stage, and an early proof/trust beat. The main risk is overbuilding effects that look premium in a mockup but perform poorly or create motion noise in the real browser.

## Key Findings

### Recommended Stack

The current stack is already good enough for this revamp. Next.js, React, TypeScript, Tailwind, and Motion cover the layout, motion, and testing needs without introducing a second animation framework. The main stack decision is restraint: use the existing tools more intentionally rather than adding more tools.

**Core technologies:**
- Next.js: route shell and static delivery - already owns the homepage
- Motion: staged section motion and hero choreography - enough for one major cinematic beat
- CSS custom properties: pointer-driven ambience and effect tuning - best way to keep hero input cheap
- Vitest and Testing Library: homepage verification - use for structure and fallback checks

### Expected Features

The homepage needs five table-stakes behaviors for launch: a full-stage hero, clear CTA, proof/trust, responsive mobile handling, and reduced-effects support. The real differentiators are the centered hybrid mockup, one signature unfold handoff, spotlight-style feature storytelling, and scoped hero-only ambient effects.

**Must have (table stakes):**
- Full-stage opening hero - users need one obvious focal point immediately
- Clear onboarding CTA - the landing page still needs to convert
- Proof/trust section - critical for a rules-based planner
- Responsive mobile flow - the story has to survive beyond desktop
- Reduced-effects compatibility - motion-heavy does not excuse inaccessible

**Should have (competitive):**
- Centered hybrid mockup - makes the product the star
- Signature unfold handoff - turns the first scroll into a designed event
- Spotlight feature stage - gives section two stronger hierarchy
- Hero-only pointer ambience - delivers requested wow without whole-page noise

**Defer (v2+):**
- Audience-specific landing variants - not needed before the base story is working
- Richer interactive demo states - valuable later if conversion data justifies them

### Architecture Approach

Keep the route shell simple, keep the revamp inside `frontend/src/components/landing`, and use `globals.css` plus shared primitives for the effect system. The home route should compose scene-level sections while section-owned motion handles the hero, spotlight handoff, proof, and lower close. Localized CSS-variable effects are the right fit for the hero; global animation orchestration is unnecessary.

**Major components:**
1. Hero stage - first viewport ownership, centered mockup, CTA, teaser
2. Scroll handoff + spotlight stage - the single cinematic beat and section-two narrative
3. Proof + lower-story sections - trust, how-it-works harmony, and clean close
4. Effect/fallback shell - reduced-effects, mobile simplification, and performance guardrails

### Critical Pitfalls

1. **Fold competition** - solve by making the hero a complete first-screen stage
2. **Spectacle without hierarchy** - keep one memorable beat, not motion everywhere
3. **Expensive fake-premium effects** - avoid moving blur/filter surfaces and pagewide pointer work
4. **Broken reduced-effects/mobile parity** - design the fallback paths as part of the main system
5. **Trust gap after wow** - restore proof immediately after the spectacle beat

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Hero Stage Foundation
**Rationale:** The core problem starts in the first viewport, so hero ownership and visual direction have to land first.
**Delivers:** Full-stage hero, centered mockup, CTA framing, and the new visual shell
**Addresses:** Hero hierarchy and brand-fit requirements
**Avoids:** Fold competition

### Phase 2: Signature Scroll and Spotlight Stage
**Rationale:** The hero handoff only works after hero sizing and composition are stable.
**Delivers:** One intentional unfold beat and a spotlight replacement for the benefits grid
**Uses:** Motion plus CSS transforms inside the existing landing architecture
**Implements:** The major narrative continuation after the hero

### Phase 3: Proof and Narrative Harmony
**Rationale:** Once the spectacle beat exists, the page needs to convert that attention into trust and a coherent lower-story rhythm.
**Delivers:** Reintroduced proof/trust plus harmonized lower homepage sections

### Phase 4: Performance, Fallbacks, and Verification
**Rationale:** Performance and fallback quality should close the project so the visual system is validated under real constraints.
**Delivers:** Reduced-effects/mobile hardening, homepage verification, and performance tuning

### Phase Ordering Rationale

- Hero ownership must come before scroll choreography because the handoff depends on stable stage sizing.
- Spotlight storytelling must come before lower-section restyling because it defines the page's new visual center of gravity.
- Proof comes after spectacle so the visitor gets an immediate answer to "why trust this?"
- Performance and fallback validation close the work so the visual system is tuned against real devices, not only design intent.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Scroll choreography details and implementation shape may need focused motion validation once concrete section designs exist
- **Phase 4:** Performance validation should use browser profiling on real hardware, not only local intuition

Phases with standard patterns (skip research-phase):
- **Phase 1:** Brownfield hero layout, mockup composition, and section recomposition follow established frontend patterns in this repo
- **Phase 3:** Proof-section reintegration and section harmonization are straightforward composition/design tasks

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified directly from repo and codebase map |
| Features | MEDIUM | Backed by the approved brief and repo inspection, but still a design bet until implemented |
| Architecture | HIGH | Brownfield boundaries are clear and local to the frontend landing surface |
| Pitfalls | MEDIUM | Strongly supported by the approved planning brief and current code shape |

**Overall confidence:** MEDIUM

### Gaps to Address

- Exact Phase 2 motion implementation - choose the simplest choreography that still delivers the approved wow moment
- Final mobile/pinned-scene simplification - validate once the hero and spotlight stage are visually stable
- Homepage verification scope - confirm which existing frontend tests should be extended versus newly added

## Sources

### Primary (HIGH confidence)
- `temp.md` - approved homepage brief, research synthesis, and implementation direction
- `.planning/codebase/STACK.md` - verified stack and runtime/build constraints
- `.planning/codebase/ARCHITECTURE.md` - verified brownfield architecture and integration boundaries
- `frontend/src/app/page.tsx` - current landing composition
- `frontend/src/components/landing/*.tsx` - current landing implementation surface

### Secondary (MEDIUM confidence)
- `frontend/src/app/globals.css` - motion and fallback patterns already present in the frontend

### Tertiary (LOW confidence)
- None added in this pass

---
*Research completed: 2026-03-29*
*Ready for roadmap: yes*
