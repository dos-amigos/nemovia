# Technology Stack

**Project:** Nemovia v1.2 "Polish"
**Researched:** 2026-03-07
**Overall Confidence:** HIGH

## Existing Stack (DO NOT change)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.12 | App Router, SSR, routing |
| React | 19.1.0 | UI framework |
| Tailwind CSS | v4 | Utility-first styling |
| Shadcn/UI | latest | Component library (Card, Badge, Skeleton, etc.) |
| Motion | 12.35.0 | Animations (FadeIn, StaggerGrid already built) |
| Leaflet | 1.9.4 | Maps |
| nuqs | 2.8.9 | URL search param state |
| tw-animate-css | 1.4.0 | Tailwind animation utilities |

## Recommended Additions for v1.2

### View Transitions API (native, via Next.js experimental flag)

| Property | Value |
|----------|-------|
| **What** | Native browser API for page-to-page transitions |
| **Install** | Nothing -- built into Next.js 15.2+ and modern browsers |
| **Config** | `experimental: { viewTransition: true }` in next.config.ts |
| **Browser support** | 89.25% global: Chrome 111+, Firefox 144+, Safari 18+, Edge 111+ |
| **Confidence** | HIGH -- verified via official Next.js docs and Can I Use |

**Why View Transitions API instead of Motion AnimatePresence for page transitions:**

1. **AnimatePresence is broken with App Router.** Next.js App Router aggressively unmounts/remounts components during navigation, breaking AnimatePresence's exit detection. The workarounds (FrozenRouter, template.tsx hacks) are fragile and poorly maintained. This is a known, long-standing issue (vercel/next.js#49279).

2. **Zero bundle cost.** View Transitions are a native browser API -- no JS shipped for the transition itself. Motion is already in the bundle for existing animations; adding page transition logic would increase that further with no benefit.

3. **Progressive enhancement.** Browsers without support simply skip the animation -- the app works perfectly without it. No broken state, no fallback code needed.

4. **Official Next.js support.** The `experimental.viewTransition` flag exists precisely for this use case in Next.js 15.2+. While labeled experimental, the underlying browser API is stable (W3C Working Draft, 89% support). The "experimental" tag refers to deeper Next.js integration hooks (automatic transition types for navigations), not the core cross-fade functionality.

**Implementation approach:**

```typescript
// next.config.ts -- only change needed
const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};
```

```tsx
// In components wrapping page content (e.g., layout or individual pages):
import { ViewTransition } from 'react';

<ViewTransition>
  <div>{children}</div>
</ViewTransition>
```

**CSS for transitions (add to globals.css):**

```css
::view-transition-old(root) {
  animation: fade-out 150ms ease-out;
}
::view-transition-new(root) {
  animation: fade-in 150ms ease-in;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### No New npm Dependencies Required

The entire v1.2 scope can be achieved with the existing stack. Here is why:

| Capability Needed | Solution | Why No New Dependency |
|-------------------|----------|----------------------|
| Page transitions | View Transitions API (browser-native) + Next.js flag | Built into browser + Next.js 15.2+ |
| Skeleton loaders | Already have Shadcn `<Skeleton>` + `SagraCardSkeleton` | Already built in v1.0 |
| Hover effects | Motion `whileHover` + `whileTap` (already installed) | Motion 12.35.0 already in deps |
| Scroll animations | Motion `whileInView` (already used in FadeIn) | Already used in FadeIn component |
| Scroll progress bar | Motion `useScroll` hook | Already available in motion@12 |
| Responsive desktop layout | Tailwind v4 responsive utilities + container queries | Built into Tailwind v4 core |
| Back button | `useRouter().back()` or `<Link>` -- plain Next.js | Built into Next.js |
| Image placeholder | Existing gradient placeholder pattern in SagraCard | Already implemented in cards |
| Layout animations | Motion `layout` prop for smooth reflows | Already available in motion@12 |

## Libraries Explicitly NOT Adding

### barba.js -- REJECT

**Why mentioned:** User referenced it as an option for page transitions.

**Why not:**
- barba.js is designed for vanilla JS multi-page sites, NOT React/Next.js SPAs
- Known `DOMParser is not defined` errors in Next.js (GitHub barbajs/barba#650)
- Conflicts with React's virtual DOM -- barba.js manipulates real DOM containers directly
- Zero React integration -- no hooks, no component model, no TypeScript types
- Motion + View Transitions cover the same use case without compatibility issues

### lenis (smooth scroll) -- DEFER, not needed for v1.2

**Why mentioned:** User referenced it for "wow effect" smooth scrolling.

**Why not now:**
- The app is a mobile-first sagre aggregator with short, scrollable pages -- not a portfolio/agency showcase site where smooth scroll adds value
- Lenis adds ~8KB to the bundle and introduces a custom scroll layer that can conflict with Leaflet's scroll behavior on map pages
- Known glitchy behavior on iPad with Magic Keyboard (relevant for Italian users)
- Can be added in a future milestone if scroll-heavy content pages are introduced
- The "wow effect" is better achieved through micro-interactions (hover, stagger, transitions) which Motion already provides

### reactbits -- DO NOT ADD

**Why mentioned:** User referenced it for modern UI components.

**Why not:**
- reactbits provides pre-built animated components (text effects, backgrounds, etc.) -- NOT a library you integrate alongside Shadcn
- The app already has a consistent design system with Shadcn/UI + Motion
- Adding reactbits would create two competing component libraries with different styling conventions
- The specific effects (hover animations, scroll reveals) are trivially achievable with Motion's `whileHover`, `whileTap`, `whileInView` which are already installed
- MIT + Commons Clause license is more restrictive than standard MIT

### next-view-transitions (shuding/next-view-transitions) -- SKIP

**Why considered:** Popular community library for View Transitions in Next.js App Router.

**Why not:**
- Next.js 15.2+ has built-in `experimental.viewTransition` support, making this library redundant
- The library (v0.3.5) wraps the same browser API but adds its own `<Link>` component and `<ViewTransitions>` wrapper that duplicate what Next.js now provides natively
- Shuding (the author) works at Vercel -- the library was a precursor to the native support that landed in Next.js 15.2

### next-transition-router -- SKIP

**Why considered:** Allows animated page transitions with any animation library.

**Why not:**
- Still in Beta, API may change
- Adds routing wrapper complexity
- View Transitions API achieves the same result with zero dependencies and better performance

## Tailwind v4 Responsive Strategy for Desktop Layout

The main layout currently uses `max-w-lg` (32rem / 512px) which is aggressively mobile-scoped. For responsive desktop, this needs to scale up using Tailwind v4's built-in responsive utilities.

### Breakpoints (built into Tailwind v4, no config needed)

| Breakpoint | Width | Use For |
|------------|-------|---------|
| (default) | < 640px | Mobile -- current behavior, single column |
| `sm` | >= 640px | 2-column card grid (already used in StaggerGrid) |
| `md` | >= 768px | Tablet -- wider content area, larger cards |
| `lg` | >= 1024px | Desktop -- 3-column grid, wider max-width, potential sidebar |
| `xl` | >= 1280px | Large desktop -- max content width with comfortable margins |

### Container Queries (new in Tailwind v4 core, no plugin needed)

Container queries are built into Tailwind v4 core (the `@tailwindcss/container-queries` plugin is no longer needed). Useful for components that need to adapt to their container size rather than viewport:

```html
<!-- Parent defines container -->
<div class="@container">
  <!-- Child responds to container width, not viewport -->
  <div class="flex flex-col @md:flex-row">
    ...
  </div>
</div>
```

**Container query breakpoints are smaller than viewport breakpoints:**
| Container | Width | Viewport equivalent |
|-----------|-------|---------------------|
| `@sm` | 320px | Much smaller than `sm` (640px) |
| `@md` | 448px | Smaller than `md` (768px) |
| `@lg` | 640px | Smaller than `lg` (1024px) |

**When to use container queries vs breakpoints:**
- **Breakpoints (`md:`, `lg:`)** -- For page-level layout changes (content max-width, grid columns, sidebar visibility, navigation style)
- **Container queries (`@md:`, `@lg:`)** -- For component-level adaptation (SagraCard changing from vertical to horizontal layout when placed in a wider container)

### Responsive Layout Changes

**Current layout** (max-w-lg = 512px for all screen sizes):
```tsx
// (main)/layout.tsx -- CURRENT (too narrow on desktop)
<main className="mx-auto max-w-lg px-4 py-4">{children}</main>
```

**Recommended responsive layout:**
```tsx
// (main)/layout.tsx -- RESPONSIVE
<main className="mx-auto max-w-lg px-4 py-4 md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
  {children}
</main>
```

**Responsive card grids:**
```tsx
// StaggerGrid default className -- RESPONSIVE
className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
```

**Detail page -- centered content:**
```tsx
// sagra/[slug] detail content -- wider but not full-width
className="mx-auto max-w-2xl"
```

**Desktop navigation consideration:**
On `lg:` and above, the BottomNav should optionally transform into a top navigation bar or sidebar. Alternatively, keep BottomNav on all sizes (many modern apps do this successfully).

## Motion Features Already Available (underutilized)

The project has `motion@12.35.0` installed with only FadeIn and StaggerGrid built. These additional features are ready to use without any new install:

### Hover and Tap Gestures (for SagraCard micro-interactions)

```tsx
import { motion } from "motion/react";

// Wrap SagraCard link in motion.div for hover/tap feedback
<motion.div
  whileHover={{ scale: 1.02, y: -2 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
  <SagraCard sagra={sagra} />
</motion.div>
```

### Scroll-Linked Progress Bar

```tsx
import { useScroll, motion } from "motion/react";

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      style={{ scaleX: scrollYProgress }}
      className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
    />
  );
}
```

### Exit Animations (within a page, NOT page transitions)

```tsx
import { AnimatePresence, motion } from "motion/react";

// Use AnimatePresence for in-page elements: filter panels, modals, toasts, empty states
// Do NOT use for page-level route transitions (use View Transitions instead)
<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    />
  )}
</AnimatePresence>
```

### Layout Animations (smooth reflows when list content changes)

```tsx
// Smooth layout shifts when filters change the result count
<motion.div layout transition={{ type: "spring", damping: 25, stiffness: 200 }}>
  {results.map(sagra => (
    <motion.div layout key={sagra.id}>
      <SagraCard sagra={sagra} />
    </motion.div>
  ))}
</motion.div>
```

### Improved Stagger with whileInView

The existing StaggerGrid uses `whileInView` with `once: true`. This pattern can be extended to other sections (ProvinceSection, QuickFilters) for a coordinated reveal effect across the page without any new code patterns.

## Summary: What Changes in package.json

**Nothing.** Zero new dependencies. The entire v1.2 milestone is achievable with:

1. **View Transitions API** -- enabled via a single line in `next.config.ts` (already installed Next.js 15.5.12, which is >= 15.2)
2. **Motion gestures and scroll** -- already installed (motion@12.35.0), currently underutilized. Only FadeIn and StaggerGrid are built; whileHover, whileTap, useScroll, layout animations are all available
3. **Tailwind v4 responsive** -- already installed, just constrained by `max-w-lg` in the layout. Breakpoints (sm/md/lg/xl) and container queries (@container/@md) are built-in
4. **Shadcn Skeleton** -- already installed and used in all loading.tsx files

**The only config change:** Add `experimental: { viewTransition: true }` to `next.config.ts`.

## Sources

- [Next.js viewTransition docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) -- HIGH confidence, verified config syntax and version requirements
- [Can I Use: View Transitions API](https://caniuse.com/view-transitions) -- HIGH confidence, 89.25% global support (Chrome 111+, Firefox 144+, Safari 18+, Edge 111+)
- [Motion for React](https://motion.dev/docs/react) -- HIGH confidence, v12.35.0 confirmed on npm
- [Motion changelog](https://motion.dev/changelog) -- HIGH confidence, AnimateView and useScroll improvements in v12.34-12.35
- [Tailwind CSS v4 Responsive Design](https://tailwindcss.com/docs/responsive-design) -- HIGH confidence, breakpoints and container queries verified
- [Tailwind CSS v4 Container Queries](https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/) -- MEDIUM confidence, confirms no plugin needed
- [AnimatePresence + App Router issue](https://github.com/vercel/next.js/issues/49279) -- HIGH confidence, confirmed broken
- [barba.js Next.js DOMParser error](https://github.com/barbajs/barba/issues/650) -- HIGH confidence, confirmed incompatibility
- [next-view-transitions](https://github.com/shuding/next-view-transitions) -- MEDIUM confidence, v0.3.5 superseded by native support
- [Lenis smooth scroll](https://github.com/darkroomengineering/lenis) -- MEDIUM confidence, evaluated and deferred
- [React Bits](https://reactbits.dev/) -- MEDIUM confidence, evaluated and rejected
