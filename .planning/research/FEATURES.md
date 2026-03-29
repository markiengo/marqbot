# Feature Research

**Domain:** Cinematic product homepage refresh for an existing web app
**Researched:** 2026-03-29
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full-stage opening hero | First impressions on premium product pages need a clear focal point | MEDIUM | Directly addresses the current fold-competition problem |
| Clear primary CTA | Users need an obvious path into onboarding from the hero | LOW | CTA already exists; placement and framing change more than behavior |
| Trust/proof section | Spectacle alone is not enough for a rules-based planning tool | MEDIUM | Existing `ProofSection` can be promoted back into the page |
| Responsive mobile variant | A homepage revamp that only works on desktop fails immediately | MEDIUM | Mobile should preserve the story with lighter effects |
| Reduced-effects compatibility | Motion-heavy marketing pages still need an accessibility-safe fallback | MEDIUM | MarqBot already has reduced-effects patterns to reuse |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Centered hybrid product mockup | Makes the actual planner feel like the hero object rather than a supporting screenshot | MEDIUM | Should feel alive without becoming a clickable mini-app |
| Signature unfold handoff | Turns the first scroll into a designed event instead of accidental section overlap | HIGH | Keep it to one memorable beat |
| Spotlight feature stage | Replaces the generic equal-weight benefits grid with more cinematic storytelling | MEDIUM | One dominant benefit at a time keeps hierarchy intact |
| Hero-only mouse-reactive ambient | Delivers the requested "wow" without affecting the entire page | MEDIUM | Best implemented with CSS variables, not React rerenders |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Live embedded planner in the hero | Feels interactive and impressive | Adds app complexity, invites broken states, and shifts focus from storytelling | Use a hybrid mockup with simulated interaction cues |
| Pagewide cursor tracking | Feels flashy in demos | Spreads motion noise across the whole page and raises rendering cost | Scope pointer effects to the hero only |
| Several pinned scroll scenes | Seems more cinematic on paper | Compounds jank risk and makes the page feel exhausting | Use one signature pinned/unfold moment |
| Dense atmospheric mesh of glows and blur | Looks premium in isolated mockups | Large blur/filter surfaces are expensive and quickly muddy hierarchy | Use a few localized light pools instead |

## Feature Dependencies

```text
[Centered hero stage]
    `--requires--> [Hybrid mockup shell]
                      `--requires--> [Stable hero layout and sizing]

[Signature unfold handoff]
    `--requires--> [Centered hero stage]
    `--requires--> [Spotlight feature stage]

[Proof/trust beat] --enhances--> [Spotlight feature stage]

[Heavy motion everywhere] --conflicts--> [Reduced-effects compatibility]
```

### Dependency Notes

- **Centered hero stage requires hybrid mockup shell:** The centered composition only works if the mockup is treated as the dominant object from the start.
- **Signature unfold handoff requires stable hero layout:** Scroll choreography cannot be tuned until the hero height, mockup scale, and teaser spacing are stable.
- **Signature unfold handoff requires spotlight feature stage:** The handoff needs a destination section that continues the visual language.
- **Proof/trust beat enhances spotlight feature stage:** After the wow moment, proof content turns attention into confidence.
- **Heavy motion everywhere conflicts with reduced-effects compatibility:** Motion density has to stay concentrated in major beats so fallbacks remain straightforward.

## MVP Definition

### Launch With (v1)

- [ ] Full-stage centered hero with minimal framing copy and clear CTA - fixes the main hierarchy problem
- [ ] Hybrid product mockup as the dominant visual object - keeps the page product-led
- [ ] One intentional hero-to-section-two handoff - creates the required wow moment
- [ ] Spotlight feature stage replacing the equal-weight benefits grid - strengthens the first narrative continuation
- [ ] Proof/trust section restored after the spectacle beat - reinforces credibility
- [ ] Reduced-effects and mobile-safe variants - keeps the redesign usable outside ideal desktop conditions

### Add After Validation (v1.x)

- [ ] Additional mockup states or alternate hero compositions - add if conversion testing shows the hero can carry more variation
- [ ] Finer CTA and copy experiments - add once the visual system is stable and measurable

### Future Consideration (v2+)

- [ ] Audience-aware landing variants - defer until there is enough traffic and measurement to justify segmentation
- [ ] Richer interactive demo moments - defer until performance and conversion data prove they are worth the complexity

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Full-stage hero ownership | HIGH | MEDIUM | P1 |
| Centered hybrid mockup | HIGH | MEDIUM | P1 |
| Signature unfold handoff | HIGH | HIGH | P1 |
| Spotlight feature stage | HIGH | MEDIUM | P1 |
| Proof/trust reintroduction | HIGH | MEDIUM | P1 |
| Reduced-effects fallback | HIGH | MEDIUM | P1 |
| Hero-only pointer ambient | MEDIUM | MEDIUM | P2 |
| Additional mockup states | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Opening hero | Typical SaaS split hero with static screenshot | Editorial-style campaign page with strong art direction | Product-led centered hero that still feels like MarqBot |
| Scroll spectacle | Minimal reveal-only motion | Multiple scrubbed transitions | One strong handoff beat, then calmer supporting motion |
| Trust story | Logos and generic claims | Delayed proof after visual spectacle | Bring proof back immediately after the wow moment |

## Sources

- `temp.md` - approved plan, accepted research takeaways, and final design direction
- `frontend/src/app/page.tsx` - current section order
- `frontend/src/components/landing/*.tsx` - current landing capabilities and reusable sections
- `.planning/codebase/ARCHITECTURE.md` - brownfield structure constraints

---
*Feature research for: MarqBot milestone v1.0 UI Upgrade*
*Researched: 2026-03-29*
