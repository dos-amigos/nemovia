---
phase: 02-scraping-pipeline
plan: "02"
subsystem: database
tags: [postgresql, supabase, pg-cron, pg-net, rls, triggers, migrations]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: sagre table schema, Supabase project setup, migration file execution pattern
provides:
  - scraper_sources config table with 5 Veneto source seed rows
  - scrape_logs audit table for scraping run tracking
  - normalize_text() IMMUTABLE PostgreSQL function for dedup indexing
  - find_duplicate_sagra() RPC for title+city+date overlap dedup
  - sagre table extensions: sources TEXT[], is_active BOOLEAN, normalized_title TEXT
  - pg_cron schedules: expire-sagre-daily, scrape-sagre-morning, scrape-sagre-evening
affects:
  - 02-03-scrape-sagre-edge-function (reads scraper_sources, writes sagre, uses find_duplicate_sagra)
  - 02-04-normalize-typescript (normalizeText() must match normalize_text() SQL output)
  - 03-geocoding-enrichment (reads sagre rows with missing geocoding)

# Tech tracking
tech-stack:
  added: [unaccent (PostgreSQL extension), pg_cron cron.schedule(), net.http_post(), vault.decrypted_secrets]
  patterns:
    - Manual SQL migration file (same pattern as 001_foundation.sql) — no Supabase CLI dependency
    - IMMUTABLE SQL function wrapping unaccent for functional index compatibility
    - Vault-based secret storage for pg_cron HTTP calls (no hardcoded credentials in cron body)
    - ON CONFLICT (name) DO NOTHING seed pattern for idempotent source seeding

key-files:
  created:
    - supabase/migrations/002_scraping_pipeline.sql
  modified: []

key-decisions:
  - "normalize_text() uses extensions.unaccent() (fully qualified) to satisfy IMMUTABLE declaration on Supabase"
  - "pg_cron scraper jobs use vault.decrypted_secrets for project_url and anon_key — no hardcoded secrets in cron body"
  - "find_duplicate_sagra() falls back to name+city match when either side has no dates (handles undated sagre)"
  - "scrape_logs source_id is nullable FK (allows logging when source row not yet found)"
  - "expire-sagre-daily is pure SQL in pg_cron body (no Edge Function needed for simple date comparison)"

patterns-established:
  - "SQL migration with section comments (Section 1..N) for readability in SQL Editor"
  - "ADD COLUMN IF NOT EXISTS pattern for idempotent column additions to existing tables"
  - "DROP TRIGGER IF EXISTS before CREATE TRIGGER for safe re-runs"

requirements-completed: [PIPE-02, PIPE-04, PIPE-05, PIPE-06]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 2 Plan 02: Database Migration Summary

**PostgreSQL schema migration adding scraper_sources + scrape_logs tables, normalize_text() IMMUTABLE function, dedup RPC, normalized_title trigger, and 3 pg_cron schedules targeting the scrape-sagre Edge Function via Vault secrets**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-04T21:03:01Z
- **Completed:** 2026-03-04
- **Tasks:** 2 (1 automated, 1 human-verify checkpoint — verified by user)
- **Files modified:** 1

## Accomplishments

- Created complete `supabase/migrations/002_scraping_pipeline.sql` with all 10 schema sections
- Migration applied successfully in Supabase SQL Editor with zero errors — confirmed by user ("tutto corretto")
- 5 scraper sources seeded in scraper_sources; 3 pg_cron jobs confirmed in cron.job; sagre columns added
- Established normalize_text() IMMUTABLE SQL function matching the TypeScript normalizeText() contract
- Configured 3 pg_cron jobs: daily expiry (pure SQL), morning scrape (06:00 UTC), evening scrape (18:00 UTC)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create schema migration with tables, functions, triggers, and indexes** - `1eb43a8` (feat)
2. **Task 2: Human verification of Supabase migration** - Verified by user (no code commit — human action)

**Plan metadata:** TBD (this SUMMARY commit)

## Files Created/Modified

- `supabase/migrations/002_scraping_pipeline.sql` - Complete Phase 2 DDL: scraper_sources, scrape_logs, normalize_text(), update_normalized_title trigger, find_duplicate_sagra(), ALTER sagre, RLS policy, 3 pg_cron schedules, 5-row seed

## Decisions Made

- Used `extensions.unaccent(t)` (fully qualified schema) in normalize_text() to satisfy PostgreSQL's IMMUTABLE declaration requirement on Supabase (regular `unaccent()` is not guaranteed IMMUTABLE in this context)
- pg_cron HTTP calls read project URL and anon key from `vault.decrypted_secrets` rather than embedding them — requires Vault setup before running the cron schedule statements
- expire-sagre-daily uses a pure SQL UPDATE in the pg_cron body (no Edge Function invocation) since it's a simple date comparison with no external dependencies
- find_duplicate_sagra() fallback: when either side has NULL dates, match on name+city alone (handles undated sagre gracefully rather than missing matches)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

Before running the migration, set two Vault secrets in the Supabase Dashboard:

1. Go to: Database -> Vault -> Add secret
   - name: `project_url`, value: `https://YOUR_PROJECT_REF.supabase.co`
2. Go to: Database -> Vault -> Add secret
   - name: `anon_key`, value: your anon key from Project Settings -> API

Then run the full `supabase/migrations/002_scraping_pipeline.sql` file in the SQL Editor.

**Post-migration verification queries:**

```sql
-- Confirm 5 sources seeded
SELECT name, is_active FROM scraper_sources ORDER BY name;

-- Confirm cron jobs registered
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Confirm sagre columns added
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'sagre' AND column_name IN ('sources', 'is_active', 'normalized_title');
```

## Issues Encountered

None — migration ran successfully on first attempt. User confirmed: "migration applied, tutto corretto." All 8 verification checks passed: 5 sources seeded, 3 cron schedules created, sagre columns added.

## Next Phase Readiness

- Schema fully applied in Supabase — Edge Function (Plan 02-03) can read from scraper_sources and write to sagre/scrape_logs
- find_duplicate_sagra() RPC ready for deduplication calls
- CSS selectors in scraper_sources are starting templates — verify against live site HTML before first scrape run
- Vault secrets (project_url, anon_key) must be confirmed present before pg_cron HTTP jobs will fire

---
*Phase: 02-scraping-pipeline*
*Completed: 2026-03-04*
