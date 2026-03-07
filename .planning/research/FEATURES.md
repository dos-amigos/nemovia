# Feature Landscape

**Domain:** UI/UX polish for food festival (sagre) aggregator -- page transitions, responsive desktop, micro-interactions
**Researched:** 2026-03-07
**Milestone:** v1.2 "Polish"

## Existing State Assessment

What Nemovia already has that this milestone builds on:

| Existing Feature | Status | Relevance to v1.2 |
|------------------|--------|-------------------|
| Motion (framer-motion) library | Installed (v12.35) | Foundation for all animations -- page transitions, hover, scroll |
| FadeIn animation wrapper | Built | Extend with more variants (slide, scale) |
| StaggerGrid animation | Built | Enhance with responsive column counts |
| Skeleton UI component (Shadcn) | Built | Base for shimmer enhancement |
| SagraCardSkeleton | Built | Content-aware skeleton, already matches card layout |
| loading.tsx files (Home, Cerca, Mappa, Detail) | Built | Already using Next.js Suspense streaming |
| BackButton component | Built | Bug fix target -- works but needs visibility improvements |
| Image placeholder on SagraCard | Built (gradient + icon) | Missing on detail page -- bug fix |
| BottomNav | Built (mobile) | Needs desktop sidebar alternative |
| max-w-lg container | Built | Desktop bottleneck -- needs responsive widening |

---

## Table Stakes

Features users expect for a polished, modern web app in 2026. Missing = app feels cheap or broken.

### Bug Fixes (existing broken expectations)

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Back button on detail page (already built)** | Already implemented as BackButton.tsx with router.back(). Bug was listed in PROJECT.md but component exists. Verify it renders correctly and is accessible. | Low | None -- verify only |
| **Image placeholder on detail page** | SagraCard already has a gradient+icon placeholder when image_url is null. Detail page should match. Inconsistency breaks trust. | Low | None -- SagraDetail.tsx already handles this (line 47-49). Verify it works. |
| **"TUTTE" province filter selected by default on Cerca** | User opens Cerca and sees no results because no province is selected. Default should show all provinces. Standard behavior for any filter UI. | Low | SearchFilters.tsx -- set initial state to "TUTTE" or empty (meaning all) |
| **Responsive desktop layout** | 50%+ of Italian web traffic is desktop. Current max-w-lg (32rem/512px) creates a narrow phone-width column on desktop. Desktop users expect content to fill available width. | Medium | Layout.tsx -- responsive max-w, grid columns, sidebar |

### Skeleton Loading Quality

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Shimmer effect on skeletons** | Static gray blocks feel frozen/broken. Shimmer (animated gradient sweep) signals "loading" and reduces perceived wait time by ~30%. Every premium app (Instagram, Airbnb, Google) uses shimmer. | Low | CSS-only -- add shimmer gradient animation to Skeleton component |
| **Content-aware skeleton shapes** | Already partially built (SagraCardSkeleton matches card layout). Ensure all loading.tsx files mirror their page structure accurately. | Low | Existing loading.tsx files -- audit and polish |

### Responsive Adaptations

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **Wider content area on desktop** | max-w-lg is 512px. Desktop should use max-w-4xl (896px) or max-w-6xl (1152px) with responsive breakpoints. | Low | Layout.tsx -- change max-w-lg to responsive classes |
| **Multi-column card grid on desktop** | 2 columns on tablet, 3-4 columns on desktop. Currently stuck at grid-cols-1 sm:grid-cols-2. | Low | StaggerGrid default className, SagraGrid |
| **Desktop navigation (top or side)** | BottomNav is mobile-only pattern. Desktop users expect top navbar or sidebar. Hide BottomNav on lg+ screens, show desktop nav. | Medium | New DesktopNav component, BottomNav hidden at lg: breakpoint |

### Accessibility

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| **prefers-reduced-motion support** | WCAG 2.1 requirement (SC 2.3.3). Vestibular disorders affect ~35% of adults over 40. Must disable/reduce animations when OS setting is enabled. | Low | CSS media query + Motion's `useReducedMotion()` hook |
| **Focus-visible states on interactive elements** | Keyboard navigation must have visible focus indicators. Cards, buttons, filters need `:focus-visible` outlines. | Low | Tailwind `focus-visible:` utilities |

---

## Differentiators

Features that create the "wow, this is premium" feeling. Not expected, but make users go "this is better than any sagre site I've used."

### Page Transitions

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **View Transitions API (native)** | GPU-accelerated cross-fade between pages with zero JS overhead. Feels 2-3x snappier than no transition. Browser support hit >85% in late 2025 (Chrome, Edge, Firefox 133+, Safari 18+). Next.js 15.2+ has experimental.viewTransition flag. Since Nemovia runs Next.js 15.5.12, this is available. | Low | next.config.ts: `experimental: { viewTransition: true }`. Wrap content with React's `<ViewTransition>`. Progressive enhancement -- unsupported browsers get instant navigation (current behavior). |
| **Shared element transitions (card-to-detail)** | When user taps a SagraCard, the card image morphs into the detail page hero image. Creates spatial continuity. This is what makes apps feel "native." Uses CSS `view-transition-name` on matching elements. | Medium | Requires viewTransition enabled + matching `view-transition-name` on SagraCard image and SagraDetail hero image. CSS-only once framework support is in place. |
| **Cross-fade page content** | Default view transition provides a smooth cross-fade between old and new page content instead of hard cut. Trivial to enable once viewTransition flag is set. | Low | Automatic with viewTransition: true |

**Why View Transitions API over Motion/framer-motion for page transitions:**
- Motion's AnimatePresence does NOT work reliably with Next.js App Router (components unmount before exit animation completes)
- View Transitions API is native browser, GPU-accelerated, zero bundle cost
- Progressive enhancement: graceful fallback to instant navigation
- Next.js 15.5 has built-in support via experimental flag
- Avoids FrozenRouter hacks and template.tsx workarounds

**Why NOT barba.js:** Incompatible with React/Next.js. Uses DOMParser (SSR error). Official docs say "use your framework's built-in transitions instead."

### Micro-Interactions

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Card hover lift + shadow** | Subtle scale(1.02) + shadow-lg on hover. Creates depth and interactivity on desktop. Current card only has `hover:shadow-md transition-shadow`. | Low | CSS or Motion's `whileHover` prop. Pure CSS preferred for performance. |
| **Card press/tap feedback** | On mobile, brief scale(0.98) on tap creates tactile feedback. Makes cards feel like real buttons. | Low | Motion's `whileTap={{ scale: 0.98 }}` on the card Link wrapper |
| **Button press animation** | Scale bounce on action buttons (Directions, Share, filters). Confirms the action was received. | Low | Motion's `whileTap={{ scale: 0.95 }}` |
| **BottomNav icon animation** | Active tab icon gets a subtle bounce or morph on selection. Creates responsive navigation feel. | Low | Motion spring animation on active icon |
| **Badge/tag hover pop** | Food tag badges scale slightly and brighten on hover. Invites interaction on desktop. | Low | CSS `hover:scale-105 hover:shadow-sm` transition |
| **Image load fade-in** | Images fade from transparent to opaque as they load instead of popping in. Removes jarring layout shifts. | Low | Next.js Image `onLoad` callback + opacity transition |

### Scroll Animations

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Scroll-triggered section reveals** | Already using FadeIn with `whileInView`. Enhance with variety: some sections slide from left, others from right, creating rhythm. | Low | Extend FadeIn component with `direction` prop (up/left/right) |
| **Scroll progress indicator** | Thin progress bar at top of page showing scroll depth. Especially useful on detail pages with long content. | Low | Motion's `useScroll()` hook + fixed progress bar |
| **Parallax hero background** | Hero section gradient moves slightly slower than scroll, creating depth illusion. Subtle parallax (not aggressive). | Low | Motion's `useScroll` + `useTransform` on HeroSection background |

### Desktop-Specific Polish

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| **Desktop sidebar navigation** | Replace BottomNav with a persistent left sidebar on lg+ screens. Icons + labels vertically stacked: Home, Cerca, Mappa. Keeps navigation accessible without eating vertical space. | Medium | New DesktopSidebar component, hide BottomNav at lg:, show sidebar at lg:. CSS Grid layout. |
| **Detail page side-by-side layout** | On desktop, show image + map on the left, info on the right (or vice versa). Better use of horizontal space than stacking everything vertically. | Medium | SagraDetail.tsx -- responsive grid: `grid-cols-1 lg:grid-cols-2` |
| **Hover tooltip on map markers** | On desktop, show sagra name on marker hover without clicking. Faster discovery than requiring click. | Low | Leaflet tooltip (L.tooltip) bound to markers. Show on `mouseover`. |
| **Card grid with 3 columns on xl** | XL screens (1280px+) show 3 cards per row for denser browsing. | Low | Grid class: `xl:grid-cols-3` |

---

## Anti-Features

Features to explicitly NOT build in this milestone. Each has a reason.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Smooth scroll library (Lenis)** | Adds complexity and potential conflicts with Leaflet map scrolling. Lenis hijacks native scroll behavior which can break map pan/zoom. Also conflicts with Motion's scroll hooks. The user mentioned Lenis but it creates more problems than it solves for this app type with map interactions. | Use native browser scrolling with CSS `scroll-behavior: smooth` for anchor links only. Motion's `useScroll` for scroll-linked animations. |
| **barba.js page transitions** | Incompatible with React and Next.js. Throws DOMParser errors on SSR. Official barba.js docs recommend using framework-native transitions instead. | Use View Transitions API via Next.js experimental flag. |
| **React Bits library (reactbits)** | Copy-paste components with GSAP/other animation library dependencies. Adds bundle weight and conflicting animation systems. Nemovia already has Motion installed -- no need for a second animation framework. Some effects (PixelCard, Hyperspeed backgrounds) are eye-candy for marketing sites, not utility apps. | Cherry-pick inspiration from reactbits.dev but implement using Motion, which is already installed. Focus on subtle polish, not flashy effects. |
| **Complex page enter/exit animations** | Slide-in/slide-out, morph, or staircase transitions add 300-500ms delay per navigation. For a utility app where users navigate rapidly between cards and search, speed trumps spectacle. | Use fast cross-fade (150-200ms) via View Transitions API. Instant navigation is the goal. |
| **Dark mode** | Cosmetic feature that doubles CSS surface area. Not a priority for a daytime-use food discovery app. Sagre happen outdoors in daylight. | Warm, inviting light theme only. Revisit in v2+ if users request. |
| **Animated backgrounds / particles** | Marketing site aesthetic. Distracts from content (sagre listings). Hurts performance on low-end phones. | Clean, warm gradient backgrounds (already using amber/green gradients). |
| **Infinite scroll** | Complicates URL sharing, back button behavior, and accessibility. Pagination or "load more" is better for discovery with filters. | Keep current paginated/full-list approach. |
| **Custom loading spinners** | Skeletons are strictly better than spinners for content-heavy UIs. Spinners provide no structural hint about incoming content. | Enhance existing skeleton loaders with shimmer effect. |

---

## Feature Dependencies

```
View Transitions API (page transitions)
  --> next.config.ts experimental.viewTransition: true (no code deps)
  --> CSS view-transition-name on SagraCard image + SagraDetail hero (shared element)
  --> Progressive enhancement: no fallback code needed

Responsive Desktop Layout
  --> Layout.tsx max-w change (foundation for everything)
  --> DesktopNav/Sidebar component (depends on layout change)
  --> Hide BottomNav at lg+ (depends on DesktopNav existing)
  --> Multi-column grids (depends on wider container)
  --> Detail page side-by-side (depends on wider container)

Micro-Interactions (independent, can be done in any order)
  --> Card hover/tap (SagraCard.tsx)
  --> Button press (DirectionsButton, ShareButton)
  --> BottomNav icon animation (BottomNav.tsx)
  --> Image load fade (SagraCard, SagraDetail)

Skeleton Enhancement
  --> Shimmer CSS animation (Skeleton.tsx -- foundation)
  --> Audit all loading.tsx files (depends on shimmer being added)

Scroll Animations
  --> FadeIn direction variants (extend existing component)
  --> Scroll progress bar (standalone, any page)
  --> Parallax hero (HeroSection.tsx)

Bug Fixes (independent, do first)
  --> TUTTE default on Cerca (SearchFilters.tsx)
  --> Image placeholder on detail (SagraDetail.tsx -- already implemented, verify)
  --> Back button visibility (BackButton.tsx -- already implemented, verify)

Accessibility
  --> prefers-reduced-motion (globals.css + Motion config)
  --> focus-visible states (global Tailwind utilities)
```

---

## Phase Recommendation

### Phase 1: Bug Fixes + Foundation (do first)
Fix the 4 known bugs and set up responsive layout foundation.

1. TUTTE province filter default on Cerca
2. Verify back button works (already built)
3. Verify image placeholder on detail (already built)
4. Responsive container width (max-w-lg to responsive breakpoints)
5. prefers-reduced-motion CSS media query

### Phase 2: Desktop Layout
Build the responsive desktop experience.

1. Desktop navigation (sidebar or top nav)
2. Hide BottomNav on lg+ screens
3. Multi-column card grids (md:2, lg:3, xl:4)
4. Detail page side-by-side layout on desktop
5. Map tooltips on hover (desktop)

### Phase 3: Page Transitions + Animations
Add the "wow effect" layer.

1. Enable viewTransition experimental flag
2. Shared element transition (card image to detail hero)
3. Card hover lift + tap feedback
4. Button press animations
5. BottomNav active icon animation
6. Skeleton shimmer effect
7. Image load fade-in
8. Scroll progress indicator
9. FadeIn direction variants
10. Parallax hero (optional, subtle)

**Rationale:** Fix bugs first (trust), then desktop layout (usability for 50% of users), then animations (delight). Each phase builds on the previous. Animation work should come last because it touches components that may change during layout refactoring.

---

## Complexity Budget

| Category | Estimated Effort | Risk Level |
|----------|-----------------|------------|
| Bug fixes | 1-2 hours | Low -- mostly verification of already-built features |
| Responsive layout | 4-6 hours | Low -- Tailwind responsive utilities, well-understood pattern |
| Desktop nav | 2-3 hours | Low -- new component but simple structure |
| View Transitions | 1-2 hours | Medium -- experimental API, test across browsers |
| Shared element transitions | 2-3 hours | Medium -- CSS view-transition-name matching |
| Card micro-interactions | 1-2 hours | Low -- Motion whileHover/whileTap, CSS |
| Skeleton shimmer | 30 min | Low -- CSS animation only |
| Scroll animations | 1-2 hours | Low -- Motion hooks, well-documented |
| Accessibility (reduced motion) | 30 min | Low -- CSS + Motion hook |

**Total estimated:** 12-20 hours of implementation work.

---

## Sources

### Official Documentation (HIGH confidence)
- [Next.js viewTransition experimental config](https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition) -- experimental flag docs, usage with React ViewTransition component
- [Next.js 15.2 release blog](https://nextjs.org/blog/next-15-2) -- viewTransition feature announcement
- [Motion scroll animations docs](https://motion.dev/docs/react-scroll-animations) -- useScroll, useInView, whileInView
- [Motion gestures docs](https://motion.dev/docs/react) -- whileHover, whileTap
- [View Transition API MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) -- browser API reference
- [View Transitions browser support (caniuse)](https://caniuse.com/view-transitions) -- 85%+ support as of late 2025

### Community/Ecosystem (MEDIUM confidence)
- [next-view-transitions by Shuding](https://github.com/shuding/next-view-transitions) -- community library for View Transitions in Next.js App Router (alternative approach, but native experimental flag is preferred since Nemovia is on 15.5)
- [React Bits](https://reactbits.dev/) -- animated component library for inspiration (not recommended as dependency)
- [Lenis smooth scroll](https://github.com/darkroomengineering/lenis) -- evaluated and rejected for Nemovia due to Leaflet conflicts
- [barba.js React incompatibility](https://github.com/barbajs/barba/issues/221) -- confirmed incompatible with React frameworks

### UX Research (MEDIUM confidence)
- [Micro-interactions guide](https://www.frontendtools.tech/blog/micro-interactions-ui-ux-guide) -- timing (150-300ms), GPU-accelerated properties
- [Motion UI trends 2025](https://www.betasofttechnology.com/motion-ui-trends-and-micro-interactions/) -- industry patterns
- [Skeleton loading best practices](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/) -- shimmer effect, content-aware shapes
- [prefers-reduced-motion W3C technique](https://www.w3.org/WAI/WCAG21/Techniques/css/C39) -- accessibility requirement
- [Chrome View Transitions 2025 update](https://developer.chrome.com/blog/view-transitions-in-2025) -- cross-document transitions, types
