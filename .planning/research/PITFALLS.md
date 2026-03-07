# Pitfalls Research

**Domain:** UI/UX polish for existing Next.js 15 App Router app (page transitions, responsive desktop layout, skeleton loaders, micro-interactions)
**Researched:** 2026-03-07
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: AnimatePresence Exit Animations Do Not Work in Next.js App Router

**What goes wrong:**
Developers wrap page content with Motion's `<AnimatePresence>` expecting smooth exit animations between route changes. The exit animation never fires. Entry animations work, but the outgoing page is immediately unmounted by the App Router before the exit animation can play. This is not a bug in Motion -- it is a fundamental architectural conflict between Next.js App Router's component lifecycle and AnimatePresence's requirement to delay unmounting.

**Why it happens:**
The Next.js App Router aggressively updates React context during navigation, causing the outgoing page component to unmount instantly. AnimatePresence needs to hold the old component in the DOM while the exit animation plays, but the router tears it down before AnimatePresence gets the chance. This has been a known issue since the App Router launched (GitHub Discussion #42658, Issue #49279) and remains fundamentally unsolved as of Next.js 15.5.

Developers find blog posts and tutorials showing AnimatePresence page transitions that either (a) use the Pages Router (not App Router), (b) use a complex FrozenRouter workaround that freezes the router context, or (c) use `template.tsx` instead of `layout.tsx` which re-mounts the entire tree on every navigation -- defeating the purpose of shared layouts.

**How to avoid:**
Do NOT use AnimatePresence for page transitions with the App Router. Instead, use one of these two approaches:

1. **View Transitions API (recommended):** Enable `experimental: { viewTransition: true }` in `next.config.ts` (available since Next.js 15.2). Import `<ViewTransition>` from React. This uses the browser's native View Transition API which handles the old/new page snapshot automatically. Degrades gracefully in unsupported browsers (navigation still works, just no animation). Nemovia runs Next.js 15.5 which supports this.

2. **Entry-only animations with Motion:** Keep using Motion's `motion.div` with `initial`/`animate` for entry effects (the existing FadeIn/StaggerGrid pattern). Skip exit animations entirely. This is what the codebase already does successfully.

Do NOT use the `next-view-transitions` library (shuding/next-view-transitions). It was a stopgap before native support and adds unnecessary abstraction now that `experimental.viewTransition` exists natively.

**Warning signs:**
- Exit animations that work in dev but fail in production
- Implementing a FrozenRouter wrapper (over-engineering a workaround)
- Page content "flashing" during navigation
- Template.tsx being used where layout.tsx should be (breaks shared state)

**Phase to address:**
Phase: Page Transitions. This must be the first design decision -- choosing View Transitions API vs Motion entry-only determines the entire animation architecture.

---

### Pitfall 2: The max-w-lg Layout Constraint Breaks Desktop

**What goes wrong:**
The current `(main)/layout.tsx` constrains all content to `max-w-lg` (32rem / 512px). This is the right choice for a mobile-first app, but it means that on a 1920px desktop monitor, there is a tiny 512px column of content centered in a vast empty void. Simply removing `max-w-lg` would fix desktop but break the carefully tuned mobile card layouts, spacing, and touch targets. Changing this one class has cascading effects on every page.

**Why it happens:**
Mobile-first development correctly starts with a constrained width. But the constraint is applied at the layout level (the shared `(main)/layout.tsx`), not at the component level. Every page and component within the app implicitly depends on this 512px container. Widening the container means every grid, every card, every skeleton, every filter bar, and every text block needs to be re-evaluated for wider viewports. This is not a "change one line" fix -- it is a layout refactoring.

Specifically in Nemovia:
- `SagraCard` uses `grid-cols-1 sm:grid-cols-2` which only triggers the 2-col layout inside the 512px container -- so `sm:grid-cols-2` never actually activates because the container is narrower than the `sm` breakpoint (640px)
- `StaggerGrid` defaults to `grid grid-cols-1 gap-4 sm:grid-cols-2` -- same problem
- `HomeLoading` skeleton hardcodes `grid-cols-1 gap-4 sm:grid-cols-2` -- must match the actual card grid or the skeleton-to-content transition will cause layout shift
- `BottomNav` is fixed at the bottom full-width -- works on mobile but is wrong on desktop (bottom tabs are a mobile pattern, not desktop)

**How to avoid:**
1. **Use responsive `max-w` at the layout level:** Replace `max-w-lg` with `max-w-lg lg:max-w-5xl xl:max-w-7xl` to widen progressively on larger screens
2. **Or use a breakpoint-aware layout strategy:** On `lg:` and above, switch to a sidebar + main content layout. Keep `max-w-lg` for the content column on mobile, but place it within a flex/grid parent on desktop
3. **Update ALL grid columns responsively:** Every `grid-cols-1 sm:grid-cols-2` needs to become `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` to fill the wider space
4. **Update all skeleton files in sync:** `loading.tsx` skeletons MUST mirror the actual content grid columns at every breakpoint, or the skeleton-to-content swap will cause visible layout shift (hurts CLS)
5. **Hide BottomNav on desktop, show a sidebar or top nav instead:** BottomNav is a mobile pattern. On `lg:` screens, hide it and show navigation in a sidebar or header

**Warning signs:**
- Content looking "lost" in the center of a wide screen
- `sm:grid-cols-2` never activating despite being on a wide viewport (because the container is narrower than `sm`)
- Layout shift when skeleton swaps to content on desktop
- BottomNav looking out of place on desktop monitors

**Phase to address:**
Phase: Responsive Layout. This must be done BEFORE page transitions, because the layout container determines the animation boundaries.

---

### Pitfall 3: Skeleton-to-Content Layout Shift (CLS Regression)

**What goes wrong:**
The existing `loading.tsx` files produce skeleton UIs that do not exactly match the dimensions and grid structure of the actual rendered content. When the server component finishes loading and the skeleton is replaced by real content, elements jump around. This is Cumulative Layout Shift (CLS) -- a Core Web Vital that Google uses for SEO ranking. The current skeletons were designed for the 512px mobile container. If the responsive layout changes the grid columns at desktop breakpoints, the skeletons must change in exactly the same way, or CLS gets worse on desktop.

**Why it happens:**
Skeletons are hand-coded approximations of content. They are written once and then forgotten as the actual components evolve. Common drift:
- Actual card adds a new field (e.g., distance badge), skeleton does not have it
- Grid columns change from 2 to 3 for desktop, skeleton still shows 2 columns
- Card height changes due to content length variation, skeleton has fixed height
- Image aspect ratio differs between skeleton (`h-40`) and actual image (variable)

In Nemovia specifically:
- `SagraCardSkeleton` has `h-40` for image area -- if real images are taller/shorter, CLS occurs
- `HomeLoading` uses `grid-cols-1 gap-4 sm:grid-cols-2` -- must match the responsive columns added during desktop layout work
- `CercaLoading` mirrors the search page but if filters change layout, it drifts
- The map loading skeleton uses `calc(100vh - 10rem)` height -- any change to the layout padding changes this

**How to avoid:**
1. **Co-locate skeleton and component:** When changing a component's layout, immediately update its corresponding skeleton. Treat them as a pair
2. **Use the same Tailwind responsive classes:** If the card grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, the skeleton grid MUST use the exact same classes
3. **Use aspect-ratio for image placeholders:** Instead of fixed `h-40`, use `aspect-[16/10]` or `aspect-video` so the placeholder scales with container width
4. **Test CLS explicitly:** Use Chrome DevTools Performance tab or Lighthouse to measure CLS before and after changes. Target CLS < 0.1
5. **Reserve space for dynamic elements:** If a badge or tag row might or might not appear, always reserve its space in both skeleton and component

**Warning signs:**
- Visible "jump" when loading completes, especially on desktop viewports
- Skeleton showing 2 columns but content rendering 3 columns on desktop
- Lighthouse CLS score increasing above 0.1
- Users on fast connections seeing a brief flash of differently-sized skeleton

**Phase to address:**
Phase: Responsive Layout (update skeletons alongside layout changes). Must be verified in each phase that modifies layout.

---

### Pitfall 4: Motion Animations on Every Element Kills Mobile Performance

**What goes wrong:**
Wrapping every card, every filter chip, every list item in `<FadeIn>` or `<motion.div>` creates dozens of simultaneously animating elements on scroll. On mid-range Android phones (the typical sagre-searching user's device), this causes dropped frames, scroll jank, and battery drain. The app feels sluggish instead of premium.

**Why it happens:**
On desktop with a discrete GPU, 20 simultaneous animations are imperceptible. On a Redmi Note or Samsung A-series (very common in Italy), the same 20 animations overwhelm the mobile GPU. Motion's spring physics run on every frame via requestAnimationFrame. Each `whileInView` triggers an IntersectionObserver callback plus animation start. With 20+ cards in a search result list, scrolling triggers a cascade of animation starts.

The existing `StaggerGrid` uses `whileInView` with `viewport: { once: true }` which is correct (animate once, not on every scroll pass). But adding MORE animation wrappers around individual elements within the grid compounds the problem.

**How to avoid:**
1. **Animate containers, not individual items:** Use `StaggerGrid` on the grid container. Do NOT also wrap each `SagraCard` in its own `<FadeIn>`. The stagger variant propagation handles individual items
2. **Limit simultaneous animations:** No more than 8-10 elements animating at the same time. The current `staggerChildren: 0.08` with 4-6 visible cards is fine. With 12+ cards visible on desktop, increase stagger delay to `0.05` so animations complete before the next batch starts
3. **Only animate transform and opacity:** Never animate `width`, `height`, `padding`, `margin`, `border-radius`, or `background-color` with Motion. These trigger layout recalculation on every frame. The existing animations correctly use `opacity` and `y` (transform) -- keep it that way
4. **Use `will-change: transform` sparingly:** Motion adds this automatically, but too many elements with `will-change` allocated creates GPU memory pressure on mobile. Let Motion manage it; do not add it manually in CSS
5. **Respect `prefers-reduced-motion`:** Wrap the app in `<MotionConfig reducedMotion="user">`. This automatically disables transform/layout animations for users who have set reduced motion in their OS settings (iOS, Android, macOS, Windows all support this). Motion will still animate opacity which is accessibility-safe
6. **Use `LazyMotion` for bundle size:** Replace global `motion` imports with `m` components + `<LazyMotion features={domAnimation}>`. This reduces Motion's initial bundle from ~34kb to ~5kb. The full feature set loads asynchronously after first render

**Warning signs:**
- Scroll FPS dropping below 30fps on mobile (test in Chrome DevTools Performance with CPU 4x throttling)
- Animations "catching up" after scroll stops (queued animation callbacks)
- Battery temperature increasing during extended browsing
- Users on older phones reporting the app feels "heavy"

**Phase to address:**
Phase: Micro-interactions. Add a performance budget: test every animation addition with Chrome DevTools CPU throttle at 4x on a card grid of 20+ items.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `motion` instead of `m` + `LazyMotion` | Simpler imports, faster dev | 34kb bundle vs 5kb, slower first load | MVP only, must fix in polish phase |
| Hardcoded skeleton dimensions (`h-40`, `h-48`) | Quick to write | CLS drift when real content dimensions change | Never -- use aspect-ratio from the start |
| `max-w-lg` at layout level for all pages | Clean mobile-first constraint | Blocks desktop layout, forces global refactor later | Only until desktop layout phase |
| CSS transitions instead of Motion for hover effects | Zero bundle impact, simpler | Two animation systems to maintain (Motion + CSS) | Always acceptable for hover/focus states -- CSS transitions are better for these |
| Skipping `prefers-reduced-motion` | Faster development | Accessibility violation, excludes users with vestibular disorders | Never -- add MotionConfig on day one of animation work |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Motion + Next.js App Router | Using AnimatePresence for page exit animations | Use View Transitions API or entry-only animations |
| Motion + Server Components | Importing `motion` in a server component file | All Motion components MUST be in `"use client"` files. The existing FadeIn.tsx and StaggerGrid.tsx correctly have `"use client"` -- keep this pattern for any new animation wrappers |
| View Transitions API + nuqs | `startTransition` conflicting with nuqs URL state updates | View Transitions require wrapping state updates in React's `startTransition`. nuqs also manages URL state. Test that filter changes in Cerca don't trigger unintended view transitions |
| Leaflet + responsive container resize | Map tiles go grey when container width changes (desktop layout switch) | Call `map.invalidateSize()` after any container resize. Use a ResizeObserver on the map container, not just window resize |
| Tailwind v4 responsive + existing `sm:` prefixes | `sm:grid-cols-2` never activating because container is narrower than 640px | The `sm:` breakpoint checks viewport width, not container width. Inside a `max-w-lg` (512px) container, `sm:grid-cols-2` activates when the viewport is >= 640px, which CAN happen on mobile landscape. Once the max-width constraint is relaxed for desktop, re-evaluate all responsive breakpoints |
| Skeleton `loading.tsx` + View Transitions | View transition capturing the skeleton-to-content swap as an animation | Ensure view-transition-name is NOT set on skeleton elements, only on final content. Otherwise the browser animates the skeleton disappearing, creating visual noise |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Too many `whileInView` observers | Scroll jank, high JS main thread time | Limit to containers only (StaggerGrid), not individual cards | > 15 observed elements on screen simultaneously |
| Spring animations with high stiffness | Elements "vibrate" on low-powered devices, animation never settles | Use `damping: 20, stiffness: 200` (current values are good). Avoid `stiffness > 300` | Mid-range Android phones (Snapdragon 600 series) |
| Animating background-color or box-shadow | Triggers paint on every frame, visible jank on scroll | Use opacity changes on overlay pseudo-elements instead. Or use CSS transitions (not Motion) for hover states | Any device with > 10 simultaneous animations |
| View Transition on large DOM trees | Transition captures entire viewport as bitmap, causes frame drop on low-memory devices | Apply `view-transition-name` only to specific elements (hero image, card, page title), not to wrapper divs | Mobile devices with < 4GB RAM |
| Multiple animation libraries (Motion + CSS @keyframes + View Transitions) | Conflicting animation timing, unexpected visual artifacts, larger bundle | Use Motion for component animations, View Transitions for page transitions, CSS for hover states only. No overlap | Any complexity level -- decide boundaries early |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Animation delay before content is interactive | User taps a card during its entrance animation, tap is swallowed | Keep animation durations under 300ms. Ensure elements are interactive immediately, animate visuals only (opacity/transform) |
| BottomNav visible on desktop | Wastes screen space, looks like a mobile app running in a desktop browser | Hide BottomNav at `lg:` breakpoint. Show a sidebar nav or header nav on desktop. Use `className="lg:hidden"` on BottomNav wrapper |
| Page transition animation on back button | User presses back expecting instant return, gets a 500ms transition delay | Make back navigation instant (no transition) or use a faster reverse transition (200ms vs 400ms forward) |
| Skeleton that looks nothing like final content | User's mental model breaks, perceived loading time increases | Match skeleton structure exactly: same grid columns, same card proportions, same section order |
| Hover effects on touch devices | `:hover` state sticks on mobile after tap, elements stay "highlighted" | Use `@media (hover: hover)` to restrict hover effects to pointer devices. Tailwind: use `hover:` which Tailwind v4 automatically restricts to hover-capable devices |
| Animation on page load competing with LCP | Largest Contentful Paint delayed by entrance animation | Do NOT animate the hero section or first visible card grid on initial page load. Let them render instantly. Animate only below-the-fold content |

## "Looks Done But Isn't" Checklist

- [ ] **Responsive layout:** Tested on actual 1920px monitor, not just Chrome DevTools responsive mode (DevTools does not accurately simulate desktop rendering, especially for font sizes and hover states)
- [ ] **Skeleton-to-content transition:** Recorded on video at 0.5x speed to verify no layout shift occurs at any breakpoint
- [ ] **BottomNav on desktop:** Hidden on lg: screens AND replaced with an alternative navigation (sidebar, header) -- not just hidden with no replacement
- [ ] **Map resize on desktop:** Leaflet map renders correctly after responsive layout changes container width. Grey tiles indicate `invalidateSize()` was not called
- [ ] **prefers-reduced-motion:** Tested with "Reduce motion" enabled in OS settings. Animations should be disabled or replaced with simple opacity fades
- [ ] **View Transitions browser fallback:** Tested in Firefox (which may not support view transitions for same-document navigation). Navigation must still work, just without animation
- [ ] **Touch vs pointer hover:** Hover effects do not "stick" on iOS Safari after tap. Test by tapping a card and then scrolling away -- the hover highlight should disappear
- [ ] **Performance on throttled CPU:** Chrome DevTools > Performance > CPU 4x slowdown. Scroll through 20+ cards. FPS should stay above 30
- [ ] **Bundle size impact:** After adding animations and responsive components, first-load JS should not exceed 200KB. Check with `npx next build` output or `@next/bundle-analyzer`
- [ ] **Skeleton grid columns match content:** At EVERY breakpoint (mobile, tablet, desktop), the skeleton shows the same number of columns as the final content grid

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| AnimatePresence used for page transitions (does not work) | MEDIUM | Remove AnimatePresence wrappers, enable viewTransition in next.config, add ViewTransition to layout. 1-2 hours of refactoring |
| max-w-lg removed globally without updating grids | LOW | Add responsive max-width classes to layout, update grid columns across all pages. 2-3 hours |
| Skeleton CLS regression | LOW | Audit all loading.tsx files, match grid columns and aspect ratios to actual components. 1-2 hours per page |
| Motion performance issues on mobile | MEDIUM | Switch from `motion` to `m` + LazyMotion, remove per-item animations, add MotionConfig reducedMotion. 3-4 hours |
| Multiple conflicting animation systems | HIGH | Choose one system per concern (View Transitions for pages, Motion for components, CSS for hover). Remove conflicts. 4-8 hours, requires design decisions |
| Leaflet map grey tiles after responsive resize | LOW | Add ResizeObserver calling invalidateSize(). 30 minutes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| AnimatePresence does not work in App Router | Page Transitions | Navigate between all routes, verify smooth transition or graceful fallback |
| max-w-lg breaks desktop | Responsive Layout | View every page at 1920px, 1440px, 1024px, 768px, 375px widths |
| Skeleton CLS regression | Responsive Layout (update skeletons with layout) | Lighthouse CLS score < 0.1 on all pages at all breakpoints |
| Animation performance on mobile | Micro-interactions | Chrome DevTools Performance recording with 4x CPU throttle, 30+ FPS during scroll |
| Motion bundle size | Micro-interactions | `npx next build` reports first-load JS < 200KB |
| prefers-reduced-motion not respected | Micro-interactions (first animation phase) | Toggle OS reduced motion setting, verify animations stop |
| BottomNav on desktop | Responsive Layout | At lg: breakpoint, BottomNav hidden, alternative nav visible |
| Leaflet grey tiles on resize | Responsive Layout | Resize browser window with map visible, no grey tiles |
| View Transitions + nuqs conflict | Page Transitions | Change filters on Cerca page, verify no unintended page-level transition animation |
| Hover sticking on touch devices | Micro-interactions | Test on real iOS/Android device, tap card then scroll away |

## Sources

### Next.js App Router + Page Transitions
- [Next.js Discussion #42658: How to animate route transitions in app directory?](https://github.com/vercel/next.js/discussions/42658) - HIGH confidence (official Next.js discussion, 300+ comments confirming the issue)
- [Next.js Issue #49279: App router issue with Framer Motion shared layout animations](https://github.com/vercel/next.js/issues/49279) - HIGH confidence (official issue tracker)
- [Next.js viewTransition config docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) - HIGH confidence (official docs, confirms experimental status, requires >= 15.2)
- [Solving Framer Motion Page Transitions in Next.js App Router](https://www.imcorfitz.com/posts/adding-framer-motion-page-transitions-to-next-js-app-router) - MEDIUM confidence (community solution using FrozenRouter workaround)

### View Transitions API
- [MDN: View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) - HIGH confidence (official MDN docs)
- [View Transitions in React, Next.js, and Multi-Page Apps](https://rebeccamdeprey.com/blog/view-transition-api) - MEDIUM confidence (comprehensive overview with browser support table)
- [React ViewTransition component](https://certificates.dev/blog/react-viewtransition-smooth-animations-made-simple) - MEDIUM confidence (documents the experimental React API)

### Motion Performance
- [Motion: Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) - HIGH confidence (official Motion docs: m + LazyMotion reduces from 34kb to ~5kb)
- [Motion: LazyMotion](https://motion.dev/docs/react-lazy-motion) - HIGH confidence (official docs for domAnimation vs domMax feature packages)
- [Motion: Accessibility / Reduced Motion](https://motion.dev/docs/react-accessibility) - HIGH confidence (official docs for MotionConfig reducedMotion)

### Tailwind v4 Responsive
- [Tailwind CSS v4: Responsive Design](https://tailwindcss.com/docs/responsive-design) - HIGH confidence (official docs, confirms mobile-first approach and breakpoint-range stacking)
- [Tailwind CSS v4: Breaking change discussion #16340](https://github.com/tailwindlabs/tailwindcss/discussions/16340) - MEDIUM confidence (community discussion on v4 breakpoint changes)

### Skeleton / Loading / CLS
- [Next.js: loading.js file convention](https://nextjs.org/docs/app/api-reference/file-conventions/loading) - HIGH confidence (official docs)
- [Next.js Issue #59521: Suspense Boundary in Root Layout breaks core features](https://github.com/vercel/next.js/issues/59521) - HIGH confidence (official issue, documents root layout Suspense pitfall)
- [Josh W. Comeau: prefers-reduced-motion in React](https://www.joshwcomeau.com/react/prefers-reduced-motion/) - HIGH confidence (authoritative React accessibility guide)

### Leaflet Responsive
- [react-leaflet Issue #340: Map size not invalidated on height/width change](https://github.com/PaulLeCam/react-leaflet/issues/340) - HIGH confidence (official react-leaflet issue)
- [Leaflet Issue #6051: Preventing change of map center upon invalidateSize](https://github.com/Leaflet/Leaflet/issues/6051) - HIGH confidence (official Leaflet issue)

---
*Pitfalls research for: Nemovia v1.2 "Polish" -- UI/UX polish features*
*Researched: 2026-03-07*
