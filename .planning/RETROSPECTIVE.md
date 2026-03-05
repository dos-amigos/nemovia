# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-05
**Phases:** 6 | **Plans:** 18 | **Commits:** 85

### What Was Built
- Config-driven scraping pipeline with Cheerio, dedup, pg_cron scheduling, and event expiration
- Gemini LLM enrichment (food/feature tags + descriptions) and Nominatim geocoding on automated schedule
- Homepage with hero, weekend sagre, emoji quick filters, province counts
- Filterable search page with geolocation distance sorting and lista/mappa toggle
- Interactive Leaflet map with clustering, geolocation, popups navigating to detail pages
- Sagra detail page with mini-map, Google Maps directions, share button, source link
- SEO infrastructure (dynamic metadata, sitemap, OG images) + premium scroll animations

### What Worked
- **Phase-by-phase incremental delivery**: each phase produced a deployable increment, making verification natural
- **PostGIS RPCs**: spatial queries via Supabase RPC (find_nearby_sagre, search_sagre) worked cleanly with the Next.js server component pattern
- **Server/client component split**: keeping data fetching in server components and interactivity in thin client wrappers kept the architecture clean
- **Parallel data fetching**: Promise.all pattern in server components for homepage and search page kept load times fast
- **CDN URLs for Leaflet icons**: avoided Turbopack static asset issues entirely
- **Motion library**: FadeIn/StaggerGrid client wrappers gave premium feel with minimal code

### What Was Inefficient
- **Scraper source attrition**: invested time configuring 5 sources but 4 have broken CSS selectors or need JS rendering — should have validated selectors earlier
- **Inline function copy for Edge Functions**: Deno can't import from Next.js src/, so pure functions are duplicated in Edge Functions — maintenance burden
- **Missing VERIFICATION.md for early phases**: Phases 1 and 3 lacked formal verification files, creating audit gaps that had to be explained later
- **DISC checkbox tracking**: 4 requirements (DISC-01, 02, 03, 08) were implemented but not checked off in REQUIREMENTS.md — better to check off during execution

### Patterns Established
- **Server component → RPC pattern**: server pages call Supabase RPC functions, no client-side data fetching
- **Dynamic import with ssr:false**: for Leaflet components, always wrap in dynamic() with "use client" for Turbopack compatibility
- **nuqs for URL state**: search filters persisted in URL params for sharing and back-button behavior
- **Brand OKLCH colors in Tailwind config**: single source of truth for amber-600 primary, green-700 accent, stone-50 bg
- **Edge Function → pg_cron scheduling**: all background work (scrape, enrich, expire) runs as scheduled Supabase Edge Functions

### Key Lessons
1. **Validate scraper selectors against live HTML before committing to a source** — CSS selectors break without warning when sites update
2. **Create VERIFICATION.md during phase execution, not retroactively** — avoids audit gaps
3. **Check off requirements in REQUIREMENTS.md as part of plan completion** — don't defer this administrative step
4. **Deno Edge Functions need their own copy of shared utilities** — plan for this from the start rather than discovering it during implementation
5. **2 days from zero to shipped MVP is achievable** with clear requirements, phased roadmap, and incremental verification

### Cost Observations
- Model mix: primarily Opus for planning and execution
- Sessions: ~6-8 across 2 days
- Notable: 18 plans across 6 phases in 2 days — high throughput from clear requirements and minimal rework

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 85 | 6 | First milestone — established all patterns |

### Cumulative Quality

| Milestone | LOC | Files | Scraper Sources Active |
|-----------|-----|-------|----------------------|
| v1.0 | 3,514 | 159 | 1/5 |

### Top Lessons (Verified Across Milestones)

1. (First milestone — lessons to be validated in v1.1)
