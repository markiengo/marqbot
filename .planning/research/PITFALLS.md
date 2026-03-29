# Pitfalls Research

**Domain:** Motion-rich homepage redesign in an existing product frontend
**Researched:** 2026-03-29
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Fold competition

**What goes wrong:**
The hero shares the first viewport with the next section, so visitors split attention before the page establishes a dominant focal point.

**Why it happens:**
Hero height, spacing, and section sequencing are tuned like a normal marketing page instead of a staged first impression.

**How to avoid:**
Make the hero occupy the opening desktop view, center the mockup, and treat the first scroll cue as an intentional design element.

**Warning signs:**
The section-two heading is visible on tall monitors before the visitor has finished processing the hero.

**Phase to address:**
Phase 1

---

### Pitfall 2: Spectacle without hierarchy

**What goes wrong:**
Too many elements animate, glow, or compete at once, so the page feels noisy instead of premium.

**Why it happens:**
Teams interpret "wow" as "animate everything" rather than building one clear focal beat and calmer supporting sections.

**How to avoid:**
Concentrate heavy motion in the hero and one signature handoff, then let lower sections use lighter reveal patterns.

**Warning signs:**
Every card has an entrance animation, hover effect, and glow change, yet the visitor still cannot tell what matters first.

**Phase to address:**
Phase 2

---

### Pitfall 3: Fake-premium effects that are too expensive

**What goes wrong:**
Large blur, filter, and stacked glow surfaces make the page stutter on common laptop hardware.

**Why it happens:**
Design choices are made from static mockups instead of from the real browser paint/composite budget.

**How to avoid:**
Prefer transform/opacity motion, opaque fake-glass panels, localized light pools, and hero-only pointer effects.

**Warning signs:**
Pointer movement repaints the whole page, scrolling a pinned scene drops frames, or the page feels much worse on a normal student laptop than on a dev machine.

**Phase to address:**
Phase 4

---

### Pitfall 4: Broken reduced-effects and mobile parity

**What goes wrong:**
The fancy desktop experience looks fine, but reduced-motion users and mobile visitors get crushed layouts or broken section logic.

**Why it happens:**
Fallbacks are added after the main scene is complete instead of being treated as part of the core design.

**How to avoid:**
Design the desktop, reduced-effects, and mobile versions as one system with shared hierarchy but lighter layers and simpler motion.

**Warning signs:**
The mockup overlaps the CTA on small screens, reduced-motion turns the page flat and confusing, or the pinned section has no clean mobile exit.

**Phase to address:**
Phase 4

---

### Pitfall 5: Trust gap after the wow moment

**What goes wrong:**
The page creates excitement but fails to explain why MarqBot's output should be trusted, so the visitor bounces before onboarding.

**Why it happens:**
Visual redesign work over-focuses on the hero and under-focuses on the proof/trust beat that has to follow it.

**How to avoid:**
Bring proof back immediately after the spectacle beat and make it feel like a continuation of the same visual system.

**Warning signs:**
The page looks impressive, but there is no strong answer to "why should I trust this planner?" until much later or not at all.

**Phase to address:**
Phase 3

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded viewport magic numbers | Quick visual tuning on one monitor | Breaks across tall screens and mobile sizes | Only during short-lived prototyping, not in final implementation |
| One-off animation timings scattered across files | Fast local experimentation | Hard-to-tune motion system with inconsistent pacing | Acceptable briefly while shaping a new scene, then consolidate |
| Decorative mockup layers without semantics review | Faster implementation | Screen readers and testing treat fake UI like real controls | Never acceptable in final markup |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Homepage CTA to onboarding | Retuning the hero but forgetting the existing onboarding route and button semantics | Preserve `Link`-based CTA flow to `/onboarding` |
| Hash/link scroll targets | Changing section flow but leaving stale anchor ids or offsets | Keep or update section ids together with navigation and teaser links |
| Global CSS | Adding hero-specific rules everywhere in `globals.css` with no grouping | Keep landing tokens and overrides grouped and named predictably |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Animating large blur/filter surfaces | Frame drops during scroll or pointer movement | Keep glows mostly static and move containers with transforms | Shows up quickly on mid-range laptops |
| React rerender on every mouse move | Pointer ambient feels laggy or sticky | Use CSS variables and refs instead of state | Breaks immediately under continuous pointer input |
| Multiple pinned scenes | Scroll feels heavy and the page gets harder to exit | Limit the page to one signature pinned/unfold moment | Breaks as soon as several active scenes stack |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Pulling third-party visual scripts for effects | Supply-chain and runtime reliability risk on the landing page | Stay inside the existing local stack for v1 |
| Treating decorative mockup controls as real inputs | Misleading affordances and accessibility issues | Mark decorative pieces appropriately and avoid fake interactive semantics |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Weak scroll cue | Visitors think the hero is the whole page or miss the designed handoff | Add a deliberate teaser at the bottom of the first stage |
| Mockup looks clickable but does nothing | Users try to interact with a fake app and get confused | Make the mockup feel alive but clearly presentational |
| Equal-weight feature cards in section two | The page feels generic and attention scatters | Use one dominant benefit with secondary supporting layers |

## "Looks Done But Isn't" Checklist

- [ ] **Hero stage:** Often missing tall-screen validation - verify section two no longer competes in the first viewport
- [ ] **Pinned handoff:** Often missing reduced-effects and mobile exits - verify both variants still tell a coherent story
- [ ] **Mockup:** Often missing decorative semantics - verify fake UI does not read like live controls
- [ ] **Proof section:** Often missing after spectacle iterations - verify trust content still lands before the lower CTA
- [ ] **Performance pass:** Often missing real-device validation - verify animation budget on common laptop hardware

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Fold competition | MEDIUM | Revisit hero height, spacing, and teaser placement before tuning lower sections |
| Spectacle without hierarchy | MEDIUM | Cut secondary motion first, then retune one primary beat and supporting reveals |
| Expensive effects | MEDIUM | Remove moving blur/filter surfaces, collapse layer count, and move effect logic to CSS variables/transforms |
| Broken mobile/reduced-effects parity | HIGH | Simplify the scene model, remove pinned behavior where necessary, and restack content for small screens |
| Trust gap | LOW | Reinsert proof/trust immediately after the handoff and align it visually with the hero system |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fold competition | Phase 1 | Hero alone owns the first desktop viewport on tall monitors |
| Spectacle without hierarchy | Phase 2 | Only one major wow beat remains; lower sections read clearly |
| Trust gap after spectacle | Phase 3 | Proof content follows the handoff and reinforces credibility |
| Expensive effects | Phase 4 | Performance pass confirms smooth motion on common hardware |
| Broken reduced-effects/mobile parity | Phase 4 | Mobile and reduced-effects paths preserve story and layout |

## Sources

- `temp.md` - accepted risks, GPU guidance, and implementation constraints
- `frontend/src/components/landing/*.tsx` - current landing implementation and likely migration points
- `frontend/src/app/globals.css` - current motion and reduced-motion guardrails
- `.planning/codebase/ARCHITECTURE.md` - brownfield integration boundaries

---
*Pitfalls research for: MarqBot milestone v1.0 UI Upgrade*
*Researched: 2026-03-29*
