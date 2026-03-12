---
phase: 23-scraping-completeness
plan: 01
subsystem: database, ui
tags: [sql-migration, typescript, detail-page, menu, orari, source-description]

# Dependency graph
requires:
  - phase: 19-unsplash-hero-images
    provides: image_credit column and parseImageCredit utility used in SagraDetail
provides:
  - SQL migration 013 with source_description, menu_text, orari_text columns
  - Updated Sagra TypeScript interface with three new nullable fields
  - Detail page Menu section with UtensilsCrossed icon
  - Detail page Orari section with Clock icon
  - Description priority chain: source_description > enhanced_description > description
affects: [23-02-scraper-detail-extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional detail sections: render only when field is truthy, hidden when null"
    - "Description priority chain: source > enhanced > original for progressive enrichment"

key-files:
  created:
    - supabase/migrations/013_scraping_completeness.sql
  modified:
    - src/types/database.ts
    - src/components/detail/SagraDetail.tsx

key-decisions:
  - "Inline Menu/Orari sections instead of separate components -- small sections, no reuse needed"
  - "Description priority: source_description > enhanced_description > description for progressive quality"
  - "whitespace-pre-line on menu/orari text to preserve source formatting"

patterns-established:
  - "Conditional detail sections: ScrollReveal-wrapped, icon-headed, truthy-gated"
  - "Progressive description priority chain for multi-source content"

requirements-completed: [SCRAPE-01]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 23 Plan 01: Data Model & Detail Page UI Summary

**SQL migration 013 with source_description/menu_text/orari_text columns, updated Sagra type, and conditional Menu/Orari sections on detail page**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T08:41:51Z
- **Completed:** 2026-03-12T08:43:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created migration 013 adding three new TEXT columns for scraped detail content
- Updated Sagra TypeScript interface with source_description, menu_text, orari_text fields
- Added conditional Menu section with UtensilsCrossed icon on detail page
- Added conditional Orari section with Clock icon on detail page
- Updated description priority chain to prefer source-scraped descriptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration and TypeScript type update** - `7b2383a` (feat)
2. **Task 2: Detail page UI for menu, orari, and source description** - `4e07e3a` (feat)

## Files Created/Modified
- `supabase/migrations/013_scraping_completeness.sql` - Three new nullable TEXT columns on sagre table
- `src/types/database.ts` - Sagra interface with source_description, menu_text, orari_text
- `src/components/detail/SagraDetail.tsx` - Menu/Orari conditional sections, Clock import, description priority chain

## Decisions Made
- Inline Menu/Orari sections instead of separate components -- small sections with no reuse needed, fewer files
- Description priority: source_description > enhanced_description > description for progressive quality enrichment
- whitespace-pre-line on menu/orari text to preserve multiline source formatting
- ScrollReveal delay staggering: menu 0.12, orari 0.14, description 0.16 to avoid animation stacking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**Database migration must be applied manually:**
- Run `supabase/migrations/013_scraping_completeness.sql` in Supabase SQL Editor
- This adds source_description, menu_text, orari_text columns to the sagre table
- Columns are nullable TEXT -- no impact on existing data

## Next Phase Readiness
- Data model ready for Plan 02 (scraper detail extraction) to populate the new columns
- Detail page will automatically display content as soon as columns are populated
- No code changes needed in Plan 02 for UI -- just scraper logic to fill the fields

## Self-Check: PASSED

All files verified present, all commits verified in git log.

---
*Phase: 23-scraping-completeness*
*Completed: 2026-03-12*
