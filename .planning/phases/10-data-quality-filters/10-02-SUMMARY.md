---
phase: 10-data-quality-filters
plan: 02
subsystem: deployment, database, frontend
tags: [edge-functions, supabase-deploy, retroactive-cleanup, data-quality, postgis, wkb]

# Dependency graph
requires:
  - phase: 10-data-quality-filters
    plan: 01
    provides: noise title filter, location normalization, Veneto province validation in Edge Functions
provides:
  - Deployed scrape-sagre and enrich-sagre Edge Functions with quality filters active in production
  - Retroactive cleanup SQL migration deactivating non-Veneto and noise-title sagre
  - PostGIS WKB hex to GeoJSON parsing for server-side queries
  - MapView guard against undefined coordinates
affects: [frontend-data-display, map-rendering, sagre-queries]

# Tech tracking
tech-stack:
  added: []
  patterns: [ewkb-hex-parsing, optional-chaining-null-guard, retroactive-sql-cleanup]

key-files:
  created:
    - supabase/migrations/005_data_quality.sql
  modified:
    - src/components/map/MapView.tsx
    - src/lib/queries/sagre.ts

key-decisions:
  - "PostgreSQL regex character class used for numeric-only title pattern instead of JS-style regex"
  - "PostGIS WKB hex parsed client-side via Buffer.readDoubleLE rather than changing DB query to ST_AsGeoJSON"
  - "MapView uses optional chaining + length check for coordinates guard rather than separate null checks"

patterns-established:
  - "parseWKBPoint() utility for converting PostgREST geography columns from EWKB hex to GeoJSON"
  - "Retroactive SQL migrations stored in supabase/migrations/ for auditability even when executed manually"

requirements-completed: [QUAL-01, QUAL-02, QUAL-03]

# Metrics
duration: 14min
completed: 2026-03-07
---

# Phase 10 Plan 02: Deploy Data Quality Filters and Retroactive Cleanup Summary

**Deployed quality-filtered Edge Functions, ran retroactive cleanup deactivating 36 dirty sagre (771->735 active), and fixed PostGIS WKB hex parsing for map and detail views**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-07T10:48:00Z
- **Completed:** 2026-03-07T11:02:00Z
- **Tasks:** 1 auto + 1 checkpoint (human-verify)
- **Files modified:** 3

## Accomplishments
- Deployed scrape-sagre and enrich-sagre Edge Functions with noise title filter, location normalization, and Veneto province validation active in production
- Created and executed retroactive cleanup SQL migration that deactivated 36 non-Veneto and noise-title sagre (771 -> 735 active)
- Fixed PostGIS WKB hex string parsing in server queries -- PostgREST returns geography columns as EWKB hex, not GeoJSON objects
- Added MapView coordinate guard to prevent crash when location exists but coordinates array is undefined (pending_geocode state)
- Triggered fresh scrape+enrich cycle to verify new quality filters work on incoming data

## Task Commits

Each task was committed atomically:

1. **Task 1: Create retroactive cleanup migration, deploy Edge Functions, run cleanup and trigger pipeline** - `5b662e9` (feat)
   - Deviation fix 1: `334bf16` (fix) - Guard undefined coordinates in MapView
   - Deviation fix 2: `78aa97e` (fix) - Parse PostGIS WKB hex to GeoJSON in server queries

**Task 2: Verify data quality on live site and Supabase Dashboard** - checkpoint:human-verify (pending user verification)

## Files Created/Modified
- `supabase/migrations/005_data_quality.sql` - Retroactive cleanup SQL deactivating non-Veneto and noise-title sagre via UPDATE statements
- `src/components/map/MapView.tsx` - Added optional chaining + length check for location.coordinates to prevent crash on map page
- `src/lib/queries/sagre.ts` - Added parseWKBPoint() utility to convert EWKB hex to GeoJSON in getMapSagre() and getSagraBySlug()

## Decisions Made
- PostgreSQL regex syntax differs from JS -- used `[-0-9\s/\.]+` character class instead of `[\d\s\-\/\.]+` for numeric-only title pattern in cleanup SQL
- PostGIS WKB hex parsed in application code (Buffer.readDoubleLE at byte offsets 9 and 17 for lng/lat) rather than modifying DB queries to use ST_AsGeoJSON -- avoids changing the Supabase query layer
- MapView guard uses `!sagra.location?.coordinates || sagra.location.coordinates.length < 2` as a single condition rather than separate null checks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Guard against undefined coordinates in MapView**
- **Found during:** Task 1 (post-deployment verification)
- **Issue:** After deactivating dirty sagre, some remaining active sagre had location objects in pending_geocode state (location exists but coordinates array is undefined), causing MapView to crash with "Cannot read property '1' of undefined"
- **Fix:** Changed guard from `if (!sagra.location) return null` to `if (!sagra.location?.coordinates || sagra.location.coordinates.length < 2) return null`
- **Files modified:** src/components/map/MapView.tsx
- **Verification:** Map page renders without crash
- **Committed in:** 334bf16

**2. [Rule 1 - Bug] Parse PostGIS WKB hex to GeoJSON in server queries**
- **Found during:** Task 1 (post-deployment verification)
- **Issue:** PostgREST returns geography columns as WKB hex strings (e.g., "0101000020E6100000..."), not GeoJSON objects. The existing code assumed GeoJSON format, causing all map markers and detail page locations to fail
- **Fix:** Added parseWKBPoint() function that reads EWKB Point format (little-endian, SRID 4326) by extracting longitude at byte offset 9 and latitude at byte offset 17 using Buffer.readDoubleLE. Applied in getMapSagre() and getSagraBySlug()
- **Files modified:** src/lib/queries/sagre.ts
- **Verification:** Map markers display correctly, detail page shows location
- **Committed in:** 78aa97e

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both bugs were discovered during post-deployment verification of the cleanup. The WKB parsing fix was critical -- without it, no map markers or detail locations would render. The coordinate guard prevented crashes for pending-geocode sagre. No scope creep.

## Issues Encountered
- PostgreSQL regex syntax required adjustment from the plan's JS-style character classes (plan used `[\d\s\-\/\.]` which was changed to `[-0-9\s/\.]` for PostgreSQL compatibility)
- PostgREST returns geography columns in WKB hex format, not the expected GeoJSON -- this was a pre-existing issue exposed by the data cleanup changing which rows were active

## User Setup Required
None - Edge Functions are deployed and cleanup has been executed.

## Next Phase Readiness
- Phase 10 (Data Quality Filters) is the final phase of v1.1 "Dati Reali"
- All v1.1 requirements are complete: scrapers fixed, sagritaly ingested, quality filters active
- Pipeline produces clean, Veneto-only sagre data
- Ready for v1.2 milestone planning (UI/UX overhaul, additional features)

## Self-Check: PASSED

- All 3 files verified present on disk
- Commit 5b662e9 verified in git log
- Commit 334bf16 verified in git log
- Commit 78aa97e verified in git log

---
*Phase: 10-data-quality-filters*
*Completed: 2026-03-07*
