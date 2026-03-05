---
phase: 04-discovery-ui
plan: 02
subsystem: ui, pages
tags: [homepage, hero, quick-filters, province-counts, weekend-sagre, nuqs, server-component]

# Dependency graph
requires:
  - phase: 04-01
    provides: SagraCard, SagraGrid, SagraCardSkeleton, query functions, domain constants
provides:
  - Homepage with data-driven sections (hero, weekend sagre, quick filters, provinces)
  - HeroSection with search bar link to /cerca
  - WeekendSection rendering SagraCards from getWeekendSagre()
  - QuickFilters client component with emoji chips navigating to /cerca
  - ProvinceSection showing 7 Veneto provinces with sagra counts
  - NuqsAdapter at root layout level for search param management
  - scrollbar-hide CSS utility
affects: [04-03-search, 05-map-detail]

# Tech tracking
tech-stack:
  added: [nuqs]
  patterns: [NuqsAdapter root wrapper, async server page with Promise.all data fetch]

key-files:
  created:
    - src/components/home/HeroSection.tsx
    - src/components/home/WeekendSection.tsx
    - src/components/home/QuickFilters.tsx
    - src/components/home/ProvinceSection.tsx
  modified:
    - src/app/(main)/page.tsx
    - src/app/layout.tsx
    - src/app/globals.css
    - tsconfig.json

key-decisions:
  - "NuqsAdapter wraps children at root layout level (needed by 04-03 search page)"
  - "Homepage is async server component fetching data via Promise.all"
  - "QuickFilters is the only client component ('use client') -- all others are server components"
  - "Excluded supabase/functions from tsconfig to prevent Deno type errors blocking build"

patterns-established:
  - "Section component pattern: src/components/home/*.tsx with typed props from query layer"
  - "Async page data fetching: Promise.all at page level, pass results as props to sections"

requirements-completed: [DISC-01, DISC-02, DISC-03, DISC-08]

# Metrics
duration: resumed session
completed: 2026-03-05
---

# Phase 4 Plan 2: Homepage Summary

**Data-driven homepage with hero, weekend sagre, emoji quick filters, and province counts**

## Performance

- **Completed:** 2026-03-05
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- HeroSection with gradient background and fake search bar linking to /cerca
- WeekendSection rendering real SagraCards from getWeekendSagre() with empty state fallback
- QuickFilters client component with 8 emoji chips that navigate to /cerca with pre-filled params
- ProvinceSection showing all 7 Veneto provinces with active sagra counts from getProvinceCounts()
- Homepage page.tsx converted to async server component with parallel data fetching
- NuqsAdapter installed and configured at root layout for search param management
- scrollbar-hide CSS utility for horizontal filter scroll

## Task Commits

1. **Task 1: Homepage section components** - `d9aad9f` (feat)
2. **Task 2: Wire homepage + NuqsAdapter + CSS** - `7e37cdf` (feat)

## Files Created/Modified
- `src/components/home/HeroSection.tsx` - Hero with gradient background, heading, search bar link
- `src/components/home/WeekendSection.tsx` - Weekend sagre grid with empty state
- `src/components/home/QuickFilters.tsx` - Emoji filter chips with /cerca navigation
- `src/components/home/ProvinceSection.tsx` - Province list with sagra counts
- `src/app/(main)/page.tsx` - Async homepage with data fetching
- `src/app/layout.tsx` - Added NuqsAdapter wrapper
- `src/app/globals.css` - Added scrollbar-hide utility
- `tsconfig.json` - Excluded supabase/functions from compilation

## Decisions Made
- NuqsAdapter at root layout level (setup for 04-03 search page)
- Homepage async server component with `Promise.all([getWeekendSagre(), getProvinceCounts()])`
- Only QuickFilters needs `'use client'` (router.push for navigation)
- Excluded `supabase/functions` from tsconfig to prevent Deno type errors blocking Next.js build

## Deviations from Plan
- Added `supabase/functions` to tsconfig exclude (not in plan, but necessary for build to succeed)

## Next Phase Readiness
- Homepage complete and building
- NuqsAdapter ready for search page (04-03)
- All section components available for reuse

## Self-Check: PASSED
- All 8 files verified on disk
- Both task commits verified in git log
- `npm run build` succeeds
- Homepage renders as dynamic route (ƒ)

---
*Phase: 04-discovery-ui*
*Completed: 2026-03-05*
