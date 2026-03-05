---
phase: 03-data-enrichment
plan: 02
subsystem: infra
tags: [supabase, edge-functions, deno, nominatim, gemini, pg_cron, postgis, geocoding, llm]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Pure function library (geocode.ts, llm.ts) — copied verbatim into Edge Function"
  - phase: 02-02
    provides: "pg_cron + vault secrets pattern, sagre table with status column queue"
provides:
  - "003_enrichment.sql: enrich_logs table DDL + pg_cron morning/evening schedules"
  - "enrich-sagre Edge Function: geocoding pass (Nominatim) + LLM enrichment pass (Gemini 2.5 Flash)"
  - "Status-column queue: pending_geocode → pending_llm/geocode_failed → enriched"
affects: [03-03, frontend-map, sagre-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EdgeRuntime.waitUntil fire-and-forget: return 200 immediately, work in background"
    - "Two-pass enrichment pipeline: geocoding (rate-limited) then LLM (batched)"
    - "Inline pure function copy pattern: geocode.ts and llm.ts copied verbatim into Deno (cannot import from Next.js src/)"
    - "Per-run caps: GEOCODE_LIMIT=30, LLM_LIMIT=200 — prevents timeout on 50s Edge Function limit"
    - "LON LAT order for PostGIS location column (critical — reversed from conventional lat/lon)"
    - "pg_cron vault secrets: project_url and anon_key from vault.decrypted_secrets (no hardcoded values)"

key-files:
  created:
    - supabase/migrations/003_enrichment.sql
    - supabase/functions/enrich-sagre/index.ts
    - supabase/functions/enrich-sagre/deno.json
  modified: []

key-decisions:
  - "GEOCODE_LIMIT=30 fits within 50s Edge Function timeout (30s geocoding + 15s LLM + 5s overhead)"
  - "LLM pass enriches both pending_llm AND geocode_failed rows — tags/description are independent of GPS coordinates"
  - "Nominatim rate limit: SLEEP_MS=1100 (1.1s) to safely satisfy 1 req/sec usage policy"
  - "validateTags() + slice() post-process every Gemini response — structured output is best-effort for enum compliance"
  - "enrich_logs insert at end of every pipeline run regardless of errors — full observability"

patterns-established:
  - "Status-column queue pattern: resumable pipeline picks up where it left off on next invocation"
  - "Geocode-failed sagre still get LLM enrichment — partial data is better than no data"

requirements-completed: [PIPE-03, PIPE-07, PIPE-08, PIPE-09]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 3 Plan 02: enrich-sagre Edge Function Summary

**Supabase Edge Function orchestrating Nominatim geocoding (1 req/sec, 30-row cap) and Gemini 2.5 Flash LLM tagging (BATCH_SIZE=8, 200-row cap) with pg_cron twice-daily scheduling and enrich_logs observability table**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T22:25:32Z
- **Completed:** 2026-03-04T22:29:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `003_enrichment.sql` with `enrich_logs` table DDL, RLS policy, and two pg_cron schedules (morning 06:30, evening 18:30) using vault.decrypted_secrets
- Built `enrich-sagre/index.ts`: full two-pass enrichment pipeline with geocoding pass (Nominatim, Italy bounds validation, LON LAT PostGIS order) and LLM pass (Gemini 2.5 Flash with JSON schema, tag validation, description truncation)
- All 41 existing tests still passing — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Database migration 003_enrichment.sql** - `8c68d6b` (feat)
2. **Task 2: enrich-sagre Edge Function** - `83220be` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/003_enrichment.sql` - enrich_logs table + enrich-sagre-morning and enrich-sagre-evening pg_cron schedules
- `supabase/functions/enrich-sagre/index.ts` - Orchestrator Edge Function: geocoding pass + LLM enrichment pass + run logging
- `supabase/functions/enrich-sagre/deno.json` - Deno import configuration (empty imports, npm: specifiers used inline)

## Decisions Made
- GEOCODE_LIMIT=30: safely fits within 50s Edge Function timeout (30 geocode calls at 1.1s each = 33s, then LLM = ~15s)
- LLM pass queries both `pending_llm` AND `geocode_failed`: food/feature tags and descriptions are independent of GPS data
- SLEEP_MS=1100: 1.1s between Nominatim requests (Nominatim policy = max 1 req/sec, 100ms headroom)
- `validateTags()` + `slice(0, 3)` / `slice(0, 2)` applied to every Gemini response — JSON schema constrains shape, not enum values
- enrich_logs inserted at end of `runEnrichmentPipeline()` whether or not errors occurred

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration before the function will run.**

To deploy the enrich-sagre function:

1. **Run migration in Supabase SQL Editor:**
   - Open `supabase/migrations/003_enrichment.sql`
   - Paste full contents into Supabase Dashboard → SQL Editor and run
   - Verify: `SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'enrich-%';` — expect 2 rows

2. **Add GEMINI_API_KEY as Edge Function secret:**
   - Supabase Dashboard → Edge Functions → enrich-sagre → Secrets
   - Add secret named `GEMINI_API_KEY` with your Google AI Studio API key

3. **Deploy enrich-sagre Edge Function:**
   - Supabase Dashboard → Edge Functions → Create new function named `enrich-sagre`
   - Paste contents of `supabase/functions/enrich-sagre/index.ts` into the editor and deploy

Vault secrets (`project_url`, `anon_key`) were set in Phase 2 and are already available.

## Next Phase Readiness
- Edge Function code is complete and ready for deployment verification (Plan 03-03)
- Migration SQL ready for manual SQL Editor execution
- Status-column queue design means function is fully resumable — partial runs pick up on next invocation
- Concern: GEMINI_API_KEY must be added as secret before first invocation

## Self-Check: PASSED

- supabase/migrations/003_enrichment.sql: FOUND
- supabase/functions/enrich-sagre/index.ts: FOUND
- supabase/functions/enrich-sagre/deno.json: FOUND
- .planning/phases/03-data-enrichment/03-02-SUMMARY.md: FOUND
- Commit 8c68d6b (Task 1): FOUND
- Commit 83220be (Task 2): FOUND
- pnpm test: 41/41 passing

---
*Phase: 03-data-enrichment*
*Completed: 2026-03-04*
