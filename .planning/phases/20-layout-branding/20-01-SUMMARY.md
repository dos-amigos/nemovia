---
phase: 20-layout-branding
plan: 01
subsystem: ui
tags: [tailwind, layout, flexbox, responsive, full-width]

# Dependency graph
requires:
  - phase: 19-image-quality
    provides: "HeroSection component with Unsplash images and rounded card layout"
provides:
  - "Full-width-by-default main layout (flex-col + flex-1 pattern)"
  - "Explicit max-w-7xl containment pattern for content pages"
  - "No negative-margin breakout hacks in homepage or mappa"
  - "Sticky footer support via flexbox structure"
affects: [20-02-PLAN, 21-netflix-rows]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-width main with per-page containment (max-w-7xl) instead of global constraint"
    - "flex min-h-screen flex-col on root div + flex-1 on main for sticky footer"

key-files:
  created: []
  modified:
    - src/app/(main)/layout.tsx
    - src/app/(main)/page.tsx
    - src/app/(main)/mappa/MappaClientPage.tsx
    - src/app/(main)/cerca/page.tsx
    - src/components/detail/SagraDetail.tsx
    - src/components/search/SearchResults.tsx
    - src/components/home/HeroSection.tsx

key-decisions:
  - "Full-width-by-default pattern: main has no max-w-7xl, pages opt into containment"
  - "Hero card margins use mx-4/sm:mx-6/lg:mx-8 responsive steps for breathing room"
  - "Detail page hero stays full-bleed on mobile via -mx breakout from container"
  - "Search map view stays within max-w-7xl container (not edge-to-edge)"

patterns-established:
  - "Content containment: wrap page content in div.mx-auto.max-w-7xl.px-4.sm:px-6.lg:px-8"
  - "Full-width elements: render directly in main without wrapper div"
  - "Sticky footer prep: outer div uses flex.min-h-screen.flex-col, main uses flex-1"

requirements-completed: [BRAND-01]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 20 Plan 01: Layout Restructure Summary

**Full-width-by-default main layout with per-page max-w-7xl containment, eliminating all negative-margin breakout hacks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T12:39:52Z
- **Completed:** 2026-03-11T12:45:08Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Restructured main layout from "contained by default" (max-w-7xl on main) to "full-width by default" (no constraints on main)
- Eliminated all negative-margin breakout hacks (-mx-4 -mt-4 sm:-mx-6 lg:-mx-8) from homepage and mappa
- Added explicit max-w-7xl containment to homepage content, cerca page, and sagra detail page
- Prepared layout for sticky footer support (Phase 20 Plan 02) via flex-col + flex-1 pattern
- Updated hero card margins for better proportions on wide screens (sm:mx-6, lg:mx-8)

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure main layout to full-width-by-default** - `ef8c238` (feat)
2. **Task 2: Update all pages to remove breakout hacks and add explicit containment** - `be55a14` (feat)

## Files Created/Modified
- `src/app/(main)/layout.tsx` - Removed max-w-7xl from main, added flex-col + flex-1 pattern
- `src/app/(main)/page.tsx` - Removed hero breakout hack, wrapped content in max-w-7xl container
- `src/components/home/HeroSection.tsx` - Updated card margins for full-width context (sm:mx-6, lg:mx-8)
- `src/app/(main)/mappa/MappaClientPage.tsx` - Removed negative-margin breakout, simplified height calc
- `src/app/(main)/cerca/page.tsx` - Wrapped all content in max-w-7xl container
- `src/components/search/SearchResults.tsx` - Removed -mx-4 from map view div
- `src/components/detail/SagraDetail.tsx` - Added max-w-7xl container wrapper, added sm breakout for ParallaxHero
- `src/lib/scraper/__tests__/filters.test.ts` - Fixed pre-existing eslint-disable for no-explicit-any
- `src/lib/unsplash/__tests__/unsplash.test.ts` - Removed unused UnsplashHeroImage import

## Decisions Made
- Full-width-by-default pattern chosen over keeping global constraint -- eliminates fragile negative-margin hacks and prepares for Phase 21 Netflix rows
- Hero card margins updated to mx-4/sm:mx-6/lg:mx-8 responsive steps for better breathing room on wide screens
- Detail page hero keeps mobile full-bleed via -mx breakout from its container (intentional design choice, not a hack)
- Search map view stays within max-w-7xl container rather than breaking out -- it's a secondary view that doesn't need edge-to-edge

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing lint errors blocking build**
- **Found during:** Task 1 (build verification)
- **Issue:** `next build` failed on lint errors in test files: `@typescript-eslint/no-explicit-any` in filters.test.ts and unused `UnsplashHeroImage` import in unsplash.test.ts
- **Fix:** Added eslint-disable comment for intentional `null as any` test case, removed unused type import
- **Files modified:** src/lib/scraper/__tests__/filters.test.ts, src/lib/unsplash/__tests__/unsplash.test.ts
- **Verification:** Build passes successfully
- **Committed in:** ef8c238 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal -- pre-existing lint errors in test files unrelated to layout changes. Fixed inline to unblock build verification.

## Issues Encountered
None -- plan executed smoothly once lint errors were resolved.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layout is ready for Phase 20 Plan 02 (Footer + branding) -- flex-col + flex-1 pattern supports sticky footer
- Full-width main enables Phase 21 Netflix-style horizontal scroll rows without breakout hacks
- All existing pages verified to build correctly with new layout structure

---
*Phase: 20-layout-branding*
*Completed: 2026-03-11*
