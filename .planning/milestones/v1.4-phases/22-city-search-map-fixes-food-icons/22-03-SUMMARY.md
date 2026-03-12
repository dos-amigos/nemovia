---
phase: 22-city-search-map-fixes-food-icons
plan: 03
subsystem: ui, api
tags: [supabase, postgis, nuqs, leaflet, search, map, filters]

# Dependency graph
requires:
  - phase: 18-data-pipeline-restoration
    provides: "Active sagre with location data for map rendering"
provides:
  - "searchMapSagre function applying all filters to map marker queries"
  - "Cerca page map view respecting active search filters"
  - "Mappa page with always-visible filter controls above map"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchMapSagre mirrors searchSagre with MAP_MARKER_FIELDS for filtered map data"
    - "Mappa page reads searchParams + nuqs shallow:false for server-driven filter updates"

key-files:
  created: []
  modified:
    - "src/lib/queries/sagre.ts"
    - "src/app/(main)/cerca/page.tsx"
    - "src/app/(main)/mappa/page.tsx"
    - "src/app/(main)/mappa/MappaClientPage.tsx"

key-decisions:
  - "searchMapSagre mirrors searchSagre logic with MAP_MARKER_FIELDS -- no code sharing to keep spatial/standard branches independent"
  - "Mappa filter bar always visible above map, not behind toggle overlay"
  - "No limit on searchMapSagre standard query (map should show all matching markers)"

patterns-established:
  - "Filtered map pattern: server page parses searchParams, calls searchMapSagre(filters), client renders SearchFilters + map"

requirements-completed: [MAP-01, MAP-02]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 22 Plan 03: Map Filter Sync Summary

**searchMapSagre function fixing Cerca map filter bypass, plus always-visible SearchFilters on dedicated Mappa page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T15:23:17Z
- **Completed:** 2026-03-11T15:28:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed Cerca page map view to respect active search filters (provincia, cucina, gratis, dates, location) instead of showing all sagre
- Added searchMapSagre function with both spatial (PostGIS RPC) and standard query branches
- Added always-visible filter controls (SearchFilters component) above the map on the dedicated Mappa page
- Mappa page now reads URL params and passes filtered data to the map

## Task Commits

Each task was committed atomically:

1. **Task 1: Create searchMapSagre and fix Cerca page map filter sync** - `0d13bce` (feat)
2. **Task 2: Add always-visible filter controls to Mappa page** - `1f641e5` (feat)

## Files Created/Modified
- `src/lib/queries/sagre.ts` - Added searchMapSagre() function (125 lines) mirroring searchSagre with MAP_MARKER_FIELDS
- `src/app/(main)/cerca/page.tsx` - Replaced getMapSagre() with searchMapSagre(filters) for map view
- `src/app/(main)/mappa/page.tsx` - Added searchParams parsing and searchMapSagre(filters) call
- `src/app/(main)/mappa/MappaClientPage.tsx` - Added SearchFilters component above map in flex column layout

## Decisions Made
- searchMapSagre mirrors searchSagre logic independently rather than sharing code -- keeps spatial/standard branches self-contained and avoids coupling card vs marker field selection
- Mappa page filter bar is always visible above the map (not behind a toggle overlay like MapFilterOverlay) because the plan explicitly requires persistent filter controls
- No result limit on searchMapSagre standard branch -- map should show all matching markers, unlike search list which caps at 50
- Spatial branch uses max_results: 200 (higher than searchSagre's 50) since maps can display more markers meaningfully

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Map filter sync complete, both Cerca and Mappa pages use filtered map data
- All Phase 22 plans (01, 02, 03) can now be verified together
- Ready for Phase 23 (Scraping) if remaining Phase 22 plans are complete

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 22-city-search-map-fixes-food-icons*
*Completed: 2026-03-11*
