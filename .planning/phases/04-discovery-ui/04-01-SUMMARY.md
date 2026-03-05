---
phase: 04-discovery-ui
plan: 01
subsystem: database, ui, api
tags: [postgis, rpc, supabase, next-image, react, server-component, tailwind]

# Dependency graph
requires:
  - phase: 02-scraping-pipeline
    provides: sagre table with is_active, location, province, food_tags columns
  - phase: 03-data-enrichment
    provides: enhanced_description, geocoded location (PostGIS geometry), food_tags from LLM
provides:
  - PostGIS RPC functions (find_nearby_sagre, count_sagre_by_province) for spatial queries
  - Typed query functions (getWeekendSagre, searchSagre, getProvinceCounts)
  - SagraCard server component with full card layout
  - SagraCardSkeleton loading state component
  - SagraGrid responsive grid wrapper
  - Domain constants (VENETO_PROVINCES, QUICK_FILTER_CHIPS, SAGRA_CARD_FIELDS)
  - formatDateRange utility for Italian date formatting
  - next.config.ts remote image patterns for scraped image URLs
affects: [04-02-homepage, 04-03-search, 05-map-detail]

# Tech tracking
tech-stack:
  added: []
  patterns: [PostGIS RPC with SET search_path, server-only query layer, SagraCardData pick type, Italian date formatting]

key-files:
  created:
    - supabase/migrations/004_discovery.sql
    - src/lib/constants/veneto.ts
    - src/lib/queries/types.ts
    - src/lib/queries/sagre.ts
    - src/components/sagra/SagraCard.tsx
    - src/components/sagra/SagraCardSkeleton.tsx
    - src/components/sagra/SagraGrid.tsx
  modified:
    - src/lib/utils.ts
    - next.config.ts

key-decisions:
  - "PostGIS RPC uses SET search_path = '' with fully qualified extensions.* and public.* references for security"
  - "SagraCard is a server component (no 'use client') -- receives data as props for SSR"
  - "next.config.ts uses catch-all hostname ** for remote images -- acceptable for MVP with unpredictable scraped CDN domains"
  - "searchSagre applies additional filters in-memory when using RPC spatial search, standard query chaining otherwise"

patterns-established:
  - "Server query layer: src/lib/queries/*.ts exports async functions using createClient() from supabase/server"
  - "Domain constants: src/lib/constants/*.ts for province lists, filter chips, field selections"
  - "Card component pattern: SagraCard receives typed SagraCardData props, no client-side data fetching"
  - "Italian date formatting: formatDateRange() with abbreviated month names (gen, feb, mar...)"

requirements-completed: [DISC-04, DISC-05, DISC-07]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 4 Plan 1: Discovery Data Layer Summary

**PostGIS spatial RPCs, typed query functions, Veneto domain constants, and SagraCard server component with Italian date formatting**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T10:00:52Z
- **Completed:** 2026-03-05T10:03:43Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- PostGIS RPC functions for distance-based search (find_nearby_sagre) and province aggregation (count_sagre_by_province)
- Typed data access layer with getWeekendSagre, searchSagre (with spatial + filter support), and getProvinceCounts
- SagraCard server component rendering image/placeholder, title, enhanced description, location with province, Italian-formatted dates, food tags (max 3), price info, and optional distance
- Domain constants for all 7 Veneto provinces, 8 quick filter chips, and card field selection string

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration + constants + data access layer** - `12fc8d1` (feat)
2. **Task 2: SagraCard component + grid + skeleton + next.config.ts + formatDateRange** - `ad9f30a` (feat)

**Plan metadata:** `65cf812` (docs: complete plan)

## Files Created/Modified
- `supabase/migrations/004_discovery.sql` - PostGIS RPC functions for spatial queries and province counts
- `src/lib/constants/veneto.ts` - Veneto provinces, quick filter chips, card field selection constant
- `src/lib/queries/types.ts` - SearchFilters, SagraCardData, ProvinceCount type definitions
- `src/lib/queries/sagre.ts` - Server-side query functions (getWeekendSagre, searchSagre, getProvinceCounts)
- `src/components/sagra/SagraCard.tsx` - Reusable sagra card with image, metadata, tags, distance
- `src/components/sagra/SagraCardSkeleton.tsx` - Loading skeleton matching SagraCard layout
- `src/components/sagra/SagraGrid.tsx` - Responsive 1-2 column grid wrapper
- `src/lib/utils.ts` - Added formatDateRange() with Italian month abbreviations
- `next.config.ts` - Added images.remotePatterns for scraped image URLs

## Decisions Made
- PostGIS RPC uses `SET search_path = ''` with fully qualified `extensions.*` and `public.*` references (Supabase security best practice)
- SagraCard is a pure server component (no `use client`) receiving typed SagraCardData props
- `next.config.ts` uses catch-all `hostname: "**"` for remote images (acceptable for MVP with unpredictable scraped CDN domains)
- searchSagre applies additional filters in-memory after RPC spatial results (PostGIS returns distance-sorted, then province/cuisine/date filters applied client-side)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The migration (004_discovery.sql) will need to be applied to the production Supabase instance before the discovery features go live, but that is handled by the standard deployment workflow.

## Next Phase Readiness
- All shared contracts ready for homepage (04-02) and search page (04-03)
- SagraCard, SagraGrid, and skeleton components ready to compose into pages
- Query functions provide all data the homepage needs (getWeekendSagre, getProvinceCounts)
- Migration 004_discovery.sql ready for `supabase db push` deployment

## Self-Check: PASSED

- All 9 created/modified files verified on disk
- Both task commits (12fc8d1, ad9f30a) verified in git log
- TypeScript compilation: zero new errors (only pre-existing vitest/Deno type issues)

---
*Phase: 04-discovery-ui*
*Completed: 2026-03-05*
