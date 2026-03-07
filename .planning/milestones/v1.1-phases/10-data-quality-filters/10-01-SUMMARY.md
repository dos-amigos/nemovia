---
phase: 10-data-quality-filters
plan: 01
subsystem: scraper, enrichment
tags: [data-quality, noise-filter, geocoding, nominatim, veneto-validation]

# Dependency graph
requires:
  - phase: 08-fix-cheerio-scrapers
    provides: working scraper CSS selectors for all 5 sources
  - phase: 09-sagritaly-ingestion
    provides: sagritaly scraper source active in pipeline
provides:
  - isNoiseTitle() noise detection in scrape-sagre Edge Function
  - normalizeLocationText() location cleanup in enrich-sagre Edge Function
  - VENETO_PROVINCES list and isVenetoProvince() province validation
  - Non-Veneto sagre deactivation after geocoding
affects: [10-02-PLAN, frontend-data-display, enrich-sagre-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns: [pipeline-stage-filtering, location-text-normalization, province-gating]

key-files:
  created: []
  modified:
    - supabase/functions/scrape-sagre/index.ts
    - supabase/functions/enrich-sagre/index.ts
    - src/lib/enrichment/geocode.ts
    - src/lib/enrichment/__tests__/geocode.test.ts

key-decisions:
  - "Noise filter uses heuristic pattern matching (length, regex) rather than ML classification -- simple, fast, no external dependencies"
  - "normalizeLocationText appends ', Veneto' for bare city names to improve Nominatim disambiguation"
  - "Non-Veneto sagre are deactivated (is_active=false) but coordinates/province still saved for debugging"
  - "cleanCityName kept as deprecated alias for backward compatibility"

patterns-established:
  - "Pipeline-stage filtering: noise at scrape time, province at geocode time"
  - "Location normalization: strip province codes, region prefixes, add disambiguation suffix"

requirements-completed: [QUAL-01, QUAL-02, QUAL-03]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 10 Plan 01: Data Quality Filters Summary

**Noise title detection at scrape time, location text normalization for geocoding, and Veneto province gating after geocoding**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T10:36:01Z
- **Completed:** 2026-03-07T10:39:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- isNoiseTitle() filters out calendar pages, navigation text, and generic non-event strings before DB insert
- normalizeLocationText() strips province codes, region prefixes, and adds ", Veneto" disambiguation for better Nominatim results
- Non-Veneto sagre are deactivated (is_active=false, status=geocode_failed) after geocoding instead of being promoted to LLM enrichment
- Canonical src/lib/enrichment/geocode.ts updated with all new functions and 23 passing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add noise title detection, location normalization, Veneto validation** - `5cd9875` (feat)
2. **Task 2: Update canonical src/lib copies** - `d38cb81` (feat)

## Files Created/Modified
- `supabase/functions/scrape-sagre/index.ts` - Added isNoiseTitle() function and skip logic before upsert
- `supabase/functions/enrich-sagre/index.ts` - Added VENETO_PROVINCES, isVenetoProvince(), normalizeLocationText(), and non-Veneto deactivation logic
- `src/lib/enrichment/geocode.ts` - Added normalizeLocationText(), VENETO_PROVINCES, isVenetoProvince(); cleanCityName as deprecated alias
- `src/lib/enrichment/__tests__/geocode.test.ts` - Updated from 10 to 23 tests covering normalization, province validation, and backward compat

## Decisions Made
- Noise filter uses heuristic pattern matching (length checks, regex) rather than ML classification -- simple, fast, no external dependencies needed
- normalizeLocationText() appends ", Veneto" for bare city names to help Nominatim resolve ambiguous Italian city names to the Veneto region
- Non-Veneto sagre still get their coordinates and province saved (useful for debugging) but are marked is_active=false and status=geocode_failed so they skip LLM enrichment
- cleanCityName kept as deprecated alias pointing to normalizeLocationText for backward compatibility with existing imports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated geocode tests for changed cleanCityName behavior**
- **Found during:** Task 2 (Update canonical src/lib copies)
- **Issue:** cleanCityName now delegates to normalizeLocationText which appends ", Veneto" to bare city names -- existing tests expected old behavior (e.g., "Mestre" -> "Mestre" but now returns "Mestre, Veneto")
- **Fix:** Rewrote test suite with 23 tests covering normalizeLocationText, cleanCityName alias, isVenetoProvince, and VENETO_PROVINCES
- **Files modified:** src/lib/enrichment/__tests__/geocode.test.ts
- **Verification:** All 23 tests pass
- **Committed in:** d38cb81 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test update was necessary consequence of the behavioral change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Changes must be deployed to Supabase Edge Functions to take effect.

## Next Phase Readiness
- Data quality filters are in place for scraping and enrichment
- Ready for plan 02 (if applicable) or deployment
- Edge Functions need to be redeployed to Supabase for changes to take effect in production

## Self-Check: PASSED

- All 5 files verified present on disk
- Commit 5cd9875 verified in git log
- Commit d38cb81 verified in git log
- TypeScript compiles without errors
- All 23 tests pass

---
*Phase: 10-data-quality-filters*
*Completed: 2026-03-07*
