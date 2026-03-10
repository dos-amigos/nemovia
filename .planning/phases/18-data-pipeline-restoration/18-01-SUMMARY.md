---
phase: 18-data-pipeline-restoration
plan: 01
subsystem: database, scraper
tags: [filters, heuristics, whitelist, sql-migration, edge-function, vitest]

requires:
  - phase: v1.3 (migration 008)
    provides: "Retroactive keyword cleanup that over-filtered sagre"
provides:
  - "isNonSagraTitle() whitelist-aware heuristic filter (canonical + inline copy)"
  - "SQL migration 009 to re-activate false positives and apply smart non-sagra cleanup"
  - "Edge Function filter chain: isNonSagraTitle integrated after isNoiseTitle"
affects: [18-02, 18-03, scrape-sagre, enrich-sagre]

tech-stack:
  added: []
  patterns:
    - "Whitelist-first filtering: check safe keywords before rejecting by non-sagra patterns"
    - "Dedup guard in SQL re-activation: NOT EXISTS subquery prevents duplicate re-activation"

key-files:
  created:
    - supabase/migrations/009_filter_recalibration.sql
  modified:
    - src/lib/scraper/filters.ts
    - src/lib/scraper/__tests__/filters.test.ts
    - supabase/functions/scrape-sagre/index.ts

key-decisions:
  - "Whitelist-first approach: sagra/festa/food keywords checked before non-sagra rejection patterns"
  - "Dedup guard in re-activation SQL: NOT EXISTS prevents re-activating events that already have active duplicates"
  - "Inline copy pattern maintained: Deno Edge Functions cannot import from src/"

patterns-established:
  - "Whitelist-aware filtering: always check safe keywords before applying rejection patterns"
  - "SQL mirrors TypeScript: migration 009 Section 3 mirrors isNonSagraTitle() logic in PostgreSQL regex"

requirements-completed: [DATA-01, DATA-03]

duration: 3min
completed: 2026-03-10
---

# Phase 18 Plan 01: Filter Recalibration Summary

**Whitelist-aware isNonSagraTitle() filter with TDD, SQL migration 009 to re-activate false positives from 008, and Edge Function integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T17:07:27Z
- **Completed:** 2026-03-10T17:10:54Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented isNonSagraTitle() with whitelist-first approach: sagra/festa/food keywords never rejected, even alongside non-sagra terms like "fiera" or "concerto"
- Created SQL migration 009 with re-activation of false positives (dedup-guarded) and retroactive smart non-sagra cleanup
- Integrated isNonSagraTitle() inline copy into scrape-sagre Edge Function filter chain between isNoiseTitle() and normalizeRawEvent()
- 16 new test cases covering rejection patterns, whitelist protection, and edge cases (87 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement isNonSagraTitle() with TDD**
   - `1aa8e28` (test) - RED: failing tests for isNonSagraTitle
   - `ae7c6b1` (feat) - GREEN: implementation passing all 87 tests
2. **Task 2: SQL migration and Edge Function integration** - `2c83fab` (feat)

**Plan metadata:** (pending final commit)

_Note: Task 1 used TDD with RED/GREEN commits_

## Files Created/Modified
- `src/lib/scraper/filters.ts` - Added isNonSagraTitle() canonical implementation with whitelist-first logic
- `src/lib/scraper/__tests__/filters.test.ts` - 16 new test cases for isNonSagraTitle (rejection + whitelist + edge cases)
- `supabase/migrations/009_filter_recalibration.sql` - Re-activate false positives from 008, retroactive smart non-sagra cleanup
- `supabase/functions/scrape-sagre/index.ts` - Inline copy of isNonSagraTitle() + filter chain integration

## Decisions Made
- **Whitelist-first approach:** Check sagra/festa/food keywords before non-sagra rejection patterns, ensuring legitimate sagre like "Sagra e Fiera del Radicchio" are never filtered out
- **Dedup guard in SQL:** NOT EXISTS subquery in re-activation prevents creating duplicate active events from re-activation
- **Inline copy maintained:** Followed established Deno Edge Function pattern -- canonical in filters.ts, verbatim copy in scrape-sagre/index.ts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**SQL migration 009 requires manual execution** in Supabase SQL Editor (established project pattern). Run sections in order:
1. Section 1 (optional dry run) to count false positives
2. Section 2 to re-activate false positives
3. Section 3 for retroactive smart non-sagra cleanup
4. Section 4 (optional verification queries)

**Edge Function deployment** requires manual deploy via Supabase Dashboard (established pattern).

## Next Phase Readiness
- isNonSagraTitle() ready for use in all future scrape pipeline runs
- Migration 009 ready for manual execution to restore healthy event counts
- Plans 18-02 and 18-03 can proceed (province normalization, Veneto gating)

---
*Phase: 18-data-pipeline-restoration*
*Completed: 2026-03-10*

## Self-Check: PASSED

All 5 files verified present. All 3 commits verified in git log.
