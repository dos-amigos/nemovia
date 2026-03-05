---
phase: 05-map-detail
plan: 02
subsystem: ui
tags: [leaflet, map, geolocation, nuqs, view-toggle, fullscreen-map, filter-overlay]

# Dependency graph
requires:
  - phase: 05-map-detail
    provides: MapView component, MapView.dynamic wrapper, getMapSagre query, MapMarkerData type, VENETO_CENTER constant
  - phase: 04-discovery-ui
    provides: SearchFilters component, ActiveFilters component, SearchResults component, search page, useGeolocation hook
provides:
  - Fullscreen map page at /mappa with all geolocated sagre
  - LocationButton component with "Vicino a me" geolocation and flyTo animation
  - ViewToggle component for lista/mappa URL-persisted view switching
  - MapFilterOverlay collapsible filter panel for map view
  - Search page map mode rendering via vista=mappa URL param
affects: [06-seo-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-wrapper-pattern, dynamic-import-use-client, map-flyto-via-ref, nuqs-view-toggle]

key-files:
  created:
    - src/components/map/LocationButton.tsx
    - src/components/map/MapFilterOverlay.tsx
    - src/components/search/ViewToggle.tsx
    - src/app/(main)/mappa/MappaClientPage.tsx
  modified:
    - src/app/(main)/mappa/page.tsx
    - src/app/(main)/cerca/page.tsx
    - src/components/search/SearchResults.tsx
    - src/components/map/MapView.dynamic.tsx
    - src/components/detail/DetailMiniMap.dynamic.tsx

key-decisions:
  - "Server/client split for /mappa: server component fetches data, MappaClientPage client wrapper holds map ref for flyTo"
  - "MapView.dynamic.tsx needs 'use client' when imported by server components (ssr:false requires client context)"
  - "Search page fetches both searchSagre and getMapSagre in parallel when vista=mappa for full marker data"

patterns-established:
  - "Client wrapper pattern: server component fetches, passes to 'use client' component that manages interactivity"
  - "Dynamic import wrappers with ssr:false must have 'use client' directive for server component compatibility"
  - "nuqs parseAsStringEnum for type-safe URL-persisted view mode toggles"

requirements-completed: [MAP-04, MAP-05, MAP-06, MAP-07]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 5 Plan 2: Map Pages & Search Toggle Summary

**Fullscreen /mappa page with "Vicino a me" geolocation, lista/mappa toggle on search page, and collapsible filter overlay for map view**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T13:59:39Z
- **Completed:** 2026-03-05T14:05:07Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Replaced /mappa placeholder with fullscreen map rendering all geolocated sagre via getMapSagre()
- Built LocationButton with useGeolocation hook, "Vicino a me" label, and map.flyTo() animation on locate
- Added lista/mappa ViewToggle to search page with nuqs URL state persistence (vista param)
- Created MapFilterOverlay with collapsible SearchFilters panel for map view
- Extended SearchResults to conditionally render MapViewDynamic or card grid based on vista param

## Task Commits

Each task was committed atomically:

1. **Task 1: Build fullscreen map page with LocationButton** - `c0aea01` (feat)
2. **Task 2: Add lista/mappa toggle to search page with filter overlay** - `12cef89` (feat)

## Files Created/Modified
- `src/app/(main)/mappa/page.tsx` - Server component fetching getMapSagre(), renders MappaClientPage
- `src/app/(main)/mappa/MappaClientPage.tsx` - Client wrapper with map ref for flyTo on geolocation
- `src/components/map/LocationButton.tsx` - "Vicino a me" button with geolocation states and map flyTo callback
- `src/components/map/MapFilterOverlay.tsx` - Collapsible filter panel overlaid on map view
- `src/components/map/MapView.dynamic.tsx` - Added "use client" for server component import compatibility
- `src/components/search/ViewToggle.tsx` - Lista/Mappa toggle with nuqs parseAsStringEnum
- `src/app/(main)/cerca/page.tsx` - Added vista param parsing, getMapSagre fetch, ViewToggle rendering
- `src/components/search/SearchResults.tsx` - Added map view rendering with MapViewDynamic and MapFilterOverlay
- `src/components/detail/DetailMiniMap.dynamic.tsx` - Fixed pre-existing missing "use client" directive

## Decisions Made
- Server/client split for /mappa: page.tsx is a server component that fetches data, MappaClientPage is a client wrapper that manages the Leaflet map instance ref for programmatic flyTo
- Added "use client" to both MapView.dynamic.tsx and DetailMiniMap.dynamic.tsx because next/dynamic with ssr:false requires client component context when imported by server components
- Search page fetches both searchSagre(filters) and getMapSagre() in parallel when vista=mappa, since MapMarkerData includes location coordinates that SagraCardData lacks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed DetailMiniMap.dynamic.tsx missing "use client"**
- **Found during:** Task 1 (build verification)
- **Issue:** Pre-existing file from Plan 03 used next/dynamic with ssr:false without "use client" directive, causing Turbopack build failure
- **Fix:** Added "use client" directive to DetailMiniMap.dynamic.tsx
- **Files modified:** src/components/detail/DetailMiniMap.dynamic.tsx
- **Verification:** Build passes after fix
- **Committed in:** c0aea01 (Task 1 commit)

**2. [Rule 3 - Blocking] Added "use client" to MapView.dynamic.tsx**
- **Found during:** Task 2 (SearchResults importing MapViewDynamic from server component)
- **Issue:** MapView.dynamic.tsx used ssr:false but lacked "use client" -- worked before because it was only imported by client components, but now SearchResults (server component) imports it
- **Fix:** Added "use client" directive to MapView.dynamic.tsx
- **Files modified:** src/components/map/MapView.dynamic.tsx
- **Verification:** Build passes after fix
- **Committed in:** 12cef89 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for build to pass. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All map UI features complete: fullscreen map, geolocation, search toggle, filter overlay
- Detail page (Plan 03) can proceed with mini-map integration using the same dynamic import pattern
- MapView.dynamic.tsx now properly marked as client component for universal import compatibility

## Self-Check: PASSED

All 9 key files verified present. Both task commits (c0aea01, 12cef89) verified in git log. TypeScript compiles cleanly. Build succeeds.

---
*Phase: 05-map-detail*
*Completed: 2026-03-05*
