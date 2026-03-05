---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-01-PLAN.md (discovery data layer)
last_updated: "2026-03-05T10:03:43Z"
last_activity: "2026-03-05 -- Completed 04-01: PostGIS RPCs, query layer, SagraCard component, domain constants"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 12
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Mostrare TUTTE le sagre del Veneto in un unico posto -- dove sono, quando sono, cosa offrono -- con un'esperienza mobile-first che nessun portale esistente offre.
**Current focus:** Phase 4: Discovery UI (Homepage, SagraCard, search with filters)

## Current Position

Phase: 4 of 6 (Discovery UI) -- IN PROGRESS
Plan: 1 of 3 complete (04-01 data layer done, 04-02 homepage next)
Status: Executing -- discovery data layer shipped, homepage build next
Last activity: 2026-03-05 -- Completed 04-01: PostGIS RPCs, query layer, SagraCard, constants

Progress: [█████████░] 83% (10 of 12 plans completed)

## Performance Metrics

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation & Design System | 2/2 | Complete |
| 2. Scraping Pipeline | 4/4 | Complete |
| 3. Data Enrichment | 3/3 | Complete |
| 4. Discovery UI | 1/3 | In progress |
| 5. Map & Detail | 0/? | Not started |
| 6. SEO & Polish | 0/? | Not started |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

Last session: 2026-03-05T10:03:43Z
Stopped at: Completed 04-01-PLAN.md (discovery data layer)
Resume file: None
