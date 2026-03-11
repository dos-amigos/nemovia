# Phase 20: Layout & Branding - Research

**Researched:** 2026-03-11
**Domain:** CSS layout architecture, SVG branding, responsive design, Next.js 15 component patterns
**Confidence:** HIGH

## Summary

Phase 20 transforms Nemovia's visual identity with three interconnected changes: a custom SVG logo replacing the text "Nemovia" in the navbar, a professional full-width footer on every page, and a layout architecture that supports edge-to-edge sections (hero, future Netflix rows) while keeping text content readable on wide screens.

The existing codebase already uses a negative-margin breakout pattern (`-mx-4 -mt-4 sm:-mx-6 lg:-mx-8`) in three places (homepage hero, mappa page, search results map). However, Phase 21 will add 4-5 Netflix scroll rows that also need edge-to-edge treatment. Rather than multiplying breakout hacks, the correct approach is to restructure `(main)/layout.tsx` to remove the `max-w-7xl` constraint from `<main>` and push content containment into a reusable wrapper pattern. This is a small refactor with high payoff.

**Primary recommendation:** Restructure layout to "full-width by default, contain where needed," create an inline SVG logo component using the existing OKLCH coral/teal palette, and add a sticky footer with Unsplash attribution and Italian credits.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAND-01 | Full-width responsive desktop layout (hero and scroll rows edge-to-edge, content sections max-w) | Layout restructure pattern: remove max-w-7xl from main, add Container wrapper for content sections. Breakout pattern already proven in 3 places. |
| BRAND-02 | Custom SVG logo in navigation bar (Geist typography + stylized icon, coral/teal palette) | Inline React SVG component approach. Use existing OKLCH vars (--primary coral, --accent teal). Replace text link in TopNav. |
| BRAND-03 | Modern footer with credits "Fatto con cuore in Veneto" and Unsplash attribution | New Footer component in layout directory, added to (main)/layout.tsx. Consolidate Unsplash attribution from hero into footer. Full-width background, contained content. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.12 | Framework, App Router | Already in project |
| Tailwind CSS | 4.x | Utility-first styling | Already in project, CSS-only config |
| Geist | via next/font | Typography | Already loaded globally |
| Lucide React | 0.577.0 | Icons | Already in project for nav icons |
| Motion | 12.35.0 | Animations | Already in project, m.* components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cn (clsx + tailwind-merge) | existing | Class merging | Conditional styling on logo/footer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG logo component | SVGR file import | SVGR adds build config complexity; inline SVG is simpler for a single logo, gives full color control via currentColor/OKLCH vars |
| Layout restructure | More breakout hacks | Breakout hacks multiply maintenance cost; Phase 21 needs 4-5 more edge-to-edge rows |
| CSS sticky footer | JS-based footer | CSS min-h-screen + flex is the standard, zero-JS approach |

**Installation:** No new dependencies needed. Everything uses the existing stack.

## Architecture Patterns

### Current Layout Structure (before Phase 20)
```
src/app/layout.tsx           → html/body + Providers
src/app/(main)/layout.tsx    → TopNav + <main max-w-7xl> + BottomNav
  page.tsx                   → Hero breaks out with -mx-4 sm:-mx-6 lg:-mx-8
  mappa/                     → Map breaks out with same pattern
  cerca/                     → Search map breaks out
  sagra/[slug]/              → Detail hero breaks out on mobile
```

### Recommended Layout Structure (after Phase 20)
```
src/app/(main)/layout.tsx    → TopNav + <main> (NO max-w-7xl) + Footer + BottomNav
  page.tsx                   → Sections decide their own width
  mappa/                     → Full-width by default (removes breakout hack)
  cerca/                     → Wraps content in Container
  sagra/[slug]/              → Detail hero naturally full-width
```

### Pattern 1: Layout Restructure - "Full-width by default"
**What:** Remove `max-w-7xl` from `<main>` in `(main)/layout.tsx`. Add a `Container` utility for sections that need containment.
**When to use:** Whenever a layout needs both edge-to-edge and contained sections.
**Example:**
```typescript
// src/app/(main)/layout.tsx - AFTER restructure
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
```

```typescript
// Containment utility - reusable wrapper
// Can be a simple className pattern or a component
// className pattern (preferred for simplicity):
const containerClasses = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";

// OR as a component:
function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
```

### Pattern 2: Inline SVG Logo Component
**What:** A React component that renders the Nemovia logo as inline SVG using the brand's coral/teal OKLCH colors.
**When to use:** In TopNav (desktop) and optionally BottomNav or Footer.
**Example:**
```typescript
// src/components/brand/Logo.tsx
interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 140 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Nemovia"
      role="img"
    >
      {/* Stylized icon element in teal/coral */}
      {/* Geist-style wordmark */}
    </svg>
  );
}
```

**Key design decisions for the logo:**
- SVG wordmark with a small icon element (fork/spoon, map pin, or stylized "N")
- Icon uses `var(--accent)` (teal) and text uses `var(--primary)` (coral) -- or vice versa
- Viewbox sized for navbar height (h-7 to h-8, roughly 28-32px)
- `aria-label="Nemovia"` for accessibility
- `role="img"` to declare it as an image landmark

### Pattern 3: Footer Component
**What:** Full-width footer with contained content, credits, and Unsplash attribution.
**When to use:** Every page via `(main)/layout.tsx`.
**Example:**
```typescript
// src/components/layout/Footer.tsx
export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Credits and links */}
        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
          <p>Fatto con cuore in Veneto</p>
          <p className="text-xs">
            Photos by{" "}
            <a href="https://unsplash.com/?utm_source=nemovia&utm_medium=referral"
               target="_blank" rel="noopener noreferrer"
               className="underline hover:text-foreground">
              Unsplash
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
```

### Anti-Patterns to Avoid
- **Adding more negative-margin breakouts:** Each breakout needs exact matching of the parent padding. With 4-5 Netflix rows coming in Phase 21, this approach creates a fragile coupling between layout and content. Restructure instead.
- **Using CSS variables for the SVG logo colors that reference OKLCH:** SVG `fill` and `stroke` support OKLCH in modern browsers, but `var(--primary)` references work only if the SVG is inline. Do NOT use an `<img>` tag for the logo.
- **Footer as a client component:** The footer has no interactive state. Keep it as a server component for zero JS overhead.
- **Absolute positioning for footer:** Use flexbox `flex-1` on main to push footer down naturally. No sticky footer hacks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG logo icon design | Complex illustration from scratch | Simple geometric shape (circle, fork, map-pin) with 2 colors | Complex logos need a designer; geometric shapes are reproducible by code |
| Responsive container | Custom container logic with media queries | Tailwind `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` | Tailwind's responsive padding is battle-tested |
| Sticky footer | JavaScript-based scroll detection | CSS flexbox `min-h-screen flex flex-col` + `flex-1` on main | Pure CSS solution, zero JS |
| Unsplash attribution | Custom tracking/attribution system | Static link with UTM params to unsplash.com | Unsplash API guidelines require referral link, nothing more |

**Key insight:** This phase is primarily CSS/layout work with one new component (Footer) and one SVG asset (Logo). No data fetching, no API calls, no state management. Keep it simple.

## Common Pitfalls

### Pitfall 1: Breaking existing page layouts during restructure
**What goes wrong:** Removing `max-w-7xl` from `<main>` causes all pages to expand to full width, making text unreadable on wide screens.
**Why it happens:** Every page currently relies on the parent `<main>` for width constraint.
**How to avoid:** After removing from layout, immediately add containment to every page's content area. Test each page: homepage, cerca, mappa, sagra detail.
**Warning signs:** Text spanning full viewport width on desktop. Province grid stretching beyond readable width.

### Pitfall 2: Homepage hero double-negative margins
**What goes wrong:** After layout restructure, the homepage hero still has `-mx-4 -mt-4 sm:-mx-6 lg:-mx-8` but the parent no longer has padding, causing the hero to go off-screen or overlap.
**Why it happens:** The breakout hack was designed to cancel the parent's padding. With no parent padding, negative margins push content outside the viewport.
**How to avoid:** After restructuring layout, remove all breakout negative margins from homepage, mappa, search results, and detail page. They are no longer needed.
**Warning signs:** Horizontal scrollbar appearing on any page.

### Pitfall 3: Footer hidden behind BottomNav on mobile
**What goes wrong:** The mobile bottom navigation bar (fixed, h-16) covers the footer content.
**Why it happens:** `pb-20` on the outer div provides bottom padding, but the footer sits below main content and may overlap with the fixed bottom nav.
**How to avoid:** The `pb-20 lg:pb-0` already on the layout container should handle this. Move this padding to the footer or ensure the footer has its own bottom padding on mobile: `pb-20 lg:pb-0`.
**Warning signs:** On mobile, footer text cut off or hidden behind the navigation bar.

### Pitfall 4: SVG logo not scaling properly
**What goes wrong:** Logo appears too large or too small, aspect ratio distorted, or colors wrong.
**Why it happens:** SVG viewBox not matching content bounds, or using fixed width/height instead of responsive sizing.
**How to avoid:** Set viewBox on the SVG, use `className="h-7 w-auto"` for responsive scaling. Test at both mobile and desktop nav sizes.
**Warning signs:** Logo pixelated (wrong, SVGs don't pixelate -- check if it's actually an SVG), logo squished, logo colors not matching brand palette.

### Pitfall 5: TopNav glass effect breaking on full-width
**What goes wrong:** The sticky TopNav with `glass-nav` has `max-w-7xl` on its inner div but the outer nav spans full width. After restructuring, this should remain unchanged.
**Why it happens:** Confusion between the layout's content width and the nav's own width.
**How to avoid:** TopNav already handles its own width correctly -- `glass-nav` spans full width, inner `max-w-7xl` constrains content. Do not change TopNav's outer structure.
**Warning signs:** Nav background not spanning full width, or nav content not centered.

## Code Examples

### Example 1: Layout restructure diff
```typescript
// BEFORE: src/app/(main)/layout.tsx
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}

// AFTER: src/app/(main)/layout.tsx
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
```

### Example 2: Homepage page.tsx after restructure
```typescript
// BEFORE:
<div className="space-y-6">
  <div className="-mx-4 -mt-4 sm:-mx-6 lg:-mx-8">
    <HeroSection />
  </div>
  <QuickFilters />
  {/* ... bento grid ... */}
  <ProvinceSection counts={provinceCounts} />
</div>

// AFTER:
<div className="space-y-6">
  {/* Hero is naturally full-width, no breakout needed */}
  <HeroSection />

  {/* Content sections get containment */}
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <QuickFilters />
    {/* ... bento grid ... */}
    <ProvinceSection counts={provinceCounts} />
  </div>
</div>
```

### Example 3: Cerca page after restructure
```typescript
// BEFORE: All content was inside max-w-7xl from layout
// AFTER: Wrap content in container
export default async function CercaPage({ searchParams }: { ... }) {
  // ... data fetching ...
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Same content, now with explicit containment */}
    </div>
  );
}
```

### Example 4: MappaClientPage after restructure
```typescript
// BEFORE:
<div className="-mx-4 -mt-4 sm:-mx-6 lg:-mx-8 h-[calc(100vh-5rem)] lg:h-[calc(100vh-4.5rem)]">

// AFTER: No breakout needed, main has no padding
<div className="h-[calc(100vh-3.5rem)]">
  {/* Simpler height calc too, since no py-4 from parent */}
```

### Example 5: TopNav with Logo
```typescript
// BEFORE:
<Link href="/" className="text-lg font-bold text-primary">
  Nemovia
</Link>

// AFTER:
<Link href="/" className="flex items-center focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded">
  <Logo className="h-7 w-auto" />
</Link>
```

### Example 6: HeroSection after restructure
```typescript
// BEFORE:
<section className="relative mx-4 h-[280px] overflow-hidden rounded-2xl sm:h-[340px] lg:mx-6 lg:h-[400px]">

// AFTER: Full-width section, no mx needed since parent is full-width
// Keep rounded corners and horizontal margin for the visual card effect
<section className="relative mx-4 h-[280px] overflow-hidden rounded-2xl sm:mx-6 sm:h-[340px] lg:mx-8 lg:h-[400px]">
```

**Note on HeroSection:** The hero has `rounded-2xl` and `mx-4/6` which creates a "card" effect with visible background on the sides. This is a deliberate design choice from Phase 19 (user requested rounded corners). The full-width layout restructure means these margins are now relative to the viewport, not the max-w-7xl container. The visual effect is actually better -- more breathing room on wide screens.

## Pages Affected by Layout Restructure

| Page | Current Breakout | After Restructure |
|------|------------------|-------------------|
| Homepage (`page.tsx`) | Hero uses `-mx-4 -mt-4 sm:-mx-6 lg:-mx-8` | Remove breakout wrapper div; hero naturally full-width. Wrap content sections in container. |
| Mappa (`MappaClientPage.tsx`) | `-mx-4 -mt-4 sm:-mx-6 lg:-mx-8` | Remove breakout; map naturally fills width. Simplify height calc. |
| Cerca (`page.tsx`) | Search map uses `-mx-4` in SearchResults | Wrap page content in container. Fix SearchResults map to fill container. |
| Sagra Detail (`SagraDetail.tsx`) | Hero uses `-mx-4 -mt-4` on mobile | Wrap detail content in container. Mobile hero handled differently (full-width on mobile, contained on desktop). |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Negative margin breakout | Full-width layout with containment wrapper | Always been the cleaner pattern, but breakout was fine for 1-2 elements | With 4-5+ edge-to-edge sections (Phase 21), restructure is necessary |
| Text logo | SVG inline component | N/A | Brand identity, professional appearance |
| No footer | Semantic footer with credits | N/A | Professionalism, Unsplash compliance, SEO (site identity) |

**Deprecated/outdated:**
- SVGR webpack loader: Still works but unnecessary for a single logo SVG. Inline component is simpler.
- `@svgr/webpack` configuration: Not needed with Turbopack in Next.js 15. Just use an inline component.

## Open Questions

1. **Logo icon design: what shape?**
   - What we know: Must use coral/teal OKLCH palette, Geist font styling, sized for h-7/h-8 in navbar
   - What's unclear: Specific icon shape (fork/knife, map pin, stylized "N", abstract geometric)
   - Recommendation: Use a simple geometric mark -- a stylized fork or map pin -- combined with the "Nemovia" wordmark in Geist Bold. Claude can generate a clean SVG; user approves at checkpoint.

2. **Footer content beyond credits and Unsplash?**
   - What we know: Must include "Fatto con cuore in Veneto" and Unsplash attribution
   - What's unclear: Whether to include navigation links, social links, or copyright year
   - Recommendation: Keep it minimal. Credits, Unsplash link, and current year copyright. No social links (none exist). Navigation is in top/bottom nav already.

3. **Should `pb-20` move from outer div to footer?**
   - What we know: `pb-20 lg:pb-0` on the outer div creates space for the fixed mobile BottomNav
   - What's unclear: With the footer now between main and BottomNav, does the padding need adjustment?
   - Recommendation: Keep `pb-20 lg:pb-0` on the footer element itself (not the outer div), since the footer is the last visible content before the fixed BottomNav.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRAND-01 | Full-width layout restructure, content containment | manual-only | Visual inspection at 1920px and 2560px; no horizontal scrollbar | N/A |
| BRAND-02 | SVG logo renders in coral/teal, accessible | manual-only | Visual inspection + verify `aria-label` in DOM | N/A |
| BRAND-03 | Footer displays on all pages with correct text | manual-only | Visual inspection on homepage, cerca, mappa, sagra detail | N/A |

**Justification for manual-only:** All three requirements are purely visual/CSS changes with no business logic. The SVG logo is a static component, the footer is static HTML, and the layout restructure is CSS class changes. No data fetching, no state logic, no computation to unit test. Visual regression testing would require Playwright/Cypress which is out of scope.

### Sampling Rate
- **Per task commit:** Visual inspection in browser at mobile (375px), tablet (768px), desktop (1920px)
- **Per wave merge:** `npm run build` to verify no TypeScript/build errors
- **Phase gate:** All pages render correctly at 375px, 768px, 1920px, 2560px

### Wave 0 Gaps
None -- no test infrastructure needed for visual-only changes. Build verification (`npm run build`) is sufficient.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app/(main)/layout.tsx`, `src/components/layout/TopNav.tsx`, `src/components/layout/BottomNav.tsx` -- current layout architecture
- Codebase analysis: `src/app/(main)/page.tsx`, `src/app/(main)/mappa/MappaClientPage.tsx` -- existing breakout pattern
- Codebase analysis: `src/app/globals.css` -- OKLCH color palette, glass utilities
- Codebase analysis: `src/components/home/HeroSection.tsx` -- current hero with rounded corners and Unsplash attribution

### Secondary (MEDIUM confidence)
- [LogRocket SVG guide](https://blog.logrocket.com/import-svgs-next-js-apps/) -- confirmed inline SVG is preferred for single-use styled SVGs in Next.js
- [SVGVerseAI comparison](https://svgverseai.com/blog/using-svg-in-nextjs-react-inline-img-components) -- validated inline vs img vs SVGR tradeoffs
- [Next.js SVGR docs](https://react-svgr.com/docs/next/) -- confirmed SVGR is overkill for single SVG

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing tools
- Architecture: HIGH - layout restructure pattern is well-understood CSS, breakout removal proven by existing codebase evidence
- Pitfalls: HIGH - all pitfalls identified from direct codebase analysis of affected files
- Logo design: MEDIUM - technical implementation is clear, aesthetic design is subjective (user approval needed)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- CSS patterns don't change rapidly)
