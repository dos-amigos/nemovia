---
phase: 07-deploy-verify-baseline
plan: 01
subsystem: infra
tags: [supabase, edge-functions, postgis, geocoding, deploy, pipeline]

# Dependency graph
requires:
  - phase: 06-seo-polish
    provides: "Complete v1.0 MVP with all frontend and backend components"
provides:
  - "enrich-sagre Edge Function deployed to production with WKT geocoding fix"
  - "Verified end-to-end pipeline: scrape -> geocode -> LLM enrich -> live map"
  - "Baseline confirmation that eventiesagre source produces valid enriched sagre"
affects: [08-fix-cheerio-scrapers, 09-sagritaly-ingestion, 10-data-quality-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WKT format for PostGIS location updates: SRID=4326;POINT(lon lat)"
    - "Edge Function deploy via supabase functions deploy"
    - "Pipeline verification via Supabase REST API queries"

key-files:
  created: []
  modified:
    - "supabase/functions/enrich-sagre/index.ts (deployed, not modified in this plan)"

key-decisions:
  - "Verified pipeline via REST API queries rather than direct database access"
  - "Used manual function invocation (curl) to trigger pipeline instead of waiting for cron"

patterns-established:
  - "Pipeline verification pattern: check scrape_logs, enrich_logs, sagre table, find_nearby_sagre RPC"
  - "Deploy verification: deploy Edge Function, trigger manually, verify data, check live site"

requirements-completed: [DEPLOY-01, SCRAPE-01]

# Metrics
duration: ~15min
completed: 2026-03-06
---

# Phase 7 Plan 1: Deploy & Verify Baseline Summary

**Deployed enrich-sagre Edge Function with PostGIS WKT geocoding fix and verified end-to-end pipeline producing enriched sagre with valid coordinates on the live map**

## Performance

- **Duration:** ~15 min (across checkpoint pause)
- **Started:** 2026-03-06T12:45:00Z (approx)
- **Completed:** 2026-03-06T13:05:00Z
- **Tasks:** 3
- **Files modified:** 0 (deploy + verification only)

## Accomplishments
- Deployed enrich-sagre Edge Function to Supabase production with the PostGIS WKT geocoding fix (SRID=4326;POINT format)
- Triggered scrape-sagre and enrich-sagre pipeline manually, confirming both functions respond with HTTP 200
- Verified via REST API: scrape_logs show successful eventiesagre runs, enrich_logs show geocoded_count > 0, sagre table has enriched rows with valid coordinates, food_tags, and descriptions
- Confirmed find_nearby_sagre RPC returns geolocated sagre in the Veneto region
- User verified live site at nemovia.vercel.app: sagre markers appear on map with valid coordinates, tags, and descriptions

## Task Commits

Each task was committed atomically:

1. **Task 1: Deploy enrich-sagre Edge Function and trigger pipeline** - `ab2086c` (chore)
2. **Task 2: Verify pipeline data via Supabase REST API** - `08cc1c0` (chore)
3. **Task 3: Verify sagre on live map** - Checkpoint approved by user (no commit, visual verification only)

Note: Commit `47690cc` was a user-applied fix (back button + image placeholder) done separately during checkpoint review.

## Files Created/Modified
- No files were created or modified in this plan. All work was deploy + verification via CLI and HTTP.

## Decisions Made
- Verified pipeline via REST API queries against scrape_logs, enrich_logs, and sagre tables rather than direct database access
- Used manual curl invocation to trigger both Edge Functions rather than waiting for next cron cycle
- Accepted existing eventiesagre data as baseline validation (the only active scraper source)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - deploy and verification completed without issues.

## User Setup Required
None - Supabase CLI was already authenticated and linked.

## Next Phase Readiness
- Baseline pipeline verified: scraping, geocoding, LLM enrichment, and live map display all working
- Ready for Phase 8 (Fix Cheerio Scrapers) - can now fix assosagre, solosagre, venetoinfesta CSS selectors knowing the enrichment pipeline processes data correctly
- Ready for Phase 9 (Sagritaly Ingestion) - can run in parallel with Phase 8

## Self-Check: PASSED

- FOUND: .planning/phases/07-deploy-verify-baseline/07-01-SUMMARY.md
- FOUND: ab2086c (Task 1 commit)
- FOUND: 08cc1c0 (Task 2 commit)
- Task 3: Checkpoint approved (no commit expected)

---
*Phase: 07-deploy-verify-baseline*
*Completed: 2026-03-06*
