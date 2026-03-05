---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-01-PLAN.md (map component library)
last_updated: "2026-03-05T13:57:57Z"
last_activity: "2026-03-05 -- Completed 05-01: Leaflet map with clustering, popup, dynamic wrapper, queries"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 15
  completed_plans: 13
  percent: 87
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.
**Current focus:** Phase 5 in progress. Map component library complete (Plan 01). Next: fullscreen map page (Plan 02).

## Current Position

Phase: 5 of 6 (Map & Detail)
Plan: 1 of 3 complete (05-01 map component library)
Status: Executing Phase 5
Last activity: 2026-03-05 -- Completed 05-01: Leaflet map with clustering, popup, dynamic wrapper, queries

Progress: [█████████░] 87% (13 of 15 plans completed)

## Performance Metrics

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation & Design System | 2/2 | Complete |
| 2. Scraping Pipeline | 4/4 | Complete |
| 3. Data Enrichment | 3/3 | Complete |
| 4. Discovery UI | 3/3 | Complete |
| 5. Map & Detail | 1/3 | In progress |
| 6. SEO & Polish | 0/? | Not started |

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04 | P03 | 4min | 2 | 7 |
| 05 | P01 | 4min | 2 | 9 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 05-01]: CDN URLs for Leaflet marker icons (Turbopack-safe, avoids broken static asset imports)
- [Phase 05-01]: MapReadyHandler inner component exposes map instance via onMapReady callback for programmatic control
- [Phase 05-01]: Cluster CSS imported from react-leaflet-cluster/dist/assets/ (verified path after install)
- [Phase 04-03]: Geolocation lat/lng stored as string URL params, parsed to float by server component
- [Phase 04-03]: Select uses sentinel __all__ for clear option (Radix Select requires non-empty values)
- [Phase 04-03]: Raggio km filter conditionally rendered only when geolocation active
- [Phase 04-02]: NuqsAdapter at root layout level for search param management
- [Phase 04-02]: Homepage async server component with Promise.all data fetching
- [Phase 04-02]: Only QuickFilters needs 'use client' (router.push navigation)
- [Phase 04-02]: Excluded supabase/functions from tsconfig (Deno type errors blocking build)
- [Phase 04-01]: PostGIS RPC uses SET search_path = '' with fully qualified extensions.*/public.* (Supabase security)
- [Phase 04-01]: SagraCard is server component (no 'use client') -- SSR-friendly prop-driven rendering
- [Phase 04-01]: next.config.ts catch-all hostname ** for remote images (MVP with unpredictable CDN domains)
- [Phase 04-01]: searchSagre in-memory filtering after PostGIS RPC for combined spatial + attribute queries
- [Phase 03-03]: Relaxed city requirement in scraper -- events without city accepted (geocoding fills later)
- [Phase 03-03]: Added parseCityFromText() fallback for eventiesagre's "Region City (Province)" pattern
- [Phase 03-03]: Disabled 4 non-working scraper sources -- only eventiesagre active (~140 events)
- [Phase 03-03]: Data quality issues deferred (non-Veneto events, noise titles, dirty location_text)
- [Phase 03-02]: GEOCODE_LIMIT=30 fits within 50s Edge Function timeout
- [Phase 03-02]: Inline pure function copy pattern for Deno Edge Functions
- [Phase 03-01]: Pure function library in src/lib/enrichment/ for Vitest testing
- [Phase 03-01]: BATCH_SIZE=8 sagre per Gemini call stays within 250 RPD free tier

### Pending Todos

- Fix scraping data quality: non-Veneto events, noise titles, dirty location_text
- Fix CSS selectors for assosagre, solosagre, venetoinfesta (currently disabled)
- sagritaly is JS-rendered -- not scrapable with Cheerio, needs alternative approach
- Italian date format parsing may need refinement as real data volume grows

### Blockers/Concerns

- Only 1 of 5 scraper sources active (eventiesagre) -- sufficient for dev but not production
- Gemini free tier limits may change (last changed Dec 2025)
- Data quality: some scraped events are not sagre or not from Veneto

## Session Continuity

Last session: 2026-03-05T13:57:57.636Z
Stopped at: Completed 05-01-PLAN.md (map component library)
Resume file: None
