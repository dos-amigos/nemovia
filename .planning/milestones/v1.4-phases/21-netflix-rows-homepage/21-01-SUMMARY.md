---
phase: 21-netflix-rows-homepage
plan: 01
subsystem: ui
tags: [scroll-snap, css-snap, horizontal-scroll, netflix-rows, deduplication, homepage]

# Dependency graph
requires:
  - phase: 20-layout-branding
    provides: full-width layout foundation, max-w-7xl containment pattern
  - phase: 19-image-quality
    provides: hero section, SagraCard with image overlay
provides:
  - ScrollRow client component with CSS scroll-snap, drag scroll, desktop hover arrows
  - ScrollRowSection server component with min-3 threshold and FadeIn animation
  - getActiveSagre() query for broad active sagre fetching
  - Homepage with 4 category rows (weekend, gratis, province, food tag) with cross-row deduplication
affects: [22-city-search-map]

# Tech tracking
tech-stack:
  added: []
  patterns: [netflix-scroll-rows, cross-row-dedup-set, drag-scroll-mouse-events, css-scroll-snap-mandatory]

key-files:
  created:
    - src/components/home/ScrollRow.tsx
    - src/components/home/ScrollRowSection.tsx
  modified:
    - src/app/(main)/page.tsx
    - src/lib/queries/sagre.ts
    - src/lib/queries/types.ts
    - src/lib/constants/veneto.ts

key-decisions:
  - "CSS scroll-snap-mandatory for native momentum scrolling instead of JS carousel library"
  - "In-memory Set for cross-row deduplication -- sequential row building with shown ID tracking"
  - "Drag-to-scroll with mouse events for desktop trackpad-less users"
  - "Removed image_credit from SAGRA_CARD_FIELDS to avoid unnecessary data fetching"
  - "QuickFilters moved after hero section, before scroll rows, for better visual hierarchy"

patterns-established:
  - "ScrollRow pattern: full-width CSS scroll-snap container with responsive card widths (75vw/45vw/280px)"
  - "ScrollRowSection pattern: server component wrapper with min-3 threshold hiding sparse rows"
  - "Dedup pattern: sequential row construction with Set<string> tracking shown sagra IDs"

requirements-completed: [HOME-01]

# Metrics
duration: ~25min
completed: 2026-03-11
---

# Phase 21 Plan 01: Netflix Rows Homepage Summary

**Netflix-style horizontal scroll rows replacing bento grid with 4 category rows (weekend, gratis, province, food tag), CSS scroll-snap, drag scroll, desktop hover arrows, and cross-row deduplication via in-memory Set**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-11T13:45:00Z
- **Completed:** 2026-03-11T14:11:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Replaced static bento grid homepage with 4 Netflix-style horizontal scroll rows surfacing sagre through weekend, gratis, province, and food tag discovery paths
- Built ScrollRow client component with CSS scroll-snap, drag-to-scroll mouse events, and desktop hover arrow buttons with smooth 300px scroll increments
- Implemented cross-row deduplication using in-memory Set so no sagra appears in multiple rows
- ScrollRowSection server component auto-hides rows with fewer than 3 items

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ScrollRow, ScrollRowSection components and getActiveSagre query** - `688991b` (feat)
2. **Task 2: Rewrite homepage with scroll rows and deduplication logic** - `a73ae3c` (feat)
3. **Task 3: Visual verification fixes** - `879d152` (fix) -- scroll row alignment, drag scroll, QuickFilters repositioned

## Files Created/Modified
- `src/components/home/ScrollRow.tsx` - Client component: horizontal scroll container with CSS snap, drag scroll, desktop hover arrows
- `src/components/home/ScrollRowSection.tsx` - Server component: title + icon + min-3 threshold + FadeIn + ScrollRow wrapper
- `src/lib/queries/sagre.ts` - Added getActiveSagre() function for broad active sagre fetch; getWeekendSagre() now accepts optional limit
- `src/app/(main)/page.tsx` - Full homepage rewrite: 4 scroll rows with cross-row dedup, empty state handling
- `src/lib/queries/types.ts` - Removed image_credit from SagraCardData type
- `src/lib/constants/veneto.ts` - Removed image_credit from SAGRA_CARD_FIELDS constant

## Decisions Made
- **CSS scroll-snap over JS carousel**: Native momentum scrolling with snap-x snap-mandatory provides smooth mobile experience without library overhead (SwiperJS/Embla explicitly out of scope in REQUIREMENTS.md)
- **In-memory Set dedup**: Sequential row building (weekend first, then gratis, province, food) with Set<string> tracking prevents cross-row duplication without database changes
- **Drag-to-scroll**: Added mousedown/mousemove/mouseup event handlers on ScrollRow for desktop users without scroll wheels or trackpads
- **Removed image_credit from card data**: image_credit only needed for hero/detail attribution, not card rendering -- reduces query payload
- **QuickFilters after hero, before rows**: Better visual hierarchy -- users see category filters immediately below hero before scrolling through rows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Scroll row alignment with titles**
- **Found during:** Task 3 (visual verification)
- **Issue:** First card in scroll rows not aligned with row titles due to padding mismatch
- **Fix:** Aligned scroll-pl values with container padding pattern
- **Files modified:** src/components/home/ScrollRow.tsx
- **Committed in:** 879d152

**2. [Rule 2 - Missing Critical] Added drag-to-scroll for desktop**
- **Found during:** Task 3 (visual verification)
- **Issue:** Desktop users without trackpad could not scroll rows -- only arrow buttons available
- **Fix:** Added mouse event handlers (mousedown, mousemove, mouseup, mouseleave) for drag-to-scroll interaction
- **Files modified:** src/components/home/ScrollRow.tsx
- **Committed in:** 879d152

**3. [Rule 1 - Bug] QuickFilters position in page flow**
- **Found during:** Task 3 (visual verification)
- **Issue:** QuickFilters rendered after scroll rows, too far down the page for discovery
- **Fix:** Moved QuickFilters section to render after hero, before scroll rows
- **Files modified:** src/app/(main)/page.tsx
- **Committed in:** 879d152

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correct UX. No scope creep.

## Issues Encountered
None -- plan executed cleanly with post-checkpoint visual fixes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Homepage scroll rows complete, ready for Phase 22 (City Search & Map Fixes)
- Hero search bar is still a link to /cerca -- Phase 22 will convert it to autocomplete input
- Full-width layout pattern established and working well with scroll rows

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 21-netflix-rows-homepage*
*Completed: 2026-03-11*
