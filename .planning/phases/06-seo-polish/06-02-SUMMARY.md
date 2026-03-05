---
phase: 06-seo-polish
plan: 02
subsystem: ui
tags: [skeleton, loading, empty-state, next.js, suspense, lucide-react]

# Dependency graph
requires:
  - phase: 04-discovery-ui
    provides: SagraCardSkeleton, Skeleton component, WeekendSection, ProvinceSection, SearchResults
  - phase: 05-map-detail
    provides: Map page, detail page route structure
provides:
  - Route-level loading skeletons for all 4 routes (homepage, search, map, detail)
  - Reusable EmptyState component with icon/title/description
  - Enhanced empty states in WeekendSection, ProvinceSection, SearchResults
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js loading.tsx for route-level Suspense boundaries"
    - "Reusable EmptyState component for consistent no-data UI"

key-files:
  created:
    - src/app/(main)/loading.tsx
    - src/app/(main)/cerca/loading.tsx
    - src/app/(main)/mappa/loading.tsx
    - src/app/(main)/sagra/[slug]/loading.tsx
    - src/components/ui/EmptyState.tsx
  modified:
    - src/components/home/WeekendSection.tsx
    - src/components/home/ProvinceSection.tsx
    - src/components/search/SearchResults.tsx

key-decisions:
  - "EmptyState uses UtensilsCrossed as default icon (food-themed fallback)"
  - "ProvinceSection checks counts.length for empty state (not VENETO_PROVINCES.length)"

patterns-established:
  - "EmptyState pattern: centered icon in muted circle + title + description for all no-data states"

requirements-completed: [SEO-05, SEO-06]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 06 Plan 02: Loading Skeletons & Empty States Summary

**Route-level loading skeletons for all 4 routes plus reusable EmptyState component with Italian copy in WeekendSection, ProvinceSection, and SearchResults**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T14:44:00Z
- **Completed:** 2026-03-05T14:47:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- All 4 route directories have loading.tsx files that mirror their page layout structure using Skeleton and SagraCardSkeleton components
- Reusable EmptyState component created with icon, title, description props and food-themed default icon
- WeekendSection, ProvinceSection, and SearchResults all use EmptyState with route-appropriate Lucide icons and Italian messages

## Task Commits

Each task was committed atomically:

1. **Task 1: Route-level loading skeletons for all 4 routes** - `169a3da` (feat)
2. **Task 2: EmptyState component + enhance empty states in sections** - `e7911e7` (feat)

## Files Created/Modified
- `src/app/(main)/loading.tsx` - Homepage loading skeleton (hero, filters, weekend, provinces)
- `src/app/(main)/cerca/loading.tsx` - Search page loading skeleton (title, filters, badges, toggle, results)
- `src/app/(main)/mappa/loading.tsx` - Map page loading skeleton (full-height placeholder)
- `src/app/(main)/sagra/[slug]/loading.tsx` - Detail page loading skeleton (image, text, tags, map, actions)
- `src/components/ui/EmptyState.tsx` - Reusable empty state with icon circle, title, description
- `src/components/home/WeekendSection.tsx` - Updated to use EmptyState with Calendar icon
- `src/components/home/ProvinceSection.tsx` - Added empty state check with MapPin icon
- `src/components/search/SearchResults.tsx` - Updated to use EmptyState with Search icon

## Decisions Made
- EmptyState uses UtensilsCrossed as default icon (food-themed fallback matching the sagre domain)
- ProvinceSection checks counts.length === 0 for empty state, since VENETO_PROVINCES is a static constant

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All routes now have loading skeletons for server-side data fetching
- Empty states provide user guidance when no data matches
- Ready for remaining SEO & polish tasks

## Self-Check: PASSED

- All 5 created files verified on disk
- Commits `169a3da` and `e7911e7` verified in git log
- Build passes with no errors

---
*Phase: 06-seo-polish*
*Completed: 2026-03-05*
