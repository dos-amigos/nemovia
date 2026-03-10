---
phase: 17-visual-effects-layout-performance
plan: 03
subsystem: ui
tags: [lazymotion, motion-react-m, code-splitting, async-loading, performance]

# Dependency graph
requires:
  - phase: 17-visual-effects-layout-performance
    provides: Glassmorphism nav bars (17-01) and card overlay + bento grid (17-02)
provides:
  - LazyMotion async feature loading with domMax
  - m.* component pattern for all animated elements
  - ~28KB initial JS reduction on home/search routes
affects: [future animation additions should use m.* not motion.*]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazymotion-async-dommax, m-components-via-motion-react-m, strict-mode-leak-detection]

key-files:
  created:
    - src/lib/motion-features.ts
  modified:
    - src/components/Providers.tsx
    - src/app/(main)/template.tsx
    - src/components/layout/BottomNav.tsx
    - src/components/sagra/SagraCard.tsx
    - src/components/home/QuickFilters.tsx
    - src/components/home/FeaturedSagraCard.tsx
    - src/components/detail/ShareButton.tsx
    - src/components/detail/DirectionsButton.tsx
    - src/components/animations/FadeIn.tsx
    - src/components/animations/ScrollReveal.tsx
    - src/components/animations/StaggerGrid.tsx
    - src/components/animations/ScrollProgress.tsx
    - src/components/animations/ParallaxHero.tsx

key-decisions:
  - "domMax (not domAnimation) for LazyMotion because BottomNav uses layoutId"
  - "strict prop on LazyMotion to catch any motion.* component leaks at runtime"
  - "Hooks (useScroll, useSpring, useTransform) and providers (AnimatePresence, MotionConfig) stay imported from motion/react"

patterns-established:
  - "All animated elements use m.* from motion/react-m (never motion.* from motion/react)"
  - "motion/react imports reserved for providers (LazyMotion, MotionConfig, AnimatePresence) and hooks only"
  - "New animation features loaded via src/lib/motion-features.ts async import"

requirements-completed: [UI-10]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 17 Plan 03: LazyMotion Performance Summary

**LazyMotion async loading with domMax features, migrating 12 components from motion.* to m.* for ~28KB initial JS reduction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T11:58:06Z
- **Completed:** 2026-03-10T12:01:28Z
- **Tasks:** 2
- **Files modified:** 14 (1 created, 13 modified)

## Accomplishments
- Created async domMax feature module for LazyMotion dynamic import
- Wrapped Providers.tsx with LazyMotion (strict mode) for leak detection at runtime
- Migrated all 12 component files from motion.* to m.* imports (motion/react-m)
- Reduced initial JS by ~28KB on home route (240KB to 212KB) and search route (206KB to 178KB)
- All animation features preserved: hover/tap, page transitions, scroll reveals, stagger, parallax, layoutId

## Task Commits

Each task was committed atomically:

1. **Task 1: Create motion features module and add LazyMotion to Providers** - `c237ce0` (feat)
2. **Task 2: Migrate all 12 component files from motion.* to m.* imports** - `068c58f` (feat)

## Files Created/Modified
- `src/lib/motion-features.ts` - Async domMax feature bundle export for LazyMotion
- `src/components/Providers.tsx` - Added LazyMotion wrapper with strict mode and async features
- `src/app/(main)/template.tsx` - motion.div to m.div (AnimatePresence stays from motion/react)
- `src/components/layout/BottomNav.tsx` - motion.div to m.div (layoutId works via domMax)
- `src/components/sagra/SagraCard.tsx` - motion.div to m.div
- `src/components/home/QuickFilters.tsx` - motion.button to m.button
- `src/components/home/FeaturedSagraCard.tsx` - motion.div to m.div
- `src/components/detail/ShareButton.tsx` - motion.div to m.div
- `src/components/detail/DirectionsButton.tsx` - motion.a to m.a
- `src/components/animations/FadeIn.tsx` - motion.div to m.div
- `src/components/animations/ScrollReveal.tsx` - motion.div to m.div
- `src/components/animations/StaggerGrid.tsx` - motion.div to m.div (container and item)
- `src/components/animations/ScrollProgress.tsx` - motion.div to m.div (hooks stay from motion/react)
- `src/components/animations/ParallaxHero.tsx` - motion.div to m.div (hooks stay from motion/react)

## Decisions Made
- Used domMax (not domAnimation) because BottomNav uses layoutId which requires layout animation features
- Enabled strict prop on LazyMotion to throw runtime errors if any motion.* component leaks through
- Kept hooks (useScroll, useSpring, useTransform) and providers (AnimatePresence, MotionConfig) imported from motion/react -- only animated components migrated to m.*

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All animation components use m.* pattern -- any future components must follow this convention
- LazyMotion strict mode will catch violations at runtime if someone accidentally imports motion.* components
- Performance optimization complete: ~28KB initial JS savings across all routes
- Phase 17 (Visual Effects, Layout, Performance) is now fully complete (3/3 plans)

## Self-Check: PASSED

All 14 files verified present. Both task commits (c237ce0, 068c58f) verified in git log. Zero motion.div/button/a references remain in source. from "motion/react" only in Providers.tsx, template.tsx, ScrollProgress.tsx, ParallaxHero.tsx (expected). Build passes.

---
*Phase: 17-visual-effects-layout-performance*
*Completed: 2026-03-10*
