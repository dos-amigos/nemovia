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
decisions:
  - "EdgeRuntime.waitUntil() used so HTTP 200 returns immediately while scraping continues in background"
  - "Inline type definitions (no imports from src/) — Deno Edge Functions cannot import from Next.js src/"
  - "1.5s politeness delay between pages to avoid being rate-limited by source sites"
  - "Slug collision handled by appending Date.now().toString(36) suffix"
  - "Auto-disable source after 3 consecutive failures (consecutive_failures >= 3 sets is_active=false)"
metrics:
  duration: 8min
  completed: 2026-03-04
---

# Phase 2 Plan 3: scrape-sagre Edge Function Summary

**One-liner:** Deno Edge Function with Cheerio HTML scraping, config-driven CSS selectors from scraper_sources, deduplication via find_duplicate_sagra() RPC, insert/merge/skip upsert logic, scrape_logs audit trail, and auto-disable after 3 consecutive failures.

## What Was Built

The executable core of the scraping pipeline — reads active source configs from DB, scrapes each site's HTML, deduplicates, upserts to sagre, and logs every run.

### Files Created

**`supabase/functions/scrape-sagre/deno.json`**
```json
{"imports": {}}
```
Empty imports — all dependencies use `npm:` specifiers inline. No lock file needed.

**`supabase/functions/scrape-sagre/index.ts`** — 5 sections:

1. **Imports + inline types** — `npm:cheerio@1`, `npm:@supabase/supabase-js@2`, ScraperSource, NormalizedEvent, DuplicateResult interfaces
2. **Helper functions** — Exact copies of normalize.ts and date-parser.ts (Deno cannot import from src/)
3. **fetchWithTimeout()** — 10s abort controller, Italian User-Agent headers
4. **Scraping logic** — buildPageUrl, extractRawEvent, normalizeRawEvent, upsertEvent (insert/merge/skipped), logRun, scrapeSource (paginated loop with 1.5s delay)
5. **Entry point** — Deno.serve with EdgeRuntime.waitUntil() for fire-and-forget

### Key Behaviors

- **insert**: New sagra not in DB → INSERT with sources=['sourcename']
- **merge**: Same sagra already in DB from another source → UPDATE sources array, enrich empty fields
- **skipped**: Same sagra already tracked by this source → no-op
- **error**: Exception during scraping → log with status='error', increment consecutive_failures; after 3 failures, set source is_active=false

## Deployment

Requires manual deployment to Supabase Dashboard:
1. Edge Functions -> Create new function named `scrape-sagre`
2. Paste contents of `supabase/functions/scrape-sagre/index.ts`
3. Deploy
4. Invoke with empty JSON body `{}` to test

## Deviations from Plan

None - implementation matches plan specification exactly.

## Self-Check: PASSED

- supabase/functions/scrape-sagre/index.ts: FOUND
- supabase/functions/scrape-sagre/deno.json: FOUND
- Contains EdgeRuntime.waitUntil, find_duplicate_sagra, scrape_logs, cheerio, normalizeText, parseItalianDateRange: 11 matches CONFIRMED
- Commit 043a4c7: FOUND
