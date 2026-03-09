---
phase: 14-data-quality-heuristic-filters
plan: 02
subsystem: scraper
tags: [edge-function, sql-migration, pg-cron, data-cleanup, pipeline-integration]

# Dependency graph
requires:
  - phase: 14-01
    provides: "4 pure predicate filter functions (isNoiseTitle, isCalendarDateRange, isExcessiveDuration, isPastYearEvent)"
provides:
  - "Production scrape pipeline rejects calendar spam, excessive duration, and past-year events before upsert"
  - "SQL migration deactivating all existing dirty data in production"
  - "Enhanced expire cron handling null end_date and year boundaries"
affects: [nemovia.vercel.app production data quality, Phase 15 deduplication starts with clean baseline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Inline copy of filter functions in Edge Function (Deno import constraint)", "Retroactive SQL cleanup following 005_data_quality.sql pattern", "pg_cron unschedule-before-reschedule pattern"]

key-files:
  created:
    - supabase/migrations/006_heuristic_filters.sql
  modified:
    - supabase/functions/scrape-sagre/index.ts

key-decisions:
  - "Filters run on normalized event (after date parsing produces ISO dates) for correct date validation"
  - "SQL migration uses PostgreSQL \\y word boundary (not \\b) for POSIX regex compatibility"
  - "Expire cron unschedule-before-reschedule to avoid pg_cron duplicate job issue (Pitfall 6)"

patterns-established:
  - "Retroactive cleanup SQL pattern: UPDATE SET is_active=false WHERE violating condition, with verification queries as comments"
  - "Edge Function filter integration point: between normalizeRawEvent() and upsertEvent()"

requirements-completed: [DQ-01, DQ-02, DQ-03, DQ-04, DQ-05]

# Metrics
duration: ~5min
completed: 2026-03-09
---

# Phase 14 Plan 02: Pipeline Integration & Production Cleanup Summary

**Inline filter copies integrated into scrape-sagre Edge Function, SQL migration deactivating all dirty production data (calendar spam, >7-day events, 2025 events), and enhanced expire cron with null end_date and year boundary handling**

## Performance

- **Duration:** ~5 min (including checkpoint verification)
- **Started:** 2026-03-09T14:05:00Z
- **Completed:** 2026-03-09T14:10:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments
- Integrated all 4 heuristic filter functions (inline copies) into scrape-sagre Edge Function, running between normalization and upsert
- Created 5-section SQL migration: calendar-spam cleanup, excessive-duration cleanup, past-year cleanup, noise title cleanup (new patterns), and enhanced expire cron
- Enhanced expire cron to handle null end_date (start_date fallback) and year boundary events
- Production data cleaned and verified -- app shows only real, current sagre with valid dates
- Edge Function deployed with new filters actively rejecting dirty data on every scrape

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate filters into Edge Function** - `99128b0` (feat)
2. **Task 2: Create SQL migration for retroactive cleanup and expire cron fix** - `003f240` (feat)
3. **Task 3: Deploy and verify production data cleanup** - checkpoint:human-verify (approved)

**Plan metadata:** `19ae081` (docs: complete plan)

## Files Created/Modified
- `supabase/functions/scrape-sagre/index.ts` - Added inline copies of isCalendarDateRange, isExcessiveDuration, isPastYearEvent; expanded isNoiseTitle; wired all filters into scraping loop between normalization and upsert
- `supabase/migrations/006_heuristic_filters.sql` - 5-section migration: retroactive cleanup (4 filter types) + enhanced expire cron with null end_date and year boundary support

## Decisions Made
- Filter checks run on normalized event data (after date parsing) rather than raw scraped data, ensuring ISO date strings are available for date validation
- Used PostgreSQL `\y` word boundary in regex patterns instead of `\b` (which is backspace in POSIX regex)
- Applied unschedule-before-reschedule pattern for pg_cron job update (no UPDATE semantics available)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 complete: all 5 DQ requirements (DQ-01 through DQ-05) satisfied
- Production data is clean baseline for Phase 15 (Deduplication & Classification)
- Phase 15 can build on clean data without worrying about calendar spam or expired events contaminating dedup analysis

## Self-Check: PASSED

- [x] `supabase/functions/scrape-sagre/index.ts` exists
- [x] `supabase/migrations/006_heuristic_filters.sql` exists
- [x] Commit `99128b0` (Task 1) found in git log
- [x] Commit `003f240` (Task 2) found in git log

---
*Phase: 14-data-quality-heuristic-filters*
*Completed: 2026-03-09*
