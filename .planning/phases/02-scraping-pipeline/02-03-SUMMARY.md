---
phase: 02-scraping-pipeline
plan: 03
subsystem: edge-function
tags: [deno, cheerio, supabase-edge-functions, scraping, deduplication]
dependency_graph:
  requires: [02-01-scraper-types, 02-02-database-migration]
  provides: [scrape-sagre-edge-function]
  affects: [02-04-verification]
tech_stack:
  added: [cheerio@1 (npm: in Deno), @supabase/supabase-js@2 (npm: in Deno)]
  patterns: [EdgeRuntime.waitUntil, fire-and-forget, config-driven-scraping, politeness-delay]
key_files:
  created:
    - supabase/functions/scrape-sagre/index.ts
    - supabase/functions/scrape-sagre/deno.json
  modified: []
key-decisions:
  - "EdgeRuntime.waitUntil() used so HTTP 200 returns immediately while scraping continues in background"
  - "Inline type definitions (no imports from src/) -- Deno Edge Functions cannot import from Next.js src/"
  - "1.5s politeness delay between pages to avoid being rate-limited by source sites"
  - "Slug collision handled by appending Date.now().toString(36) suffix"
  - "Auto-disable source after 3 consecutive failures (consecutive_failures >= 3 sets is_active=false)"
requirements-completed: [PIPE-01, PIPE-02, PIPE-04]
metrics:
  duration: 8min
  completed: 2026-03-04
---

# Phase 2 Plan 3: scrape-sagre Edge Function Summary

**Deno Edge Function with Cheerio HTML scraping, config-driven CSS selectors from scraper_sources, deduplication via find_duplicate_sagra() RPC, insert/merge/skip upsert logic, scrape_logs audit trail, and auto-disable after 3 consecutive failures — deployed to Supabase and verified returning HTTP 200.**

## Performance

- **Duration:** ~8 min (automated) + human verification
- **Started:** 2026-03-04
- **Completed:** 2026-03-04
- **Tasks:** 2 (1 automated, 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Built the executable core of the scraping pipeline as a Supabase Edge Function
- Implemented full orchestration: fetch sources from DB, scrape each site's paginated HTML, deduplicate, upsert, log each run
- Human verified: function deployed to Supabase Dashboard and returns HTTP 200 on invocation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deno.json and Edge Function scaffold with inline helpers** - `043a4c7` (feat)
2. **Task 2: Deploy and test scrape-sagre Edge Function** - human-verified (no code commit; deployment via Supabase Dashboard)

## Files Created/Modified

- `supabase/functions/scrape-sagre/index.ts` - Full Edge Function orchestrator: imports, type definitions, helper functions, HTTP fetch, scraping logic, dedup/upsert, logging, and Deno.serve entry point
- `supabase/functions/scrape-sagre/deno.json` - Deno config with empty imports (all dependencies use npm: specifiers inline)

## Decisions Made

- **EdgeRuntime.waitUntil()**: HTTP 200 returns immediately; all scraping work runs in background. Required because pg_cron HTTP call has 5s timeout (connection only) but actual function needs up to 150s
- **Inline types**: Deno Edge Functions cannot import from Next.js `src/` directory — all type definitions and helper implementations are inlined verbatim
- **1.5s politeness delay**: Between page fetches per source to avoid rate-limiting
- **Slug collision fallback**: When `23505` unique violation occurs, appends `Date.now().toString(36)` suffix
- **Auto-disable after 3 failures**: `consecutive_failures >= 3` sets `is_active=false` on the scraper_sources row so broken sources stop being attempted

## Deviations from Plan

None - implementation matches plan specification exactly.

## User Setup Required

**Manual deployment to Supabase Dashboard required (no Supabase CLI):**
1. Edge Functions -> Create new function named `scrape-sagre`
2. Paste contents of `supabase/functions/scrape-sagre/index.ts`
3. Deploy
4. Invoke with empty JSON body `{}` to test — expect HTTP 200 within 1-2 seconds

**Verified by user:** Function deployed successfully and returns HTTP 200 (confirmed 2026-03-04).

## Next Phase Readiness

- Edge Function deployed and verified working in Supabase
- scrape_logs will capture run results after each invocation
- sagre table will be populated by scraper; ready for Phase 3 data enrichment (geocoding + LLM tagging)
- CSS selectors in scraper_sources may need adjustment if target site HTML structure has changed

---
*Phase: 02-scraping-pipeline*
*Completed: 2026-03-04*

## Self-Check: PASSED

- supabase/functions/scrape-sagre/index.ts: FOUND
- supabase/functions/scrape-sagre/deno.json: FOUND
- Contains EdgeRuntime.waitUntil, find_duplicate_sagra, scrape_logs, cheerio, normalizeText, parseItalianDateRange: 11 matches CONFIRMED
- Commit 043a4c7: FOUND
- Human verification: CONFIRMED (user: "function deployed, ok tutto corretto")
