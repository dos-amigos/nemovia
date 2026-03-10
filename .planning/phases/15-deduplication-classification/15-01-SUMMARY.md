---
phase: 15-deduplication-classification
plan: 01
subsystem: scraper, ui
tags: [image-upgrade, wordpress, placeholder, scrape-pipeline, css-custom-properties]

# Dependency graph
requires:
  - phase: 14-data-quality-filters
    provides: filters.ts module structure, scrape-sagre Edge Function pipeline
provides:
  - tryUpgradeImageUrl pure function for image URL resolution upgrade
  - Branded placeholder component pattern using CSS custom properties
  - Inline copy of tryUpgradeImageUrl in scrape-sagre Edge Function
affects: [16-ui-redesign, scrape-sagre]

# Tech tracking
tech-stack:
  added: []
  patterns: [image-url-upgrade-by-source, branded-placeholder-with-css-vars]

key-files:
  created: []
  modified:
    - src/lib/scraper/filters.ts
    - src/lib/scraper/__tests__/filters.test.ts
    - supabase/functions/scrape-sagre/index.ts
    - src/components/sagra/SagraCard.tsx
    - src/components/detail/SagraDetail.tsx

key-decisions:
  - "Source-specific image upgrade via switch statement for extensibility"
  - "CSS custom properties (from-primary/via-accent) for palette-agnostic placeholders"

patterns-established:
  - "Image URL upgrade: source-aware transformation in tryUpgradeImageUrl"
  - "Branded placeholder: primary/accent gradient + icon + label for missing images"

requirements-completed: [DQ-09, DQ-10]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 15 Plan 01: Image Upgrade & Branded Placeholder Summary

**tryUpgradeImageUrl strips WordPress thumbnails (sagritaly) and size params (solosagre), branded placeholder replaces amber/green gradient with CSS-var-driven primary/accent pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T08:47:00Z
- **Completed:** 2026-03-10T08:50:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- tryUpgradeImageUrl pure function with 8 passing tests covering all source types and edge cases
- Scrape pipeline now upgrades image URLs at ingestion time via inline copy in Edge Function
- Branded placeholder with utensils icon and "Sagra" label using CSS custom properties for future palette changes

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD tryUpgradeImageUrl pure function**
   - `2cbbb3d` (test) - RED: failing tests for tryUpgradeImageUrl
   - `29dbb27` (feat) - GREEN: implement tryUpgradeImageUrl in filters.ts
   - `101eb70` (feat) - Integrate inline copy into scrape-sagre Edge Function
2. **Task 2: Replace placeholder gradients with branded component** - `0b03bfd` (feat)

## Files Created/Modified
- `src/lib/scraper/filters.ts` - Added tryUpgradeImageUrl export (source-aware image URL upgrade)
- `src/lib/scraper/__tests__/filters.test.ts` - 8 new tests for tryUpgradeImageUrl (total: 71 in file)
- `supabase/functions/scrape-sagre/index.ts` - Inline copy of tryUpgradeImageUrl + normalizeRawEvent integration
- `src/components/sagra/SagraCard.tsx` - Branded placeholder with primary/accent gradient and "Sagra" label
- `src/components/detail/SagraDetail.tsx` - Same branded placeholder pattern with larger icon for detail view

## Decisions Made
- Used source-name switch statement in tryUpgradeImageUrl for easy extensibility when adding new sources
- CSS custom properties (from-primary/via-accent/to-primary) for placeholder gradient so Phase 16 palette changes automatically apply
- Renamed `_sourceName` to `sourceName` in normalizeRawEvent since it is now used

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Image upgrade logic ready for production (will take effect on next scrape run)
- Placeholder UI ready for Phase 16 palette redesign (uses CSS vars, not hardcoded colors)
- Plan 15-02 (deduplication & classification) can proceed independently

## Self-Check: PASSED

All 6 files verified present. All 4 commits verified in git log.

---
*Phase: 15-deduplication-classification*
*Completed: 2026-03-10*
