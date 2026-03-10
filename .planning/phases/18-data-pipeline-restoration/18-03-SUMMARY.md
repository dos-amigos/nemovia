---
phase: 18-data-pipeline-restoration
plan: 03
subsystem: scraper, database
tags: [cheerio, web-scraping, schema-org, pagination, edge-function, sql-migration]

# Dependency graph
requires:
  - phase: 18-01
    provides: "isNonSagraTitle() filter and filter chain in scrape-sagre Edge Function"
  - phase: 18-02
    provides: "Province normalization and Veneto viewbox for geocoding"
provides:
  - "itinerarinelgusto.it scraper source with verified CSS selectors and Schema.org extraction"
  - "Offset-based pagination support in buildPageUrl() for itinerarinelgusto"
  - "SQL migration 011 for scraper_sources INSERT"
affects: [enrich-sagre, scrape-sagre-edge-function, 19-images]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema.org microdata extraction: use meta[itemprop] for clean ISO dates and CDN image URLs"
    - "Offset-based pagination: source-specific calculation in buildPageUrl() for non-page-number patterns"

key-files:
  created:
    - supabase/migrations/011_add_itinerarinelgusto_source.sql
  modified:
    - supabase/functions/scrape-sagre/index.ts

key-decisions:
  - "Selector .row.tile.post.pad verified (research suggested .row.post.pad, actual HTML includes .tile class)"
  - "Schema.org meta tags used for dates instead of text parsing -- ISO format (2026-03-08T17:00:00) provides reliable data"
  - "Full-size CDN image from meta[itemprop=image] preferred over midsize figure img"
  - "max_pages set to 3 (conservative) per research Pitfall 5 to avoid Edge Function timeout"
  - "Source confirmed viable: 150 Veneto sagre, 15/page, server-rendered HTML with structured microdata"

patterns-established:
  - "Schema.org extraction: when source provides microdata, prefer meta[itemprop] over CSS text selectors"
  - "Offset pagination: buildPageUrl() source-name check converts page number to offset for non-standard patterns"

requirements-completed: [SCRAPE-02, DATA-01]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 18 Plan 03: itinerarinelgusto Source Investigation Summary

**Verified itinerarinelgusto.it as viable scraper source with 150 Veneto sagre, Schema.org microdata extraction, offset-based pagination, and SQL migration for scraper_sources**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T17:14:20Z
- **Completed:** 2026-03-10T17:16:47Z
- **Tasks:** 1
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Investigated itinerarinelgusto.it: confirmed server-rendered HTML with Schema.org Event microdata for all 150 Veneto sagre
- Verified CSS selectors from live HTML: `.row.tile.post.pad` containers (corrected from research suggestion `.row.post.pad`)
- Added itinerarinelgusto extraction branch in extractRawEvent() using Schema.org meta tags for ISO dates and CDN image URLs
- Added offset-based pagination in buildPageUrl() converting page numbers to offsets (0, 15, 30...)
- Created SQL migration 011 with scraper_sources INSERT (max_pages=3 conservative start)
- Full test suite passes: 168 tests, 0 regressions across all Phase 18 changes

## Investigation Findings

### Source Viability: VIABLE

| Property | Finding |
|----------|---------|
| URL | https://www.itinerarinelgusto.it/sagre-e-feste/veneto |
| Rendering | Server-side HTML (no JavaScript required) |
| Events | 150 Veneto sagre ("risultati 1 - 15 di 150 trovati") |
| Pagination | 15/page, offset-based `?sagre-e-feste_pg_from=15,30,45...` |
| Microdata | Schema.org Event with startDate, endDate (ISO), image (CDN), name |
| Card selector | `.row.tile.post.pad` (each has `itemscope itemtype="http://schema.org/Event"`) |
| Title | `h2.events a` (text + href) |
| Dates | `meta[itemprop="startDate"]` / `meta[itemprop="endDate"]` content attr (ISO datetime) |
| City | `h3.event-header a` (e.g., "Roncade", "Provincia di Treviso") |
| Image | `meta[itemprop="image"]` content attr (full-size CDN URL from cdn.itinerarinelgusto.it) |
| Description | `p.abstract[itemprop="description"]` (bonus, not scraped) |

### Combined Effect Assessment

Plans 01+02 (filter recalibration + province normalization) restore previously over-filtered events via SQL migrations 009+010. With itinerarinelgusto adding up to 45 new events (3 pages x 15), the combined pipeline should comfortably exceed the DATA-01 target of 100+ active sagre.

**To verify active count after all migrations and deployments:**
```sql
SELECT count(*) FROM sagre WHERE is_active = true;
```

## Task Commits

Each task was committed atomically:

1. **Task 1: Investigate itinerarinelgusto.it and implement scraper** - `2d6f7e6` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `supabase/functions/scrape-sagre/index.ts` - Added itinerarinelgusto extraction branch in extractRawEvent() + offset pagination in buildPageUrl()
- `supabase/migrations/011_add_itinerarinelgusto_source.sql` - INSERT for scraper_sources table with verified selectors and conservative max_pages=3

## Decisions Made
- **Corrected selector**: Research suggested `.row.post.pad` but live HTML uses `.row.tile.post.pad` (includes `.tile` class). Verified from actual HTML fetch.
- **Schema.org over text parsing**: Source provides ISO datetimes in meta tags, eliminating Italian date text parsing errors. Dates are converted to DD/MM/YYYY format for parseItalianDateRange() compatibility.
- **Full-size CDN images**: `meta[itemprop="image"]` provides original resolution from `cdn.itinerarinelgusto.it` instead of midsize thumbnails from `figure.box-pic img`.
- **Conservative max_pages=3**: Limits to 45 events per scrape run to avoid Edge Function timeout (Pitfall 5 from research). Can be increased after monitoring.
- **City prefix stripping**: `h3.event-header a` sometimes returns "Provincia di Treviso" instead of a city name. The extraction strips "Provincia di" prefix for cleaner city values.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**SQL migration and Edge Function require manual deployment:**
1. Run `supabase/migrations/011_add_itinerarinelgusto_source.sql` in Supabase SQL Editor to add the new source
2. Deploy updated `scrape-sagre` Edge Function via Supabase Dashboard (includes new extraction branch + offset pagination)
3. After first scrape run, verify results: `SELECT * FROM scrape_logs WHERE source_name = 'itinerarinelgusto' ORDER BY completed_at DESC LIMIT 5;`

**Note:** Migrations 009 (filter recalibration) and 010 (province normalization) from Plans 01+02 should also be executed if not yet done.

## Next Phase Readiness
- Phase 18 complete: all 3 plans executed (filter recalibration, province normalization, new source)
- Combined effect restores healthy data pipeline: recalibrated filters + new source should exceed 100+ active events
- Ready for Phase 19 (Images) once SQL migrations and Edge Functions are deployed
- itinerarinelgusto provides high-quality CDN images that may reduce need for Unsplash fallbacks

## Self-Check: PASSED

All 3 files verified present (scrape-sagre/index.ts, migration 011, SUMMARY.md). Commit 2d6f7e6 verified in git log. grep confirms "itinerarinelgusto" in Edge Function.

---
*Phase: 18-data-pipeline-restoration*
*Completed: 2026-03-10*
