-- =============================================================================
-- 045_arquapetrarca_cron_source.sql — pg_cron job for scrape-arquapetrarca
-- Scrapes arquapetrarca.com (official Arqua Petrarca events page, PD).
-- Single-page scraper (no pagination), very lightweight.
-- Runs 1x/week (Monday morning).
--
-- Run in Supabase SQL Editor (manual execution)
-- =============================================================================

-- --- scrape-arquapetrarca: 1x/week (Monday 07:30 UTC) ---
SELECT cron.schedule(
  'scrape-arquapetrarca-weekly',
  '30 7 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
            || '/functions/v1/scrape-arquapetrarca',
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
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'scrape-arquapetrarca%';
-- Expected:
--   scrape-arquapetrarca-weekly  30 7 * * 1   true
