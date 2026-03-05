---
phase: 05-map-detail
plan: 01
subsystem: ui
tags: [leaflet, react-leaflet, marker-cluster, map, geospatial, dynamic-import]

# Dependency graph
requires:
  - phase: 04-discovery-ui
    provides: SagraCardData type, Supabase query patterns, veneto constants, formatDateRange util
provides:
  - MapView client component with Leaflet, clustering, and marker popups
  - MapView.dynamic.tsx SSR-safe wrapper with next/dynamic
  - MapMarkerPopup component for marker click display
  - MapMarkerData type for lean map queries
  - getMapSagre() query for all active sagre with location
  - getSagraBySlug() query for full detail page data
  - MAP_MARKER_FIELDS, VENETO_CENTER, DEFAULT_MAP_ZOOM constants
affects: [05-map-detail, 06-seo-polish]

# Tech tracking
tech-stack:
  added: [leaflet@1.9.4, react-leaflet@5.0.0, @react-leaflet/core, react-leaflet-cluster@4.0.0, @types/leaflet]
  patterns: [dynamic-import-ssr-false, leaflet-icon-cdn-fix, postgis-lnglat-to-leaflet-latlng]

key-files:
  created:
    - src/components/map/MapView.tsx
    - src/components/map/MapView.dynamic.tsx
    - src/components/map/MapMarkerPopup.tsx
  modified:
    - src/lib/queries/types.ts
    - src/lib/queries/sagre.ts
    - src/lib/constants/veneto.ts
    - package.json

key-decisions:
  - "CDN URLs for Leaflet marker icons (Turbopack-safe, avoids broken static asset imports)"
  - "MapReadyHandler inner component exposes map instance via onMapReady callback for programmatic control"
  - "Cluster CSS imported from react-leaflet-cluster/dist/assets/ (verified path after install)"

patterns-established:
  - "Dynamic import pattern: MapView.dynamic.tsx wraps client component with ssr:false and loading fallback"
  - "PostGIS coordinate swap: location.coordinates[1], location.coordinates[0] for Leaflet [lat,lng]"
  - "Lean field selection: MAP_MARKER_FIELDS constant for minimal map payload"

requirements-completed: [MAP-01, MAP-02, MAP-03]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 5 Plan 1: Map Component Library Summary

**Leaflet map with marker clustering, popup navigation, and dynamic SSR-safe wrapper using react-leaflet v5**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T13:52:47Z
- **Completed:** 2026-03-05T13:56:28Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed full Leaflet ecosystem (leaflet, react-leaflet, @react-leaflet/core, react-leaflet-cluster, @types/leaflet)
- Built reusable MapView component with OpenStreetMap tiles, marker clustering, and popup navigation
- Created dynamic import wrapper preventing Leaflet SSR crashes in Next.js
- Added lean getMapSagre() and full getSagraBySlug() Supabase query functions
- Established MapMarkerData type contract for downstream map consumers

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Leaflet packages and add types, queries, and constants** - `4a8df29` (feat)
2. **Task 2: Create MapView component with clustering, popup, and dynamic wrapper** - `77d345f` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `src/components/map/MapView.tsx` - Client-side Leaflet map with clustering, markers, and popups
- `src/components/map/MapView.dynamic.tsx` - Dynamic import wrapper with ssr: false and loading fallback
- `src/components/map/MapMarkerPopup.tsx` - Compact popup content with title, location, dates, tags, and detail link
- `src/lib/queries/types.ts` - Added MapMarkerData type for lean map marker data
- `src/lib/queries/sagre.ts` - Added getMapSagre() and getSagraBySlug() query functions
- `src/lib/constants/veneto.ts` - Added MAP_MARKER_FIELDS, VENETO_CENTER, DEFAULT_MAP_ZOOM constants
- `package.json` - Added leaflet, react-leaflet, @react-leaflet/core, react-leaflet-cluster, @types/leaflet

## Decisions Made
- Used CDN URLs for Leaflet marker icons instead of importing from leaflet package (Turbopack breaks static asset imports from node_modules)
- Added MapReadyHandler inner component using useMap() hook to expose map instance via onMapReady callback (enables "Vicino a me" re-centering in Plan 02)
- Imported cluster CSS from react-leaflet-cluster/dist/assets/ (verified actual path after npm install, not the lib/assets/ path mentioned in research)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MapView.dynamic.tsx ready for import by the fullscreen map page (Plan 02) and detail page mini-map (Plan 03)
- getMapSagre() ready for server component data fetching on /mappa page
- getSagraBySlug() ready for /sagra/[slug] detail page
- MapViewProps interface supports center/zoom overrides for mini-map use case

## Self-Check: PASSED

All 7 key files verified present. Both task commits (4a8df29, 77d345f) verified in git log. TypeScript compiles cleanly. Build succeeds.

---
*Phase: 05-map-detail*
*Completed: 2026-03-05*
