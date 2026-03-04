-- =============================================================================
-- 003_enrichment.sql — Phase 3: Data Enrichment
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- enrich_logs: records every enrichment run for observability
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.enrich_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at          TIMESTAMPTZ DEFAULT NOW(),
  geocoded_count  INTEGER DEFAULT 0,       -- sagre successfully geocoded this run
  geocode_failed  INTEGER DEFAULT 0,       -- sagre where Nominatim returned no result
  llm_count       INTEGER DEFAULT 0,       -- sagre enriched by LLM this run
  skipped_count   INTEGER DEFAULT 0,       -- sagre already enriched (status='enriched')
  error_message   TEXT,
  duration_ms     INTEGER,
  completed_at    TIMESTAMPTZ
);

-- Enable RLS (read-only for authenticated users; Edge Function uses service role)
ALTER TABLE public.enrich_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrich_logs_select" ON public.enrich_logs
  FOR SELECT TO authenticated USING (true);

-- -----------------------------------------------------------------------------
-- pg_cron: trigger enrich-sagre twice daily, offset 30min after scrape runs
-- scrape-sagre runs at 06:00 and 18:00; enrichment runs at 06:30 and 18:30
-- Vault secrets: 'project_url' and 'anon_key' set in Phase 2
-- -----------------------------------------------------------------------------

-- Morning enrichment
SELECT cron.schedule(
  'enrich-sagre-morning',
  '30 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/enrich-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Evening enrichment
SELECT cron.schedule(
  'enrich-sagre-evening',
  '30 18 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/enrich-sagre',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
    ),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);

-- Verification query (run after applying migration):
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'enrich-%';
-- Expected: 2 rows — enrich-sagre-morning, enrich-sagre-evening
