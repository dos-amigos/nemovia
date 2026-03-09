# Phase 13: Transitions + Micro-Interactions - Research

**Researched:** 2026-03-09
**Domain:** Motion animations, scroll effects, micro-interactions, skeleton shimmer
**Confidence:** HIGH

## Summary

Phase 13 adds animation polish to Nemovia using the Motion library (v12.35.0, already installed) and CSS. The project already has a solid animation foundation: `MotionConfig reducedMotion="user"` in `Providers.tsx`, `FadeIn` and `StaggerGrid` animation components, and a global CSS `@media (prefers-reduced-motion: reduce)` rule. The work divides into four clean domains: (1) page transitions via a `template.tsx` with AnimatePresence + FrozenRouter pattern, (2) gesture micro-interactions using `whileHover`/`whileTap` on cards, badges, buttons, and BottomNav, (3) scroll-linked animations using `useScroll`/`useTransform` for progress bar, parallax, and section reveals, and (4) CSS shimmer for skeleton loaders.

A critical finding: **TRANS-02 (shared element transition)** cannot be implemented as a true cross-page `layoutId` morph because Next.js App Router has an open, unresolved architectural issue (vercel/next.js#49279) that prevents shared layout animations across routes. The `viewTransition` experimental flag exists in Next.js but is explicitly "not recommended for production." The REQUIREMENTS.md Out of Scope section already anticipated this by deferring "Shared element transitions (advanced)" to v1.3. TRANS-02 should be implemented as a **simulated morph** -- an exit scale-up animation on the card image area that gives the visual impression of expanding into the detail hero, without true element sharing.

**Primary recommendation:** Use Motion for all interactive animations (whileHover, whileTap, useScroll, AnimatePresence), pure CSS for skeleton shimmer, and a template.tsx FrozenRouter pattern for page cross-fades. Keep all animations under 300ms to maintain the utility-app speed mandate from Out of Scope.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRANS-01 | Smooth cross-fade transition between pages | AnimatePresence + FrozenRouter in template.tsx (see Page Transitions pattern) |
| TRANS-02 | Card image morph into detail hero | Simulated morph via exit animation (true layoutId blocked by Next.js #49279) |
| MICRO-01 | Card lift effect (scale + shadow) on hover | motion.div whileHover with scale + boxShadow (see Card Hover pattern) |
| MICRO-02 | Tap feedback (scale down) on mobile cards | motion.div whileTap={{ scale: 0.97 }} (see Tap Feedback pattern) |
| MICRO-03 | Press animation on action buttons | whileTap={{ scale: 0.95 }} on DirectionsButton, ShareButton, filter chips |
| MICRO-04 | BottomNav icon animation on selection | motion.div with layoutId for active indicator + icon spring bounce |
| MICRO-05 | Images fade in on load | next/image onLoad + useState + CSS opacity transition (see Image Fade pattern) |
| MICRO-06 | Food tag badges scale + brighten on hover | whileHover={{ scale: 1.05, brightness: 1.1 }} or CSS hover:brightness-110 |
| SKEL-01 | Shimmer animation on skeleton loaders | CSS @keyframes shimmer with background-position animation (see Shimmer pattern) |
| SCRL-01 | Section reveal with directional variety | Extend FadeIn with direction prop (up/left/right) using whileInView |
| SCRL-02 | Scroll progress bar on detail page | useScroll + useSpring + motion.div scaleX (see Scroll Progress pattern) |
| SCRL-03 | Parallax on hero section | useScroll + useTransform mapping scrollY to y offset (see Parallax pattern) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.35.0 | All interactive animations | Already installed, powers existing FadeIn/StaggerGrid. Imports from `motion/react` |
| Tailwind CSS | 4.x | CSS transitions, shimmer keyframes | Already installed, native hover/transition utilities |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tw-animate-css | 1.4.0 | Tailwind animation presets | Already installed as devDependency |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion for page transitions | Next.js experimental viewTransition | viewTransition is experimental, not production-ready, limited browser support (Chrome/Edge 126+ only, no Safari/Firefox) |
| Motion for shimmer | CSS @keyframes | CSS is better -- no JS overhead, works with reduced-motion media query already in globals.css |
| Motion layoutId for TRANS-02 | React ViewTransition | Blocked by Next.js App Router architecture (issue #49279), experimental |

**Installation:**
```bash
# No new dependencies needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    animations/
      FadeIn.tsx            # EXISTING -- extend with direction prop
      StaggerGrid.tsx       # EXISTING -- no changes needed
      PageTransition.tsx    # NEW -- AnimatePresence + FrozenRouter wrapper
      ScrollReveal.tsx      # NEW -- directional scroll-triggered reveals
      ScrollProgress.tsx    # NEW -- fixed progress bar for detail page
      ParallaxHero.tsx      # NEW -- parallax wrapper for hero sections
    sagra/
      SagraCard.tsx         # MODIFY -- wrap with motion.div for hover/tap
    detail/
      SagraDetail.tsx       # MODIFY -- add scroll progress + parallax
    layout/
      BottomNav.tsx         # MODIFY -- add icon animation
    ui/
      skeleton.tsx          # MODIFY -- add shimmer class
  app/
    (main)/
      template.tsx          # NEW -- page transition wrapper
```

### Pattern 1: Page Transitions via template.tsx + FrozenRouter
**What:** Wrap page content in AnimatePresence with a FrozenRouter to prevent context teardown during exit animations.
**When to use:** For TRANS-01 cross-fade between all pages under (main) route group.
**Why template.tsx:** Unlike layout.tsx (persists between routes), template.tsx remounts on every navigation, making it ideal for enter/exit animations.

```typescript
// Source: https://www.imcorfitz.com/posts/adding-framer-motion-page-transitions-to-next-js-app-router
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSelectedLayoutSegment } from "next/navigation";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useEffect, useRef } from "react";

function usePreviousValue<T>(value: T): T | undefined {
  const prevValue = useRef<T>();
  useEffect(() => {
    prevValue.current = value;
    return () => { prevValue.current = undefined; };
  });
  return prevValue.current;
}

function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const prevContext = usePreviousValue(context) || null;
  const segment = useSelectedLayoutSegment();
  const prevSegment = usePreviousValue(segment);
  const changed = segment !== prevSegment && segment !== undefined && prevSegment !== undefined;
  return (
    <LayoutRouterContext.Provider value={changed ? prevContext : context}>
      {children}
    </LayoutRouterContext.Provider>
  );
}

export default function Template({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={segment}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
```

**Critical note:** Import `LayoutRouterContext` from `next/dist/shared/lib/app-router-context.shared-runtime`. This is an internal Next.js export -- it works but is not part of the public API. Pin the Next.js version (15.5.12) to avoid breakage.

### Pattern 2: Card Hover + Tap Micro-Interactions
**What:** Wrap SagraCard content in a motion.div with gesture props.
**When to use:** MICRO-01 (desktop hover lift) and MICRO-02 (mobile tap feedback).

```typescript
// SagraCard.tsx -- add motion wrapper
import { motion } from "motion/react";

// Inside the Link, wrap Card with:
<motion.div
  whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  <Card className="overflow-hidden py-0">
    {/* existing card content */}
  </Card>
</motion.div>
```

**Key:** whileHover only fires on pointer devices (desktop), whileTap fires on both touch and mouse -- this gives us MICRO-01 + MICRO-02 in one motion.div.

### Pattern 3: Scroll Progress Bar
**What:** Fixed bar at top of detail page showing scroll progress.
**When to use:** SCRL-02 on the sagra detail page.

```typescript
// Source: motion.dev/docs/react-use-scroll
"use client";

import { motion, useScroll, useSpring } from "motion/react";

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-[60]"
      style={{ scaleX }}
    />
  );
}
```

### Pattern 4: Parallax Hero
**What:** Subtle vertical offset on hero background relative to scroll.
**When to use:** SCRL-03 on the detail page hero image.

```typescript
"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

export function ParallaxHero({ children }: { children: React.ReactNode }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
```

### Pattern 5: Directional Scroll Reveal
**What:** Extend existing FadeIn to support direction variants (up, left, right).
**When to use:** SCRL-01 for section reveals on the detail page and home page.

```typescript
"use client";

import { motion } from "motion/react";

type Direction = "up" | "left" | "right";

const offsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 24 },
  left: { x: -24, y: 0 },
  right: { x: 24, y: 0 },
};

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
}

export function ScrollReveal({ children, direction = "up", delay = 0, className }: ScrollRevealProps) {
  const offset = offsets[direction];
  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
```

### Pattern 6: CSS Shimmer for Skeletons
**What:** Replace animate-pulse with a shimmer gradient sweep.
**When to use:** SKEL-01 on all Skeleton components.

```css
/* globals.css -- add shimmer keyframes */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@layer utilities {
  .animate-shimmer {
    background: linear-gradient(
      90deg,
      var(--muted) 25%,
      oklch(0.95 0.001 106) 37%,
      var(--muted) 63%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animate-shimmer {
    animation: none;
  }
}
```

Then update `skeleton.tsx` to use `animate-shimmer` instead of `animate-pulse`.

### Pattern 7: Image Fade-In on Load
**What:** Images start transparent and fade to full opacity when loaded.
**When to use:** MICRO-05 on all next/image components in cards and detail page.

```typescript
"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

export function FadeImage({ className, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      {...props}
      className={cn(
        "transition-opacity duration-500 ease-in-out",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      onLoad={() => setLoaded(true)}
    />
  );
}
```

**Note:** SagraCard is currently a Server Component. Adding state for image fade requires either: (a) extracting a `FadeImage` client component, or (b) converting SagraCard to `"use client"`. Option (a) is better -- keeps card as server component, only the image is client.

### Pattern 8: BottomNav Icon Animation
**What:** Animate the active tab indicator and icon on selection.
**When to use:** MICRO-04 on BottomNav.

```typescript
// BottomNav.tsx -- add motion to active icon
import { motion } from "motion/react";

// Inside the tab map:
<Icon className="h-5 w-5" />
{isActive && (
  <motion.div
    className="absolute bottom-0 h-0.5 w-6 bg-primary rounded-full"
    layoutId="bottomnav-indicator"
    transition={{ type: "spring", stiffness: 500, damping: 35 }}
  />
)}
```

**Key:** `layoutId="bottomnav-indicator"` creates a smooth sliding animation between tabs because the active indicator shares the same layoutId across renders.

### Anti-Patterns to Avoid
- **Complex page enter/exit animations (>300ms):** Out of Scope states these "hurt utility app speed." Keep cross-fades at 150ms.
- **True cross-route layoutId morphs:** Architecturally broken in Next.js App Router (#49279). Do not attempt.
- **Motion for skeleton shimmer:** Pure CSS is lighter, more reliable, and already integrates with the existing prefers-reduced-motion rule.
- **Converting server components to client needlessly:** Use FadeImage as a small client component instead of making entire SagraCard a client component.
- **Importing LayoutRouterContext from wrong path:** Must be from `next/dist/shared/lib/app-router-context.shared-runtime`, not other internal paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page transitions | Custom route change listeners | AnimatePresence + FrozenRouter pattern | Handles React lifecycle edge cases, prevents flash of unmounted content |
| Scroll progress | IntersectionObserver + manual calc | Motion useScroll + useSpring | Returns reactive motion values, automatic spring smoothing, GPU-accelerated |
| Parallax scrolling | scroll event + requestAnimationFrame | Motion useScroll + useTransform | Automatic throttling, transform-only for 60fps, no layout thrashing |
| Reduced motion gating | Per-component media query checks | MotionConfig reducedMotion="user" (already set) | Global single-point control, all Motion animations auto-suppressed |
| Shimmer animation | JS-driven gradient | CSS @keyframes + animate-shimmer | Zero JS cost, natively supports reduced-motion media query |

**Key insight:** The existing `MotionConfig reducedMotion="user"` in Providers.tsx already handles A11Y-01 compliance for all Motion-powered animations. CSS shimmer needs its own `@media (prefers-reduced-motion: reduce)` rule (matching the existing pattern in globals.css).

## Common Pitfalls

### Pitfall 1: FrozenRouter Internal Import Breaking on Next.js Update
**What goes wrong:** `LayoutRouterContext` is imported from `next/dist/shared/lib/app-router-context.shared-runtime`, which is not a public API.
**Why it happens:** Next.js could move or rename this internal export in any minor release.
**How to avoid:** Pin Next.js to 15.5.12 in package.json (already done with `^` -- but test before updating). Document the dependency.
**Warning signs:** Build error mentioning "Cannot find module" for the shared-runtime path.

### Pitfall 2: SagraCard as Server Component vs. Client Component
**What goes wrong:** Adding whileHover/whileTap requires motion.div which needs "use client", but SagraCard is currently a Server Component.
**Why it happens:** SagraCard has no "use client" directive and no hooks/state.
**How to avoid:** Convert SagraCard to a client component (it is trivial -- no data fetching, just rendering props). Its parent (StaggerGrid) is already a client component, so this changes nothing about the rendering tree.
**Warning signs:** Build error about using motion in a server component.

### Pitfall 3: Shimmer Animation Overriding animate-pulse Without Updating Reduced-Motion
**What goes wrong:** Replace animate-pulse with animate-shimmer but forget to add animate-shimmer to the reduced-motion rule.
**Why it happens:** The existing CSS only suppresses animate-pulse and animate-spin.
**How to avoid:** Add `.animate-shimmer { animation: none; }` inside the existing `@media (prefers-reduced-motion: reduce)` block.
**Warning signs:** Users with reduced-motion preference still see moving shimmer.

### Pitfall 4: Page Transition Delay Accumulating with Data Fetching
**What goes wrong:** Cross-fade exit animation (150ms) + server data fetch (variable) + enter animation (150ms) creates perceived 400ms+ delay.
**Why it happens:** AnimatePresence `mode="wait"` holds old content during exit, then Next.js fetches, then enter plays.
**How to avoid:** Keep transition durations short (100-150ms). Use `initial={false}` on AnimatePresence to skip enter animation on first render.
**Warning signs:** Navigating between pages feels sluggish despite fast data fetching.

### Pitfall 5: Parallax Conflicting with Sticky Detail Left Column
**What goes wrong:** The detail page left column uses `lg:sticky lg:top-20`. Parallax on the hero image inside a sticky container can produce jarring scroll behavior.
**Why it happens:** Sticky positioning and transform-based parallax interact unpredictably.
**How to avoid:** Only apply parallax on mobile (where the layout is single-column, no sticky). On desktop, skip parallax or apply it only to the right column sections.
**Warning signs:** Hero image jitters or detaches from expected scroll position on desktop.

### Pitfall 6: onLoad Not Firing for Cached Images
**What goes wrong:** FadeImage stays at opacity-0 because the browser loaded the image from cache without firing onLoad.
**Why it happens:** Some browsers skip the load event for cached images.
**How to avoid:** Initialize `loaded` to `false`, but also check `img.complete` on mount via a ref. Or use `onLoadingComplete` (Next.js specific callback) which is more reliable.
**Warning signs:** Images invisible on back-navigation or repeat visits.

## Code Examples

### Complete Skeleton Shimmer (SKEL-01)
```typescript
// src/components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

### TRANS-02 Simulated Morph (Exit Animation)
```typescript
// On SagraCard, add exit variant:
// When navigating to detail, the card scales up slightly before fading
<motion.div
  whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
  whileTap={{ scale: 0.97 }}
  // Exit creates a brief scale-up + fade effect
  exit={{ scale: 1.05, opacity: 0, transition: { duration: 0.15 } }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
  <Card>...</Card>
</motion.div>
```

### Badge Hover (MICRO-06)
```typescript
// Wrap Badge in motion.span or add CSS hover effect
// CSS approach (simpler, keeps Badge as server component):
// In badge.tsx, add to secondary variant:
"hover:scale-105 hover:brightness-110 transition-transform"
```

### BottomNav Active Indicator (MICRO-04)
```typescript
"use client";
import { motion } from "motion/react";

// Inside tab render:
<div className="relative flex flex-col items-center gap-1 px-3 py-2">
  <Icon className="h-5 w-5" />
  <span className="text-xs">{label}</span>
  {isActive && (
    <motion.div
      layoutId="bottomnav-active"
      className="absolute -bottom-1 h-0.5 w-8 rounded-full bg-primary"
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
    />
  )}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion package | motion package (import from "motion/react") | Late 2024 | Same API, new package name -- project already uses new name |
| animate-pulse skeleton | CSS shimmer gradient sweep | 2023-2024 | Much more premium feel, industry standard for content loading |
| scroll event listeners | useScroll + useTransform (Motion) | 2023+ | Declarative, GPU-accelerated, no manual rAF management |
| CSS :hover only | Motion whileHover/whileTap gesture props | 2022+ | Spring physics, works with reduced-motion, touch-aware |
| ViewTransition API | Still experimental in Next.js | 2025-2026 | Not production-ready, limited browser support -- use Motion AnimatePresence |

**Deprecated/outdated:**
- `useViewportScroll()`: Replaced by `useScroll()` in Motion v10+. Project should use `useScroll()`.
- `AnimateSharedLayout`: Removed. Use `LayoutGroup` component instead if needed.

## Open Questions

1. **TRANS-02 Scope Clarification**
   - What we know: True cross-page layoutId morph is blocked by Next.js architecture. Out of Scope says "advanced" shared element transitions deferred to v1.3.
   - What's unclear: Does the user accept a simulated morph (exit scale-up animation) as satisfying TRANS-02, or does this need discussion?
   - Recommendation: Implement the simulated morph. It provides 80% of the visual impact with zero architectural risk. The exit animation on the card + enter animation on the detail hero creates a perceptual continuity that most users cannot distinguish from a true morph.

2. **Parallax on Desktop Detail Page**
   - What we know: The left column is `lg:sticky`, which conflicts with transform-based parallax.
   - What's unclear: Whether to apply parallax only on mobile, or restructure the detail layout.
   - Recommendation: Apply parallax to the hero on mobile only. On desktop, use a subtle fade/scale reveal instead. This avoids sticky-vs-transform conflicts.

3. **LayoutRouterContext Stability**
   - What we know: This is an internal Next.js export required for the FrozenRouter pattern.
   - What's unclear: Whether Next.js 15.5.x will maintain this path long-term.
   - Recommendation: Proceed with the current path. The import has been stable since Next.js 13 and is widely used in the community. Document it as a known dependency.

## Sources

### Primary (HIGH confidence)
- [Motion official docs - Scroll Animations](https://motion.dev/docs/react-scroll-animations) - useScroll, useTransform, parallax patterns
- [Motion official docs - Gestures](https://motion.dev/docs/react-gestures) - whileHover, whileTap, whileFocus
- [Motion official docs - useScroll](https://motion.dev/docs/react-use-scroll) - scrollYProgress, spring smoothing
- [Next.js viewTransition docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) - experimental status confirmed, not production-ready
- [Next.js issue #49279](https://github.com/vercel/next.js/issues/49279) - layoutId across routes OPEN, unresolved as of Dec 2025

### Secondary (MEDIUM confidence)
- [imcorfitz.com - Solving Framer Motion Page Transitions](https://www.imcorfitz.com/posts/adding-framer-motion-page-transitions-to-next-js-app-router) - FrozenRouter + template.tsx pattern, verified working
- [vercel/next.js Discussion #42658](https://github.com/vercel/next.js/discussions/42658) - Community consensus on AnimatePresence approach
- [Framer Motion Complete Guide 2026](https://inhaq.com/blog/framer-motion-complete-guide-react-nextjs-developers.html) - Confirmed Motion 12.x API stability

### Tertiary (LOW confidence)
- CSS shimmer `background-attachment: fixed` technique for synchronized shimmer across elements -- multiple blog sources, untested in Tailwind v4 context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Motion 12.35.0 already installed and in use, no new deps needed
- Architecture (page transitions): HIGH - FrozenRouter pattern well-documented, template.tsx approach verified by multiple sources
- Architecture (TRANS-02 limitation): HIGH - Next.js issue #49279 is confirmed open, multiple sources agree layoutId cross-route is broken
- Micro-interactions: HIGH - whileHover/whileTap are core Motion APIs, extensively documented
- Scroll animations: HIGH - useScroll/useTransform are stable Motion APIs with official examples
- Skeleton shimmer: HIGH - Pure CSS approach, well-established pattern
- Pitfalls: MEDIUM - FrozenRouter internal import stability is a known risk but widely used

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- Motion 12.x and Next.js 15.x are mature)
