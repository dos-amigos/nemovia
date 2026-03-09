---
phase: 12-responsive-desktop-layout
plan: 02
subsystem: ui
tags: [tailwind, responsive, grid, leaflet, tooltip, skeleton, next-image]

# Dependency graph
requires:
  - phase: 11-bug-fixes-foundation
    provides: "max-w-7xl container, reduced-motion support, focus-visible rings"
provides:
  - "Responsive 1/2/3/4 col StaggerGrid for all card grids"
  - "Side-by-side SagraDetail layout on lg+ (image+map left, info right)"
  - "Map marker hover tooltips via react-leaflet Tooltip"
  - "Breakpoint-aware skeleton loaders for home, cerca, detail pages"
  - "Responsive ProvinceSection grid (2/3/4 cols)"
  - "Scaled HeroSection text and padding for desktop"
affects: [13-animation-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["responsive grid scaling via Tailwind breakpoint classes", "CSS grid side-by-side layout with sticky left column", "react-leaflet Tooltip for hover context"]

key-files:
  created: []
  modified:
    - src/components/animations/StaggerGrid.tsx
    - src/components/sagra/SagraCard.tsx
    - src/components/home/ProvinceSection.tsx
    - src/components/home/HeroSection.tsx
    - src/components/map/MapView.tsx
    - src/components/detail/SagraDetail.tsx
    - src/app/(main)/loading.tsx
    - src/app/(main)/cerca/loading.tsx
    - src/app/(main)/sagra/[slug]/loading.tsx

key-decisions:
  - "Skeleton count increased from 4 to 8 for desktop density (fills 2 rows in 4-col grid)"
  - "Left column sticky (lg:sticky lg:top-20) so map stays visible while scrolling info"
  - "Hero image on desktop uses lg:rounded-xl lg:overflow-hidden instead of full-bleed"

patterns-established:
  - "Responsive grid pattern: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  - "Side-by-side detail pattern: lg:grid lg:grid-cols-2 lg:gap-8 with sticky left column"
  - "Skeleton loaders must mirror content component responsive classes"

requirements-completed: [DESK-02, DESK-04, DESK-05, SKEL-02]

# Metrics
duration: 2min
completed: 2026-03-07
---

# Phase 12 Plan 02: Responsive Content Components Summary

**Responsive 1/2/3/4-col card grids, side-by-side detail layout, map hover tooltips, and breakpoint-aware skeleton loaders across all pages**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-07T12:53:11Z
- **Completed:** 2026-03-07T12:55:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Card grids scale from 1 column on mobile to 4 columns on xl screens (StaggerGrid, skeletons)
- Sagra detail page shows side-by-side layout on desktop with image+map sticky left, info scrollable right
- Map markers show sagra title tooltip on hover without clicking
- All skeleton loaders match their page's responsive layout at every breakpoint
- Province grid scales 2/3/4 columns; hero text/padding scales up on desktop
- SagraCard image sizes optimized for multi-column rendering

## Task Commits

Each task was committed atomically:

1. **Task 1: Responsive grids, card image sizes, hero scaling, and map tooltips** - `34d6f98` (feat)
2. **Task 2: Side-by-side detail layout and breakpoint-aware skeletons** - `c07028e` (feat)

## Files Created/Modified
- `src/components/animations/StaggerGrid.tsx` - Default grid now 1/2/3/4 cols across breakpoints
- `src/components/sagra/SagraCard.tsx` - Image sizes updated for 4-column layout (100vw/50vw/33vw/25vw)
- `src/components/home/ProvinceSection.tsx` - Province grid responsive: 2/3/4 cols
- `src/components/home/HeroSection.tsx` - Desktop text scaling (lg:text-3xl) and padding (lg:px-10 lg:py-12)
- `src/components/map/MapView.tsx` - Tooltip import and usage inside each Marker
- `src/components/detail/SagraDetail.tsx` - Side-by-side lg:grid-cols-2 with sticky left column
- `src/app/(main)/loading.tsx` - Home skeleton mirrors StaggerGrid classes, 8 items
- `src/app/(main)/cerca/loading.tsx` - Cerca skeleton mirrors StaggerGrid classes, 8 items
- `src/app/(main)/sagra/[slug]/loading.tsx` - Detail skeleton mirrors side-by-side layout

## Decisions Made
- Skeleton count increased from 4 to 8 so desktop users see 2 full rows in a 4-column grid
- Left column uses lg:sticky lg:top-20 so the map stays visible while scrolling right column content
- Hero image on desktop contained with lg:rounded-xl instead of full-bleed negative margins

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All responsive layouts in place; ready for Phase 13 animation polish
- Skeleton loaders already match responsive breakpoints, ready for shimmer animation (SKEL-01)
- No blockers

## Self-Check: PASSED

All 9 modified files verified present. Both task commits (34d6f98, c07028e) verified in git log.

---
*Phase: 12-responsive-desktop-layout*
*Completed: 2026-03-07*
