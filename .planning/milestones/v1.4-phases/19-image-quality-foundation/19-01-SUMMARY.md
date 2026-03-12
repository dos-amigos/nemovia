---
phase: 19-image-quality-foundation
plan: 01
subsystem: api
tags: [unsplash, image-pipeline, edge-function, vitest, tdd]

# Dependency graph
requires:
  - phase: 18-data-pipeline-restoration
    provides: enrich-sagre Edge Function with geocoding and LLM passes
provides:
  - Unsplash utility library (getHeroImage, parseImageCredit, TAG_QUERIES)
  - SQL migration 012 for image_credit column
  - Pass 3 in enrich-sagre for Unsplash image assignment
  - Sagra interface with image_credit field
affects: [19-02 UI components, hero image display, image attribution]

# Tech tracking
tech-stack:
  added: [unsplash-api]
  patterns: [pipeline-pass-pattern, inline-copy-for-edge-functions, utm-attribution]

key-files:
  created:
    - src/lib/unsplash.ts
    - src/lib/unsplash/__tests__/unsplash.test.ts
    - supabase/migrations/012_unsplash_image_credit.sql
  modified:
    - supabase/functions/enrich-sagre/index.ts
    - src/types/database.ts

key-decisions:
  - "Hero images use UTM params on both image URL and photographer URL for Unsplash attribution compliance"
  - "TAG_QUERIES inline copy in Edge Function follows established pattern (Deno cannot import from src/)"
  - "Rate limit check at X-Ratelimit-Remaining < 5 preserves budget for next run"

patterns-established:
  - "Unsplash credit format: 'Name|profile_url' stored in image_credit column"
  - "Pipeline pass pattern: query eligible rows, process with rate limiting, update in-place"
  - "Download tracking fire-and-forget for Unsplash API compliance"

requirements-completed: [IMG-01]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 19 Plan 01: Unsplash Integration Foundation Summary

**Unsplash utility library with hero rotation and credit parsing, database schema for attribution, and pipeline Pass 3 for automatic image assignment**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T10:21:21Z
- **Completed:** 2026-03-11T10:24:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Unsplash utility library with 5 curated hero images, daily rotation, and credit parsing
- SQL migration 012 adds image_credit column for photographer attribution
- Pass 3 in enrich-sagre Edge Function assigns Unsplash images to sagre missing images
- Full rate limit protection: 30 images/run cap, 2s delay, X-Ratelimit-Remaining check
- 18 unit tests covering all utility functions (TDD RED-GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Unsplash utility library (TDD RED)** - `9e91267` (test)
2. **Task 1: Unsplash utility library (TDD GREEN)** - `0627b14` (feat)
3. **Task 2: Add Unsplash Pass 3 to enrich-sagre** - `c91ab04` (feat)

_Note: Task 1 used TDD pattern with separate test and implementation commits_

## Files Created/Modified
- `src/lib/unsplash.ts` - Hero image rotation, credit parser, tag-to-query mapping
- `src/lib/unsplash/__tests__/unsplash.test.ts` - 18 unit tests for all utility functions
- `supabase/migrations/012_unsplash_image_credit.sql` - Adds image_credit column to sagre table
- `supabase/functions/enrich-sagre/index.ts` - Pass 3: runUnsplashPass for image assignment
- `src/types/database.ts` - Added image_credit field to Sagra interface

## Decisions Made
- Hero images use UTM params on both image URL and photographer URL for full Unsplash attribution compliance
- TAG_QUERIES duplicated as inline copy in Edge Function (Deno cannot import from Next.js src/ -- established project pattern)
- Rate limit threshold set at X-Ratelimit-Remaining < 5 to preserve API budget across multiple runs
- Download tracking uses fire-and-forget pattern (.catch(() => {})) to avoid blocking the pipeline on tracking failures
- Credit stored as "Name|profile_url" pipe-delimited format for simple parsing without JSON overhead

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration:**
- Register at unsplash.com/developers, create new application, copy Access Key
- Add `UNSPLASH_ACCESS_KEY` to `.env` locally
- Add `UNSPLASH_ACCESS_KEY` to Supabase Edge Function secrets (Dashboard -> Edge Functions -> enrich-sagre -> Manage Secrets)
- Run SQL migration 012 in Supabase SQL Editor
- Deploy updated enrich-sagre Edge Function via Supabase Dashboard

## Next Phase Readiness
- Utility library exports (getHeroImage, parseImageCredit, TAG_QUERIES) ready for Plan 02 UI components
- image_credit column ready for attribution display in UI
- Pipeline will automatically assign Unsplash images once UNSPLASH_ACCESS_KEY is configured

## Self-Check: PASSED

All 6 files verified present. All 3 commits verified in git log. 18/18 unit tests pass. TypeScript compilation clean.

---
*Phase: 19-image-quality-foundation*
*Completed: 2026-03-11*
