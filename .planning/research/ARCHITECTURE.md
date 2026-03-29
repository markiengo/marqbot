# Architecture Research

**Domain:** Homepage revamp inside an existing Next.js product application
**Researched:** 2026-03-29
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Route Composition                      │
├─────────────────────────────────────────────────────────────┤
│  frontend/src/app/page.tsx                                 │
│      |                                                      │
│      +--> Hero stage                                        │
│      +--> Spotlight / proof / story sections                │
│      +--> CTA + footer                                      │
├─────────────────────────────────────────────────────────────┤
│                    Landing Components                       │
├─────────────────────────────────────────────────────────────┤
│  frontend/src/components/landing/                           │
│      |                                                      │
│      +--> Scene-level sections                              │
│      +--> Mockup/support panels                             │
│      +--> Motion wrappers                                   │
├─────────────────────────────────────────────────────────────┤
│                 Shared Styling + Guardrails                 │
├─────────────────────────────────────────────────────────────┤
│  frontend/src/app/globals.css                               │
│  frontend/src/components/shared/*                           │
│  prefers-reduced-motion / reduced-effects patterns          │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Route shell | Define homepage section order and high-level composition | `frontend/src/app/page.tsx` imports landing sections and keeps the route simple |
| Hero stage | Own the first viewport, mockup, CTA, and opening effects | One landing component plus small subcomponents for mockup layers and cues |
| Scroll handoff + spotlight stage | Carry the signature transition and section-two storytelling | Section-owned motion wrappers with local state or scroll hooks only where necessary |
| Proof and closing sections | Rebuild trust and finish the page cleanly | Reuse existing section primitives and shared CTA components |
| Global effect layer | Hold tokens, gradients, motion guards, and reduced-effects CSS | `frontend/src/app/globals.css` plus narrow utility classes rather than one-off inline hacks everywhere |

## Recommended Project Structure

```text
frontend/
`-- src/
    |-- app/
    |   |-- page.tsx              # Landing section composition
    |   `-- globals.css           # Shared landing tokens, motion guards, effect vars
    |-- components/
    |   |-- landing/              # Hero, spotlight, proof, how-it-works, CTA sections
    |   `-- shared/               # Button, anchor line, and reusable visual primitives
    `-- tests/                    # Homepage structure and fallback verification
```

### Structure Rationale

- **`frontend/src/components/landing/`:** Keep the revamp scoped to the existing marketing-section folder rather than creating a parallel microsite architecture.
- **`frontend/src/app/globals.css`:** Centralize reusable gradients, light-pool tokens, reduced-motion overrides, and any CSS-variable-driven hero effects.
- **`frontend/tests/`:** Verify section order, semantics, and reduced-effects behavior near existing frontend tests.

## Architectural Patterns

### Pattern 1: Section-owned motion

**What:** Each major section owns its own reveal and choreography instead of driving the whole page from one global animation manager.
**When to use:** For the hero, spotlight stage, proof section, and CTA transitions.
**Trade-offs:** Easier to maintain and disable per section, but requires discipline so timings still feel like one system.

**Example:**
```typescript
const inView = useInView(ref, { once: true, margin: "-80px" });
<motion.section animate={inView ? { opacity: 1, y: 0 } : {}} />
```

### Pattern 2: CSS-variable pointer ambience

**What:** Pointer input updates CSS variables that drive localized lighting or gradients.
**When to use:** Hero-only mouse-reactive ambient effects.
**Trade-offs:** More setup than basic hover states, but much cheaper than pushing pointer state through React on every event.

**Example:**
```typescript
element.style.setProperty("--pointer-x", `${x}px`);
element.style.setProperty("--pointer-y", `${y}px`);
```

### Pattern 3: Presentational mockup composition

**What:** Build the hero object from styled DOM layers, chips, and cards that look interactive without being interactive.
**When to use:** Whenever the page needs product-led spectacle without live app state.
**Trade-offs:** Needs careful semantics so decorative elements do not look clickable, but keeps the landing page reliable and fast.

## Data Flow

### Request Flow

```text
[Visitor loads /]
    |
[LandingPage route]
    |
[Hero / spotlight / proof sections]
    |
[CTA link or hash navigation]
    |
[/onboarding or lower page sections]
```

### State Management

```text
[Local section state]
    |
[Motion triggers / CSS vars]
    |
[Rendered landing sections]
```

### Key Data Flows

1. **Hero composition flow:** route shell renders the hero stage, which exposes CTA links and decorative motion layers without pulling from backend data.
2. **Scroll choreography flow:** hero sizing and section-two structure feed the handoff animation, which then settles into proof and lower-page sections.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current marketing traffic | Static sections and localized motion are enough; optimize for GPU cost, not backend throughput |
| Higher traffic with performance variance | Add stronger effect downgrades and real-user telemetry before adding more spectacle |
| Multiple landing variants | Split scene variants by component props or route-level experiments, not by duplicating the whole section architecture |

### Scaling Priorities

1. **First bottleneck:** Browser paint/composite cost from glows, blur, and pinned motion - fix by reducing active layers and keeping transforms cheap.
2. **Second bottleneck:** Maintenance complexity from scattered hero-specific styling - fix by centralizing effect tokens and naming patterns in landing components plus `globals.css`.

## Anti-Patterns

### Anti-Pattern 1: React state on every mousemove

**What people do:** Store pointer coordinates in component state and rerender the hero every frame.
**Why it's wrong:** It spends render budget on decorative updates and creates jank exactly where the page needs polish.
**Do this instead:** Update CSS variables or refs inside a throttled `requestAnimationFrame` loop.

### Anti-Pattern 2: Coupling the landing revamp to backend or planner data

**What people do:** Pull live planner state into the hero to make it feel "real."
**Why it's wrong:** It expands scope from marketing redesign into product integration and adds failure modes to the first impression.
**Do this instead:** Keep the hero mockup presentational for v1 and link clearly into onboarding.

### Anti-Pattern 3: Introducing a second animation system

**What people do:** Keep Motion for most components but add GSAP or custom scroll libraries for the wow scenes.
**Why it's wrong:** It splits motion conventions, increases bundle/maintenance cost, and makes fallback behavior harder.
**Do this instead:** Stay inside Motion plus CSS unless a later phase proves the current stack cannot support the required choreography.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None required | N/A | This project is presentational and should not introduce new external runtime dependencies |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `page.tsx` <-> landing sections | Direct composition | Keep route order readable and avoid burying section flow in a config layer |
| Landing sections <-> shared primitives | Props and class composition | Reuse `Button`, `AnchorLine`, and existing utility styles |
| Landing sections <-> `globals.css` | Class names and CSS variables | Best place for effect tokens, reduced-motion overrides, and shared gradients |

## Sources

- `.planning/codebase/ARCHITECTURE.md` - verified brownfield architecture
- `.planning/codebase/STACK.md` - verified frontend stack
- `frontend/src/app/page.tsx` - current route composition
- `frontend/src/components/landing/*.tsx` - current landing-section boundaries and shared patterns
- `temp.md` - approved design direction and performance constraints

---
*Architecture research for: MarqBot milestone v1.0 UI Upgrade*
*Researched: 2026-03-29*
