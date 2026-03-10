# Phase 17: Visual Effects, Layout & Performance - Research

**Researched:** 2026-03-10
**Domain:** CSS visual effects (glassmorphism, mesh gradients, bento grid), component redesign, Motion bundle optimization
**Confidence:** HIGH

## Summary

Phase 17 delivers the WOW-factor visual experience across five workstreams: glassmorphism navigation, mesh gradient backgrounds, bento grid homepage, SagraCard image-overlay redesign, and LazyMotion bundle optimization. All work layers on the coral/teal OKLCH palette established in Phase 16.

The entire phase is CSS-heavy with one significant JS migration (LazyMotion). Glassmorphism and mesh gradients are pure CSS -- zero new JS dependencies. The bento grid is a CSS Grid layout restructure of the homepage. The SagraCard redesign replaces the current top-image/bottom-content layout with a full-bleed image overlay design. LazyMotion is a mechanical migration of 12 files from `motion` to `m` components, with one critical caveat: BottomNav uses `layoutId` which requires `domMax` (not `domAnimation`).

**Primary recommendation:** Split into 3 plans: (1) Glassmorphism + Mesh Gradients (pure CSS, no component logic changes), (2) Bento Grid + SagraCard Redesign (layout + component restructure), (3) LazyMotion Migration (mechanical JS refactor with bundle verification).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Glassmorphism: 8-12px backdrop-blur, 80-90% opacity, thin 1px border white/10-20%, neutral cool gray tint
- Scope: TopNav + BottomNav get full glass treatment, plus floating overlays. SagraCards stay solid
- Performance: blur <=12px, max 2-3 blur surfaces per viewport on mobile (UI-11)
- Bento Grid: Full-width hero at top, featured card 2-cols wide ~300px+, province quick filters as horizontal row
- Mobile: single column stack. Desktop: CSS Grid with named areas, asymmetric editorial layout
- Rounded cells 12-16px gap, rounded corners, subtle shadow
- SagraCard: Image overlay layout -- title/date/location overlay on image with dark gradient
- Image takes full card height. No-image cards keep branded placeholder gradient with utensil icon
- Featured card is bigger version of same overlay design (300px+, possible subtle parallax)
- Food tags and price visible on detail page only (not on overlay)
- Mesh Gradients: Static CSS radial gradient layers, no animation, zero JS cost
- Color palette: coral (primary) + teal (accent) radial blobs on cool gray base
- Intensity: 15-25% opacity -- visible gradient blobs, not faint wash
- Scope: homepage hero + search/map page backgrounds
- LazyMotion: ~34KB to ~5KB target, no animation regressions

### Claude's Discretion
- Exact blur/opacity values within the specified ranges
- CSS Grid template specifics (column/row definitions, area names)
- Dark gradient overlay intensity on image cards (enough for text readability)
- Mesh gradient blob positioning and radial-gradient() layering
- LazyMotion migration approach (which features to lazy-load)

### Deferred Ideas (OUT OF SCOPE)
- Map filtering UI (filter-driven map view) -- belongs in its own phase
- Sagre in Toscana -- data quality issue, separate from visual redesign
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-05 | Glassmorphism on TopNav and BottomNav (backdrop-blur, semi-transparent bg, glass borders) | Glassmorphism CSS pattern: `backdrop-filter: blur(10px)` + `bg-background/85` + `border border-white/15`. TopNav already has `backdrop-blur` and `bg-background/95` -- needs border + opacity tuning. BottomNav needs full glass treatment. |
| UI-06 | Glassmorphism on overlays (max 2-3 blur surfaces per viewport on mobile) | MapFilterOverlay, LocationButton, BackButton already use `backdrop-blur` -- need consistent glass treatment with border. Per CONTEXT: cards stay solid, only floating overlays get glass. |
| UI-07 | Mesh gradients on hero section and page backgrounds for visual depth | Pure CSS layered `radial-gradient()` technique using OKLCH primary/accent colors at 15-25% opacity. Zero JS, zero new dependencies. |
| UI-08 | Key components (SagraCard, Hero, pages) redesigned with modern aesthetic | SagraCard: image-overlay layout with dark gradient for text readability. Hero: mesh gradient background + larger typography. Both redesigns are structural HTML/CSS changes. |
| UI-09 | Homepage bento grid layout (responsive CSS Grid) | CSS Grid with `grid-template-areas` for editorial layout. Featured card spans 2 cols. Mobile stacks to single column. Uses `gap-3 md:gap-4` (12-16px). |
| UI-10 | LazyMotion migration (34KB to ~5KB initial bundle) | Replace `motion` with `m` from `motion/react-m`, wrap app in `LazyMotion`. Critical: BottomNav uses `layoutId` requiring `domMax` (~25KB loaded async) not `domAnimation` (~15KB). Use async feature loading to keep initial bundle minimal. |
| UI-11 | Glassmorphism mobile performance verified (blur <=12px, no jank) | Max `blur(12px)`, limit 2-3 blur surfaces per viewport, add `will-change: backdrop-filter` for GPU hints on nav elements, avoid nesting blur elements. |
</phase_requirements>

## Standard Stack

### Core (already installed, no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4 | Utility-first CSS, all glassmorphism/gradient/grid classes | Already in project, Tailwind v4 with `@import "tailwindcss"` |
| motion | ^12.35.0 | Animation library with LazyMotion for bundle splitting | Already installed, provides `m` + `LazyMotion` + `domMax` |
| next | 15.5.12 | Framework, `next/image` for card images | Already in project |
| shadcn | ^3.8.5 | UI primitives (Card, Badge) | Already in project |

### Supporting (no new installs needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Icons (UtensilsCrossed for placeholders) | Already used in SagraCard |
| clsx + tailwind-merge | latest | `cn()` utility for conditional classes | Already established pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS radial-gradient mesh | SVG mesh gradient | SVG adds complexity and file size; CSS is zero-cost, hardware-accelerated |
| CSS backdrop-filter glass | Pre-blurred background image | Pre-blurred images are less flexible, need per-page variants, lose dynamic content blur |
| LazyMotion domMax async | domAnimation sync | domAnimation lacks `layoutId` support needed by BottomNav; domMax async preserves small initial bundle |

**Installation:**
```bash
# No new packages needed -- all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    layout/
      TopNav.tsx          # Glass treatment (modify existing)
      BottomNav.tsx        # Glass treatment + m migration (modify existing)
    home/
      HeroSection.tsx      # Mesh gradient + redesign (modify existing)
      BentoGrid.tsx        # NEW: bento grid wrapper component
      FeaturedSagraCard.tsx # NEW: large overlay card for bento featured slot
      WeekendSection.tsx   # Adapt to work within bento grid (modify existing)
      QuickFilters.tsx     # Province filters row (modify existing)
      ProvinceSection.tsx  # Adapt to bento cell (modify existing)
    sagra/
      SagraCard.tsx        # Image overlay redesign (modify existing)
    animations/
      FadeIn.tsx           # m migration (modify existing)
      ScrollReveal.tsx     # m migration (modify existing)
      StaggerGrid.tsx      # m migration (modify existing)
      ScrollProgress.tsx   # m migration (modify existing)
      ParallaxHero.tsx     # m migration (modify existing)
    Providers.tsx          # Add LazyMotion wrapper (modify existing)
  app/
    globals.css            # Mesh gradient utility classes, glass utility classes (modify existing)
    (main)/
      page.tsx             # Bento grid layout (modify existing)
      template.tsx         # m migration + AnimatePresence (modify existing)
```

### Pattern 1: Glassmorphism CSS Pattern
**What:** Frosted glass effect using `backdrop-filter` + semi-transparent background + thin light border
**When to use:** Navigation bars (TopNav, BottomNav) and floating overlays (map controls, search pill, back button)
**Example:**
```css
/* Glass nav utility -- add to globals.css @layer utilities */
.glass-nav {
  @apply bg-background/85 backdrop-blur-[10px] border border-white/15;
}
```
```tsx
// TopNav.tsx -- replace current classes
<nav className="hidden lg:block sticky top-0 z-50 glass-nav border-b border-border">
```

### Pattern 2: Mesh Gradient CSS Pattern
**What:** Layered radial-gradient() backgrounds creating organic color blobs
**When to use:** Hero sections, page backgrounds where visual depth is needed
**Example:**
```css
/* Mesh gradient utility -- add to globals.css @layer utilities */
.mesh-gradient {
  background:
    radial-gradient(ellipse 80% 60% at 15% 20%, oklch(0.637 0.237 25.5 / 0.18), transparent 70%),
    radial-gradient(ellipse 60% 80% at 85% 75%, oklch(0.600 0.155 185 / 0.15), transparent 65%),
    radial-gradient(ellipse 50% 50% at 50% 50%, oklch(0.637 0.237 25.5 / 0.08), transparent 60%),
    var(--background);
}
```

### Pattern 3: Image Overlay Card Pattern
**What:** Full-bleed image with dark gradient overlay and white text for readability
**When to use:** SagraCard redesign, featured bento card
**Example:**
```tsx
// SagraCard image overlay pattern
<div className="relative h-full w-full overflow-hidden rounded-lg">
  <FadeImage src={sagra.image_url} alt={sagra.title} fill className="object-cover" />
  {/* Dark gradient overlay -- stronger at bottom for text readability */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
  {/* Text content positioned at bottom */}
  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
    <h3 className="font-semibold text-base line-clamp-1">{sagra.title}</h3>
    <p className="text-sm text-white/80">{sagra.location_text}</p>
  </div>
</div>
```

### Pattern 4: Bento Grid with CSS Grid Named Areas
**What:** Asymmetric editorial layout using CSS Grid `grid-template-areas`
**When to use:** Homepage below hero section
**Example:**
```tsx
// Desktop bento grid (mobile stacks to single column)
<div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:gap-4 md:grid-rows-[auto_auto_auto]"
     style={{
       gridTemplateAreas: `
         "featured featured card1 card2"
         "featured featured card3 card4"
         "filters  filters  filters filters"
       `
     }}>
  {/* Featured card spans 2x2 */}
  <div style={{ gridArea: 'featured' }}>
    <FeaturedSagraCard sagra={sagre[0]} />
  </div>
  {/* Regular cards fill remaining slots */}
  {sagre.slice(1, 5).map((s, i) => (
    <div key={s.id} style={{ gridArea: `card${i+1}` }}>
      <SagraCard sagra={s} />
    </div>
  ))}
</div>
```

### Pattern 5: LazyMotion Provider with Async domMax
**What:** Wrap the app in LazyMotion for bundle splitting, load features asynchronously
**When to use:** Providers.tsx -- wraps entire app
**Example:**
```tsx
// src/lib/motion-features.ts (new file)
import { domMax } from "motion/react";
export default domMax;

// src/components/Providers.tsx
"use client";
import { LazyMotion } from "motion/react";
import { MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const loadFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <NuqsAdapter>{children}</NuqsAdapter>
      </MotionConfig>
    </LazyMotion>
  );
}
```

### Anti-Patterns to Avoid
- **Nesting blur elements:** Never put a `backdrop-blur` element inside another `backdrop-blur` element -- multiplies rendering cost
- **Animating backdrop-filter:** Never animate the blur value itself; it triggers expensive repaints on every frame
- **Using motion instead of m after migration:** With `strict` prop on LazyMotion, accidentally importing `motion` will throw -- use `m` everywhere
- **Applying glass to SagraCards:** CONTEXT explicitly says cards stay solid. Only nav + floating overlays get glass treatment
- **Using grid-template-areas in Tailwind classes directly:** Tailwind v4 does not have built-in `grid-template-areas` utilities; use inline `style` prop or add custom CSS utility

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image text readability | Custom contrast detection logic | CSS `bg-gradient-to-t from-black/70` overlay | Proven pattern (Airbnb, Netflix), handles all image types |
| Bundle splitting for animations | Custom dynamic imports per component | LazyMotion + async feature loading | Built into motion library, handles feature detection/loading |
| Responsive grid collapse | Custom JS resize observer for layout | CSS Grid + `grid-cols-1 md:grid-cols-4` | CSS handles responsive breakpoints natively |
| Frosted glass effect | Canvas-based blur or pre-rendered images | `backdrop-filter: blur()` | Hardware-accelerated in all modern browsers (Chrome 76+, Safari 9+, Firefox 103+) |
| Mesh gradient generation | Runtime JS gradient calculation | Static CSS `radial-gradient()` layers | Zero JS cost, hardware-accelerated, works with OKLCH colors |

**Key insight:** This entire phase is achievable with zero new dependencies. Everything is CSS (glassmorphism, mesh gradients, bento grid, card overlay gradients) except the LazyMotion migration which is a refactor of existing code, not a new library.

## Common Pitfalls

### Pitfall 1: BottomNav layoutId Requires domMax
**What goes wrong:** Using `domAnimation` feature bundle breaks the BottomNav active indicator animation because `layoutId` is a layout animation feature only available in `domMax`
**Why it happens:** `domAnimation` (~15KB) only includes basic animations, variants, exit, and tap/hover/focus. Layout animations (including `layoutId`) require `domMax` (~25KB)
**How to avoid:** Use `domMax` loaded asynchronously via `LazyMotion features={loadFeatures}` where `loadFeatures` dynamically imports `domMax`. This keeps initial bundle at ~5KB (LazyMotion shell) and defers the 25KB domMax load
**Warning signs:** BottomNav active tab indicator stops animating between tabs; console errors about missing layout features

### Pitfall 2: AnimatePresence + m Components
**What goes wrong:** `AnimatePresence` is imported from `motion/react` (the full bundle), not from `motion/react-m`, so it may pull in the full motion bundle even after m migration
**Why it happens:** AnimatePresence is not part of the m export; it's a standalone component from the main bundle
**How to avoid:** `AnimatePresence` can be imported from `motion/react` alongside `LazyMotion` -- these are provider components, not animated elements. Only the animated elements (`motion.div` -> `m.div`) need to change. Verify with `strict` prop that no `motion.*` components remain
**Warning signs:** Bundle size doesn't decrease as expected after migration

### Pitfall 3: Backdrop-blur Mobile Performance
**What goes wrong:** Multiple overlapping blur surfaces cause scroll jank on low-end mobile devices
**Why it happens:** Each `backdrop-filter: blur()` creates a compositing layer; too many layers exhaust GPU memory
**How to avoid:** Limit to 2-3 blur surfaces visible simultaneously. TopNav + BottomNav = 2 surfaces on all pages. On map page, MapFilterOverlay adds a 3rd. Never exceed 3. Keep blur at <=12px. Add `will-change: backdrop-filter` on nav elements for GPU pre-allocation
**Warning signs:** Choppy scrolling on iPhone SE or mid-range Android, visible in Chrome DevTools Performance panel as long "Paint" tasks

### Pitfall 4: Image Overlay Text Readability
**What goes wrong:** White text becomes unreadable on light-colored food images
**Why it happens:** Simple linear gradient isn't strong enough, or gradient doesn't cover the text area
**How to avoid:** Use a multi-stop gradient: `bg-gradient-to-t from-black/70 via-black/30 to-transparent`. The 70% opacity at the bottom ensures readability regardless of image brightness. Consider adding a subtle `text-shadow` as fallback
**Warning signs:** Text contrast fails WCAG AA on light food photos (pastries, rice dishes, etc.)

### Pitfall 5: CSS Grid template-areas and Tailwind v4
**What goes wrong:** Trying to use `grid-template-areas` as a Tailwind utility class fails because Tailwind v4 has no built-in grid-areas support
**Why it happens:** `grid-template-areas` is not in Tailwind's utility class set
**How to avoid:** Use inline `style` prop for `gridTemplateAreas` or define a custom utility in `globals.css`. Column/row spans can use Tailwind (`col-span-2`, `row-span-2`) as alternatives to named areas
**Warning signs:** Grid items don't position correctly; layout falls back to auto-placement

### Pitfall 6: Mesh Gradient OKLCH Opacity Syntax
**What goes wrong:** OKLCH colors with opacity don't work in `radial-gradient()` when using CSS custom properties
**Why it happens:** `oklch(0.637 0.237 25.5 / 0.18)` with literal values works, but `var(--primary) / 0.18` inside a gradient function doesn't compose correctly
**How to avoid:** Use literal OKLCH values in the gradient definitions (matching the values from `globals.css` `:root`), not `var(--primary)`. Or use Tailwind's `from-primary/18` syntax in gradient utilities where possible
**Warning signs:** Gradient blobs appear at full opacity or are invisible

## Code Examples

### Glassmorphism Nav (TopNav)
```tsx
// Source: Existing TopNav.tsx + glassmorphism pattern
// Before:
<nav className="hidden lg:block sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">

// After:
<nav className="hidden lg:block sticky top-0 z-50 bg-background/85 backdrop-blur-[10px] border-b border-white/15 will-change-[backdrop-filter]">
```

### Glassmorphism Nav (BottomNav)
```tsx
// Source: Existing BottomNav.tsx + glassmorphism pattern
// Before:
<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe lg:hidden">

// After:
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-[10px] border-t border-white/15 pb-safe lg:hidden will-change-[backdrop-filter]">
```

### Mesh Gradient Hero
```tsx
// Source: CSS radial-gradient layering technique
<section className="relative overflow-hidden rounded-2xl px-6 py-10 lg:px-10 lg:py-14">
  {/* Mesh gradient background */}
  <div
    className="absolute inset-0 -z-10"
    style={{
      background: `
        radial-gradient(ellipse 80% 60% at 10% 15%, oklch(0.637 0.237 25.5 / 0.20), transparent 70%),
        radial-gradient(ellipse 60% 80% at 90% 80%, oklch(0.600 0.155 185 / 0.18), transparent 65%),
        radial-gradient(ellipse 40% 40% at 50% 40%, oklch(0.637 0.237 25.5 / 0.10), transparent 55%),
        oklch(0.985 0.005 260)
      `
    }}
  />
  <h1 className="text-3xl font-bold text-foreground lg:text-4xl">
    Scopri le sagre del Veneto
  </h1>
  {/* ... rest of hero content */}
</section>
```

### SagraCard Image Overlay
```tsx
// Source: Airbnb/Booking card pattern + CONTEXT.md decisions
<div className="relative h-52 w-full overflow-hidden rounded-lg">
  {sagra.image_url ? (
    <>
      <FadeImage
        src={sagra.image_url}
        alt={sagra.title}
        fill
        className="object-cover"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      />
      {/* Multi-stop dark gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
    </>
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10">
      <UtensilsCrossed className="h-10 w-10 text-muted-foreground/30" />
    </div>
  )}
  {/* Overlay text at bottom */}
  <div className="absolute bottom-0 left-0 right-0 p-3">
    <h3 className="font-semibold text-white text-base line-clamp-1 drop-shadow-sm">
      {sagra.title}
    </h3>
    <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
      <MapPin className="h-3.5 w-3.5" />
      <span className="line-clamp-1">{sagra.location_text}</span>
    </div>
    <div className="flex items-center gap-1 text-white/70 text-xs mt-0.5">
      <Calendar className="h-3 w-3" />
      <span>{formatDateRange(sagra.start_date, sagra.end_date)}</span>
    </div>
  </div>
  {/* Free badge */}
  {sagra.is_free && (
    <Badge className="absolute right-2 top-2 bg-accent text-accent-foreground">
      Gratis
    </Badge>
  )}
</div>
```

### LazyMotion Migration (m components)
```tsx
// Source: motion.dev/docs/react-lazy-motion
// Before (any file using motion):
import { motion } from "motion/react";
<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>

// After:
import * as m from "motion/react-m";
<m.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>

// Special cases -- these stay imported from "motion/react":
// - AnimatePresence (provider, not animated element)
// - MotionConfig (provider, not animated element)
// - LazyMotion (provider)
// - useScroll, useSpring, useTransform (hooks, not components)
```

### Complete List of Files Requiring m Migration
```
12 files total:
1.  src/app/(main)/template.tsx           -- motion.div -> m.div (AnimatePresence stays)
2.  src/components/layout/BottomNav.tsx    -- motion.div -> m.div (uses layoutId, needs domMax)
3.  src/components/sagra/SagraCard.tsx     -- motion.div -> m.div
4.  src/components/home/QuickFilters.tsx   -- motion.button -> m.button
5.  src/components/detail/ShareButton.tsx  -- motion.div -> m.div
6.  src/components/detail/DirectionsButton.tsx -- motion.a -> m.a
7.  src/components/animations/FadeIn.tsx   -- motion.div -> m.div
8.  src/components/animations/ScrollReveal.tsx -- motion.div -> m.div
9.  src/components/animations/StaggerGrid.tsx -- motion.div -> m.div (x2)
10. src/components/animations/ScrollProgress.tsx -- motion.div -> m.div (uses useScroll, useSpring)
11. src/components/animations/ParallaxHero.tsx -- motion.div -> m.div (uses useScroll, useTransform)
12. src/components/Providers.tsx           -- Add LazyMotion wrapper (MotionConfig stays)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package (v12+) | Late 2024 | Import path: `motion/react` instead of `framer-motion` |
| Full `motion` import (~34KB) | `LazyMotion` + `m` (~5KB initial) | Available since framer-motion v6+ | Dramatic bundle reduction via code-splitting |
| Tailwind v3 `tailwind.config.ts` | Tailwind v4 `@import "tailwindcss"` in CSS | 2025 | No JS config file; theme via `@theme inline` in globals.css |
| `filter: blur()` on element itself | `backdrop-filter: blur()` on overlay | Mature (2020+) | Blurs content behind element, not element itself |
| Simple linear-gradient cards | Multi-stop gradient overlays | Design trend 2024-2026 | Netflix/Airbnb-style image cards with eased gradients |
| Uniform card grids | Bento grid (asymmetric editorial) | Design trend 2024-2026 | Apple/Linear-inspired modular layouts |

**Deprecated/outdated:**
- Tailwind v3 config style: This project uses Tailwind v4 with `@import "tailwindcss"` and `@theme inline` -- no `tailwind.config.ts` exists
- `framer-motion` package name: Already migrated to `motion` package in this project

## Open Questions

1. **Bento Grid Data Flow**
   - What we know: Homepage fetches `weekendSagre` (array of SagraCardData) and `provinceCounts`. The first item can be the "featured" card, rest are regular cards
   - What's unclear: Should we fetch a separate "featured" sagra or just use the first weekend sagra? Is there a concept of "featured" in the database?
   - Recommendation: Use the first weekend sagra as the featured card (no DB changes needed). If the array is empty, fall back to a gradient-only featured cell with CTA

2. **LazyMotion `strict` Prop in Development vs Production**
   - What we know: `strict` prop makes LazyMotion throw if any `motion.*` component is rendered inside it, ensuring no accidental full-bundle imports
   - What's unclear: Whether strict mode should be enabled in production (it throws errors) or only in development
   - Recommendation: Enable `strict` in development and production. It catches mistakes early and the error is clear. Any missed migration would be a bug worth catching

3. **Mesh Gradient on Search/Map Page**
   - What we know: CONTEXT says mesh gradients on "homepage hero AND search/map page backgrounds"
   - What's unclear: How the mesh gradient looks behind the search filters and map view without interfering with map readability
   - Recommendation: Use a subtler mesh gradient (lower opacity, ~10%) on search page, positioned at top only. Skip mesh gradient behind the actual map view (Leaflet map has its own tiles)

## Validation Architecture

> `workflow.nyquist_validation` is not set in config.json -- treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-05 | Glassmorphism on nav bars | manual-only | Visual inspection in browser | N/A -- CSS visual effect, no logic to unit test |
| UI-06 | Glassmorphism on overlays, max 2-3 surfaces | manual-only | Visual inspection + Chrome DevTools Layers panel | N/A -- CSS constraint, audit by counting blur elements per page |
| UI-07 | Mesh gradients on hero/backgrounds | manual-only | Visual inspection | N/A -- Pure CSS, no logic |
| UI-08 | Component redesign (SagraCard, Hero) | manual-only | Visual inspection, verify text readability on various images | N/A -- HTML/CSS structure change |
| UI-09 | Bento grid responsive layout | manual-only | Resize browser / test mobile viewport | N/A -- CSS Grid layout |
| UI-10 | LazyMotion migration, bundle reduction | smoke | `npm run build` + check `.next` bundle analyzer output | Wave 0 -- build verification |
| UI-11 | Glass performance on mobile | manual-only | Chrome DevTools Performance recording on throttled CPU | N/A -- Runtime performance |

### Sampling Rate
- **Per task commit:** `npm run build` (verify no build errors)
- **Per wave merge:** `npm run test` + `npm run build` (full suite + build verification)
- **Phase gate:** Full suite green + manual visual inspection on mobile viewport + build succeeds

### Wave 0 Gaps
- None -- existing test infrastructure covers all phase requirements. This phase is predominantly CSS/visual work where automated unit tests add no value. Build verification (`npm run build`) is the primary automated gate. The existing vitest suite ensures no regressions in data/query logic.

## Sources

### Primary (HIGH confidence)
- [motion.dev/docs/react-lazy-motion](https://motion.dev/docs/react-lazy-motion) -- LazyMotion API, m components, domAnimation vs domMax, strict prop, async loading pattern
- [motion.dev/docs/react-reduce-bundle-size](https://motion.dev/docs/react-reduce-bundle-size) -- Bundle size data: ~5KB initial with LazyMotion, domAnimation ~15KB, domMax ~25KB
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) -- Browser support: Chrome 76+, Safari 9+, Firefox 103+
- Project codebase analysis -- 12 files with `motion/react` imports, BottomNav uses `layoutId`, existing backdrop-blur on 6 elements

### Secondary (MEDIUM confidence)
- [CSS-Tricks radial-gradient](https://css-tricks.com/almanac/functions/r/radial-gradient/) -- Mesh gradient layering technique with radial-gradient()
- [UX Pilot glassmorphism guide](https://uxpilot.ai/blogs/glassmorphism-ui) -- Best practices: 2-3 blur surfaces per viewport, blur 8-15px range, alpha 0.1-0.25
- [ishadeed.com text over images](https://ishadeed.com/article/handling-text-over-image-css/) -- Dark gradient overlay patterns for text readability
- [Codemotion bento grid tutorial](https://www.codemotion.com/magazine/frontend/lets-create-a-bento-box-design-layout-using-modern-css/) -- CSS Grid with grid-template-areas for editorial layouts

### Tertiary (LOW confidence)
- [GitHub nextcloud/spreed #7896](https://github.com/nextcloud/spreed/issues/7896) -- Backdrop-filter performance issues on Chrome (context for performance limits)
- [Bundlephobia](https://bundlephobia.com) -- General bundle size reference (specific motion v12 sizes from official docs are more reliable)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all verified in current package.json
- Architecture: HIGH -- CSS patterns well-documented, LazyMotion API verified from official docs
- Pitfalls: HIGH -- layoutId/domMax requirement confirmed, backdrop-filter perf limits well-documented
- Glassmorphism: HIGH -- Already partially implemented in TopNav, pattern is straightforward CSS
- Mesh gradients: HIGH -- Pure CSS, no dependencies, verified technique from multiple sources
- Bento grid: MEDIUM -- CSS Grid named areas require inline style approach in Tailwind v4 (no built-in utility), but the pattern itself is standard
- LazyMotion bundle target: MEDIUM -- Official docs say ~5KB initial, but actual savings depend on tree-shaking behavior with Next.js 15 + Turbopack; may land at 5-8KB rather than exactly 5KB

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable CSS techniques, motion v12 API unlikely to change)
