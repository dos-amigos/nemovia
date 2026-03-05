---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-02-PLAN.md (map pages and search toggle)
last_updated: "2026-03-05T14:13:04.231Z"
last_activity: "2026-03-05 -- Completed 05-03: Detail page with mini map, directions, share button"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
---

---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-03-PLAN.md (detail page)
last_updated: "2026-03-05T14:03:50Z"
last_activity: "2026-03-05 -- Completed 05-03: Detail page with mini map, directions, share button"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.
**Current focus:** Phase 5 complete. All 3 plans done (map library, fullscreen map, detail page). Ready for Phase 6: SEO & Polish.

## Current Position

Phase: 5 of 6 (Map & Detail)
Plan: 3 of 3 complete (05-03 detail page)
Status: Phase 5 complete
Last activity: 2026-03-05 -- Completed 05-03: Detail page with mini map, directions, share button

Progress: [██████████] 100% (15 of 15 plans completed)

## Performance Metrics

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation & Design System | 2/2 | Complete |
| 2. Scraping Pipeline | 4/4 | Complete |
| 3. Data Enrichment | 3/3 | Complete |
| 4. Discovery UI | 3/3 | Complete |
| 5. Map & Detail | 3/3 | Complete |
| 6. SEO & Polish | 0/? | Not started |

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 04 | P03 | 4min | 2 | 7 |
| 05 | P01 | 4min | 2 | 9 |
| 05 | P03 | 4min | 2 | 6 |
| Phase 05 P02 | 5min | 2 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 05-03]: DirectionsButton uses plain <a> tag with buttonVariants (no JS needed, better accessibility)
- [Phase 05-03]: DetailMiniMap.dynamic.tsx needs "use client" for ssr:false with Turbopack
- [Phase 05-03]: ShareButton clipboard API with Web Share API fallback for mobile
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
- [Phase 05-02]: Server/client split for /mappa: server component fetches, client wrapper holds map ref for flyTo
- [Phase 05-02]: Dynamic import wrappers with ssr:false need use client for server component import compatibility
- [Phase 05-02]: Search page fetches both searchSagre and getMapSagre in parallel when vista=mappa

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

Last session: 2026-03-05T14:07:02.342Z
Stopped at: Completed 05-02-PLAN.md (map pages and search toggle)
Resume file: None
