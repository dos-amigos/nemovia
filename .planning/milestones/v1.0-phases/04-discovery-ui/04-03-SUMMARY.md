---
phase: 04-discovery-ui
plan: 03
subsystem: ui
tags: [nuqs, geolocation, search, filters, next.js, supabase, shadcn]

# Dependency graph
requires:
  - phase: 04-discovery-ui/01
    provides: "searchSagre query, SagraCard component, SagraGrid, VENETO_PROVINCES, PostGIS RPC"
  - phase: 04-discovery-ui/02
    provides: "NuqsAdapter in root layout"
provides:
  - "Search page with multi-filter controls and server-side data fetching"
  - "useGeolocation hook for opt-in browser geolocation"
  - "ActiveFilters badge display for active filter state"
  - "SearchResults server component with empty state handling"
affects: [05-map-detail, 06-seo-polish]

# Tech tracking
tech-stack:
  added: [shadcn/select, shadcn/input]
  patterns: [nuqs-useQueryStates-shallow-false, geolocation-opt-in-hook, url-param-driven-server-fetch]

key-files:
  created:
    - src/hooks/useGeolocation.ts
    - src/components/search/SearchFilters.tsx
    - src/components/search/ActiveFilters.tsx
    - src/components/search/SearchResults.tsx
    - src/components/ui/select.tsx
    - src/components/ui/input.tsx
  modified:
    - src/app/(main)/cerca/page.tsx

key-decisions:
  - "Geolocation lat/lng stored as string params in URL, parsed to float by server component"
  - "Filter parsers defined inline in each client component (SearchFilters, ActiveFilters) rather than shared module for simplicity"
  - "Raggio km input only appears when geolocation is active -- prevents confusion about distance filter"
  - "Select uses sentinel value __all__ to represent 'clear filter' since Radix Select requires non-empty string values"

patterns-established:
  - "URL-driven server fetch: client components update nuqs params with shallow:false, server component re-renders with fresh data"
  - "Opt-in geolocation: hook exposes requestLocation callback, never auto-requests on mount"

requirements-completed: [DISC-06]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 4 Plan 3: Search Page Summary

**Search page with nuqs multi-filter controls (provincia, raggio, cucina, gratis, dates), opt-in geolocation hook, and server-side filtered SagraCard results**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T11:32:42Z
- **Completed:** 2026-03-05T11:36:22Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Search page reads URL params and fetches filtered sagre from Supabase via searchSagre
- Six filter dimensions wired to nuqs URL params with shallow:false for server re-render
- Geolocation hook is opt-in only (no auto-request), syncs lat/lng to URL for PostGIS distance query
- Empty state with helpful message when no sagre match current filters
- Active filters shown as removable badges below the filter panel
- Build succeeds with /cerca as dynamic server-rendered route (38.7 kB first load JS)

## Task Commits

Each task was committed atomically:

1. **Task 1: Geolocation hook + shadcn components + search filter controls** - `f4ae7aa` (feat)
2. **Task 2: Search page server component + results display** - `8fd7f04` (feat)

## Files Created/Modified
- `src/hooks/useGeolocation.ts` - Browser geolocation hook with opt-in requestLocation
- `src/components/search/SearchFilters.tsx` - Client filter controls (provincia, raggio, cucina, gratis, dates) via nuqs
- `src/components/search/ActiveFilters.tsx` - Removable badge display for active filters
- `src/components/search/SearchResults.tsx` - Server component rendering SagraCard grid with empty state
- `src/app/(main)/cerca/page.tsx` - Async server component parsing URL params, calling searchSagre, rendering results
- `src/components/ui/select.tsx` - shadcn Select component (installed)
- `src/components/ui/input.tsx` - shadcn Input component (installed)

## Decisions Made
- Geolocation lat/lng stored as string params in URL, parsed to float by server component -- keeps nuqs parsers simple and URL human-readable
- Filter parsers defined inline in each client component rather than shared module -- two consumers is not enough to justify extraction
- Raggio km input conditionally rendered only when geolocation is active -- avoids user confusion about distance without position
- Select uses sentinel value `__all__` for "clear" option since Radix Select requires non-empty string values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 (Discovery UI) is now complete: homepage, data layer, and search page all shipped
- Phase 5 (Map & Detail) can begin -- it will consume the same searchSagre query and SagraCard components
- The useGeolocation hook is ready for reuse by the map page's "Vicino a me" feature

## Self-Check: PASSED

- All 7 files verified present on disk
- Commit f4ae7aa verified in git log (Task 1)
- Commit 8fd7f04 verified in git log (Task 2)
- TypeScript compilation: zero errors
- Next.js build: success

---
*Phase: 04-discovery-ui*
*Completed: 2026-03-05*
