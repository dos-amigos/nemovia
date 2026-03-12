---
phase: 18-data-pipeline-restoration
plan: 02
subsystem: database, api
tags: [nominatim, geocoding, province-normalization, veneto, viewbox, sql-migration]

# Dependency graph
requires:
  - phase: none
    provides: existing enrichment pipeline and geocode helpers
provides:
  - normalizeProvinceCode() function for Nominatim-to-code mapping
  - VENETO_VIEWBOX constant for bounded geocoding
  - PROVINCE_CODE_MAP constant for province code lookups
  - SQL normalize_province_code function for retroactive normalization
  - FeaturedSagraCard province display
affects: [18-data-pipeline-restoration, enrich-sagre-edge-function]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-copy-for-deno, province-code-normalization, nominatim-viewbox-bounding]

key-files:
  created:
    - supabase/migrations/010_province_normalization.sql
  modified:
    - src/lib/enrichment/geocode.ts
    - src/lib/constants/veneto.ts
    - supabase/functions/enrich-sagre/index.ts
    - src/components/home/FeaturedSagraCard.tsx
    - src/lib/enrichment/__tests__/geocode.test.ts

key-decisions:
  - "Veneto viewbox 10.62,44.79,13.10,46.68 with bounded=1 restricts Nominatim to Veneto region"
  - "Province codes stored as 2-letter format (BL,PD,RO,TV,VE,VR,VI) not Nominatim raw text"
  - "SQL migration for retroactive normalization of existing province values"

patterns-established:
  - "Province normalization: always pass through normalizeProvinceCode() before DB save"
  - "Nominatim viewbox: always include viewbox+bounded params for region-restricted geocoding"

requirements-completed: [DATA-02, DATA-04]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 18 Plan 02: Province Normalization Summary

**Veneto-bounded Nominatim geocoding with normalizeProvinceCode() mapping 14 variants to 7 two-letter codes, SQL migration for retroactive normalization, and FeaturedSagraCard province display fix**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T17:07:22Z
- **Completed:** 2026-03-10T17:10:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- normalizeProvinceCode() maps all 14 Nominatim province text variants to 7 two-letter codes with full test coverage (13 test cases)
- Nominatim geocoding in enrich-sagre Edge Function now bounded to Veneto region via viewbox parameter
- SQL migration 010 creates normalize_province_code function and retroactively normalizes existing province data
- FeaturedSagraCard now displays province in parentheses matching SagraCard pattern

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing tests** - `a9c5723` (test)
2. **Task 1 GREEN: Implement normalizeProvinceCode, VENETO_VIEWBOX, FeaturedSagraCard fix** - `9a7e2bd` (feat)
3. **Task 2: Veneto viewbox in enrich-sagre and SQL migration** - `b6bbfb8` (feat)

_Note: Task 1 followed TDD with RED and GREEN commits._

## Files Created/Modified
- `src/lib/constants/veneto.ts` - Added PROVINCE_CODE_MAP constant (14 entries mapping Nominatim text to 2-letter codes)
- `src/lib/enrichment/geocode.ts` - Added VENETO_VIEWBOX constant and normalizeProvinceCode() function
- `src/lib/enrichment/__tests__/geocode.test.ts` - Added 14 new test cases (normalizeProvinceCode + VENETO_VIEWBOX)
- `supabase/functions/enrich-sagre/index.ts` - Added viewbox+bounded params and inline normalizeProvinceCode
- `supabase/migrations/010_province_normalization.sql` - SQL function and retroactive UPDATE for province normalization
- `src/components/home/FeaturedSagraCard.tsx` - Added province display in parentheses

## Decisions Made
- Veneto viewbox coordinates (10.62,44.79,13.10,46.68) cover full Veneto bounding box with bounded=1
- Province codes stored as 2-letter format for consistency (BL, PD, RO, TV, VE, VR, VI)
- SQL migration includes deactivation of non-Veneto events that slipped through previous geocoding

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**SQL migration and Edge Function require manual deployment:**
- Run `supabase/migrations/010_province_normalization.sql` in Supabase SQL Editor
- Deploy updated `enrich-sagre` Edge Function via Supabase Dashboard

## Next Phase Readiness
- Province normalization ready for all future geocoded events
- Retroactive cleanup migration ready for manual execution
- FeaturedSagraCard province display complete
- All 37 geocode tests passing (23 existing + 14 new)

## Self-Check: PASSED

All 7 files verified present. All 3 task commits verified in git log (a9c5723, 9a7e2bd, b6bbfb8).

---
*Phase: 18-data-pipeline-restoration*
*Completed: 2026-03-10*
