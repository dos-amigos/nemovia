# Architecture Patterns

**Domain:** UI/UX Polish -- Page transitions, responsive desktop layout, skeleton loaders, micro-interactions
**Project:** Nemovia v1.2 "Polish" -- Integrating into existing Next.js 15 App Router architecture
**Researched:** 2026-03-07

## Existing Architecture Summary

Nemovia is a Next.js 15 App Router application with this structure:

```
src/app/layout.tsx              -- Root: <html>, Inter font, NuqsAdapter
  src/app/(main)/layout.tsx     -- Main: max-w-lg container, pb-20, BottomNav
    src/app/(main)/page.tsx     -- Home (Server Component)
    src/app/(main)/cerca/       -- Search (Server + Client)
    src/app/(main)/mappa/       -- Map (Client-heavy)
    src/app/(main)/sagra/[slug] -- Detail (Server Component)
```

Key characteristics:
- **Server-first**: Pages are async server components fetching from Supabase RPC
- **Client islands**: BottomNav, SearchFilters, MapView, QuickFilters, BackButton are "use client"
- **Animation layer**: FadeIn and StaggerGrid wrappers use `motion/react` (Motion v12)
- **Loading states**: Each route has a `loading.tsx` with Skeleton components
- **Mobile-only layout**: `max-w-lg` on the main container, BottomNav fixed at bottom
- **No template.tsx**: None exists -- pages share persistent layouts only

## Recommended Architecture for v1.2 Polish

The polish features split into four integration domains, each with distinct architectural concerns:

### 1. Page Transitions
### 2. Responsive Desktop Layout
### 3. Skeleton Loaders (Enhancement)
### 4. Micro-Interactions

---

## Integration Domain 1: Page Transitions

**Confidence: MEDIUM** -- Well-researched patterns exist but Next.js App Router has a known architectural limitation (issue #49279, still open as of Dec 2025) that prevents standard AnimatePresence exit animations.

### The Problem

Next.js App Router inserts an `OuterLayoutRouter` component between layouts and templates. During navigation, it performs full content swaps that unmount the old page before Motion's AnimatePresence can run exit animations. The standard `AnimatePresence` + `key={pathname}` pattern does not work reliably.

### Recommended Approach: next-view-transitions

Use the `next-view-transitions` library (v0.3.5, by Shu Ding / Vercel core team) for CSS View Transitions API integration. This is the right choice because:

1. **Works with App Router natively** -- wraps the `<html>` element, intercepts Next.js navigation
2. **No FrozenRouter hacks** -- uses browser-native View Transitions API, not React component lifecycle tricks
3. **GPU-accelerated** -- transitions run on the compositor, not the main thread
4. **Zero conflict with existing Motion animations** -- View Transitions are CSS-level, Motion animations are JS-level, they operate on different layers
5. **Progressive enhancement** -- falls back gracefully on unsupported browsers (Firefox)
6. **Tiny footprint** -- no additional animation library, just CSS

**Browser support**: Chrome, Edge, Safari 18+. Firefox lacks support but degrades to instant navigation (acceptable for a Veneto sagre app where the audience is primarily mobile Chrome/Safari).

### Architecture: What Changes

```
BEFORE:
src/app/layout.tsx
  <html>
    <body>
      <NuqsAdapter>{children}</NuqsAdapter>
    </body>
  </html>

AFTER:
src/app/layout.tsx
  <ViewTransitions>         <-- NEW: wraps <html>
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  </ViewTransitions>
```

**Modified files:**

| File | Change | Why |
|------|--------|-----|
| `src/app/layout.tsx` | Wrap with `<ViewTransitions>` from `next-view-transitions` | Enable CSS View Transitions for all route changes |
| `src/app/globals.css` | Add `::view-transition-*` CSS rules | Define transition animations (crossfade, slide) |
| `src/components/layout/BottomNav.tsx` | Replace `next/link` with `Link` from `next-view-transitions` | Trigger transitions on tab navigation |
| `src/components/sagra/SagraCard.tsx` | Replace `next/link` with `Link` from `next-view-transitions` | Trigger transitions when opening detail pages |
| `src/components/home/HeroSection.tsx` | Replace `next/link` with `Link` from `next-view-transitions` | Trigger transition on search bar click |
| `src/components/home/ProvinceSection.tsx` | Replace `next/link` with `Link` from `next-view-transitions` | Trigger transition on province link click |

**New files:**

None required -- CSS View Transitions are controlled entirely through CSS `::view-transition-*` pseudo-elements and the `<ViewTransitions>` wrapper.

**CSS transition definitions** (added to `globals.css`):

```css
/* Page transition: crossfade with subtle slide */
::view-transition-old(root) {
  animation: fade-out 200ms ease-in forwards,
             slide-out 200ms ease-in forwards;
}
::view-transition-new(root) {
  animation: fade-in 300ms ease-out forwards,
             slide-in 300ms ease-out forwards;
}

@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
@keyframes slide-out { to { transform: translateY(-8px); } }
@keyframes slide-in { from { transform: translateY(8px); } }

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation: none;
  }
}
```

### Why NOT next-transition-router or FrozenRouter

| Approach | Verdict | Reason |
|----------|---------|--------|
| `next-transition-router` | Rejected | Adds 8KB, requires wrapping app in `TransitionRouter` provider, overkill for crossfade transitions |
| FrozenRouter + AnimatePresence | Rejected | Relies on internal `LayoutRouterContext` which is not a public API -- breaks on Next.js upgrades |
| `experimental: { viewTransition: true }` | Rejected for now | Requires React Canary channel, Next.js 16+, not stable yet |
| Custom `template.tsx` with Motion | Rejected | Only gives entrance animations (template remounts), no exit animations without FrozenRouter hack |

### Why NOT Motion's layoutId for shared element transitions

Motion's `layoutId` prop enables shared element transitions (e.g., card image morphing into detail page image). However, this requires both the source and target `motion.div` to exist in the same React tree simultaneously during the transition. Next.js App Router's navigation fully unmounts the old page before mounting the new one, breaking this requirement (issue #49279). CSS View Transitions handle the "snapshot old, animate to new" pattern natively without this constraint.

---

## Integration Domain 2: Responsive Desktop Layout

**Confidence: HIGH** -- Standard Tailwind responsive patterns, no library dependencies.

### The Problem

The current main layout uses `max-w-lg` (512px) which is appropriate for mobile but wastes space on desktop screens. The BottomNav is mobile-only; desktop needs a different navigation pattern.

### Recommended Approach: Breakpoint-Based Layout Shift

At `lg` (1024px+), switch from single-column mobile layout to a wider content area. At `xl` (1280px+), optionally show a sidebar. Keep BottomNav on mobile, hide it on desktop and show a top navigation or sidebar instead.

### Architecture: What Changes

```
MOBILE (<1024px):                    DESKTOP (>=1024px):
+---------------------------+        +---------------------------+
| [BottomNav sticky bottom] |        | [TopNav / DesktopNav]     |
|                           |        +--------+------------------+
|  max-w-lg, px-4           |        |        |                  |
|  Single column content    |        |        |  max-w-4xl       |
|                           |        |        |  Multi-column    |
|                           |        |        |  content grid    |
+---------------------------+        +--------+------------------+
```

**Modified files:**

| File | Change | Why |
|------|--------|-----|
| `src/app/(main)/layout.tsx` | Change `max-w-lg` to responsive: `max-w-lg lg:max-w-4xl xl:max-w-6xl` | Wider content area on desktop |
| `src/components/layout/BottomNav.tsx` | Add `lg:hidden` | Hide mobile nav on desktop |
| `src/components/sagra/SagraCard.tsx` | Add responsive image height, horizontal layout variant | Better card presentation on desktop |
| `src/components/search/SearchFilters.tsx` | Already responsive (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`) | Minimal changes needed |
| `src/app/(main)/page.tsx` | Adjust section spacing for wider layout | Better use of horizontal space |
| `src/app/(main)/cerca/page.tsx` | Add desktop grid layout for filters + results side-by-side | Utilize horizontal space |

**New files:**

| File | Purpose |
|------|---------|
| `src/components/layout/DesktopNav.tsx` | Top navigation bar for desktop with logo, nav links, hidden on mobile (`hidden lg:flex`) |

### Component: DesktopNav

```typescript
// src/components/layout/DesktopNav.tsx
"use client";

import { Link } from "next-view-transitions"; // reuse transition-aware Link
import { usePathname } from "next/navigation";
import { Home, Search, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cerca", label: "Cerca", icon: Search },
  { href: "/mappa", label: "Mappa", icon: Map },
] as const;

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <header className="hidden lg:flex sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold text-primary">
          Nemovia
        </Link>
        <div className="flex items-center gap-6">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 text-sm transition-colors",
                pathname === href
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
```

### Layout Change: (main)/layout.tsx

```typescript
// BEFORE:
<div className="min-h-screen bg-background pb-20">
  <main className="mx-auto max-w-lg px-4 py-4">{children}</main>
  <BottomNav />
</div>

// AFTER:
<div className="min-h-screen bg-background pb-20 lg:pb-0">
  <DesktopNav />
  <main className="mx-auto max-w-lg px-4 py-4 lg:max-w-4xl lg:px-6 lg:py-6 xl:max-w-6xl">
    {children}
  </main>
  <BottomNav /> {/* Already gets lg:hidden */}
</div>
```

### Grid Changes for Desktop

**StaggerGrid** currently uses `grid-cols-1 sm:grid-cols-2` as default. For desktop, extend:

```typescript
// BEFORE:
className = "grid grid-cols-1 gap-4 sm:grid-cols-2"

// AFTER:
className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
```

**Cerca page** desktop layout: filters as a sidebar, results as the main content area:

```
MOBILE:                         DESKTOP (lg+):
+------------------+            +----------+------------------+
| Filters (stacked)|            | Filters  | Results grid     |
| Results (below)  |            | (sidebar)| 3-col cards      |
+------------------+            +----------+------------------+
```

This requires restructuring the cerca page to use a `lg:grid lg:grid-cols-[280px_1fr] lg:gap-6` layout.

---

## Integration Domain 3: Skeleton Loaders (Enhancement)

**Confidence: HIGH** -- Existing pattern is solid, enhancements are straightforward.

### Current State

Every route already has a `loading.tsx` with appropriate skeletons. The existing `Skeleton` component uses `animate-pulse`. The `SagraCardSkeleton` matches the card layout structure.

### What to Improve

1. **Shimmer effect** instead of pulse -- more modern, gives directional movement that implies loading progress
2. **Suspense boundaries within pages** -- currently, entire pages show loading state; individual sections could stream independently
3. **Skeleton for the detail page image** -- currently shows a plain rectangle, should match the full-bleed hero pattern

### Architecture: What Changes

**Modified files:**

| File | Change | Why |
|------|--------|-----|
| `src/components/ui/skeleton.tsx` | Add shimmer animation variant | Modern loading feel |
| `src/app/globals.css` | Add `@keyframes shimmer` CSS animation | GPU-accelerated shimmer effect |
| `src/app/(main)/page.tsx` | Wrap WeekendSection and ProvinceSection in individual `<Suspense>` boundaries | Independent streaming -- hero + filters load first, then data sections stream in |
| `src/app/(main)/sagra/[slug]/loading.tsx` | Update image skeleton to match full-bleed hero layout (`-mx-4 -mt-4`) | Consistent skeleton shape prevents layout shift |

**New files:**

| File | Purpose |
|------|---------|
| `src/components/home/WeekendSectionSkeleton.tsx` | Suspense fallback for WeekendSection (replaces part of HomeLoading) |
| `src/components/home/ProvinceSectionSkeleton.tsx` | Suspense fallback for ProvinceSection |

### Suspense Streaming Pattern for Homepage

```typescript
// BEFORE (src/app/(main)/page.tsx):
export default async function HomePage() {
  const [weekendSagre, provinceCounts] = await Promise.all([
    getWeekendSagre(),
    getProvinceCounts(),
  ]);
  return (
    <div className="space-y-8">
      <HeroSection />
      <QuickFilters />
      <WeekendSection sagre={weekendSagre} />
      <ProvinceSection counts={provinceCounts} />
    </div>
  );
}

// AFTER:
export default function HomePage() {  // No longer async at top level
  return (
    <div className="space-y-8">
      <HeroSection />
      <QuickFilters />
      <Suspense fallback={<WeekendSectionSkeleton />}>
        <WeekendSectionLoader />  {/* async server component */}
      </Suspense>
      <Suspense fallback={<ProvinceSectionSkeleton />}>
        <ProvinceSectionLoader />  {/* async server component */}
      </Suspense>
    </div>
  );
}

// New: src/components/home/WeekendSectionLoader.tsx (Server Component)
async function WeekendSectionLoader() {
  const sagre = await getWeekendSagre();
  return <WeekendSection sagre={sagre} />;
}
```

This pattern makes the hero and quick filters appear instantly, then the weekend section and province section stream in independently with their own skeleton fallbacks.

### Shimmer Animation

```css
/* globals.css addition */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    oklch(0.95 0.001 106.424) 50%,
    var(--muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

---

## Integration Domain 4: Micro-Interactions

**Confidence: HIGH** -- Motion v12 is already installed and used. These are additive, low-risk changes.

### Strategy

Use Motion's `whileHover`, `whileTap`, and `whileInView` props for declarative micro-interactions. All values should use `transform` properties (scale, y, rotate) which are GPU-accelerated and do not trigger layout reflow.

### What Gets Micro-Interactions

| Component | Interaction | Motion Props |
|-----------|-------------|-------------|
| `SagraCard` | Hover lift + shadow, tap press | `whileHover={{ y: -4, scale: 1.02 }}` `whileTap={{ scale: 0.98 }}` |
| `BottomNav` tab icons | Tap bounce | `whileTap={{ scale: 0.9 }}` spring transition |
| `Badge` (food tags) | Hover highlight | `whileHover={{ scale: 1.05 }}` |
| `QuickFilters` chips | Tap press | `whileTap={{ scale: 0.95 }}` |
| `ProvinceSection` links | Hover lift | `whileHover={{ y: -2 }}` |
| `BackButton` | Tap scale | `whileTap={{ scale: 0.9 }}` |
| `DirectionsButton` / `ShareButton` | Tap press + bounce | `whileTap={{ scale: 0.95 }}` spring |
| `HeroSection` search bar | Hover shadow grow | `whileHover={{ scale: 1.01 }}` |

### Architecture: What Changes

**Modified files:**

| File | Change | Why |
|------|--------|-----|
| `src/components/sagra/SagraCard.tsx` | Wrap Card in `motion.div` with hover/tap props | Tactile card interaction |
| `src/components/layout/BottomNav.tsx` | Wrap tab icons in `motion.div` with tap spring | Bounce feedback on navigation |
| `src/components/home/QuickFilters.tsx` | Wrap Badge buttons in `motion.button` with tap scale | Press feedback on filter chips |
| `src/components/home/ProvinceSection.tsx` | Wrap province links in `motion.div` with hover lift | Hover affordance |
| `src/components/detail/BackButton.tsx` | Use `motion.button` instead of `button` | Tap feedback |
| `src/components/detail/DirectionsButton.tsx` | Use `motion.button` | Tap feedback |
| `src/components/detail/ShareButton.tsx` | Use `motion.button` | Tap feedback |
| `src/components/home/HeroSection.tsx` | Wrap search bar Link in `motion.div` with hover scale | Subtle hover invitation |

**New files:**

| File | Purpose |
|------|---------|
| `src/components/animations/PressScale.tsx` | Reusable wrapper for `whileTap={{ scale }}` to avoid repeating motion props everywhere |
| `src/components/animations/HoverLift.tsx` | Reusable wrapper for `whileHover={{ y, scale }}` pattern |

### Reusable Animation Wrappers

```typescript
// src/components/animations/PressScale.tsx
"use client";
import { motion, type HTMLMotionProps } from "motion/react";

interface PressScaleProps extends HTMLMotionProps<"div"> {
  scale?: number;
  children: React.ReactNode;
}

export function PressScale({ scale = 0.97, children, ...props }: PressScaleProps) {
  return (
    <motion.div
      whileTap={{ scale }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
```

```typescript
// src/components/animations/HoverLift.tsx
"use client";
import { motion, type HTMLMotionProps } from "motion/react";

interface HoverLiftProps extends HTMLMotionProps<"div"> {
  y?: number;
  children: React.ReactNode;
}

export function HoverLift({ y = -4, children, ...props }: HoverLiftProps) {
  return (
    <motion.div
      whileHover={{ y, transition: { type: "spring", stiffness: 300, damping: 20 } }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
```

### Accessibility: Reduced Motion

All Motion animations respect `prefers-reduced-motion` by default since Motion v11. Motion skips animations when the user has enabled reduced motion in their OS settings. No additional code needed for this.

---

## Complete Component Map: New vs Modified

### New Components (6)

| Component | Path | Type | Purpose |
|-----------|------|------|---------|
| `DesktopNav` | `src/components/layout/DesktopNav.tsx` | Client | Top navigation bar for lg+ screens |
| `PressScale` | `src/components/animations/PressScale.tsx` | Client | Reusable tap-to-scale wrapper |
| `HoverLift` | `src/components/animations/HoverLift.tsx` | Client | Reusable hover-to-lift wrapper |
| `WeekendSectionSkeleton` | `src/components/home/WeekendSectionSkeleton.tsx` | Server | Suspense fallback for weekend section |
| `ProvinceSectionSkeleton` | `src/components/home/ProvinceSectionSkeleton.tsx` | Server | Suspense fallback for province section |
| `WeekendSectionLoader` | `src/components/home/WeekendSectionLoader.tsx` | Server (async) | Data-fetching wrapper for Suspense pattern |

### Modified Components (15)

| Component | Path | Changes |
|-----------|------|---------|
| Root Layout | `src/app/layout.tsx` | Wrap with `<ViewTransitions>` |
| Main Layout | `src/app/(main)/layout.tsx` | Responsive width, add DesktopNav |
| BottomNav | `src/components/layout/BottomNav.tsx` | `lg:hidden`, transition Link, motion tap icons |
| SagraCard | `src/components/sagra/SagraCard.tsx` | Transition Link, motion hover/tap, responsive image |
| StaggerGrid | `src/components/animations/StaggerGrid.tsx` | Responsive grid columns for lg/xl |
| HeroSection | `src/components/home/HeroSection.tsx` | Transition Link, motion hover on search bar |
| QuickFilters | `src/components/home/QuickFilters.tsx` | Motion tap on chips |
| ProvinceSection | `src/components/home/ProvinceSection.tsx` | Transition Link, motion hover lift |
| SearchFilters | `src/components/search/SearchFilters.tsx` | Already responsive, minor desktop tweaks |
| BackButton | `src/components/detail/BackButton.tsx` | motion.button |
| DirectionsButton | `src/components/detail/DirectionsButton.tsx` | motion.button |
| ShareButton | `src/components/detail/ShareButton.tsx` | motion.button |
| Home page | `src/app/(main)/page.tsx` | Suspense boundaries around data sections |
| globals.css | `src/app/globals.css` | View transition CSS, shimmer keyframes |
| Skeleton | `src/components/ui/skeleton.tsx` | Add shimmer variant |
| Sagra detail loading | `src/app/(main)/sagra/[slug]/loading.tsx` | Match full-bleed hero skeleton shape |

---

## Data Flow Changes

### No Backend Changes

This milestone introduces zero changes to:
- Database schema
- Supabase RPC functions
- Scraper pipeline
- API routes / server actions
- Data types

All changes are purely in the rendering and interaction layer.

### New Dependency

One new npm package: `next-view-transitions` (v0.3.5, ~3KB gzipped).

```bash
npm install next-view-transitions
```

No other new dependencies. All micro-interactions use the existing `motion` package (v12.35.0). All responsive layout changes use existing Tailwind v4 utilities.

---

## Suggested Build Order

Dependencies flow in one direction: responsive layout first (changes the container everything lives in), then page transitions (changes how navigation works), then skeletons (streaming optimization), then micro-interactions (pure additive).

### Phase 1: Bug Fixes (No Dependencies)
**Rationale:** Fix broken UX before adding polish -- users need back buttons and working defaults before they appreciate animations.

1. BackButton on detail page -- already exists, may need visibility fix
2. Image placeholder on detail page -- already handled in SagraDetail.tsx (UtensilsCrossed icon)
3. "TUTTE" province filter default on Cerca page
4. Any other quick UX fixes

### Phase 2: Responsive Desktop Layout
**Rationale:** Must come before page transitions because the layout container width changes affect how view transitions look. Build the container first, then animate within it.

1. Create `DesktopNav` component
2. Modify `(main)/layout.tsx` -- responsive widths, DesktopNav, BottomNav `lg:hidden`
3. Update `StaggerGrid` default columns for lg/xl breakpoints
4. Adapt Cerca page for sidebar filter layout on desktop
5. Test all pages at mobile, tablet, and desktop widths

### Phase 3: Page Transitions
**Rationale:** Depends on layout being stable. Changes Link imports across multiple components -- do it once when the layout is settled.

1. Install `next-view-transitions`
2. Wrap root layout with `<ViewTransitions>`
3. Add `::view-transition-*` CSS to globals.css
4. Replace `next/link` imports with `next-view-transitions` Link in all navigation components
5. Test transitions between all route pairs

### Phase 4: Skeleton & Streaming Enhancements
**Rationale:** Independent of transitions but builds on the responsive layout (skeletons need to match the new wider layouts).

1. Add shimmer animation to globals.css
2. Create shimmer variant in Skeleton component
3. Create WeekendSectionSkeleton and ProvinceSectionSkeleton
4. Refactor HomePage to use Suspense boundaries with async loader components
5. Fix detail page loading skeleton to match full-bleed hero

### Phase 5: Micro-Interactions
**Rationale:** Pure additive, depends on nothing. But better to add last so you can see the full app flow without distractions while building earlier phases.

1. Create PressScale and HoverLift animation wrappers
2. Add motion props to SagraCard (hover lift + tap press)
3. Add motion props to BottomNav icons (tap bounce)
4. Add motion props to QuickFilters, ProvinceSection, HeroSection
5. Add motion.button to BackButton, DirectionsButton, ShareButton
6. Test all interactions on mobile (touch) and desktop (mouse)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: FrozenRouter / Internal API Hacks

**What:** Using React's internal `LayoutRouterContext` to freeze router state during exit animations.

**Why bad:** `LayoutRouterContext` is not a public API. Next.js can (and does) change its internal component tree between minor versions. Code that depends on it breaks silently on upgrades. The Nemovia project uses `next: 15.5.12` and will want to upgrade -- internal API dependencies make this risky.

**Instead:** Use CSS View Transitions via `next-view-transitions` which operates at the browser level, not the React component level.

### Anti-Pattern 2: Global Motion LayoutGroup for Page Transitions

**What:** Wrapping the entire app in a Motion `<LayoutGroup>` and using `layoutId` props to create shared element transitions between pages.

**Why bad:** Requires both the old and new page to be mounted simultaneously in the same React tree. Next.js App Router does not support this (issue #49279). The old page is fully unmounted before the new page mounts. Attempting this results in no animation at all, or flickering.

**Instead:** If shared element transitions are desired in the future, CSS View Transitions with `view-transition-name` CSS property on matching elements is the correct approach.

### Anti-Pattern 3: Animating Layout Properties

**What:** Using `whileHover={{ width: "100%", height: "auto" }}` or animating margin/padding in micro-interactions.

**Why bad:** Width, height, margin, and padding changes trigger browser layout reflow (expensive). On a page with 20+ SagraCards, simultaneous hover animations on layout properties cause visible jank on mid-range mobile devices.

**Instead:** Only animate `transform` properties (scale, translateX/Y, rotate) and `opacity`. These are GPU-composited and never trigger reflow. Motion handles this correctly when you use `scale`, `x`, `y`, `rotate`, and `opacity`.

### Anti-Pattern 4: Excessive Animation Duration

**What:** Page transitions lasting 500ms+ or hover animations lasting 300ms+.

**Why bad:** Users perceive animations >200ms as sluggish. Nemovia is a utility app (find sagre quickly), not a portfolio site. Long animations impede the core task.

**Instead:** Page transitions: 200-300ms total. Hover/tap micro-interactions: 100-150ms. Spring-based interactions feel instant because they start fast (high stiffness).

### Anti-Pattern 5: Desktop Layout Via Media Queries in CSS Modules

**What:** Creating separate CSS files with `@media` queries for desktop layout instead of using Tailwind responsive prefixes.

**Why bad:** Introduces a parallel styling system alongside Tailwind, makes responsive behavior harder to reason about, and creates specificity conflicts with Tailwind's utility classes.

**Instead:** Use Tailwind's responsive prefixes (`lg:`, `xl:`) exclusively. The project already uses Tailwind v4 -- adding media queries outside of it creates maintenance burden.

---

## Scalability Considerations

| Concern | Mobile | Tablet (md) | Desktop (lg+) |
|---------|--------|-------------|----------------|
| Card grid columns | 1 | 2 | 3-4 |
| Navigation | BottomNav | BottomNav | DesktopNav (top) |
| Content width | max-w-lg (512px) | max-w-lg (512px) | max-w-4xl to max-w-6xl |
| Page transitions | Crossfade only | Crossfade only | Crossfade + optional slide |
| Micro-interactions | whileTap only | whileTap + whileHover | whileHover primary |
| Skeleton streaming | Full page loading.tsx | Full page loading.tsx | Sectional Suspense |

---

## Sources

### Page Transitions
- [Next.js viewTransition config docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) -- experimental flag, requires React Canary, not recommended for production yet
- [next-view-transitions on GitHub](https://github.com/shuding/next-view-transitions) -- v0.3.5, by Shu Ding (Vercel), MIT license
- [next-view-transitions on npm](https://www.npmjs.com/package/next-view-transitions) -- API surface: ViewTransitions, Link, useTransitionRouter
- [Next.js issue #49279](https://github.com/vercel/next.js/issues/49279) -- App Router breaks Framer Motion shared layout animations (OPEN)
- [FrozenRouter pattern](https://www.imcorfitz.com/posts/adding-framer-motion-page-transitions-to-next-js-app-router) -- workaround using internal LayoutRouterContext (fragile)
- [next-transition-router](https://github.com/ismamz/next-transition-router) -- alternative, 8KB, flexible but heavier

### Responsive Layout
- [Tailwind CSS responsive design docs](https://tailwindcss.com/docs/responsive-design) -- breakpoint system, mobile-first
- [Tailwind CSS v4 container queries](https://www.sitepoint.com/tailwind-css-v4-container-queries-modern-layouts/) -- @container support

### Skeleton / Streaming
- [Next.js streaming docs](https://nextjs.org/docs/14/app/building-your-application/routing/loading-ui-and-streaming) -- loading.tsx, Suspense boundaries
- [Next.js 15 streaming handbook](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/) -- SSR, Suspense, skeleton patterns

### Micro-Interactions
- [Motion gesture docs](https://motion.dev/docs/react-gestures) -- whileHover, whileTap, whileFocus, whileDrag
- [Motion layout animation docs](https://motion.dev/docs/react-layout-animations) -- layoutId, LayoutGroup
- [Motion react component docs](https://motion.dev/docs/react-motion-component) -- motion.div, motion.button
- [Micro-interactions best practices](https://medium.com/better-dev-nextjs-react/micro-interactions-and-micro-animations-that-actually-boost-engagement-not-just-eye-candy-26322653898a) -- engagement patterns
