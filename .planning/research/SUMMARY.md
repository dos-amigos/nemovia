# Research Summary: Nemovia v1.2 "Polish"

**Domain:** UI/UX polish for food festival (sagre) aggregator
**Researched:** 2026-03-07
**Overall confidence:** HIGH

## Executive Summary

Nemovia v1.2 is a pure frontend polish milestone. The backend (Supabase, scrapers, LLM enrichment, PostGIS) is stable and unchanged. The goal is to fix 4 UX bugs and add visual polish -- page transitions, responsive desktop layout, skeleton loaders, and micro-interactions -- to make the app feel premium on every device.

The critical finding is that **zero new npm dependencies are needed**. The existing stack (Next.js 15.5.12, Motion 12.35.0, Tailwind v4, Shadcn/UI) provides everything required. Page transitions use the browser-native View Transitions API via a Next.js experimental flag. Responsive layout uses Tailwind v4's built-in breakpoints and container queries. Micro-interactions use Motion's whileHover/whileTap/useScroll features that are already installed but underutilized. Skeleton loaders are already built via Shadcn's Skeleton component.

The user mentioned barba.js, lenis, and reactbits as libraries to explore. Research confirms all three should be rejected: barba.js is incompatible with React/Next.js (DOMParser errors), lenis conflicts with Leaflet map scrolling and adds unnecessary weight for short-content pages, and reactbits creates a competing design system alongside the existing Shadcn/UI + Motion stack.

The main architectural risk is the `max-w-lg` layout constraint. Currently every page is squeezed into 512px. Widening this for desktop has cascading effects on card grids, skeleton loaders (CLS risk), and navigation. This is the highest-effort change and must be done before animation work.

## Key Findings

**Stack:** No new dependencies. Enable `experimental.viewTransition` in next.config.ts. Use existing Motion features (whileHover, whileTap, useScroll, layout). Use Tailwind v4 responsive breakpoints (md/lg/xl).

**Architecture:** Four integration domains -- page transitions (View Transitions API), responsive layout (Tailwind breakpoints), skeleton enhancement (shimmer CSS), micro-interactions (Motion gestures). All purely in the rendering layer, zero backend changes.

**Critical pitfall:** AnimatePresence does NOT work for page transitions in Next.js App Router (issue #49279). Must use View Transitions API instead. The max-w-lg layout change has cascading effects on all grid components and skeleton loaders.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Bug Fixes** - Fix the 4 known UX issues (back button, image placeholder, TUTTE default, responsive container)
   - Addresses: Immediate broken UX that makes app feel incomplete
   - Avoids: Polishing on top of broken foundations
   - Complexity: Low (mostly one-line fixes or verification of already-built components)

2. **Responsive Desktop Layout** - Widen container, add desktop navigation, responsive grids, update skeletons
   - Addresses: 50% of users on desktop seeing a 512px column on a 1920px monitor
   - Avoids: CLS regression by updating skeletons in sync with layout changes
   - Complexity: Medium (cascading layout changes, new DesktopNav component)

3. **Page Transitions and Micro-interactions** - Enable View Transitions, add hover/tap effects, scroll progress, stagger extensions
   - Addresses: The "wow effect" premium feel that differentiates from competitors
   - Avoids: Animation performance issues by using GPU-accelerated properties only
   - Complexity: Low-Medium (config + CSS for transitions, Motion props for interactions)

**Phase ordering rationale:**
- Bug fixes first because broken UX undermines any polish work
- Responsive layout second because it changes the spatial container that animations operate within
- Transitions and micro-interactions last because they layer on top of stable layouts
- Skeleton updates must happen alongside layout changes (same phase) to prevent CLS

**Research flags for phases:**
- Phase 2 (Responsive Layout): Highest risk -- cascading changes to grids, skeletons, navigation. Test at every breakpoint (375px, 768px, 1024px, 1280px, 1920px)
- Phase 3 (Transitions): View Transitions API is experimental in Next.js. Test cross-browser (Chrome, Safari, Firefox fallback). Monitor for conflicts with nuqs URL state updates
- Phase 3 (Micro-interactions): Performance budget -- test with Chrome DevTools CPU 4x throttle on 20+ card grids

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps. All capabilities verified in installed versions via official docs. |
| Features | HIGH | Well-understood patterns (responsive, hover, transitions). No novel technical challenges. |
| Architecture | HIGH | Pure rendering layer changes. No backend, no data model, no API changes. |
| Pitfalls | HIGH | AnimatePresence incompatibility is well-documented. CLS risk is standard and preventable. |

## Gaps to Address

- **View Transitions + nuqs interaction:** Need to verify that filter state changes in Cerca page do not trigger unintended page-level view transitions. May need to scope view-transition-name carefully.
- **Leaflet map invalidateSize on resize:** When the layout container changes width for desktop, the Leaflet map may show grey tiles. Need ResizeObserver calling invalidateSize().
- **LazyMotion migration:** Current codebase imports full `motion` bundle (~34KB). Could reduce to ~5KB with `m` + `LazyMotion` but this is an optimization that can be deferred.
- **Shared element transitions (card-to-detail morph):** Technically possible with CSS view-transition-name but the React ViewTransition component is still experimental. Defer to v1.3 if stability improves.
