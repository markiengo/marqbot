# Stack Research

**Domain:** Product-led homepage revamp in an existing Next.js application
**Researched:** 2026-03-29
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Route composition and static export delivery | The homepage already lives in the App Router and ships through the current export-and-serve pipeline |
| React | 19.2.4 | Component composition and scoped interaction | Lets the revamp stay inside the current section architecture instead of introducing a separate rendering layer |
| TypeScript | 5.9.3 | Safe refactors across landing components and tests | Keeps the redesign aligned with existing typed frontend contracts |
| Tailwind CSS | 4.2.1 | Utility styling and design-token reuse | Matches the current visual system and keeps layout iteration fast in a brownfield frontend |
| Motion | 12.34.3 | Entrance choreography, staged scroll motion, and hover transitions | Already present in the repo, good enough for a single cinematic landing flow without adding a second animation stack |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `motion/react` | 12.34.3 | Section-level reveals and staged timeline transitions | Use for major section choreography, hero handoff, and restrained hover motion |
| Native CSS custom properties | Browser native | Pointer-reactive lighting and effect tuning | Use for hero-only ambient effects so pointer movement avoids React rerenders |
| Next `Link` | Framework native | CTA routing to onboarding and hash navigation | Keep CTA and scroll targets inside the current app/router conventions |
| Testing Library + Vitest | 3.2.4 and current Testing Library set | Homepage structure and fallback verification | Use for section-order, semantics, and reduced-effects shell tests |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Chrome DevTools Performance | Verify animation smoothness and paint/composite cost | Required for validating the pinned beat and cursor-reactive hero budget |
| Vitest | Frontend verification | Extend current homepage/effects tests instead of inventing a new test runner |
| ESLint with Next core web vitals | Guardrail for frontend changes | Keeps landing refactors inside current linting expectations |

## Installation

```bash
# No new packages are recommended for v1.
# Use the existing frontend stack already declared in frontend/package.json.

npm --prefix frontend install
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `motion/react` | GSAP ScrollTrigger | Use GSAP only if the homepage later requires complex scrubbed timelines that Motion cannot express cleanly |
| Tailwind + shared global CSS | A new isolated styling system | Only worth it if the project intentionally creates a separate marketing microsite |
| Hybrid decorative mockup | Live embedded planner mini-app | Use a live embed only if later conversion research proves a demo is worth the added complexity and performance cost |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Heavy `backdrop-filter` glass | Expensive for a page that already wants glow, motion, and layered panels | Opaque fake-glass panels with gradients and seam lighting |
| Pagewide pointer tracking through React state | Triggers unnecessary rerenders and spreads spectacle everywhere | Hero-only CSS-variable lighting updated with `requestAnimationFrame` |
| WebGL or Three.js hero experiments | Overshoots the scope and adds a second rendering model for a mostly typographic/product page | DOM/CSS/motion composition inside the existing frontend stack |

## Stack Patterns by Variant

**If the scene is decorative and repeatable:**
- Use layered DOM panels, gradients, and Motion transforms
- Because the repo already supports this pattern and it degrades cleanly on weak devices

**If a motion effect needs continuous pointer input:**
- Use CSS variables and a lightweight listener outside React render state
- Because React state per mousemove is the fastest route to jank

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.1.6` | `react@19.2.4` | Current repo pairing; keep landing work inside existing React 19 patterns |
| `tailwindcss@4.2.1` | `postcss@8.5.6` | Current styling pipeline; no migration work needed for this project |
| `motion@12.34.3` | `react@19.2.4` | Existing animation dependency already used across the frontend |

## Sources

- `temp.md` - approved homepage plan and prior UX/performance synthesis
- `.planning/codebase/STACK.md` - verified repo stack and build/runtime details
- `.planning/codebase/ARCHITECTURE.md` - verified frontend/backend boundaries
- `frontend/src/app/page.tsx` - current landing composition
- `frontend/src/components/landing/*.tsx` - current landing implementation patterns

---
*Stack research for: MarqBot milestone v1.0 UI Upgrade*
*Researched: 2026-03-29*
