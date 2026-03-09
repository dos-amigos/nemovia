---
phase: 14-data-quality-heuristic-filters
plan: 01
subsystem: scraper
tags: [vitest, tdd, regex, date-validation, heuristic-filter, pure-functions]

# Dependency graph
requires:
  - phase: 10-data-quality-filters
    provides: "Original isNoiseTitle pattern and scraper pipeline architecture"
provides:
  - "4 pure predicate filter functions: isNoiseTitle, isCalendarDateRange, isExcessiveDuration, isPastYearEvent"
  - "Comprehensive test suite (63 tests) covering all filter behaviors"
affects: [14-02-PLAN pipeline integration, scrape-sagre Edge Function inline copy]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Pure predicate filter functions returning true=reject", "UTC date methods for timezone-safe date comparison"]

key-files:
  created:
    - src/lib/scraper/filters.ts
    - src/lib/scraper/__tests__/filters.test.ts
  modified: []

key-decisions:
  - "Used getUTCDate() instead of getDate() in isCalendarDateRange to avoid timezone-related off-by-one errors"
  - "isNoiseTitle uses multi-word pattern matching (calendario + eventi/sagre/feste) to avoid false positives on legitimate titles containing 'calendario'"
  - "isPastYearEvent uses dynamic new Date().getFullYear() instead of hardcoded 2026 for automatic year boundary handling"

patterns-established:
  - "Filter-as-predicate: each filter returns true when event should be REJECTED, false to keep"
  - "Null-safe date filters: all date filters return false (keep event) when dates are null"

requirements-completed: [DQ-01, DQ-02, DQ-03, DQ-04]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 14 Plan 01: Heuristic Filter Functions Summary

**TDD-built pure predicate filters for noise titles (10+ regex patterns), calendar date ranges (day 1 to 28+), excessive duration (>7 days), and past-year events using dynamic year comparison**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T14:01:53Z
- **Completed:** 2026-03-09T14:04:14Z
- **Tasks:** 1 (TDD: RED-GREEN-REFACTOR)
- **Files modified:** 2

## Accomplishments
- 4 pure predicate filter functions with full JSDoc documentation
- 63 tests covering all behaviors: spam rejection, legitimate acceptance, null handling, edge cases
- isNoiseTitle expanded from 6 to 10+ regex patterns catching calendar spam, program/schedule noise, CTAs, and newsletter signups
- Zero false positives: "Sagra della Polenta - Calendario 2026" correctly kept despite containing "calendario"
- Full test suite (123 tests) passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `b2c5392` (test)
2. **Task 1 GREEN: Filter implementation** - `2accff7` (feat)

_TDD task: RED commit has failing tests, GREEN commit makes them pass. No refactor commit needed (code already clean)._

## Files Created/Modified
- `src/lib/scraper/filters.ts` - 4 exported pure predicate filter functions (isNoiseTitle, isCalendarDateRange, isExcessiveDuration, isPastYearEvent)
- `src/lib/scraper/__tests__/filters.test.ts` - 63 comprehensive tests covering all filter behaviors

## Decisions Made
- Used `getUTCDate()` instead of `getDate()` in `isCalendarDateRange` to prevent timezone-related off-by-one errors when comparing day-of-month values
- Multi-word matching for "calendario" pattern: requires both "calendario" AND "eventi/sagre/feste" to trigger rejection, preventing false positives on legitimate titles
- Dynamic `new Date().getFullYear()` in `isPastYearEvent` instead of hardcoded 2026, so the filter automatically works across year boundaries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 filter functions are ready for pipeline integration (Plan 14-02)
- Functions must be copied inline to `supabase/functions/scrape-sagre/index.ts` (Edge Function) in Plan 14-02
- SQL retroactive cleanup migration can reference the same logic patterns

## Self-Check: PASSED

- [x] `src/lib/scraper/filters.ts` exists
- [x] `src/lib/scraper/__tests__/filters.test.ts` exists
- [x] Commit `b2c5392` (RED) found in git log
- [x] Commit `2accff7` (GREEN) found in git log
- [x] All 63 filter tests pass
- [x] Full suite (123 tests) passes with zero regressions

---
*Phase: 14-data-quality-heuristic-filters*
*Completed: 2026-03-09*
